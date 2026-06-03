// next.js config
const nextConfig = {
  env: {
    NEXT_PUBLIC_SUB_BUILD_TAG: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
  },
  reactStrictMode: false,
  experimental: {
    // Avoid bundling form-data/axios — can cause infinite compile on Vercel
    serverComponentsExternalPackages: ['form-data', 'axios'],
  },
  // Vercel doesn't require standalone output; keep default.
  // allow opening dev server via cloudflare tunnel (set CF_TUNNEL_HOST=your-subdomain.trycloudflare.com)
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    ...(process.env.CF_TUNNEL_HOST ? [process.env.CF_TUNNEL_HOST] : []),
  ],
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 390, 414, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [32, 48, 64, 96, 128, 192, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 7,
    /** Внешние URL блюд (Vercel Blob, CDN) — один широкий паттерн Next 14.2+ */
    remotePatterns: [{ protocol: 'https', hostname: '**', pathname: '/**' }],
  },
  eslint: { ignoreDuringBuilds: true },
  // Type check can hang on Vercel; run `npm run type-check` locally
  typescript: { ignoreBuildErrors: true },
}

module.exports = nextConfig
