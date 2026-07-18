import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import { getTenant, getLayers, isFieldVisible } from "@/config";
import { layerProgress } from "@/lib/onboarding";
import { baseUrl } from "@/lib/email";
import type {
  CaseLayerRow,
  CaseRow,
  CheckRow,
  EventRow,
  InviteRow,
  PartyRow,
  ProductRow,
  TenantRow,
} from "@/lib/types";
import {
  decideCaseAction,
  resendInviteAction,
  setRiskAction,
  updateCheckAction,
} from "../../../actions";
import CopyButton from "./CopyButton";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  invited: "Invitado",
  in_progress: "Cargando datos",
  submitted: "Enviado — a revisar",
  under_review: "En revisión",
  approved: "Aprobado",
  rejected: "Rechazado",
  blocked: "Bloqueado",
};

const CHECK_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendiente", cls: "bg-slate-brand-100 text-slate-brand-600" },
  passed: { label: "OK", cls: "bg-forest-500 text-white" },
  flagged: { label: "Con hallazgo", cls: "bg-citrus-100 text-citrus-600" },
  blocked: { label: "Bloqueante", cls: "bg-red-100 text-red-800" },
};

const EVENT_LABEL: Record<string, string> = {
  case_created: "Caso creado",
  invite_sent: "Invitación enviada por e-mail",
  invite_resent: "Invitación reenviada",
  invite_created_unsent: "Invitación creada (e-mail no enviado)",
  invite_resend_failed: "Falló el reenvío del e-mail",
  invite_opened: "El cliente abrió el link",
  invite_verified: "El cliente verificó su identidad fiscal",
  step_saved: "El cliente guardó un paso",
  layer_completed: "Capa completada",
  check_updated: "Chequeo actualizado",
  risk_set: "Nivel de riesgo asignado",
  case_decided: "Decisión tomada",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-6 space-y-4">
      <h2 className="font-bold text-forest-950">{title}</h2>
      {children}
    </section>
  );
}

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supa = db();

  const { data: caseRow } = await supa
    .from("onboarding_cases")
    .select("*")
    .eq("id", id)
    .maybeSingle<CaseRow>();
  if (!caseRow) notFound();

  const [
    { data: party },
    { data: product },
    { data: tenantRow },
    { data: checks },
    { data: invites },
    { data: layers },
    { data: events },
  ] = await Promise.all([
    supa.from("parties").select("*").eq("id", caseRow.party_id).single<PartyRow>(),
    supa.from("products").select("*").eq("id", caseRow.product_id).single<ProductRow>(),
    supa.from("tenants").select("*").eq("id", caseRow.tenant_id).single<TenantRow>(),
    supa.from("compliance_checks").select("*").eq("case_id", id).order("check_code"),
    supa.from("invites").select("*").eq("case_id", id).order("created_at", { ascending: false }),
    supa.from("case_layers").select("*").eq("case_id", id),
    supa.from("case_events").select("*").eq("case_id", id).order("created_at", { ascending: false }).limit(30),
  ]);

  if (!party || !tenantRow) notFound();
  const tenant = getTenant(tenantRow.slug);
  const checkRows = (checks ?? []) as CheckRow[];
  const inviteRows = (invites ?? []) as InviteRow[];
  const layerRows = (layers ?? []) as CaseLayerRow[];
  const eventRows = (events ?? []) as EventRow[];
  const progress = layerProgress(tenantRow.slug, party.kind, party.data, layerRows);
  const activeInvite = inviteRows.find((i) => !["expired", "revoked"].includes(i.status));
  const inviteLink = activeInvite ? `${baseUrl()}/o/${activeInvite.token}` : null;

  const profile = caseRow.transactional_profile as {
    basis?: string;
    monthlyAmount?: number;
    annualAmount?: number;
    note?: string;
  };

  const { data: links } = await supa
    .from("party_links")
    .select("role, ownership_pct, child:parties!party_links_child_party_id_fkey(id, display_name, tax_id, data)")
    .eq("parent_party_id", party.id);

  const ROLE_LABEL: Record<string, string> = {
    representante_legal: "Representante / apoderado",
    organo_administracion: "Órgano de administración",
    beneficiario_final: "Beneficiario final",
    autorizado: "Autorizado",
    socio: "Socio",
  };

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="rounded-3xl bg-forest-950 text-white p-6 sm:p-8 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-80"
          style={{ background: "radial-gradient(120% 100% at 90% 0%, #0b5752 0%, #0b3c36 50%, #0a2d27 100%)" }}
        />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Link href="/admin" className="text-sm text-forest-100/80 hover:text-white transition">
              ← Casos
            </Link>
            <h1 className="text-3xl font-extrabold mt-2">{party.display_name || party.tax_id}</h1>
            <p className="text-sm text-forest-100 mt-1">
              {tenant.countryName} · {product?.name} ·{" "}
              {party.kind === "legal" ? "Persona jurídica" : "Persona humana"} ·{" "}
              <span className="font-mono">{tenant.taxIdLabel}: {party.tax_id}</span>
            </p>
          </div>
          <div className="text-right">
            <span className="inline-block rounded-full bg-white/15 backdrop-blur text-white text-sm px-4 py-1.5 font-semibold">
              {STATUS_LABEL[caseRow.status] ?? caseRow.status}
            </span>
            {caseRow.risk_level && (
              <p className="text-sm mt-2 text-forest-100">
                Riesgo:{" "}
                <strong className="text-white">
                  {{ low: "Bajo", medium: "Medio", high: "Alto" }[caseRow.risk_level]}
                </strong>
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          {/* Progreso por capas */}
          <Section title="Progreso por capas">
            <div className="space-y-3">
              {progress.map(({ layer, done, total, status }) => (
                <div key={layer.number} className="flex items-center gap-4">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      status === "completed" || status === "approved"
                        ? "bg-forest-500 text-white"
                        : status === "in_progress"
                          ? "bg-citrus-500 text-white"
                          : "bg-slate-brand-200 text-slate-brand-600"
                    }`}
                  >
                    {layer.number}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-forest-950">{layer.title}</p>
                    <div className="h-2 rounded-full bg-slate-brand-100 mt-1 overflow-hidden">
                      <div
                        className="h-full bg-forest-500 rounded-full transition-all"
                        style={{ width: total ? `${(done / total) * 100}%` : "0%" }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-slate-brand-600 w-16 text-right">
                    {done}/{total} datos
                  </span>
                </div>
              ))}
            </div>
          </Section>

          {/* Datos cargados */}
          <Section title="Datos cargados">
            {Object.keys(party.data).length === 0 ? (
              <p className="text-sm text-slate-brand-400">El cliente todavía no cargó datos.</p>
            ) : (
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
                {getLayers(tenantRow.slug, party.kind).flatMap((layer) =>
                  layer.steps.flatMap((step) =>
                    step.fields
                      .filter((f) => isFieldVisible(f, party.data) && party.data[f.key] != null && party.data[f.key] !== "")
                      .map((f) => {
                        const v = party.data[f.key];
                        let display: string;
                        if (f.type === "people" && Array.isArray(v)) {
                          display = v
                            .map((p) => {
                              const e = p as { nombre?: string; tax_id?: string; pct?: number };
                              return `${e.nombre} (${e.tax_id}${e.pct != null ? `, ${e.pct}%` : ""})`;
                            })
                            .join("; ");
                        } else if (f.type === "file" && typeof v === "object" && v !== null) {
                          display = `📎 ${(v as { fileName?: string }).fileName ?? "archivo"}`;
                        } else if (f.type === "boolean") {
                          display = v === true ? "Sí" : "No";
                        } else if (f.type === "select" && f.options) {
                          display = f.options.find((o) => o.value === v)?.label ?? String(v);
                        } else {
                          display = String(v);
                        }
                        return (
                          <div key={`${layer.number}-${f.key}`} className="border-b border-slate-brand-100 pb-1.5">
                            <dt className="text-slate-brand-400 text-xs">{f.label}</dt>
                            <dd className="text-forest-950 font-medium">{display}</dd>
                          </div>
                        );
                      })
                  )
                )}
              </dl>
            )}
          </Section>

          {/* Personas vinculadas */}
          {(links?.length ?? 0) > 0 && (
            <Section title="Personas vinculadas (reutilizables entre productos)">
              <ul className="divide-y divide-slate-brand-100 text-sm">
                {(links as unknown as {
                  role: string;
                  ownership_pct: number | null;
                  child: { id: string; display_name: string | null; tax_id: string; data: Record<string, unknown> };
                }[]).map((l, i) => (
                  <li key={i} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-forest-950">{l.child?.display_name ?? "—"}</p>
                      <p className="text-xs text-slate-brand-400">
                        {ROLE_LABEL[l.role] ?? l.role} · <span className="font-mono">{tenant.taxIdLabel} {l.child?.tax_id}</span>
                        {l.ownership_pct != null && ` · ${l.ownership_pct}%`}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                        Object.keys(l.child?.data ?? {}).length > 0
                          ? "bg-forest-50 text-forest-700"
                          : "bg-citrus-100 text-citrus-600"
                      }`}
                    >
                      {Object.keys(l.child?.data ?? {}).length > 0 ? "Con legajo" : "Legajo pendiente"}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Chequeos de cumplimiento */}
          <Section title="Chequeos internos (el cliente no los ve)">
            <div className="space-y-4">
              {tenant.checks.map((def) => {
                const row = checkRows.find((c) => c.check_code === def.code);
                if (!row) return null;
                const st = CHECK_STATUS[row.status];
                return (
                  <div key={def.code} className="rounded-2xl border border-slate-brand-200 p-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-forest-950">{def.name}</p>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${st.cls}`}>
                        {st.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-brand-600 mt-1 leading-relaxed">{def.description}</p>
                    <form action={updateCheckAction} className="flex gap-2 mt-3 items-center flex-wrap">
                      <input type="hidden" name="check_id" value={row.id} />
                      <input type="hidden" name="case_id" value={caseRow.id} />
                      <select
                        name="status"
                        defaultValue={row.status}
                        className="rounded-lg border border-slate-brand-300 px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-forest-500"
                      >
                        <option value="pending">Pendiente</option>
                        <option value="passed">OK / Sin coincidencias</option>
                        <option value="flagged">Con hallazgo</option>
                        <option value="blocked">Bloqueante</option>
                      </select>
                      <input
                        name="notes"
                        defaultValue={row.result_notes ?? ""}
                        placeholder="Notas del resultado"
                        className="flex-1 min-w-40 rounded-lg border border-slate-brand-300 px-2.5 py-1.5 text-sm focus:outline-none focus:border-forest-500"
                      />
                      <button className="rounded-lg bg-forest-900 text-white px-3.5 py-1.5 text-sm font-medium hover:bg-forest-800 transition">
                        Guardar
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Timeline */}
          <Section title="Actividad">
            <ul className="space-y-2.5 text-sm">
              {eventRows.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="text-slate-brand-400 text-xs whitespace-nowrap w-32 font-mono">
                    {new Date(e.created_at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                  <span className="text-slate-brand-700">
                    {EVENT_LABEL[e.event] ?? e.event}
                    {e.event === "layer_completed" && ` (capa ${(e.detail as { layer?: number }).layer})`}
                    {e.event === "step_saved" && ` (${(e.detail as { step?: string }).step})`}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        </div>

        {/* Columna lateral */}
        <div className="space-y-6">
          <Section title="Invitación">
            {activeInvite ? (
              <div className="space-y-3 text-sm">
                <p>
                  <span className="text-slate-brand-400">E-mail:</span> {activeInvite.email}
                </p>
                <p>
                  <span className="text-slate-brand-400">Estado:</span>{" "}
                  {({
                    created: "Creada (e-mail no enviado)",
                    sent: "Enviada",
                    opened: "Link abierto",
                    verified: "Identidad verificada",
                  } as Record<string, string>)[activeInvite.status] ?? activeInvite.status}
                </p>
                {inviteLink && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-brand-600 break-all rounded-lg bg-slate-brand-50 border border-slate-brand-200 p-2.5 font-mono">
                      {inviteLink}
                    </p>
                    <div className="flex gap-2">
                      <CopyButton text={inviteLink} />
                      <form action={resendInviteAction}>
                        <input type="hidden" name="invite_id" value={activeInvite.id} />
                        <button className="rounded-full border border-slate-brand-300 px-4 py-1.5 text-sm font-medium hover:border-forest-400 hover:text-forest-700 transition">
                          Reenviar e-mail
                        </button>
                      </form>
                    </div>
                  </div>
                )}
                <p className="text-xs text-slate-brand-400">
                  El cliente debe ingresar su {tenant.taxIdLabel} para poder entrar
                  ({activeInvite.attempts}/{activeInvite.max_attempts} intentos usados).
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-brand-400">Sin invitación activa.</p>
            )}
          </Section>

          <Section title="Perfil transaccional">
            {profile?.basis ? (
              <div className="text-sm space-y-2">
                {profile.monthlyAmount != null && (
                  <p className="text-3xl font-extrabold text-forest-900">
                    {new Intl.NumberFormat("es-AR", { style: "currency", currency: tenant.currency, maximumFractionDigits: 0 }).format(profile.monthlyAmount)}
                    <span className="text-sm font-normal text-slate-brand-400"> /mes</span>
                  </p>
                )}
                {profile.annualAmount != null && (
                  <p className="text-slate-brand-600">
                    {new Intl.NumberFormat("es-AR", { style: "currency", currency: tenant.currency, maximumFractionDigits: 0 }).format(profile.annualAmount)}{" "}
                    anual
                  </p>
                )}
                <p className="text-xs text-slate-brand-500">{profile.note}</p>
              </div>
            ) : (
              <p className="text-xs text-slate-brand-500">{tenant.defaultProfileNote[party.kind]}</p>
            )}
          </Section>

          <Section title="Nivel de riesgo">
            <form action={setRiskAction} className="flex gap-2">
              <input type="hidden" name="case_id" value={caseRow.id} />
              <select
                name="risk"
                defaultValue={caseRow.risk_level ?? ""}
                className="flex-1 rounded-lg border border-slate-brand-300 px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-forest-500"
              >
                <option value="" disabled>
                  Asignar…
                </option>
                <option value="low">Bajo — DD Simplificada (actualiza cada 5 años)</option>
                <option value="medium">Medio — DD Media (cada 2 años)</option>
                <option value="high">Alto — DD Reforzada (cada 1 año)</option>
              </select>
              <button className="rounded-lg bg-forest-900 text-white px-3.5 py-1.5 text-sm font-medium hover:bg-forest-800 transition">
                Guardar
              </button>
            </form>
            <p className="text-xs text-slate-brand-400">
              Riesgo Alto requiere aprobación del Oficial de Cumplimiento.
            </p>
          </Section>

          <Section title="Decisión">
            <form action={decideCaseAction} className="space-y-2.5">
              <input type="hidden" name="case_id" value={caseRow.id} />
              <textarea
                name="notes"
                placeholder="Notas / criterio aplicado"
                defaultValue={caseRow.notes ?? ""}
                className="w-full rounded-lg border border-slate-brand-300 px-2.5 py-1.5 text-sm focus:outline-none focus:border-forest-500"
                rows={2}
              />
              <div className="grid grid-cols-3 gap-2">
                <button
                  name="decision"
                  value="approved"
                  className="rounded-full bg-forest-500 text-white py-2 text-sm font-semibold hover:bg-forest-600 transition"
                >
                  Aprobar
                </button>
                <button
                  name="decision"
                  value="under_review"
                  className="rounded-full bg-citrus-500 text-white py-2 text-sm font-semibold hover:bg-citrus-600 transition"
                >
                  A revisión
                </button>
                <button
                  name="decision"
                  value="rejected"
                  className="rounded-full bg-red-600 text-white py-2 text-sm font-semibold hover:bg-red-700 transition"
                >
                  Rechazar
                </button>
              </div>
            </form>
          </Section>
        </div>
      </div>
    </div>
  );
}
