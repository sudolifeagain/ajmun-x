import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const cspValue = isDev
  ? "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' https://cdn.discordapp.com data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'"
  : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https://cdn.discordapp.com data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
        pathname: "/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Permitted-Cross-Domain-Policies",
            value: "none",
          },
          {
            key: "Content-Security-Policy",
            value: cspValue,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
