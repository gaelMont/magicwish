// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // CORRECTION MAJEURE: Désactiver reactStrictMode pour éviter les erreurs 
  // "Firestore INTERNAL ASSERTION FAILED" dues au Hot Reload/Fast Refresh.
  reactStrictMode: false, 

  // Optimisation des images
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cards.scryfall.io',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
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