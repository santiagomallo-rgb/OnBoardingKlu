"use client";

import { useActionState } from "react";
import { createCountryAction } from "../config-actions";

export default function NewCountryForm() {
  const [state, formAction, pending] = useActionState(createCountryAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2 space-y-1.5">
          <label htmlFor="name" className="label-brand">
            Nombre del país / operación
          </label>
          <input
            id="name"
            name="name"
            required
            placeholder="Klu Colombia"
            className="input-brand"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="country_code" className="label-brand">
            Código (2 letras)
          </label>
          <input
            id="country_code"
            name="country_code"
            required
            maxLength={2}
            placeholder="CO"
            className="input-brand uppercase"
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="tax_id_type" className="label-brand">
            Identificación fiscal
          </label>
          <input
            id="tax_id_type"
            name="tax_id_type"
            required
            placeholder="NIT"
            className="input-brand"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="currency" className="label-brand">
            Moneda
          </label>
          <input
            id="currency"
            name="currency"
            required
            maxLength={3}
            placeholder="COP"
            className="input-brand uppercase"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="flag" className="label-brand">
            Bandera (emoji)
          </label>
          <input id="flag" name="flag" placeholder="🇨🇴" className="input-brand" />
        </div>
      </div>

      <details className="rounded-2xl border border-slate-brand-200 p-4">
        <summary className="text-sm font-semibold text-forest-800 cursor-pointer">
          Opciones avanzadas (cómo se le pide la identificación al cliente)
        </summary>
        <div className="mt-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="tax_id_label" className="label-brand">
                Etiqueta que ve el cliente
              </label>
              <input
                id="tax_id_label"
                name="tax_id_label"
                placeholder="NIT / Cédula"
                className="input-brand"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="tax_id_placeholder" className="label-brand">
                Ejemplo de formato
              </label>
              <input
                id="tax_id_placeholder"
                name="tax_id_placeholder"
                placeholder="900123456-7"
                className="input-brand"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="tax_id_help" className="label-brand">
              Texto de ayuda
            </label>
            <input
              id="tax_id_help"
              name="tax_id_help"
              placeholder="Ingresá tu NIT sin puntos, con dígito de verificación."
              className="input-brand"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="legal_name" className="label-brand">
              Razón social / registro
            </label>
            <input
              id="legal_name"
              name="legal_name"
              placeholder="Klu Colombia SAS"
              className="input-brand"
            />
          </div>
        </div>
      </details>

      {state?.error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{state.error}</p>
      )}

      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Creando…" : "Crear país"}
      </button>
    </form>
  );
}
