import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents/partialPrefetching from the scaffold are disabled: every page here is per-admin
  // and session-dependent, so request-time rendering is the simpler, correct model.
  poweredByHeader: false,
  serverExternalPackages: ["@node-rs/argon2", "embedded-postgres", "pg"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
