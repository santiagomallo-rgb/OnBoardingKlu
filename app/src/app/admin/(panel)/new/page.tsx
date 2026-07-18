import { db } from "@/lib/supabase";
import { TENANTS } from "@/config";
import type { ProductRow, TenantRow } from "@/lib/types";
import NewClientForm, { type TenantOption } from "./NewClientForm";

export const dynamic = "force-dynamic";

export default async function NewClientPage() {
  const supa = db();
  const [{ data: tenants }, { data: products }] = await Promise.all([
    supa.from("tenants").select("*").eq("active", true).order("slug"),
    supa.from("products").select("*").eq("active", true),
  ]);

  const options: TenantOption[] = ((tenants ?? []) as TenantRow[])
    .filter((t) => TENANTS[t.slug])
    .map((t) => {
      const cfg = TENANTS[t.slug];
      return {
        slug: t.slug,
        countryName: cfg.countryName,
        name: cfg.name,
        taxIdLabel: cfg.taxIdLabel,
        taxIdPlaceholder: cfg.taxIdPlaceholder,
        taxIdHelp: cfg.taxIdHelp,
        products: ((products ?? []) as ProductRow[])
          .filter((p) => p.tenant_id === t.id)
          .map((p) => ({ id: p.id, name: p.name, tagline: p.tagline })),
      };
    });

  return (
    <div className="max-w-2xl">
      <p className="eyebrow">Alta</p>
      <h1 className="text-3xl font-extrabold text-forest-950 mt-1 mb-2">Nuevo cliente</h1>
      <p className="text-slate-brand-600 text-sm mb-6 leading-relaxed">
        Creá el caso y enviá la invitación por e-mail. El cliente sólo va a poder
        entrar al link si conoce su identificación fiscal. Si la persona ya
        existe en ese país (mismo {options.map((o) => o.taxIdLabel).join(" / ")}),
        sus datos se reutilizan automáticamente.
      </p>
      <NewClientForm tenants={options} />
    </div>
  );
}
