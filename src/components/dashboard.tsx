"use client";

import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase/client";
import { enablePushNotifications } from "@/lib/firebase/messaging";
import { useAuth } from "./auth-provider";
import type { ChurchEvent, CommunityGroup, UserProfile } from "@/types/domain";

export function Dashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [groups, setGroups] = useState<Array<CommunityGroup & { id: string }>>([]);
  const [events, setEvents] = useState<Array<ChurchEvent & { id: string }>>([]);
  const [pushStatus, setPushStatus] = useState("");

  useEffect(() => {
    if (!user) return;
    const unsubProfile = onSnapshot(doc(db, "users", user.uid), (snapshot) => setProfile(snapshot.data() as UserProfile));
    const unsubGroups = onSnapshot(query(collection(db, "groups"), where("participantIds", "array-contains", user.uid)), (snapshot) =>
      setGroups(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as CommunityGroup & { id: string }))));
    return () => { unsubProfile(); unsubGroups(); };
  }, [user]);

  useEffect(() => {
    if (!profile) return;
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const collected = new Map<string, ChurchEvent & { id: string }>();
    const publish = () => setEvents([...collected.values()].sort((a, b) => a.eventDate.localeCompare(b.eventDate)));
    const unsubGlobal = onSnapshot(query(collection(db, "events"), where("scope", "==", "global"), where("eventDate", ">=", today)), (snapshot) => {
      snapshot.docs.forEach((item) => collected.set(item.id, { id: item.id, ...item.data() } as ChurchEvent & { id: string })); publish();
    });
    const unsubRestricted = profile.groupIds.length ? onSnapshot(query(collection(db, "events"), where("groupIds", "array-contains-any", profile.groupIds.slice(0, 30)), where("eventDate", ">=", today)), (snapshot) => {
      snapshot.docs.forEach((item) => collected.set(item.id, { id: item.id, ...item.data() } as ChurchEvent & { id: string })); publish();
    }) : () => undefined;
    return () => { unsubGlobal(); unsubRestricted(); };
  }, [profile]);

  if (!user) return null;
  async function activatePush() {
    try { setPushStatus("Ativando…"); await enablePushNotifications(user!.uid); setPushStatus("Notificações ativadas"); }
    catch (error) { setPushStatus(error instanceof Error ? error.message : "Falha ao ativar"); }
  }

  return <main className="mx-auto min-h-dvh max-w-lg px-4 pb-24 pt-6">
    <header className="flex items-center justify-between">
      <div><p className="text-sm text-emerald-800">Olá,</p><h1 className="text-2xl font-bold">{profile?.name ?? user.email}</h1></div>
      <button onClick={() => signOut(auth)} className="rounded-lg border border-emerald-900/15 px-3 py-2 text-sm">Sair</button>
    </header>

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
