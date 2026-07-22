import { notFound } from "next/navigation";
import { getTenantRow, listProducts, listRequirements } from "@/lib/config-db";
import type { ProductRequirementRow } from "@/lib/types";
import NewProductForm from "./NewProductForm";
import ProductCard from "./ProductCard";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  params,
}: {
  params: Promise<{ country: string }>;
}) {
  const { country } = await params;
  const tenant = await getTenantRow(country);
  if (!tenant) notFound();

  const products = await listProducts(tenant.id, true);
  const reqsByProduct = new Map<string, ProductRequirementRow[]>();
  await Promise.all(
    products.map(async (p) => {
      reqsByProduct.set(p.id, await listRequirements(p.id));
    })
  );

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">
          {tenant.flag ?? "🌎"} {tenant.name}
        </p>
        <h1 className="text-3xl font-extrabold text-forest-950 mt-1">Productos</h1>
        <p className="text-slate-brand-600 mt-2 max-w-2xl">
          Cada producto define qué hay que cumplir para darlo de alta. Los requisitos que cargues
          acá son los que se le van a pedir al cliente en su onboarding.
        </p>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-extrabold text-forest-950">Agregar producto</h2>
        <p className="text-sm text-slate-brand-600 mt-1 mb-5">
          Poné un nombre y describí qué es. Después le cargás los requisitos de cumplimiento.
        </p>
        <NewProductForm tenantSlug={country} />
      </div>

      <div className="space-y-5">
        <h2 className="text-lg font-extrabold text-forest-950">
          Productos de {tenant.name}{" "}
          <span className="text-slate-brand-400 font-semibold">({products.length})</span>
        </h2>

        {products.length === 0 && (
          <div className="card p-10 text-center">
            <p className="text-slate-brand-500">
              Todavía no hay productos en este país. Creá el primero acá arriba.
            </p>
          </div>
        )}

        {products.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            requirements={reqsByProduct.get(p.id) ?? []}
            tenantSlug={country}
          />
        ))}
      </div>
    </div>
  );
}
