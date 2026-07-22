import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/session";
import { KluLogo } from "@/components/Logo";
import { getTenantRow, listTenants } from "@/lib/config-db";
import { logoutAction } from "../actions";
import CountrySwitcher from "./CountrySwitcher";

export default async function CountryPanelLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ country: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");

  const { country } = await params;
  const tenant = await getTenantRow(country);
  if (!tenant) notFound();

  const tenants = await listTenants();

  const navLink =
    "px-3 py-1.5 rounded-full text-forest-100 hover:bg-white/10 hover:text-white transition";

  return (
    <div className="flex-1 flex flex-col">
      <header className="bg-forest-950 text-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 min-w-0">
            <Link href="/admin" className="flex items-center gap-2.5 shrink-0">
              <KluLogo className="h-6 w-auto" wordmarkClassName="text-white" />
              <span className="text-sm font-semibold text-forest-100 border-l border-white/20 pl-2.5">
                Onboarding
              </span>
            </Link>
            <CountrySwitcher current={tenant} tenants={tenants} />
            <nav className="hidden md:flex gap-1 text-sm">
              <Link href={`/admin/${country}`} className={navLink}>
                Casos
              </Link>
              <Link href={`/admin/${country}/productos`} className={navLink}>
                Productos
              </Link>
              <Link href={`/admin/${country}/new`} className={navLink}>
                + Nuevo cliente
              </Link>
            </nav>
          </div>
          <form action={logoutAction}>
            <button className="text-sm text-forest-100/70 hover:text-white transition shrink-0">
              Salir
            </button>
          </form>
        </div>
        {/* Nav en mobile */}
        <nav className="md:hidden flex gap-1 text-sm px-6 pb-2.5 overflow-x-auto">
          <Link href={`/admin/${country}`} className={navLink}>
            Casos
          </Link>
          <Link href={`/admin/${country}/productos`} className={navLink}>
            Productos
          </Link>
          <Link href={`/admin/${country}/new`} className={navLink}>
            + Nuevo cliente
          </Link>
        </nav>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
