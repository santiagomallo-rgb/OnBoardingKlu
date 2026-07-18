// Prueba end-to-end de la lógica de dominio contra la base real.
// Uso: npx tsx --env-file=.env.local scripts/test-flow.ts

import { db } from "../src/lib/supabase";
import { createCaseWithInvite, saveStepValues, completeLayer, layerProgress } from "../src/lib/onboarding";
import { getTenant, getLayer } from "../src/config";
import type { CaseRow, PartyRow, TenantRow } from "../src/lib/types";

function cuitFor(prefix: string, dni: string): string {
  const base = prefix + dni;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(base[i]), 0);
  let dv = 11 - (sum % 11);
  if (dv === 11) dv = 0;
  if (dv === 10) throw new Error("dni genera dv 10, probar otro");
  return base + dv;
}

async function main() {
  const supa = db();
  const tenant = getTenant("ar");

  const { data: tenantRow } = await supa.from("tenants").select("*").eq("slug", "ar").single<TenantRow>();
  if (!tenantRow) throw new Error("tenant ar no existe");
  const { data: product } = await supa
    .from("products")
    .select("id, name")
    .eq("tenant_id", tenantRow.id)
    .eq("code", "pspcp")
    .single<{ id: string; name: string }>();
  if (!product) throw new Error("producto pspcp no existe");

  const taxId = cuitFor("20", "34567891");
  console.log("1) CUIT de prueba:", taxId, "→ validación:", tenant.validateTaxId(taxId));

  // Limpieza de corridas anteriores
  const { data: prevParty } = await supa
    .from("parties").select("id").eq("tenant_id", tenantRow.id).eq("tax_id", taxId).maybeSingle<{ id: string }>();
  if (prevParty) {
    await supa.from("onboarding_cases").delete().eq("party_id", prevParty.id);
    await supa.from("party_links").delete().eq("parent_party_id", prevParty.id);
    await supa.from("parties").delete().eq("id", prevParty.id);
    console.log("   (limpieza de corrida anterior)");
  }

  // 2) Alta de caso + invitación
  const r1 = await createCaseWithInvite({
    tenantRow, productId: product.id, kind: "human",
    taxId, email: "demo@grupoklu.com", displayName: "María Demo",
  });
  console.log("2) Caso creado:", r1);

  // 3) Segundo caso con el MISMO CUIT → la persona se reutiliza
  const r2 = await createCaseWithInvite({
    tenantRow, productId: product.id, kind: "human",
    taxId, email: "demo@grupoklu.com", displayName: "María Demo",
  });
  console.log("3) Segundo caso (misma persona):", { partyReused: r2.partyReused });
  if (!r2.partyReused) throw new Error("FALLO: la persona debería reutilizarse");
  await supa.from("onboarding_cases").delete().eq("id", r2.caseId);

  // 4) Simular carga del cliente: capa 1 completa
  const load = async () => {
    const { data: c } = await supa.from("onboarding_cases").select("*").eq("id", r1.caseId).single<CaseRow>();
    const { data: p } = await supa.from("parties").select("*").eq("id", c!.party_id).single<PartyRow>();
    return { caseRow: c!, party: p! };
  };
  const layer1 = getLayer("ar", "human", 1)!;
  const stepData: Record<string, Record<string, unknown>> = {
    identidad: {
      nombre_apellido: "María Demo", tipo_documento: "dni", numero_documento: "34567891",
      fecha_nacimiento: "1990-05-01", lugar_nacimiento: "CABA", nacionalidad: "Argentina", estado_civil: "soltero",
    },
    contacto: {
      domicilio_calle: "Av. Corrientes", domicilio_numero: "1234", domicilio_localidad: "CABA",
      domicilio_provincia: "CABA", domicilio_cp: "C1043", domicilio_pais: "Argentina",
      telefono: "+54911.5555.5555", email: "demo@grupoklu.com",
    },
    actividad: { actividad_laboral: "Comerciante" },
    declaraciones: { ddjj_pep: false, ddjj_sujeto_obligado: false, acepta_declaracion: true },
  };
  for (const step of layer1.steps) {
    const { caseRow, party } = await load();
    await saveStepValues({
      tenantSlug: "ar", caseRow, party, layer: layer1, stepKey: step.key,
      values: stepData[step.key] ?? {}, peopleValues: {},
    });
  }
  let ctx = await load();
  const done1 = await completeLayer({ tenantSlug: "ar", caseRow: ctx.caseRow, party: ctx.party, layer: layer1 });
  console.log("4) Capa 1 completada:", done1);
  if (!done1.ok) throw new Error("FALLO capa 1: " + JSON.stringify(done1));

  // 5) Capa 2: perfil transaccional (relación de dependencia)
  const layer2 = getLayer("ar", "human", 2)!;
  ctx = await load();
  await saveStepValues({
    tenantSlug: "ar", caseRow: ctx.caseRow, party: ctx.party, layer: layer2, stepKey: "ingresos",
    values: { tipo_ingreso: "relacion_dependencia", neto_mensual: 1500000, volumen_mensual_esperado: 2000000 },
    peopleValues: {},
  });
  ctx = await load();
  const done2 = await completeLayer({ tenantSlug: "ar", caseRow: ctx.caseRow, party: ctx.party, layer: layer2 });
  ctx = await load();
  console.log("5) Capa 2 completada:", done2, "→ perfil:", ctx.caseRow.transactional_profile);
  const profile = ctx.caseRow.transactional_profile as { annualAmount?: number };
  if (profile.annualAmount !== 1500000 * 13) throw new Error("FALLO: perfil mal calculado");

  // 6) Caso PJ con beneficiarios finales (reutilización de personas vinculadas)
  const cuitPj = cuitFor("30", "71234567");
  const { data: prevPj } = await supa
    .from("parties").select("id").eq("tenant_id", tenantRow.id).eq("tax_id", cuitPj).maybeSingle<{ id: string }>();
  if (prevPj) {
    await supa.from("onboarding_cases").delete().eq("party_id", prevPj.id);
    await supa.from("party_links").delete().eq("parent_party_id", prevPj.id);
    await supa.from("parties").delete().eq("id", prevPj.id);
  }
  const r3 = await createCaseWithInvite({
    tenantRow, productId: product.id, kind: "legal",
    taxId: cuitPj, email: "empresa@grupoklu.com", displayName: "Demo Comercio SAS",
  });
  const { data: cPj } = await supa.from("onboarding_cases").select("*").eq("id", r3.caseId).single<CaseRow>();
  const { data: pPj } = await supa.from("parties").select("*").eq("id", cPj!.party_id).single<PartyRow>();
  const layerPj = getLayer("ar", "legal", 1)!;
  await saveStepValues({
    tenantSlug: "ar", caseRow: cPj!, party: pPj!, layer: layerPj, stepKey: "personas",
    values: { beneficiarios_finales: [{ nombre: "María Demo", tax_id: taxId, pct: 60 }] },
    peopleValues: {
      beneficiarios_finales: {
        entries: [{ nombre: "María Demo", tax_id: taxId, pct: 60 }],
        role: "beneficiario_final", withPct: true,
      },
    },
  });
  const { data: links } = await supa.from("party_links").select("*").eq("parent_party_id", pPj!.id);
  console.log("6) BF vinculado a party existente:", links?.length === 1 && links[0].ownership_pct === 60 ? "OK" : links);

  // 7) Progreso
  const { data: layersRows } = await supa.from("case_layers").select("*").eq("case_id", r1.caseId);
  ctx = await load();
  console.log("7) Progreso PH:", layerProgress("ar", "human", ctx.party.data, (layersRows ?? []) as never).map((p) => `${p.layer.number}: ${p.done}/${p.total} ${p.status}`));

  // Token del invite para probar el gate por HTTP
  console.log("INVITE_TOKEN=" + r1.inviteToken);
  console.log("CASE_ID=" + r1.caseId);
  console.log("TODO OK ✅");
}

main().catch((e) => {
  console.error("FALLO ❌", e);
  process.exit(1);
});
