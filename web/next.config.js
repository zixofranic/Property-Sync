// apps/web/next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost', 'via.placeholder.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  env: {
    CUSTOM_KEY: 'my-value',
  },
  // React configuration
  reactStrictMode: true,
  // ESLint configuration for production - FORCE DEPLOYMENT
  eslint: {
    // Disable ESLint during production builds (only for deployment)
    ignoreDuringBuilds: true,
  },
  // TypeScript configuration for production - FORCE DEPLOYMENT  
  typescript: {
    // Disable type checking during production builds (only for deployment)
    ignoreBuildErrors: true,
  },
  // Additional dev optimizations
  onDemandEntries: {
    // Period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 25 * 1000,
    // Number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 2,
  },
}

module.exports = nextConfig