"use client";

import Image from "next/image";
import Link from "next/link";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { db } from "@/lib/firebase/client";
import type { UserProfile } from "@/types/domain";

type Birthday = UserProfile & { id: string };

export default function BirthdaysPage() {
  const { user, loading } = useAuth();
  const [people, setPeople] = useState<Birthday[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!user) return;
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", month: "2-digit", day: "2-digit" }).formatToParts();
    const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    getDocs(query(collection(db, "users"), where("active", "==", true), where("birthMonthDay", "==", `${value("month")}-${value("day")}`)))
      .then((snapshot) => setPeople(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Birthday))))
      .finally(() => setFetching(false));
  }, [user]);

  if (loading) return <main className="grid min-h-dvh place-items-center">Carregando…</main>;
  if (!user) return <main className="mx-auto max-w-lg p-6"><p>Entre no aplicativo para ver os aniversariantes.</p><Link href="/" className="mt-4 inline-block font-semibold text-emerald-800">Ir para o login</Link></main>;

  return <main className="mx-auto min-h-dvh max-w-lg px-4 py-6">
    <Link href="/" className="text-sm font-semibold text-emerald-800">← Voltar</Link>
    <h1 className="mt-5 text-2xl font-bold">Aniversariantes de hoje 🎉</h1>
    <p className="mt-1 text-sm text-slate-600">Apenas o dia e o mês são compartilhados.</p>
    <div className="mt-6 space-y-3">
      {fetching && <p className="text-sm text-slate-500">Consultando…</p>}
      {!fetching && !people.length && <p className="rounded-2xl bg-white p-5 text-sm text-slate-500">Nenhum aniversariante hoje.</p>}
      {people.map((person) => {
        const phone = person.phoneE164.replace(/\D/g, "");
        return <article key={person.id} className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm">
          {person.photoUrl ? <Image src={person.photoUrl} alt="" width={64} height={64} className="size-16 rounded-full object-cover" /> : <div className="grid size-16 shrink-0 place-items-center rounded-full bg-emerald-100 text-2xl">🎂</div>}
          <div className="min-w-0 flex-1"><h2 className="truncate font-semibold">{person.name}</h2><p className="text-sm text-slate-600">{person.birthMonthDay.split("-").reverse().join("/")}</p>
            {phone && <a href={`https://wa.me/${phone}?text=${encodeURIComponent(`Feliz aniversário, ${person.name}!`)}`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-bold text-emerald-800">Enviar mensagem</a>}
          </div>
        </article>;
      })}
    </div>
  </main>;
}
