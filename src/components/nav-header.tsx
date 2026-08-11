"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { disablePushNotifications } from "@/lib/firebase/messaging";
import { deleteUserCache } from "@/lib/offline/db";
import { getCleanDisplayName } from "@/lib/phone-auth";
import { useAuth } from "./auth-provider";
import { useOfflineData } from "./offline-data-provider";

export function NavHeader() {
  const { user } = useAuth();
  const offline = useOfflineData();
  const pathname = usePathname();

  if (!user) return null;
  const profile = offline.users.find((item) => item.id === user.uid);
  const isAdmin = profile?.role === "admin";
  const isLeader = profile?.role === "leader" || offline.groups.some((group) => group.leaderIds.includes(user.uid));
  const canManageEvents = isAdmin || isLeader;

  const displayName = getCleanDisplayName(profile?.name, user);

  async function logout() {
    try { await disablePushNotifications(user!.uid); } catch { /* Ignora se estiver offline */ }
    await deleteUserCache(user!.uid);
    await signOut(auth);
  }

  const navItems = [
    { label: "Início", href: "/", icon: "⌂" },
    { label: "Agenda", href: "/agenda", icon: "▣" },
    { label: "Membros", href: "/members", icon: "♙" },
    ...(isAdmin || isLeader ? [{ label: "Grupos", href: "/admin/groups", icon: "♧" }] : []),
    ...(canManageEvents ? [{ label: "Gestão", href: "/admin/events", icon: "⚙" }] : []),
  ];


  return (
    <>
      <header className="sticky top-0 z-30 border-b border-emerald-900/10 bg-white/95 backdrop-blur-md">
        <div className="mx-auto max-w-lg px-4 py-3 md:max-w-4xl lg:max-w-6xl">

        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/logo.jpg"
              alt="Logo IBC"
              width={36}
              height={36}
              className="size-9 rounded-xl object-cover shadow-2xs border border-emerald-900/15"
            />
            <div>
              <p className="text-xs font-bold leading-none text-emerald-950">IBC Membros</p>
              <p className="mt-0.5 text-[10px] font-semibold text-emerald-700">{displayName}</p>
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

        </div>
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2">
          {navItems.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-semibold transition-colors ${
                  active
                    ? "text-emerald-800"
                    : "text-slate-500 hover:text-slate-800 active:bg-slate-100"
                }`}
              >
                <span className={`grid size-7 place-items-center rounded-xl text-lg leading-none ${active ? "bg-emerald-100" : ""}`} aria-hidden="true">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
