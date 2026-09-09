# Sprint 1 — Auditoria da teleconsulta: descobrir o que está de pé

> **Objetivo:** quando esta sprint acabar, sabe-se **o que funciona e o que não funciona** na
> teleconsulta, com `caminho:linha` — e a mídia da consulta deixa de atravessar um relay
> público de terceiro.

**ADRs:** nenhuma nova. Precede a Metade 1 porque metade das telas novas encosta aqui.

**Por que antes da Metade 1:** ligar inteligência a um módulo de estado desconhecido significa
que, na primeira falha, ninguém sabe se a culpa é da IA ou do WebRTC que já estava quebrado.

**Por que é possível corrigir, e não só catalogar:** a teleconsulta **nunca foi usada de
verdade** (`DO-02`). Sem uso clínico real, o perigo de mexer é baixo — a exceção do repositório,
não a regra.

## Entregáveis

| # | entregável | referência |
|---|---|---|
| 1 | Auditoria de leitura dos **9 componentes (3.141 linhas)**, 4 route handlers, 4 actions e 2 páginas | `components/teleconsulta/` · `app/api/teleconsulta/` |
| 2 | Diagnóstico de cada defeito com `caminho:linha` e perigo medido | `04-LISTA-DE-AFAZERES.md` |
| 3 | 🔴 **Substituir o TURN público** `openrelay.metered.ca` com credencial `openrelayproject` | `GlobalTeleconsultaHost.tsx:190-196` |
| 4 | Guarda que falha se voltar TURN de terceiro sem contrato ou credencial hardcoded | `__tests__/guardas/` |
| 5 | Matriz de navegador/dispositivo verificada — em especial **Safari/iOS**, onde WebRTC mais quebra | `GAP-08` |
| 6 | Verificação do consentimento LGPD: `consentimentoLgpd` e `consentimentoObtido` existem em schema — confirmar que são **exigidos**, não só armazenados | `db/schema/teleconsultas.ts` |

## Critério de aceite

**Em execução desde 20/08/2026.** A auditoria de leitura achou mais do que o esperado: uma
**classe** de defeito de autorização com 7 ocorrências, corrigida e coberta por guarda.

- [ ] uma teleconsulta completa roda de ponta a ponta em ambiente de desenvolvimento, com evidência
      — 🔴 **bloqueado**: sem credenciais de desenvolvimento (`GAP-09`)
- [x] nenhuma credencial de terceiro hardcoded em `components/teleconsulta/` — ✅ **feito
      20/08**. O dono escolheu **Cloudflare Realtime TURN** entre 4 opções comparadas com
      preço. A credencial saiu dos **dois** arquivos e passou a ser **efêmera**, gerada em
      `/api/teleconsulta/ice-servers` e entregue só a quem está na sala
- [x] o guarda do entregável 4 (TURN) prova vermelho por sabotagem — ✅ **5 sabotagens
      vermelhas**. Nasceu **verde**, porque foi escrito **depois** da correção: guarda para
      violação não corrigida nasce vermelho e fica vermelho
- [x] cada defeito encontrado está em `04` com `caminho:linha`, mesmo os não corrigidos —
      **Itens 11 e 12 escritos**, Item 8 corrigido (o TURN está em **2** arquivos, não 1)
- [x] transcrição: a PII **continua mascarada** antes do Gemini, e a versão mascarada é a
      persistida ✅. Mas o comentário promete mais do que o código faz, e o áudio bruto vai ao
      **Google STT antes** de qualquer máscara — [04 — Item 12](../04-LISTA-DE-AFAZERES.md)

### 🔴 O que a auditoria encontrou, e que não estava previsto

**Item 11 — uma classe de defeito de autorização, 7 ocorrências, CORRIGIDA em 20/08.**
`app/api/pusher/auth/route.ts:72-80` autorizava **qualquer** usuário autenticado em **qualquer**
sala, e `sinalizar/route.ts` aceitava `roomId` do body. Juntos: assistir a consulta médica
alheia. Corrigido com helper único `garantirDonoDaSala` e guarda de **19 casos**, nascido
vermelho nas 7 e provado por **8 sabotagens** — uma delas sobreviveu na primeira rodada e o
furo do guarda foi fechado.

Respostas aos entregáveis que a auditoria mudou:

| entregável | resposta medida |
|---|---|
| 6 — consentimento é exigido ou só armazenado? | 🔴 **pior: não é obtido.** `GlobalTeleconsultaHost.tsx:83` é `useState(true)`, sem setter e sem UI. **Precisa de decisão do dono** |
| 1 — quantas implementações de WebRTC? | **três**, não uma: o host global, a página do paciente, e `app/(medico)/medico/teleconsulta/page.tsx:160` (só STUN, provável legado) |
| — auditoria LGPD | a tabela **tem** `userId` e `ip`; nenhuma das 4 chamadas os passava. Corrigido: passou a usar `registrarAuditoria`, que o resto do repositório já usa |

## Não entra

- 🛑 **Redesenho visual da teleconsulta.** `DO-12`: o design atual permanece. Esta sprint é
  funcional, não estética.
- Copiloto clínico com IA — é Metade 2.
- Trocar WebRTC nativo por SDK de terceiro: seria ADR própria, e nada indica que é necessário.
- Corrigir os uploads em store público fora da teleconsulta (Item 6, autorização própria).

## Bloqueios

| bloqueio | de quem | enquanto isso |
|---|---|---|
| credenciais de desenvolvimento (Pusher, Gemini, Clerk, Neon) | dono (`GAP-09`) | auditoria estática, que já produz boa parte do diagnóstico |
| escolha do TURN novo — serviço gerenciado com contrato **ou** `coturn` próprio | decisão com custo | catalogar e propor as duas opções com preço |

⚠️ **O TURN é decisão de operador de dados**, não só de infraestrutura: por ele passa mídia de
consulta médica. Serviço novo com dado pessoal exige base legal — mesma trilha do `GAP-06`.
