import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ks1j/shared"],
  // Static export for Firebase Hosting; detail pages use ?id= query params.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
