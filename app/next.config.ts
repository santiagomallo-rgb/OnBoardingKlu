import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Los pasos del wizard pueden incluir documentos KYC (hasta 8 MB + overhead multipart)
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
