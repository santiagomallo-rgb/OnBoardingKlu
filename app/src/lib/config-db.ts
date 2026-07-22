// Lectura de la configuración (países, productos, requisitos) desde la base.
// Es la contraparte de src/config/resolve.ts: éste trae los datos, aquél los
// convierte en la TenantConfig que consume el flujo de onboarding.

import { db } from "@/lib/supabase";
import { resolveTenant } from "@/config/resolve";
import type { TenantConfig } from "@/config/types";
import type { ProductRequirementRow, ProductRow, TenantRow } from "@/lib/types";

export async function listTenants(includeInactive = false): Promise<TenantRow[]> {
  let q = db().from("tenants").select("*").order("name");
  if (!includeInactive) q = q.eq("active", true);
  const { data } = await q;
  return (data ?? []) as TenantRow[];
}

export async function getTenantRow(slug: string): Promise<TenantRow | null> {
  const { data } = await db().from("tenants").select("*").eq("slug", slug).maybeSingle();
  return (data as TenantRow) ?? null;
}

export async function listProducts(
  tenantId: string,
  includeInactive = false
): Promise<ProductRow[]> {
  let q = db().from("products").select("*").eq("tenant_id", tenantId).order("name");
  if (!includeInactive) q = q.eq("active", true);
  const { data } = await q;
  return (data ?? []) as ProductRow[];
}

export async function getProduct(productId: string): Promise<ProductRow | null> {
  const { data } = await db().from("products").select("*").eq("id", productId).maybeSingle();
  return (data as ProductRow) ?? null;
}

export async function listRequirements(productId: string): Promise<ProductRequirementRow[]> {
  const { data } = await db()
    .from("product_requirements")
    .select("*")
    .eq("product_id", productId)
    .order("sort_order");
  return (data ?? []) as ProductRequirementRow[];
}

export async function countRequirementsByProduct(
  tenantId: string
): Promise<Record<string, number>> {
  const { data } = await db()
    .from("product_requirements")
    .select("product_id")
    .eq("tenant_id", tenantId);
  const counts: Record<string, number> = {};
  for (const r of (data ?? []) as { product_id: string }[]) {
    counts[r.product_id] = (counts[r.product_id] ?? 0) + 1;
  }
  return counts;
}

/**
 * TenantConfig lista para usar. Para países con config en código (AR, MX) el
 * producto es irrelevante; para los creados desde el panel, las capas se
 * derivan de los requisitos de ese producto.
 */
export async function resolveTenantConfig(
  row: TenantRow,
  productId?: string | null
): Promise<TenantConfig> {
  const requirements = productId ? await listRequirements(productId) : [];
  return resolveTenant(row, requirements);
}
