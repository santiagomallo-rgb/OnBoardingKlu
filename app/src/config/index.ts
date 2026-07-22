import type { TenantConfig, PartyKind, LayerDef, FieldDef } from "./types";
import { AR } from "./tenants/ar";

export const TENANTS: Record<string, TenantConfig> = {
  [AR.slug]: AR,
};

export function getTenant(slug: string): TenantConfig {
  const t = TENANTS[slug];
  if (!t) throw new Error(`Tenant desconocido: ${slug}`);
  return t;
}

export function getLayers(tenantSlug: string, kind: PartyKind): LayerDef[] {
  return getTenant(tenantSlug).layers[kind];
}

export function getLayer(tenantSlug: string, kind: PartyKind, layerNumber: number): LayerDef | undefined {
  return getLayers(tenantSlug, kind).find((l) => l.number === layerNumber);
}

/** Un campo es visible si no tiene showIf o si su condición se cumple. */
export function isFieldVisible(field: FieldDef, data: Record<string, unknown>): boolean {
  if (!field.showIf) return true;
  const v = data[field.showIf.field];
  const asString = typeof v === "boolean" ? String(v) : String(v ?? "");
  return asString === field.showIf.equals;
}

export type { TenantConfig, PartyKind, LayerDef, StepDef, FieldDef, CheckDef, ProfileResult } from "./types";
