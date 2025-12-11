import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Mode strict pour détecter les bugs en dev
  reactStrictMode: true,

  // Optimisation des images
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cards.scryfall.io', // Indispensable pour tes cartes
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com', // Indispensable pour les avatars Google Auth
        port: '',
        pathname: '/**',
      },
    ],
  },

  // Sécurité (Headers HTTP)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;