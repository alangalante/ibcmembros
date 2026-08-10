"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { NavHeader } from "@/components/nav-header";
import { useAuth } from "@/components/auth-provider";
import { useOfflineData } from "@/components/offline-data-provider";
import { formatAgendaDate, todayIso } from "@/lib/agenda";

export default function AgendaPage() {
  const { user } = useAuth();
  const offline = useOfflineData();
  const currentMonth = todayIso().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const profile = offline.users.find((item) => item.id === user?.uid);
  const items = useMemo(() => {
    const groupIds = profile?.groupIds || [];
    const birthdays = offline.users.filter((person) => person.active).map((person) => ({ id: `birthday-${person.id}`, date: `${month}-${person.birthMonthDay.slice(3)}`, title: person.name, kind: "birthday" as const }));
    const events = offline.events.filter((event) => event.eventDate.startsWith(month) && (event.scope === "global" || event.groupIds.some((id) => groupIds.includes(id)))).map((event) => ({ id: event.id, date: event.eventDate, title: event.title, kind: "agenda" as const, pdfUrl: event.pdfUrl }));
    return [...birthdays, ...events].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "pt-BR"));
  }, [month, offline.events, offline.users, profile?.groupIds]);
  return <div className="min-h-dvh bg-slate-50 pb-20 text-slate-900"><NavHeader /><main className="mx-auto max-w-4xl px-4 pt-6">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold">Agenda mensal</h1><p className="text-xs text-slate-500">Aniversários e agendas permitidas para você.</p></div><label className="text-xs font-bold text-slate-700">Mês e ano<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 bg-white p-2.5 text-sm" /></label></div>
    <div className="mt-6 space-y-3">{items.map((item) => <article key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-xs"><div><p className="text-[11px] font-bold capitalize text-emerald-800">{formatAgendaDate(item.date)}</p><h2 className="text-sm font-bold">{item.kind === "birthday" ? "🎂" : "📅"} {item.title}</h2></div>{item.kind === "agenda" && <div className="flex gap-2">{item.pdfUrl && <a href={item.pdfUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-rose-700">Ver PDF</a>}<Link href={`/events/${item.id}`} className="text-xs font-bold text-emerald-800">Detalhes →</Link></div>}</article>)}{!items.length && <p className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">Nenhum item neste mês.</p>}</div>
  </main></div>;
}
