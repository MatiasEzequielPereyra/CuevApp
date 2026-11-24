import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { THEME_BOOTSTRAP } from "@/lib/theme";
import { PwaInstallPrompt } from "@/components/pwa/install-prompt";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], display: "swap", variable: "--font-cueva-manrope" });

export const metadata: Metadata = {
  title: "CUEVA · Un lugar para avanzar",
  description: "El espacio digital de CUEVA está en desarrollo. Una base para acompañar el entrenamiento y la gestión del gimnasio.",
  robots: { index: false, follow: false },
  icons: { icon: "/brand/cueva-symbol.svg", apple: [{ url: "/api/pwa/icon/180", sizes: "180x180", type: "image/png" }] },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "CUEVA" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR" className={manrope.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>{children}<PwaInstallPrompt /></body>
    </html>
  );
}
