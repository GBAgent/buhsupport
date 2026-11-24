import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["bcryptjs", "exceljs"],
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
};

export default nextConfig;
