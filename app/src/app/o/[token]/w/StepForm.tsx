"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { FieldDef, StepDef } from "@/config/types";
import type { PersonEntry } from "@/lib/types";
import { saveStepAction } from "../actions";
import PeopleInput from "./PeopleInput";

const inputCls = "input-brand";

function fieldVisible(f: FieldDef, data: Record<string, unknown>): boolean {
  if (!f.showIf) return true;
  const v = data[f.showIf.field];
  return (typeof v === "boolean" ? String(v) : String(v ?? "")) === f.showIf.equals;
}

export default function StepForm({
  token,
  layerNumber,
  step,
  stepIndex,
  totalSteps,
  initialData,
  taxIdLabel,
  backHref,
}: {
  token: string;
  layerNumber: number;
  step: StepDef;
  stepIndex: number;
  totalSteps: number;
  initialData: Record<string, unknown>;
  taxIdLabel: string;
  backHref: string;
}) {
  const [state, formAction, pending] = useActionState(saveStepAction, null);
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const v: Record<string, unknown> = {};
    for (const f of step.fields) v[f.key] = initialData[f.key];
    return v;
  });

  const set = (key: string, value: unknown) => setValues((p) => ({ ...p, [key]: value }));

  return (
    <form action={formAction} className="card p-8 space-y-6">
      <input type="hidden" name="_token" value={token} />
      <input type="hidden" name="_layer" value={layerNumber} />
      <input type="hidden" name="_step" value={step.key} />

      <div>
        <div className="flex items-center justify-between text-xs text-slate-brand-400 mb-2">
          <span className="font-semibold text-forest-700">
            Paso {stepIndex + 1} de {totalSteps}
          </span>
          <span>Tus datos se guardan en cada paso</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-brand-100 overflow-hidden">
          <div
            className="h-full bg-citrus-500 rounded-full transition-all"
            style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
          />
        </div>
        <h1 className="text-2xl font-extrabold text-forest-950 mt-4">{step.title}</h1>
        {step.intro && <p className="text-sm text-slate-brand-600 mt-1.5 leading-relaxed">{step.intro}</p>}
      </div>

      <div className="space-y-5">
        {step.fields.map((f) => {
          if (!fieldVisible(f, values)) return null;
          const v = values[f.key];

          if (f.type === "boolean") {
            const isCheckbox = f.key.startsWith("acepta") || f.key.startsWith("ddjj_titularidad");
            if (isCheckbox) {
              return (
                <label key={f.key} className="flex items-start gap-3 rounded-2xl border border-slate-brand-200 p-4 cursor-pointer hover:border-forest-300 hover:bg-forest-50/40 transition">
                  <input
                    type="checkbox"
                    name={f.key}
                    checked={v === true}
                    onChange={(e) => set(f.key, e.target.checked)}
                    className="mt-1 w-4 h-4 accent-forest-600"
                  />
                  <span className="text-sm text-slate-brand-700">{f.label}</span>
                </label>
              );
            }
            return (
              <div key={f.key} className="space-y-1.5">
                <p className="label-brand">{f.label}</p>
                {f.help && <p className="text-xs text-slate-brand-400 leading-relaxed">{f.help}</p>}
                <div className="flex gap-3">
                  {[
                    ["false", "No"],
                    ["true", "Sí"],
                  ].map(([val, label]) => (
                    <label
                      key={val}
                      className={`flex-1 cursor-pointer rounded-xl border px-4 py-2.5 text-sm font-semibold text-center transition ${
                        String(v) === val
                          ? "border-forest-500 bg-forest-50 text-forest-800"
                          : "border-slate-brand-300 text-slate-brand-600 hover:border-forest-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name={f.key}
                        value={val}
                        checked={String(v) === val}
                        onChange={() => set(f.key, val === "true")}
                        className="sr-only"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            );
          }

          if (f.type === "people") {
            return (
              <PeopleInput
                key={f.key}
                field={f}
                taxIdLabel={taxIdLabel}
                value={(Array.isArray(v) ? v : []) as PersonEntry[]}
                onChange={(entries) => set(f.key, entries)}
              />
            );
          }

          if (f.type === "file") {
            const existing = v as { fileName?: string } | undefined;
            return (
              <div key={f.key} className="space-y-1.5">
                <label className="label-brand">{f.label}</label>
                {f.help && <p className="text-xs text-slate-brand-400 leading-relaxed">{f.help}</p>}
                {existing?.fileName && (
                  <p className="text-xs text-forest-700 bg-forest-50 rounded-lg px-3 py-2">
                    ✓ Ya subiste: {existing.fileName}. Podés reemplazarlo subiendo otro archivo.
                  </p>
                )}
                <input
                  type="file"
                  name={f.key}
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="block w-full text-sm text-slate-brand-600 file:mr-3 file:rounded-full file:border-0 file:bg-forest-50 file:px-4 file:py-2 file:text-forest-700 file:font-semibold hover:file:bg-forest-100 file:cursor-pointer"
                />
                <p className="text-xs text-slate-brand-400">PDF o imagen, hasta 8 MB.</p>
              </div>
            );
          }

          if (f.type === "select") {
            return (
              <div key={f.key} className="space-y-1.5">
                <label className="label-brand">{f.label}</label>
                {f.help && <p className="text-xs text-slate-brand-400 leading-relaxed">{f.help}</p>}
                <select
                  name={f.key}
                  value={String(v ?? "")}
                  onChange={(e) => set(f.key, e.target.value)}
                  className={inputCls}
                >
                  <option value="" disabled>
                    Elegí una opción…
                  </option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            );
          }

          if (f.type === "textarea") {
            return (
              <div key={f.key} className="space-y-1.5">
                <label className="label-brand">{f.label}</label>
                {f.help && <p className="text-xs text-slate-brand-400 leading-relaxed">{f.help}</p>}
                <textarea
                  name={f.key}
                  rows={3}
                  value={String(v ?? "")}
                  onChange={(e) => set(f.key, e.target.value)}
                  className={inputCls}
                />
              </div>
            );
          }

          const typeMap: Record<string, string> = {
            date: "date",
            email: "email",
            phone: "tel",
            number: "number",
            text: "text",
          };
          return (
            <div key={f.key} className="space-y-1.5">
              <label className="label-brand">{f.label}</label>
              {f.help && <p className="text-xs text-slate-brand-400 leading-relaxed">{f.help}</p>}
              <input
                type={typeMap[f.type] ?? "text"}
                name={f.key}
                value={String(v ?? "")}
                placeholder={f.placeholder}
                onChange={(e) => set(f.key, e.target.value)}
                className={inputCls}
                step={f.type === "number" ? "any" : undefined}
              />
            </div>
          );
        })}
      </div>

      {state?.error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{state.error}</p>
      )}

      <div className="flex items-center justify-between pt-2">
        <Link href={backHref} className="text-sm text-slate-brand-400 hover:text-forest-700 transition">
          ← Volver
        </Link>
        <button type="submit" disabled={pending} className="btn-primary px-8">
          {pending
            ? "Guardando…"
            : stepIndex === totalSteps - 1
              ? "Guardar y terminar etapa"
              : "Guardar y continuar"}
        </button>
      </div>
    </form>
  );
}
