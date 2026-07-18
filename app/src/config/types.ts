// Tipos de la configuración por tenant (país).
// Todo el flujo de onboarding es data-driven: cada tenant define sus capas,
// pasos y campos. Los objetos de capas/pasos/campos son datos serializables
// (pueden pasarse a client components); las funciones (validación de tax id,
// cálculo de perfil) sólo se usan del lado del servidor.

export type PartyKind = "human" | "legal";

export type FieldType =
  | "text"
  | "date"
  | "select"
  | "email"
  | "phone"
  | "number"
  | "textarea"
  | "boolean"
  | "people"
  | "file";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  help?: string;
  placeholder?: string;
  /** Mostrar sólo si otro campo tiene cierto valor ("true"/"false" para boolean) */
  showIf?: { field: string; equals: string };
  /** Para type "people": rol con el que se vincula cada persona cargada */
  peopleRole?: string;
  /** Para type "people": pedir % de participación (beneficiarios finales) */
  withOwnershipPct?: boolean;
  /** Para type "file": tipo de documento que se guarda */
  docType?: string;
}

export interface StepDef {
  key: string;
  title: string;
  intro?: string;
  fields: FieldDef[];
}

export interface LayerDef {
  number: number;
  code: string;
  title: string;
  description: string;
  /** Qué habilita completar esta capa — se muestra al cliente como beneficio */
  unlocks: string;
  steps: StepDef[];
}

export interface CheckDef {
  code: string;
  name: string;
  description: string;
  onFail: "block" | "high_risk" | "oc_approval";
}

export interface ProfileResult {
  basis: string;
  monthlyAmount?: number;
  annualAmount?: number;
  note: string;
}

export interface TenantConfig {
  slug: string;
  name: string;
  countryCode: string;
  countryName: string;
  taxIdType: string; // 'CUIT' | 'RFC' | ...
  taxIdLabel: string;
  taxIdPlaceholder: string;
  taxIdHelp: string;
  currency: string;
  normalizeTaxId: (raw: string) => string;
  validateTaxId: (
    raw: string
  ) => { ok: true; normalized: string } | { ok: false; error: string };
  layers: Record<PartyKind, LayerDef[]>;
  checks: CheckDef[];
  defaultProfileNote: Record<PartyKind, string>;
  /** Cálculo del perfil transaccional sugerido a partir de los datos de capa 2 */
  computeProfile: (kind: PartyKind, data: Record<string, unknown>) => ProfileResult;
  welcome: { title: string; body: string };
  productPitch: { title: string; body: string }[];
}
