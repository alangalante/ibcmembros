"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { enablePushNotifications } from "@/lib/firebase/messaging";
import { useAuth } from "./auth-provider";
import { useOfflineData } from "./offline-data-provider";
import { PullToRefresh } from "./pull-to-refresh";
import { NavHeader } from "./nav-header";
import { MemberDetailModal } from "./member-detail-modal";
import { formatWhatsAppLink } from "@/lib/phone-auth";
import { todayIso } from "@/lib/agenda";

export function Dashboard() {
  const { user } = useAuth();
  const offline = useOfflineData();
  const [pushStatus, setPushStatus] = useState("");
  const [pushActivated, setPushActivated] = useState(false);

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedMemberUid, setSelectedMemberUid] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && typeof Notification !== "undefined" && Notification.permission === "granted" && user) {
      setPushActivated(true);
      enablePushNotifications(user.uid).catch(() => {});
    }
  }, [user]);

  if (!user) return null;
  const profile = offline.users.find((item) => item.id === user.uid);
  const groups = offline.groups.filter((item) => profile?.groupIds.includes(item.id));
  const userGroupIds = profile?.groupIds || [];
  const today = todayIso();
  const events = offline.events
    .filter((ev) => ev.eventDate === today && (ev.scope === "global" || (ev.groupIds || []).some((gId) => userGroupIds.includes(gId))))
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  const birthdays = offline.users.filter((person) => person.active && person.birthMonthDay === today.slice(5));

  const selectedGroup = offline.groups.find((g) => g.id === selectedGroupId);
  const groupMembers = selectedGroup
    ? selectedGroup.participantIds
        .map((id) => offline.users.find((u) => u.id === id))
        .filter((u): u is NonNullable<typeof u> => Boolean(u))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    : [];

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
              <p className="mt-1 text-xs text-emerald-100">Receba avisos de aniversários e agendas dos seus grupos.</p>
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
                  <article
                    key={group.id}
                    onClick={() => setSelectedGroupId(group.id)}
                    className="rounded-2xl bg-white p-4 shadow-2xs border border-slate-100 cursor-pointer hover:border-emerald-400 hover:shadow-xs transition-all"
                  >
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
            <h2 className="text-lg font-bold text-slate-900">Agenda do dia</h2>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {birthdays.map((person) => (
                <button type="button" onClick={() => setSelectedMemberUid(person.id)} key={`birthday-${person.id}`} className={`rounded-2xl border p-4 text-left shadow-2xs ${person.groupIds.some((id) => userGroupIds.includes(id)) ? "border-amber-300 bg-amber-50" : "border-slate-100 bg-white"}`}>
                  <p className="text-xs font-bold uppercase tracking-wide text-pink-700">🎂 Aniversário</p>
                  <h3 className="mt-1 font-semibold text-sm text-slate-900">{person.name}</h3>
                  {person.groupIds.some((id) => userGroupIds.includes(id)) && <p className="mt-1 text-[10px] font-bold text-amber-800">⭐ Pessoa do seu grupo</p>}
                </button>
              ))}
              {events.map((event) => (
                  <Link key={event.id} href={`/events/${event.id}`} className="block rounded-2xl bg-white p-4 shadow-2xs border border-slate-100 hover:border-emerald-300">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
                        {event.eventDate.split("-").reverse().join("/")}
                      </p>
                      <span className="text-xs font-semibold text-emerald-800">Detalhes →</span>
                    </div>
                    <h3 className="mt-1 font-semibold text-sm text-slate-900">{event.title}</h3>
                    <p className="mt-1 text-xs text-slate-600 line-clamp-2">{event.description}</p>
                    {event.pdfUrl && <span className="mt-2 inline-flex items-center rounded-full bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700" aria-label="Esta agenda possui PDF anexado">📎 PDF</span>}
                  </Link>
                ))}
              {!events.length && !birthdays.length && (
                <p className="col-span-full text-sm text-slate-500 rounded-2xl bg-white p-4 border border-slate-100">
                  Nenhum aniversário ou agenda para hoje.
                </p>
              )}
            </div>
          </section>
        </main>

        {/* Modal Detalhes do Grupo */}
        {selectedGroupId && selectedGroup && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl max-h-[90dvh] overflow-y-auto">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Grupo de Comunhão</span>
                  <h2 className="text-xl font-bold text-slate-900 mt-0.5">{selectedGroup.name}</h2>
                </div>
                <button onClick={() => setSelectedGroupId(null)} className="text-slate-400 hover:text-slate-600 font-bold text-lg p-1">✕</button>
              </div>

              {selectedGroup.description && (
                <p className="mt-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
                  {selectedGroup.description}
                </p>
              )}

              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Participantes ({groupMembers.length})
                  </h3>
                  <span className="text-[11px] text-slate-400">Toque para ver perfil</span>
                </div>

                <div className="mt-2.5 space-y-2 max-h-60 overflow-y-auto pr-1">
                  {groupMembers.length ? (
                    groupMembers.map((member) => {
                      const isLeader = selectedGroup.leaderIds.includes(member.id);
                      return (
                        <div
                          key={member.id}
                          onClick={() => setSelectedMemberUid(member.id)}
                          className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-100 cursor-pointer hover:bg-emerald-50/60 hover:border-emerald-300 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            {member.photoUrl ? (
                              <Image
                                src={member.photoUrl}
                                alt={member.name}
                                width={36}
                                height={36}
                                className="size-9 rounded-full object-cover border border-slate-200"
                              />
                            ) : (
                              <div className="grid size-9 place-items-center rounded-full bg-emerald-100 font-bold text-emerald-800 text-xs shadow-2xs">
                                {member.name.substring(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="text-xs font-bold text-slate-900">{member.name}</p>
                              <span className={`text-[10px] font-bold ${isLeader ? "text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-md" : "text-slate-500"}`}>
                                {isLeader ? "⭐ Líder do Grupo" : member.type === "member" ? "Membro" : "Frequentador"}
                              </span>
                            </div>
                          </div>

                          {member.phoneE164 && (
                            <a
                              href={formatWhatsAppLink(member.phoneE164)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-emerald-700"
                            >
                              💬 WhatsApp
                            </a>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-400 italic">Nenhum participante vinculado a este grupo.</p>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedGroupId(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Perfil do Membro Selecionado */}
        <MemberDetailModal
          userId={selectedMemberUid}
          onClose={() => setSelectedMemberUid(null)}
        />
      </div>
    </PullToRefresh>
  );
}
