"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/supabase";
import { createInviteSession, hasInviteSession } from "@/lib/session";
import { isFieldVisible } from "@/config";
import { completeLayer, logEvent, saveStepValues } from "@/lib/onboarding";
import type { PersonEntry } from "@/lib/types";
import { loadInviteContext, inviteUsable } from "./shared";

// ── Gate: verificación del tax id ────────────────────────────────────────

export async function verifyTaxIdAction(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const token = String(formData.get("token") ?? "");
  const input = String(formData.get("tax_id") ?? "");

  const ctx = await loadInviteContext(token);
  if (!ctx) return { error: "Invitación inválida." };
  const usable = inviteUsable(ctx.invite);
  if (!usable.ok) return { error: usable.reason };

  const supa = db();
  const check = ctx.tenant.validateTaxId(input);
  const normalized = check.ok ? check.normalized : ctx.tenant.normalizeTaxId(input);

  if (!check.ok || normalized !== ctx.party.tax_id) {
    const attempts = ctx.invite.attempts + 1;
    await supa.from("invites").update({ attempts }).eq("id", ctx.invite.id);
    const remaining = ctx.invite.max_attempts - attempts;
    if (remaining <= 0) {
      return {
        error: "Superaste la cantidad de intentos permitidos. Por seguridad, pedí una nueva invitación.",
      };
    }
    return {
      error: `El ${ctx.tenant.taxIdLabel} no coincide con el de la invitación. Te quedan ${remaining} intento${remaining === 1 ? "" : "s"}.`,
    };
  }

  await createInviteSession(token);
  await supa
    .from("invites")
    .update({ status: "verified", verified_at: new Date().toISOString() })
    .eq("id", ctx.invite.id);
  await logEvent(ctx.caseRow.id, "invite_verified", {}, "client");
  redirect(`/o/${token}/w`);
}

// ── Guardado de un paso del wizard ───────────────────────────────────────

async function uploadDoc(opts: {
  tenantId: string;
  tenantSlug: string;
  partyId: string;
  caseId: string;
  docType: string;
  file: File;
}): Promise<{ fileName: string; storagePath: string; documentId: string }> {
  const supa = db();
  const safeName = opts.file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const path = `${opts.tenantSlug}/${opts.partyId}/${opts.docType}-${Date.now()}-${safeName}`;
  const buf = Buffer.from(await opts.file.arrayBuffer());
  const { error } = await supa.storage.from("kyc-docs").upload(path, buf, {
    contentType: opts.file.type || "application/octet-stream",
  });
  if (error) throw new Error(`No se pudo subir "${opts.file.name}": ${error.message}`);
  const { data: doc, error: docErr } = await supa
    .from("documents")
    .insert({
      tenant_id: opts.tenantId,
      party_id: opts.partyId,
      case_id: opts.caseId,
      doc_type: opts.docType,
      file_name: opts.file.name,
      storage_path: path,
    })
    .select("id")
    .single<{ id: string }>();
  if (docErr || !doc) throw new Error(`No se pudo registrar el documento: ${docErr?.message}`);
  return { fileName: opts.file.name, storagePath: path, documentId: doc.id };
}

export interface StepState {
  error?: string;
}

export async function saveStepAction(
  _prev: StepState | null,
  formData: FormData
): Promise<StepState> {
  const token = String(formData.get("_token") ?? "");
  const layerNumber = Number(formData.get("_layer") ?? 0);
  const stepKey = String(formData.get("_step") ?? "");

  if (!(await hasInviteSession(token))) {
    redirect(`/o/${token}`);
  }
  const ctx = await loadInviteContext(token);
  if (!ctx) return { error: "Invitación inválida." };
  if (["approved", "rejected", "blocked"].includes(ctx.caseRow.status)) {
    return { error: "Este trámite ya fue resuelto y no admite cambios. Contactá a tu asesor." };
  }

  const layer = ctx.tenant.layers[ctx.party.kind].find((l) => l.number === layerNumber);
  const step = layer?.steps.find((s) => s.key === stepKey);
  if (!layer || !step) return { error: "Paso inválido." };

  const values: Record<string, unknown> = {};
  const peopleValues: Record<string, { entries: PersonEntry[]; role: string; withPct: boolean }> = {};

  // Primera pasada: valores simples (los showIf se evalúan sobre el merge)
  for (const f of step.fields) {
    const raw = formData.get(f.key);
    switch (f.type) {
      case "boolean": {
        if (f.key.startsWith("acepta") || f.key.startsWith("ddjj_titularidad")) {
          values[f.key] = raw === "on" || raw === "true";
        } else if (raw === "true" || raw === "false") {
          values[f.key] = raw === "true";
        }
        break;
      }
      case "number": {
        const s = String(raw ?? "").trim();
        if (s !== "") {
          const n = Number(s);
          if (!Number.isFinite(n) || n < 0) return { error: `"${f.label}" debe ser un número válido.` };
          values[f.key] = n;
        }
        break;
      }
      case "people": {
        try {
          const parsed = JSON.parse(String(raw ?? "[]")) as PersonEntry[];
          const cleaned = parsed
            .filter((p) => p && p.nombre?.trim() && p.tax_id?.trim())
            .map((p) => ({
              nombre: p.nombre.trim(),
              tax_id: p.tax_id.trim(),
              email: p.email?.trim() || undefined,
              pct: p.pct != null && p.pct !== ("" as unknown) ? Number(p.pct) : undefined,
            }));
          values[f.key] = cleaned;
          peopleValues[f.key] = {
            entries: cleaned,
            role: f.peopleRole ?? "vinculado",
            withPct: !!f.withOwnershipPct,
          };
        } catch {
          return { error: `No se pudieron leer las personas de "${f.label}".` };
        }
        break;
      }
      case "file": {
        if (raw instanceof File && raw.size > 0) {
          if (raw.size > 8 * 1024 * 1024) {
            return { error: `"${f.label}": el archivo supera los 8 MB.` };
          }
          try {
            values[f.key] = await uploadDoc({
              tenantId: ctx.tenantRow.id,
              tenantSlug: ctx.tenantRow.slug,
              partyId: ctx.party.id,
              caseId: ctx.caseRow.id,
              docType: f.docType ?? f.key,
              file: raw,
            });
          } catch (e) {
            return { error: e instanceof Error ? e.message : "Error subiendo el archivo." };
          }
        }
        break;
      }
      default: {
        if (raw != null) values[f.key] = String(raw).trim();
      }
    }
  }

  // Validación de requeridos visibles de este paso
  const candidate = { ...ctx.party.data, ...values };
  for (const f of step.fields) {
    if (!f.required || !isFieldVisible(f, candidate)) continue;
    const v = candidate[f.key];
    const empty =
      v == null ||
      v === "" ||
      (f.type === "boolean" && (f.key.startsWith("acepta") || f.key.startsWith("ddjj_titularidad")) && v !== true) ||
      (f.type === "people" && (!Array.isArray(v) || v.length === 0));
    if (empty) return { error: `Falta completar: ${f.label}` };
  }

  try {
    await saveStepValues({
      tenant: ctx.tenant,
      caseRow: ctx.caseRow,
      party: ctx.party,
      layer,
      stepKey,
      values,
      peopleValues,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error guardando los datos." };
  }

  const stepIndex = layer.steps.findIndex((s) => s.key === stepKey);
  const isLast = stepIndex === layer.steps.length - 1;
  if (!isLast) {
    redirect(`/o/${token}/w?l=${layerNumber}&s=${stepIndex + 1}`);
  }

  // Último paso: intentar cerrar la capa
  const fresh = await loadInviteContext(token);
  if (!fresh) return { error: "Invitación inválida." };
  const result = await completeLayer({
    tenant: fresh.tenant,
    caseRow: fresh.caseRow,
    party: fresh.party,
    layer,
  });
  if (!result.ok) {
    return {
      error: `Para terminar esta etapa falta completar: ${result.missing.join(", ")}. Revisá los pasos anteriores.`,
    };
  }
  redirect(`/o/${token}/done?l=${layerNumber}`);
}
