import { Resend } from "resend";
import type { TenantConfig } from "@/config/types";

// Envío de mails con Resend. Si RESEND_API_KEY no está configurada, el envío
// se saltea con gracia (la invitación queda creada y el link se puede copiar
// desde el panel admin).

export function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

export interface SendInviteResult {
  sent: boolean;
  error?: string;
}

export async function sendInviteEmail(opts: {
  tenant: TenantConfig;
  to: string;
  displayName: string | null;
  productName: string;
  inviteToken: string;
}): Promise<SendInviteResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const link = `${baseUrl()}/o/${opts.inviteToken}`;
  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY no configurada. Invitación sin enviar: ${link}`);
    return { sent: false, error: "RESEND_API_KEY no configurada" };
  }

  const resend = new Resend(apiKey);
  const from = process.env.EMAIL_FROM || "onboarding@resend.dev";
  const saludo = opts.displayName ? `Hola ${opts.displayName},` : "Hola,";

  const { error } = await resend.emails.send({
    from,
    to: opts.to,
    subject: `${opts.tenant.name} — Completá tu alta de ${opts.productName}`,
    html: `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1a2e;">
        <h2 style="color: #1d4ed8; margin-bottom: 4px;">${opts.tenant.name}</h2>
        <p style="font-size: 15px;">${saludo}</p>
        <p style="font-size: 15px; line-height: 1.6;">
          Te invitamos a completar el alta de <strong>${opts.productName}</strong>.
          Es un proceso guiado, paso a paso, y podés retomarlo cuando quieras desde el mismo link.
        </p>
        <p style="margin: 28px 0;">
          <a href="${link}" style="background: #1d4ed8; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Comenzar mi alta
          </a>
        </p>
        <p style="font-size: 13px; color: #555; line-height: 1.6;">
          Por tu seguridad, al abrir el link te vamos a pedir tu <strong>${opts.tenant.taxIdLabel}</strong> para verificar tu identidad.
          Si no esperabas este correo, podés ignorarlo.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="font-size: 12px; color: #999;">${opts.tenant.name} · Onboarding digital</p>
      </div>
    `,
  });

  if (error) {
    console.error("[email] Error de Resend:", error);
    return { sent: false, error: error.message };
  }
  return { sent: true };
}
