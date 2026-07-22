import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import { getTenantRow } from "@/lib/config-db";
import { hasCodeConfig } from "@/config/resolve";
import type { CaseRow, PartyRow, ProductRow } from "@/lib/types";
import DeleteCaseButton from "./DeleteCaseButton";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  invited: { label: "Invitado", cls: "bg-slate-brand-100 text-slate-brand-600" },
  in_progress: { label: "Cargando datos", cls: "bg-forest-50 text-forest-700" },
  submitted: { label: "Enviado", cls: "bg-citrus-100 text-citrus-600" },
  under_review: { label: "En revisión", cls: "bg-citrus-100 text-citrus-600" },
  approved: { label: "Aprobado", cls: "bg-forest-500 text-white" },
  rejected: { label: "Rechazado", cls: "bg-red-50 text-red-700" },
  blocked: { label: "Bloqueado", cls: "bg-red-100 text-red-800" },
};

const RISK_LABEL: Record<string, { label: string; cls: string }> = {
  low: { label: "Riesgo bajo", cls: "bg-forest-50 text-forest-700" },
  medium: { label: "Riesgo medio", cls: "bg-citrus-100 text-citrus-600" },
  high: { label: "Riesgo alto", cls: "bg-red-50 text-red-700" },
};

export default async function CountryDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ country: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { country } = await params;
  const { status: statusFilter } = await searchParams;

  const tenant = await getTenantRow(country);
  if (!tenant) notFound();

  const supa = db();
  let query = supa
    .from("onboarding_cases")
    .select("*")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (statusFilter) query = query.eq("status", statusFilter);

  const { data: cases } = await query;
  const caseRows = (cases ?? []) as CaseRow[];

  const partyIds = [...new Set(caseRows.map((c) => c.party_id))];
  const productIds = [...new Set(caseRows.map((c) => c.product_id))];
  const [{ data: parties }, { data: products }] = await Promise.all([
    partyIds.length ? supa.from("parties").select("*").in("id", partyIds) : Promise.resolve({ data: [] }),
    productIds.length ? supa.from("products").select("*").in("id", productIds) : Promise.resolve({ data: [] }),
  ]);
  const partyById = new Map((parties as PartyRow[] | null)?.map((p) => [p.id, p]) ?? []);
  const productById = new Map((products as ProductRow[] | null)?.map((p) => [p.id, p]) ?? []);

  const openCount = caseRows.filter((c) => ["invited", "in_progress"].includes(c.status)).length;
  const reviewCount = caseRows.filter((c) => ["submitted", "under_review"].includes(c.status)).length;
  const approvedCount = caseRows.filter((c) => c.status === "approved").length;

  const chip = (active: boolean) =>
    `px-3.5 py-1.5 rounded-full text-sm font-medium border transition ${
      active
        ? "bg-forest-900 text-white border-forest-900"
        : "bg-white border-slate-brand-200 text-slate-brand-600 hover:border-forest-400 hover:text-forest-700"
    }`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="eyebrow">
            {tenant.flag ?? "🌎"} {tenant.name}
          </p>
          <h1 className="text-3xl font-extrabold text-forest-950 mt-1">Casos de onboarding</h1>
        </div>
        <Link href={`/admin/${country}/new`} className="btn-primary">
          + Nuevo cliente
        </Link>
      </div>

      {!hasCodeConfig(country) && (
        <div className="rounded-2xl bg-citrus-100 border border-citrus-300 p-4">
          <p className="text-sm text-forest-950">
            <span className="font-bold">País configurado desde el panel.</span> El formulario que
            completa el cliente se arma con los requisitos de cumplimiento que cargues en cada
            producto.{" "}
            <Link href={`/admin/${country}/productos`} className="underline font-semibold">
              Ir a Productos →
            </Link>
          </p>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { n: openCount, l: "En proceso", sub: "invitados o cargando datos" },
          { n: reviewCount, l: "Para revisar", sub: "enviados a cumplimiento", accent: true },
          { n: approvedCount, l: "Aprobados", sub: "cuentas habilitadas" },
        ].map((m) => (
          <div key={m.l} className="card p-5">
            <p className={`text-4xl font-extrabold ${m.accent ? "text-citrus-500" : "text-forest-900"}`}>
              {m.n}
            </p>
            <p className="mt-1 font-semibold text-forest-950">{m.l}</p>
            <p className="text-xs text-slate-brand-600">{m.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 text-sm flex-wrap">
        <Link href={`/admin/${country}`} className={chip(!statusFilter)}>
          Todos
        </Link>
        {["submitted", "in_progress", "approved", "blocked"].map((s) => (
          <Link key={s} href={`/admin/${country}?status=${s}`} className={chip(statusFilter === s)}>
            {STATUS_LABEL[s].label}
          </Link>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-brand-600 border-b border-slate-brand-200 bg-slate-brand-50">
              <th className="px-5 py-3.5 font-semibold">Cliente</th>
              <th className="px-4 py-3.5 font-semibold">Producto</th>
              <th className="px-4 py-3.5 font-semibold">Capa</th>
              <th className="px-4 py-3.5 font-semibold">Estado</th>
              <th className="px-4 py-3.5 font-semibold">Riesgo</th>
              <th className="px-4 py-3.5 font-semibold">Creado</th>
              <th className="px-4 py-3.5 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {caseRows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-brand-400">
                  Sin casos en {tenant.name}. Creá el primero con “+ Nuevo cliente”.
                </td>
              </tr>
            )}
            {caseRows.map((c) => {
              const party = partyById.get(c.party_id);
              const product = productById.get(c.product_id);
              const st = STATUS_LABEL[c.status] ?? STATUS_LABEL.invited;
              const risk = c.risk_level ? RISK_LABEL[c.risk_level] : null;
              return (
                <tr key={c.id} className="border-b border-slate-brand-100 last:border-0 hover:bg-forest-50/40 transition">
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/admin/${country}/cases/${c.id}`}
                      className="font-semibold text-forest-800 hover:text-forest-950 hover:underline"
                    >
                      {party?.display_name || party?.tax_id || "—"}
                    </Link>
                    <div className="text-xs text-slate-brand-400 font-mono mt-0.5">
                      {party?.kind === "legal" ? "PJ" : "PH"} · {party?.tax_id}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-slate-brand-700">{product?.name ?? "—"}</td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center justify-center h-6 min-w-6 px-2 rounded-full bg-forest-50 text-forest-700 text-xs font-bold">
                      {c.current_layer}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${st.cls}`}>{st.label}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    {risk ? (
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${risk.cls}`}>{risk.label}</span>
                    ) : (
                      <span className="text-slate-brand-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-slate-brand-600">
                    {new Date(c.created_at).toLocaleDateString("es-AR")}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <DeleteCaseButton
                      caseId={c.id}
                      tenantSlug={country}
                      name={party?.display_name || party?.tax_id || "este caso"}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
