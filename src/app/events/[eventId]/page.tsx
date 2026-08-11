"use client";

import Link from "next/link";
import { use } from "react";
import { NavHeader } from "@/components/nav-header";
import { useOfflineData } from "@/components/offline-data-provider";

export default function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  const offline = useOfflineData();

  const event = offline.events.find((item) => item.id === eventId);
  const groups = offline.groups.filter((group) => event?.groupIds?.includes(group.id));
  const eventTime = event?.startsAt ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(event.startsAt)) : null;

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 pb-20">
      <NavHeader />
      <main className="mx-auto max-w-lg px-4 pt-6">
        <Link href="/" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:underline mb-4">
          ← Voltar para Início
        </Link>

        {event ? (
          <article className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between gap-2">
              <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${event.scope === "global" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                {event.scope === "global" ? "Agenda Global" : "Agenda Restrita"}
              </span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {event.eventDate.split("-").reverse().join("/")}
              </span>
            </div>

            <h1 className="mt-4 text-2xl font-bold text-slate-900">{event.title}</h1>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase text-slate-500">Data</p><p className="mt-1 text-sm font-semibold">{event.eventDate.split("-").reverse().join("/")}</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase text-slate-500">Horário</p><p className="mt-1 text-sm font-semibold">{eventTime || "Não informado"}</p></div>
            </div>

            <p className="mt-3 text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              {event.description || "Sem descrição informada."}
            </p>

            {event.pdfUrl && <a href={event.pdfUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex rounded-xl bg-rose-700 px-4 py-2 text-xs font-bold text-white hover:bg-rose-800">Visualizar PDF</a>}

            {event.scope === "groups" && (
              <div className="mt-6 border-t border-slate-100 pt-4">
                <h2 className="text-xs font-bold text-slate-500 uppercase">Grupos vinculados</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {groups.length ? (
                    groups.map((group) => (
                      <span key={group.id} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800">
                        👥 {group.name}
                      </span>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400">Nenhum grupo localizado.</p>
                  )}
                </div>
              </div>
            )}
          </article>
        ) : (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-slate-500">
              {offline.status === "syncing" ? "Carregando detalhes da agenda…" : "Agenda não localizada ou você não possui permissão para acessá-la."}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
