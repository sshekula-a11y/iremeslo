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
  // „Klienti“ se přejmenovali na „Zákazníci“ – staré odkazy a záložky dál fungují.
  async redirects() {
    return [{ source: "/app/klienti", destination: "/app/zakaznici", permanent: true }];
  },
};

export default nextConfig;
