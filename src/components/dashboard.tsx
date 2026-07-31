"use client";

import { useEffect, useState } from "react";
import { enablePushNotifications } from "@/lib/firebase/messaging";
import { useAuth } from "./auth-provider";
import { useOfflineData } from "./offline-data-provider";
import { PullToRefresh } from "./pull-to-refresh";
import Link from "next/link";
import { NavHeader } from "./nav-header";

export function Dashboard() {
  const { user } = useAuth();
  const offline = useOfflineData();
  const [pushStatus, setPushStatus] = useState("");
  const [pushActivated, setPushActivated] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && typeof Notification !== "undefined" && Notification.permission === "granted") {
      setPushActivated(true);
    }
  }, []);

  if (!user) return null;
  const profile = offline.users.find((item) => item.id === user.uid);
  const groups = offline.groups.filter((item) => profile?.groupIds.includes(item.id));
  const userGroupIds = profile?.groupIds || [];
  const events = offline.events
    .filter((ev) => ev.scope === "global" || (ev.groupIds || []).some((gId) => userGroupIds.includes(gId)))
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate));



  async function activatePush() {
    try {
      setPushStatus("Ativando…");
      await enablePushNotifications(user!.uid);
      setPushStatus("Notificações ativadas com sucesso!");
      setTimeout(() => setPushActivated(true), 1500);
    } catch (error) {
      setPushStatus(error instanceof Error ? error.message : "Falha ao ativar");
    }
  }

  return (
    <PullToRefresh onRefresh={offline.refresh}>
      <div className="min-h-dvh bg-slate-50 text-slate-900 pb-24">
        <NavHeader />
        <main className="mx-auto max-w-lg md:max-w-4xl lg:max-w-6xl px-4 pt-4">
          {!pushActivated && (
            <section className="mt-2 rounded-2xl bg-emerald-800 p-5 text-white shadow-xs">
              <p className="font-semibold">Não perca nenhuma celebração</p>
              <p className="mt-1 text-xs text-emerald-100">Receba avisos de aniversários e eventos dos seus grupos.</p>
              <button onClick={activatePush} className="mt-4 rounded-xl bg-white px-4 py-2 text-xs font-bold text-emerald-950 shadow-sm active:bg-slate-100">
                Ativar notificações
              </button>
              {pushStatus && <p className="mt-2 text-xs text-emerald-200 font-medium">{pushStatus}</p>}
            </section>
          )}

          <section className="mt-5">
            <h2 className="text-lg font-bold text-slate-900">Meus grupos</h2>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {groups.length ? (
                groups.map((group) => (
                  <article key={group.id} className="rounded-2xl bg-white p-4 shadow-2xs border border-slate-100">
                    <span className="text-2xl">🤝</span>
                    <h3 className="mt-2 font-semibold text-sm text-slate-900">{group.name}</h3>
                    <p className="mt-1 text-xs text-emerald-800 font-bold">{group.participantIds.length} participantes</p>
                  </article>
                ))
              ) : (
                <p className="col-span-full text-sm text-slate-500 rounded-2xl bg-white p-4 border border-slate-100">
                  Nenhum grupo vinculado ao seu perfil no momento.
                </p>
              )}
            </div>
          </section>

          <section className="mt-7">
            <h2 className="text-lg font-bold text-slate-900">Próximos eventos</h2>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                    <h3 className="mt-1 font-semibold text-sm text-slate-900">{event.title}</h3>
                    <p className="mt-1 text-xs text-slate-600 line-clamp-2">{event.description}</p>
                  </article>
                ))
              ) : (
                <p className="col-span-full text-sm text-slate-500 rounded-2xl bg-white p-4 border border-slate-100">
                  Nenhum evento agendado no momento.
                </p>
              )}
            </div>
          </section>
        </main>

      </div>
    </PullToRefresh>
  );
}
