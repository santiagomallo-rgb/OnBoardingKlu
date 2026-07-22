// Resolución de la configuración de un país.
//
// Argentina y México tienen config rica en TypeScript (fiel al Manual PLA/FT).
// Los países que se crean desde el panel no tienen código: su configuración se
// deriva de la fila de `tenants` y de los requisitos de cumplimiento cargados
// en cada producto (PRD §7.1 — la normativa se expresa como datos).

import type { ProductRequirementRow, TenantRow } from "@/lib/types";
import { TENANTS } from "./index";
import type {
  CheckDef,
  FieldDef,
  LayerDef,
  PartyKind,
  ProfileResult,
  TenantConfig,
} from "./types";

/** ¿Este país tiene configuración de onboarding escrita en código? */
export function hasCodeConfig(slug: string): boolean {
  return Boolean(TENANTS[slug]);
}

function normalizeGeneric(raw: string): string {
  return raw.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

function validateGeneric(
  raw: string,
  label: string
): { ok: true; normalized: string } | { ok: false; error: string } {
  const n = normalizeGeneric(raw);
  if (n.length < 5) return { ok: false, error: `El ${label} es demasiado corto.` };
  if (n.length > 20) return { ok: false, error: `El ${label} es demasiado largo.` };
  return { ok: true, normalized: n };
}

/** Un requisito cargado en el panel se convierte en un campo del formulario. */
export function requirementToField(r: ProductRequirementRow): FieldDef {
  return {
    key: r.code,
    label: r.label,
    type: r.field_type,
    required: r.required,
    help: r.help ?? undefined,
    options: r.options?.length ? r.options : undefined,
    ...(r.field_type === "file" ? { docType: r.code } : {}),
    ...(r.field_type === "people" ? { peopleRole: r.code } : {}),
  };
}

/** Los requisitos de categoría "control" son chequeos internos, no campos del cliente. */
function requirementToCheck(r: ProductRequirementRow): CheckDef {
  return {
    code: r.code,
    name: r.label,
    description: r.help ?? "Control de cumplimiento definido para este producto.",
    onFail: "oc_approval",
  };
}

/** Construye las capas de un país sin código a partir de los requisitos del producto. */
export function layersFromRequirements(
  requirements: ProductRequirementRow[],
  kind: PartyKind
): LayerDef[] {
  const applicable = requirements
    .filter((r) => r.applies_to === "both" || r.applies_to === kind)
    .filter((r) => r.category !== "control")
    .sort((a, b) => a.sort_order - b.sort_order);

  const datos = applicable.filter((r) => r.category === "dato" || r.category === "declaracion");
  const docs = applicable.filter((r) => r.category === "documento");

  const steps = [];
  if (datos.length) {
    steps.push({
      key: "datos",
      title: "Tus datos",
      intro: "Necesitamos estos datos para poder darte de alta.",
      fields: datos.map(requirementToField),
    });
  }
  if (docs.length) {
    steps.push({
      key: "documentacion",
      title: "Documentación",
      intro: "Adjuntá la documentación que respalda tus datos.",
      fields: docs.map(requirementToField),
    });
  }

  if (!steps.length) return [];

  return [
    {
      number: 1,
      code: "alta",
      title: "Alta de cuenta",
      description:
        "Completá la información que exige la normativa local para habilitar tu cuenta.",
      unlocks: "Al terminar, tu solicitud pasa a revisión de nuestro equipo de Cumplimiento.",
      steps,
    },
  ];
}

/** Config derivada de la base, para países creados desde el panel. */
export function tenantFromRow(
  row: TenantRow,
  requirements: ProductRequirementRow[] = []
): TenantConfig {
  const label = row.tax_id_label || row.tax_id_type;
  const checks = requirements
    .filter((r) => r.category === "control")
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(requirementToCheck);

  return {
    slug: row.slug,
    name: row.name,
    countryCode: row.country_code,
    countryName: row.name,
    taxIdType: row.tax_id_type,
    taxIdLabel: label,
    taxIdPlaceholder: row.tax_id_placeholder || "",
    taxIdHelp: row.tax_id_help || "Ingresá tu identificación fiscal.",
    currency: row.currency,
    normalizeTaxId: normalizeGeneric,
    validateTaxId: (raw) => validateGeneric(raw, label),
    layers: {
      human: layersFromRequirements(requirements, "human"),
      legal: layersFromRequirements(requirements, "legal"),
    },
    checks,
    defaultProfileNote: {
      human: "Perfil a determinar por el Oficial de Cumplimiento.",
      legal: "Perfil a determinar por el Oficial de Cumplimiento.",
    },
    computeProfile: (): ProfileResult => ({
      basis: "pendiente",
      note: "Este país todavía no tiene reglas de perfil transaccional cargadas.",
    }),
    welcome: {
      title: row.welcome_title || `Bienvenido al onboarding de ${row.name}`,
      body:
        row.welcome_body ||
        "Completá tus datos una sola vez y quedan disponibles para todos nuestros productos.",
    },
    productPitch: [],
  };
}

/**
 * Config de un país: la escrita en código si existe, o la derivada de la base.
 * `requirements` sólo se usa para los países sin código.
 */
export function resolveTenant(
  row: TenantRow,
  requirements: ProductRequirementRow[] = []
): TenantConfig {
  return TENANTS[row.slug] ?? tenantFromRow(row, requirements);
}
