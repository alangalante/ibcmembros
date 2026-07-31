import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "ibc-membros";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDUMMY00000000000000000000000000000",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
  projectId: projectId,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "000000000000",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:000000000000:web:0000000000000000000000",
};

if (typeof window !== "undefined" && !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
  console.warn("NEXT_PUBLIC_FIREBASE_API_KEY não configurada na Vercel. Usando configuração fallback.");
}

const app = getApps().length ? getApp() : initializeApp(config);
export const auth = getAuth(app);
export const db = getFirestore(app);
export { app as firebaseApp };
