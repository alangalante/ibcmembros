"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { NavHeader } from "@/components/nav-header";
import { MemberDetailModal } from "@/components/member-detail-modal";
import { useAuth } from "@/components/auth-provider";
import { useOfflineData } from "@/components/offline-data-provider";
import { birthdayDate, formatAgendaDate, todayIso, weekBounds } from "@/lib/agenda";

type ViewMode = "week" | "month";

export default function AgendaPage() {
  const { user } = useAuth();
  const offline = useOfflineData();
  const today = todayIso();
  const [mode, setMode] = useState<ViewMode>("week");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const profile = offline.users.find((item) => item.id === user?.uid);
  const groupIds = profile?.groupIds || [];
  const visibleEvents = offline.events.filter((event) => event.scope === "global" || event.groupIds.some((id) => groupIds.includes(id)));
  const { start, end } = weekBounds(today);
  const weekYear = Number(start.slice(0, 4));

  const weekBirthdays = offline.users.flatMap((person) => {
    const date = [birthdayDate(person.birthMonthDay, weekYear), birthdayDate(person.birthMonthDay, weekYear + 1)].find((value) => value >= start && value <= end);
    return person.active && date ? [{ person, date }] : [];
  });
  const days = Array.from({ length: 8 }, (_, index) => {
    const date = new Date(`${start}T12:00:00`); date.setDate(date.getDate() + index); return date.toISOString().slice(0, 10);
  });

  const monthItems = useMemo(() => {
    const birthdays = offline.users.filter((person) => person.active).map((person) => ({ id: `birthday-${person.id}`, userId: person.id, date: `${month}-${person.birthMonthDay.slice(3)}`, title: person.name, kind: "birthday" as const }));
    const agendas = visibleEvents.filter((event) => event.eventDate.startsWith(month)).map((event) => ({ id: event.id, date: event.eventDate, title: event.title, kind: "agenda" as const, pdfUrl: event.pdfUrl }));
    return [...birthdays, ...agendas].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "pt-BR"));
  }, [month, offline.users, visibleEvents]);

  return <div className="min-h-dvh bg-slate-50 pb-24 text-slate-900">
    <NavHeader />
    <main className="mx-auto max-w-6xl px-4 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-2xl font-bold">Agenda</h1><p className="text-xs text-slate-500">Aniversários e agendas disponíveis para você.</p></div>
        <div className="flex rounded-xl bg-slate-200 p-1" role="tablist" aria-label="Visualização da agenda">
          <button onClick={() => setMode("week")} className={`rounded-lg px-4 py-2 text-xs font-bold ${mode === "week" ? "bg-white text-emerald-900 shadow-xs" : "text-slate-600"}`}>Semana</button>
          <button onClick={() => setMode("month")} className={`rounded-lg px-4 py-2 text-xs font-bold ${mode === "month" ? "bg-white text-emerald-900 shadow-xs" : "text-slate-600"}`}>Por mês</button>
        </div>
      </div>

      {mode === "week" ? <>
        <p className="mt-4 text-sm text-slate-500">De {start.split("-").reverse().join("/")} a {end.split("-").reverse().join("/")}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {days.map((date) => {
            const birthdays = weekBirthdays.filter((item) => item.date === date);
            const agendas = visibleEvents.filter((item) => item.eventDate === date);
            const passed = date < today;
            return <section key={date} className={`rounded-2xl border bg-white p-4 shadow-xs ${passed ? "opacity-45 grayscale" : date === today ? "border-emerald-500 ring-2 ring-emerald-100" : "border-slate-100"}`}>
              <div className="flex items-center justify-between"><h2 className="font-bold capitalize">{formatAgendaDate(date)}</h2>{passed && <span className="text-[10px] font-bold uppercase text-slate-500">Já passou</span>}</div>
              <div className="mt-3 space-y-2">
                {birthdays.map(({ person }) => { const sameGroup = person.groupIds.some((id) => groupIds.includes(id)); return <button key={person.id} onClick={() => setSelectedUid(person.id)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${sameGroup ? "border-amber-300 bg-amber-50 ring-1 ring-amber-200" : "border-slate-100 bg-slate-50"}`}>{person.photoUrl ? <Image src={person.photoUrl} alt="" width={36} height={36} className="size-9 rounded-full object-cover" /> : <span className="grid size-9 place-items-center rounded-full bg-pink-100">🎂</span>}<span><span className="block text-xs font-bold">{person.name}</span><span className="text-[10px] text-slate-500">Aniversário{sameGroup ? " · Do seu grupo ⭐" : ""}</span></span></button>; })}
                {agendas.map((event) => <Link key={event.id} href={`/events/${event.id}`} className="block rounded-xl border border-emerald-100 bg-emerald-50 p-3"><span className="block text-xs font-bold text-emerald-950">📅 {event.title}</span><span className="text-[10px] text-emerald-800">{event.scope === "global" ? "Agenda global" : "Agenda do seu grupo"}</span></Link>)}
                {!birthdays.length && !agendas.length && <p className="py-3 text-center text-xs text-slate-400">Nada agendado.</p>}
              </div>
            </section>;
          })}
        </div>
      </> : <>
        <label className="mt-5 block w-fit text-xs font-bold text-slate-700">Escolha o mês<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="mt-1 block rounded-xl border border-slate-200 bg-white p-2.5 text-sm" /></label>
        <div className="mt-5 space-y-3">{monthItems.map((item) => { const passed = item.date < today; return <article key={item.id} className={`flex items-center justify-between gap-3 rounded-2xl border p-4 shadow-xs ${passed ? "border-slate-200 bg-slate-100 opacity-50 grayscale" : "border-slate-100 bg-white"}`}><button onClick={() => item.kind === "birthday" && setSelectedUid(item.userId)} className="text-left"><div className="flex items-center gap-2"><p className={`text-[11px] font-bold capitalize ${passed ? "text-slate-500" : "text-emerald-800"}`}>{formatAgendaDate(item.date)}</p>{passed && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-600">Já passou</span>}</div><h2 className="text-sm font-bold">{item.kind === "birthday" ? "🎂" : "📅"} {item.title}</h2></button>{item.kind === "agenda" && <div className="flex gap-2">{item.pdfUrl && <a href={item.pdfUrl} target="_blank" rel="noreferrer" className={`text-xs font-bold ${passed ? "text-slate-600" : "text-rose-700"}`}>Ver PDF</a>}<Link href={`/events/${item.id}`} className={`text-xs font-bold ${passed ? "text-slate-600" : "text-emerald-800"}`}>Detalhes →</Link></div>}</article>; })}{!monthItems.length && <p className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">Nenhum item neste mês.</p>}</div>
      </>}
    </main>
    <MemberDetailModal userId={selectedUid} onClose={() => setSelectedUid(null)} />
  </div>;
}
