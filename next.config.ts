import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTE: There are ~230 pre-existing TypeScript errors in the codebase
  // (Prisma select+include conflicts, unused vars, etc.). These need to be
  // fixed one by one before this flag can be removed. Removing it now would
  // break the production build. DO NOT add new code that introduces new
  // TypeScript errors — fix them at the source.
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: true,
  serverExternalPackages: [
    "@resvg/resvg-js",
    "sharp",
    "satori",
    "bcryptjs",
  ],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://checkout.stripe.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https://res.cloudinary.com https://*.cloudinary.com https://*.stripe.com https://*.googleusercontent.com https://tfhub.dev https://*.tfhub.dev https://storage.googleapis.com https://www.kaggle.com https://*.kaggle.com",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://api.resend.com https://api.cloudinary.com https://*.stripe.com https://*.razorpay.com https://tfhub.dev https://*.tfhub.dev https://storage.googleapis.com https://*.googleapis.com https://www.kaggle.com https://*.kaggle.com",
              "frame-src 'self' https://js.stripe.com https://checkout.stripe.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
      {
        source: "/api/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
