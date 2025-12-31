import type { NextConfig } from "next";

const parseOrigin = (value?: string) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("/")) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
};

const buildConnectSrc = () => {
  const sources = new Set<string>([
    "'self'",
    "https://api.cloudinary.com",
    "http://localhost:3001",
    "ws://localhost:3001",
  ]);

  const apiOrigin = parseOrigin(process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL);
  const wsOrigin = parseOrigin(process.env.NEXT_PUBLIC_WS_BASE_URL);

  [apiOrigin, wsOrigin].forEach((origin) => {
    if (!origin) return;
    sources.add(origin);
    if (origin.startsWith("https://")) {
      sources.add(origin.replace("https://", "wss://"));
    } else if (origin.startsWith("http://")) {
      sources.add(origin.replace("http://", "ws://"));
    }
  });

  return Array.from(sources).join(" ");
};

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "img-src 'self' data: blob: https://res.cloudinary.com",
      "media-src 'self' data: blob: https://res.cloudinary.com",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
      `connect-src ${buildConnectSrc()}`,
    ].join("; "),
  },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const apiProxyTarget = process.env.API_PROXY_TARGET || "http://localhost:3000/api";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/proxy/:path*',
        destination: `${apiProxyTarget}/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
