"use client";

import { useState } from "react";
import { deleteCaseAction } from "../config-actions";

/**
 * Borrado de caso con confirmación explícita: es destructivo e irreversible
 * (se lleva capas, chequeos, invitaciones, documentos y bitácora).
 */
export default function DeleteCaseButton({
  caseId,
  tenantSlug,
  name,
}: {
  caseId: string;
  tenantSlug: string;
  name: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs font-semibold text-slate-brand-400 hover:text-red-600 transition"
      >
        Borrar
      </button>
    );
  }

  return (
    <form action={deleteCaseAction} className="inline-flex items-center gap-2 justify-end">
      <input type="hidden" name="case_id" value={caseId} />
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <label className="flex items-center gap-1 text-xs text-slate-brand-600 whitespace-nowrap">
        <input type="checkbox" name="also_party" className="accent-red-600" />
        y la persona
      </label>
      <button
        type="submit"
        className="text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-full px-3 py-1 transition"
        title={`Borrar definitivamente ${name}`}
      >
        Confirmar
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-xs text-slate-brand-400 hover:text-slate-brand-700"
      >
        No
      </button>
    </form>
  );
}
