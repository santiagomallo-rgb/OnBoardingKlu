"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { isAdmin } from "@/lib/session";
import { hasCodeConfig } from "@/config/resolve";
import type { TenantRow } from "@/lib/types";

async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // saca acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Países ───────────────────────────────────────────────────────────────

export interface CountryState {
  error?: string;
}

export async function createCountryAction(
  _prev: CountryState | null,
  formData: FormData
): Promise<CountryState> {
  await requireAdmin();
  const supa = db();

  const name = String(formData.get("name") ?? "").trim();
  const countryCode = String(formData.get("country_code") ?? "").trim().toUpperCase();
  const taxIdType = String(formData.get("tax_id_type") ?? "").trim();
  const taxIdLabel = String(formData.get("tax_id_label") ?? "").trim() || taxIdType;
  const taxIdPlaceholder = String(formData.get("tax_id_placeholder") ?? "").trim();
  const taxIdHelp = String(formData.get("tax_id_help") ?? "").trim();
  const currency = String(formData.get("currency") ?? "").trim().toUpperCase();
  const flag = String(formData.get("flag") ?? "").trim() || "🌎";
  const legalName = String(formData.get("legal_name") ?? "").trim();

  if (!name || !countryCode || !taxIdType || !currency) {
    return { error: "Completá nombre, código de país, identificación fiscal y moneda." };
  }
  if (countryCode.length !== 2) {
    return { error: "El código de país debe tener 2 letras (AR, CO, PE…)." };
  }

  const slug = countryCode.toLowerCase();

  const { data: existing } = await supa.from("tenants").select("id").eq("slug", slug).maybeSingle();
  if (existing) return { error: `Ya existe un país con el código ${countryCode}.` };

  const { error } = await supa.from("tenants").insert({
    slug,
    name,
    legal_name: legalName || null,
    country_code: countryCode,
    tax_id_type: taxIdType,
    tax_id_label: taxIdLabel,
    tax_id_placeholder: taxIdPlaceholder || null,
    tax_id_help: taxIdHelp || "Ingresá tu identificación fiscal.",
    flag,
    currency,
    locale: `es-${countryCode}`,
    active: true,
  });
  if (error) return { error: `No se pudo crear el país: ${error.message}` };

  revalidatePath("/admin");
  revalidatePath("/");
  redirect(`/admin/${slug}/productos`);
}

export async function deleteCountryAction(formData: FormData) {
  await requireAdmin();
  const slug = String(formData.get("slug") ?? "");
  if (!slug) return;

  // Los países con configuración en código no se borran desde la UI:
  // su normativa vive en el repo y borrarlos dejaría la config huérfana.
  if (hasCodeConfig(slug)) return;

  const supa = db();
  const { data: tenant } = await supa
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle<TenantRow>();
  if (!tenant) return;

  const { count } = await supa
    .from("onboarding_cases")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenant.id);
  if ((count ?? 0) > 0) return; // con casos cargados no se borra

  await supa.from("tenants").delete().eq("id", tenant.id);
  revalidatePath("/admin");
  revalidatePath("/");
  redirect("/admin");
}

// ── Productos ────────────────────────────────────────────────────────────

export interface ProductState {
  error?: string;
}

export async function createProductAction(
  _prev: ProductState | null,
  formData: FormData
): Promise<ProductState> {
  await requireAdmin();
  const supa = db();

  const tenantSlug = String(formData.get("tenant_slug") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!tenantSlug || !name) return { error: "Poné al menos el nombre del producto." };
  if (!description) return { error: "La descripción del producto es obligatoria." };

  const { data: tenant } = await supa
    .from("tenants")
    .select("id")
    .eq("slug", tenantSlug)
    .maybeSingle<TenantRow>();
  if (!tenant) return { error: "País inválido." };

  const code = slugify(name).slice(0, 40) || `producto-${Date.now()}`;

  const { data: dup } = await supa
    .from("products")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("code", code)
    .maybeSingle();
  if (dup) return { error: "Ya existe un producto con ese nombre en este país." };

  const { error } = await supa.from("products").insert({
    tenant_id: tenant.id,
    code,
    name,
    tagline: tagline || null,
    description,
    active: true,
  });
  if (error) return { error: `No se pudo crear el producto: ${error.message}` };

  revalidatePath(`/admin/${tenantSlug}/productos`);
  return {};
}

export async function deleteProductAction(formData: FormData) {
  await requireAdmin();
  const supa = db();
  const productId = String(formData.get("product_id") ?? "");
  const tenantSlug = String(formData.get("tenant_slug") ?? "");
  if (!productId) return;

  // No se borra un producto que ya tiene casos de onboarding asociados.
  const { count } = await supa
    .from("onboarding_cases")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);
  if ((count ?? 0) > 0) {
    await supa.from("products").update({ active: false }).eq("id", productId);
  } else {
    await supa.from("products").delete().eq("id", productId);
  }
  revalidatePath(`/admin/${tenantSlug}/productos`);
}

// ── Requisitos de cumplimiento por producto ──────────────────────────────

export interface RequirementState {
  error?: string;
}

export async function addRequirementAction(
  _prev: RequirementState | null,
  formData: FormData
): Promise<RequirementState> {
  await requireAdmin();
  const supa = db();

  const tenantSlug = String(formData.get("tenant_slug") ?? "");
  const productId = String(formData.get("product_id") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const help = String(formData.get("help") ?? "").trim();
  const category = String(formData.get("category") ?? "dato");
  const fieldType = String(formData.get("field_type") ?? "text");
  const appliesTo = String(formData.get("applies_to") ?? "both");
  const required = formData.get("required") === "on";
  const optionsRaw = String(formData.get("options") ?? "").trim();

  if (!productId || !label) return { error: "Escribí qué hay que cumplir." };
  if (!["dato", "documento", "declaracion", "control"].includes(category))
    return { error: "Categoría inválida." };
  if (!["human", "legal", "both"].includes(appliesTo))
    return { error: "Alcance inválido." };

  const { data: product } = await supa
    .from("products")
    .select("id, tenant_id")
    .eq("id", productId)
    .maybeSingle<{ id: string; tenant_id: string }>();
  if (!product) return { error: "Producto inválido." };

  // Las opciones se cargan como una lista separada por comas.
  const options =
    fieldType === "select" && optionsRaw
      ? optionsRaw
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean)
          .map((o) => ({ value: slugify(o), label: o }))
      : [];
  if (fieldType === "select" && options.length === 0) {
    return { error: "Para una lista desplegable, cargá al menos una opción." };
  }

  let code = slugify(label).slice(0, 50) || `req-${Date.now()}`;
  const { data: dup } = await supa
    .from("product_requirements")
    .select("id")
    .eq("product_id", productId)
    .eq("code", code)
    .maybeSingle();
  if (dup) code = `${code}-${Date.now().toString().slice(-4)}`;

  const { data: last } = await supa
    .from("product_requirements")
    .select("sort_order")
    .eq("product_id", productId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle<{ sort_order: number }>();

  const { error } = await supa.from("product_requirements").insert({
    tenant_id: product.tenant_id,
    product_id: productId,
    code,
    label,
    help: help || null,
    category,
    // Un control es interno (lo resuelve Cumplimiento), no se le pide al cliente.
    field_type: category === "control" ? "boolean" : fieldType,
    applies_to: appliesTo,
    required,
    options,
    sort_order: (last?.sort_order ?? 0) + 10,
  });
  if (error) return { error: `No se pudo agregar: ${error.message}` };

  revalidatePath(`/admin/${tenantSlug}/productos`);
  return {};
}

export async function deleteRequirementAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("requirement_id") ?? "");
  const tenantSlug = String(formData.get("tenant_slug") ?? "");
  if (!id) return;
  await db().from("product_requirements").delete().eq("id", id);
  revalidatePath(`/admin/${tenantSlug}/productos`);
}

// ── Borrar caso ──────────────────────────────────────────────────────────

export async function deleteCaseAction(formData: FormData) {
  await requireAdmin();
  const supa = db();
  const caseId = String(formData.get("case_id") ?? "");
  const tenantSlug = String(formData.get("tenant_slug") ?? "");
  const alsoParty = formData.get("also_party") === "on";
  if (!caseId) return;

  const { data: caseRow } = await supa
    .from("onboarding_cases")
    .select("id, party_id")
    .eq("id", caseId)
    .maybeSingle<{ id: string; party_id: string }>();
  if (!caseRow) return;

  // Los documentos apuntan al caso con ON DELETE SET NULL: se limpian a mano
  // para no dejar archivos huérfanos en el bucket.
  const { data: docs } = await supa
    .from("documents")
    .select("storage_path")
    .eq("case_id", caseId);
  const paths = (docs ?? []).map((d: { storage_path: string }) => d.storage_path);
  if (paths.length) {
    await supa.storage.from("kyc-docs").remove(paths);
    await supa.from("documents").delete().eq("case_id", caseId);
  }

  // case_layers, compliance_checks, invites y case_events caen por cascada.
  await supa.from("onboarding_cases").delete().eq("id", caseId);

  if (alsoParty) {
    const { count } = await supa
      .from("onboarding_cases")
      .select("id", { count: "exact", head: true })
      .eq("party_id", caseRow.party_id);
    if ((count ?? 0) === 0) {
      await supa.from("parties").delete().eq("id", caseRow.party_id);
    }
  }

  revalidatePath(`/admin/${tenantSlug}`);
  redirect(`/admin/${tenantSlug}`);
}
