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


  // Proxy do Clerk — dois destinos distintos:
  //   • /__clerk/npm/*  →  npm.clerk.dev  (assets JS/CSS do Clerk CDN)
  //   • /__clerk/*      →  frontend-api.clerk.services  (chamadas de API)
  //
  // IMPORTANTE: a rota mais específica (npm) DEVE vir antes da genérica.
  // Sem domínio customizado (CNAME) na Vercel, este proxy é a única forma
  // de evitar bloqueios de third-party e erros de CORS em produção.
  async rewrites() {
    return [
      {
        // Assets JS/CSS do Clerk (clerk.browser.js, ui.browser.js, etc.)
        source: '/__clerk/npm/:path*',
        destination: 'https://npm.clerk.dev/npm/:path*',
      },
      {
        // Chamadas de API do Clerk (tokens, sessões, usuários, etc.)
        source: '/__clerk/:path*',
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
