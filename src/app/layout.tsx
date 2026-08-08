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
  title: "Engagio — Interactive Event & Learning Platform",
  description:
    "Create engaging events, workshops, conferences, training programs, and assessments with registration, live activities, quizzes, results, and certificates.",
  keywords: [
    "event engagement platform",
    "interactive event platform",
    "workshop platform",
    "event registration",
    "live polling",
    "event quiz",
    "online assessment",
    "conference engagement",
    "training assessment",
    "event certificates",
  ],
  authors: [{ name: "Engagio" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Engagio — Interactive Event & Learning Platform",
    description:
      "Engage participants, run interactive activities, assess learning, and issue certificates from one platform.",
    siteName: "Engagio",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Engagio — Interactive Event & Learning Platform",
    description:
      "Engage participants, run interactive activities, assess learning, and issue certificates from one platform.",
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
