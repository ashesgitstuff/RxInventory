
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  assetPrefix: './', // Use relative paths for assets
  typescript: {
    ignoreBuildErrors: false, // Enforce type safety
  },
  eslint: {
    ignoreDuringBuilds: false, // Enforce code quality
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
    unoptimized: true, // Required for static export with next/image
  },
};

export default nextConfig;
