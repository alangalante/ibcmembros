"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { NavHeader } from "@/components/nav-header";
import { MemberDetailModal } from "@/components/member-detail-modal";
import { useAuth } from "@/components/auth-provider";
import { useOfflineData } from "@/components/offline-data-provider";
import { birthdayDate, formatAgendaDate, todayIso, weekBounds } from "@/lib/agenda";

export default function WeeklyAgendaPage() {
  const { user, loading } = useAuth();
  const offline = useOfflineData();
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const today = todayIso();
  const { start, end } = weekBounds(today);
  const year = Number(start.slice(0, 4));
  const profile = offline.users.find((item) => item.id === user?.uid);
  const groupIds = profile?.groupIds || [];
  const visibleEvents = offline.events.filter((item) => item.eventDate >= start && item.eventDate <= end &&
    (item.scope === "global" || item.groupIds.some((id) => groupIds.includes(id))));
  const birthdays = offline.users.flatMap((person) => {
    const candidates = [birthdayDate(person.birthMonthDay, year), birthdayDate(person.birthMonthDay, year + 1)];
    const date = candidates.find((value) => value >= start && value <= end);
    return person.active && date ? [{ person, date }] : [];
  });
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${start}T12:00:00`); date.setDate(date.getDate() + index); return date.toISOString().slice(0, 10);
  });

  if (loading) return <main className="grid min-h-dvh place-items-center">Carregando…</main>;
  if (!user) return <main className="p-6"><Link href="/">Ir para o login</Link></main>;

  return <div className="min-h-dvh bg-slate-50 pb-20 text-slate-900">
    <NavHeader />
    <main className="mx-auto max-w-6xl px-4 pt-6">
      <h1 className="text-2xl font-bold">Agenda da semana</h1>
      <p className="mt-1 text-sm text-slate-500">De {start.split("-").reverse().join("/")} a {end.split("-").reverse().join("/")}</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {days.map((date) => {
          const dayBirthdays = birthdays.filter((item) => item.date === date);
          const dayEvents = visibleEvents.filter((item) => item.eventDate === date);
          const passed = date < today;
          return <section key={date} className={`rounded-2xl border bg-white p-4 shadow-xs transition ${passed ? "opacity-45 grayscale" : date === today ? "border-emerald-500 ring-2 ring-emerald-100" : "border-slate-100"}`}>
            <div className="flex items-center justify-between"><h2 className="font-bold capitalize">{formatAgendaDate(date)}</h2>{passed && <span className="text-[10px] font-bold uppercase text-slate-500">Já passou</span>}</div>
            <div className="mt-3 space-y-2">
              {dayBirthdays.map(({ person }) => {
                const sameGroup = person.groupIds.some((id) => groupIds.includes(id));
                return <button key={person.id} onClick={() => setSelectedUid(person.id)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${sameGroup ? "border-amber-300 bg-amber-50 ring-1 ring-amber-200" : "border-slate-100 bg-slate-50"}`}>
                  {person.photoUrl ? <Image src={person.photoUrl} alt="" width={36} height={36} className="size-9 rounded-full object-cover" /> : <span className="grid size-9 place-items-center rounded-full bg-pink-100">🎂</span>}
                  <span><span className="block text-xs font-bold">{person.name}</span><span className="text-[10px] text-slate-500">Aniversário{sameGroup ? " · Do seu grupo ⭐" : ""}</span></span>
                </button>;
              })}
              {dayEvents.map((event) => <Link key={event.id} href={`/events/${event.id}`} className="block rounded-xl border border-emerald-100 bg-emerald-50 p-3"><span className="block text-xs font-bold text-emerald-950">📅 {event.title}</span><span className="text-[10px] text-emerald-800">{event.scope === "global" ? "Agenda global" : "Agenda do seu grupo"}</span></Link>)}
              {!dayBirthdays.length && !dayEvents.length && <p className="py-3 text-center text-xs text-slate-400">Nada agendado.</p>}
            </div>
          </section>;
        })}
      </div>
    </main>
    <MemberDetailModal userId={selectedUid} onClose={() => setSelectedUid(null)} />
  </div>;
}
