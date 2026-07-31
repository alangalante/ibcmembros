import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";

export const metadata: Metadata = {
  title: "IBC Membros",
  description: "Gestão de membros, grupos e eventos",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "IBC Membros", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#176b4d", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body className="min-h-dvh antialiased"><AuthProvider>{children}</AuthProvider></body></html>;
}
