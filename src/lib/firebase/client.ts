import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const requiredConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (typeof window !== "undefined" && Object.values(requiredConfig).some((value) => !value)) {
  throw new Error("Configuração pública do Firebase incompleta. Verifique as variáveis NEXT_PUBLIC_FIREBASE_*.");
}

// O fallback só é usado durante a pré-renderização do Next; nunca faz chamadas externas.
const config = typeof window === "undefined" ? {
  apiKey: "AIzaSyDUMMY00000000000000000000000000000",
  authDomain: "demo.firebaseapp.com",
  projectId: "demo-project",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000000000",
} : requiredConfig;

const app = getApps().length ? getApp() : initializeApp(config);
export const auth = getAuth(app);
export const db = getFirestore(app);
export { app as firebaseApp };
