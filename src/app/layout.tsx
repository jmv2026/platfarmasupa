import { Suspense } from "react";
import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/context";
import NavProgressBar from "@/components/navigation/nav-progress-bar";
import { PersistentAppShell } from "@/components/navigation/app-header";
import { getAuthContext } from "@/lib/supabase/session";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sermail - Plataforma Farma",
  description: "Plataforma Farma - Sermail, Logística Integrada Lda.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, profile } = await getAuthContext();

  return (
    <html lang="pt" className={`${inter.variable} ${manrope.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
      </head>
      <body className="bg-surface text-on-surface min-h-screen antialiased">
        <Suspense fallback={null}>
          <NavProgressBar />
        </Suspense>
        <LanguageProvider>
          <PersistentAppShell initialProfile={profile} initialEmail={user?.email}>
            {children}
          </PersistentAppShell>
        </LanguageProvider>
      </body>
    </html>
  );
}

