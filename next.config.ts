import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // Set the absolute path to your project root (where this config file lives)
    root: path.join(__dirname),
  },
};

export default nextConfig;