import type { Metadata } from "next";
import { THEME_BOOTSTRAP } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "CUEVA · Un lugar para avanzar",
  description: "El espacio digital de CUEVA está en desarrollo. Una base para acompañar el entrenamiento y la gestión del gimnasio.",
  robots: { index: false, follow: false },
  icons: { icon: "/brand/cueva-symbol.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
