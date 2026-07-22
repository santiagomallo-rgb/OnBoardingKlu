import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { hasInviteSession } from "@/lib/session";
import { layerProgress } from "@/lib/onboarding";
import { db } from "@/lib/supabase";
import { KluLogo } from "@/components/Logo";
import type { CaseLayerRow } from "@/lib/types";
import { loadInviteContext } from "../shared";
import StepForm from "./StepForm";

export const dynamic = "force-dynamic";

function TopBar({ tenantName, productName }: { tenantName: string; productName?: string }) {
  return (
    <header className="bg-forest-950 text-white">
      <div className="max-w-2xl mx-auto px-6 py-3.5 flex items-center gap-3">
        <KluLogo className="h-6 w-auto" wordmarkClassName="text-white" />
        <span className="text-sm text-forest-100 border-l border-white/20 pl-3">
          {tenantName}
          {productName ? ` · ${productName}` : ""}
        </span>
      </div>
    </header>
  );
}

export default async function WizardPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ l?: string; s?: string }>;
}) {
  const { token } = await params;
  const { l, s } = await searchParams;

  if (!(await hasInviteSession(token))) redirect(`/o/${token}`);
  const ctx = await loadInviteContext(token);
  if (!ctx) notFound();

  const { data: layerRowsData } = await db()
    .from("case_layers")
    .select("*")
    .eq("case_id", ctx.caseRow.id);
  const layerRows = (layerRowsData ?? []) as CaseLayerRow[];

  const layers = ctx.tenant.layers[ctx.party.kind];
  const progress = layerProgress(ctx.tenant, ctx.party.kind, ctx.party.data, layerRows);

  const resolved = ["approved", "rejected", "blocked"].includes(ctx.caseRow.status);
  if (resolved) {
    return (
      <main className="flex-1 flex flex-col">
        <TopBar tenantName={ctx.tenant.name} productName={ctx.product?.name} />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-forest-50 text-forest-600 flex items-center justify-center text-3xl mx-auto">
              {ctx.caseRow.status === "approved" ? "🎉" : "🕐"}
            </div>
            <h1 className="text-2xl font-extrabold text-forest-950">
              {ctx.caseRow.status === "approved" ? "¡Tu cuenta está aprobada!" : "Trámite en revisión"}
            </h1>
            <p className="text-slate-brand-600">
              {ctx.caseRow.status === "approved"
                ? "Ya podés empezar a operar. Cualquier duda, contactá a tu asesor."
                : "Este trámite fue resuelto por nuestro equipo. Si tenés dudas, contactá a tu asesor comercial."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const layerNumber = Number(l ?? ctx.caseRow.current_layer ?? 1);
  const layer = layers.find((ly) => ly.number === layerNumber) ?? layers[0];
  const layerRow = layerRows.find((r) => r.layer === layer.number);
  const layerDone = layerRow?.status === "completed" || layerRow?.status === "approved";

  const stepIndex = s != null ? Math.max(0, Math.min(Number(s), layer.steps.length - 1)) : null;

  return (
    <main className="flex-1 flex flex-col">
      <TopBar tenantName={ctx.tenant.name} productName={ctx.product?.name} />
      <div className="max-w-2xl w-full mx-auto p-6 space-y-6">
        {/* Chips de capas */}
        <div className="flex gap-2 flex-wrap">
          {progress.map(({ layer: ly, done, total, status }) => (
            <Link
              key={ly.number}
              href={`/o/${token}/w?l=${ly.number}`}
              className={`text-xs px-3.5 py-1.5 rounded-full border font-semibold transition ${
                status === "completed" || status === "approved"
                  ? "bg-forest-50 border-forest-200 text-forest-700"
                  : ly.number === layer.number
                    ? "bg-forest-900 border-forest-900 text-white"
                    : "bg-white border-slate-brand-200 text-slate-brand-500"
              }`}
            >
              {status === "completed" || status === "approved" ? "✓ " : ""}
              Etapa {ly.number}: {ly.title.split("—")[0].trim()}
              {status !== "completed" && status !== "approved" && total > 0 && ` (${done}/${total})`}
            </Link>
          ))}
        </div>

        {layerDone ? (
          <div className="card p-8 text-center space-y-3 border-forest-200">
            <div className="w-14 h-14 rounded-full bg-forest-500 text-white flex items-center justify-center text-2xl mx-auto">
              ✓
            </div>
            <h1 className="text-xl font-extrabold text-forest-950">Ya completaste esta etapa</h1>
            <p className="text-sm text-slate-brand-600">{layer.unlocks}</p>
            {progress.some((p) => p.status !== "completed" && p.status !== "approved") && (
              <Link
                href={`/o/${token}/w?l=${progress.find((p) => p.status !== "completed" && p.status !== "approved")!.layer.number}`}
                className="btn-primary mt-2"
              >
                Continuar con la siguiente etapa
              </Link>
            )}
          </div>
        ) : stepIndex == null ? (
          <div className="card p-8 space-y-5">
            <div>
              <p className="eyebrow">Etapa {layer.number}</p>
              <h1 className="text-2xl font-extrabold text-forest-950 mt-1">{layer.title}</h1>
            </div>
            <p className="text-slate-brand-600 leading-relaxed">{layer.description}</p>
            <div className="rounded-2xl bg-forest-50 border border-forest-100 p-4">
              <p className="text-sm text-forest-900">
                <span className="font-bold">¿Qué desbloqueás?</span> {layer.unlocks}
              </p>
            </div>
            <ol className="space-y-2.5">
              {layer.steps.map((st, i) => (
                <li key={st.key} className="flex items-center gap-3 text-sm text-slate-brand-700">
                  <span className="w-6 h-6 rounded-full bg-slate-brand-100 flex items-center justify-center text-xs font-bold text-slate-brand-600">
                    {i + 1}
                  </span>
                  {st.title}
                </li>
              ))}
            </ol>
            <Link href={`/o/${token}/w?l=${layer.number}&s=0`} className="btn-primary px-8">
              Comenzar
            </Link>
          </div>
        ) : (
          <StepForm
            key={`${layer.number}-${stepIndex}`}
            token={token}
            layerNumber={layer.number}
            step={layer.steps[stepIndex]}
            stepIndex={stepIndex}
            totalSteps={layer.steps.length}
            initialData={JSON.parse(JSON.stringify(ctx.party.data))}
            taxIdLabel={ctx.tenant.taxIdLabel}
            backHref={
              stepIndex > 0
                ? `/o/${token}/w?l=${layer.number}&s=${stepIndex - 1}`
                : `/o/${token}/w?l=${layer.number}`
            }
          />
        )}
      </div>
    </main>
  );
}
