'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ReactNode } from 'react';

interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * Provider de tema (dark/light/system).
 * Utiliza next-themes com estratégia de classe CSS.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <NextThemesProvider attribute="class" forcedTheme="light" disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
