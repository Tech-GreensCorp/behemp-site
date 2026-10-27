# ADR-0032 — O admin registra a assinatura do comunicado quando o paciente assinou por outra plataforma

> **Status:** ✅ **implementada** — 27/10/2026, a pedido de **Dryelle** ("ajuste urgente"). Provada contra um
> Postgres real local (28 casos de integração) e por guarda estrutural; **nada disto foi verificado em
> produção nem no navegador** (§6).
>
> **Contexto em uma linha:** o paciente assinou a carta "Atualização do Programa de Doação" por **outra
> plataforma** e mandou o arquivo pelo WhatsApp; o sistema só marcava `assinado` pela confirmação do
> DocuSign, então o card do admin seguia "pendente" e o dashboard do paciente seguia com o aviso grande
> "você tem um documento para assinar".
>
> **Princípios:** A (segurança e LGPD são requisito), E (decisão com alternativa rejeitada). **Fase:** 2.
> **Fundamento:** o próprio código (`lib/comunicados/assinatura.ts`, guarda
> `o-comunicado-assina-so-pelo-docusign`) e o Postgres local. **Nenhuma norma externa foi citada** — a
> validade jurídica de uma assinatura atestada pelo admin é pergunta aberta (§5).

## §1 — O que a regra anterior dizia, e por que ela precisa de uma exceção

`assinatura.ts` abre com: _"QUEM DIZ QUE ASSINOU É O DOCUSIGN, e só ele."_ O retorno do paciente e o corpo do
webhook são gatilhos; só a resposta da API do DocuSign muda o banco. A regra existe por um motivo bom (um
webhook forjado não marca nada), e **continua valendo** para tudo que passa pelo DocuSign.

O que ela não previa: a assinatura acontecer **fora** do DocuSign. Nesse caso nenhum envelope será concluído, e
o comunicado fica `pendente` para sempre — com e-mail, card e aviso cobrando uma assinatura que já existe.

## §2 — Decisões

**D-01 — Uma exceção, estreita, só do admin.** `registrarAssinaturaManual` (`lib/comunicados/assinatura.ts`)
transiciona **só de `pendente`**, com `UPDATE ... WHERE status = 'pendente'`. Nunca sobrescreve um `assinado`
(inclusive o que o webhook marcou um instante antes), nunca reabre `recusado`, `erro` ou `cancelado`. A rota
`POST /api/comunicados/[id]/assinatura-manual` exige `verificarAdmin()`; quem não é admin recebe **404**, nunca
403 (sem oráculo de ids).

**D-02 — A MESMA linha, nenhum documento novo.** O registro atualiza a linha do envio (`status`, `assinadoEm`,
`urlPdfAssinado`). Não cria comunicado nem linha em `documentos`: o índice único parcial
(`comunicados_assinatura_ativo_unq`) segue valendo, e o paciente vê **um** documento — o mesmo cartão
"Comunicados" da tela Documentos, agora `Assinado`, com "Ver documento assinado". É o que o fluxo DocuSign já faz.

**D-03 — Marcado como manual, e rastreável.** Migration **aditiva** `0054` (4 colunas nulas, nenhuma
alteração nem remoção): `registro_manual_em`, `registro_manual_por_user_id`, `registro_manual_observacao`,
`registro_manual_nome_arquivo`. `registro_manual_em` preenchido = registro manual. Mais a auditoria
(`logs_auditoria`, `acao: 'atualizar'`, `dadosAntes` e `dadosDepois` com `origem: 'registro_manual'`). O admin vê,
no card, **"Registrado manualmente por X em Y"** — e não "confirmada pelo DocuSign".

**D-04 — Não finge ser DocuSign.** As duas travas de e-mail (`email_confirmacao_paciente_em`,
`email_notificacao_docs_em`) nascem **preenchidas**: nenhum e-mail de "confirmação" sai, nem a notificação a
docs@ (que cita o "envelope"). E `finalizarAssinatura` **sai cedo** para um registro manual: se o paciente
também assinar o envelope aberto, o webhook tardio não baixa outro PDF por cima nem manda e-mail.

**D-05 — O arquivo é conferido no servidor.** `identificarArquivoDaAssinatura` (`lib/comunicados/registro-manual.ts`)
exige o tipo declarado (PDF, JPG ou PNG) **e** a assinatura dos bytes (`%PDF`, `\x89PNG`, `\xFF\xD8\xFF`). O
`file.type` vem do navegador e não prova nada: um executável declarado como PDF é recusado. Limite de 10 MB,
conferido **antes** de o arquivo ir para a memória. Vai para o store **privado** (`guardarDocumentoPrivado`).

**D-06 — A data da assinatura é informada e validada.** O paciente assinou antes de o admin registrar; gravar
"agora" como `assinadoEm` seria mentir na tela. A data não pode estar no futuro (em Brasília, não em UTC), tem de
existir (`2026-02-30` é recusado) e é guardada ao **meio-dia** de Brasília, para não escorregar de dia.

**D-07 — A entrega serve o tipo REAL.** `/api/comunicados/[id]/arquivo` fixava `application/pdf`. Um JPG mandado
pelo WhatsApp abriria quebrado; a rota agora usa o `contentType` guardado.

**D-08 — Perder a corrida é seguro.** O blob é guardado antes do `UPDATE`. Se o `UPDATE` não pegar linha
(webhook ou outro admin mudaram o status no meio), o blob é recolhido (`apagarDocumentoPrivado`) e a resposta é
"o comunicado mudou de situação". Provado com a corrida simulada (§6).

## §3 — Rejeitado, e por quê

- **Inserir também uma linha em `documentos` (`contrato_termos`).** O pedido dizia "salvar na seção Documentos" e
  "sem duplicar documentos". Duas linhas apontando para o mesmo arquivo exibiriam o documento **duas vezes** na
  tela Documentos do paciente, e o comunicado assinado pelo DocuSign **também não** tem linha em `documentos`.
  Uma exceção que se comporta diferente do caso normal é uma exceção que quebra relatório. **Se a equipe
  quiser o arquivo também na lista "Contrato e termos" da ficha, é decisão de negócio (§5).**
- **Reaproveitar `docusign_status` com um valor `registro_manual`, sem migration.** Funcionaria, mas "quem
  registrou" e "a observação" só existiriam no log de auditoria — consultável, não visível no card. A
  rastreabilidade foi requisito explícito; 4 colunas nulas custam pouco e têm precedente (migration `0052`).
- **Novo valor no enum de status (`assinado_manual`).** Todo `status = 'assinado'` do código (índice único
  parcial, lista do paciente, aviso do dashboard, reinício) passaria a precisar conhecer o valor novo — e cada um
  que esquecesse deixaria o card pendente. Um só estado `assinado` mantém as telas coerentes sem tocar nelas.
- **Mandar o e-mail de confirmação ao paciente.** O paciente já assinou e já sabe; o e-mail diria "recebemos sua
  assinatura pelo DocuSign", o que é falso. Se a equipe quiser um aviso próprio, é texto novo (§5).
- **Anular o envelope no DocuSign ao registrar.** Não há função de anulação na integração (`docusign-service.ts`)
  e criá-la é trabalho próprio. O envelope fica aberto; D-04 impede que um webhook tardio faça mal.

## §4 — O que mudou de comportamento (para quem consome)

- **Admin:** na aba Documentos do paciente, o card do comunicado pendente ganha **"Registrar assinatura
  manualmente"**, ao lado de "Reenviar e-mail". O diálogo pede o arquivo, a data em que o paciente assinou e uma
  observação opcional.
- **Paciente:** nada novo na tela. Ao confirmar o registro, o **aviso grande do dashboard some** (ele só conta
  `pendente`, lido do mesmo banco) e a tela Documentos mostra `Assinado` com "Ver documento assinado".
- **Guardas:** `o-comunicado-assina-so-pelo-docusign` deixou de afirmar _"uma escrita de `assinado`"_ e passou a
  exigir **duas, nomeadas** (DocuSign e registro manual), a segunda só dentro de `registrarAssinaturaManual` e só
  chamada pela rota do admin. Um corte quebrado desse mesmo guarda (`// ── Leituras` nunca existia depois de
  tirar os comentários, então o `slice` ia até o fim do arquivo) foi corrigido para cortar na próxima função.

## §5 — Em aberto e catalogado (**não presumido**)

1. **Validade jurídica.** Uma assinatura feita fora do DocuSign e **atestada pelo admin** não tem a prova de
   integridade do envelope. O sistema guarda o arquivo, quem registrou e quando; se isso basta para o programa é
   decisão do Jurídico, não de TI.
2. **Aparecer também em "Contrato e termos"** na ficha (a linha de `documentos` rejeitada em §3).
3. **Aviso próprio ao paciente** ("registramos a sua assinatura") — hoje nenhum e-mail sai.
4. **Registrar a partir de outros estados** (`erro`, `recusado`, "Não enviado"): hoje só `pendente`, que é o caso
   pedido.
5. **O envelope aberto no DocuSign** segue aberto, e o paciente ainda poderia assiná-lo. Anulá-lo exige uma
   função nova na integração.
6. **Retenção** do arquivo: prazo é decisão jurídica e continua sem coluna (igual ao PDF do DocuSign).

## §6 — O que foi provado, e o que **não** foi

**Provado, contra Postgres 16 local (Docker), com DocuSign, e-mail e store simulados — 28 casos:** o fluxo
completo (pendente → registro → `assinado` na mesma linha, 1 linha só, 1 arquivo guardado); o admin vê "manual"
por quem e quando; o paciente vê `assinado` e o filtro do aviso do dashboard dá 0; o arquivo abre para o admin e
o paciente dono e dá 404 para outro paciente e para médico; PNG abre como PNG; o webhook tardio não manda e-mail
nem troca o arquivo; auditoria gravada; reiniciar o fluxo preserva tudo; médico/paciente/sem sessão recebem 404;
`assinado`, `recusado`, `erro` e `cancelado` recusam o registro; registro de um paciente não toca no de outro;
PNG declarado como PDF, executável, tipo fora da lista, sem arquivo, 10 MB + 1, data futura, `2026-02-30`,
observação > 500 → recusados; a corrida com o DocuSign recolhe o blob.

**Provado por sabotagem:** sem a condição `pendente` no `UPDATE` → o caso da corrida fica vermelho; sem as duas
travas de e-mail **e** sem a saída cedo de `finalizarAssinatura` → o webhook tardio manda e-mail e o caso fica
vermelho; cada uma das duas sozinha é pega pelo guarda estrutural (defesa em profundidade, e por isso o caso
comportamental só enxerga a falha quando as duas somem).

**NÃO provado:** o **clique** no diálogo (sem sessão do Clerk local, a tela não foi renderizada nem o upload
feito pelo navegador); o **store privado real** (Vercel Blob) — o store foi simulado; o **DocuSign real**; e o
deploy. A migration `0054` é aditiva, mas **foi aplicada só no banco local** (`drizzle-kit push`): em produção ela
roda no passo de migration do deploy, sem rollback.
