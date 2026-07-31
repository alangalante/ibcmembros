"use client";

import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { deleteToken, getMessaging, getToken, isSupported } from "firebase/messaging";
import { firebaseApp, db } from "./client";

function tokenDocumentId(token: string) {
  // IDs não podem conter "/". O token fica também no corpo do documento.
  return token.replaceAll("/", "_").slice(-180);
}

export async function enablePushNotifications(uid: string) {
  if (!(await isSupported()) || !("serviceWorker" in navigator)) {
    throw new Error("Este navegador não oferece suporte a notificações push.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Permissão de notificação não concedida.");

  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const token = await getToken(getMessaging(firebaseApp), {
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
  if (!token) throw new Error("Não foi possível obter o token FCM.");

  await setDoc(doc(db, "users", uid, "devices", tokenDocumentId(token)), {
    token,
    platform: "web",
    enabled: true,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  return token;
}

export async function disablePushNotifications(uid: string) {
  if (!(await isSupported()) || !("serviceWorker" in navigator) || Notification.permission !== "granted") return;
  const registration = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js");
  if (!registration) return;
  const messaging = getMessaging(firebaseApp);
  const token = await getToken(messaging, {
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
  if (token) {
    await deleteDoc(doc(db, "users", uid, "devices", tokenDocumentId(token)));
    await deleteToken(messaging);
  }
}
