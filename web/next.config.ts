import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Lets a production build run in a separate folder while the dev server keeps using .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // This app lives in web/; pin the root so Next.js does not guess a parent folder.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
