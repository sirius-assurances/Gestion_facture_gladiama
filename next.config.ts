import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lib/pdf/server.ts reads the invoice header, stamp and footer from
  // public/images at runtime. Next traces imports, not files opened by path,
  // so without this the assets are absent from the deployed function and
  // every server-generated invoice silently falls back to plain text.
  outputFileTracingIncludes: {
    "/*": ["./public/images/**/*.png"],
  },
};

export default nextConfig;
