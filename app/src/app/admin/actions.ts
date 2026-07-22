"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import {
  checkAdminPassword,
  createAdminSession,
  destroyAdminSession,
  isAdmin,
} from "@/lib/session";
import { resolveTenantConfig } from "@/lib/config-db";
import { createCaseWithInvite, logEvent } from "@/lib/onboarding";
import { sendInviteEmail } from "@/lib/email";
import type { InviteRow, PartyRow, ProductRow, TenantRow } from "@/lib/types";

async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}

// ── Login / logout ───────────────────────────────────────────────────────

export async function loginAction(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const password = String(formData.get("password") ?? "");
  if (!checkAdminPassword(password)) {
    return { error: "Contraseña incorrecta." };
  }
  await createAdminSession();
  redirect("/admin");
}

export async function logoutAction() {
  await destroyAdminSession();
  redirect("/admin/login");
}

// ── Alta de cliente + invitación ─────────────────────────────────────────

export interface NewClientState {
  error?: string;
}

export async function createClientAction(
  _prev: NewClientState | null,
  formData: FormData
): Promise<NewClientState> {
  await requireAdmin();
  const supa = db();

  const tenantSlug = String(formData.get("tenant") ?? "");
  const productId = String(formData.get("product") ?? "");
  const kind = String(formData.get("kind") ?? "") as "human" | "legal";
  const taxIdRaw = String(formData.get("tax_id") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  const displayName = String(formData.get("display_name") ?? "").trim();

  if (!tenantSlug || !productId || !kind || !taxIdRaw || !email || !displayName) {
    return { error: "Completá todos los campos." };
  }

  const { data: tenantRow } = await supa
    .from("tenants")
    .select("*")
    .eq("slug", tenantSlug)
    .maybeSingle<TenantRow>();
  if (!tenantRow) return { error: "País inválido." };

  const { data: product } = await supa
    .from("products")
    .select("*")
    .eq("id", productId)
    .eq("tenant_id", tenantRow.id)
    .maybeSingle<ProductRow>();
  if (!product) return { error: "Producto inválido para ese país." };

  const tenant = await resolveTenantConfig(tenantRow, productId);

  const taxCheck = tenant.validateTaxId(taxIdRaw);
  if (!taxCheck.ok) return { error: taxCheck.error };

  let result;
  try {
    result = await createCaseWithInvite({
      tenantRow,
      tenant,
      productId,
      kind,
      taxId: taxCheck.normalized,
      email,
      displayName,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error creando el caso." };
  }

  const sendResult = await sendInviteEmail({
    tenant,
    to: email,
    displayName,
    productName: product.name,
    inviteToken: result.inviteToken,
  });
  await supa
    .from("invites")
    .update({ status: sendResult.sent ? "sent" : "created" })
    .eq("token", result.inviteToken);
  await logEvent(
    result.caseId,
    sendResult.sent ? "invite_sent" : "invite_created_unsent",
    { email, error: sendResult.error },
    "admin"
  );

  redirect(`/admin/${tenantSlug}/cases/${result.caseId}`);
}

// ── Reenviar invitación ──────────────────────────────────────────────────

export async function resendInviteAction(formData: FormData) {
  await requireAdmin();
  const supa = db();
  const inviteId = String(formData.get("invite_id") ?? "");

  const { data: invite } = await supa
    .from("invites")
    .select("*")
    .eq("id", inviteId)
    .single<InviteRow>();
  if (!invite) return;

  const { data: caseRow } = await supa
    .from("onboarding_cases")
    .select("id, party_id, product_id, tenant_id")
    .eq("id", invite.case_id)
    .single<{ id: string; party_id: string; product_id: string; tenant_id: string }>();
  const { data: tenantRow } = await supa
    .from("tenants")
    .select("*")
    .eq("id", invite.tenant_id)
    .single<TenantRow>();
  if (!caseRow || !tenantRow) return;

  const { data: party } = await supa
    .from("parties")
    .select("*")
    .eq("id", caseRow.party_id)
    .single<PartyRow>();
  const { data: product } = await supa
    .from("products")
    .select("*")
    .eq("id", caseRow.product_id)
    .single<ProductRow>();

  const tenant = await resolveTenantConfig(tenantRow, caseRow.product_id);
  const sendResult = await sendInviteEmail({
    tenant,
    to: invite.email,
    displayName: party?.display_name ?? null,
    productName: product?.name ?? "tu cuenta",
    inviteToken: invite.token,
  });
  if (sendResult.sent) {
    await supa.from("invites").update({ status: "sent" }).eq("id", invite.id);
  }
  await logEvent(caseRow.id, sendResult.sent ? "invite_resent" : "invite_resend_failed", { error: sendResult.error }, "admin");
  revalidatePath(`/admin/${tenantRow.slug}/cases/${caseRow.id}`);
}

// ── Chequeos de cumplimiento ─────────────────────────────────────────────

export async function updateCheckAction(formData: FormData) {
  await requireAdmin();
  const supa = db();
  const checkId = String(formData.get("check_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const notes = String(formData.get("notes") ?? "");
  const caseId = String(formData.get("case_id") ?? "");

  if (!["pending", "passed", "flagged", "blocked"].includes(status)) return;

  await supa
    .from("compliance_checks")
    .update({
      status,
      result_notes: notes || null,
      checked_by: "admin",
      checked_at: status === "pending" ? null : new Date().toISOString(),
    })
    .eq("id", checkId);

  await logEvent(caseId, "check_updated", { checkId, status }, "admin");

  // Un chequeo bloqueante marca el caso como bloqueado
  if (status === "blocked") {
    await supa.from("onboarding_cases").update({ status: "blocked", updated_at: new Date().toISOString() }).eq("id", caseId);
  }
  revalidatePath("/admin", "layout");
}

// ── Riesgo y decisión ────────────────────────────────────────────────────

export async function setRiskAction(formData: FormData) {
  await requireAdmin();
  const supa = db();
  const caseId = String(formData.get("case_id") ?? "");
  const risk = String(formData.get("risk") ?? "");
  if (!["low", "medium", "high"].includes(risk)) return;
  await supa.from("onboarding_cases").update({ risk_level: risk, updated_at: new Date().toISOString() }).eq("id", caseId);
  await logEvent(caseId, "risk_set", { risk }, "admin");
  revalidatePath("/admin", "layout");
}

export async function decideCaseAction(formData: FormData) {
  await requireAdmin();
  const supa = db();
  const caseId = String(formData.get("case_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const notes = String(formData.get("notes") ?? "");
  if (!["approved", "rejected", "under_review"].includes(decision)) return;
  await supa
    .from("onboarding_cases")
    .update({ status: decision, notes: notes || null, updated_at: new Date().toISOString() })
    .eq("id", caseId);
  await logEvent(caseId, "case_decided", { decision }, "admin");
  revalidatePath("/admin", "layout");
}
