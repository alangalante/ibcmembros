"use client";

import { useState } from "react";
import { enablePushNotifications } from "@/lib/firebase/messaging";
import { useAuth } from "./auth-provider";
import { useOfflineData } from "./offline-data-provider";
import { getCleanDisplayName } from "@/lib/phone-auth";
import Link from "next/link";
import { NavHeader } from "./nav-header";


export function Dashboard() {
  const { user } = useAuth();
  const offline = useOfflineData();
  const [pushStatus, setPushStatus] = useState("");

  if (!user) return null;
  const profile = offline.users.find((item) => item.id === user.uid);
  const groups = offline.groups.filter((item) => profile?.groupIds.includes(item.id));
  const events = offline.events.slice().sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  const displayName = getCleanDisplayName(profile?.name, user);

  async function activatePush() {
    try { setPushStatus("Ativando…"); await enablePushNotifications(user!.uid); setPushStatus("Notificações ativadas"); }
    catch (error) { setPushStatus(error instanceof Error ? error.message : "Falha ao ativar"); }
  }

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 pb-24">
      <NavHeader />
      <main className="mx-auto max-w-lg px-4 pt-6">
        <div className="flex items-center justify-between">
          <div><p className="text-xs text-emerald-800 font-semibold">Bem-vindo(a),</p><h1 className="text-2xl font-bold">{displayName}</h1></div>
          <button onClick={offline.refresh} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-800 shadow-2xs">
            {offline.status === "syncing" ? "Sincronizando…" : "Atualizar"}
          </button>
        </div>

        <section className="mt-6 rounded-2xl bg-emerald-800 p-5 text-white shadow-xs">
          <p className="font-semibold">Não perca nenhuma celebração</p>
          <p className="mt-1 text-xs text-emerald-100">Receba avisos de aniversários e eventos dos seus grupos.</p>
          <button onClick={activatePush} className="mt-4 rounded-xl bg-white px-4 py-2 text-xs font-bold text-emerald-950 shadow-sm active:bg-slate-100">
            Ativar notificações
          </button>
          {pushStatus && <p className="mt-2 text-xs text-emerald-200">{pushStatus}</p>}
        </section>

        <section className="mt-7">
          <h2 className="text-lg font-bold">Meus grupos</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {groups.length ? (
              groups.map((group) => (
                <article key={group.id} className="rounded-2xl bg-white p-4 shadow-2xs border border-slate-100">
                  <span className="text-2xl">🤝</span>
                  <h3 className="mt-2 font-semibold text-sm">{group.name}</h3>
                  <p className="mt-1 text-xs text-emerald-800 font-medium">{group.participantIds.length} participantes</p>
                </article>
              ))
            ) : (
              <p className="col-span-2 text-sm text-slate-500">Nenhum grupo vinculado ao seu perfil.</p>
            )}
          </div>
        </section>

        <section className="mt-7">
          <h2 className="text-lg font-bold">Próximos eventos</h2>
          <div className="mt-3 space-y-3">
            {events.length ? (
              events.map((event) => (
                <article key={event.id} className="rounded-2xl bg-white p-4 shadow-2xs border border-slate-100">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
                      {event.eventDate.split("-").reverse().join("/")}
                    </p>
                    <Link href={`/events/${event.id}`} className="text-xs font-semibold text-emerald-800 hover:underline">
                      Detalhes →
                    </Link>
                  </div>
                  <h3 className="mt-1 font-semibold text-sm">{event.title}</h3>
                  <p className="mt-1 text-xs text-slate-600 line-clamp-2">{event.description}</p>
                </article>
              ))
            ) : (
              <p className="text-sm text-slate-500">Nenhum evento agendado.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

