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


  // Proxy do Clerk — obrigatório porque o Clerk Dashboard está configurado
  // com proxy em vez de CNAME. Proxy URL no Clerk: https://behemp-site.vercel.app/__clerk
  //
  // DOIS destinos distintos (ordem importa — mais específico primeiro):
  //   1. /__clerk/npm/*  →  npm.clerk.dev        (assets JS/CSS do Clerk CDN)
  //   2. /__clerk/*      →  frontend-api.clerk.services  (chamadas de API)
  async rewrites() {
    return [
      {
        // Assets JS/CSS (clerk.browser.js, ui.browser.js, etc.)
        // O CDN npm.clerk.dev serve diretamente em /@clerk/... sem prefixo /npm/
        source: '/__clerk/npm/:path*',
        destination: 'https://npm.clerk.dev/:path*',
      },
      {
        // Chamadas de API (tokens, sessões, usuários, FAPI)
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
