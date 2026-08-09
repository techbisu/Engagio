import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";
import {
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
  publicOrigin,
} from "@/lib/seo";

const SITE_URL = publicOrigin();

// SEO: site-wide Organization + WebSite structured data, emitted as JSON-LD
// <script> tags in the root layout (a server component) so they appear in
// the initial SSR HTML for every route. Search engines (Google, Bing) use
// these to understand the platform and to qualify for rich-result features
// like the organization knowledge panel and sitelinks search box.
const ORG_JSON_LD = buildOrganizationJsonLd({
  name: "Engagio",
  description:
    "Interactive event & learning platform for hosting engaging events, workshops, conferences, training programs, and assessments — with registration, live activities, quizzes, results, and certificates.",
  url: SITE_URL,
  logo: `${SITE_URL}/logo.svg`,
})
const WEBSITE_JSON_LD = buildWebSiteJsonLd({
  name: "Engagio",
  url: SITE_URL,
  description:
    "Create engaging events, workshops, conferences, training programs, and assessments — with registration, live activities, quizzes, results, and certificates.",
})

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Engagio — Interactive Event & Learning Platform",
  description:
    "Create engaging events, workshops, conferences, training programs, and assessments with registration, live activities, quizzes, results, and certificates.",
  applicationName: "Engagio",
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
  creator: "Engagio",
  publisher: "Engagio",
  icons: {
    icon: "/logo.svg",
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Engagio — Interactive Event & Learning Platform",
    description:
      "Engage participants, run interactive activities, assess learning, and issue certificates from one platform.",
    siteName: "Engagio",
    type: "website",
    url: SITE_URL,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Engagio — Interactive Event & Learning Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Engagio — Interactive Event & Learning Platform",
    description:
      "Engage participants, run interactive activities, assess learning, and issue certificates from one platform.",
    images: ["/og.png"],
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
        {/* SEO: site-wide Organization + WebSite structured data. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSON_LD) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSON_LD) }}
        />
        <Providers>
          {children}
          <SonnerToaster position="top-right" richColors closeButton />
        </Providers>
      </body>
    </html>
  );
}
