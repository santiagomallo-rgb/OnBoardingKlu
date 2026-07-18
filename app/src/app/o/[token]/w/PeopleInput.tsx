"use client";

import { useState } from "react";
import type { FieldDef } from "@/config/types";
import type { PersonEntry } from "@/lib/types";

const inputCls =
  "w-full rounded-lg border border-slate-brand-300 px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 transition";

export default function PeopleInput({
  field,
  taxIdLabel,
  value,
  onChange,
}: {
  field: FieldDef;
  taxIdLabel: string;
  value: PersonEntry[];
  onChange: (entries: PersonEntry[]) => void;
}) {
  const [draft, setDraft] = useState<PersonEntry>({ nombre: "", tax_id: "", email: "" });

  const add = () => {
    if (!draft.nombre.trim() || !draft.tax_id.trim()) return;
    onChange([...value, { ...draft, pct: draft.pct ? Number(draft.pct) : undefined }]);
    setDraft({ nombre: "", tax_id: "", email: "" });
  };

  return (
    <div className="space-y-2">
      <input type="hidden" name={field.key} value={JSON.stringify(value)} />
      <p className="text-sm font-medium text-slate-700">{field.label}</p>
      {field.help && <p className="text-xs text-slate-400 leading-relaxed">{field.help}</p>}

      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((p, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded-xl bg-forest-50 border border-forest-100 px-3 py-2 text-sm"
            >
              <span>
                <strong className="text-forest-950">{p.nombre}</strong>
                <span className="text-slate-brand-500 font-mono">
                  {" "}
                  · {taxIdLabel} {p.tax_id}
                  {p.pct != null && ` · ${p.pct}%`}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="text-red-500 hover:text-red-700 text-xs font-medium"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-2xl border border-dashed border-slate-brand-300 p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input
            placeholder="Nombre y apellido"
            value={draft.nombre}
            onChange={(e) => setDraft({ ...draft, nombre: e.target.value })}
            className={inputCls}
          />
          <input
            placeholder={taxIdLabel}
            value={draft.tax_id}
            onChange={(e) => setDraft({ ...draft, tax_id: e.target.value })}
            className={inputCls}
          />
          <input
            placeholder="E-mail (opcional)"
            type="email"
            value={draft.email ?? ""}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            className={inputCls}
          />
          {field.withOwnershipPct && (
            <input
              placeholder="% de participación"
              type="number"
              min={0}
              max={100}
              value={draft.pct ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, pct: e.target.value === "" ? undefined : Number(e.target.value) })
              }
              className={inputCls}
            />
          )}
        </div>
        <button
          type="button"
          onClick={add}
          disabled={!draft.nombre.trim() || !draft.tax_id.trim()}
          className="rounded-full bg-forest-900 text-white px-4 py-1.5 text-sm font-semibold hover:bg-forest-800 disabled:opacity-40 transition"
        >
          + Agregar persona
        </button>
      </div>
    </div>
  );
}
