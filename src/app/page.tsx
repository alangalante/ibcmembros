"use client";

import { useAuth } from "@/components/auth-provider";
import { Dashboard } from "@/components/dashboard";
import { LoginForm } from "@/components/login-form";

function Home() {
  const { user, loading } = useAuth();
  if (loading) return <main className="grid min-h-dvh place-items-center"><p>Carregando…</p></main>;
  if (user) return <Dashboard />;
  return <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12"><div className="grid size-14 place-items-center rounded-2xl bg-emerald-800 text-3xl text-white">✝</div><h1 className="mt-6 text-3xl font-bold">IBC Membros</h1><p className="mt-2 text-slate-600">Pessoas próximas, igreja conectada.</p><LoginForm /></main>;
}

export default function Page() { return <Home />; }
