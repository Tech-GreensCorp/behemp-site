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
      // Clerk — avatares e fotos de perfil de usuários
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
      {
        protocol: 'https',
        hostname: 'images.clerk.dev',
      },
    ],
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
          {
            // Permissions-Policy: desabilita APIs sensíveis não utilizadas
            key: 'Permissions-Policy',
            value: [
              'camera=()',
              'microphone=()',
              'geolocation=()',
              'interest-cohort=()',
              'payment=()',
            ].join(', '),
          },
          {
            // CSP em Report-Only: monitora violações sem bloquear.
            // Mover para Content-Security-Policy após validar no console do browser.
            key: 'Content-Security-Policy-Report-Only',
            value: [
              "default-src 'self'",
              // Scripts — Clerk, Pusher, Google, Vercel Analytics
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://clerk.be4hope.org https://*.vercel.app https://js.pusher.com https://www.googletagmanager.com",
              // Styles — inline styles necessários pelo shadcn/ui e Clerk
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Fontes
              "font-src 'self' https://fonts.gstatic.com",
              // Imagens — Clerk avatares, Vercel Blob, fontes externas
              "img-src 'self' data: blob: https://img.clerk.com https://images.clerk.dev https://*.public.blob.vercel-storage.com",
              // Conexões fetch/XHR — Clerk, Neon, Pusher, Brevo, Inngest
              "connect-src 'self' https://*.clerk.accounts.dev https://clerk.be4hope.org wss://*.pusher.com https://*.pusherapp.com https://*.neon.tech https://api.brevo.com https://api.inngest.com https://vitals.vercel-insights.com",
              // Media — vídeos do hero
              "media-src 'self' https://*.public.blob.vercel-storage.com",
              // Frames — Clerk usa iframes internos
              "frame-src 'self' https://*.clerk.accounts.dev",
              // Worker — Next.js service worker
              "worker-src 'self' blob:",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
