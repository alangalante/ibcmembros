"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { disablePushNotifications } from "@/lib/firebase/messaging";
import { deleteUserCache } from "@/lib/offline/db";
import { useAuth } from "./auth-provider";
import { useOfflineData } from "./offline-data-provider";

export function NavHeader() {
  const { user } = useAuth();
  const offline = useOfflineData();
  const pathname = usePathname();

  if (!user) return null;
  const profile = offline.users.find((item) => item.id === user.uid);
  const isAdmin = profile?.role === "admin";
  const isLeader = profile?.role === "leader";
  const canManageEvents = isAdmin || isLeader;

  async function logout() {
    try { await disablePushNotifications(user!.uid); } catch { /* Ignora se estiver offline */ }
    await deleteUserCache(user!.uid);
    await signOut(auth);
  }

  const navItems = [
    { label: "Início", href: "/" },
    { label: "Aniversários", href: "/birthdays" },
    ...(isAdmin ? [{ label: "Membros", href: "/admin/users" }] : []),
    ...(isAdmin ? [{ label: "Grupos", href: "/admin/groups" }] : []),
    ...(canManageEvents ? [{ label: "Eventos", href: "/admin/events" }] : []),
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-emerald-900/10 bg-white/95 backdrop-blur-md">
      <div className="mx-auto max-w-lg px-4 py-3">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-xl bg-emerald-800 font-bold text-white shadow-sm">
              ✝
            </div>
            <div>
              <p className="text-xs font-semibold leading-none text-emerald-950">IBC Membros</p>
              <p className="text-[10px] text-emerald-700">{profile?.name ?? user.email}</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <span className={`size-2.5 rounded-full ${offline.status === "ready" ? "bg-emerald-500" : offline.status === "syncing" ? "animate-pulse bg-amber-500" : "bg-slate-400"}`} title={offline.status} />
            <button
              onClick={logout}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 active:bg-slate-100"
            >
              Sair
            </button>
          </div>
        </div>

        <nav className="mt-3 flex overflow-x-auto gap-1 border-t border-slate-100 pt-2 no-scrollbar">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? "bg-emerald-800 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 active:bg-slate-200"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
