import type { Metadata } from 'next';
import { Epilogue, JetBrains_Mono } from 'next/font/google';
import localFont from 'next/font/local';
import { ClerkProvider } from '@clerk/nextjs';
import { ptBR } from '@clerk/localizations';
import { Providers } from '@/components/shared/providers';
import './globals.css';

/* ── Epilogue — corpo de texto (sans-serif geometric warm) ── */
const epilogue = Epilogue({
  variable: '--font-epilogue',
  subsets: ['latin'],
  display: 'swap',
});

/* ── Fraunces — display/headings (serif old-style) ── */
const fraunces = localFont({
  src: [
    {
      path: '../public/fonts/Fraunces-VariableFont.ttf',
      style: 'normal',
    },
    {
      path: '../public/fonts/Fraunces-Italic-VariableFont.ttf',
      style: 'italic',
    },
  ],
  variable: '--font-fraunces',
  display: 'swap',
});

/* ── JetBrains Mono — detalhes/stats ── */
const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    // Homepage define seu próprio título. Outras páginas usam: "Título da Página | Be4Hope"
    default: 'Be4Hope — Medicina Endocanabinóide com acolhimento',
    template: '%s | Be4Hope',
  },
  description:
    'Há mais de duas décadas conectando pessoas ao cuidado com Medicina Endocanabinóide, responsabilidade, acolhimento e do seu lado em cada etapa.',
  keywords: [
    'Medicina Endocanabinóide',
    'medicina endocanabinóide',
    'acolhimento',
    'ONG',
    'Be4Hope',
    'triagem',
    'tratamento',
  ],
  authors: [{ name: 'Be4Hope' }],
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://be4hope.org',
    siteName: 'Be4Hope',
    // og:title alinhado com o título padrão — será sobrescrito por cada página
    title: 'Be4Hope — Medicina Endocanabinóide com acolhimento',
    description:
      'Há mais de duas décadas conectando pessoas ao cuidado com Medicina Endocanabinóide.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      localization={{
        ...ptBR,
        formFieldInputPlaceholder__signUpPassword: 'Crie uma senha',
      }}
    >
      <html
        lang="pt-BR"
        suppressHydrationWarning
        className={`${epilogue.variable} ${fraunces.variable} ${jetbrainsMono.variable} h-full`}
      >
        <body className="flex min-h-full flex-col bg-background font-sans text-foreground antialiased">
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
