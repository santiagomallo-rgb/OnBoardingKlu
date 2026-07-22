"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  addRequirementAction,
  deleteProductAction,
  deleteRequirementAction,
} from "../../config-actions";
import type { ProductRequirementRow, ProductRow } from "@/lib/types";

const CATEGORY_META: Record<
  ProductRequirementRow["category"],
  { label: string; hint: string; cls: string }
> = {
  dato: {
    label: "Dato",
    hint: "Información que carga el cliente en el formulario.",
    cls: "bg-forest-50 text-forest-700 border-forest-200",
  },
  documento: {
    label: "Documento",
    hint: "Archivo que el cliente tiene que adjuntar.",
    cls: "bg-citrus-100 text-citrus-600 border-citrus-300",
  },
  declaracion: {
    label: "Declaración jurada",
    hint: "Algo que el cliente declara y firma (por ejemplo, si es PEP).",
    cls: "bg-slate-brand-100 text-slate-brand-700 border-slate-brand-300",
  },
  control: {
    label: "Control interno",
    hint: "Lo resuelve Cumplimiento, no se le pide al cliente (listas, padrones).",
    cls: "bg-red-50 text-red-700 border-red-200",
  },
};

const FIELD_TYPES: { value: string; label: string }[] = [
  { value: "text", label: "Texto" },
  { value: "textarea", label: "Texto largo" },
  { value: "number", label: "Número" },
  { value: "date", label: "Fecha" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Teléfono" },
  { value: "select", label: "Lista de opciones" },
  { value: "boolean", label: "Sí / No" },
  { value: "file", label: "Archivo adjunto" },
  { value: "people", label: "Lista de personas" },
];

const APPLIES: { value: string; label: string }[] = [
  { value: "both", label: "Ambos" },
  { value: "human", label: "Persona humana" },
  { value: "legal", label: "Persona jurídica" },
];

export default function ProductCard({
  product,
  requirements,
  tenantSlug,
}: {
  product: ProductRow;
  requirements: ProductRequirementRow[];
  tenantSlug: string;
}) {
  const [open, setOpen] = useState(requirements.length === 0);
  const [category, setCategory] = useState<ProductRequirementRow["category"]>("dato");
  const [fieldType, setFieldType] = useState("text");
  const [state, formAction, pending] = useActionState(addRequirementAction, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && !state.error) ref.current?.reset();
  }, [state]);

  const isControl = category === "control";

  return (
    <div className={`card p-6 ${product.active ? "" : "opacity-60"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-xl font-extrabold text-forest-950">
            {product.name}
            {!product.active && (
              <span className="ml-2 text-xs font-semibold bg-slate-brand-100 text-slate-brand-600 rounded-full px-2 py-0.5 align-middle">
                inactivo
              </span>
            )}
          </h3>
          {product.tagline && (
            <p className="text-sm text-citrus-600 font-semibold mt-0.5">{product.tagline}</p>
          )}
          {product.description && (
            <p className="text-sm text-slate-brand-600 mt-2 leading-relaxed max-w-2xl">
              {product.description}
            </p>
          )}
        </div>
        <form action={deleteProductAction} className="shrink-0">
          <input type="hidden" name="product_id" value={product.id} />
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <button
            type="submit"
            className="text-xs font-semibold text-slate-brand-400 hover:text-red-600 transition"
            title="Si el producto ya tiene casos, se desactiva en vez de borrarse."
          >
            Borrar
          </button>
        </form>
      </div>

      {/* Requisitos cargados */}
      <div className="mt-5 border-t border-slate-brand-100 pt-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-forest-900">
            Requisitos de cumplimiento{" "}
            <span className="text-slate-brand-400">({requirements.length})</span>
          </h4>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-xs font-semibold text-forest-700 hover:text-forest-900"
          >
            {open ? "Ocultar formulario" : "+ Agregar requisito"}
          </button>
        </div>

        {requirements.length === 0 ? (
          <p className="text-sm text-slate-brand-400 mt-3">
            Todavía no cargaste qué hay que cumplir para este producto.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {requirements.map((r) => {
              const meta = CATEGORY_META[r.category];
              return (
                <li
                  key={r.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-brand-200 px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold uppercase rounded-full border px-2 py-0.5 ${meta.cls}`}>
                        {meta.label}
                      </span>
                      <span className="font-semibold text-forest-950 text-sm">{r.label}</span>
                      {r.required && (
                        <span className="text-[10px] font-bold text-red-600 uppercase">obligatorio</span>
                      )}
                      {r.applies_to !== "both" && (
                        <span className="text-[10px] text-slate-brand-500 uppercase font-semibold">
                          solo {r.applies_to === "human" ? "PH" : "PJ"}
                        </span>
                      )}
                    </div>
                    {r.help && (
                      <p className="text-xs text-slate-brand-500 mt-1 leading-relaxed">{r.help}</p>
                    )}
                    <p className="text-[11px] text-slate-brand-400 font-mono mt-1">
                      {r.code} · {r.field_type}
                      {r.options?.length ? ` · ${r.options.length} opciones` : ""}
                    </p>
                  </div>
                  <form action={deleteRequirementAction} className="shrink-0">
                    <input type="hidden" name="requirement_id" value={r.id} />
                    <input type="hidden" name="tenant_slug" value={tenantSlug} />
                    <button
                      type="submit"
                      className="text-xs text-slate-brand-400 hover:text-red-600 transition"
                    >
                      Quitar
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}

        {/* Alta de requisito */}
        {open && (
          <form
            ref={ref}
            action={formAction}
            className="mt-4 rounded-2xl bg-slate-brand-50 border border-slate-brand-200 p-4 space-y-4"
          >
            <input type="hidden" name="product_id" value={product.id} />
            <input type="hidden" name="tenant_slug" value={tenantSlug} />

            <div className="space-y-1.5">
              <label className="label-brand">¿Qué hay que cumplir?</label>
              <input
                name="label"
                required
                placeholder="Domicilio real completo"
                className="input-brand bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="label-brand">
                Por qué se pide <span className="font-normal text-slate-brand-400">(opcional)</span>
              </label>
              <input
                name="help"
                placeholder="Lo exige la normativa local para verificar tu identidad."
                className="input-brand bg-white"
              />
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="label-brand">Tipo</label>
                <select
                  name="category"
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as ProductRequirementRow["category"])
                  }
                  className="input-brand bg-white"
                >
                  {(Object.keys(CATEGORY_META) as ProductRequirementRow["category"][]).map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_META[c].label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="label-brand">Cómo se carga</label>
                <select
                  name="field_type"
                  value={isControl ? "boolean" : fieldType}
                  onChange={(e) => setFieldType(e.target.value)}
                  disabled={isControl}
                  className="input-brand bg-white disabled:opacity-50"
                >
                  {FIELD_TYPES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="label-brand">Aplica a</label>
                <select name="applies_to" defaultValue="both" className="input-brand bg-white">
                  {APPLIES.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="text-xs text-slate-brand-500">{CATEGORY_META[category].hint}</p>

            {!isControl && fieldType === "select" && (
              <div className="space-y-1.5">
                <label className="label-brand">Opciones (separadas por coma)</label>
                <input
                  name="options"
                  placeholder="Empleado, Monotributista, Responsable Inscripto"
                  className="input-brand bg-white"
                />
              </div>
            )}

            <label className="flex items-center gap-2 text-sm text-slate-brand-700">
              <input
                type="checkbox"
                name="required"
                defaultChecked
                className="w-4 h-4 accent-forest-600"
              />
              Es obligatorio
            </label>

            {state?.error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{state.error}</p>
            )}

            <button type="submit" disabled={pending} className="btn-primary">
              {pending ? "Agregando…" : "Agregar requisito"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
