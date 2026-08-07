/**
 * Converte HTML em PDF usando Puppeteer.
 * Em desenvolvimento (localhost): usa puppeteer com Chrome local.
 * Em produção (Vercel serverless): usa puppeteer-core + @sparticuz/chromium.
 */

import type { Browser } from 'puppeteer-core';

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  // Produção — Vercel serverless
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    const chromium = await import('@sparticuz/chromium');
    const puppeteer = await import('puppeteer-core');

    return puppeteer.default.launch({
      args: chromium.default.args,
      defaultViewport: chromium.default.defaultViewport,
      executablePath: await chromium.default.executablePath(),
      headless: true,
    });
  }

  // Desenvolvimento — usa Chrome local
  const puppeteer = await import('puppeteer');
  return puppeteer.default.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

export async function htmlParaPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();

  try {
    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0',
        right: '0',
        bottom: '0',
        left: '0',
      },
    });

    await page.close();
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
