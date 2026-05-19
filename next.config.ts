import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Habilitar React Strict Mode para detecção precoce de problemas
  reactStrictMode: true,

  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },

  // Configuração de imagens para domínios permitidos
  images: {
    qualities: [75, 80, 85, 90],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },


  // Proxy do Clerk: encaminha /_clerk/* para os servidores reais do Clerk
  // Necessário porque o domínio primário (behemp-site.vercel.app) usa proxy
  // em vez de CNAME clerk.behemp-site.vercel.app → frontend-api.clerk.services
  async rewrites() {
    return [
      {
        source: '/_clerk/:path*',
        destination: 'https://frontend-api.clerk.services/:path*',
      },
    ];
  },

  // Headers de segurança
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
