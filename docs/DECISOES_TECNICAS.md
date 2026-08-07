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
