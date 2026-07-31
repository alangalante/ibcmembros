"use client";

import { signInWithEmailAndPassword } from "firebase/auth";
import { FormEvent, useState } from "react";
import { auth } from "@/lib/firebase/client";

export function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try { await signInWithEmailAndPassword(auth, String(form.get("email")), String(form.get("password"))); }
    catch { setError("E-mail ou senha inválidos."); setBusy(false); }
  }
  return <form onSubmit={submit} className="mt-8 space-y-4">
    <label className="block text-sm font-semibold">E-mail<input name="email" type="email" required autoComplete="email" className="mt-1 w-full rounded-xl border border-emerald-900/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-600" /></label>
    <label className="block text-sm font-semibold">Senha<input name="password" type="password" required autoComplete="current-password" className="mt-1 w-full rounded-xl border border-emerald-900/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-600" /></label>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <button disabled={busy} className="w-full rounded-xl bg-emerald-800 px-4 py-3 font-semibold text-white disabled:opacity-60">{busy ? "Entrando…" : "Entrar"}</button>
  </form>;
}
