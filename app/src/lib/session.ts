import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

// Sesiones stateless con HMAC: una cookie para el admin y una por invitación
// verificada (el cliente que pasó el gate del CUIT/RFC).

const ADMIN_COOKIE = "klu_admin";
const INVITE_COOKIE_PREFIX = "klu_inv_";
const ADMIN_TTL_MS = 1000 * 60 * 60 * 12; // 12 h
const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 días

function secret(): string {
  const s = process.env.APP_SECRET;
  if (!s) throw new Error("Falta APP_SECRET en las variables de entorno.");
  return s;
}

function sign(payload: string): string {
  const mac = createHmac("sha256", secret()).update(payload).digest("hex");
  return `${Buffer.from(payload).toString("base64url")}.${mac}`;
}

function verify(token: string | undefined): string | null {
  if (!token) return null;
  const [b64, mac] = token.split(".");
  if (!b64 || !mac) return null;
  const payload = Buffer.from(b64, "base64url").toString();
  const expected = createHmac("sha256", secret()).update(payload).digest("hex");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return payload;
}

function parseExp(payload: string | null): Record<string, unknown> | null {
  if (!payload) return null;
  try {
    const obj = JSON.parse(payload) as Record<string, unknown>;
    if (typeof obj.exp !== "number" || obj.exp < Date.now()) return null;
    return obj;
  } catch {
    return null;
  }
}

// ── Admin ────────────────────────────────────────────────────────────────

export async function createAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, sign(JSON.stringify({ role: "admin", exp: Date.now() + ADMIN_TTL_MS })), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_TTL_MS / 1000,
  });
}

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  const obj = parseExp(verify(jar.get(ADMIN_COOKIE)?.value));
  return obj?.role === "admin";
}

export async function destroyAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
}

export function checkAdminPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ── Invitación verificada (pasó el gate del tax id) ─────────────────────

export async function createInviteSession(inviteToken: string): Promise<void> {
  const jar = await cookies();
  jar.set(
    INVITE_COOKIE_PREFIX + inviteToken.slice(0, 12),
    sign(JSON.stringify({ inv: inviteToken, exp: Date.now() + INVITE_TTL_MS })),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: INVITE_TTL_MS / 1000,
    }
  );
}

export async function hasInviteSession(inviteToken: string): Promise<boolean> {
  const jar = await cookies();
  const obj = parseExp(verify(jar.get(INVITE_COOKIE_PREFIX + inviteToken.slice(0, 12))?.value));
  return obj?.inv === inviteToken;
}

export function newInviteToken(): string {
  return randomBytes(24).toString("hex");
}
