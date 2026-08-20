import type { NextConfig } from "next";

/**
 * Security headers. This tool holds accounts for staff at sovereign
 * governments and is used to prepare legal notices, so the browser-side
 * defences are set explicitly rather than left to defaults.
 */
const securityHeaders = [
  // Clickjacking: nothing should frame this app. frame-ancestors is the
  // modern control; X-Frame-Options covers older browsers.
  { key: "X-Frame-Options", value: "DENY" },
  // Stop browsers guessing content types (MIME sniffing -> XSS).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak the full URL — which can contain a nation's name — to
  // third parties such as Amazon or Temu when a user clicks through.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // No feature of this app needs these.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next injects inline bootstrap scripts; 'unsafe-inline' is required
      // for them, and styles are emitted inline by the framework too.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      // Listing photographs are served from marketplace CDNs.
      "img-src 'self' data: https://m.media-amazon.com https://img.kwcdn.com https://*.media-amazon.com https://*.kwcdn.com",
      "font-src 'self' data:",
      // Supabase for auth and data; nothing else.
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false, // don't advertise the framework
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
