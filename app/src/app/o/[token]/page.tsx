import { redirect } from "next/navigation";
import { db } from "@/lib/supabase";
import { hasInviteSession } from "@/lib/session";
import { logEvent } from "@/lib/onboarding";
import { KluLogo } from "@/components/Logo";
import { loadInviteContext, inviteUsable } from "./shared";
import GateForm from "./GateForm";

export const dynamic = "force-dynamic";

export default async function InviteGatePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const ctx = await loadInviteContext(token);

  if (!ctx) {
    return (
      <main className="flex-1 flex items-center justify-center p-8 bg-forest-950 text-white">
        <div className="max-w-md text-center space-y-3">
          <KluLogo className="h-9 w-auto mx-auto mb-4" wordmarkClassName="text-white" />
          <h1 className="text-2xl font-extrabold">Link inválido</h1>
          <p className="text-forest-100">
            Esta invitación no existe. Revisá que el link esté completo o pedí uno nuevo.
          </p>
        </div>
      </main>
    );
  }

  if (await hasInviteSession(token)) {
    redirect(`/o/${token}/w`);
  }

  const usable = inviteUsable(ctx.invite);

  if (usable.ok && ["created", "sent"].includes(ctx.invite.status)) {
    await db().from("invites").update({ status: "opened" }).eq("id", ctx.invite.id);
    await logEvent(ctx.caseRow.id, "invite_opened", {}, "client");
  }

  return (
    <main className="flex-1 grid lg:grid-cols-2">
      {/* Panel de marca */}
      <section className="relative overflow-hidden bg-forest-950 text-white px-8 py-12 lg:px-14 lg:py-16 flex flex-col">
        <div
          className="absolute inset-0 opacity-80"
          style={{ background: "radial-gradient(130% 100% at 20% 0%, #0b5752 0%, #0b3c36 50%, #0a2d27 100%)" }}
        />
        <div className="absolute -left-20 bottom-10 h-72 w-72 rounded-full bg-citrus-500/20 blur-3xl" />
        <div className="relative flex flex-col h-full">
          <KluLogo className="h-8 w-auto" wordmarkClassName="text-white" />
          <div className="flex-1 flex flex-col justify-center py-12 max-w-md">
            <p className="eyebrow text-citrus-300">{ctx.tenant.name}</p>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight">{ctx.tenant.welcome.title}</h1>
            <p className="mt-5 text-forest-100 leading-relaxed">{ctx.tenant.welcome.body}</p>
          </div>
          <div className="relative grid gap-3">
            {ctx.tenant.productPitch.map((p) => (
              <div key={p.title} className="rounded-2xl bg-white/10 backdrop-blur border border-white/10 p-4">
                <p className="font-bold text-sm text-citrus-300">{p.title}</p>
                <p className="text-xs text-forest-100 mt-1 leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gate */}
      <section className="flex items-center justify-center p-6 lg:p-12 bg-background">
        <div className="w-full max-w-md">
          {usable.ok ? (
            <GateForm
              token={token}
              taxIdLabel={ctx.tenant.taxIdLabel}
              taxIdPlaceholder={ctx.tenant.taxIdPlaceholder}
              taxIdHelp={ctx.tenant.taxIdHelp}
              productName={ctx.product?.name ?? "tu cuenta"}
            />
          ) : (
            <div className="card p-6 text-center border-red-200">
              <p className="text-red-700 font-medium">{usable.reason}</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
