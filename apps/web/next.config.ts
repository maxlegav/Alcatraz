import type { NextConfig } from "next";
import path from "path";
import { config as dotenvConfig } from "dotenv";

// Load shared .env.local from repo root so all packages share one file
dotenvConfig({ path: path.resolve(__dirname, "../../.env.local"), override: false });

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
