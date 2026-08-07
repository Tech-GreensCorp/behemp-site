/**
 * ATENÇÃO — MÓDULO EM MIGRAÇÃO
 *
 * Este módulo estava usando Puppeteer para gerar PDFs.
 * Puppeteer/Chromium não é compatível com ambientes serverless
 * como Vercel (plano gratuito) ou AWS Lambda sem configuração especial.
 *
 * SOLUÇÃO IMPLEMENTADA: migração para @react-pdf/renderer
 * que não requer browser/Chrome e funciona em qualquer ambiente.
 *
 * Este arquivo está sendo mantido apenas para compatibilidade
 * durante a transição. A geração de PDF da Procuração Específica
 * foi migrada para lib/receituario/procuracao-pdf.tsx
 *
 * Ver: docs/DECISOES_TECNICAS.md DT-001
 */

export async function htmlParaPdf(_html: string): Promise<Buffer> {
  throw new Error(
    'htmlParaPdf foi descontinuado. Use os geradores específicos: ' +
    'lib/receituario/procuracao-pdf.tsx para Procuração Específica.'
  );
}
