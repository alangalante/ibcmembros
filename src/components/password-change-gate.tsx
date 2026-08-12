"use client";

import { updatePassword } from "firebase/auth";
import { FormEvent, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useOfflineData } from "@/components/offline-data-provider";

export function PasswordChangeGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const offline = useOfflineData();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const profile = offline.users.find((item) => item.id === user?.uid);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const confirmation = String(form.get("confirmation") || "");
    if (password.length < 6) return setError("A nova senha deve ter pelo menos 6 caracteres.");
    if (password !== confirmation) return setError("As senhas digitadas não são iguais.");
    setBusy(true);
    setError("");
    try {
      await updatePassword(user, password);
      const token = await user.getIdToken(true);
      const response = await fetch("/api/account/password", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("A senha mudou, mas não foi possível concluir a ativação. Tente novamente.");
      await offline.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível alterar a senha.");
    } finally {
      setBusy(false);
    }
  }

  if (!user || !profile?.mustChangePassword) return children;
  return <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Primeiro acesso</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Crie sua nova senha</h1>
      <p className="mt-2 text-sm text-slate-600">Por segurança, troque a senha provisória antes de entrar no aplicativo.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <input name="password" type="password" required minLength={6} autoComplete="new-password" placeholder="Nova senha" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" />
        <input name="confirmation" type="password" required minLength={6} autoComplete="new-password" placeholder="Repita a nova senha" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" />
        {error && <p role="alert" className="text-xs font-semibold text-rose-700">{error}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-emerald-800 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{busy ? "Salvando…" : "Salvar nova senha"}</button>
      </form>
    </div>
  </main>;
}
