
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  // Use relative paths for assets to work in file:// protocol
  assetPrefix: './', 
  // Generate `page.html` files instead of `page/index.html`
  trailingSlash: false,
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
