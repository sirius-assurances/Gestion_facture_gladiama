import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lib/pdf/server.ts reads the invoice header, stamp and footer from
  // public/images at runtime. Next traces imports, not files opened by path,
  // so without this the assets are absent from the deployed function and
  // every server-generated invoice silently falls back to plain text.
  outputFileTracingIncludes: {
    "/*": ["./public/images/**/*.png"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Blocks clickjacking: without this, the email-compose dialog (or
          // any page) could be framed on an attacker's site with invisible
          // overlays tricking a click into sending as the real user.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
