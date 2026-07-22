import type { LayerDef, TenantConfig, ProfileResult, PartyKind } from "../types";

// Tenant Argentina — SimplePay (Simple Payments SAS, Reg. BCRA N° 34.663)
// Capas y campos según Manual PLA/FT/FP v1.0 (Sección XII.D) y
// Manual de Onboarding KYC.

const PROVINCIAS = [
  "Buenos Aires", "CABA", "Catamarca", "Chaco", "Chubut", "Córdoba",
  "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja",
  "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan",
  "San Luis", "Santa Cruz", "Santa Fe", "Santiago del Estero",
  "Tierra del Fuego", "Tucumán",
].map((p) => ({ value: p, label: p }));

function normalizeCuit(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

function validateCuit(raw: string): { ok: true; normalized: string } | { ok: false; error: string } {
  const cuit = normalizeCuit(raw);
  if (cuit.length !== 11) {
    return { ok: false, error: "El CUIT/CUIL debe tener 11 dígitos (sin guiones)." };
  }
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(cuit[i]), 0);
  let dv = 11 - (sum % 11);
  if (dv === 11) dv = 0;
  if (dv === 10 || dv !== Number(cuit[10])) {
    return { ok: false, error: "El CUIT/CUIL ingresado no es válido (falla el dígito verificador)." };
  }
  return { ok: true, normalized: cuit };
}

const domicilioFields = (prefix: string, label: string) => [
  { key: `${prefix}_calle`, label: `${label} — Calle`, type: "text" as const, required: true },
  { key: `${prefix}_numero`, label: "Número", type: "text" as const, required: true },
  { key: `${prefix}_localidad`, label: "Localidad", type: "text" as const, required: true },
  { key: `${prefix}_provincia`, label: "Provincia", type: "select" as const, required: true, options: PROVINCIAS },
  { key: `${prefix}_cp`, label: "Código Postal", type: "text" as const, required: true },
  { key: `${prefix}_pais`, label: "País", type: "text" as const, required: true, placeholder: "Argentina" },
];

const humanLayers: LayerDef[] = [
  {
    number: 1,
    code: "alta_cuenta",
    title: "Alta de cuenta — Datos mínimos",
    description:
      "Son los 11 datos mínimos que exige el Manual PLA/FT (Sección XII.D). Sin uno solo de ellos no se puede iniciar la relación comercial.",
    unlocks:
      "Completando esta capa podés abrir tu cuenta y operar hasta 12 SMVM por mes (o 74 SMVM al año) con el perfil predeterminado.",
    steps: [
      {
        key: "identidad",
        title: "Tu identidad",
        intro: "Empecemos por lo básico: quién sos.",
        fields: [
          { key: "nombre_apellido", label: "Nombre y apellido", type: "text", required: true },
          {
            key: "tipo_documento", label: "Tipo de documento", type: "select", required: true,
            options: [
              { value: "dni", label: "DNI" },
              { value: "cedula_limitrofe", label: "Cédula de país limítrofe" },
              { value: "pasaporte", label: "Pasaporte" },
            ],
            help: "Se aceptan DNI, cédula de identidad de países limítrofes o pasaporte. El original puede exhibirse de manera electrónica.",
          },
          { key: "numero_documento", label: "Número de documento", type: "text", required: true },
          { key: "fecha_nacimiento", label: "Fecha de nacimiento", type: "date", required: true },
          { key: "lugar_nacimiento", label: "Lugar de nacimiento", type: "text", required: true },
          { key: "nacionalidad", label: "Nacionalidad", type: "text", required: true },
          {
            key: "estado_civil", label: "Estado civil", type: "select", required: true,
            options: [
              { value: "soltero", label: "Soltero/a" },
              { value: "casado", label: "Casado/a" },
              { value: "divorciado", label: "Divorciado/a" },
              { value: "viudo", label: "Viudo/a" },
              { value: "union_convivencial", label: "Unión convivencial" },
            ],
          },
        ],
      },
      {
        key: "contacto",
        title: "Domicilio y contacto",
        intro: "Necesitamos tu domicilio real completo y tus datos de contacto.",
        fields: [
          ...domicilioFields("domicilio", "Domicilio real"),
          { key: "telefono", label: "Teléfono", type: "phone", required: true },
          { key: "email", label: "E-mail", type: "email", required: true },
        ],
      },
      {
        key: "actividad",
        title: "Tu actividad",
        intro: "Contanos a qué te dedicás. Esto nos ayuda a conocerte como cliente.",
        fields: [
          {
            key: "actividad_laboral", label: "Actividad laboral o profesional", type: "text", required: true,
            help: "Ej.: empleado en relación de dependencia, comerciante, profesional independiente, monotributista.",
          },
        ],
      },
      {
        key: "declaraciones",
        title: "Declaraciones juradas",
        intro:
          "Estas declaraciones son obligatorias por normativa UIF. Respondé con sinceridad: una declaración positiva no impide el alta, pero requiere una revisión adicional.",
        fields: [
          {
            key: "ddjj_pep", label: "¿Sos Persona Expuesta Políticamente (PEP)?", type: "boolean", required: true,
            help: "Según Resolución UIF 35/2023. Sos PEP si ocupás u ocupaste cargos públicos relevantes, o sos familiar directo o allegado de alguien que los ocupa (Anexo IV).",
          },
          {
            key: "pep_detalle", label: "Cargo o función que origina tu condición de PEP", type: "textarea",
            required: true, showIf: { field: "ddjj_pep", equals: "true" },
          },
          {
            key: "ddjj_sujeto_obligado", label: "¿Sos Sujeto Obligado ante la UIF?", type: "boolean", required: true,
            help: "Art. 20 Ley 25.246: escribanos, contadores, operadores de cripto, etc. Si lo sos, vamos a verificar tu constancia de inscripción en la web de la UIF.",
          },
          {
            key: "so_detalle", label: "Actividad por la que sos Sujeto Obligado", type: "text",
            required: true, showIf: { field: "ddjj_sujeto_obligado", equals: "true" },
          },
          {
            key: "acepta_declaracion",
            label: "Declaro que los datos son verdaderos y me comprometo a informar cualquier cambio en forma fehaciente",
            type: "boolean", required: true,
          },
        ],
      },
    ],
  },
  {
    number: 2,
    code: "perfil_transaccional",
    title: "Ampliación del perfil transaccional",
    description:
      "Con el alta, tu cuenta opera hasta 12 SMVM mensuales (74 anuales). Si esperás mover más, demostranos tus ingresos y ampliamos tu perfil.",
    unlocks:
      "Ampliá tu límite operativo por encima de 12 SMVM mensuales, según los ingresos que puedas respaldar.",
    steps: [
      {
        key: "ingresos",
        title: "Origen de tus ingresos",
        intro:
          "El límite se calcula según el tipo de ingreso que declares y la documentación de respaldo que presentes.",
        fields: [
          {
            key: "tipo_ingreso", label: "Tipo de ingreso principal", type: "select", required: true,
            options: [
              { value: "relacion_dependencia", label: "Relación de dependencia (recibo de sueldo)" },
              { value: "monotributista", label: "Monotributista" },
              { value: "responsable_inscripto", label: "Responsable Inscripto" },
              { value: "certificacion_cp", label: "Certificación de Contador Público" },
              { value: "otra", label: "Otra documentación" },
            ],
            help: "Relación de dependencia: se toma el neto mensual × 13 sueldos. Monotributo: 80% de los ingresos brutos anuales de tu categoría. Responsable Inscripto sin documentación: perfil de 74 SMVM. Certificación CP: se toman los ingresos certificados.",
          },
          {
            key: "neto_mensual", label: "Sueldo neto mensual (ARS)", type: "number",
            required: true, showIf: { field: "tipo_ingreso", equals: "relacion_dependencia" },
            help: "Sólo ingresos normales y habituales. Bonos, indemnizaciones y gratificaciones no cuentan.",
          },
          {
            key: "brutos_anuales", label: "Ingresos brutos anuales de tu categoría de Monotributo (ARS)", type: "number",
            required: true, showIf: { field: "tipo_ingreso", equals: "monotributista" },
          },
          {
            key: "ingresos_certificados", label: "Ingresos anuales certificados (ARS)", type: "number",
            required: true, showIf: { field: "tipo_ingreso", equals: "certificacion_cp" },
            help: "El contador debe estar matriculado y la certificación intervenida por el Consejo Profesional, indicando la documentación tenida a la vista.",
          },
          {
            key: "volumen_mensual_esperado", label: "¿Cuánto esperás mover por mes? (ARS)", type: "number", required: true,
          },
          {
            key: "doc_ingresos", label: "Documentación de respaldo", type: "file", docType: "respaldo_ingresos",
            help: "Recibo de sueldo, constancia de Monotributo, certificación CP o documentación bancaria, según corresponda.",
          },
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
    description:
      "Son los 12 datos del ente jurídico que exige el Manual PLA/FT (Sección XII.D). Todos obligatorios.",
    unlocks:
      "Completando esta capa la empresa puede abrir su cuenta y operar con el perfil predeterminado de 120 SMVM.",
    steps: [
      {
        key: "sociedad",
        title: "La sociedad",
        intro: "Datos registrales del ente jurídico.",
        fields: [
          { key: "razon_social", label: "Denominación o razón social", type: "text", required: true },
          {
            key: "forma_juridica", label: "Forma jurídica", type: "select", required: true,
            options: [
              { value: "sa", label: "S.A." }, { value: "srl", label: "S.R.L." },
              { value: "sas", label: "S.A.S." }, { value: "cooperativa", label: "Cooperativa" },
              { value: "fundacion", label: "Fundación" }, { value: "asociacion", label: "Asociación civil" },
              { value: "fideicomiso", label: "Fideicomiso" }, { value: "otra", label: "Otra" },
            ],
          },
          { key: "fecha_inscripcion", label: "Fecha de inscripción registral", type: "date", required: true },
          { key: "numero_inscripcion", label: "Número de inscripción registral", type: "text", required: true },
        ],
      },
      {
        key: "documentacion",
        title: "Documentación societaria",
        intro:
          "Subí copia del instrumento de constitución y del estatuto vigente. Las SAS constituidas digitalmente pueden aportar el instrumento constitutivo digital con firma del registro público.",
        fields: [
          { key: "contrato_constitucion", label: "Copia del contrato o escritura de constitución", type: "file", required: true, docType: "contrato_constitucion" },
          { key: "estatuto_social", label: "Copia del estatuto social actualizado", type: "file", required: true, docType: "estatuto_social", help: "Sin perjuicio de exhibir el original cuando se solicite." },
        ],
      },
      {
        key: "sede",
        title: "Sede y contacto",
        fields: [
          ...domicilioFields("domicilio_legal", "Domicilio legal"),
          { key: "telefono_sede", label: "Teléfono de la sede social", type: "phone", required: true },
          { key: "email_sede", label: "E-mail de contacto", type: "email", required: true },
        ],
      },
      {
        key: "actividad",
        title: "Actividad del negocio",
        intro:
          "Qué hace la empresa, qué vende y cuánto espera operar. Esta información se usa para evaluar la coherencia del perfil transaccional.",
        fields: [
          { key: "actividad_principal", label: "Actividad principal realizada", type: "text", required: true },
          {
            key: "descripcion_negocio", label: "Descripción del negocio", type: "textarea", required: true,
            help: "Qué vende, canal de ventas (local, online, ambos) y volumen mensual esperado.",
          },
        ],
      },
      {
        key: "personas",
        title: "Personas vinculadas",
        intro:
          "Identificá a quienes representan y controlan la sociedad. A cada persona cargada acá se le va a pedir luego la misma información que a un cliente persona humana (los 11 datos mínimos más su DDJJ PEP). Si una persona ya está registrada con su CUIT, sus datos se reutilizan automáticamente.",
        fields: [
          {
            key: "representantes", label: "Apoderados, representantes y/o autorizados", type: "people",
            required: true, peopleRole: "representante_legal",
            help: "Al menos el representante legal que va a operar la cuenta.",
          },
          {
            key: "organo_administracion", label: "Integrantes del órgano de administración", type: "people",
            required: true, peopleRole: "organo_administracion",
            help: "Directorio, gerencia u órgano equivalente.",
          },
          {
            key: "beneficiarios_finales", label: "Beneficiarios finales (≥10% del capital o control efectivo)", type: "people",
            required: true, peopleRole: "beneficiario_final", withOwnershipPct: true,
            help: "Toda persona humana con al menos 10% del capital o de los votos, o que ejerza el control final directo o indirecto (Res. UIF 112/2021). Si el capital está muy atomizado, identificá a quienes ejerzan el control efectivo.",
          },
        ],
      },
      {
        key: "declaraciones",
        title: "Declaraciones juradas",
        fields: [
          {
            key: "ddjj_titularidad",
            label: "Declaro bajo juramento la estructura de titularidad y control informada (DDJJ Res. UIF 112/2021)",
            type: "boolean", required: true,
          },
          {
            key: "ddjj_sujeto_obligado", label: "¿La sociedad es Sujeto Obligado ante la UIF?", type: "boolean", required: true,
            help: "Si lo es, se verifica la constancia de inscripción en la web de la UIF. Sin inscripción no se puede iniciar la relación comercial.",
          },
          {
            key: "so_detalle", label: "Actividad por la que es Sujeto Obligado", type: "text",
            required: true, showIf: { field: "ddjj_sujeto_obligado", equals: "true" },
          },
          {
            key: "acepta_declaracion",
            label: "Declaro que los datos son verdaderos y me comprometo a informar cualquier cambio en forma fehaciente",
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
    description:
      "La empresa arranca con el perfil predeterminado de 120 SMVM. Presentando Estados Contables se amplía según las ventas brutas.",
    unlocks:
      "Ampliá el límite operativo de la empresa por encima de 120 SMVM presentando Estados Contables auditados.",
    steps: [
      {
        key: "eeff",
        title: "Estados contables",
        intro:
          "Se toman las ventas brutas de los Estados Contables auditados por Contador Público y certificados en el Consejo Profesional. Si no los presentás, queda el perfil predeterminado de 120 SMVM.",
        fields: [
          { key: "tiene_eeff", label: "¿La empresa cuenta con Estados Contables auditados?", type: "boolean", required: true },
          {
            key: "eeff_file", label: "Estados Contables (último ejercicio)", type: "file", docType: "eeff",
            required: true, showIf: { field: "tiene_eeff", equals: "true" },
          },
          {
            key: "ventas_brutas_anuales", label: "Ventas brutas anuales según EEFF (ARS)", type: "number",
            required: true, showIf: { field: "tiene_eeff", equals: "true" },
          },
          { key: "volumen_mensual_esperado", label: "¿Cuánto espera mover la empresa por mes? (ARS)", type: "number", required: true },
        ],
      },
    ],
  },
];

function computeProfile(kind: PartyKind, data: Record<string, unknown>): ProfileResult {
  const num = (k: string) => {
    const v = Number(data[k]);
    return Number.isFinite(v) && v > 0 ? v : undefined;
  };
  if (kind === "legal") {
    const ventas = num("ventas_brutas_anuales");
    if (data["tiene_eeff"] === true && ventas) {
      return {
        basis: "eeff_ventas_brutas",
        annualAmount: ventas,
        monthlyAmount: Math.round(ventas / 12),
        note: "Ventas brutas según EEFF auditados y certificados en el Consejo Profesional.",
      };
    }
    return {
      basis: "perfil_predeterminado",
      note: "Sin EEFF presentados: aplica el perfil predeterminado de 120 SMVM definido por el Oficial de Cumplimiento.",
    };
  }
  switch (data["tipo_ingreso"]) {
    case "relacion_dependencia": {
      const neto = num("neto_mensual");
      if (neto)
        return {
          basis: "recibo_sueldo",
          annualAmount: neto * 13,
          monthlyAmount: neto,
          note: "Neto mensual × 13 sueldos (12 meses + aguinaldo). Sólo ingresos normales y habituales.",
        };
      break;
    }
    case "monotributista": {
      const brutos = num("brutos_anuales");
      if (brutos)
        return {
          basis: "monotributo",
          annualAmount: Math.round(brutos * 0.8),
          monthlyAmount: Math.round((brutos * 0.8) / 12),
          note: "80% de los ingresos brutos anuales de la categoría inscripta.",
        };
      break;
    }
    case "responsable_inscripto":
      return {
        basis: "responsable_inscripto",
        note: "Sin documentación de respaldo: se aplican 74 SMVM (perfil predeterminado).",
      };
    case "certificacion_cp": {
      const cert = num("ingresos_certificados");
      if (cert)
        return {
          basis: "certificacion_cp",
          annualAmount: cert,
          monthlyAmount: Math.round(cert / 12),
          note: "Ingresos certificados por Contador Público matriculado, intervenida por el Consejo Profesional.",
        };
      break;
    }
    case "otra":
      return {
        basis: "otra_documentacion",
        note: "El Oficial de Cumplimiento determinará el criterio y lo formalizará en el formulario de determinación del perfil.",
      };
  }
  return {
    basis: "perfil_predeterminado",
    note: "Datos insuficientes: aplica el perfil predeterminado (12 SMVM/mes o 74 SMVM/año).",
  };
}

export const AR: TenantConfig = {
  slug: "ar",
  name: "Argentina",
  countryCode: "AR",
  countryName: "Argentina",
  taxIdType: "CUIT",
  taxIdLabel: "CUIT / CUIL / CDI",
  taxIdPlaceholder: "20-12345678-3",
  taxIdHelp: "11 dígitos, con o sin guiones. Es la clave que te dio AFIP/ARCA.",
  currency: "ARS",
  normalizeTaxId: normalizeCuit,
  validateTaxId: validateCuit,
  layers: { human: humanLayers, legal: legalLayers },
  checks: [
    {
      code: "repet_ofac_onu",
      name: "REPET + OFAC + ONU 1267",
      description:
        "Cruce del nombre/documento contra el Registro Público de Terroristas (Decreto 489/2019) y listas internacionales. Para PJ se corre también sobre el representante legal y cada beneficiario final. Si aparece: no se abre la cuenta y se evalúa ROS.",
      onFail: "block",
    },
    {
      code: "padron_a8298",
      name: "Padrón BCRA Com. A 8298",
      description:
        "Consulta al padrón de la Comunicación A 8298. Resultado positivo (sobre el cliente o cualquier BF): el cliente queda automáticamente clasificado como Riesgo Alto.",
      onFail: "high_risk",
    },
    {
      code: "uif_so",
      name: "Verificación Sujeto Obligado UIF",
      description:
        "Si declaró ser Sujeto Obligado, verificar la constancia de inscripción en la web de la UIF. Sin inscripción: no se puede iniciar la relación comercial.",
      onFail: "block",
    },
    {
      code: "pep_review",
      name: "Revisión DDJJ PEP",
      description:
        "Si alguna DDJJ PEP resulta positiva (titular, representante o BF), el alta requiere aprobación expresa del Oficial de Cumplimiento antes de habilitar la cuenta.",
      onFail: "oc_approval",
    },
  ],
  defaultProfileNote: {
    human: "Perfil predeterminado: 12 SMVM por mes (o 74 SMVM al año). Superado el umbral, se debe requerir documentación y evaluar ajustar el perfil.",
    legal: "Perfil predeterminado: 120 SMVM (umbral operativo de referencia: 24 SMVM/mes o 120/año). Superado, corresponde pedir EEFF y reevaluar.",
  },
  computeProfile,
  welcome: {
    title: "Bienvenido al onboarding de SimplePay",
    body:
      "Somos un Proveedor de Servicios de Pago registrado ante el BCRA (Reg. N° 34.663). Para abrir tu cuenta necesitamos conocerte: la normativa argentina (UIF y BCRA) nos exige identificar a cada cliente antes de iniciar la relación comercial. Es un proceso simple, guiado y en varias etapas: cuanto más completás, más funcionalidades desbloqueás.",
  },
  productPitch: [
    {
      title: "Cuenta de Pago (PSPCP)",
      body: "Tu cuenta con CVU propio para cobrar, pagar y administrar tu plata. Con el alta básica ya podés operar hasta 12 SMVM por mes.",
    },
    {
      title: "Agregador / Adquirente",
      body: "Adherí tu comercio y aceptá pagos con tarjeta. Mismo proceso de alta: si ya cargaste tus datos para la cuenta, los reutilizamos.",
    },
    {
      title: "Ampliación de perfil",
      body: "¿Esperás mover más volumen? Presentá documentación de ingresos (recibo de sueldo, Monotributo, certificación de CP o EEFF) y ampliamos tu límite operativo.",
    },
  ],
};
