"use client";

import { useEffect, useState } from "react";

export default function OpenWhatsAppPage() {
  const [fallbackUrl, setFallbackUrl] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const phone = (params.get("phone") || "").replace(/\D/g, "");
    const text = params.get("text") || "Feliz aniversário!";
    if (!phone) return;

    const encodedText = encodeURIComponent(text);
    const nativeUrl = `whatsapp://send?phone=${phone}&text=${encodedText}`;
    const webUrl = `https://wa.me/${phone}?text=${encodedText}`;
    setFallbackUrl(webUrl);

    let appOpened = false;
    const markAsOpened = () => {
      if (document.hidden) appOpened = true;
    };
    document.addEventListener("visibilitychange", markAsOpened);
    window.location.href = nativeUrl;

    const fallbackTimer = window.setTimeout(() => {
      if (!appOpened && !document.hidden) window.location.replace(webUrl);
    }, 1800);

    return () => {
      window.clearTimeout(fallbackTimer);
      document.removeEventListener("visibilitychange", markAsOpened);
    };
  }, []);

  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50 p-6 text-center text-slate-900">
      <div>
        <p className="text-sm font-bold">Abrindo o WhatsApp…</p>
        {fallbackUrl ? (
          <a className="mt-4 inline-block rounded-xl bg-emerald-800 px-4 py-2 text-sm font-bold text-white" href={fallbackUrl}>
            Abrir WhatsApp manualmente
          </a>
        ) : (
          <p className="mt-2 text-xs text-rose-700">Telefone não informado.</p>
        )}
      </div>
    </main>
  );
}
