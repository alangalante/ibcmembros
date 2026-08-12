import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { OfflineDataProvider } from "@/components/offline-data-provider";
import { PwaRegister } from "@/components/pwa-register";
import { PasswordChangeGate } from "@/components/password-change-gate";

export const metadata: Metadata = {
  title: "IBC Membros",
  description: "Gestão de membros, grupos e agenda da igreja",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/icons/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, title: "IBC Membros", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#065f46", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh antialiased">
        <AuthProvider>
          <PwaRegister />
          <OfflineDataProvider><PasswordChangeGate>{children}</PasswordChangeGate></OfflineDataProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
