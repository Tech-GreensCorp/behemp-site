import puppeteer, { Browser } from 'puppeteer';

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      })
      .catch((e) => {
        browserPromise = null;
        throw e;
      });
  }
  return browserPromise;
}

/** Converte HTML em PDF A4 (buffer). Reusa a instância do browser. */
export async function htmlParaPdf(
  html: string,
  opts?: {
    displayHeaderFooter?: boolean;
    headerTemplate?: string;
    footerTemplate?: string;
    margin?: { top: string; bottom: string; left: string; right: string };
  }
): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load', timeout: 20_000 });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: opts?.margin ?? { top: '0', bottom: '0', left: '0', right: '0' },
      displayHeaderFooter: opts?.displayHeaderFooter ?? false,
      headerTemplate: opts?.headerTemplate,
      footerTemplate: opts?.footerTemplate,
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
  }
}

/** Encerra o browser (para scripts/testes que precisam terminar o processo). */
export async function fecharBrowserPdf(): Promise<void> {
  if (browserPromise) {
    try {
      (await browserPromise).close();
    } catch {
      /* noop */
    }
    browserPromise = null;
  }
}
