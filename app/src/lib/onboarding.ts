import { db } from "./supabase";
import { isFieldVisible } from "@/config";
import type { TenantConfig } from "@/config/types";
import type { LayerDef, PartyKind } from "@/config/types";
import { newInviteToken } from "./session";
import type {
  CaseLayerRow,
  CaseRow,
  PartyRow,
  PersonEntry,
  TenantRow,
} from "./types";

// Lógica de dominio compartida entre el panel admin y el flujo público.

export async function logEvent(
  caseId: string,
  event: string,
  detail: Record<string, unknown> = {},
  actor: "system" | "admin" | "client" = "system"
) {
  await db().from("case_events").insert({ case_id: caseId, event, detail, actor });
}

/**
 * Da de alta (o reutiliza) una party por tenant+tax_id, crea el caso, los
 * chequeos de cumplimiento y la invitación. Este es el corazón del principio
 * "los datos se cargan una vez": si la persona ya existe, se reutiliza.
 */
export async function createCaseWithInvite(opts: {
  tenantRow: TenantRow;
  tenant: TenantConfig;
  productId: string;
  kind: PartyKind;
  taxId: string; // ya normalizado y validado
  email: string;
  displayName: string;
}): Promise<{ caseId: string; inviteToken: string; partyReused: boolean }> {
  const supa = db();
  const tenant = opts.tenant;

  const { data: existing } = await supa
    .from("parties")
    .select("*")
    .eq("tenant_id", opts.tenantRow.id)
    .eq("tax_id", opts.taxId)
    .maybeSingle<PartyRow>();

  let partyId: string;
  const partyReused = !!existing;
  if (existing) {
    partyId = existing.id;
    if (!existing.email || !existing.display_name) {
      await supa
        .from("parties")
        .update({
          email: existing.email || opts.email,
          display_name: existing.display_name || opts.displayName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", partyId);
    }
  } else {
    const { data: created, error } = await supa
      .from("parties")
      .insert({
        tenant_id: opts.tenantRow.id,
        kind: opts.kind,
        tax_id: opts.taxId,
        display_name: opts.displayName,
        email: opts.email,
        data: {},
      })
      .select("id")
      .single<{ id: string }>();
    if (error || !created) throw new Error(`No se pudo crear la persona: ${error?.message}`);
    partyId = created.id;
  }

  const { data: caseRow, error: caseErr } = await supa
    .from("onboarding_cases")
    .insert({
      tenant_id: opts.tenantRow.id,
      party_id: partyId,
      product_id: opts.productId,
      status: "invited",
      current_layer: 1,
    })
    .select("id")
    .single<{ id: string }>();
  if (caseErr || !caseRow) throw new Error(`No se pudo crear el caso: ${caseErr?.message}`);

  await supa.from("compliance_checks").insert(
    tenant.checks.map((c) => ({ case_id: caseRow.id, check_code: c.code }))
  );

  const token = newInviteToken();
  const { error: invErr } = await supa.from("invites").insert({
    tenant_id: opts.tenantRow.id,
    case_id: caseRow.id,
    token,
    email: opts.email,
    status: "created",
    expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(), // 30 días
  });
  if (invErr) throw new Error(`No se pudo crear la invitación: ${invErr.message}`);

  await logEvent(caseRow.id, "case_created", { partyReused }, "admin");
  return { caseId: caseRow.id, inviteToken: token, partyReused };
}

/**
 * Mergea los valores de un paso en party.data y marca la capa en progreso.
 * Para campos "people", además upserta cada persona como party propia y crea
 * el vínculo (apoderado / BF / órgano de administración).
 */
export async function saveStepValues(opts: {
  tenant: TenantConfig;
  caseRow: CaseRow;
  party: PartyRow;
  layer: LayerDef;
  stepKey: string;
  values: Record<string, unknown>;
  peopleValues: Record<string, { entries: PersonEntry[]; role: string; withPct: boolean }>;
}) {
  const supa = db();
  const tenant = opts.tenant;

  for (const [, { entries, role, withPct }] of Object.entries(opts.peopleValues)) {
    for (const person of entries) {
      const check = tenant.validateTaxId(person.tax_id);
      if (!check.ok) {
        throw new Error(`${tenant.taxIdLabel} inválido para "${person.nombre}": ${check.error}`);
      }
      const normalized = check.normalized;
      const { data: existing } = await supa
        .from("parties")
        .select("id, display_name, email")
        .eq("tenant_id", opts.party.tenant_id)
        .eq("tax_id", normalized)
        .maybeSingle<{ id: string; display_name: string | null; email: string | null }>();

      let childId: string;
      if (existing) {
        childId = existing.id;
      } else {
        const { data: created, error } = await supa
          .from("parties")
          .insert({
            tenant_id: opts.party.tenant_id,
            kind: "human",
            tax_id: normalized,
            display_name: person.nombre,
            email: person.email || null,
            data: {},
          })
          .select("id")
          .single<{ id: string }>();
        if (error || !created) throw new Error(`No se pudo registrar a ${person.nombre}: ${error?.message}`);
        childId = created.id;
      }

      await supa.from("party_links").upsert(
        {
          tenant_id: opts.party.tenant_id,
          parent_party_id: opts.party.id,
          child_party_id: childId,
          role,
          ownership_pct: withPct && person.pct != null ? person.pct : null,
        },
        { onConflict: "parent_party_id,child_party_id,role" }
      );
      person.tax_id = normalized;
    }
  }

  const mergedData = { ...opts.party.data, ...opts.values };
  const displayName =
    (mergedData["nombre_apellido"] as string) ||
    (mergedData["nombre_completo"] as string) ||
    (mergedData["razon_social"] as string) ||
    opts.party.display_name;

  await supa
    .from("parties")
    .update({
      data: mergedData,
      display_name: displayName,
      email: (mergedData["email"] as string) || (mergedData["email_sede"] as string) || opts.party.email,
      phone: (mergedData["telefono"] as string) || (mergedData["telefono_sede"] as string) || opts.party.phone,
      updated_at: new Date().toISOString(),
    })
    .eq("id", opts.party.id);

  await supa.from("case_layers").upsert(
    { case_id: opts.caseRow.id, layer: opts.layer.number, status: "in_progress" },
    { onConflict: "case_id,layer", ignoreDuplicates: false }
  );

  if (opts.caseRow.status === "invited") {
    await supa.from("onboarding_cases").update({ status: "in_progress", updated_at: new Date().toISOString() }).eq("id", opts.caseRow.id);
  }

  await logEvent(opts.caseRow.id, "step_saved", { layer: opts.layer.number, step: opts.stepKey }, "client");
  return mergedData;
}

/** Campos requeridos y visibles de una capa que faltan completar. */
export function missingFields(layer: LayerDef, data: Record<string, unknown>): string[] {
  const missing: string[] = [];
  for (const step of layer.steps) {
    for (const f of step.fields) {
      if (!f.required || !isFieldVisible(f, data)) continue;
      const v = data[f.key];
      const empty =
        v == null ||
        v === "" ||
        (f.type === "boolean" && f.key.startsWith("acepta") && v !== true) ||
        (f.type === "boolean" && v !== true && v !== false) ||
        (f.type === "people" && (!Array.isArray(v) || v.length === 0));
      if (empty) missing.push(f.label);
    }
  }
  return missing;
}

/** Cierra una capa: valida completitud, actualiza estado y calcula perfil. */
export async function completeLayer(opts: {
  tenant: TenantConfig;
  caseRow: CaseRow;
  party: PartyRow;
  layer: LayerDef;
}): Promise<{ ok: true } | { ok: false; missing: string[] }> {
  const supa = db();
  const tenant = opts.tenant;
  const missing = missingFields(opts.layer, opts.party.data);
  if (missing.length > 0) return { ok: false, missing };

  await supa.from("case_layers").upsert(
    {
      case_id: opts.caseRow.id,
      layer: opts.layer.number,
      status: "completed",
      completed_at: new Date().toISOString(),
    },
    { onConflict: "case_id,layer" }
  );

  const layers = opts.tenant.layers[opts.party.kind];
  const isLast = opts.layer.number >= Math.max(...layers.map((l) => l.number));
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    current_layer: isLast ? opts.layer.number : opts.layer.number + 1,
  };

  if (opts.layer.number === 1) {
    updates.status = "submitted";
  }
  if (opts.layer.code === "perfil_transaccional") {
    updates.transactional_profile = tenant.computeProfile(opts.party.kind, opts.party.data) as unknown as Record<string, unknown>;
  }

  await supa.from("onboarding_cases").update(updates).eq("id", opts.caseRow.id);
  await logEvent(opts.caseRow.id, "layer_completed", { layer: opts.layer.number, code: opts.layer.code }, "client");
  return { ok: true };
}

/** Progreso de un caso: por capa, campos requeridos completados / totales. */
export function layerProgress(
  tenant: TenantConfig,
  kind: PartyKind,
  data: Record<string, unknown>,
  caseLayers: CaseLayerRow[]
): { layer: LayerDef; done: number; total: number; status: string }[] {
  return tenant.layers[kind].map((layer) => {
    let done = 0;
    let total = 0;
    for (const step of layer.steps) {
      for (const f of step.fields) {
        if (!f.required || !isFieldVisible(f, data)) continue;
        total++;
        const v = data[f.key];
        const filled =
          v != null &&
          v !== "" &&
          !(f.type === "people" && (!Array.isArray(v) || v.length === 0));
        if (filled) done++;
      }
    }
    const row = caseLayers.find((c) => c.layer === layer.number);
    return { layer, done, total, status: row?.status ?? "pending" };
  });
}
