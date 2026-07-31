"use client";

import { signOut } from "firebase/auth";
import { useState } from "react";
import { auth } from "@/lib/firebase/client";
import { disablePushNotifications, enablePushNotifications } from "@/lib/firebase/messaging";
import { useAuth } from "./auth-provider";
import { useOfflineData } from "./offline-data-provider";
import { deleteUserCache } from "@/lib/offline/db";

export function Dashboard() {
  const { user } = useAuth();
  const offline = useOfflineData();
  const [pushStatus, setPushStatus] = useState("");

  if (!user) return null;
  const profile = offline.users.find((item) => item.id === user.uid);
  const groups = offline.groups.filter((item) => profile?.groupIds.includes(item.id));
  const events = offline.events.slice().sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  async function activatePush() {
    try { setPushStatus("Ativando…"); await enablePushNotifications(user!.uid); setPushStatus("Notificações ativadas"); }
    catch (error) { setPushStatus(error instanceof Error ? error.message : "Falha ao ativar"); }
  }
  async function logout() {
    try { await disablePushNotifications(user!.uid); } catch { /* O logout não pode ficar bloqueado por falha de rede. */ }
    await deleteUserCache(user!.uid);
    await signOut(auth);
  }

  return <main className="mx-auto min-h-dvh max-w-lg px-4 pb-24 pt-6">
    <header className="flex items-center justify-between">
      <div><p className="text-sm text-emerald-800">Olá,</p><h1 className="text-2xl font-bold">{profile?.name ?? user.email}</h1></div>
      <button onClick={logout} className="rounded-lg border border-emerald-900/15 px-3 py-2 text-sm">Sair</button>
    </header>
    <div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>{offline.status === "offline" ? "Modo offline" : offline.status === "ready" ? "Dados atualizados" : "Sincronizando…"}</span><button onClick={offline.refresh} className="font-semibold text-emerald-800">Atualizar</button></div>

    <section className="mt-6 rounded-2xl bg-emerald-800 p-5 text-white shadow-sm">
      <p className="font-semibold">Não perca nenhuma celebração</p>
      <p className="mt-1 text-sm text-emerald-50">Receba aniversários e eventos dos seus grupos.</p>
      <button onClick={activatePush} className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-bold text-emerald-900">Ativar notificações</button>
      {pushStatus && <p className="mt-2 text-xs">{pushStatus}</p>}
    </section>

    <section className="mt-7"><h2 className="text-lg font-bold">Meus grupos</h2><div className="mt-3 grid grid-cols-2 gap-3">
      {groups.length ? groups.map((group) => <article key={group.id} className="rounded-2xl bg-white p-4 shadow-sm"><span className="text-2xl">🤝</span><h3 className="mt-3 font-semibold">{group.name}</h3><p className="mt-1 text-xs text-emerald-800">{group.participantIds.length} participantes</p></article>) : <p className="col-span-2 text-sm text-slate-500">Nenhum grupo vinculado.</p>}
    </div></section>

    <section className="mt-7"><h2 className="text-lg font-bold">Próximos eventos</h2><div className="mt-3 space-y-3">
      {events.length ? events.map((event) => <article key={event.id} className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-amber-700">{event.eventDate.split("-").reverse().join("/")}</p><h3 className="mt-1 font-semibold">{event.title}</h3><p className="mt-1 text-sm text-slate-600">{event.description}</p></article>) : <p className="text-sm text-slate-500">Nenhum evento futuro.</p>}
    </div></section>
  </main>;
}
