import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantRow, listProducts, resolveTenantConfig } from "@/lib/config-db";
import NewClientForm, { type TenantOption } from "./NewClientForm";

export const dynamic = "force-dynamic";

export default async function NewClientPage({
  params,
}: {
  params: Promise<{ country: string }>;
}) {
  const { country } = await params;
  const tenant = await getTenantRow(country);
  if (!tenant) notFound();

  const [products, cfg] = await Promise.all([
    listProducts(tenant.id),
    resolveTenantConfig(tenant),
  ]);

  const option: TenantOption = {
    slug: tenant.slug,
    countryName: cfg.countryName,
    name: cfg.name,
    taxIdLabel: cfg.taxIdLabel,
    taxIdPlaceholder: cfg.taxIdPlaceholder,
    taxIdHelp: cfg.taxIdHelp,
    products: products.map((p) => ({ id: p.id, name: p.name, tagline: p.tagline })),
  };

  return (
    <div className="max-w-2xl">
      <p className="eyebrow">
        {tenant.flag ?? "🌎"} {tenant.name}
      </p>
      <h1 className="text-3xl font-extrabold text-forest-950 mt-1 mb-2">Nuevo cliente</h1>
      <p className="text-slate-brand-600 text-sm mb-6 leading-relaxed">
        Creá el caso y enviá la invitación por e-mail. El cliente sólo va a poder entrar al link si
        conoce su identificación fiscal. Si la persona ya existe en {tenant.name} (mismo{" "}
        {cfg.taxIdLabel}), sus datos se reutilizan automáticamente.
      </p>

      {products.length === 0 ? (
        <div className="card p-8 text-center space-y-3">
          <p className="font-bold text-forest-950">Este país todavía no tiene productos</p>
          <p className="text-sm text-slate-brand-600">
            Antes de dar de alta un cliente, creá al menos un producto y cargale los requisitos de
            cumplimiento.
          </p>
          <Link href={`/admin/${country}/productos`} className="btn-primary">
            Ir a Productos
          </Link>
        </div>
      ) : (
        <NewClientForm tenant={option} />
      )}
    </div>
  );
}
