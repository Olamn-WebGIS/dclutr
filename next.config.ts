import type { NextConfig } from "next";

const supabaseUrl = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL) : null;
const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseUrl ? [{
      protocol: supabaseUrl.protocol === "http:" ? "http" : "https",
      hostname: supabaseUrl.hostname,
      ...(supabaseUrl.port ? { port: supabaseUrl.port } : {}),
      pathname: "/storage/v1/object/public/listing-images/**",
    }] : [],
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
