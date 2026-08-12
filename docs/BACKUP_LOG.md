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

---

## Mudança Técnica: Node.js 18 via .nvmrc
**Data:** 07/08/2026
**Commit:** chore: forçar Node 18 na Vercel para compatibilidade do Puppeteer
**Motivo:** @sparticuz/chromium requer Node 18 e a biblioteca `libnss3.so`
disponível nessa versão para funcionar na Vercel serverless.

### O que foi feito
Criado arquivo `.nvmrc` na raiz do projeto com conteúdo `18`.
A Vercel lê esse arquivo e usa Node 18 no build.

### Impacto por ambiente

| Ambiente | Impacto | Ação necessária |
|----------|---------|-----------------|
| Vercel | ✅ Funciona — usa .nvmrc automaticamente | Nenhuma |
| Localhost (dev) | ✅ Não afeta — .nvmrc é ignorado pelo pnpm local | Nenhuma |
| AWS Lambda | ✅ Funciona — configurar runtime Node 18 no Lambda | Definir `runtime: nodejs18.x` no serverless.yml |
| AWS EC2 | ⚠️ Verificar versão Node instalada | Instalar Node 18 ou 20 no servidor |
| AWS Amplify | ✅ Funciona — respeita .nvmrc automaticamente | Nenhuma |
| AWS ECS/Docker | ⚠️ .nvmrc não é lido pelo Docker | Adicionar `FROM node:18` no Dockerfile |
| AWS Elastic Beanstalk | ⚠️ Configurar manualmente | Definir versão Node nas configs da plataforma |

### Observação importante para lançamento oficial
Se o sistema for hospedado em **AWS EC2 ou Docker**:
- O `.nvmrc` NÃO é lido automaticamente
- Garantir que o servidor use **Node.js 18.x ou superior**
- No Dockerfile: usar `FROM node:18-alpine` ou `FROM node:20-alpine`
- O `@sparticuz/chromium` funciona com Node 18 e 20

### Para reverter (se necessário)
```bash
# Remover .nvmrc e usar Node padrão da Vercel (Node 20)
rm .nvmrc
# Mas atenção: isso pode quebrar o @sparticuz/chromium na Vercel
```

### Alternativa para AWS EC2/Docker (quando for lançar)
Em vez de @sparticuz/chromium, instalar Chrome nativo no servidor:
```bash
# No servidor EC2/Docker
apt-get install -y chromium-browser
# E usar puppeteer com executablePath apontando para o Chrome instalado
```

---

## Nota: NEXT_PUBLIC_APP_URL por Ambiente

| Ambiente | Valor correto |
|----------|--------------|
| Produção AWS (be4hope.org) | `https://be4hope.org` |
| Vercel (behemp-site.vercel.app) | `https://behemp-site.vercel.app` |
| Desenvolvimento local | `http://localhost:3000` |
| ngrok | `https://frenzied-humped-kiln.ngrok-free.dev` |

⚠️ A variável na Vercel (Environment Variables) deve ser
`https://behemp-site.vercel.app` para os previews funcionarem.
No servidor AWS, deve ser `https://be4hope.org`.

---

## Mudança Técnica: CI/CD GitHub Actions
**Data:** 11/08/2026
**Motivo:** OOM Killed no t2.small durante pnpm build

### O que mudou
- Build migrado do AWS EC2 para GitHub Actions Runner
- Deploy automático a cada push na branch main
- Tempo de deploy: ~20 min → ~2 min
- Zero risco de OOM no servidor

### Playbook atual (automático)

git push origin main → GitHub Actions → rsync → pm2 restart

### Para reverter para deploy manual
Ver docs/DECISOES_TECNICAS.md DT-006 (playbook de emergência)
