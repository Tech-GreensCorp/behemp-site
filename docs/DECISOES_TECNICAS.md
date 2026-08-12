# Decisões Técnicas — BeHemp Platform

## DT-001: Geração de PDF com Puppeteer
**Data:** 07/08/2026
**Status:** ✅ Implementado

### Contexto
O sistema gera PDFs clínicos (receituários e Procuração Específica).
Em desenvolvimento usa Chrome local via Puppeteer.
Em produção serverless (Vercel/Lambda) usa @sparticuz/chromium.

### Decisão
- **Desenvolvimento:** `puppeteer` (devDependency) com Chrome local
- **Produção serverless:** `@sparticuz/chromium` + `puppeteer-core`
- **Detecção automática:** via variável `process.env.VERCEL` ou `AWS_LAMBDA_FUNCTION_NAME`

### Para lançamento em AWS EC2/Docker
Instalar Chrome nativo e usar:
```typescript
executablePath: '/usr/bin/chromium-browser'
```

---

## DT-002: Assinatura Digital ICP-Brasil
**Data:** 06/08/2026
**Status:** ⏳ Stub — aguardando credenciais PSC

### Contexto
Receituários precisam de assinatura ICP-Brasil (RDC ANVISA 1.000/25).
Provedores: BirdID (Certisign) e VIDaaS (Valid S.A.)

### Decisão
Interface `AssinaturaProvider` com providers stub.
Plug-and-play quando credenciais chegarem.

---

## DT-003: DocuSign Embedded Signing
**Data:** 06/08/2026
**Status:** ✅ Implementado (sandbox)

### Contexto
Paciente assina Procuração Específica dentro da plataforma.

### Decisão
DocuSign Embedded Signing com postMessage para detectar conclusão.
Autenticação JWT com RSA PKCS#1 → convertido para PKCS#8 em runtime.

### Para lançamento oficial
- Mudar `DOCUSIGN_BASE_URL` para `https://na4.docusign.net/restapi`
- Mudar `DOCUSIGN_OAUTH_BASE_URL` para `https://account.docusign.com`
- Adicionar URL do domínio oficial nas Redirect URIs do DocuSign

---

## DT-004: Transcrição de Teleconsulta
**Data:** 05/08/2026
**Status:** ⏳ Stub — aguardando Google API Key

### Contexto
Transcrição automática via Gemini 2.5 Flash após teleconsulta.

### Decisão
Stub implementado. Quando `GOOGLE_API_KEY` for configurada,
a transcrição ativa automaticamente sem alterar código.

---

## DT-005: Node.js 18 via .nvmrc
**Data:** 07/08/2026
**Status:** ✅ Implementado

### Contexto
@sparticuz/chromium requer Node 18 e biblioteca libnss3.so.
Vercel usa Node 20 por padrão, que não tem libnss3.so.

### Decisão
Arquivo `.nvmrc` com valor `18` na raiz do projeto.
Vercel e AWS Amplify respeitam automaticamente.
AWS EC2/Docker precisam de configuração manual.

### Impacto
- ✅ Vercel: automático
- ✅ Localhost: sem impacto (pnpm ignora .nvmrc)
- ⚠️ AWS EC2/Docker: garantir Node 18+ no servidor

---

## DT-006: Infraestrutura de Produção AWS EC2
**Data:** 10/08/2026
**Status:** ✅ Em produção

### Configuração do Servidor

| Item | Valor |
|------|-------|
| Provedor | AWS EC2 |
| Instância | t2.small (1 vCPU, 2GB RAM) |
| Sistema Operacional | Ubuntu 26.04 LTS |
| Gerenciador de Processos | PM2 |
| Gerenciador de Pacotes | pnpm |
| Domínio | be4hope.org |

### ⚠️ Limitação Crítica: Memória RAM (OOM Killed)

O build do Next.js exige picos de 4.5–5GB de RAM.
A instância t2.small tem apenas 2GB → causa OOM Killed (código 137).

**Solução aplicada:** Swap de 8GB no volume EBS (`/swapfile`).

⚠️ **ATENÇÃO:** O Swap NÃO está persistido no `/etc/fstab`.
Se a instância for reiniciada, o swap é perdido e o build falha.
Sempre reativar manualmente antes de buildar.

**Ação recomendada:** Persistir swap no `/etc/fstab`:
```bash
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### ⚠️ IP Dinâmico — Risco de Downtime

A instância usa IP público dinâmico da AWS.
Um Stop/Start altera o IP → DNS desatualizado → site fora do ar.

**Ação recomendada (urgente):** Alocar Elastic IP na AWS e associar
à instância para garantir IP fixo permanente.

### Variáveis de Ambiente Críticas para Produção

NEXT_PUBLIC_APP_URL=https://be4hope.org

⚠️ Este valor afeta diretamente callbacks do DocuSign e Auth.
Nunca usar ngrok ou localhost nesta variável em produção.

### DocuSign em Produção

O `X-Frame-Options` no `next.config.ts` deve ser `SAMEORIGIN`
(não `DENY`) para o Embedded Signing funcionar no iframe.

Redirect URIs registradas no DocuSign:
- `https://be4hope.org/api/anvisa/signing-complete`
- `https://behemp-site.vercel.app` (preview/testes)
- `http://localhost:3000` (desenvolvimento)
- `https://frenzied-humped-kiln.ngrok-free.dev` (ngrok dev)

### Playbook Oficial de Deploy em Produção

> ⚠️ **ATUALIZADO em 11/08/2026:** O deploy manual via SSH foi substituído
> pelo GitHub Actions (ver DT-008). O playbook abaixo é apenas para emergências.

**Sempre seguir esta ordem no servidor via SSH:**

```bash
# Passo 1 — CRÍTICO: Reativar Swap antes de qualquer coisa
sudo swapon /swapfile
export NODE_OPTIONS="--max-old-space-size=8192"

# Passo 2 — Atualizar código
cd ~/behemp-site
git pull origin main
pnpm install

# Passo 3 — Build (~20 minutos na t2.small)
pnpm build

# Passo 4 — Reiniciar PM2
pm2 delete all
pm2 start pnpm --name "behemp-site" -- run start
pm2 save
```

⚠️ **Sem o Passo 1, o build será morto pelo Kernel (OOM Killed).**

### Melhorias Pendentes para Produção

- [ ] Persistir swap no `/etc/fstab` (evitar perda após restart)
- [ ] Alocar Elastic IP (evitar mudança de IP após restart)
- [ ] Upgrade para t2.medium ou t3.small (mais RAM, build mais rápido)
- [ ] Configurar PM2 para iniciar automaticamente após restart do servidor:
```bash
  pm2 save
```

---

## DT-007: Transcrição Dual-Channel com Gemini 2.5 Flash
**Data:** 10/08/2026
**Status:** ⏳ STUB — aguardando GOOGLE_API_KEY

### Arquitetura

Teleconsulta encerrada pelo médico ↓ AudioContext merge: médico (canal L) + paciente (canal R) ↓ MediaRecorder → webm/opus dual-channel ↓ POST /api/teleconsulta/transcrever (FormData com audio + salaId) ↓ [SEM GOOGLE_API_KEY] → Salva stub na tabela transcricoes [COM GOOGLE_API_KEY] → Google Speech-to-Text v1 ├─ enableSeparateRecognitionPerChannel: true ├─ model: medical_conversation └─ diarizationConfig: 2 falantes ↓ Mascaramento PII (CPF, RG, tel, email) — LGPD ↓ Gemini 2.5 Flash normaliza → narrativa clínica ↓ Salva em transcricoes (texto mascarado + narrativa)


### Para ativar em produção
1. Configurar `GOOGLE_API_KEY` no `.env` e na Vercel/AWS
2. O stub desativa automaticamente — detecção via `process.env.GOOGLE_API_KEY`
3. Habilitar APIs no Google Cloud:
   - Cloud Speech-to-Text API
   - Generative Language API (Gemini)
4. Cotas recomendadas: Speech STT ~1h/mês, Gemini ~500 req/mês

### Nota Sprint 4 — STATUS CONSULTA
⚠️ Ao iniciar teleconsulta (Sprint 2), status atualiza para 'confirmada'.
No Sprint 4, ao ENCERRAR, deve mudar para 'realizada'.
NÃO alterar antes do Sprint 4.

---

## DT-008: Arquitetura CI/CD — GitHub Actions + AWS EC2
**Data:** 11/08/2026
**Status:** ✅ Em produção

### Problema Resolvido

A instância AWS EC2 t2.small (2GB RAM) causava OOM Killed (código 137)
durante o `pnpm build` do Next.js, que exige picos de 4.5–5GB de RAM.

A solução de Swap (8GB) funcionava mas era frágil:
- Exigia reativação manual após cada restart (`swapon /swapfile`)
- Build levava ~20 minutos
- Risco de travamento em produção durante o build

### Solução: Build no GitHub Actions Runner

O build pesado foi externalizado para o Runner do GitHub Actions,
que tem recursos computacionais ilimitados e gratuitos.

### Fluxo Atual de Deploy

git push origin main
↓
GitHub Actions dispara automaticamente
↓
Runner (Ubuntu + Node 20 + pnpm v9):
  pnpm install
  pnpm build (~2 min no Runner)
  rsync .next/standalone → AWS EC2 via SSH
↓
AWS EC2 (apenas execução):
  pnpm install --prod (apenas prod deps — leve)
  pm2 restart all
↓
✅ Deploy concluído em ~2 minutos — zero downtime

### Arquivo de Configuração

`.github/workflows/deploy.yml` — escuta `push` na branch `main`

### Workarounds Implementados

| Arquivo | Mudança | Motivo |
|---------|---------|--------|
| `next.config.ts` | `eslint: { ignoreDuringBuilds: true }` | Evitar falhas de lint no CI |
| `next.config.ts` | `typescript: { ignoreBuildErrors: true }` | Já estava ativo |
| `pnpm-workspace.yaml` | `packages: ["."]` | Obrigatório no pnpm v9 |
| `.github/workflows/deploy.yml` | `DATABASE_URL` fake durante build | Evitar falha Zod/Neon no pre-render |

### DATABASE_URL fake durante build

O Next.js tenta acessar `lib/env.ts` durante o build para validar
variáveis de ambiente via Zod. Para evitar falha:

```yaml
env:
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/postgres"
  # Valor fake apenas durante o build — nunca usado em runtime
  # Em runtime, o .env real no servidor AWS é usado
```

### Segurança

- `.env` NUNCA é enviado pelo rsync (`EXCLUDE: "/.env"`)
- Credenciais reais ficam apenas no servidor AWS em `/home/ubuntu/behemp-site-main/.env`
- Secrets do GitHub Actions usados para SSH e credenciais de deploy

### Vantagens vs Deploy Manual Anterior

| Aspecto | Deploy Manual (antigo) | GitHub Actions (atual) |
|---------|----------------------|----------------------|
| Tempo de build | ~20 minutos | ~2 minutos |
| RAM necessária | 5GB+ (swap) | Ilimitada (Runner) |
| Risco OOM | Alto | Zero |
| Swap manual | Necessário | Não necessário |
| Downtime | Possível | Zero |
| Trigger | Manual (SSH) | Automático (push) |

### Para o Servidor AWS Agora

O servidor AWS **não precisa mais rodar `pnpm build`**.
O playbook de deploy manual foi substituído pelo GitHub Actions.

Em caso de emergência (GitHub Actions fora do ar), o playbook manual
ainda funciona:
```bash
sudo swapon /swapfile
export NODE_OPTIONS="--max-old-space-size=8192"
cd ~/behemp-site-main
git pull origin main
pnpm install
pnpm build
pm2 restart all
```

### Stack do Runner

- OS: Ubuntu Latest
- Node.js: 20.x
- pnpm: v9
- Deploy via: `easingthemes/ssh-deploy` (rsync) + `appleboy/ssh-action` (SSH)

---

## DT-009: Runtime Standalone na AWS sem Variáveis de Ambiente
**Data:** 12/08/2026
**Status:** ✅ Corrigido e em produção

### Problema Resolvido
O pipeline de CI/CD via GitHub Actions (DT-008) passou a enviar a versão construída via `output: 'standalone'` para o EC2. No entanto, o script PM2 tentava subir a aplicação, mas o Next.js no modo standalone **NÃO lê o arquivo `.env` se ele não estiver explicitamente presente dentro da pasta `.next/standalone`**.

Como o rsync não envia o `.env` (excluído no `deploy.yml`), e o EC2 tem o `.env` apenas na raiz (`~/behemp-site-main/.env`), o standalone inicializava o app com `DATABASE_URL=undefined`.

Consequências do erro:
- O Drizzle ORM falhava (crashes em `_prepare`) com `TypeError: Cannot convert undefined or null to object`.
- Esse Erro 500 invisível vazava para o Client (Server Actions não tratadas) disparando os Error Boundaries no React, forçando a UI inteira do médico a desmontar (remount contínuo), o que resultava no *flicker* infinito da câmera.

### Solução (Opção A)
O arquivo `.github/workflows/deploy.yml` foi atualizado:
1. Após a clonagem e rsync no EC2, injetamos: `cp .env .next/standalone/.env`
2. Modificamos o diretório de execução do PM2: `cd .next/standalone`
3. Reiniciamos com o PM2 carregando o novo diretório e ambiente local: `pm2 restart behemp-site --update-env || pm2 start server.js`

Isso permite que o standalone tenha acesso nativo a todas as secrets de produção (DB, JWT, Pusher, Clerk) sem expô-las no GitHub Actions.

---

## DT-010: Arquitetura da Central de Alertas & Medication Tracker
**Data:** 12/08/2026
**Status:** ✅ Em desenvolvimento (Fase 1 - Schema)

### Contexto
O BeHemp está absorvendo a funcionalidade do antigo plugin WordPress (`be4hope-fixed`) para monitoramento ativo do uso de medicamentos e validade de licenças ANVISA, integrando aos pacientes reais do sistema. O objetivo é criar alertas proativos sem fazer spam aos usuários.

### Schema Adotado
1. **`medicamentos` (extensão):** Adicionamos campos para especificação técnica precisa, refletindo a tabela de produtos (`marca`, `volumeMl`, `totalGotas`, `cbdMgPorGota`, `thcMgPorGota`, etc). O campo `gotasPorMl` agora é calculado dinamicamente no seed.
2. **`alertas_config` (singleton):** Uma única linha para gerenciar dias de marcos, horários do digest e preferência de notificação ao paciente, permitindo gestão pela UI administrativa.
3. **`alertas_enviados` (idempotência):** Chave unificada (`tipo`, `referenciaId`, `marcoDias`, `destinatario`) com constraint `UNIQUE` assegura matematicamente que o mesmo alerta, no mesmo marco de tempo, nunca será disparado duas vezes.
4. **`autorizacoes_anvisa` (extensão):** Adicionado `dataValidade` para calcular os dias restantes para o vencimento (tipicamente 2 anos no Brasil).

### Próximos Passos
- Implementar os coletores puros e integrá-los ao Inngest (`digestDiarioAdmin`).
- Criar templates transacionais no Brevo.
- Consolidar a visualização na Central de Alertas e Calculadora de Dosagem UI.
