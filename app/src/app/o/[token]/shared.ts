import { db } from "@/lib/supabase";
import { resolveTenantConfig } from "@/lib/config-db";
import type { TenantConfig } from "@/config/types";
import type { CaseRow, InviteRow, PartyRow, ProductRow, TenantRow } from "@/lib/types";

export interface InviteContext {
  invite: InviteRow;
  caseRow: CaseRow;
  party: PartyRow;
  product: ProductRow | null;
  tenantRow: TenantRow;
  tenant: TenantConfig;
}

/** Carga todo el contexto de una invitación por token. null si no existe. */
export async function loadInviteContext(token: string): Promise<InviteContext | null> {
  const supa = db();
  const { data: invite } = await supa
    .from("invites")
    .select("*")
    .eq("token", token)
    .maybeSingle<InviteRow>();
  if (!invite) return null;

  const [{ data: caseRow }, { data: tenantRow }] = await Promise.all([
    supa.from("onboarding_cases").select("*").eq("id", invite.case_id).single<CaseRow>(),
    supa.from("tenants").select("*").eq("id", invite.tenant_id).single<TenantRow>(),
  ]);
  if (!caseRow || !tenantRow) return null;

  const [{ data: party }, { data: product }] = await Promise.all([
    supa.from("parties").select("*").eq("id", caseRow.party_id).single<PartyRow>(),
    supa.from("products").select("*").eq("id", caseRow.product_id).single<ProductRow>(),
  ]);
  if (!party) return null;

  // La config del país sale del código (AR/MX) o se deriva de los requisitos
  // de cumplimiento cargados en el producto desde el panel.
  const tenant = await resolveTenantConfig(tenantRow, caseRow.product_id);

  return {
    invite,
    caseRow,
    party,
    product: product ?? null,
    tenantRow,
    tenant,
  };
}

export function inviteUsable(invite: InviteRow): { ok: boolean; reason?: string } {
  if (["revoked"].includes(invite.status)) {
    return { ok: false, reason: "Esta invitación fue revocada. Pedí una nueva a tu contacto comercial." };
  }
  if (invite.status === "expired" || (invite.expires_at && new Date(invite.expires_at) < new Date())) {
    return { ok: false, reason: "Esta invitación venció. Pedí una nueva a tu contacto comercial." };
  }
  if (invite.attempts >= invite.max_attempts) {
    return {
      ok: false,
      reason: "Superaste la cantidad de intentos de verificación. Por seguridad, pedí una nueva invitación.",
    };
  }
  return { ok: true };
}
