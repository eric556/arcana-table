import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Reloading the table must load the current app shell. Card-art caches and
  // content-hashed JS assets retain their own independent caching policies.
  async headers() {
    return [{source: '/', headers: [{key: 'Cache-Control', value: 'no-store, max-age=0'}]}];
  },
};

export default nextConfig;
