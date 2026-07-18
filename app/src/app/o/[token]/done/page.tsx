import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { hasInviteSession } from "@/lib/session";
import { getLayers } from "@/config";
import { KluLogo } from "@/components/Logo";
import { loadInviteContext } from "../shared";

export const dynamic = "force-dynamic";

export default async function DonePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ l?: string }>;
}) {
  const { token } = await params;
  const { l } = await searchParams;

  if (!(await hasInviteSession(token))) redirect(`/o/${token}`);
  const ctx = await loadInviteContext(token);
  if (!ctx) notFound();

  const layers = getLayers(ctx.tenantRow.slug, ctx.party.kind);
  const completedNumber = Number(l ?? 1);
  const completed = layers.find((ly) => ly.number === completedNumber);
  const next = layers.find((ly) => ly.number === completedNumber + 1);

  return (
    <main className="flex-1 flex flex-col">
      <header className="bg-forest-950 text-white">
        <div className="max-w-2xl mx-auto px-6 py-3.5 flex items-center gap-3">
          <KluLogo className="h-6 w-auto" wordmarkClassName="text-white" />
          <span className="text-sm text-forest-100 border-l border-white/20 pl-3">
            {ctx.tenant.name}
          </span>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg space-y-6 text-center">
          <div className="card p-8 space-y-4 border-forest-200">
            <div className="w-16 h-16 rounded-full bg-forest-500 text-white flex items-center justify-center text-3xl mx-auto">
              ✓
            </div>
            <h1 className="text-2xl font-extrabold text-forest-950">
              ¡Etapa {completedNumber} completada!
            </h1>
            {completed && <p className="text-slate-brand-600 leading-relaxed">{completed.unlocks}</p>}
            <div className="rounded-2xl bg-slate-brand-50 border border-slate-brand-200 p-4 text-left">
              <p className="text-sm text-slate-brand-600 leading-relaxed">
                <span className="font-bold text-forest-900">¿Qué sigue?</span> Nuestro equipo
                de Cumplimiento va a verificar tus datos (es un control que exige la
                normativa y no te pide nada más a vos). Te avisamos por e-mail
                cuando tu cuenta esté habilitada.
              </p>
            </div>
          </div>

          {next && (
            <div className="relative overflow-hidden rounded-3xl bg-forest-950 text-white p-8 space-y-3 text-left">
              <div
                className="absolute inset-0 opacity-80"
                style={{ background: "radial-gradient(130% 100% at 90% 0%, #0b5752 0%, #0b3c36 50%, #0a2d27 100%)" }}
              />
              <div className="relative space-y-3">
                <p className="eyebrow text-citrus-300">¿Querés más?</p>
                <h2 className="text-xl font-extrabold">{next.title}</h2>
                <p className="text-forest-100 text-sm leading-relaxed">{next.unlocks}</p>
                <Link href={`/o/${token}/w?l=${next.number}`} className="btn-accent">
                  Continuar ahora
                </Link>
                <p className="text-xs text-forest-100/80">
                  También podés volver más tarde desde el mismo link de tu e-mail.
                </p>
              </div>
            </div>
          )}

          {!next && (
            <div className="grid sm:grid-cols-3 gap-3">
              {ctx.tenant.productPitch.map((p) => (
                <div key={p.title} className="card p-4 text-left">
                  <p className="font-bold text-sm text-forest-700">{p.title}</p>
                  <p className="text-xs text-slate-brand-600 mt-1 leading-relaxed">{p.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
