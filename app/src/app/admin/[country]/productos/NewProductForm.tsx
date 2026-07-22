"use client";

import { useActionState, useEffect, useRef } from "react";
import { createProductAction } from "../../config-actions";

export default function NewProductForm({ tenantSlug }: { tenantSlug: string }) {
  const [state, formAction, pending] = useActionState(createProductAction, null);
  const ref = useRef<HTMLFormElement>(null);

  // Al crearse bien (sin error y ya no pendiente), limpiamos para cargar el siguiente.
  useEffect(() => {
    if (state && !state.error) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={formAction} className="space-y-4">
      <input type="hidden" name="tenant_slug" value={tenantSlug} />

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="p_name" className="label-brand">
            Nombre del producto
          </label>
          <input
            id="p_name"
            name="name"
            required
            placeholder="Cuenta de pago"
            className="input-brand"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="p_tagline" className="label-brand">
            Frase corta <span className="font-normal text-slate-brand-400">(opcional)</span>
          </label>
          <input
            id="p_tagline"
            name="tagline"
            placeholder="Cobrá y pagá desde una sola cuenta"
            className="input-brand"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="p_description" className="label-brand">
          Descripción del producto
        </label>
        <textarea
          id="p_description"
          name="description"
          required
          rows={3}
          placeholder="Qué es, para quién es y qué habilita. Esto es lo que va a leer el cliente cuando se le invite a darse de alta."
          className="input-brand"
        />
      </div>

      {state?.error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{state.error}</p>
      )}

      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Creando…" : "Crear producto"}
      </button>
    </form>
  );
}
