"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { NavHeader } from "@/components/nav-header";
import { useOfflineData } from "@/components/offline-data-provider";
import { formatWhatsAppLink } from "@/lib/phone-auth";

export default function BirthdaysPage() {
  const { user, loading } = useAuth();
  const offline = useOfflineData();
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", month: "2-digit", day: "2-digit" }).formatToParts();
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const people = offline.users.filter((person) => person.active && person.birthMonthDay === `${value("month")}-${value("day")}`);

  if (loading) return <main className="grid min-h-dvh place-items-center">Carregando…</main>;
  if (!user) return <main className="mx-auto max-w-lg p-6"><p>Entre no aplicativo para ver os aniversariantes.</p><Link href="/" className="mt-4 inline-block font-semibold text-emerald-800">Ir para o login</Link></main>;

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 pb-20">
      <NavHeader />
      <main className="mx-auto max-w-lg md:max-w-4xl lg:max-w-6xl px-4 pt-6">
        <h1 className="text-2xl font-bold">Aniversariantes de hoje 🎉</h1>
        <p className="mt-1 text-xs text-slate-500">Privacidade preservada: apenas o dia e o mês são compartilhados.</p>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

          {(offline.status === "loading-cache" || offline.status === "syncing") && !people.length && <p className="text-sm text-slate-500">Carregando dados locais…</p>}
          {offline.status !== "loading-cache" && !people.length && <p className="rounded-2xl bg-white p-5 text-sm text-slate-500">Nenhum aniversariante hoje.</p>}
          {people.map((person) => {
            const whatsappUrl = `${formatWhatsAppLink(person.phoneE164)}?text=${encodeURIComponent(`Feliz aniversário, ${person.name}!`)}`;
            return (
              <article key={person.id} className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm border border-slate-100">
                {person.photoUrl ? (
                  <Image src={person.photoUrl} alt="" width={64} height={64} className="size-16 rounded-full object-cover" />
                ) : (
                  <div className="grid size-16 shrink-0 place-items-center rounded-full bg-emerald-100 text-2xl">🎂</div>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold text-slate-900">{person.name}</h2>
                  <p className="text-xs text-slate-500">{person.birthMonthDay.split("-").reverse().join("/")}</p>
                  {person.phoneE164 && (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs font-bold text-emerald-800 hover:underline"
                    >
                      Enviar mensagem WhatsApp →
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
}
