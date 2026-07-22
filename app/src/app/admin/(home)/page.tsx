import Link from "next/link";
import { db } from "@/lib/supabase";
import { listTenants } from "@/lib/config-db";
import { hasCodeConfig } from "@/config/resolve";
import NewCountryForm from "./NewCountryForm";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const tenants = await listTenants();
  const supa = db();

  // Casos por país, para mostrar actividad en cada tarjeta
  const { data: cases } = await supa.from("onboarding_cases").select("tenant_id, status");
  const rows = (cases ?? []) as { tenant_id: string; status: string }[];
  const stats = new Map<string, { total: number; review: number }>();
  for (const c of rows) {
    const s = stats.get(c.tenant_id) ?? { total: 0, review: 0 };
    s.total += 1;
    if (["submitted", "under_review"].includes(c.status)) s.review += 1;
    stats.set(c.tenant_id, s);
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Panel de gestión</p>
        <h1 className="text-3xl font-extrabold text-forest-950 mt-1">¿En qué país querés trabajar?</h1>
        <p className="text-slate-brand-600 mt-2">
          Cada país tiene su propia normativa, sus productos y sus casos de onboarding.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {tenants.map((t) => {
          const s = stats.get(t.id) ?? { total: 0, review: 0 };
          return (
            <Link
              key={t.id}
              href={`/admin/${t.slug}`}
              className="card p-6 hover:border-forest-400 hover:shadow-md transition group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-3xl">{t.flag ?? "🌎"}</span>
                  <h2 className="text-xl font-extrabold text-forest-950 mt-2 group-hover:text-forest-700 transition">
                    {t.name}
                  </h2>
                  <p className="text-sm text-slate-brand-600 mt-0.5">
                    {t.tax_id_label || t.tax_id_type} · {t.currency}
                  </p>
                </div>
                {!hasCodeConfig(t.slug) && (
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide bg-citrus-100 text-citrus-600 rounded-full px-2 py-1">
                    Config. en panel
                  </span>
                )}
              </div>
              <div className="mt-4 flex items-center gap-4 text-sm">
                <span className="text-slate-brand-600">
                  <strong className="text-forest-900">{s.total}</strong> casos
                </span>
                {s.review > 0 && (
                  <span className="text-citrus-600 font-semibold">{s.review} para revisar</span>
                )}
              </div>
              <p className="mt-4 text-sm font-bold text-forest-700 group-hover:text-forest-900">
                Entrar al panel →
              </p>
            </Link>
          );
        })}
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-extrabold text-forest-950">Agregar un país</h2>
        <p className="text-sm text-slate-brand-600 mt-1 mb-5">
          Se crea vacío: después cargás sus productos y los requisitos de cumplimiento que exige la
          normativa local.
        </p>
        <NewCountryForm />
      </div>
    </div>
  );
}
