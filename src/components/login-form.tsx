"use client";

import { signInWithEmailAndPassword } from "firebase/auth";
import { FormEvent, useState } from "react";
import { auth } from "@/lib/firebase/client";
import { normalizeUsername, phoneToInternalEmail, usernameToInternalEmail } from "@/lib/phone-auth";

export function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const loginInput = String(form.get("login") || "").trim();
    const password = String(form.get("password") || "").trim();

    const digits = loginInput.replace(/\D/g, "");
    const legacyPhone = /^\D*\d[\d\s()+-]*$/.test(loginInput) && digits.length >= 8;
    const normalizedUsername = normalizeUsername(loginInput);
    if (!legacyPhone && !normalizedUsername.includes(".")) {
      setError("Informe seu usuário no formato nome.sobrenome.");
      setBusy(false);
      return;
    }

    const email = legacyPhone ? phoneToInternalEmail(digits) : usernameToInternalEmail(normalizedUsername);

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setError("Usuário ou senha incorretos.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <div>
        <label className="block text-sm font-semibold text-slate-800">
          Usuário
        </label>
        <input
          name="login"
          type="text"
          required
          autoComplete="username"
          placeholder="primeironome.primeiraletra.ultimosobrenome"
          className="mt-1 w-full rounded-xl border border-emerald-900/15 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-600"
        />
        <p className="mt-1 text-[11px] text-slate-500">Formato: primeiro nome + primeira letra do segundo nome + ponto + último sobrenome.</p>
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
        <p className="mt-1 text-[11px] text-slate-500">No primeiro acesso, use o último sobrenome + 123. Exemplo: sobrenome123.</p>
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
