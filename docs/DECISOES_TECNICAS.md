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
