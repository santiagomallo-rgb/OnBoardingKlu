"use client";

import { useActionState } from "react";
import { verifyTaxIdAction } from "./actions";

export default function GateForm({
  token,
  taxIdLabel,
  taxIdPlaceholder,
  taxIdHelp,
  productName,
}: {
  token: string;
  taxIdLabel: string;
  taxIdPlaceholder: string;
  taxIdHelp: string;
  productName: string;
}) {
  const [state, formAction, pending] = useActionState(verifyTaxIdAction, null);

  return (
    <form action={formAction} className="card p-7 space-y-5">
      <input type="hidden" name="token" value={token} />
      <div>
        <div className="inline-flex items-center gap-2 rounded-full bg-forest-50 text-forest-700 text-xs font-semibold px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-citrus-500" />
          Paso previo de seguridad
        </div>
        <h2 className="text-2xl font-extrabold text-forest-950 mt-3">Verificá tu identidad</h2>
        <p className="text-sm text-slate-brand-600 mt-1.5 leading-relaxed">
          Te invitaron a completar el alta de <strong className="text-forest-800">{productName}</strong>.
          Ingresá tu {taxIdLabel} para continuar.
        </p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="tax_id" className="label-brand">
          {taxIdLabel}
        </label>
        <input
          id="tax_id"
          name="tax_id"
          required
          autoFocus
          placeholder={taxIdPlaceholder}
          className="input-brand text-lg tracking-wide font-mono py-3"
        />
        <p className="text-xs text-slate-brand-400">{taxIdHelp}</p>
      </div>
      {state?.error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Verificando…" : "Continuar"}
      </button>
    </form>
  );
}
