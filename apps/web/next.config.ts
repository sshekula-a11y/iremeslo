import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sdílený balíček s výpočty (TypeScript bez sestavení)
  transpilePackages: ["@iremeslo/core"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  poweredByHeader: false,
};

export default nextConfig;
