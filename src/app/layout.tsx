import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "QuizMaster Pro — Workshop & Event Quiz Platform",
  description:
    "Create events, import questions via CSV, generate shareable quiz links, and let participants attempt with anti-cheat protection — all in one beautiful platform.",
  keywords: [
    "quiz platform",
    "workshop quiz",
    "event quiz",
    "exam platform",
    "anti-cheat quiz",
    "Next.js quiz",
  ],
  authors: [{ name: "QuizMaster Pro" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "QuizMaster Pro — Workshop & Event Quiz Platform",
    description:
      "Run flawless quizzes for your next workshop or event. CSV import, anti-cheat, shareable links.",
    siteName: "QuizMaster Pro",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "QuizMaster Pro",
    description:
      "Run flawless quizzes for your next workshop or event. CSV import, anti-cheat, shareable links.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>
          {children}
          <SonnerToaster position="top-right" richColors closeButton />
        </Providers>
      </body>
    </html>
  );
}
