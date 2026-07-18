"use client";

import { useActionState } from "react";
import { KluLogo } from "@/components/Logo";
import { loginAction } from "../actions";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, null);

  return (
    <form action={formAction} className="relative w-full max-w-sm card p-8 space-y-6">
      <div>
        <KluLogo className="h-8 w-auto" wordmarkClassName="text-forest-900" />
        <h1 className="mt-5 text-2xl font-extrabold text-forest-950">Panel de gestión</h1>
        <p className="text-sm text-slate-brand-600 mt-1">Ingresá para administrar los onboardings.</p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="label-brand">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoFocus
          className="input-brand"
        />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
