import type { LayerDef, TenantConfig, ProfileResult, PartyKind } from "../types";

// Tenant México — Klu México.
// Estructura de ejemplo con RFC: ajustar campos y chequeos al manual local
// (CNBV / LFPIORPI) cuando esté definido. Sirve como demostración de que el
// producto es multi-tenant: mismas piezas, otro país, otro tax id.

function normalizeRfc(raw: string): string {
  return raw.toUpperCase().replace(/[^A-ZÑ&0-9]/g, "");
}

function validateRfc(raw: string): { ok: true; normalized: string } | { ok: false; error: string } {
  const rfc = normalizeRfc(raw);
  // Persona moral: 12 caracteres (3 letras + fecha + homoclave)
  // Persona física: 13 caracteres (4 letras + fecha + homoclave)
  const re = /^([A-ZÑ&]{3}\d{6}[A-Z\d]{3}|[A-ZÑ&]{4}\d{6}[A-Z\d]{3})$/;
  if (!re.test(rfc)) {
    return { ok: false, error: "El RFC no tiene un formato válido (12 caracteres para persona moral, 13 para persona física)." };
  }
  return { ok: true, normalized: rfc };
}

const domicilioFields = [
  { key: "domicilio_calle", label: "Calle", type: "text" as const, required: true },
  { key: "domicilio_numero", label: "Número", type: "text" as const, required: true },
  { key: "domicilio_colonia", label: "Colonia", type: "text" as const, required: true },
  { key: "domicilio_municipio", label: "Municipio / Alcaldía", type: "text" as const, required: true },
  { key: "domicilio_estado", label: "Estado", type: "text" as const, required: true },
  { key: "domicilio_cp", label: "Código Postal", type: "text" as const, required: true },
];

const humanLayers: LayerDef[] = [
  {
    number: 1,
    code: "alta_cuenta",
    title: "Alta de cuenta — Datos mínimos",
    description: "Datos de identificación mínimos para abrir tu cuenta Klu.",
    unlocks: "Completando esta capa puedes abrir tu cuenta y empezar a operar con el límite inicial.",
    steps: [
      {
        key: "identidad",
        title: "Tu identidad",
        fields: [
          { key: "nombre_completo", label: "Nombre completo", type: "text", required: true },
          { key: "curp", label: "CURP", type: "text", required: true, help: "Clave Única de Registro de Población (18 caracteres)." },
          { key: "fecha_nacimiento", label: "Fecha de nacimiento", type: "date", required: true },
          { key: "pais_nacimiento", label: "País de nacimiento", type: "text", required: true },
          { key: "nacionalidad", label: "Nacionalidad", type: "text", required: true },
          {
            key: "tipo_identificacion", label: "Identificación oficial", type: "select", required: true,
            options: [
              { value: "ine", label: "INE / IFE" },
              { value: "pasaporte", label: "Pasaporte" },
              { value: "cedula", label: "Cédula profesional" },
            ],
          },
          { key: "numero_identificacion", label: "Número de identificación", type: "text", required: true },
        ],
      },
      {
        key: "contacto",
        title: "Domicilio y contacto",
        fields: [
          ...domicilioFields,
          { key: "telefono", label: "Teléfono", type: "phone", required: true },
          { key: "email", label: "E-mail", type: "email", required: true },
        ],
      },
      {
        key: "actividad",
        title: "Tu actividad",
        fields: [
          { key: "ocupacion", label: "Ocupación o actividad económica", type: "text", required: true },
        ],
      },
      {
        key: "declaraciones",
        title: "Declaraciones",
        fields: [
          {
            key: "ddjj_pep", label: "¿Eres Persona Políticamente Expuesta (PEP)?", type: "boolean", required: true,
            help: "Desempeñas o has desempeñado funciones públicas destacadas, o eres cónyuge o pariente cercano de alguien que las desempeña.",
          },
          {
            key: "pep_detalle", label: "Cargo o función", type: "textarea",
            required: true, showIf: { field: "ddjj_pep", equals: "true" },
          },
          {
            key: "acepta_declaracion",
            label: "Declaro que los datos proporcionados son verdaderos y me comprometo a mantenerlos actualizados",
            type: "boolean", required: true,
          },
        ],
      },
    ],
  },
  {
    number: 2,
    code: "perfil_transaccional",
    title: "Ampliación de límites",
    description: "Demuestra tus ingresos para operar con límites más altos.",
    unlocks: "Aumenta tu límite operativo mensual según tus ingresos comprobables.",
    steps: [
      {
        key: "ingresos",
        title: "Tus ingresos",
        fields: [
          {
            key: "fuente_ingresos", label: "Fuente principal de ingresos", type: "select", required: true,
            options: [
              { value: "nomina", label: "Nómina (empleado)" },
              { value: "actividad_empresarial", label: "Actividad empresarial" },
              { value: "honorarios", label: "Honorarios / servicios profesionales" },
              { value: "otra", label: "Otra" },
            ],
          },
          { key: "ingreso_mensual", label: "Ingreso mensual aproximado (MXN)", type: "number", required: true },
          { key: "volumen_mensual_esperado", label: "¿Cuánto esperas mover por mes? (MXN)", type: "number", required: true },
          { key: "doc_ingresos", label: "Comprobante de ingresos", type: "file", docType: "respaldo_ingresos" },
        ],
      },
    ],
  },
];

const legalLayers: LayerDef[] = [
  {
    number: 1,
    code: "alta_cuenta",
    title: "Alta de cuenta — Datos de la empresa",
    description: "Datos de la persona moral para abrir la cuenta.",
    unlocks: "Completando esta capa la empresa puede abrir su cuenta y operar con el límite inicial.",
    steps: [
      {
        key: "sociedad",
        title: "La sociedad",
        fields: [
          { key: "razon_social", label: "Denominación o razón social", type: "text", required: true },
          { key: "fecha_constitucion", label: "Fecha de constitución", type: "date", required: true },
          { key: "folio_mercantil", label: "Folio mercantil / registro", type: "text", required: true },
          { key: "acta_constitutiva", label: "Acta constitutiva", type: "file", required: true, docType: "acta_constitutiva" },
        ],
      },
      {
        key: "sede",
        title: "Domicilio y contacto",
        fields: [
          ...domicilioFields,
          { key: "telefono_sede", label: "Teléfono", type: "phone", required: true },
          { key: "email_sede", label: "E-mail de contacto", type: "email", required: true },
        ],
      },
      {
        key: "actividad",
        title: "Actividad del negocio",
        fields: [
          { key: "actividad_principal", label: "Actividad o giro principal", type: "text", required: true },
          { key: "descripcion_negocio", label: "Descripción del negocio", type: "textarea", required: true },
        ],
      },
      {
        key: "personas",
        title: "Personas vinculadas",
        intro: "Si una persona ya está registrada con su RFC, sus datos se reutilizan automáticamente.",
        fields: [
          { key: "representantes", label: "Representantes legales y apoderados", type: "people", required: true, peopleRole: "representante_legal" },
          {
            key: "beneficiarios_finales", label: "Propietarios reales / beneficiarios controladores", type: "people",
            required: true, peopleRole: "beneficiario_final", withOwnershipPct: true,
            help: "Personas físicas con 25% o más del capital, o que ejerzan el control de la sociedad.",
          },
        ],
      },
      {
        key: "declaraciones",
        title: "Declaraciones",
        fields: [
          { key: "ddjj_titularidad", label: "Declaro la estructura de propiedad y control informada", type: "boolean", required: true },
          {
            key: "acepta_declaracion",
            label: "Declaro que los datos proporcionados son verdaderos y me comprometo a mantenerlos actualizados",
            type: "boolean", required: true,
          },
        ],
      },
    ],
  },
  {
    number: 2,
    code: "perfil_transaccional",
    title: "Perfil transaccional",
    description: "Amplía los límites de la empresa con estados financieros.",
    unlocks: "Aumenta el límite operativo de la empresa presentando estados financieros.",
    steps: [
      {
        key: "finanzas",
        title: "Información financiera",
        fields: [
          { key: "estados_financieros", label: "Estados financieros (último ejercicio)", type: "file", docType: "eeff" },
          { key: "ventas_anuales", label: "Ventas anuales (MXN)", type: "number", required: true },
          { key: "volumen_mensual_esperado", label: "Volumen mensual esperado (MXN)", type: "number", required: true },
        ],
      },
    ],
  },
];

function computeProfile(kind: PartyKind, data: Record<string, unknown>): ProfileResult {
  const monthly = Number(kind === "legal" ? data["volumen_mensual_esperado"] : data["ingreso_mensual"]);
  if (Number.isFinite(monthly) && monthly > 0) {
    return {
      basis: kind === "legal" ? "ventas_declaradas" : "ingresos_declarados",
      monthlyAmount: Math.round(monthly),
      annualAmount: Math.round(monthly * 12),
      note: "Perfil estimado sobre lo declarado. Definir criterios definitivos según manual local (pendiente).",
    };
  }
  return { basis: "perfil_predeterminado", note: "Aplica el límite inicial hasta presentar documentación." };
}

export const MX: TenantConfig = {
  slug: "mx",
  name: "Klu México",
  countryCode: "MX",
  countryName: "México",
  taxIdType: "RFC",
  taxIdLabel: "RFC",
  taxIdPlaceholder: "GODE561231GR8",
  taxIdHelp: "12 caracteres para persona moral, 13 para persona física. Tal como aparece en tu Constancia de Situación Fiscal.",
  currency: "MXN",
  normalizeTaxId: normalizeRfc,
  validateTaxId: validateRfc,
  layers: { human: humanLayers, legal: legalLayers },
  checks: [
    {
      code: "listas_bloqueadas",
      name: "Listas bloqueadas (ONU / OFAC / LPB)",
      description: "Cruce contra listas internacionales y Lista de Personas Bloqueadas. Coincidencia: no se abre la cuenta.",
      onFail: "block",
    },
    {
      code: "pep_review",
      name: "Revisión PEP",
      description: "Declaración PEP positiva: el alta requiere aprobación del Oficial de Cumplimiento.",
      onFail: "oc_approval",
    },
  ],
  defaultProfileNote: {
    human: "Límite inicial de la cuenta hasta presentar comprobantes de ingresos (definir umbral según manual local).",
    legal: "Límite inicial de la cuenta hasta presentar estados financieros (definir umbral según manual local).",
  },
  computeProfile,
  welcome: {
    title: "Bienvenido al onboarding de Klu México",
    body:
      "Para abrir tu cuenta necesitamos conocerte: la regulación mexicana nos exige identificar a cada cliente antes de iniciar la relación comercial. El proceso es guiado y por etapas: cuanto más completas, más funcionalidades desbloqueas.",
  },
  productPitch: [
    { title: "Cuenta Klu", body: "Tu cuenta para cobrar, pagar y administrar tu dinero en México." },
    { title: "Adquirencia Klu", body: "Acepta pagos con tarjeta en tu negocio. Si ya cargaste tus datos, los reutilizamos." },
  ],
};
