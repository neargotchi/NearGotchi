import type { NextConfig } from "next";

/**
 * Security headers for every route. No script CSP on purpose: the app router injects inline
 * scripts (plus our static theme script in app/layout.tsx), so a script-src without nonces would
 * break the site; frame-ancestors / base-uri / form-action / object-src don't touch scripts.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The contract's base_uri is https://neargochi.vercel.app/drop1-full/ and each token's media is "{id}.png"
  // (hash of the 1024px PNG, 148 MB for 300 files: not shipped). Until the PNGs are on IPFS, that URL serves the
  // 512px webp from /public/drop1 (docs/CONTRACT-SETUP.md: media_hash will not match the served bytes).
  async rewrites() {
    return [{ source: "/drop1-full/:id(\\d+).png", destination: "/drop1/:id.webp" }];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
