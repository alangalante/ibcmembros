"use client";

import { signInWithEmailAndPassword } from "firebase/auth";
import { FormEvent, useState } from "react";
import { auth } from "@/lib/firebase/client";
import { phoneToInternalEmail } from "@/lib/phone-auth";

export function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const phoneInput = String(form.get("phone") || "").trim();
    const password = String(form.get("password") || "").trim();

    const digits = phoneInput.replace(/\D/g, "");
    if (!digits || digits.length < 8) {
      setError("Informe o número de telefone completo (apenas números).");
      setBusy(false);
      return;
    }

    const email = phoneToInternalEmail(digits);

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setError("Telefone ou senha incorretos.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <div>
        <label className="block text-sm font-semibold text-slate-800">
          Telefone (somente números)
        </label>
        <input
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          placeholder="ex: 22999999999"
          className="mt-1 w-full rounded-xl border border-emerald-900/15 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-600"
        />
        <p className="mt-1 text-[11px] text-slate-500">Digite seu DDD + telefone, sem espaço ou traço.</p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-800">
          Senha
        </label>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="Sua senha"
          className="mt-1 w-full rounded-xl border border-emerald-900/15 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-600"
        />
      </div>

      {error && (
        <p role="alert" className="text-xs font-semibold text-red-700">
          {error}
        </p>
      )}

      <button
        disabled={busy}
        className="w-full rounded-xl bg-emerald-800 px-4 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-60 hover:bg-emerald-900 active:bg-emerald-950"
      >
        {busy ? "Entrando…" : "Entrar no Aplicativo"}
      </button>
    </form>
  );
}
