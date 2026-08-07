# Backup Log — BeHemp Platform

## Backup: Pre-Puppeteer Migration
**Data:** 07 de Agosto de 2026
**Commit:** 224956a
**Branch backup:** backup/fases-1-2-4-pre-puppeteer
**Tag:** backup-pre-puppeteer-20260807-1229

### Estado do Sistema

**Fases Implementadas:**
- ✅ Fase 1: Receituário + Assinatura ICP-Brasil (BirdID/VIDaaS stub)
- ✅ Fase 2: Teleconsulta Dual-Modal + Transcrição Gemini (stub)
- ✅ Fase 4: Autorização ANVISA (Fluxo Guiado + Procuração Específica)

**Integrações Ativas:**
- ✅ Clerk (autenticação) — Development keys
- ✅ Drizzle ORM + Neon PostgreSQL
- ✅ Brevo (email)
- ✅ Pusher (realtime)
- ✅ Vercel Blob (uploads)
- ✅ Inngest (jobs)
- ✅ DocuSign Embedded Signing (sandbox)
- ⏳ Google Gemini (aguardando API key)
- ⏳ BirdID/VIDaaS (aguardando credenciais PSC)

**Migrations Aplicadas:**
- 0009: prescricoes + receituario_templates
- 0010: teleconsultas + transcricoes
- 0011: autorizacoes_anvisa
- 0012: medicoId opcional em autorizacoes_anvisa
- 0013: procuracoes_especificas + campos paciente

**Variáveis de Ambiente:**
- Todas configuradas no .env local e na Vercel
- DocuSign: sandbox (demo.docusign.net)
- Clerk: development keys

**Problema que motivou este backup:**
Puppeteer não encontra Chrome na Vercel (ambiente serverless).
Solução: migrar para @sparticuz/chromium + puppeteer-core.

**Para restaurar este backup:**
```bash
git checkout backup/fases-1-2-4-pre-puppeteer
```
