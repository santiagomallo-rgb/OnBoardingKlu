import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Cliente con service_role: SOLO usar del lado del servidor (server
// components, server actions, route handlers). RLS niega todo a anon,
// así que todo acceso a datos pasa por acá.

let cached: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en las variables de entorno."
    );
  }
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}
