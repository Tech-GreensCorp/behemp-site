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


  // Proxy do Clerk — rewrite INTERNO para o Route Handler em /api/clerk-proxy
  //
  // O Clerk Dashboard está configurado com proxy URL:
  //   https://behemp-site.vercel.app/__clerk
  //
  // Pastas com prefixo __ não criam rotas em Next.js. Por isso usamos um
  // rewrite interno que mapeia /__clerk/* → /api/clerk-proxy/* e o Route
  // Handler em app/api/clerk-proxy/[...path]/route.ts faz o proxy real.
  async rewrites() {
    return [
      {
        source: '/__clerk/:path*',
        destination: '/api/clerk-proxy/:path*',
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
