"use client";

import Image from "next/image";
import { useAuth } from "@/components/auth-provider";
import { Dashboard } from "@/components/dashboard";
import { LoginForm } from "@/components/login-form";

function Home() {
  const { user, loading } = useAuth();
  if (loading) return <main className="grid min-h-dvh place-items-center"><p className="text-sm font-semibold text-slate-500">Carregando…</p></main>;
  if (user) return <Dashboard />;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <Image
        src="/logo.jpg"
        alt="Logo da Igreja"
        width={72}
        height={72}
        className="size-18 rounded-2xl object-cover shadow-xs border border-slate-100"
      />
      <h1 className="mt-6 text-3xl font-bold text-slate-900">IBC Membros</h1>
      <p className="mt-2 text-sm text-slate-600">Pessoas próximas, igreja conectada.</p>
      <LoginForm />
    </main>
  );
}

export default function Page() { return <Home />; }
