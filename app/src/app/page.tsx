import Link from "next/link";
import { KluLogo } from "@/components/Logo";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col">
      {/* Hero de marca */}
      <section className="relative overflow-hidden bg-forest-950 text-white">
        <div
          className="absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(120% 90% at 85% 0%, #0b5752 0%, #0b3c36 45%, #0a2d27 100%)",
          }}
        />
        <div className="absolute -right-24 top-1/2 -translate-y-1/2 h-[420px] w-[420px] rounded-full bg-citrus-500/20 blur-3xl" />
        <div className="relative max-w-5xl mx-auto px-6 py-8">
          <header className="flex items-center justify-between">
            <KluLogo className="h-8 w-auto" wordmarkClassName="text-white" />
            <Link href="/admin" className="text-sm font-medium text-forest-100 hover:text-white transition">
              Panel interno →
            </Link>
          </header>

          <div className="py-24 max-w-3xl">
            <p className="eyebrow text-citrus-300">Herramienta interna · Grupo Klu</p>
            <h1 className="mt-4 text-5xl sm:text-6xl font-extrabold leading-[1.05] tracking-tight">
              Panel de Onboarding
            </h1>
            <p className="mt-6 text-lg text-forest-100 leading-relaxed max-w-2xl">
              Gestión interna del alta de clientes por país: capas de onboarding,
              datos de personas reutilizables entre productos, invitaciones con
              verificación de identidad fiscal (CUIT, RFC) y chequeos de
              cumplimiento PLA/FT.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link href="/admin" className="btn-accent text-base">
                Entrar al panel
              </Link>
              <span className="inline-flex items-center text-sm text-forest-100">
                ¿Sos cliente y recibiste una invitación? Abrí el link de tu e-mail.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Pilares */}
      <section className="max-w-5xl mx-auto px-6 py-20 grid md:grid-cols-3 gap-6">
        {[
          {
            t: "Onboarding por capas",
            d: "Cada producto se completa en etapas. La primera abre la cuenta; las siguientes amplían el volumen y desbloquean funciones. El cliente ve qué gana en cada paso.",
          },
          {
            t: "Datos una sola vez",
            d: "Una persona se identifica por país + identificación fiscal. Si vuelve por otro producto o aparece como beneficiario final, sus datos se reutilizan.",
          },
          {
            t: "Cumplimiento integrado",
            d: "Chequeos REPET/OFAC/ONU, Padrón BCRA, Sujeto Obligado UIF y PEP, con nivel de riesgo y perfil transaccional calculado por caso.",
          },
        ].map((c, i) => (
          <div key={c.t} className="card p-7">
            <div className="h-11 w-11 rounded-2xl bg-forest-50 text-forest-700 flex items-center justify-center font-bold text-lg">
              {i + 1}
            </div>
            <h3 className="mt-5 text-lg font-bold text-forest-950">{c.t}</h3>
            <p className="mt-2 text-sm text-slate-brand-600 leading-relaxed">{c.d}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
