"use client";

import { useEffect } from "react";
import { useAuth } from "./auth-provider";

export function PwaRegister() {
  const { user } = useAuth();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/firebase-messaging-sw.js").then(async (registration) => {
      const worker = registration.active ?? registration.waiting ?? registration.installing;
      worker?.postMessage({ type: "SET_ACTIVE_USER", uid: user?.uid ?? null });
    });
  }, [user]);

  return null;
}
