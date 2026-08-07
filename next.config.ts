import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',

  serverExternalPackages: ['docusign-esign'],

  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },

  images: {
    qualities: [75, 80, 85, 90],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
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

  async headers() {
    return [
      {
        // Regra ÚNICA global — camera e microphone liberados com (self).
        // O browser ainda exige permissão explícita do usuário na UI —
        // isso apenas remove o bloqueio a nível de servidor que impedia
        // getUserMedia() de funcionar nas páginas de teleconsulta.
        // IMPORTANTE: não duplicar este header em rotas específicas —
        // o browser aplica o mais restritivo quando recebe múltiplos.
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
            key: 'Permissions-Policy',
            value: [
              'camera=(self)',
              'microphone=(self)',
              'display-capture=(self)',
              'geolocation=()',
              'interest-cohort=()',
              'payment=()',
            ].join(', '),
          },
          {
            key: 'Content-Security-Policy-Report-Only',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://clerk.be4hope.org https://*.vercel.app https://js.pusher.com https://www.googletagmanager.com https://*.docusign.net https://*.docusign.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://img.clerk.com https://images.clerk.dev https://*.public.blob.vercel-storage.com",
              "connect-src 'self' https://*.clerk.accounts.dev https://clerk.be4hope.org wss://*.pusher.com https://*.pusherapp.com https://*.neon.tech https://api.brevo.com https://api.inngest.com https://vitals.vercel-insights.com https://demo.docusign.net https://*.docusign.net https://*.docusign.com https://account-d.docusign.com https://clerk-telemetry.com",
              "media-src 'self' blob: https://*.public.blob.vercel-storage.com",
              "frame-src 'self' https://*.clerk.accounts.dev https://demo.docusign.net https://*.docusign.net https://*.docusign.com",
              "worker-src 'self' blob:",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
