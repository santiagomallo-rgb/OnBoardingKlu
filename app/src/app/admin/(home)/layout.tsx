import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/session";
import { KluLogo } from "@/components/Logo";
import { logoutAction } from "../actions";

export default async function AdminHomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAdmin())) redirect("/admin/login");

  return (
    <div className="flex-1 flex flex-col">
      <header className="bg-forest-950 text-white">
        <div className="max-w-5xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2.5">
            <KluLogo className="h-6 w-auto" wordmarkClassName="text-white" />
            <span className="text-sm font-semibold text-forest-100 border-l border-white/20 pl-2.5">
              Onboarding
            </span>
          </Link>
          <form action={logoutAction}>
            <button className="text-sm text-forest-100/70 hover:text-white transition">Salir</button>
          </form>
        </div>
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10">{children}</main>
    </div>
  );
}
