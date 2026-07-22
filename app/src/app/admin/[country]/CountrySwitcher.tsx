"use client";

import { useRouter } from "next/navigation";
import type { TenantRow } from "@/lib/types";

/** Cambiar de país sin volver al selector: mantiene la sección si se puede. */
export default function CountrySwitcher({
  current,
  tenants,
}: {
  current: TenantRow;
  tenants: TenantRow[];
}) {
  const router = useRouter();

  return (
    <label className="relative shrink-0">
      <span className="sr-only">Cambiar de país</span>
      <select
        value={current.slug}
        onChange={(e) => {
          const v = e.target.value;
          router.push(v === "__all" ? "/admin" : `/admin/${v}`);
        }}
        className="appearance-none bg-white/10 hover:bg-white/15 text-white text-sm font-semibold rounded-full pl-3 pr-8 py-1.5 cursor-pointer transition border border-white/15 focus:outline-none focus:ring-2 focus:ring-citrus-500/50"
      >
        {tenants.map((t) => (
          <option key={t.slug} value={t.slug} className="text-forest-950">
            {t.flag ?? "🌎"} {t.name}
          </option>
        ))}
        <option value="__all" className="text-forest-950">
          ← Todos los países
        </option>
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/60 text-xs">
        ▾
      </span>
    </label>
  );
}
