"use client";

import { useActionState, useState } from "react";
import { createClientAction } from "../../actions";

export interface TenantOption {
  slug: string;
  countryName: string;
  name: string;
  taxIdLabel: string;
  taxIdPlaceholder: string;
  taxIdHelp: string;
  products: { id: string; name: string; tagline: string | null }[];
}

export default function NewClientForm({ tenant }: { tenant: TenantOption }) {
  const [state, formAction, pending] = useActionState(createClientAction, null);
  const [kind, setKind] = useState<"human" | "legal">("human");

  return (
    <form action={formAction} className="card p-7 space-y-6">
      <input type="hidden" name="tenant" value={tenant.slug} />

      <div className="space-y-1.5">
        <label className="label-brand">Producto</label>
        <select name="product" className="input-brand">
          {tenant.products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="label-brand">Tipo de cliente</label>
        <div className="flex gap-3">
          {(
            [
              ["human", "Persona humana"],
              ["legal", "Persona jurídica"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={`flex-1 cursor-pointer rounded-2xl border px-4 py-3 text-sm font-semibold text-center transition ${
                kind === value
                  ? "border-forest-500 bg-forest-50 text-forest-800"
                  : "border-slate-brand-300 text-slate-brand-600 hover:border-forest-300"
              }`}
            >
              <input
                type="radio"
                name="kind"
                value={value}
                checked={kind === value}
                onChange={() => setKind(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="label-brand">
          {kind === "legal" ? "Razón social" : "Nombre y apellido"}
        </label>
        <input name="display_name" required className="input-brand" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="label-brand">{tenant.taxIdLabel}</label>
          <input name="tax_id" required placeholder={tenant.taxIdPlaceholder} className="input-brand font-mono" />
          <p className="text-xs text-slate-brand-400">{tenant.taxIdHelp}</p>
        </div>
        <div className="space-y-1.5">
          <label className="label-brand">E-mail del cliente</label>
          <input name="email" type="email" required className="input-brand" />
          <p className="text-xs text-slate-brand-400">Acá le llega el link de invitación (vía Resend).</p>
        </div>
      </div>

      {state?.error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{state.error}</p>
      )}

      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Creando…" : "Crear caso y enviar invitación"}
      </button>
    </form>
  );
}
