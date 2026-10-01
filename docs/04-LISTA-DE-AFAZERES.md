# Lista de Afazeres — Be4Hope / BeHemp

> Diz **como**. Cada item traz **diagnóstico** e **evidência no código**.
> O _o quê/quando_ está no [Checklist](03-CHECKLIST-MESTRE.md). O _por quê_ em [adr/](adr/).
>
> **Regra:** nada entra aqui sem `caminho/arquivo.ts:linha`. Item sem evidência é palpite, e
> palpite faz quem pegar começar do zero.

**Atualizado em 20/08/2026.**

> Os itens abaixo foram diagnosticados em 19–20/08/2026 e **todos são deste repositório**.
>
> ⚠️ **A numeração tem um vão: não existe Item 5.** Ele era de um domínio que saiu deste
> repositório. Os números **não** foram reaproveitados de propósito — o Item 6 já é citado como
> "Item 6" no checklist, no handoff e em `.claude/rules/seguranca-lgpd.md`, e renumerar
> quebraria essas citações. Nenhum foi corrigido: são dívida catalogada, aguardando autorização. Cada um
> traz o **perigo de mexer medido** — quantos pontos de chamada, se está em produção, e se
> existe teste que prove o antes e o depois.

---

## ✅ Item 80 — EM PRODUÇÃO, 01/10/2026 (PR #149): a câmera do paciente ficava por baixo da espera da teleconsulta

**Status:** achado ao medir a D-30 no Chromium; corrigido a pedido de Davi (_"o funcionamento tem que ser
normal"_). Em [ADR-0029 §12.8](adr/ADR-0029-a-anvisa-abre-no-faco-eu-mesmo-e-a-procuracao-e-ativada-pelo-admin.md).

`app/(paciente)/paciente/teleconsulta/[roomId]/page.tsx`: a espera (`absolute inset-0 … z-[1]`) cobria a
câmera do paciente (`absolute bottom-6 right-6 …`, sem z-index), desde `8ee8e5c` (13/08/2026). Em
produção, o paciente não via a própria câmera até o médico entrar. A correção de 10/09 foi só do lado do
médico. **Agora:** `z-10` na câmera; guarda `a-sala-nao-esconde-os-proprios-controles` com o caso do
paciente, vermelho antes, e 3 sabotagens. **Perigo medido:** uma classe numa div; nada mais na tela usa
z-index entre 1 e 10.

---

## ✅ Item 79 — EM PRODUÇÃO, 01/10/2026 (PR #149): a espera da teleconsulta

**Status:** pedido de Davi (`DO-88`), decisão em
[ADR-0029 §12.8, D-30](adr/ADR-0029-a-anvisa-abre-no-faco-eu-mesmo-e-a-procuracao-e-ativada-pelo-admin.md).

**Antes:** `components/teleconsulta/GlobalTeleconsultaHost.tsx` mostrava "Conectando à sala..." (ícone
girando) e "Aguardando paciente entrar na sala..."; a página do paciente, um spinner com "Aguardando
médico...". **Agora:** `components/teleconsulta/EsperaDaTeleconsulta.tsx`, com as peças da espera do
atendimento no tom escuro. **O que ficou:** sem "conectando" e sem "os dois, ligados" na teleconsulta,
porque ela não sabe quando o outro chegou nem quando a câmera dele desliga; criar isso é mexer na
sinalização. A sala real (Pusher, TURN, dois aparelhos) só produção prova.

---

## ✅ Item 78 — EM PRODUÇÃO, 01/10/2026 (PR #148): conectado sem vídeo estático, e o palco quebrando em janela estreita

**Status:** relatado por Davi com seis capturas de produção (Chrome e Firefox lado a lado).
Corrigido e provado local; decisão em
[ADR-0029 §12.7, D-29](adr/ADR-0029-a-anvisa-abre-no-faco-eu-mesmo-e-a-procuracao-e-ativada-pelo-admin.md)
(`DO-87`). **Em produção** pelo PR #148 (`39d1508`), testado e aprovado por Davi em 01/10/2026.

**Causa medida:** o palco usava `md:aspect-video` com `overflow-hidden` e altura fixa pela largura.
Em ~820 px de janela, 16:9 dava ~260 px, menos que o conteúdo da espera: a orbe saía cortada e a dica
ficava por baixo do indicador do microfone. Reproduzido no Chromium em 800, 900 e 1024 px antes da
correção. O "sem câmera" de `conectado` era o bloco estático de 30/09, fora do canvas.

**O que mudou:** `components/atendimento/EsperaDaChamada.tsx` (`PALCO`, `OsDois`, `Textos`,
`ChamadaSemVideo`), `ChamadaDeAtendimento.tsx` (o ramo `sem-camera` usa `ChamadaSemVideo`),
`app/globals.css` (+4: `.espera-track.espera-ligado`), guarda com +4 casos.

**O que ficou:** Firefox e Safari não medidos; o harness roda só Chromium.

---

## 🟠 Item 77 — CATALOGADO, 01/10/2026: com a sessão fora do repositório, os dois hooks bloqueiam tudo

**Status:** achado durante a D-28 da ADR-0029. **Não corrigido: hook é área protegida, e mexer pede
autorização.**

`.claude/settings.json:9` e `:20` rodam
`python3 "$(git rev-parse --show-toplevel 2>/dev/null || echo .)/.claude/hooks/<hook>.py"`. A raiz
sai do **diretório atual** do shell. Um `cd` para fora do repositório (no caso, o scratchpad da
sessão, que é o lugar recomendado para arquivo temporário) faz o `git rev-parse` falhar, o
`|| echo .` aponta para o próprio scratchpad, o `python3` não acha o arquivo, e **todo** `Bash` e
todo `Write` passam a ser recusados, inclusive o `cd` de volta. A sessão só voltou com o dono
digitando `! cd /home/DK/Developer/Projects/behemp-site`.

O defeito falha **fechado**, o que é o lado seguro: nada passou sem o hook. O custo é travar a sessão.
**Correção provável:** ancorar no `$CLAUDE_PROJECT_DIR`, que a doc de hooks do Claude Code expõe para
isso, com o `git rev-parse` como reserva. [inferência: não li a doc nesta sessão; conferir antes].
**Perigo de mexer:** baixo no código (duas linhas de configuração), mas o guarda
`hooks-de-escopo` precisa ganhar um caso que rode o hook com o diretório atual fora do repositório,
nos dois lados (`.ts` e `.sh`, `DO-19`).

---

## ✅ Item 76 — EM PRODUÇÃO, 01/10/2026 (PR #147): a espera da chamada não diz mais "sem câmera" a quem nem chegou

**Status:** implementado e provado local, aprovado por Davi (`DO-86`). Decisão e provas em
[ADR-0029 §12.6, D-28](adr/ADR-0029-a-anvisa-abre-no-faco-eu-mesmo-e-a-procuracao-e-ativada-pelo-admin.md).
**Em produção** pelo PR #147 (`3a464f2`), testado e aprovado por Davi em 01/10/2026.

**O defeito:** `components/atendimento/ChamadaDeAtendimento.tsx:640-651` (antes da mudança) dizia
_"{outro} está sem câmera e não está mostrando a tela"_ em toda fase sem destaque, inclusive antes de o
outro lado entrar.

**O que mudou:** `lib/atendimento/espera.ts` (a regra do palco, a altura das barras e o contador,
puros); `components/atendimento/EsperaDaChamada.tsx` (novo); `app/globals.css` (+283 linhas, no fim,
com o prefixo `espera-`); `ChamadaDeAtendimento.tsx` (+42 / −10: o palco pela regra, o cabeçalho, e a
faixa do microfone em estado). Guarda `__tests__/guardas/a-espera-da-chamada-diz-a-verdade.test.ts`.

**O que ficou:**

- a tela com login e o Pusher real só se veem em produção (sem `CLERK_SECRET_KEY` local);
- a regra global de `app/globals.css:381-389` justifica todo `<p>` no celular. O texto "sem câmera"
  de `conectado`, que já existia, continua justificado no celular. Não corrigi: é anterior e fora do
  escopo;
- a moldura do palco, o cabeçalho e os botões diferem do canvas no raio, na borda e no formato. A
  tabela está na D-28. Mexer neles é pedido próprio.

---

## 🟠 Item 75 — CATALOGADO, 01/10/2026: a Política de Privacidade não lista quem recebe dados do paciente

**Status:** achado ao preparar o documento do Jurídico
([`levantamentos/CONSENTIMENTOS-E-LGPD-PARA-O-JURIDICO.pdf`](levantamentos/CONSENTIMENTOS-E-LGPD-PARA-O-JURIDICO.pdf),
perguntas J-15 a J-17). **Não corrigido: o texto é decisão do Jurídico.**

`app/(public)/politica-de-privacidade/page.tsx:197-205` lista Neon, Clerk, Brevo, Pusher, médicos e
Anvisa, e afirma que _"todos os terceiros mencionados possuem contratos de proteção de dados"_. Não
lista a Greens Corp (`lib/parceiros/`), o Google Speech-to-Text e o Gemini (`app/api/teleconsulta/transcrever/route.ts`),
o DocuSign, o Mercado Pago, o WhatsApp/ChatPro, a AWS nem o armazenamento da Vercel. Última
atualização declarada: 11/05/2026 (`:404-405`). Os Termos não têm data nem versão. O controlador
também diverge entre fontes: `CONTROLADOR` está `[PENDENTE]` em `lib/lgpd/consentimento.ts:44-50`, a
procuração nomeia a Associação Behemp, CNPJ 07.578.940/0001-01 (`lib/receituario/procuracao-pdf.tsx:165-167`),
e a Política dá `privacidade@be4hope.org` como canal do encarregado (`page.tsx:466-468`). **Perigo de
mexer:** baixo no código; a mudança de texto pode exigir aviso a quem já aceitou (J-15).

---

## 🟠 Item 74 — CATALOGADO, 01/10/2026: "Excluir Minha Conta" promete apagar todos os dados e mantém

**Status:** catalogado, **não corrigido**; pergunta J-12 do documento do Jurídico.

A tela pergunta _"Você realmente deseja excluir permanentemente sua conta e todos os dados associados a
ela?"_ (`app/(paciente)/paciente/perfil/page.tsx:950`). `excluirMinhaConta`
(`app/_actions/perfil-paciente.ts:234-266`) apaga o usuário no Clerk e faz **soft delete** de `users` e
`pacientes`. Documentos, consentimentos, prontuário e o que foi à Greens ficam. Manter pode ser o
certo (prontuário tem guarda mínima por norma do CFM), mas o texto promete o contrário: risco de
`LGPD-02`. **Perigo de mexer:** baixo no texto; o que a exclusão deve fazer é decisão jurídica.

---

## 🔴 Item 67 — CATALOGADO, 01/10/2026: em produção, o botão "Entrar na Consulta" do paciente espera um aceite que a tela não pede

**Status:** achado no levantamento dos consentimentos pedido por Davi
([`levantamentos/LEVANTAMENTO-DOS-CONSENTIMENTOS.pdf`](levantamentos/LEVANTAMENTO-DOS-CONSENTIMENTOS.pdf)).
**Lido, não medido**, e não corrigido.

**O que acontece, pela leitura:** `CONSENTIMENTO_PRONTO_PARA_USO = false` (`lib/lgpd/consentimento.ts:164`)
faz `consentimentoPodeSerColetado()` devolver `false` em produção (`:191-196`). O componente
`components/teleconsulta/Consentimento.tsx` então mostra "Consulta por vídeo indisponível" (`:213-226`),
mas antes já chamou `onMudanca?.(d.autorizado)` (`:163`) com `autorizado = consentTeleconsultaOk`, que é
`false` sem aceite gravado e sem emergência (`lib/auth/escopo-sala.ts:129-132`). O botão
`app/(paciente)/paciente/teleconsulta/[roomId]/page.tsx:368-375` fica desabilitado com "Autorize acima
para entrar". `declararEmergenciaMedica` (`app/_actions/consentimento-teleconsulta.ts:246`), que dispensa o
aceite, **não tem chamador**. O portão é só no navegador: nenhuma rota do servidor confere a C1.

**A medir (só Davi ou Diniz):** se há teleconsultas por vídeo acontecendo em produção, ou se o
atendimento passa pelo Google Meet do Google Agenda. **Perigo de mexer:** médio. Tela clínica em
produção, decisão de norma (`CFM-01`) e de negócio: esperar o texto revisado ou destravar antes. Não se
presume.

---

## 🟠 Item 68 — CATALOGADO, 01/10/2026: o aceite da IA libera o navegador antes de o outro lado aceitar

**Status:** catalogado, **não corrigido**. Hoje desligado em produção (Item 67, mesmo portão).

`components/teleconsulta/Consentimento.tsx:193-195`: depois de `registrarConsentimentoIa`, chama
`onMudanca?.(true)` sem conferir se o outro lado aceitou, e o estado só é lido uma vez (`:146-178`). No
médico, isso liga `consentimentoIaLiberadoRef`, e o `MediaRecorder` nasce (`GlobalTeleconsultaHost.tsx:218`)
e envia (`:374`) sem o aceite do paciente; ou nunca liga, se o paciente aceitar depois. O servidor
continua barrando: `app/api/teleconsulta/transcrever/route.ts:44-51` responde 403 sem os dois aceites.
**Perigo:** médio; captura local de áudio sem a base da ADR-0007, sem envio. Vizinho do Item 61.

---

## 🟠 Item 69 — CATALOGADO, 01/10/2026: a finalidade "avaliação médica" promete na tela um efeito que não existe

**Status:** catalogado, **não corrigido**; desfecho é decisão do dono.

`lib/parceiros/consentimento.ts:94-97` diz, se recusada: _"Sem isto não conseguimos agendar a sua
consulta."_ Nenhum portão lê `avaliacao_medica` (medido com `rg`: só listas, rótulos e Zod; os outros
resultados são o enum de **jornada**). `apoio_anvisa` só decide se `ConsentimentoQueFaltou` aparece
(`lib/parceiros/consentimento-pendente.ts:43-44`), e esse bloco mostra as **três** caixas
(`components/paciente/ConsentimentoQueFaltou.tsx:95`). Texto que promete o que o sistema não faz é o
risco de `LGPD-02`. **Perigo de mexer:** baixo no código, mas mudar o texto exige **versão nova**
(`VERSAO_DO_CONSENTIMENTO`, `:28`) e muda o que a Greens recebe no S2: atravessa a Ponte.

---

## 🟠 Item 70 — CATALOGADO, 01/10/2026: o "Li e concordo" do `/registrar-se` não é gravado, e o Google não passa por ele

**Status:** catalogado, **não corrigido**.

`app/(auth)/registrar-se/[[...sign-up]]/page.tsx:277-279` recusa sem `aceitouTermos`, mas
`signUp.create` (`:291-298`) não leva o aceite, e nenhuma tabela o guarda: não se prova quem aceitou nem
qual versão dos Termos. `handleGoogleSignUp` (`:378-392`) não confere a caixa. Os Termos dizem que o "uso
continuado" é aceite (`app/(public)/termos-de-uso/page.tsx:325-326`). **Perigo:** médio; a mesma tela do
Item 64, que ninguém mediu ainda.

---

## 🔴 Item 71 — CATALOGADO, 01/10/2026: o retorno do OAuth do Google Agenda grava o token no médico que a URL disser

**Status:** catalogado, **não corrigido**.

`app/api/auth/google/callback/route.ts:21` lê `state` como `medicoId`, sem assinatura, e `:38` faz
`update(medicos).set({ googleRefreshToken }).where(eq(medicos.id, state))` **sem conferir a sessão**.
Quem souber o id de um médico pode concluir o OAuth com a própria conta Google e ligar a própria agenda
ao cadastro dele: os Meets das consultas pagas nascem nela (`lib/agendamento/confirmar-consulta-paga.ts:151-175`).
É OWASP API1 (escopo de objeto) e CSRF de OAuth. A rota redireciona para `/medico/configuracoes`, e a
tela que conecta é `/medico/perfil`. Há um segundo callback, `app/api/webhooks/google/callback/route.ts`,
com TODO e sem gravar nada. **Perigo de mexer:** baixo (uma rota, um chamador); exige `state` assinado e
sessão do médico.

---

## 🔴 Item 72 — CATALOGADO, 01/10/2026: a procuração pode ser marcada como enviada sem DocuSign, e o retorno do DocuSign não é assinado

**Status:** catalogado, **não corrigido**.

- `app/api/webhooks/docusign/route.ts:18-21`: a validação HMAC é `TODO`. Qualquer chamada muda o
  estado da assinatura.
- `app/api/anvisa/upload-documento/route.ts:16`, `:72-79`: o `tipo` vem do formulário sem lista, e
  `procuracao_especifica` entra como `enviado: true` com um arquivo qualquer. A dica da tela manda
  "baixe, assine e envie" (`app/(paciente)/paciente/anvisa/page.tsx:136`).

O mesmo upload já está no Item 6 (store público), e o `confirmarEnvioAnvisa` sem escopo já está no
`03`. **Perigo de mexer:** médio; fluxo ANVISA em produção provado por Davi em 30/09, com 12
autorizações em `representacao`.

---

## ⚪ Item 73 — CATALOGADO, 01/10/2026: retirar a IA e declarar emergência existem sem tela, e há sobras antigas

**Status:** catalogado, **não corrigido**.

- `revogarConsentimentoIa` (`app/_actions/consentimento-teleconsulta.ts:152`) e `declararEmergenciaMedica`
  (`:246`) não têm chamador. A C1 não tem coluna nem função de revogação (`db/schema/teleconsultas.ts:60-62`).
- `registrarConsentimentoLgpd` (`app/(medico)/_actions/teleconsulta.ts:63`) não tem chamador, e
  `teleconsultas.consentimento_lgpd` não decide nada; `transcricoes.consentimento_obtido` é gravado `true`
  depois do portão e não é lido.
- A ADR-0007 (`:193`, `:196`) ainda diz que a tela da C1 está "não construída" e a emergência "não
  modelada". As duas existem.

**Perigo:** baixo.

---

## ⚪ Item 66 — CATALOGADO, 30/09/2026: uma segunda aba do paciente faz o admin renegociar a chamada

**Status:** achado pela revisão da Fase 2.1 (ADR-0029 §12.3). **Anterior** àquele diff; não corrigido.

**O que acontece:** `components/atendimento/ChamadaDeAtendimento.tsx`, `pusher:member_added`: quando
entra outra aba do paciente, o admin chama `oferecer()` de novo, mesmo com a chamada conectada. A nova
conexão fecha a anterior (`fecharConexao`), e isso para a tela que alguém estava mostrando. A aba nova
do paciente se percebe repetida e não responde, então a chamada fica sem voz até alguém sair e voltar.

**Perigo:** baixo; é o paciente com duas abas abertas. Correção provável: o admin só oferece se não
houver conexão ativa. Mexe na lógica de reconexão, que a prova no Chromium não cobre (ela prova a
negociação, não a presença), e por isso não entrou junto.

---

## ⚪ Item 65 — CATALOGADO, 30/09/2026: apagar a autorização não encerra o pedido nem a chamada dela

**Status:** achado ao ler o PR #143 (Dryelle, `3a8feef`), antes da Fase 2.1. **Não corrigido**: não é
escopo do pedido de Davi, e o código é de outra pessoa.

**O que acontece:** `apagarAutorizacaoAnvisaAdmin` (`app/(admin)/_actions/documentos-regulatorios.ts:93`)
marca `deletedAt` na autorização, mas não chama `encerrarPedidoDaAutorizacao`
(`lib/anvisa/encerrar-pedido-de-atendimento.ts`). O pedido de atendimento dela fica
`aguardando_ativacao` ou `pendente_autorizacao`, e uma chamada aberta continua aberta.

**Perigo, medido pela leitura:** baixo. A lista do admin já esconde o pedido de autorização apagada
(`app/_actions/pedido-atendimento-assistido.ts:439`), e o paciente que pedir de novo, numa autorização
nova, não é bloqueado pelo índice parcial, que é por `autorizacao_id`. O que sobra é linha aberta
para sempre, e uma chamada que `garantirAcessoAoPedido` (`lib/auth/escopo-chamada.ts:52`) ainda deixa
o paciente abrir pelo link, porque confere o paciente arquivado, não a autorização apagada.

**Para corrigir (com autorização):** chamar `encerrarPedidoDaAutorizacao(autorizacaoId, …)` depois do
`update`, com um desfecho próprio ou `concluido`. A escolha do desfecho é **regra de negócio**, e é
pergunta para Davi. Um ponto de chamada; teste de integração existe para o encerramento
(`__tests__/integracao/o-pedido-de-atendimento-abre-a-procuracao.test.ts`).

---

## 🟠 Item 64 — CATALOGADO, 30/09/2026: o "Registre-se" falha na confirmação do código com `JSON.parse`

**Status:** relatado por Davi em produção (print), **não investigado a fundo e não corrigido** — _"isso
fica documentado"_.

**O que acontece:** em `/registrar-se`, depois de digitar o código de 6 dígitos e clicar em "Confirmar
Código", a tela mostra `JSON.parse: unexpected character at line 1 column 1 of the JSON data` e não
avança. É o texto do **Firefox** para uma resposta que devia ser JSON e veio como outra coisa (página
de erro, HTML).

**Onde:** `app/(auth)/registrar-se/[[...sign-up]]/page.tsx:319-324`. O erro sai do `try` externo, pelo
`translateClerkError(err)`, então veio de `signUp.attemptEmailAddressVerification` ou de `setActive`,
as duas chamadas ao Clerk. O `fetch('/redirect')` e o `atualizarPerfilCompletoPaciente` têm `try`
próprio e não chegariam a essa mensagem. O arquivo não mudou na ADR-0029 (último commit: `6d93b5a`).

**Hipóteses, NÃO medidas:**
1. O cadastro usou o **mesmo e-mail** de uma conta apagada no Clerk minutos antes (PR #140, 14:23).
2. A instância do Clerk em produção é de **desenvolvimento** ("Development mode", achado de 13/09),
   com limites próprios.
3. Algo entre o navegador e o Clerk (extensão, bloqueio) devolveu HTML.

**Para medir:** repetir com o DevTools aberto (aba Rede) e ver qual chamada ao Clerk respondeu sem JSON,
com o status e o começo do corpo. Repetir com um e-mail que nunca existiu, para separar a hipótese 1.

---

## 🟠 Item 63 — MEDIDO, 30/09/2026: produção roda sem TURN — teleconsulta e chamada de atendimento

**Status:** medido por Davi na VPS, **não corrigido** — decisão dele (`DO-78`): _"sobre isso faremos
depois"_.

[medido] No processo `behemp-site` e no `.next/standalone/.env`: `CLOUDFLARE_TURN_KEY_ID` e
`CLOUDFLARE_TURN_API_TOKEN` **ausentes** nos dois. `BLOB_TOKEN_PRIVADO` e `PUSHER_SECRET` definidos no
processo. As duas chaves do TURN também **não estão** na lista `gravar` do `.github/workflows/deploy.yml`.

**Consequência:** a rota de ICE devolve só STUN (`turnDisponivel: false`), e a tela avisa. A conexão
direta funciona na maioria das redes; em NAT restritivo (parte do 4G, redes corporativas) a voz e a
tela não completam. Vale para a teleconsulta de hoje e para a chamada nova. O site não cai por isso.

**Para corrigir (quando decidido):** cadastrar os dois secrets no GitHub e acrescentá-los à lista
`gravar` do `deploy.yml`. É arquivo protegido e pede autorização; o guarda
`o-segredo-cadastrado-chega-ao-servidor` passaria a varrer `lib/webrtc/`, onde a leitura mora.

---

## 🔴 Item 60 — CATALOGADO, 30/09/2026: o anexo do chat vai para store público, sem conferir participação

**Status:** catalogado, **não corrigido**. Achado ao investigar a Fase 2 da ADR-0029.

- `enviarArquivoChat` (`app/_actions/chat.ts:608-661`) faz `put` com `access: 'public'` (`:627-629`),
  **não confere** se quem envia participa do grupo, guarda a URL crua dentro de `conteudo` como
  `[ARQUIVO:url] nome` (`:632`) e valida só o tamanho (10 MB), sem MIME. É o Item 6 voltando por outro
  caminho: quem tiver a URL lê o arquivo sem autenticação.
- `reagirMensagem` (`app/_actions/chat.ts:667`) também não confere participação.

**Perigo de mexer:** o chat está em produção; trocar o store muda a entrega (rota autenticada, como
`GET /api/atendimento/print/{id}`), e as mensagens antigas guardam a URL pública no texto. A chamada
de atendimento **não** reusa esta action por isso (ADR-0029 D-18).

---

## 🟠 Item 61 — CATALOGADO, 30/09/2026: a tela do paciente na teleconsulta liga uma gravação sem condição

**Status:** catalogado, **não corrigido**. `app/(paciente)/paciente/teleconsulta/[roomId]/page.tsx:176-196`
cria um `MediaRecorder` no `ontrack` **sem conferir consentimento** e sem enviar o resultado a lugar
nenhum: gravação local, sem uso e sem gate. O lado do médico só grava com o aceite dos dois
(ADR-0007). **Perigo de mexer:** baixo (o arquivo não sai do navegador), mas é captura de áudio e
vídeo sem a base que a ADR-0007 exige; tela clínica em produção, travada por guardas de layout.

---

## ⚪ Item 62 — CATALOGADO, 30/09/2026: o id da sala da teleconsulta é previsível

**Status:** catalogado, **não corrigido**. `criarSalaTeleconsulta`
(`app/(medico)/_actions/teleconsulta.ts:30`) gera o `roomId` com `Math.random` e 6 caracteres. O
escopo da sala é conferido no servidor (`garantirDonoDaSala`), então o id sozinho não abre a sala;
mas id previsível é convite para quem tenta adivinhar. A chamada de atendimento usa
`crypto.randomUUID` (ADR-0029 D-13).

---

## ⚪ Item 59 — CATALOGADO, 30/09/2026: o clique em "Be4Hope faz por mim" é auditado sem quem clicou

**Status:** catalogado, **não corrigido** — Davi, 30/09/2026 (`DO-77`): _"se ainda não existe,
futuramente vamos criar"_.

`definirModalidadeAnvisa` (`app/(paciente)/_actions/anvisa.ts`, no fim da função) grava
`logs_auditoria` com `acao: 'DEFINIR_MODALIDADE'`, a entidade e o id, mas **sem `userId`** e **sem
`dadosAntes`/`dadosDepois`**. E o `.catch(() => {})` descarta a falha em silêncio. O resto do
caminho já tem rastreio completo: pedir, ativar, desativar e listar (ADR-0029 D-02 a D-04).
**Perigo de mexer:** baixo, quatro linhas na mesma action, que a autorização de 30/09 já cobre;
o guarda `o-pedido-de-atendimento-abre-a-procuracao` passaria a exigir os três campos.

---

## ⚪ Item 58 — CATALOGADO, 30/09/2026: enviar documento no checklist devolve o paciente ao passo a passo

**Status:** catalogado, **não corrigido**. Anterior à ADR-0029; achado na revisão independente dela.

Em `app/(paciente)/paciente/anvisa/page.tsx`, o `onUploaded` do checklist chama
`recarregarAutorizacao`, que escolhe a etapa pela modalidade: com `guiada`, manda para a etapa
`guiada`. Quem está no passo a passo, abre o checklist ("Enviar autorização obtida") e envia um
arquivo é devolvido ao passo a passo a cada envio. **Perigo de mexer:** uma condição em
`recarregarAutorizacao`, na mesma tela de produção; nenhum dado se perde, é navegação.

---

## ⚪ Item 57 — CATALOGADO, 30/09/2026: duas actions da ANVISA aceitam autorização de outro paciente

**Status:** catalogado, **não corrigido**. Achado ao ler `app/(paciente)/_actions/anvisa.ts` para a
ADR-0029.

- `salvarFormulario8833` (`app/(paciente)/_actions/anvisa.ts:265`) confere o papel
  `paciente` e grava `formulario8833` com `.where(eq(autorizacoesAnvisa.id, parsed.data.autorizacaoId))`,
  **sem** `pacienteId` nem `deletedAt`. Um paciente logado que saiba o id da autorização de outro
  sobrescreve o formulário 8833 dele;
- `confirmarEnvioAnvisa` (mesmo arquivo, linha 282) faz o mesmo com `status`,
  `dataEnvio` e `prazoEstimado`: um paciente pode marcar como "documentos enviados" a autorização
  de outro.

É OWASP API1 (BOLA). **Perigo de mexer, medido:** uma linha em cada action (acrescentar o filtro
pelo paciente da sessão, como `definirModalidadeAnvisa` já faz, linhas 201-211); as duas são
chamadas só pela tela `/paciente/anvisa`; o id é CUID2, então explorar exige conhecer o id de
outro paciente. Nenhum teste prova o antes e o depois. **Custo de deixar:** dado regulatório
alterável por terceiro, sem auditoria de quem alterou.

---

## ✅ Item 56 — EM PRODUÇÃO, 30/09/2026 (Fases 1, 2, 2.1 e 2.2): a ANVISA abre no "Faço eu mesmo", e a procuração é ativada pelo admin

**Status:** decidido por **Davi** ([ADR-0029](adr/ADR-0029-a-anvisa-abre-no-faco-eu-mesmo-e-a-procuracao-e-ativada-pelo-admin.md)),
**prioridade 1** da nova ordem definida na reunião de 29/09/2026. ⚠️ _Esta linha dizia "nenhuma
linha de código" e ficou velha: as Fases 1 e 2 estão em produção (PR #141, 30/09/2026)._
Migration autorizada por escrito (`.claude/autorizacoes.txt`), com o roteiro de integridade da
ADR-0029 D-05 como condição.

**Onde mexe, com a evidência:**

| o quê                                                    | onde                                                                    |
| -------------------------------------------------------- | ----------------------------------------------------------------------- |
| a etapa `escolha` sai do caminho                         | `app/(paciente)/paciente/anvisa/page.tsx:341`, `:447`, `:722`, `:894`   |
| vídeo, botão de suporte e botão da procuração            | a etapa `guiada`, `app/(paciente)/paciente/anvisa/page.tsx:710-876`     |
| o paciente não liga `representacao` sozinho              | `app/(paciente)/_actions/anvisa.ts:187-240` (`definirModalidadeAnvisa`) |
| a lista de pedidos, com `Accordion`                      | `app/(admin)/admin/anvisa/page.tsx:302-318`; `components/ui/accordion.tsx` |
| o aviso do painel deixa de prometer a procuração         | `components/paciente/AvisoDaProcuracao.tsx:79-90`                       |
| a tabela nova do pedido                                  | `db/schema/` + `db/migrations/0050_pedidos_atendimento_assistido.sql`   |

**Perigo de mexer, medido:** a tela está em produção e é o destino de três caminhos
(`lib/parceiros/destino-do-paciente.ts:40`, `app/(auth)/redirect/page.tsx:218` e o aviso do
painel). Cinco guardas dependem dela (ADR-0029 §2), e dois deles **continuariam verdes** com o
aviso prometendo uma procuração escondida. A migration é só aditiva, mas este repositório tem
duas armadilhas medidas: as migrations **não rodam do zero** (`docs/03`, achado de 13/09) e o
migrator **pula em silêncio** uma migration com `when` antigo (Item 32).

**Medição de produção feita em 30/09/2026 por Davi** (ADR-0029 D-05, item 6): PostgreSQL 17.11,
cópia da estrutura gerada sem dado, nomes novos livres, `max(created_at)` na 0049. A 0050 aplica
sozinha. 🔴 **Doze autorizações já estão em `representacao` sem aprovação** (8 pendentes, 4 com
documentos enviados): a action nova não pode tirar delas o checklist da procuração.

**Andamento, 30/09/2026, branch `feat/anvisa-faco-eu-mesmo`:**

- ✅ Grupo 3, banco: tabela e migration 0050 (commit `231a100`), provada contra o registro de
  produção;
- ✅ Grupo 4, servidor, sem as telas: `app/_actions/pedido-atendimento-assistido.ts` (pedir, ler o
  próprio, ativar, desativar, listar), `lib/anvisa/pedido-de-atendimento.ts` (a regra pura) e
  `lib/anvisa/concluir-pedido-de-atendimento.ts`, chamado pela rota de status no `aprovado`. Guarda
  `o-pedido-de-atendimento-abre-a-procuracao` (**33 casos**) e integração homônima (**16 casos**),
  provados por **9 sabotagens**. A 9ª sobreviveu na primeira rodada: o teste de "cliques
  simultâneos" não reproduzia a corrida, e ganhou uma versão forçada que a reproduz;
- ✅ autorização por escrito do Davi (30/09/2026) para os três arquivos protegidos; Grupos 5, 6 e 7
  implementados: trava em `definirModalidadeAnvisa`, tela do paciente sem a escolha, com vídeo,
  suporte e procuração no fim, e a seção de pedidos no admin;
- ✅ revisão independente: 1 achado **alto** (a rota que gera a procuração contornava a trava),
  2 médios e 2 baixos, **corrigidos** e provados. Ver ADR-0029 §9;
- ✅ respondidas por Davi em 30/09: rejeitada vira `rejeitado_anvisa` (`DO-76`, implementado, 0050
  gerada de novo e provada de novo); o aviso do painel não volta a oferecer a procuração, e o botão
  é o único lugar (`DO-77`, retifica a D-10). Rastreio do clique: Item 59, para depois;
- ⏳ **pré-deploy:** Davi, 30/09: _"quando tivermos aptos, testados e comprovados vamos fazer os
  procedimentos pré-deploy"_. As telas só se conferem em produção (§0.20).
- ⚠️ as telas **não foram vistas rodando**: sem chave do Clerk local, toda rota dá 500.
- ✅ **Fase 2 implementada (30/09/2026), no mesmo deploy, por decisão do Davi:** a chamada de voz com
  a tela do paciente, o chat lateral com print, as rotas `app/api/atendimento/*`, o ramo novo do
  Pusher e as tabelas da chamada na mesma 0050. Provas e revisão na ADR-0029 §10.4. Catalogados, sem
  correção: Itens 60, 61 e 62.
- ✅ **em produção**, 30/09/2026, 14:28: PR #141, deploy `36751041870`. Davi testou a chamada: conecta,
  a voz vai e volta, a tela do paciente e o print chegam.
- 🧪 **Fase 2.1 (30/09/2026), branch `feat/atendimento-camera-e-print`, sem deploy:** câmera nos dois
  lados (`DO-79`), o admin também mostra a tela (`DO-80`), o print abre ampliado com zoom (`DO-81`),
  e o quadro preto do admin vira aviso. Arquivos: `lib/atendimento/negociacao.ts`,
  `components/atendimento/ChamadaDeAtendimento.tsx`, `components/atendimento/ChatDoAtendimento.tsx`,
  `app/api/atendimento/sinalizar/route.ts` (o evento `midia`). Provas na ADR-0029 §12.3. O que falta
  conferir em produção: ADR-0029 §12.4.
- ✅ **Fase 2.1 em produção**, 30/09/2026, 15:52 (PR #144). Davi testou: câmera e tela nos dois lados.
- ✅ **Fase 2.2 em produção**, 30/09/2026, 16:15 (PR #145, deploy `36764049030`). Davi: _"tudo
  funcionando corretamente"_. **O Item 56 está entregue.** Ficam: os Itens 57 a 66 (catalogados) e as
  pendências da ADR-0029 §5.
- (histórico) **Fase 2.2**, branch `feat/atendimento-tela-cheia`, antes do deploy: miniatura do print (`DO-83`),
  troca do destaque e tela cheia (`DO-82`), erro da câmera com a causa. ADR-0029 §12.5. Falta medir,
  com dois aparelhos, que o travamento de vídeo era só a câmera compartilhada.

**Fica para a próxima fatia** _(escrito antes da Fase 2; a chamada foi feita no mesmo deploy)_: a chamada de atendimento com suporte (voz, tela no computador e
chat com print na lateral), ADR-0029 D-11. 🔴 Achado ao desenhar: o navegador do celular **não**
compartilha tela (MDN `browser-compat-data`: `false` em Chrome Android, Safari iOS e Firefox
Android); por isso o chat com print.

---

## ⚖️ DECISÃO DE NEGÓCIO/JURÍDICA PENDENTE (não é achado técnico) — Nota fiscal automática (NFS-e) para o paciente, em nome do médico

**Catalogado em 30/09/2026.** Fica **fora da numeração dos itens**, de propósito: não é defeito
de código nem bug do Mercado Pago. É uma decisão de negócio e jurídica que ainda não foi tomada.
Enquanto ela não sair, **não existe o que implementar**.

### Contexto

Hoje o sistema **não emite nenhum documento fiscal**. O split de pagamento do Mercado Pago está
em produção e funcionando: cada médico recebe o valor **integralmente e direto na própria conta**,
sem `application_fee` (`lib/mercadopago/cobranca.ts:5-7`). Por isso a nota fiscal de serviço
teria de sair **no CPF/CNPJ de cada médico**, já que é ele quem recebe o dinheiro e presta o
serviço ao paciente.

### Investigação já feita (29–30/09/2026)

- **O cadastro do médico não tem nenhum campo fiscal.** Não há CPF, CNPJ, regime tributário,
  inscrição municipal nem CNAE, nem em `db/schema/medicos.ts` nem em `db/schema/users.ts`.
- **O CPF do paciente é opcional, e o documento da cobrança muda conforme o meio de pagamento.**
  `pacientes.cpf` é nullable (`db/schema/pacientes.ts:30`, sem `.notNull()`).
  - O **PIX** usa o CPF do cadastro (`lib/mercadopago/cobranca.ts:274-288`).
  - O **cartão** usa o documento digitado no Brick (`lib/mercadopago/cobranca.ts:294-296`), que
    pode ser de outra pessoa, e não do paciente.
- **Ninguém tinha mencionado nota fiscal/NFS-e antes**, em nenhum lugar do repositório nem das docs.
- 🛑 **O módulo `invoices` NÃO serve para isto.** Ele é fatura comercial de importação de
  medicamento, ligada à ANVISA (`db/schema/invoices.ts`: _"documento fiscal para importação de
  medicamento"_), e não NFS-e municipal. **Não reaproveitar.**
- **Nenhuma API pública de emissão fiscal do Mercado Pago** que se integre ao fluxo de split
  payments foi achada. Não encontrada na documentação oficial de developers — o que não é o
  mesmo que confirmar ausência.
  - Existe uma ferramenta de emissão dentro da conta do próprio vendedor. Localizada só por
    resultado de busca (as páginas do blog retornaram 403, não lidas) — não verificado se é API
    ou emissão automática por venda.
  - **Não está confirmado** se ela funciona para pessoa física.

### As 4 perguntas que decidem a arquitetura (jurídico/negócio, não técnicas)

1. **Os médicos emitem como pessoa física (RPA/autônomo) ou como pessoa jurídica (CNPJ)?** A
   resposta muda tudo. Perguntar junto: a NFS-e do município exige inscrição municipal, e ela é
   possível para o médico pessoa física ou só para PJ? (Não pesquisado — não é premissa.)
2. **Em quais municípios os médicos estão inscritos?** A NFS-e é municipal e não tem padrão
   nacional único, exceto onde o município já aderiu à NFS-e Nacional.
3. **Quem guardaria o certificado digital (A1) de cada médico, se a emissão for automática?** Isso
   tem implicação séria de LGPD e de segurança: é um dado extremamente sensível, e de terceiros.
4. **A nota sai no nome do paciente ou no do titular do cartão, quando forem pessoas diferentes
   (cartão de terceiro)?**

### Próximo passo

A decisão é do **Diniz com o jurídico da Greens**, em reunião presencial marcada para
**01/10/2026**. 🛑 **Nenhuma implementação antes de a decisão de negócio estar fechada.**

---

## 🟠 Item 55 — CORRIGIDO no código, 28/09/2026 · ⏳ falta a prova manual: todo pagamento com cartão parava antes do servidor

**Status:** a causa está corrigida e provada nos testes; **falta a prova real, que é manual** (ver
abaixo). Branch `fix/cartao-credit-card-do-brick`.

### O defeito

No teste real do dono com cartão, a tela mostrou _"Este meio de pagamento não está disponível"_.
Essa mensagem **não vem do Mercado Pago nem do banco**: só a nossa tela a escreve
(`components/shared/agendamento-pagamento-step.tsx`), quando `entradaDoBrick`
(`lib/agendamento/pagamento-na-tela.ts`) devolve `null`. Nesse caso **o servidor nem é chamado**.

`entradaDoBrick` comparava `selectedPaymentMethod` com `'creditCard'` — o que a tipagem de
`@mercadopago/sdk-react@1.0.7` declara (`TPaymentBrickPaymentType`). **O Brick que o Mercado Pago
serve envia `'credit_card'`**: no bundle
`https://http2.mlstatic.com/frontend-assets/op-cho-bricks/build/{3.18.0,3.17.1}/components/payment.js`
(o endereço que `sdk.mercadopago.com/js/v2` monta), o enum `dm` do módulo 7765 é
`CREDIT_CARD="credit_card"`, `DEBIT_CARD="debit_card"`, `BANK_TRANSFER="bank_transfer"`. O PIX
funcionava porque `bank_transfer` coincide nos dois lados. **Todo cartão parava.**

⚠️ **Os testes tinham a mesma premissa do código** (usavam `'creditCard'`) e passavam. Com a
correção, pôr o código de volta deixa **7 de 13** casos da integração vermelhos.

⚠️ **O valor em runtime não foi medido diretamente**: ele só aparece no `onSubmit` com o cartão
preenchido, e os campos são iframes que o harness não preenche. A prova é o código do Brick + o
sintoma. **O `25003100` visto no console não foi identificado:** não está no SDK, nem nos dois
bundles do Brick, nem em página pública do Mercado Pago. Não é recusa do banco — a cobrança nem foi
pedida.

### A correção

- aceita `'credit_card'` (real) e `'creditCard'` (reserva, se o SDK corrigir a tipagem); débito
  (`debit_card`/`debitCard`) continua fora
- quando o envio não vira cobrança, `console.warn` com `diagnosticoDoEnvio`: o meio e os NOMES dos
  campos que faltaram — nunca valor (token, e-mail, documento). ⚠️ É log do **navegador**: em
  produção, só quem tem o console aberto vê. Levar ao servidor é outra decisão
- ⚠️ as CHAVES de `customization.paymentMethods` (`creditCard`, `bankTransfer`) **estão certas** em
  camelCase — são outra coisa, e o Brick renderiza os dois meios com elas (medido). Busca completa
  no repositório: a comparação equivocada existia **só** em `pagamento-na-tela.ts`

### 🔴 A prova manual — só o Diniz consegue, e é o que fecha este item

Os campos do cartão são iframes de `secure-fields.mercadopago.com` (cross-origin): nenhum teste
automatizado deste repositório consegue digitar neles. **Não automatizar agora** (decisão do dono).

**Pré-condição:** `MERCADOPAGO_AMBIENTE=teste` (a public key de teste no Brick) e o médico
conectado. ⚠️ **Ponto em aberto, não medido:** a cobrança usa o access token OAuth **do médico**. Se
a conta conectada for de **produção** e a chave do Brick for de **teste**, o token do cartão pode ser
recusado por mistura de ambientes — um erro que **não** é do cartão. Se o passo 4 falhar com erro
da API, conferir isso antes de concluir qualquer coisa.

**Os passos** (cartões e nomes da doc oficial:
`developers/pt/docs/checkout-bricks/integration-test/test-cards`, lida em 28/09/2026):

1. abrir o console do navegador — o `[pagamento] envio do Brick não virou cobrança`, se aparecer,
   diz o `meio` e os campos que faltaram
2. na etapa de pagamento, escolher **Cartão de crédito**
3. Mastercard `5480 8328 0103 3311`, CVV `123`, validade `11/30`; nome do titular **`APRO`**
   (aprovado); CPF `12345678909`; qualquer e-mail
4. **Pagar.** Esperado: _"Pagamento aprovado — confirmando sua consulta"_, e **nenhum**
   `[pagamento] envio do Brick não virou cobrança` no console
5. repetir com o nome **`OTHE`** (recusa geral): esperado _"Pagamento recusado"_ com o motivo e o
   botão "Tentar de novo"
6. (opcional) **`SECU`** (CVV inválido): a mensagem deve falar do código de segurança

---

## ⚪ Item 54 — CATALOGADO, 28/09/2026: o que a revisão do Item 50 deixou fora dele

**Status:** catalogado, **não corrigido**. Todos saíram da revisão dos quatro agentes (ADR-0028
§9.2). Cada um é trabalho próprio ou pergunta.

| # | o quê | onde | perigo | o que pede |
|---|---|---|---|---|
| 1 | O limite por IP lê o **primeiro** `x-forwarded-for`. Se o nginx da VPS **acrescenta** em vez de sobrescrever, o atacante escolhe o próprio IP, e só o limite por link segura | `lib/seguranca/limite-de-requisicao.ts:106` | médio (inferência: a configuração do nginx não está no repositório) | medir na VPS: `proxy_set_header X-Forwarded-For $remote_addr` ou `real_ip` |
| 2 | 🔴 **O telefone de um médico ou admin trava o paciente.** `donosDoTelefone` não filtra `role` | `lib/cadastro/conferir-identidade.ts` (consulta do telefone) | baixo/médio | ✅ **respondido em 28/09/2026: não agora.** Resposta: _"isso por enquanto não vamos nos preocupar"_. Fica catalogado, sem data |
| 3 | `porClerk` da transação não filtra `deletedAt`: uma conta Clerk ligada a um `users` apagado confere contra outra pessoa | `app/_actions/cadastro-por-link.ts` (transação, `porClerk`) | baixo, e já existia antes | um filtro, com teste |
| 4 | Checagem e escrita não são atômicas: dois links com o mesmo CPF, ao mesmo tempo, passam os dois | conferência fora da transação | baixo | só um índice fecha, e depende do Item 52 (duplicatas antes do unique) |
| 5 | As consultas com `regexp_replace`/`lower()` varrem `users` e `pacientes` inteiras | `lib/cadastro/conferir-identidade.ts` | baixo hoje, cresce com a base | índice de expressão, com migration |
| 6 | A auditoria do veredito `limite` grava a cada chamada: dá para inflar `logs_auditoria` | `app/_actions/identidade-no-cadastro.ts` | baixo | auditar uma vez por janela |
| 7 | Quem para no suporte ou no telefone não conclui. **A Greens fica com o handoff pendente** sem saber por quê | fluxo `greens_handoff` | médio para a operação (inferência: não foi conferido em `greens-corp` se há prazo ou retentativa) | 🔴 **prioridade do dono em 28/09/2026:** avisar a Greens pela "Ponte". ✅ **Mensagem escrita**: `docs/integracao-greens/PONTE-IDENTIDADE-NA-ETAPA-1-o-que-muda-para-o-handoff.md`. Medido no código deles: não há prazo nem retentativa, só o reenvio manual. **Falta:** o dono levar a mensagem e os três de lá decidirem entre os caminhos 1, 2 e 3 |
| 8 | `emailAddresses?.[0]` não é necessariamente o e-mail principal: numa conta com vários e-mails, dá `sessao_alheia` falso | `page.tsx`, `identidade-no-cadastro.ts` | baixo, e segue o padrão que já existia | `primaryEmailAddress` em todos os pontos |
| 9 | O texto do e-mail passa por baixo do ícone de check quando o campo é válido | `Campo` em `formulario-de-cadastro.tsx` | cosmético, e já existia | `pr-10` quando válido |

---

## ⚪ Item 53 — CATALOGADO, 28/09/2026: o guarda de limite só enxerga Route Handler, e nenhuma Server Action tem limite

**Status:** catalogado, **não corrigido**. Achado ao pesquisar o Item 50.

`as-rotas-sensiveis-tem-limite` confere uma **lista fixa** de seis route handlers
(`__tests__/guardas/as-rotas-sensiveis-tem-limite.test.ts:30`, `ROTAS_QUE_PRECISAM`). Server Action não
entra, e `rg "consumir\(" app/_actions` volta **vazio**: nenhuma action pública tem limite. Isso
pesa porque `/cadastro(.*)` é público (`middleware.ts:57`), e a action do cadastro por link roda
sem autenticação.

**O Item 50 cobre a action dele** no guarda próprio (ADR-0028 D-08). Estender o guarda antigo
para **derivar** as actions públicas, em vez de listar, é trabalho próprio: é a mesma lição do
`duas-contas-de-chatpro-nao-se-misturam`, onde a lista fixa ficou verde com a rota errada.

**Também fica registrado aqui, pela mesma pesquisa:** a **User Enumeration Protection** do Clerk
em modo Strict (ADR-0028 D-10) fecharia a enumeração pelo sign-up. Mas ela muda a estratégia de
login da instância inteira, e fica para decisão do dono.

---

## 🟠 Item 52 — CATALOGADO, 28/09/2026: o CPF não tem unique, e é gravado em dois formatos

**Status:** catalogado, **não corrigido**. Achado ao pesquisar o Item 50.

- **Medido em produção em 28/09/2026:** 134 das 145 fichas com CPF (92 %) guardam o CPF **com pontuação**, e **1** CPF já está em duas fichas.
- `pacientes.cpf` é `text` **sem unique e sem índice** (`db/schema/pacientes.ts:30`). Hoje duas
  fichas com o mesmo CPF nascem **sem erro e sem log**.
- O handoff e o cadastro por link gravam só dígitos (`lib/parceiros/handoff.ts:307`,
  `app/_actions/cadastro-por-link.ts:181`). O perfil (`app/_actions/perfil-paciente.ts:200`) e o
  `criarPaciente` do admin gravam **como foi digitado**.
- O CPF **não é cifrado** em lugar nenhum.

**O que o Item 50 faz com isso:** compara com `regexp_replace` e **não** migra nada (ADR-0028
D-03). A causa fica aqui.

**Perigo de mexer:** normalizar exige `UPDATE` em produção. Unique exige **antes** resolver as
duplicatas que existirem. Quantas existem, o passo 0 do Item 50 mede. Cifrar muda toda leitura de
CPF. São três trabalhos próprios, com migration e autorização.

---

## 🟠 Item 51 — CATALOGADO, 28/09/2026: o ChatPro reaproveita a solicitação pelo telefone sem conferir se o e-mail é de outra pessoa

**Status:** catalogado, **não corrigido**. Achado ao pesquisar o Item 50.

`ServicoDeSolicitacao.buscarAtiva` (`lib/chatpro/solicitacao.ts:159`) procura pelo `leadId` e
depois pelo **telefone** uma solicitação `link_gerado` ainda não usada e não vencida. O update
faz `email: params.email ?? existente.email` (`:243`, `:271`), **sem conferir** se o e-mail que
chegou diverge do que já estava lá. O handoff da Greens tem essa trava
(`lib/parceiros/handoff.ts:422-434`, _"FALHA FECHADA … telefone não identifica pessoa"_). O
ChatPro não tem.

**O perigo:** duas pessoas com o mesmo aparelho, como um cuidador ou um familiar. A segunda recebe
o link da solicitação da primeira, com o e-mail dela trocado ou mantido. É a mesma classe de
OWASP API1 que o `handoff.ts:233-250` descreve.

**Perigo de mexer:** baixo no código (uma condição, espelhando o `reaproveitavel`). Mas muda o
número de solicitações criadas, e o guarda `o-reaproveitamento-nao-funde-duas-pessoas` **só lê o
`handoff.ts`**: teria de passar a ler este também. **Em produção:** sim. A ocorrência real não foi
medida, e a medição é um `SELECT` de solicitações com o mesmo telefone e e-mails diferentes.
**Autorização** antes de mexer.

---

## 🟡 Item 50 — IMPLEMENTADO, 28/09/2026 (tela não provada no navegador): a identidade se confere na etapa 1 do cadastro ([ADR-0028](adr/ADR-0028-a-identidade-se-confere-na-etapa-1-e-a-tela-nao-vira-oraculo.md))

**Status:** 🟡 **implementado em 28/09/2026, não commitado, não em produção**, na branch
`docs/adr-0028-identidade-na-etapa-1`. Aprovado por quem pediu, com as respostas A, B, C e E
(`DO-64` a `DO-67`). O que mudou em relação ao plano está na ADR-0028 §9.

**O que foi provado** (depois da revisão pelos quatro agentes, ADR-0028 §9.2):

- guarda `a-identidade-e-conferida-na-etapa-1`: 49 casos;
- integração contra Postgres real: 28 casos;
- 33 sabotagens, todas vermelhas;
- suíte 1587/69, integração 135/11 sem as prévias, type-check 0, baseline verde, `pnpm build` verde;
- prévia estática das 7 possibilidades em `previa-da-identidade/`, conferida em 900px e 390px.

**Regras da segunda rodada:**

- `DO-68`: o telefone de outra conta trava o campo, com saída para "entrar" ou "suporte";
- com qualquer aviso, a senha não é pedida;
- a referência do CPF e do telefone é o e-mail **do link**;
- as recusas da action final têm limite;
- o login não recria a ficha;
- a transação acha o e-mail sem diferenciar maiúsculas.

**🔴 O que falta:**

1. **O CLIQUE não foi visto rodando.** Sem `CLERK_SECRET_KEY` no `.env`, a página real não renderiza local.
2. ✅ **O passo 0 foi medido em produção** em 28/09/2026: 145 fichas com CPF, **1** CPF repetido, **134** CPFs gravados com pontuação (92 %), 0 e-mails repetidos por maiúscula e **3** celulares repetidos. O impacto é pequeno. Detalhe na ADR-0028, seção "Como foi provado".
3. A frase _"o que eu quero que você tome cuidado"_ continua sem complemento.
4. Commit, PR e o merge, que é do dono. O que ficou de fora está no Item 54, logo abaixo.

**Status ao ser escrito:** 📋 planejado, não implementado. A ADR-0028 é proposta e espera a aprovação de
quem pediu **e** as respostas A–E da §7 dela. Plano em PDF:
[`planos/PLANO-IDENTIDADE-NA-ETAPA-1.pdf`](planos/PLANO-IDENTIDADE-NA-ETAPA-1.pdf).
Branch de docs: `docs/adr-0028-identidade-na-etapa-1`.

**O pedido** (`DO-59` a `DO-63`): conferir, **logo na etapa 1**, se a pessoa já tem dado
(**CPF, telefone ou e-mail**, sem nome parecido) no sistema, se já é cadastrada ou se já está
logada. Se logada, "é você?" com **Sair que continua no formulário**. Se o CPF bate, **suporte
da BeHemp**. Vale para **todas** as portas.

### Diagnóstico — o que existe hoje (lido e reconferido em 28/09/2026)

| # | fato | onde |
|---|---|---|
| 1 | o "Continuar" da etapa 1 **não vai ao servidor** | `app/(auth)/cadastro/[token]/_components/formulario-de-cadastro.tsx:1313` |
| 2 | a etapa 1 é `subEtapa === 0`; os dados do parceiro aparecem em "Confirme seus dados" | `:1151`, `:1165` |
| 3 | com sessão válida, a etapa 1 já mostra "Você já está logado como X" | `:1255` |
| 4 | o aviso de **sessão de outra pessoa** só aparece na **etapa 3** | `:1807`, `:1850` |
| 5 | "Sair" chama `signOut()` **sem destino**, e o `ClerkProvider` não define `afterSignOutUrl` (`app/layout.tsx:102`). Pelo padrão do Clerk, a pessoa vai para `/` (**inferência, não executada**) | `:1876` |
| 6 | `signOut()` automático em `criarConta` e em `confirmarCodigo` | `:814`, `:905` |
| 7 | conta existente só aparece **no fim**, com `form_identifier_exists` | `:858`, `:182` |
| 8 | a action recusa sessão de outro e-mail, e aceita o e-mail digitado no fluxo | `app/_actions/cadastro-por-link.ts:276-287` |
| 9 | **nada** consulta CPF; `pacientes.cpf` não tem unique nem índice | `db/schema/pacientes.ts:30` |
| 10 | o unique de `users.email` diferencia maiúsculas | `db/schema/users.ts:21` |
| 11 | telefone em quatro formatos; a triagem compara os últimos 8 dígitos com `regexp_replace` | Item 26 · `lib/chatpro/triagem.ts:123` |
| 12 | todas as portas levam ao mesmo `/cadastro/[token]`; só dois criadores de solicitação | `lib/chatpro/solicitacao.ts:280` · `lib/parceiros/handoff.ts:301` |
| 13 | o middleware deixa `/cadastro(.*)` público, então a action da etapa 1 roda **sem auth** | `middleware.ts:57` |
| 14 | há limite em memória (`consumir`, `identificarChamador`), e nenhuma action o usa | `lib/seguranca/limite-de-requisicao.ts:67`, `:105` |
| 15 | WhatsApp da BeHemp: `NEXT_PUBLIC_WHATSAPP_BEHEMP`, usado só nas telas de link recusado | `lib/env.ts:247` · `app/(auth)/cadastro/[token]/page.tsx:39-40` |
| 16 | auditoria: `registrarAuditoria({ userId, acao, entidade, entidadeId?, dadosAntes?, dadosDepois? })`, que engole erro | `lib/utils/audit.ts:44` |

**Lado da Greens** (lido em `greens-corp-backend`, ADR-0028 §1.6): o handoff manda o e-mail sem
minúsculas e o telefone sem E.164. O relay do ChatPro não manda CPF nem e-mail. A Greens **não
espera** sinal de "já existe". Recusar no handoff derruba a jornada e o desconto dela. **Por isso
a conferência mora no nosso formulário (D-01), e o contrato não muda.**

### O que se implementa (ADR-0028 §8)

| fase | entrega | arquivo provável |
|---|---|---|
| 0 | `SELECT` de CPFs, e-mails e telefones repetidos em produção (ADR-0028 §5), **antes** do código | VPS, só leitura |
| 2 | guarda `a-identidade-e-conferida-na-etapa-1`, **vermelho** primeiro, + integração com seed (um cenário por classe + controle) | `__tests__/guardas/`, `__tests__/integracao/` |
| 3 | conferência de domínio: consulta normalizada + veredito sem dado da outra conta | `lib/cadastro/conferir-identidade.ts` (novo) |
| 4 | action da etapa 1: Zod, limite por link e IP, auditoria · conferência no carregamento | `app/_actions/` · `app/(auth)/cadastro/[token]/page.tsx` |
| 5 | a tela: veredito na etapa 1, aviso de sessão alheia movido da etapa 3, `signOut({ sessionId, redirectUrl })` | `formulario-de-cadastro.tsx` |
| 6 | a action final confere o CPF antes do `insert` | `app/_actions/cadastro-por-link.ts` |
| 7 | retificação dos guardas que casam literais | `a-sessao-precisa-ser-do-dono-do-link`, `o-cadastro-retoma-de-onde-parou` |
| 8 | prova local: `standalone` + Postgres em Docker + Chromium | — |

### Perigo de mexer

- **Em produção:** sim. É o funil de cadastro de **todas** as portas.
- **Arquivo central:** `formulario-de-cadastro.tsx` tem **2300 linhas** e é lido por mais de 10 guardas, alguns por literal.
- **Teste de antes e depois:** existe para os caminhos atuais (os guardas da tabela do `CLAUDE.md`). Para a conferência, nasce com o guarda novo.
- **O que quebra em quem consome:** a Greens, **nada** (D-01). O paciente passa a ver um passo novo na etapa 1.
- 🔴 **Não se prova local sem `CLERK_SECRET_KEY` de desenvolvimento:** a tela logada, o "Sair" e se o `#` do token sobrevive ao `redirectUrl`.

### Pendente de quem pediu (ADR-0028 §7)

- **A.** Onde vendas vê a "pesquisa".
- **B.** O suporte precisa de pendência no painel (migration)?
- **C.** O `/registrar-se` entra agora?
- **D.** O que fazer com os CPFs que já estão repetidos.
- **E.** CPF igual com o mesmo e-mail vai ao login ou ao suporte?

---

## ✅ Item 49 — CORRIGIDO, 28/09/2026: `POST /api/pusher/auth` negava TODO canal pessoal e todo chat desde 09/09

**Status:** ✅ **diagnosticado e corrigido** em 28/09/2026 (ver [a causa](#a-causa-medida-em-28092026)).
~~Catalogado, **não investigado**.~~ Visto pelo dono no teste manual da tela de pagamento em
produção, no mesmo dia do defeito do Brick remontando.

### A causa, medida em 28/09/2026

🔴 **Não era id errado: era a rota.** Os ramos `private-user-` (`app/api/pusher/auth/route.ts:51`)
e `private-chat-` (`:57`) só **recusavam**. Na permissão, a execução saía do `if / else if` e caía
no default — que o commit `e65771d` (09/09/2026) trocou, corretamente, de "autoriza qualquer canal"
para "nega" (`:108`, `Canal não reconhecido`). Antes dele, a função terminava com
`return … autenticarCanal(socketId, canal)`, a saída de sucesso dos dois ramos. **Desde o deploy
de 09/09, todo `private-user-` e todo `private-chat-` legítimo recebeu 403** — o aviso do webhook
de pagamento, o aviso de teleconsulta do painel do paciente, e o chat em tempo real (que não tem
polling: a mensagem de outro só aparecia no reload).

**Como se achou:** executando as duas pontas com a MESMA sessão, contra Postgres real — o canal que
`obterPagamentoDaReserva` entrega à tela, e o `POST` real da rota. O corpo da resposta
(`Canal não reconhecido`) apontou a linha 108 para um canal que COMEÇA com `private-user-`.

**Hipótese refutada no caminho:** `users.clerk_id` **não é único** no schema (só `email` é) e as
duas pontas fazem `.limit(1)` sem `orderBy` — com duplicata, cada uma poderia pegar uma linha.
Medido em produção: **0** `clerk_id` duplicados. Não é a causa; fica como fragilidade (abaixo).

**A correção:** cada ramo termina com o próprio `return … autenticarCanal(socketId, canal)`,
depois da checagem. O default continua negando. Provas:

- integração `o-canal-que-a-tela-assina-e-o-que-a-rota-aceita` (6 casos): **nasceu vermelha** nos
  dois legítimos (tela de pagamento e participante do chat) com os controles verdes; depois, 6/6
- guarda `todo-ramo-do-pusher-autoriza-no-proprio-ramo` (6 casos, no portão): deriva os ramos do
  código; **vermelho contra a rota de produção** (`e65771d`) e em 3 sabotagens, inclusive o
  default voltando a autorizar

### O que ficou (catalogado, não corrigido)

- 🔴 **`private-sala-*` sempre 403.** `components/teleconsulta/CopilotClinico.tsx:44` assina
  `private-sala-${salaId}`, prefixo sem ramo na rota → cai no default. E **ninguém publica** nesse
  canal (as únicas ocorrências são o `subscribe` e o `unsubscribe`). É assinatura morta na
  teleconsulta do médico. Corrigir é decidir se o canal deve existir — fora do escopo
- ⚠️ **`users.clerk_id` sem `unique`.** Não causou este defeito (0 duplicatas medidas), mas nada
  impede uma duplicata, e aí `.limit(1)` sem `orderBy` em várias pontas escolheria linhas
  diferentes. Exigiria migration

### ~~O que se sabia antes da medição~~ (mantido)

#### Por que importava

A tela de pagamento assina `private-user-{userId}` para receber o aviso do webhook
(`pagamento:atualizado`, `lib/mercadopago/aviso-ao-paciente.ts`). Se **esse** canal for o
recusado, o aviso em tempo real não chega. **O pagamento não se perde:** a confirmação também vai
por e-mail, e a tela relê o estado ao voltar ao foco. Mas o paciente fica sem o "confirmado" na hora.

#### O que o código mostrava — sem concluir

`app/api/pusher/auth/route.ts` tem **cinco** saídas 403, e cada uma diz um `erro` diferente no
corpo. É o que as distingue:

| linha | canal | `erro` no corpo | quando |
| --- | --- | --- | --- |
| `:55` | `private-user-{id}` | `Acesso negado` | o id do canal não é o `users.id` da sessão |
| `:72` | `private-chat-{grupo}` | `Acesso negado ao grupo` | a pessoa não participa do grupo |
| `:81` | sala de espera | `Acesso negado` | quem assina não é médico nem admin |
| `:96` | `presence-sala-{roomId}` | o `erro` de `garantirDonoDaSala` | a pessoa não é parte da sala |
| `:108` | qualquer outro | `Canal não reconhecido` | o default nega |

⚠️ **O `:55` e o `:81` devolvem o MESMO texto**, então só o `channel_name` do pedido os separa.
E o 403 pode ser de um canal que **outra** parte da página assina (o layout do paciente, a
teleconsulta global), e não da tela de pagamento. Nenhuma das hipóteses foi medida.

#### Como medir, antes de corrigir qualquer coisa

No navegador, na tela onde o 403 aparece: DevTools → Network → o pedido `auth` → **Payload**
(`channel_name`) e **Response** (`erro`). O par diz qual das cinco linhas respondeu. Sem PII: o
`channel_name` traz só ids internos.

**Perigo de mexer:** a rota é o controle de acesso de TODO canal privado (chat, teleconsulta,
notificações). Afrouxar um ramo para "resolver" o 403 é abrir canal alheio. O Item 11 (20/08) foi
exatamente isso no sentido contrário. A correção só entra depois de saber qual ramo.

---

## ✅ Item 48 — IMPLEMENTADO em 28/09/2026: o Payment Brick real na tela do paciente (Parte 2, Fase 5) — ⏳ aguardando merge

**Status:** implementado e provado **localmente**, branch `feat/fase5-payment-brick`, PR aberto.
**Não está em produção:** o merge espera a confirmação explícita do dono, porque este é o primeiro
PR que liga cobrança real ao fluxo do paciente. Com `MERCADOPAGO_AMBIENTE` ausente ou `teste`, a
chave usada é a de teste.

### O que existia antes

A etapa de pagamento (`components/shared/agendamento-pagamento-step.tsx`) era **só layout**: quatro
abas desabilitadas e _"Nenhuma cobrança é feita agora"_. O backend da Fase 2 (`iniciarCobranca`)
existia e ninguém o chamava. E a tela nem recebia o `consultaId`.

### O que existe agora

| peça | onde | o que faz |
| --- | --- | --- |
| o Brick | `components/shared/agendamento-pagamento-brick.tsx` | `@mercadopago/sdk-react@1.0.7`, `dynamic(…, { ssr: false })`; crédito (`:55`) e PIX, boleto e débito fora; **só à vista** (`maxInstallments: 1`, `:60`). O cartão chega tokenizado |
| a lógica da tela | `lib/agendamento/pagamento-na-tela.ts` | pura: `entradaDoBrick` (`:56`, snake_case do Brick → camelCase da action), `estadoDoResultado` (`:163`), `haPagamentoEmCurso` (`:218`), `combinarComSituacao` (`:244`) |
| o que se desenha | `components/shared/agendamento-pagamento-painel.tsx` | um painel por estado — QR code + copia-e-cola + validade REAL do PIX, aprovado, em análise, recusado (motivo pelo `status_detail`), expirada, pago sem horário, confirmado |
| a public key | `lib/mercadopago/public-key.ts:15` → `app/(paciente)/paciente/agendamento/page.tsx` | da conta do **integrador** (doc do Split 1:1), escolhida por `MERCADOPAGO_AMBIENTE`, entregue por prop — nunca `NEXT_PUBLIC_` |
| o aviso | `lib/mercadopago/aviso-ao-paciente.ts:27`, chamado em `lib/mercadopago/notificacoes.ts:315,342` | Pusher `pagamento:atualizado` no canal pessoal, só `{ consultaId, estado }`; nunca lança. A tela também relê ao voltar ao foco, e a confirmação já manda e-mail |
| a releitura | `app/(public)/_actions/agendamento.ts:580` (`obterPagamentoDaReserva`) | só leitura, escopo do paciente; diz o pagamento em curso e se o médico tem conta (`:624`) |
| à vista no servidor | `app/(public)/_actions/pagamento.ts:38` | `installments` `.max(1)` (era 12): o cliente não decide |

### 🔴 Três regras que a tela sustenta

1. **"aprovado" não é "confirmado".** A resposta do `POST` não confirma nada; a tela diz _"aprovado,
   confirmando sua consulta"_ e só diz "agendada" depois do webhook
2. **o prazo da reserva não expulsa quem está pagando** (`components/shared/agendamento-pagamento-step.tsx:168`).
   Antes, o wizard voltava ao começo aos 30 min — com o PIX valendo 31 — e dizia "o prazo acabou"
   a quem tinha acabado de pagar, desmentindo a trava da Fase 4
3. **médico sem conta não recebe oferta de pagamento**, em duas camadas mais a original:
   - na **escolha do médico** — `agendavel` de `podeAgendarCom` (`app/(public)/_actions/agendamento.ts:1070`),
     card desabilitado com mensagem (`components/shared/agendamento-wizard.tsx:390`). Só age com o
     interruptor do Item 38 ligado
   - na **tela de pagamento** — o Brick só aparece com o médico conectado
     (`components/shared/agendamento-pagamento-step.tsx:213`). Age também com o interruptor
     desligado, que é quando o paciente ainda chega aqui com um médico sem conta
   - e `reservarConsulta` continua recusando, como antes

### Provas

- guarda novo `a-tela-de-pagamento-nao-promete-o-que-o-webhook-nao-confirmou`: **39 casos**, com
  cada estado RENDERIZADO por `react-dom/server` (sem jsdom — o `vitest.config.mts` o recusa sem
  consumidor)
- integração `a-tela-de-pagamento-segue-o-que-o-servidor-diz`: **13 casos**, do envio do Brick à
  action real e ao aviso do webhook — PIX gera QR com a validade da API; cartão aprovado nunca vira
  "confirmado" antes do webhook; recusa mostra o motivo e aceita outro cartão; reserva expirada não
  chama a API; Pusher fora do ar não impede a confirmação; escopo de objeto; **o interruptor
  desligado (estado de produção) e ligado (lançamento)**; 2 parcelas recusadas antes do MP
- **17 sabotagens vermelhas.** Uma sobreviveu na primeira rodada por defeito do **guarda**: a regex
  de `disabled={!m.agendavel}` casava dentro de `aria-disabled` — corrigida com lookbehind e refeita
- `pnpm test` 1577/1577 · integração 121/121 · `tsc` 0 · baseline verde · `pnpm build` ok
- prévia de todos os estados renderizada com o CSS do build e capturada no Chrome headless

### ⚠️ O que NÃO foi provado

- **o Brick real não renderizou localmente**: não há public key do Mercado Pago no `.env` local
- o teste real de ponta a ponta (R$ 1,00, PIX e cartão, dinheiro na conta do médico) é a Fase 7 do
  plano, e só se faz em produção

### Medido em produção em 28/09 (leitura)

- **1 dos 6 médicos ativos** tem conta do Mercado Pago conectada — é o motivo das duas camadas acima
- `MERCADOPAGO_PUBLIC_KEY_TESTE/PRODUCAO` estão nos secrets; `MERCADOPAGO_AMBIENTE` e
  `MERCADOPAGO_WEBHOOK_SECRET` foram cadastrados pelo dono em 28/09 e chegam no próximo deploy

### O que ficou

- [Item 47](#-item-47--catalogado-28092026-o-pix-pedido-de-novo-depende-da-memória-do-mercado-pago-sobre-a-chave-de-idempotência):
  o QR code do PIX não é gravado (e o fallback por `external_reference` não existe)
- [Item 46](#-item-46--catalogado-28092026-três-outros-caminhos-cancelam-reserva-sem-olhar-o-pagamento-em-curso):
  os outros três caminhos de cancelamento
- ligar o interruptor do [Item 38](#-item-38--pendente-22092026-ligar-o-bloqueio-de-agendamento-do-mercado-pago)
  e trocar `MERCADOPAGO_AMBIENTE` para `producao` — **só no lançamento**, decisão do dono
- o 3DS (`pending_challenge`) não é pedido: o backend não envia `three_d_secure_mode`

---

## 🟠 Item 47 — CATALOGADO, 28/09/2026: o PIX pedido de novo depende da memória do Mercado Pago sobre a chave de idempotência

**Status:** catalogado, **não corrigido** (decisão do dono: _"guardar o QR code gerado em vez de
depender da memória do Mercado Pago sobre a chave de idempotência. Não implementar agora."_).
Achado ao implementar a Fase 5 (Payment Brick).

**O mecanismo.** O QR code do PIX **não é gravado**: só volta na resposta do `POST /v1/payments`.
Depois de um reload, a tela sabe que há PIX em curso, mas não tem o QR. O botão _"Mostrar o QR code
de novo"_ (`components/shared/agendamento-pagamento-painel.tsx:212`, chamado em
`components/shared/agendamento-pagamento-step.tsx:320`) pede o PIX outra vez, e isso só devolve
**o mesmo** PIX porque a chave de idempotência é a mesma (`lib/mercadopago/cobranca.ts:123`,
pagamento + prazo da reserva) e `criarCobranca` aceita essa repetição (`:251`).

⚠️ **E a doc não publica por quanto tempo o Mercado Pago lembra de uma chave** — o próprio código
diz isso (`lib/mercadopago/cobranca.ts:120`).

**O modo de erro.** Se o MP não lembrar da chave, cria um **segundo** PIX. `criarCobranca` grava a
referência nova por cima da antiga (`lib/mercadopago/cobranca.ts:476`, `gatewayReferenciaId`). Se o
paciente pagar o **primeiro** (o que ele já tinha copiado):

- a notificação chega com o id do primeiro, e `processarPagamento` procura a linha **só** por
  `gatewayReferenciaId` (`lib/mercadopago/notificacoes.ts:195`) → não acha → `'desconhecido'`
  (`:204`) — o dinheiro entra e a consulta **não** é confirmada
- 🔴 **o comentário de `cobranca.ts:333-334` promete o contrário:** _"se a gravação abaixo falhar
  depois de o MP criar o pagamento, o webhook ainda acha a linha por aqui"_ (pelo
  `external_reference`). **O código não faz isso** — o processamento não consulta
  `external_reference` para achar a linha. É um segundo achado, da mesma raiz

**A correção decidida (não implementada):** guardar o QR code gerado (`qr_code`, `qr_code_base64`,
validade) e devolvê-lo na releitura, sem chamar o MP de novo. Exige migration.

**O que também vale considerar** ao implementar: o fallback por `external_reference` no
processamento, que fecha o mesmo buraco pelo outro lado (e o caso da gravação que falha).

**Perigo de mexer:** migration aditiva (colunas nulas) + `criarCobranca` + a releitura da tela.
**Em produção hoje:** risco **zero** até a Fase 5 subir — nenhuma tela cobra (0 pagamentos
`em_processamento`, medido em 28/09). Com a Fase 5 no ar, o botão existe.

---

---

## 🟠 Item 46 — CATALOGADO, 28/09/2026: três outros caminhos cancelam reserva sem olhar o pagamento em curso

**Status:** catalogado, **não corrigido**. Achado ao implementar a Fase 4 (Item 40). É a **mesma
classe** do defeito corrigido em `expirarReservasVencidasDoPaciente`: cancelar reserva com PIX
ainda pagável ou pagamento `em_processamento`, o que entrega o horário a outro paciente e faz o
pagamento aprovado depois cair em `pago_sem_horario` (`lib/mercadopago/notificacoes.ts`).

| caminho | onde | quando cancela | olha o pagamento? |
| --- | --- | --- | --- |
| `confirmarConsultaPaga` **sem** `ignorarPrazo` | `lib/agendamento/confirmar-consulta-paga.ts:102-106` | prazo vencido, comparado em JS | não |
| `iniciarAguardoPagamento` | `app/(public)/_actions/agendamento.ts:377-380` | prazo vencido, comparado em JS | não |
| `cancelarReserva` (o paciente cancela) | `app/(public)/_actions/agendamento.ts:704`, e marca o pagamento `cancelado` logo depois | a pedido | não |

O guarda `a-expiracao-respeita-o-pagamento-em-curso` **não** os cobre: ele só enxerga filtro
**SQL** (`lte(consultas.expiraEm …)`), e os dois primeiros comparam em JavaScript.

**Por que não foi corrigido junto:** corrigir é decidir o que a tela diz. Se a reserva vencida
tem PIX pagável, `iniciarAguardoPagamento` deveria mostrar o QR code de novo? `confirmarAgendamento`
deveria responder "pagamento em andamento, aguarde"? E o paciente que pede para cancelar com o
cartão em análise, o que ouve? São decisões de UX e de negócio (Fase 5, a tela do Payment Brick).

**Perigo de mexer:** baixo no código (três condições), mas muda o que o paciente lê. **Em
produção hoje:** o risco é **zero enquanto nenhuma tela cobra de verdade**: medido em 28/09, 0
pagamentos `em_processamento` e 0 consultas com `pix_valido_ate`. Passa a valer com a Fase 5.

**Decisão do dono**, a pedir antes da Fase 5.

---

## 🟠 Item 45 — CATALOGADO, 28/09/2026: um PIX que nunca se resolve trava o horário além da janela da conciliação

**Status:** catalogado, **não corrigido**. Consequência deliberada da regra da Fase 4.

**O mecanismo.** A Fase 4 não libera reserva com pagamento `em_processamento`
(`lib/agendamento/liberar-reservas-expiradas.ts:49`, `semPagamentoEmCurso`), **mesmo com o PIX
já vencido**: foi a regra pedida, porque o dinheiro pode estar em trânsito. E `em_processamento`
é o status de **qualquer** resposta do Mercado Pago que não seja recusa, cancelamento ou estorno
(`lib/mercadopago/cobranca.ts:158`, o `default` de `statusLocal`), inclusive PIX `pending`.

Quem tira o pagamento de `em_processamento` é a notificação do MP (`cancelled` quando o PIX
expira) ou a conciliação. A conciliação só reenfileira pagamento iniciado **nas últimas 24 h**
(`lib/mercadopago/notificacoes.ts:88-99`). Se a notificação de cancelamento se perder **e** as
24 h passarem, o pagamento fica `em_processamento` para sempre, e a reserva **nunca** é liberada:
o horário do médico fica travado até alguém intervir.

**Por que não foi corrigido:** afrouxar a regra (liberar PIX vencido mesmo `em_processamento`)
reabre a corrida que a Fase 4 fecha. O caminho seguro é **conferir na API** antes de liberar, e
isso é decisão de desenho: estender a janela da conciliação para pagamentos com reserva vencida,
ou uma verificação periódica própria.

**Como medir, enquanto não houver correção** (leitura):

```sql
select count(*) from consultas c join pagamentos p on p.consulta_id = c.id
where c.status = 'reservada' and c.expira_em < now() and p.status = 'em_processamento'
  and p.pagamento_iniciado_em < now() - interval '24 hours';
```

**Em produção hoje:** 0 (medido em 28/09, nenhum pagamento `em_processamento`). Passa a importar
com a Fase 5. Aparece também no contador `protegidas` do log do worker: um `protegidas` que não
cai com o tempo é este caso.

---

## ⏳ Item 44 — IMPLEMENTADO, 24/09/2026: o worker das filas no PM2 (ADR-0027), aguardando o primeiro deploy

**Status:** implementado e provado **localmente**, branch `feat/worker-filas-pm2`. **Não está em
produção.** Decisão em
[ADR-0027](adr/ADR-0027-o-worker-das-filas-roda-no-pm2-e-o-github-vira-rede.md), agora aceita;
o que a implementação mediu está na §6 dela.

### O problema que ele resolve (medido em 24/09/2026, ADR-0027 §1)

O `filas.yml` declara `*/5 * * * *` e roda **uma vez a cada ~3,5 a 4 h** em produção. O
paciente do WhatsApp espera horas pelo link, e a expiração de reserva e de PIX da Fase 4 não
pode chegar quatro horas depois (Item 40).

### O que foi feito

| arquivo                                                           | o quê                                                                                       |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `scripts/worker-filas-nucleo.mjs`                                 | a lógica, importável sem agendar nada                                                       |
| `scripts/worker-filas.mjs`                                        | o ponto de entrada que o PM2 sobe                                                           |
| `.github/workflows/deploy.yml:447-481`                            | `pm2 delete` + `env -i … pm2 start` do `behemp-filas`, depois do site e antes do `pm2 save` |
| `__tests__/guardas/o-worker-das-filas-nao-para-numa-rota.test.ts` | 27 casos, 17 sabotagens                                                                     |
| `.claude/autorizacoes.txt`                                        | o registro desta mudança no `deploy.yml` (o caminho já estava liberado desde 20/08)         |

**Como o worker se comporta:** chama `/api/chatpro/processar`, `/api/parceiros/enviar` e
`/api/mercadopago/processar` em **sequência**, em `http://127.0.0.1:${PORT||3000}`, com
`Bearer $CRON_SECRET`. A próxima rodada é agendada 60 s depois do **fim** da anterior
(`setTimeout` encadeado, D-03). Uma rota falhar (rede, timeout de 90 s, 5xx) não impede as
outras. **Não segue redirect:** o 307 do middleware (Item 41) seria um 200 da página de login.
Sucesso é 200 **com** `sucesso: true`. O log leva só número e booleano, com horário ISO. No
SIGINT/SIGTERM, cancela o agendamento e aborta a chamada em curso.

### O ambiente do worker é mínimo — decisão da revisão

O deploy sobe o worker com `env -i PATH HOME PORT CRON_SECRET` (e `PM2_HOME` só se definido).
Herdar o shell, que carregou o `.env` inteiro, duplicaria no `dump.pm2` todos os segredos do
site: a exposição do [Item 43](#-item-43--catalogado-24092026-a-senha-da-database_url-de-produção-apareceu-em-texto-puro-no-terminal).
**Medido com PM2 7.0.4:** herdando, o processo recebeu o segredo falso do shell; com `env -i`,
só as quatro. O daemon não mistura o próprio ambiente. Detalhe na ADR-0027 §6.

### Provado local (24/09/2026)

- standalone **isolado** (sem o `.env`, que aponta para Neon remoto; banco inexistente;
  nenhuma credencial de terceiro): duas rodadas a 60 s, 500/200/500 registrados, SIGINT → exit 0,
  segredo **0** vezes nos logs;
- segredo errado ou ausente → 401; site fora → `ECONNREFUSED` nas três, sem travar;
- sob PM2: `pm2 kill` + `pm2 resurrect` sem `PORT`/`CRON_SECRET` no ambiente religou o worker
  pelo dump, funcional;
- o bloco do `deploy.yml` com `pm2` falso: se o `start` do worker falhar, o `save` roda e o
  passo sai com exit 1 — o dump nunca fica com o caminho antigo do site.

### Perigo de mexer — medido

- **em produção:** sim, no primeiro deploy depois do merge. É o **primeiro processo novo** no
  PM2 da EC2
- **o site:** o worker sobe **depois** dele, e sua falha não impede o `pm2 save`. O pior caso é
  o deploy vermelho com o site no ar e as filas no ritmo de hoje (`filas.yml`)
- **dobro de chamadas:** worker e GitHub chamam as mesmas rotas; as três reivindicam com
  `FOR UPDATE SKIP LOCKED` (ADR-0027 D-02)
- **limite do Mercado Pago (R-05):** o worker chama sem `x-forwarded-for` e cai no balde
  `desconhecido`, 1/min contra 10/min
- **desfazer:** `pm2 stop behemp-filas` (ou `pm2 delete behemp-filas && pm2 save`); o
  `filas.yml` segue como rede (D-06)

### O que fica para depois do primeiro deploy

1. **a versão do PM2 na EC2** (`pm2 --version`) — o comportamento acima foi medido na 7.0.4;
2. `pm2 ls` com `behemp-site` e `behemp-filas` `online` (R-02);
3. `pm2 logs behemp-filas` com rodadas a ~60 s e `200` nas três rotas (R-04);
4. um evento de ChatPro de teste saindo de `pendente` em menos de 2 min, sem `workflow_dispatch`;
5. `free -m` antes, logo depois e após 24 h (R-01), registrado na ADR-0027 §6.

---

## 🔴 Item 43 — CATALOGADO, 24/09/2026: a senha da `DATABASE_URL` de produção apareceu em texto puro no terminal

**Status:** catalogado, **não corrigido**. **Sem urgência**, por decisão do Diniz em 24/09/2026:
tratar depois. Achado durante a investigação do [Item 42](#-item-42--corrigido-24092026-com-prova-real-o-pm2-startup-nunca-tinha-sido-configurado-na-ec2-e-um-reboot-derrubava-produção-inteira).

### O que aconteceu

Ao inspecionar o `~/.pm2/dump.pm2` na EC2 com `head -c 300`, a saída mostrou a `DATABASE_URL`
com a senha. O arquivo é um JSON com **todas** as variáveis de ambiente de cada processo, e
`DATABASE_URL` é uma delas. Isso é comportamento esperado do PM2: é assim que o `pm2 resurrect`
religa o processo com o ambiente certo, o que este projeto usa de propósito
(`preservar-ambiente-do-pm2.mjs`).

**O que se sabe:** a senha apareceu na tela do terminal de quem estava investigando.
**O que não foi medido:** se a saída foi copiada para outro lugar (chat, ticket, gravação de
tela) e qual é a permissão do `~/.pm2/dump.pm2` na EC2.

### A correção, quando decidida

Rotacionar a senha do role do banco no Neon e atualizar a `DATABASE_URL` onde ela vive:
secret do GitHub, `.env` da EC2 e, por consequência, o `dump.pm2` no próximo `pm2 save`.

⚠️ **Perigo de mexer:** trocar a senha no Neon derruba o acesso ao banco do processo em execução
até ele subir com a URL nova. Precisa de janela própria. A ordem (secret → deploy ou `.env` →
restart) e o risco do `preservar-ambiente-do-pm2.mjs` **copiar de volta a URL antiga** do
ambiente do processo precisam ser medidos **antes**, porque é a mesma classe do Item 36 (trocar credencial que vive no ambiente herdado do PM2).

**Para não repetir:** inspecionar o dump sem imprimir valores, por exemplo
`jq '.[] | {name, pm_exec_path, env_keys: (.env | keys)}' ~/.pm2/dump.pm2`.

---

## ✅ Item 42 — CORRIGIDO, 24/09/2026, com prova real: o `pm2 startup` nunca tinha sido configurado na EC2, e um reboot derrubava produção inteira

**Status:** ✅ **corrigido em 24/09/2026 e provado com reboot controlado real** (ver
[a correção aplicada](#a-correção-aplicada-24092026) e [a prova](#a-prova-reboot-controlado-real-24092026)).
O diagnóstico abaixo fica como estava ao catalogar: ele é o _antes_ da prova.

**Status ao catalogar:** catalogado, **não corrigido**. **Prioridade alta.** Achado ao medir os valores
pendentes da [ADR-0027](adr/ADR-0027-o-worker-das-filas-roda-no-pm2-e-o-github-vira-rede.md)
(R-03). É um defeito próprio e **anterior** a ela: não depende do worker e não se resolve com ele.

### O que foi medido (24/09/2026, na EC2 de produção, pelo dono)

| pergunta                                  | comando                                                         | resultado                          |
| ----------------------------------------- | --------------------------------------------------------------- | ---------------------------------- |
| existe unit systemd do PM2?               | `systemctl list-unit-files \| grep -i pm2`                      | **nenhuma**                        |
| a unit do usuário está habilitada/ativa?  | `systemctl is-enabled pm2-ubuntu` · `systemctl is-active pm2-ubuntu` | **`not-found`** · **`inactive`** |
| há quanto tempo a máquina está de pé?     | `uptime -s`                                                     | desde **07/08/2026**, **49 dias**  |

⚠️ **O que NÃO foi relatado nesta medição:** o conteúdo do `~/.pm2/dump.pm2`. Sem a unit
systemd, isso não muda o diagnóstico: nada lê o dump no boot. Mas vai importar na correção
(ver abaixo).

### O que isso significa

O site está no ar há 49 dias **só porque a EC2 não reiniciou nesse período**. Se ela reiniciar
por qualquer motivo, **nada volta sozinho**: nem o `behemp-site`, nem qualquer processo que
venha depois, como o `behemp-filas` da ADR-0027. Motivos possíveis incluem manutenção agendada
da AWS, retirement de hardware, kernel panic, `sudo reboot` manual e atualização automática do
Ubuntu que pede reinício.

**O `pm2 save` do deploy dá uma falsa sensação de segurança.** O `.github/workflows/deploy.yml:443`
roda `pm2 save` a cada deploy, e isso grava o `dump.pm2`. Mas quem **lê** o dump no boot é a
unit que o `pm2 startup` cria, e ela não existe. O dump é gravado a cada deploy e nunca é lido.

**Varredura do repositório:** `pm2 startup`, `pm2 resurrect` e `systemctl` aparecem em
**0** arquivos de `.github/`, `scripts/`, `docs/*.md` e `CLAUDE.md`. Nunca houve um passo
versionado para isso. É a mesma classe do Item 28: estado de servidor que ninguém sabia que
faltava.

### Perigo de mexer — medido

- **em produção:** sim. A correção roda na EC2, com `sudo`
- **pontos tocados:** 1 unit systemd nova (`pm2-ubuntu.service`) e o `dump.pm2`. **Nenhum**
  arquivo do repositório precisa mudar para corrigir
- **derruba o site?** não. `pm2 startup` só cria e habilita a unit; `pm2 save` só grava a lista
  que está rodando. Nenhum dos dois reinicia processo
- **teste antes/depois:** `systemctl is-enabled pm2-ubuntu` → `enabled`. A prova completa é um
  reboot controlado, que **derruba o site por alguns minutos** e precisa de janela própria
- **custo de deixar:** o primeiro reboot não planejado tira produção do ar até alguém entrar
  por SSH e subir o processo à mão, com o `.env` e o caminho do `server.js` certos. Foi
  exatamente o que o Item 28 mostrou ser difícil

### A correção, quando autorizada

✅ **Aplicada em 24/09/2026** — ver a seção seguinte. O texto abaixo é o plano como foi escrito
ao catalogar: _"🔴 **Não aplicada.** É escrita na EC2 e precisa de **autorização explícita
separada**, mesmo sendo simples."_

```bash
pm2 startup systemd -u ubuntu --hp /home/ubuntu   # imprime um comando sudo; rodar o que ele imprimir
pm2 save                                          # grava a lista que está rodando AGORA
systemctl is-enabled pm2-ubuntu                   # → enabled
```

⚠️ **Antes do `pm2 save`, conferir que `pm2 ls` mostra o `behemp-site` com o `script path`
do checkout atual.** É o dump desta hora que o boot vai restaurar. Um `behemp-site` apontando
para um `server.js` velho seria ressuscitado no caminho errado (Unitech/pm2#3054, registrado no
`deploy.yml:405-411`).

**Rejeitado: pôr `pm2 startup` dentro do `deploy.yml`.** O comando precisa de `sudo`, e cada
deploy passaria a mexer em unit systemd. A configuração é feita uma vez só. O que cabe no
repositório é **registrar** que ela existe (este item) e, se valer a pena, um passo de
**verificação** no deploy que só lê `systemctl is-enabled pm2-ubuntu` e avisa, sem corrigir.

### A correção aplicada (24/09/2026)

Rodado na EC2 de produção, pelo dono, nesta ordem:

```bash
pm2 startup systemd -u ubuntu --hp /home/ubuntu                              # imprime o comando sudo
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu # o comando impresso
pm2 save                                                                     # grava a lista em execução
```

**Resultado:** unit `pm2-ubuntu.service` criada em `/etc/systemd/system/` e habilitada via
`systemctl enable` — conferido por `systemctl is-enabled pm2-ubuntu` → **`enabled`** (antes:
`not-found`).

⚠️ **Não relatado:** a saída de `pm2 ls` antes do `pm2 save` (a conferência do `script path`
pedida acima). O reboot abaixo é a evidência indireta de que o dump restaurou o processo
certo: o site voltou com 200.

### A prova: reboot controlado real (24/09/2026)

Configuração habilitada não prova que o boot restaura. A prova é reiniciar a máquina.

`sudo reboot` disparado às **12:10**, medido por `curl` em loop a cada 5 s contra
`https://be4hope.org/`:

| horário           | resposta         | leitura                          |
| ----------------- | ---------------- | -------------------------------- |
| 12:10:04–12:10:22 | **sem resposta** | máquina reiniciando              |
| 12:10:30          | **HTTP 502**     | nginx de pé, app ainda subindo   |
| 12:10:36          | **sem resposta** | troca de processo durante o boot |
| 12:10:44          | **HTTP 200**     | app no ar                        |
| 12:10:50          | **HTTP 200**     | estável                          |

- **Indisponibilidade total:** ~46 s, do reboot ao primeiro 200.
- **Intervenção manual: nenhuma.** O site voltou sozinho, pela cadeia systemd →
  `pm2-ubuntu.service` → `pm2 resurrect` → `dump.pm2`.

⚠️ **Fuso do horário, inferido e não registrado na medição:** os horários são de
**Brasília (UTC−3)**, ou seja, 15:10 UTC. A inferência: o Item 42 foi catalogado no commit
`13e8728`, às 11:21 −03:00. Se fosse 12:10 UTC, o reboot teria sido às 09:10 de Brasília,
**antes** de o defeito ser conhecido.

🔴 **Ressalva de segurança, catalogada à parte:** durante a investigação, a senha da
`DATABASE_URL` de produção apareceu em texto puro no terminal. Ver
[Item 43](#-item-43--catalogado-24092026-a-senha-da-database_url-de-produção-apareceu-em-texto-puro-no-terminal).

### Relação com a ADR-0027

A ADR-0027 R-03 dependia deste valor. O worker sobrevive a **deploy** pelo passo `delete` +
`start` + `pm2 save`, mas só sobrevive a **reboot** depois que este item for corrigido. E isso
vale igual para o site principal. A ADR não fica bloqueada por este item: ela não piora nada que
já não esteja quebrado.

**Depois da correção (24/09/2026):** o site principal sobrevive a reboot, provado. O
`behemp-filas` ainda não existe. Quando existir, herda a correção **desde que** o deploy rode
`pm2 save` depois de subi-lo, porque o boot restaura o dump, não o `deploy.yml`.

---

## ✅ Item 41 — CORRIGIDO em 23/09/2026: o processador do Mercado Pago exigia login em produção

**Branch:** `fix/mercadopago-processar-publico`. Defeito **meu** (Claude), introduzido no PR
#122 (Item 39).

### O que aconteceu

Medido em produção logo depois do deploy do PR #122:

```
curl https://be4hope.org/api/mercadopago/processar
→ 307  https://be4hope.org/entrar?redirect_url=…%2Fapi%2Fmercadopago%2Fprocessar
```

`middleware.ts` libera `/api/webhooks(.*)` (o webhook funcionava), mas não havia entrada para
`/api/mercadopago/processar`. O Clerk exige sessão **antes** de a rota rodar. O cron do
`filas.yml` (`.github/workflows/filas.yml:80`) não tem sessão, exige 200, e marcaria vermelho
a cada execução. **A conciliação dos pagamentos nunca rodaria.**

**Impacto real, medido:** nenhum pagamento afetado. Nenhuma tela chama a cobrança, e o
`MERCADOPAGO_WEBHOOK_SECRET` não está cadastrado (o log do deploy mostra `gravar … ""`). O cron
não chegou a rodar entre o deploy e a correção: o `schedule` do GitHub estava disparando a
cada ~4 h.

### Por que nenhum teste pegou

A integração (`o-webhook-do-mercado-pago-confirma-o-que-a-api-diz`) chama o handler **direto**,
sem o middleware. Era verde e continuava verdadeira, **sobre a camada que exercitava**. É o
limite _"guarda lê o código, não executa o caminho"_, aqui entre duas camadas. E eu **não**
subi o `server.js` com `curl` na rota antes do deploy, o nível 2 da regra "Deploy CUSTA". Esse
passo teria mostrado o 307 em segundos.

**Segunda vez desta classe:** o Item 21 (09/09) foi o mesmo defeito com as rotas do ChatPro.

### A correção

- `middleware.ts`: uma entrada, o caminho **exato** `'/api/mercadopago/processar'`, nunca o
  prefixo. Autorização do dono registrada em `.claude/autorizacoes.txt`. A rota continua
  autenticada pelo `CRON_SECRET`
- guarda novo `o-cron-chama-rota-que-o-middleware-deixa-passar`: **deriva as URLs do
  `filas.yml` e os padrões do `middleware.ts`**, e casa os dois com o `createRouteMatcher` do
  próprio Clerk. O próximo passo novo do cron nasce coberto. 11 casos, **8 sabotagens**,
  incluindo "prefixo em vez do exato", "catch-all" e "extrator cego". Nasceu vermelho
  apontando só o processador; ChatPro e parceiros verdes

### Prova local (build standalone, `NODE_ENV=production`, Clerk configurado, Postgres local)

| estado                                                                                         | resposta                                          |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **antes** da correção, segredo certo                                                           | `307 → /entrar` (o defeito reproduzido)           |
| depois, `CRON_SECRET` vazio no servidor                                                        | `503` "Processador não configurado"               |
| depois, segredo errado / sem cabeçalho                                                         | `401`                                             |
| depois, segredo certo                                                                          | `200`, `{"reenfileirados":0,"reivindicados":0,…}` |
| controles: `/api/mercadopago/outra-rota`, `/api/medico/mercadopago/conectar`, `/medico/agenda` | `307`, continuam exigindo sessão                  |

⚠️ **Dois artefatos do ambiente local, para quem repetir:**

1. `HOSTNAME=127.0.0.1` fez a rota pública responder **500**: o log diz `Failed to proxy`
   para `localhost:3999`, com `EADDRNOTAVAIL` e `ECONNREFUSED ::1`. O proxy interno do Next
   chama `localhost`. Suba com `HOSTNAME=0.0.0.0`, que é o padrão da VPS
2. `unset CRON_SECRET` **não** testa a ausência. `pnpm build` copia o `.env` para
   `.next/standalone/`, e o `server.js` o recarrega. Para a ausência, exporte a variável
   **vazia**: o `@next/env` não sobrescreve variável já definida

### O que ficou

- as rotas `processar` do ChatPro e dos parceiros seguem sem limite de requisição (Item 39)
- confirmar em produção depois do deploy: `curl …/api/mercadopago/processar` deve dar `401`,
  não `307`
- ⚠️ **LIMITE CONHECIDO DO GUARDA, não implementado:** ele deriva as URLs **do `filas.yml`**.
  Rota chamada por **serviço externo** (o servidor do ChatPro, o da Greens, o Mercado Pago, a
  nuvem do Inngest em `/api/inngest`) não aparece no `filas.yml` e **não é coberta**. Hoje
  essas rotas são públicas por outras entradas do `middleware.ts` (`/api/chatpro(.*)`,
  `/api/parceiros(.*)`, `/api/webhooks(.*)`, `/api/inngest(.*)`). Duas delas têm caso por nome
  (`/api/chatpro` em `cadastro-por-link-abre-sem-conta`, `/api/parceiros` em
  `handoff-do-parceiro-e-assinado-e-idempotente`). **`/api/webhooks` e `/api/inngest` não têm
  nenhum**, e é por `/api/webhooks(.*)` que o webhook do Mercado Pago passa. Uma rota nova de
  máquina fora desses prefixos nasceria descoberta. Cobrir
  exigiria outra fonte de verdade, como uma lista declarada das rotas de máquina, e isso fica
  para decisão própria

---

## ✅ Item 40 — CORRIGIDO na Fase 4, 28/09/2026: o job `liberarReservasExpiradas` do Inngest nunca rodou em produção

**Status:** ✅ **corrigido pela Fase 4** em 28/09/2026, branch `feat/fase4-expiracao-reservas`
(ver [a correção](#-a-correção-fase-4-28092026) e [o adendo da limpeza manual](#-adendo-28092026--as-8-reservas-vencidas-canceladas-à-mão-antes-da-fase-4)
no fim deste item). ~~Catalogado, **não corrigido**.~~ Achado ao desenhar a Fase 3 do Mercado
Pago, não é consequência dela.

### O que o código promete

`lib/integrations/inngest/functions.ts:440` declara `liberarReservasExpiradas` com
`triggers: [{ cron: '*/5 * * * *' }]` (`:444`). A cada 5 min ele deveria buscar consultas
`reservada` com `expiraEm` vencido (`:467`), cancelá-las (`:479`, `status: 'cancelada'`) e
avisar o paciente por e-mail. É registrado em `app/api/inngest/route.ts:25`.

### O que produção mostra

**7 reservas `reservada` e vencidas desde 10/09/2026**, travando esses horários: o índice único
de horários trata `reservada` como ativa, então nenhum outro paciente consegue pegá-los.
⚠️ **Esta medição é da sessão da Fase 2/3 em 23/09/2026** (registrada em
`lib/mercadopago/notificacoes.ts:26-27` e no comentário de `ignorarPrazo`,
`lib/agendamento/confirmar-consulta-paga.ts:42-50`). **Não foi refeita nesta sessão**, e o
número precisa ser remedido antes de qualquer decisão.

### Causa — HIPÓTESE, não medida

- ~~`INNGEST_EVENT_KEY` e `INNGEST_SIGNING_KEY` existem em `lib/env.ts:228-229` e **não estão**
  em nenhuma linha `gravar` do `.github/workflows/deploy.yml`, então não chegam ao processo
  (mesma classe de `o-segredo-cadastrado-chega-ao-servidor`, que não varre
  `lib/integrations/inngest`)~~ — 🔴 **RETRATADO em 23/09/2026, ver abaixo**
- o comentário de `app/api/inngest/route.ts` diz _"Em prod: configurar URL no painel Inngest"_:
  não há registro de que isso tenha sido feito

A confirmar **antes** de corrigir: o painel do Inngest tem o app sincronizado? `/api/inngest`
responde em produção? Sem essas duas respostas, não se sabe se falta chave, registro, ou os dois.

#### 🔴 RETRATAÇÃO, 23/09/2026 — as chaves `INNGEST_*` EXISTEM em produção

A primeira hipótese acima estava errada. O log do deploy do PR #122 (run `35917760262`, passo
"Reiniciar Servidor (PM2)") lista o que `preservar-ambiente-do-pm2.mjs` recuperou do processo
em produção, e as duas estão lá:

```
INNGEST_EVENT_KEY  ← ambiente do processo
INNGEST_SIGNING_KEY  ← ambiente do processo
```

**O erro de raciocínio:** tratei "não está na lista `gravar`" como "não chega ao processo". O
`deploy.yml` escreve a lista `gravar` **e** preserva o ambiente que o PM2 já tinha. Uma
variável fora da lista pode existir, herdada de um `pm2 start` antigo. É a mesma classe do
achado de 22/09 (_"sintoma funcionando não prova schema"_), invertida: ler o `deploy.yml` diz o
que ele ESCREVE, e só o processo diz o que EXISTE.

**O que vale agora:** a causa real **não foi medida**. Sobra a segunda hipótese (o app nunca
foi sincronizado no painel do Inngest) e outras ainda não levantadas, como chave de outro
ambiente ou `/api/inngest` recusando a assinatura. As duas perguntas do parágrafo acima
continuam sendo o próximo passo, agora sem a pista falsa.

### 🔴 Os modos de erro — por que NÃO basta "ligar"

1. **O mesmo endpoint serve outras 4 funções** (`verificarValidadeDocumentos`,
   `verificarRecompraMedicamentos`, `enviarEmailRecompraAgendado`, `digestDiarioAdmin`). Elas
   também nunca rodaram. Ligar o Inngest liga **as cinco**, e a primeira execução dispara de
   uma vez o acúmulo de semanas, com e-mail para pessoas reais. É o aviso do achado de 10/09
   (_"NÃO LIGAR os 3 crons antigos sem medir antes"_, `docs/03`) por outro caminho.
2. **A corrida com o pagamento.** Com o job rodando, uma reserva com PIX ainda pagável ou cartão
   `em_processamento` seria cancelada e o horário iria para outro paciente, e aí o pagamento
   aprovado cai em `pago_sem_horario` (`lib/mercadopago/notificacoes.ts:288`). A trava
   `consultas.pix_valido_ate` existe desde a migration `0047`; **o job ainda não a lê**, e
   também não pula `em_processamento`. Esse é o pendente da Fase 4 registrado no commit
   `2214e76`.
3. As 7 reservas vencidas receberiam agora o e-mail de "sua reserva expirou", **duas semanas
   depois**.

### O que já contorna, sem corrigir

- o webhook do Mercado Pago confirma reserva vencida quando a API diz `approved`
  (`ignorarPrazo`, `lib/agendamento/confirmar-consulta-paga.ts:102`). Se continua `reservada`,
  ninguém pegou o horário, e o paciente pagou
- a conciliação da Fase 3 roda pelo `filas.yml` (GitHub Actions), **não** pelo Inngest

### Perigo de mexer — medido pela leitura do código

- **em produção:** sim. Qualquer correção muda comportamento visível (cancelamentos + e-mails)
- **pontos tocados:** `deploy.yml` (chaves), painel do Inngest, `functions.ts` (a trava do
  pagamento, Fase 4), mais uma decisão sobre as outras 4 funções
- **teste antes/depois:** não existe teste de integração do job
- **custo de deixar:** horários travados continuam indisponíveis, e cada reserva abandonada
  nova soma mais um

**Decisão do dono**, a pedir: corrigir junto da Fase 4, com o job lendo `pix_valido_ate` e
pulando `em_processamento`, e primeiro remedir as 7 e o volume das outras 4 funções.

### ✅ A correção (Fase 4, 28/09/2026)

**A causa raiz deixou de importar:** a expiração não depende mais do Inngest (que nunca rodou)
nem do `filas.yml` (que roda a cada ~4 h, ADR-0027 §1). Ela roda no **worker das filas**, a cada
~60 s, e o Inngest **continua sem ser ligado**: por isso o volume das outras 4 funções não
precisou ser medido.

| peça | onde | o que faz |
| --- | --- | --- |
| a regra | `lib/agendamento/liberar-reservas-expiradas.ts:49` (`semPagamentoEmCurso`) | não libera com `pix_valido_ate > agora` nem com pagamento `em_processamento` (soft delete não tira a proteção) |
| a função | `lib/agendamento/liberar-reservas-expiradas.ts:81` | UM `UPDATE … WHERE id IN (subquery)`, teto de 50 por chamada; mantém o efeito antigo (motivo no pagamento, e-mail) e acrescenta auditoria. Devolve `{ liberadas, protegidas }` |
| a rota | `app/api/agendamento/expirar/route.ts` | limite de 10/min **antes** do segredo, 503 sem `CRON_SECRET`, 401 com o errado |
| middleware | `middleware.ts:103` | o caminho **exato** (lição do Item 41) |
| chamadores | `scripts/worker-filas-nucleo.mjs:24`, `.github/workflows/filas.yml:96` | a quarta rota do worker, e o passo de rede no cron |
| 🔴 o segundo caminho | `app/(public)/_actions/agendamento.ts` (`expirarReservasVencidasDoPaciente`) | **também violava a regra**: roda toda vez que o paciente abre a tela de agendamento. Quem volta para ver o QR code cancelaria a própria reserva. Agora usa a mesma `semPagamentoEmCurso` |
| Inngest | `lib/integrations/inngest/functions.ts` | delega à mesma função: religá-lo não traz de volta a cópia sem a trava, e o step devolve só contadores (nada de nome/e-mail na nuvem dele) |

**Provas:** integração `a-expiracao-respeita-o-pagamento-em-curso` (**13 casos** contra Postgres
real, inclusive duas chamadas simultâneas e a corrida do plano: protegida agora, webhook aprovado
confirma depois). Guarda novo `a-expiracao-respeita-o-pagamento-em-curso` (5 casos). Estendidos
`as-rotas-sensiveis-tem-limite`, `a-confirmacao-paga-nao-e-action-publica`,
`o-segredo-cadastrado-chega-ao-servidor`, `o-cron-chama-rota-que-o-middleware-deixa-passar` (este
pegou a rota nova sozinho, por derivar do `filas.yml`) e `o-worker-das-filas-nao-para-numa-rota`.
**Sabotagens:** 12 ficaram vermelhas, incluindo tirar a checagem de `pix_valido_ate` e a de
`em_processamento`. Uma terceira, a primeira tentativa contra `em_processamento`, passou verde
porque a **sabotagem** estava mal escrita (acrescentava em vez de remover) e foi refeita em duas
variantes, as duas vermelhas. Build `standalone` com o middleware real do Clerk: 401 sem segredo e com o
errado, 200 com o certo, 307 no controle de prefixo.

⚠️ **Duas sabotagens ficaram verdes, e o motivo está escrito:** tirar do `WHERE` externo do
`UPDATE` a trava do pagamento, e tirar dele a trava inteira (mantendo as duas na subquery). É defesa em profundidade; nenhum teste
reproduz a corrida dentro de um único comando do Postgres. E o limite do que ela garante está no
cabeçalho da função: um pagamento que **commita durante** o comando não o impede (cai em
`pago_sem_horario`, visível ao admin).

**O que ficou:** [Item 45](#-item-45--catalogado-28092026-um-pix-que-nunca-se-resolve-trava-o-horário-além-da-janela-da-conciliação)
(PIX nunca resolvido trava o horário) e [Item 46](#-item-46--catalogado-28092026-três-outros-caminhos-cancelam-reserva-sem-olhar-o-pagamento-em-curso)
(três outros caminhos de cancelamento). E **a primeira execução em produção**, que acontece no
deploy desta branch.

### 🔧 Adendo, 28/09/2026 — as 8 reservas vencidas canceladas à mão ANTES da Fase 4

**Motivo:** limpar dado histórico antes da primeira execução real da Fase 4. Sem isso, o
primeiro ciclo do worker (~60 s depois do deploy) enviaria o e-mail de "sua reserva expirou" a 8
pacientes, o mais antigo com **18 dias** de atraso e 7 deles para horários **que já tinham
passado**. É correção de dado, não evento de negócio: por isso **sem e-mail**.

**COMMIT em 28/09/2026 às 11:10:00 UTC (08:10:00 de Brasília)**, pedido pelo dono, depois de
ele conferir os IDs contra a medição de leitura do mesmo dia.

```sql
UPDATE consultas SET status = 'cancelada'
WHERE status = 'reservada' AND expira_em < now();
```

| id | `expira_em` (UTC) | horário original (UTC) |
| --- | --- | --- |
| `gc1fj16vu1s48wyhz3i36290` | 10/09 19:55:44 | 13/09 19:40 |
| `xvopycf4lz4jg53du0z2i5je` | 11/09 16:55:48 | 24/09 23:30 |
| `rr7zcb18s897siee8ckltp24` | 11/09 16:55:55 | **29/09 23:30** (o único ainda futuro, horário devolvido) |
| `cm34md723tlc0qn0ww2k7bfo` | 11/09 16:55:58 | 14/09 21:00 |
| `e4ntpdqzbo9ay1zq684a8fsp` | 11/09 16:56:22 | 25/09 02:00 |
| `x96vddk5eu1zg3fhwja73cq8` | 14/09 17:54:53 | 15/09 23:30 |
| `twoairsx778uc4av2bcz1nr5` | 14/09 17:55:02 | 14/09 21:30 |
| `amjqo4u3sfjbsp8613jh4vc7` | 24/09 14:18:36 | 25/09 00:00 |

Nenhuma tinha `pix_valido_ate` nem pagamento `em_processamento`: 4 com pagamento `pendente`, 4
sem linha de pagamento.

**Como foi feito:** uma transação só, com o `SELECT` antes (8 linhas), o `UPDATE … RETURNING`
(8 linhas, **os mesmos IDs**), e `ROLLBACK` automático se a contagem, os IDs ou os pagamentos
divergissem. Ficou aberta até o dono responder, com `ROLLBACK` automático em 20 min.
`consultas` não tem trigger nem regra (conferido em `pg_trigger`/`pg_rules`), então nada fora
dela foi escrito.

**Confirmado:**

- **nenhum e-mail disparado.** O `UPDATE` foi direto no banco, sem passar pela aplicação
- **pagamentos intactos:** as 4 linhas de `pagamentos` dessas consultas, `md5` da linha inteira,
  **`62cfa550cb8c` antes e depois** do `UPDATE`, e de novo numa conexão nova depois do COMMIT.
  `pagamentos.status` não foi tocado
- depois do COMMIT: as 8 `cancelada`, e **0** reservas `reservada` vencidas no banco

⚠️ **O que a query do dono não fez, de propósito:** `expira_em` continua preenchido (o código
limpa ao cancelar), `updated_at` não mudou (quem o atualiza é o Drizzle, não o banco), e não há
registro em `logs_auditoria`. Este adendo é o registro.

---

## ✅ Item 39 — ENTREGUE em 23/09/2026: webhook do Mercado Pago, fila, conciliação (Parte 2, Fase 3)

**Em produção desde 23/09/2026:** PR #122, merge `d5464fd`, deploy `35917760262` (portão final:
_"produção está servindo ESTE build, e a home responde 200"_). ~~Ainda não commitado nem em
produção.~~ 🔴 **O processador saiu exigindo login** e ficou fora do ar até a correção do
[Item 41](#-item-41--corrigido-em-23092026-o-processador-do-mercado-pago-exigia-login-em-produção).

### O que existe

| peça                                       | onde                                                                                | o que faz                                                                                                                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| rota nova `POST /api/webhooks/mercadopago` | `app/api/webhooks/mercadopago/route.ts:38`                                          | limita (`:39`), confere a assinatura com o `data.id` **da URL** (`:63`), ignora corpo divergente, enfileira (`:86`), responde, e processa em `after()` (`:96`) |
| rota nova `GET /api/mercadopago/processar` | `app/api/mercadopago/processar/route.ts:38`                                         | limite de 10/min (`:36`), 503 sem `CRON_SECRET`, 401 com o errado (`:62`), conciliação + lote de 25                                                            |
| assinatura                                 | `lib/mercadopago/assinatura-webhook.ts:84`                                          | HMAC-SHA256 de `id:…;request-id:…;ts:…;`, `timingSafeEqual` (`:108`), recusa tudo sem segredo                                                                  |
| fila e processamento                       | `lib/mercadopago/notificacoes.ts`                                                   | enfileirar **reenfileira** (`:74`), reserva atômica `FOR UPDATE SKIP LOCKED` (`:123`), relê a API e confere id/referência/valor (`:259`)                       |
| variável nova `MERCADOPAGO_WEBHOOK_SECRET` | `lib/env.ts:151`, `deploy.yml:313`                                                  | a assinatura secreta do painel de Webhooks, que **não é** o `client_secret`                                                                                    |
| passo novo no cron                         | `.github/workflows/filas.yml:80`                                                    | chama o processador a cada 5 min, com `if: always()`                                                                                                           |
| ajustes                                    | `lib/mercadopago/conta.ts:166`, `lib/agendamento/confirmar-consulta-paga.ts:50,102` | `userId: null` quando não há ator; `ignorarPrazo` só para o webhook com pagamento aprovado                                                                     |

### Provas

- **guarda novo** `o-webhook-do-mercado-pago-nao-e-forjavel`: 36 casos, 14 sabotagens
- **guardas estendidos:** `as-rotas-sensiveis-tem-limite` (19 casos, com as duas rotas) e
  `o-segredo-cadastrado-chega-ao-servidor` (33 casos, com as duas pastas de rota). O de limite
  achou que o `processar` não tinha limite, e ele ganhou um
- **integração** `__tests__/integracao/o-webhook-do-mercado-pago-confirma-o-que-a-api-diz.test.ts`:
  13 casos contra Postgres real, 12 sabotagens. Duas notificações do mesmo pagamento, reenvio
  idêntico, assinatura forjada (3 variantes + manifesto sem id), corpo adulterado, divergência
  de valor/referência, conciliação. Uma sabotagem achou um caso descoberto: corpo **sem**
  `data.id` + assinatura de manifesto sem id
- `pnpm test` 1478/1478 · integração 72/72 · `tsc` 0 · baseline verde

### O que ficou

- 🔴 **antes do deploy:** cadastrar o secret `MERCADOPAGO_WEBHOOK_SECRET` e a URL do webhook no
  painel do MP. Sem o secret, o webhook recusa tudo e só a conciliação confirma (até 5 min)
- a janela da conciliação é de 2 min a 24 h: PIX pago depois de 24 h só se confirma por
  notificação
- o limite do `processar` é por processo (Item 31)
- as rotas `processar` do ChatPro e dos parceiros continuam **sem** limite (fora do escopo)
- a Fase 4 (job de expiração respeitar `pix_valido_ate` e `em_processamento`) depende do Item 40

---

## ⏳ Item 38 — PENDENTE, 22/09/2026: ligar o bloqueio de agendamento do Mercado Pago

**Status:** o código está pronto e **desligado**. Ligar é trocar um secret — e ligar cedo
derruba o agendamento da plataforma inteira.

### O que já existe

`reservarConsulta` (`app/(public)/_actions/agendamento.ts`) recusa a reserva quando o médico
não tem conta do Mercado Pago conectada.

✅ **Acrescentado na Fase 5 (28/09/2026, Item 48):** com o interruptor ligado, o médico sem conta
passa a ser recusado **antes**, na escolha do médico (card desabilitado, `agendavel` de
`podeAgendarCom`) — o paciente não escolhe data e horário para ouvir "não" depois. E, com o
interruptor desligado, a tela de pagamento não oferece o Brick a médico sem conta. A checagem usa `podeAgendarCom`
(`lib/mercadopago/conta.ts`), que **não decifra nada** — só confere que existe linha sem
`desconectadoEm`.

### 🔴 Por que está desligado

A tabela `medicos_mercadopago_conta` está **vazia** (medido em produção em 22/09/2026, logo
depois da migration `0046`). Com o bloqueio ativo e a tabela vazia, **nenhum paciente consegue
agendar com nenhum médico** — não é degradação parcial, é a agenda inteira parada no mesmo
segundo.

O interruptor é `MERCADOPAGO_BLOQUEIO_AGENDAMENTO_ATIVO`, e o padrão é `inativo`.

### O passo manual ANTES de ligar — nenhum código confere isto

| #   | o quê                                                      | como conferir                                                                                                                                                                                     |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | o `redirect_uri` está cadastrado no painel do Mercado Pago | `https://be4hope.org/api/medico/mercadopago/callback`, idêntico. A doc do MP exige URL estática                                                                                                   |
| 2   | **todo médico ativo já conectou a conta**                  | `select count(*) from medicos m where not exists (select 1 from medicos_mercadopago_conta c where c.medico_id = m.id and c.desconectado_em is null and c.deleted_at is null)` — precisa dar **0** |
| 3   | o log de produção parou de acusar médico sem conta         | `grep 'sem conta conectada no agendamento' error.log` na VPS                                                                                                                                      |
| 4   | só então                                                   | `gh secret set MERCADOPAGO_BLOQUEIO_AGENDAMENTO_ATIVO` com o valor `ativo`, e redeploy                                                                                                            |

⚠️ **O passo 3 é o que torna isto mensurável em vez de adivinhado.** Com a flag desligada, o
agendamento registra `console.warn` a cada reserva de médico sem conta — sem bloquear ninguém.
É por ali que se sabe quantos faltam, em vez de descobrir pelo paciente.

### O que NÃO fazer

⛔ **Não ligar a flag junto do merge.** Merge e ativação são dois eventos, e é o interruptor
que permite separá-los — foi para isso que ele existe.

⛔ **Não "resolver" removendo a checagem.** Sem ela, a reserva nasce com um pagamento que
ninguém consegue cobrar, e o paciente descobre na etapa de pagamento com o horário já
bloqueado.

### Desligar de volta

Apagar o secret (ou trocar para `inativo`) e redeployar. **Não exige reverter código** — é a
mesma propriedade de `PARCEIRO_TRANSFERENCIA_ATIVA`, e é de propósito.

### Relacionado

- `docs/adr/ADR-0024` — a cifra dos tokens, e §7 sobre perder a chave
- `lib/env.ts` — `MERCADOPAGO_BLOQUEIO_AGENDAMENTO_ATIVO`, com o mesmo aviso
- `.github/workflows/deploy.yml` — a linha `gravar` e o comentário

---

## ✅ Item 37 — RESOLVIDO em 12/09/2026: seis defeitos que quebravam o fluxo da Greens de ponta a ponta

**Achados pelo dono testando em produção**, mais três que apareceram ao medir os 4 fluxos
contra o código. Nenhum tinha erro visível: todos falhavam em silêncio ou com mensagem que
apontava para o lugar errado.

### 1. 🔴 O Firefox não conseguia se cadastrar

`captcha_missing_token` (400) depois de o Turnstile receber `401` do Cloudflare. **Causa:** o
Total Cookie Protection do Firefox particiona o armazenamento de um iframe de terceiro, e o
widget sem armazenamento não emite token.

⚠️ **A cura é a instância de produção do Clerk, e a doc deles prova:** em desenvolvimento o
FAPI fica em `accounts.dev`, que é **cross-site** com `be4hope.org`; em produção fica num
**subdomínio** (`clerk.be4hope.org`) via CNAME, e aí o cookie é primeira-parte. Fica no
[Item 36](#) — os dois trabalhos são um só.

### 2. 🔴 O cadastro virava falha DEPOIS de gravar tudo

Protocolo SOL-000046. Conta criada, sessão ativa, ficha gravada, link de uso único consumido —
e a tela dizendo _"Não conseguimos concluir seu cadastro"_. Sem volta possível, porque o token
é de uso único (ADR-0016 D-04) e a ADR não previu a gravação falhar depois dele.

**E o log não ajudava:** `app/_actions/cadastro-por-link.ts` registrava só `erro.name`, que num
`new Error(…)` é sempre a string `'Error'`. Produção escreveu, literalmente,
`{ erro: 'Error' }`.

**Corrigido:** `cadastroGravado` vira `true` quando a transação commita, e o catch devolve `ok`
a partir daí. O log ganhou `etapa` (rótulo nosso, nunca entrada do usuário) e `em:` com a
primeira linha do **stack** — nunca `erro.message`, que cita o valor que violou a restrição, e
as colunas aqui são CPF e telefone.

### 3. 🔴 Os DOIS destinos pós-cadastro levavam a 404

```
DESTINOS.agendamento  = '/agendamento'            → o disco só tem /paciente/agendamento
DESTINOS.teleconsulta = '/paciente/teleconsulta'  → só existe /paciente/teleconsulta/[roomId]
```

Entre os dois, **quase todo paciente da Greens**: `agendamento` é o passo 4 do fluxo 2 e o
passo 3 do fluxo 4; `teleconsulta` é o paciente sem pendência, a recompra do fluxo 3.

⚠️ **E o guarda existente CONGELAVA o defeito.** `o-destino-do-paciente-segue-o-que-falta`
comparava os destinos com uma **lista fixa que continha os dois 404** — ficava verde enquanto o
paciente caía em 404, e ficou vermelho quando o defeito foi corrigido. Causa de classe: lista
paralela. Retificado, e o caso anterior fica escrito no arquivo.

### 4. 🔴 A tela da ANVISA pedia documento que o parceiro já mandou

`app/(paciente)/_actions/anvisa.ts` criava o checklist com `enviado: false` **fixo** e nunca
consultava a tabela `documentos`. A tela anterior tinha prometido o contrário: _"Os documentos
que você já enviou vêm junto"_.

**Causa de fundo: três vocabulários para o mesmo documento.** `documento_identidade` (fluxo),
`rg` (enum da coluna) e `rg_paciente` (inventado no checklist, e que **não existe** no enum).
Nenhum erro em runtime — a coluna é JSON e aceita qualquer string.

### 5. 🔴 O login não voltava ao cadastro — e podia levar para fora

O botão _"Entrar na minha conta"_ apontava para `/entrar` sem `redirect_url`; o efeito de sessão
viva fazia `router.replace('/redirect')` fixo. O paciente da recompra ia parar no painel, com o
token perdido.

⚠️ **E corrigir isso abriu um terceiro, que já existia:** `redirect_url` vem da URL, logo é
entrada do usuário — `?redirect_url=https://site-falso.com` leva o paciente para fora **depois**
de ele digitar a senha (OWASP A01). `lib/auth/destino-interno.ts` filtra por **origem**, nunca
por prefixo.

### 6. 🔴 Uma aba aberta durante o deploy quebrava

`Failed to find Server Action "008065c0…"` — os ids são hashes gerados no build. A tela mandava
_"tentar novamente"_, e tentar não resolve: só recarregar. Corrigido com `deploymentId` =
`github.sha`, **nas duas pontas** (build e runtime).

### E duas telas órfãs foram ligadas

- **`/paciente/privacidade`** entrou no menu. Existia desde 11/09 e nenhuma navegação levava a
  ela. A LGPD art. 8º §5º exige que revogar seja _"por procedimento gratuito e FACILITADO"_.
- **O perfil** passou a mostrar o checklist de documentos por tipo, em vez de só _"nenhum
  documento enviado ainda"_.

### O que ficou de fora, e por quê

| item                                       | por quê                                                                                                                                                                 |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/acesso` continua órfã                    | é a P4 do fluxo 3, e o `/cadastro/[token]` já detecta conta existente **dinamicamente**, o que é melhor que dois botões cegos. Ligar ou aposentar é **decisão do dono** |
| consentimento pós-fluxo (fluxo 4, passo 5) | o consentimento é colhido no cadastro. Pedir de novo depois da ANVISA é desenho de produto, não correção                                                                |
| `laudo_medico` sem tipo no enum            | exige migration, e migration não entra de passagem                                                                                                                      |
| notificação de ANVISA **rejeitada**        | só `aprovado` notifica hoje; rejeitado tem só Pusher efêmero                                                                                                            |
| WhatsApp na aprovação                      | Item 29 — sem doc do endpoint                                                                                                                                           |

**Guardas novos:** `o-cadastro-feito-nao-vira-falha` (10), `o-painel-diz-o-que-falta` (10),
`todo-destino-e-uma-rota-que-existe` (8), `a-anvisa-aproveita-o-que-ja-chegou` (8),
`o-login-nao-leva-para-fora` (18), `a-aba-aberta-sobrevive-ao-deploy` (8),
`o-csp-conhece-o-captcha-do-clerk` (7). Medido: **1104 casos em 42 guardas**.

---

## 🔴 Item 36 — CATALOGADO em 11/09/2026: produção autentica por uma instância de DESENVOLVIMENTO do Clerk

> ⚠️ **REMEDIÇÃO, 22/09/2026 — continua valendo, e agora com o efeito isolado.**
>
> O `.env` de produção tem **`pk_test_` / `sk_test_`**, e **zero** ocorrência de `live`. O código
> de verificação sai de `notifications@accounts.dev` com **`[Development]`** no assunto.
>
> 🔴 **Os logs do Clerk mostram que TODOS os códigos foram enviados** — o defeito não é de envio,
> é de **entrega**: o domínio `accounts.dev` é compartilhado, e a reputação dele não é nossa.
>
> **O que isso simplifica:** os usuários dessa instância são **todos de teste**; não há paciente
> real. Migrar para instância de produção com domínio próprio **não exige migração de conta** —
> é configuração, não mudança de dado.

**Achado pela Greens**, testando o handoff em produção. Ao clicar em "Criar conta e continuar",
a tela diz _"Não conseguimos concluir agora"_ e o devtools mostra:

```
POST https://relative-blowfish-96.clerk.accounts.dev/v1/client/sign_ups?…   → 400
GET  https://challenges.cloudflare.com/cdn-cgi/challenge-platform/…         → 401
```

### O diagnóstico, medido — não inferido

Eles suspeitaram pelo `pk_test` do `.env.example`. **Perguntei à própria instância**
(`GET /v1/environment`), e ela responde por escrito:

| campo                                      | valor             |
| ------------------------------------------ | ----------------- |
| `display_config.instance_environment_type` | **`development`** |
| `user_settings.sign_up.captcha_enabled`    | `true`            |
| `display_config.captcha_provider`          | `turnstile`       |
| `display_config.captcha_widget_type`       | `smart`           |

E reproduzi o `400` fora do navegador, contra a mesma instância. São **dois** códigos, na ordem
em que o navegador os encontra:

| #   | `errors[].code`                     | quando                                                                      |
| --- | ----------------------------------- | --------------------------------------------------------------------------- |
| 1   | `dev_browser_unauthenticated` (401) | sem o cookie do dev browser — **só existe em instância de desenvolvimento** |
| 2   | `captcha_missing_token` (400)       | com o dev browser resolvido, que é o caso do paciente                       |

🔴 **`captcha_missing_token` fecha o circuito com o `401` que a Greens viu.** O
`GET challenges.cloudflare.com → 401` é o widget do Turnstile falhando; widget que falha não
produz token; sem token, o `sign_ups` devolve 400 com esse código. As duas linhas do devtools
são o mesmo evento, em dois atos.

⚠️ **O limite da medição, dito por escrito:** um `curl` nunca resolve um Turnstile, então o
`captcha_missing_token` do meu teste é esperado _por construção_. O que ele prova é que **a bot
protection está ligada e é obrigatória no cadastro**. O `401` da Greens é que prova o resto.

### O que NÃO é a causa — conferido antes de acusar

- **O `<div id="clerk-captcha" />` existe nos dois fluxos:**
  `app/(auth)/registrar-se/[[...sign-up]]/page.tsx:582` e
  `app/(auth)/cadastro/[token]/_components/formulario-de-cadastro.tsx:1130`.
  A doc do Clerk diz que, sem ele, o SDK _"transparently fall back to an invisible widget"_ —
  que bloqueia sem dar ao usuário chance de provar que é humano. Não é o nosso caso.
- **O CSP não bloqueia nada:** `next.config.ts:105` emite
  `Content-Security-Policy-Report-Only`, não `Content-Security-Policy`. Que
  `challenges.cloudflare.com` não esteja listado gera ruído no console e nada mais.
  🔴 Retrato minha leitura anterior — eu disse "o CSP já permite os domínios do Clerk", o que
  estava certo pelo motivo errado. Ele não permite nem proíbe; **observa**.

### 🔴 `clerk.be4hope.org` está no CSP e NÃO EXISTE

```
$ getent hosts clerk.be4hope.org
  (nada — não resolve)
```

O domínio entrou em `next.config.ts:108,112` como preparação para a instância de produção, e
**ela nunca foi criada**. Produção autentica hoje por uma instância de desenvolvimento, com bot
protection de desenvolvimento, num domínio real e com tráfego real.

### O perigo de mexer, medido

| eixo                                 | medição                                                                                                                                                                                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| está em produção?                    | **sim** — é o login e o cadastro de todo mundo                                                                                                                                                                                                       |
| quantos pontos de chamada            | a chave pública é substituída **no build** (`deploy.yml:73`); o guarda `next-public-existe-no-build` cobre a ausência, não a troca                                                                                                                   |
| existe teste que prove antes/depois? | **não**, e não pode haver: instância do Clerk é infraestrutura externa                                                                                                                                                                               |
| o que quebra em quem consome hoje    | 🔴 **risco aberto: não medi se a base de usuários atravessa de uma instância para a outra.** A doc de deploy do Clerk é silenciosa sobre migração de usuários — fala de SSO, integrações e paths que _não_ são copiados, e não diz nada sobre contas |
| custo de fazer                       | domínio próprio + registros DNS + certificados. A doc do Clerk: _"It can take up to 48hrs for DNS records to fully propagate"_                                                                                                                       |
| custo de deixar                      | cadastro falhando de forma intermitente em produção, sem mensagem que ajude o paciente                                                                                                                                                               |

### O que falta decidir — e é do dono, não meu

1. **Criar a instância de produção do Clerk?** É decisão de negócio (custo do plano, janela de
   DNS, e o risco da base de usuários).
2. **Antes disso: medir se os usuários existentes sobrevivem à troca.** Enquanto não estiver
   medido, isto é risco aberto — não detalhe de configuração.

**Fonte:** doc de erros do Clerk (`dev_browser_unauthenticated`, 401, _"Unable to authenticate
this browser for your development instance"_) e o guia de bot protection em fluxo customizado.
Registrado no §12 do `CONTRATO-S2-BEHEMP-PARA-GREENS.md`, que era a resposta que eles pediram.

---

## ✅ Item 35 — RESOLVIDO em 11/09/2026: a confirmação do e-mail tinha dois becos

**Achado pelo dono testando em produção**, horas antes da apresentação: _"a validação do código
de e-mail não está funcionando… o código chega mas não é válido"_.

**O sintoma era um; as causas, duas** — e nenhuma no código de verificação.

### 1. "Reenviar código" não dava retorno nenhum

`formulario-de-cadastro.tsx`, `reenviarCodigo()`: chamava
`prepareEmailAddressVerification` e **não mudava nada na tela**. Quem clica e não vê resposta
clica de novo — e **cada reenvio invalida o código anterior** (comportamento do Clerk). O
paciente então digita o código do primeiro e-mail e recebe _"código incorreto"_.

A mensagem aponta para o lugar errado: o código estava certo, só era de um e-mail que deixou
de valer.

**Corrigido:** o reenvio **limpa o campo** (o que estava digitado é o código morto), mostra
_"Enviamos um código novo. O anterior deixou de valer"_, desabilita o botão enquanto envia e
recusa reentrada.

### 2. "Corrigir meus dados" virava saída

O botão volta para a etapa de dados — e enviar de novo chamava `signUp.create` com um cadastro
**já pendente**. O Clerk responde `form_identifier_exists`, e a tela dizia **"Já existe uma
conta com este e-mail. Use a opção de entrar."** para alguém que estava no meio do próprio
cadastro e **não tem conta**. O caminho de correção mandava a pessoa embora.

**Corrigido:** quando o cadastro pendente é do mesmo e-mail, a tela **reenvia o código e
segue** em vez de recriar. A mensagem de "já existe conta" continua — ela é verdadeira para
quem realmente tem.

🔴 **O que as duas têm em comum:** a tela responsabilizava o paciente por um estado que ela
própria criou. É a classe de erro que mais custa num funil, porque a pessoa acredita que errou
e desiste.

## 🔴 Item 34 — o aviso `consentimento_revogado` depende do lado da Greens, não só do nosso

**Prometido à Greens em 10/09** (proposta deles, aceita por mim) e **não implementado**. O
diagnóstico mudou em 11/09/2026, depois de eu ler o código deles.

### 🔴 RETRATAÇÃO — a primeira versão deste item errou duas coisas

Eu escrevi que o obstáculo era **só o nosso índice** e que um evento recusado ficaria **"em
retry para sempre"**. As duas estão erradas, e a medição está no código:

| eu escrevi                         | o que o código mostra                                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| o obstáculo é o nosso índice único | **o validator deles rejeita o tipo antes disso**                                                           |
| um 400 ficaria em retry eterno     | `lib/parceiros/enviador.ts:40` — `VALE_TENTAR_DE_NOVO` não inclui 400; o evento vira **falhado**, não loop |

**O bloqueio real**, medido em
`greens-corp-backend/src/modules/parceiros/behemp/behempValidator.ts`:

```ts
tipo: z.enum(["receita_emitida", "anvisa_aprovada"]),
```

Um `consentimento_revogado` é recusado com **400** na porta deles. Implementar do nosso lado
antes que eles aceitem o tipo é construir contra um contrato que não existe — e o resultado
seria um evento falhado por paciente que revoga, sem ninguém do outro lado sabendo.

### O que o nosso lado ainda precisa, quando o deles aceitar

1. `consentimento_revogado` no enum `parceiro_evento_tipo` (migration de enum).
2. **Um caminho que permita mais de um aviso por solicitação.** O índice
   `uniqueIndex(parceiro, tipo, solicitacaoId)` faz um por solicitação, para sempre — e quem
   revoga, reconsente e revoga de novo geraria **um**. O segundo seria engolido pelo
   `onConflictDoNothing`, que existe de propósito para `receita_emitida`.

   **Recomendação: tabela própria**, com o seu próprio índice. Não toca na idempotência de
   `receita_emitida`, que decide **gateway e desconto** do lado deles — e essa é exatamente a
   peça que não se mexe por causa de outra.

### ⚠️ O que vale ENQUANTO isso não existe

Revogar impede envios **futuros** — a P5 lê o consentimento vigente a cada envio, e há guarda
provando. O que já foi enviado continua com quem recebeu. A tela `/paciente/privacidade` diz
isso ao paciente, em vez de prometer o que o sistema não cumpre.

**Bloqueado por:** a Greens aceitar o tipo no `atualizacaoBehempValidator`. Está no prompt que
vai para eles.

## ✅ Item 33 — RESOLVIDO em 11/09/2026: a declaração virou coluna

**Achado em 11/09/2026, ao plugar a P2.** `app/_actions/cadastro-por-link.ts:298-299` grava
`declarouTerAutorizacaoAnvisa` e `declarouTerReceitaMedica` **apenas dentro de
`registrarAuditoria`**. Não existe coluna para nenhuma das duas — nem em
`solicitacoes_cadastro`, nem em `pacientes`. Log de auditoria não é fonte de leitura de
produto.

**O que isso custou:** o comentário de `components/paciente/AvisoDaProcuracao.tsx` afirmava que
o cadastro gravava a declaração. Afirmação falsa, que sobreviveu porque **o componente não era
renderizado por tela nenhuma** — ninguém a exercitou. Retratado no próprio arquivo em 11/09.

**Como ficou funcionando sem isso:** o aviso passou a sair do **estado real** —
`autorizacoes_anvisa` sem linha `aprovado` dentro da validade. É informação melhor: descreve o
que existe, em vez do que o paciente lembrou de responder.

**O que ainda se perde sem a coluna:** não conseguimos deixar de repetir a pergunta em outras
telas, que era o propósito original da declaração. E o fluxo BeHemp 1 continua sem saber
distinguir _"declarou que não tem"_ de _"nunca respondeu"_.

**Corrigido em 11/09/2026**, com autorização escrita em `.claude/autorizacoes.txt`. Migration
`0035_huge_sugar_man.sql`: dois `ADD COLUMN … boolean` nullable — o Postgres 11+ faz isso sem
reescrever a tabela.

**E ao corrigir apareceu um segundo defeito, de acoplamento:** uma flag só
(`jaDeclarouSobreAnvisa`) decidia **as duas** perguntas. Quem vinha do formulário da Greens não
era perguntado sobre **receita** — e lá ninguém pergunta sobre receita. O destino saía errado
por isso, e era invisível porque a flag tinha nome de ANVISA. Agora cada pergunta olha a
própria declaração.

**Três estados, e o terceiro é o motivo de a coluna existir:** `true` = tem · `false` =
declarou que **não** tem · `null` = **nunca respondeu**. A tela usa `!== null`, não
`=== true` — quem respondeu "não tenho" também já respondeu, e repetir a pergunta a ele é o
mesmo defeito que o dono apontou em 10/09.

⚠️ **E o aviso da procuração continua NÃO usando a declaração.** Ela diz o que o paciente
respondeu; quem decide se falta a autorização é `autorizacoes_anvisa` — o que **existe**, não o
que ele lembrou. Trocar uma pela outra faria o aviso sumir para quem declarou ter e nunca
enviou. Há caso de guarda exatamente para isso.

## 🔴 Item 32 — CONCLUÍDO em 11/09/2026: a tela do consentimento

**O diagnóstico, que só apareceu ao ligar a P5:** `lib/parceiros/transferencia-de-cadastro.ts`
recebia `finalidadesConsentidas: Finalidade[]` por parâmetro. A regra estava certa e o dado
que ela julgava vinha de quem chama — um consentimento **alegado**, não lido.

**Onde ficou:**

| peça                                                           | o quê                                              |
| -------------------------------------------------------------- | -------------------------------------------------- |
| `db/schema/consentimentos.ts` + `db/migrations/0034_*.sql`     | uma linha por finalidade; aditiva, sem `DROP`      |
| `lib/parceiros/consentimento-registrado.ts`                    | ler / conceder / revogar — sem auth, sem `next/*`  |
| `app/(paciente)/_actions/consentimento.ts`                     | paciente vem da **sessão**, nunca do formulário    |
| `components/paciente/ConsentimentoDoCompartilhamento.tsx`      | o texto integral, as 3 caixas, o efeito de recusar |
| `app/(paciente)/paciente/privacidade/`                         | ver e **revogar** (art. 8º §5º)                    |
| `app/(auth)/cadastro/[token]/…/formulario-de-cadastro.tsx:+18` | o bloco no cadastro por link                       |
| `app/_actions/cadastro-por-link.ts:+40`                        | grava pelo mesmo caminho, sem `insert` próprio     |

**O que ficou de fora, e por quê:**

- 🟠 **O consentimento não aparece no formulário completo (P3)** — só no cadastro por link e no
  painel. Quem chega pela P3 ainda não tem onde consentir na própria tela; ele consegue pelo
  `/paciente/privacidade` depois. **Fica como pendência.**
- 🟠 **Revogar não avisa a Greens.** O S1 `consentimento_revogado` foi aceito em conversa com o
  lado deles e **ainda não foi implementado** — hoje a revogação impede envios **futuros**, e
  o que já foi continua lá. A tela diz isso ao paciente, em vez de prometer o que não cumpre.

## Item 1 — 🔴 A migration estreia contra a produção, sem ensaio

Achado ao ler o pipeline para dimensionar o custo de ~10 tabelas novas. Não veio de
relato: veio da leitura do workflow.

### O diagnóstico

O único workflow do repositório é o de deploy, e ele aplica migration por SSH no
servidor de produção:

```yaml
# .github/workflows/deploy.yml:74
# Aplica eventuais migrações do banco
pnpm db:migrate
```

A ordem é `rsync` → `pnpm install --prod` → `cp .env` → **`db:migrate`** →
`cp` estáticos → `pm2 restart`. A ordem em si está certa (migration antes do
restart), mas:

- não existe ensaio em banco descartável antes
- não existe `--dry-run`, nem rollback
- roda numa t2.small de 2 GB (DT-006), com swap **não persistido no `/etc/fstab`**

E há uma armadilha específica de PostgreSQL que este fluxo aciona:

```
ALTER TYPE "user_role" ADD VALUE 'gerente';
```

O valor novo de um enum **não pode ser usado na mesma transaction em que foi
criado**. Se o `drizzle-kit migrate` embrulhar tudo numa transaction e a mesma
migration já referenciar `'gerente'` (numa `DEFAULT`, num `CHECK` ou numa tabela
nova), ela falha — em produção, no meio do deploy.

### Como corrigir

1. Ensaiar toda migration deste domínio em banco descartável (branch do Neon ou
   Postgres local) e anexar o resultado ao item.
2. **Separar em duas migrations:** uma só com os `ADD VALUE`, outra que os usa.
3. Confirmar se o swap está no `/etc/fstab` antes de qualquer deploy que traga
   migration (DT-006 diz que **não está**).

⚠️ **O que NÃO fazer:** tirar `db:migrate` do deploy. Sem ele a migration passa a
depender de alguém lembrar — e migration esquecida com código novo no ar é pior que
migration arriscada.

### O guarda

Nenhum. Este é risco de processo, não de código — a mitigação é o ensaio
(ver `docs/03-CHECKLIST-MESTRE.md`), não um teste.

---

---

## Item 2 — 🔴 O tipo do role está escrito à mão em 8 lugares, e um deles é cast

Achado ao dimensionar o custo de acrescentar 4 papéis ao `userRoleEnum`.

### O diagnóstico

O enum tem 3 valores:

```ts
// db/schema/enums.ts:9
export const userRoleEnum = pgEnum('user_role', ['admin', 'medico', 'paciente']);
```

E oito lugares repetem a união **sem derivar dela**:

```
lib/auth/permissions.ts:16          export type Role = 'admin' | 'medico' | 'paciente'
types/globals.d.ts:11               role?: 'admin' | 'medico' | 'paciente'
app/(auth)/redirect/page.tsx:111    as 'admin' | 'medico' | 'paciente'
app/(admin)/_actions/usuarios.ts:66     params.role as 'admin' | 'medico' | 'paciente'
app/(admin)/_actions/usuarios.ts:216    novaRole: 'admin' | 'medico' | 'paciente'
app/api/webhooks/clerk/route.ts:196     role as 'admin' | 'medico' | 'paciente'
db/sync-clerk.ts:36                 public_metadata: { role?: ... }
scripts/fix-user-role.ts:21         as ... | undefined
```

O mais perigoso:

```ts
// app/(admin)/_actions/usuarios.ts:66
condicoes.push(eq(users.role, params.role as 'admin' | 'medico' | 'paciente'));
```

É **cast**, não validação. `params.role` chega de fora como `string`. Depois do
`ALTER TYPE`, um filtro por `'gerente'` compila, roda, e o tipo declara que aquele
valor não existe — divergência que compila e não acusa.

### Como corrigir

```ts
// lib/auth/permissions.ts
export type Role = (typeof userRoleEnum.enumValues)[number];
```

Os outros sete importam esse tipo. Em `usuarios.ts:66`, trocar o cast por validação
Zod contra `userRoleEnum.enumValues`.

⚠️ **O que NÃO fazer:** acrescentar os 4 literais novos nas 8 uniões. Funciona hoje
e envelhece no quinto papel — é listar em vez de derivar.

### O guarda

`roleDerivaDoEnum` — quebra o build se aparecer união literal de role escrita à mão
em qualquer `.ts`/`.tsx`. Derivado de `userRoleEnum.enumValues`.

- **teste de vacuidade:** precisa provar que enxerga ≥7 valores após o `ALTER TYPE`
- **sabotagem:** reintroduzir a união em **um** dos oito arquivos, não em todos. A
  sabotagem parcial é a que encontra buraco de granularidade

---

---

## Item 3 — 🟠 O CI não tem portão: lint, type-check e teste não rodam antes do deploy

### O diagnóstico

```yaml
# .github/workflows/deploy.yml:3-6
on:
  push:
    branches:
      - main
```

Um job único, `build-and-deploy`. Os passos são install → build → rsync → PM2. Não
há `pnpm lint`, não há type-check isolado, não há teste — porque não existe teste:
`find` por `*.test.ts*`/`*.spec.ts` devolve **0 arquivos** e o `package.json` não
tem runner.

Consequência: o único portão real é o `pnpm build` falhar. Erro de lint, `any` novo
e regressão de comportamento passam.

### Como corrigir

Job `verificar` (type-check + `pnpm test` + lint comparado à baseline) e
`needs: verificar` no job de deploy.

⚠️ **O que NÃO fazer:** rodar `pnpm lint` como portão absoluto. Com 117 erros de
baseline, o portão fica vermelho no dia 1 e desligado no dia 2. E **não** rodar
`pnpm format` global para zerar — reescreve 233 arquivos fora de escopo, o que o
`AGENTS.md` proíbe sem pedido explícito.

⚠️ E sem `needs`, os jobs rodam em paralelo e o deploy sai com guarda vermelho —
que é o mesmo que não ter guarda.

### O guarda

O próprio job. Precisa ser provado vermelho: abrir PR com guarda sabotado e conferir
que o deploy **não** roda.

---

---

## Item 4 — 🔴 `prescricoes.medicamentos` é JSONB de texto livre: nenhuma soma por medicamento é confiável

Achado em 19/08/2026, ao dimensionar um relatório que precisava somar quantidade por
medicamento. O relatório em si era de outro projeto e saiu de escopo, **mas o defeito é deste
repositório** e afeta qualquer agregação por medicamento aqui.

### O diagnóstico

Os medicamentos de uma prescrição são **texto livre dentro de um JSONB**, sem referência ao
catálogo:

```ts
// db/schema/prescricoes.ts:37
medicamentos: jsonb('medicamentos').notNull().default([]),

// db/schema/prescricoes.ts:25 — comentário do próprio arquivo
// medicamentos: array de { nome, dose?, forma?, posologia?, quantidade? }
```

Três consequências, todas no mesmo campo:

1. `nome` é texto livre e não tem FK para `medicamentos` → _"Canabidiol 200mg"_,
   _"CBD 200 mg"_ e _"cbd 200mg"_ somam como **três** medicamentos distintos.
2. `quantidade` é **opcional** e sem unidade → 2 frascos, 30 ml e 900 gotas cabem no mesmo
   campo, e somar produz número sem significado.
3. Nada liga ao catálogo, que **já tem** marca, concentração, espectro e preço
   (`db/schema/medicamentos.ts`) — justamente o que o Head vai querer cruzar.

### Como corrigir

Tabela **aditiva** de itens de prescrição, com FK para `medicamentos`, quantidade **e unidade**.
Nada em `prescricoes` é alterado.

⚠️ **O que NÃO fazer:** agregar por nome sobre o JSONB com `LOWER(TRIM())`. Resolve dois casos,
falha no terceiro **em silêncio**, e o número resultante parece certo.

⚠️ **E também não:** alterar `prescricoes`. É tabela clínica em produção que alimenta PDF
assinado e SNCR. Normalizá-la é o desenho certo e é **trabalho próprio, com autorização
própria**.

### O guarda

Só **depois** da correção. Guarda que acusa violação conhecida no dia 1 é guarda que alguém
desliga.

---

## Item 6 — 🔴 Todo documento clínico está em store público do Vercel Blob, e a doc afirma o contrário

> 🔴 **ACRÉSCIMO, 22/09/2026 — a procuração assinada é um caso vivo deste item, e NÃO foi corrigida.**
>
> `app/api/webhooks/docusign/route.ts:114` grava o PDF assinado com **`access: 'public'`**, e o
> botão **"Baixar"** da tela usa a coluna direto:
> `app/(paciente)/paciente/documentos/page.tsx:276` → `handleDownload(doc.urlBlob, …)`.
>
> **O que está exposto:** uma procuração com nome e dados do paciente, **legível por quem tiver a
> URL, sem login, sem escopo e sem auditoria**. Medido em 22/09: há **25** procurações concluídas
> com PDF e **5** linhas em `documentos` do tipo `procuracao_especifica`.
>
> ⚠️ **O botão "Ver" ao lado é seguro** (`page.tsx:268` → `<VisualizadorDeDocumento>` →
> `GET /api/documentos/{id}/arquivo`, autenticada, com escopo de objeto, auditoria e 404
> universal). Os dois botões vivem na mesma linha da tela: um passa pela porta, o outro não.
>
> **Pendência, não bug resolvido.** Nada foi mudado em 22/09.

> 🔴 **RETIFICAÇÃO, 13/09/2026 — o Item 6 tinha um segundo andar, e ele era pior.**
>
> Os seis caminhos de documento **já pediam** `access: 'private'` desde 10/09, com comentário
> explicando por quê. Nenhum funcionava: acesso é propriedade do **STORE**, escolhida na criação
> e imutável, e o store que os tokens resolviam era público. O SDK recusava com `Cannot use
private access on a public store` — e **cinco dos seis engoliam o erro** num `catch` que
> logava `erro.name`, sempre `'Error'` para um `new Error`.
>
> **A consequência prática, e ela é diferente da do Item 6:** não havia documento em store
> público. Não havia documento **nenhum**. `anexo-do-cadastro.ts:101` desde 10/09,
> `documentos-do-parceiro.ts` desde 13/09 — o paciente anexava, a tela dizia "pronto", e o
> arquivo não existia em lugar algum. O Item 6 é sobre arquivo legível demais; isto era sobre
> arquivo que não chegou a nascer.
>
> **Corrigido** com `lib/documentos/store-privado.ts` (D-23 da ADR-0022): um terceiro store,
> `BLOB_TOKEN_PRIVADO`, e `access`/`token` deixam de ser parâmetro de quem chama. Falha fechada:
> sem o token, lança — nunca cai para público.
>
> ⚠️ **E `BLOB_BEHEMP_READ_WRITE_TOKEN` não servia**, o que só apareceu ao varrer quem mais a
> usa: `app/api/upload-avatar/route.ts:55` e `app/api/upload-exame/route.ts:78` gravam
> `access: 'public'` com ela. Um token, um store, um acesso.
>
> **O que continua valendo deste Item 6:** os blobs **antigos** seguem no store público, e a
> entrega os serve pelo caminho legado (`app/api/documentos/[id]/arquivo/route.ts`). Migrá-los é
> trabalho próprio.

Achado ao verificar o que significa **guardar** a imagem de uma receita — depois de o dono
decidir que segurança e LGPD são requisito desta implementação.

⚠️ **Decisão do dono em 19/08/2026:** _"o que já tinha sido feito nós deixamos para revisar
futuramente"_. Catalogado com diagnóstico para que a revisão futura não comece do zero.
**É o achado de segurança mais grave registrado neste repositório.**

### O diagnóstico

Todas as chamadas de upload usam store público:

```
app/_actions/documentos-paciente.ts:71          access: 'public'
app/_actions/documentos-paciente-self.ts:128    access: 'public'
app/_actions/documentos.ts:99                   access: 'public'
app/_actions/exames.ts:38                       access: 'public'
app/_actions/chat.ts:628                        access: 'public'
app/api/anvisa/upload-documento/route.ts:69     access: 'public'
app/api/anvisa/procuracao/route.ts:121          access: 'public'
app/(paciente)/_actions/anvisa.ts:315           access: 'public'
app/api/upload-exame/route.ts:77                access: 'public'
app/api/upload-relatorio/route.ts:10            access: 'public'
```

O conteúdo inclui **RG, comprovante de residência, laudo médico, receita médica, exames,
procuração assinada e anexo de chat**. Em store público do Vercel Blob, **quem tem a URL lê o
arquivo sem autenticação** — a proteção é a URL ser difícil de adivinhar, não o acesso ser
verificado. URL que vaza em log, e-mail, print ou dump de banco é acesso permanente.

E há a divergência doc × código:

```ts
// db/schema/prescricoes.ts:23
// urlPdf / urlPdfAssinado: Vercel Blob (URL privada, acesso autenticado).
```

**Não é URL privada.** O comentário descreve a intenção, não o comportamento — e alguém que
leia só a doc vai concluir que o controle existe.

### O perigo de mexer, medido

| fator                        | medida                                                                                                                             |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| pontos de chamada            | **10+**, em `app/_actions`, `app/api` e `(paciente)`                                                                               |
| área                         | clínica, **em produção**                                                                                                           |
| suíte que prove antes/depois | **não existe**                                                                                                                     |
| efeito colateral             | store privado exige **store novo**; as URLs já gravadas no banco apontam para o store antigo → precisa migrar arquivo **e** coluna |
| entrega ao usuário           | passa a exigir Route Handler autenticado ou URL assinada — muda todo consumidor de `urlPdf`/`url`                                  |

### Como corrigir (quando autorizado)

Trabalho próprio, com ADR e autorização próprias. Ordem que reduz dano: (1) store privado
para uploads **novos**; (2) proxy autenticado de entrega; (3) migração dos arquivos antigos com
reescrita de coluna; (4) revogação do store público.

⚠️ **O que NÃO fazer:** trocar `access: 'public'` por `'private'` nos 10 pontos e achar que
terminou. As URLs gravadas continuariam apontando para o store antigo, e a entrega quebraria
em toda tela que hoje usa a URL direto.

### O guarda

Só **depois** da correção — guarda que acusa 10 violações conhecidas no dia 1 é guarda que
alguém desliga. Para código **novo**, a regra já vale: `.claude/rules/seguranca-lgpd.md`.

---

## Item 7 — ⚠️ RETRATADO: eu disse que o schema tem 31 tabelas

Afirmei **31 tabelas** em `db/schema`, e repeti o número em várias docs desta sessão — incluindo
as que foram para outro projeto.

**Estava errado. São 40 tabelas, em 29 arquivos.**

O erro foi de método: contei **arquivos**, não tabelas. Quatro arquivos declaram mais de uma:

```
db/schema/invoices.ts        -> 9 tabelas
db/schema/teleconsultas.ts   -> 2
db/schema/grupos-chat.ts     -> 2
db/schema/ajustes-dosagem.ts -> 2
```

A medição correta é `rg -c 'pgTable\(' db/schema/*.ts`, que soma 40.

Corrigido em `03-CHECKLIST-MESTRE.md`, em `01-REGRA-DE-NEGOCIO.md` e nas duas ADRs que já
tinham saído para o outro projeto.

Fica registrado porque **retratar por escrito ensina mais que acertar** — e porque o padrão do
erro é reaproveitável: _contar o continente em vez do conteúdo_. Vale para tabela em arquivo,
rota em router, e caso de teste em arquivo de teste.

---

## Item 8 — ✅ CORRIGIDO em 20/08/2026 — TURN público de terceiro na teleconsulta, com credencial compartilhada

> ✅ **Corrigido em 20/08/2026.** O dono escolheu **Cloudflare Realtime TURN** entre 4 opções
> comparadas com preço (ver o fim deste item). A credencial pública saiu dos **dois** arquivos;
> a lista de `iceServers` passou a vir de `/api/teleconsulta/ice-servers`, que gera credencial
> **efêmera (2 h)** no servidor e só a entrega a quem participa da sala.
>
> Guarda: `sem-relay-de-terceiro-na-teleconsulta` — **13 casos**, com **4 de controle contra
> falsa acusação**, e **5 sabotagens provadas vermelhas**. Nasceu **verde**, de propósito:
> guarda para violação não corrigida nasce vermelho e fica vermelho.
>
> 🔴 **DUAS PENDÊNCIAS BLOQUEIAM O USO REAL** (também no `03` e na
> [ADR-0008](adr/ADR-0008-turn-contratado-para-a-midia-da-teleconsulta.md) §4):
>
> | #   | pendência                                                                                            | de quem          | sem isso                                                                  |
> | --- | ---------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------- |
> | 1   | **criar a conta** na Cloudflare e provisionar `CLOUDFLARE_TURN_KEY_ID` + `CLOUDFLARE_TURN_API_TOKEN` | **dono / infra** | só STUN; conexão que precise de relay **falha**, com aviso na tela        |
> | 2   | **assinar o DPA** da Cloudflare                                                                      | **Jurídico**     | 🛑 nenhuma consulta real deve passar por lá — seria operador sem contrato |
>
> Onde obter as chaves: painel da Cloudflare → **Realtime** → **TURN**. O token é de servidor e
> **nunca** vai ao cliente — a credencial do navegador é gerada em
> `/api/teleconsulta/ice-servers`, com validade de 2 h.
>
> ⚠️ A pendência 2 **não é formalidade**: a Cloudflare não lê a mídia, mas vê o IP de médico e
> paciente, e IP é dado pessoal. Isso a torna **operadora**.
>
> A degradação para STUN é **regressão deliberada**, registrada em `.claude/autorizacoes.txt`:
> melhor falhar do que atravessar relay de estranho com dado de saúde.

**Onde:** 🔴 **corrigido em 20/08/2026 — são DOIS arquivos, não um:**

| arquivo                                                  | linhas      | lado     |
| -------------------------------------------------------- | ----------- | -------- |
| `components/teleconsulta/GlobalTeleconsultaHost.tsx`     | **194-196** | médico   |
| `app/(paciente)/paciente/teleconsulta/[roomId]/page.tsx` | **156-158** | paciente |

⚠️ E existe uma **terceira** implementação de `RTCPeerConnection`, em
`app/(medico)/medico/teleconsulta/page.tsx:160`, com **só STUN e sem TURN** — provavelmente
código legado, que nenhuma correção do TURN alcançaria.

```
{ urls: 'turn:openrelay.metered.ca:80',  username: 'openrelayproject', credential: 'openrelayproject' }
{ urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' }
{ urls: 'turn:openrelay.metered.ca:443?transport=tcp', ... }
```

**O defeito, em três camadas:**

1. **Dado.** Quando o WebRTC não consegue conexão direta, **toda a mídia da consulta médica**
   — vídeo e áudio de paciente e médico — passa pelo relay. É um **operador de dado pessoal
   sensível sem contrato**, o que a regra de LGPD deste repositório trata como decisão do
   Jurídico.
2. **Disponibilidade.** Serviço gratuito, sem SLA. Quando satura ou sai do ar, a consulta cai —
   e nada no produto explica por quê.
3. **Credencial.** `openrelayproject` é pública e compartilhada com o mundo inteiro.

**Perigo de mexer: BAIXO** — e é a exceção neste repositório.

| pergunta                             | resposta                                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| pontos de chamada                    | **2 arrays** em 2 arquivos (o diagnóstico anterior dizia 1)                                             |
| está em produção?                    | o código está; **o uso clínico não** (`DO-02`: nunca foi usada de verdade)                              |
| existe teste que prove antes/depois? | não — nenhum. É o que a Sprint 1 cria                                                                   |
| o que quebra em quem consome hoje?   | **ninguém consome de verdade**                                                                          |
| ⚠️ e o hook?                         | um dos dois arquivos está em `app/(paciente)/` — **área protegida**. Corrigir exige autorização escrita |

**Correção:** TURN com contrato (serviço gerenciado) ou `coturn` próprio, com credencial
efêmera em variável de ambiente. Guarda que falhe se voltar credencial hardcoded.
**Entra na [Sprint 1](sprints/SPRINT-1-auditoria-da-teleconsulta.md).**

### As opções, com preço — pesquisa de 20/08/2026

**A conta, com as premissas explícitas.** WebRTC de vídeo consome ~1,2 Mbps por direção
(720p típico); uma consulta de 30 min relayada gasta ≈ **0,54 GB** (1,2 Mbps × 1800 s × 2
sentidos). O TURN só entra quando a conexão direta falha.

| provedor                        | preço                                                                                               | fonte                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Cloudflare Realtime TURN**    | **US$ 0,05/GB**, com **1.000 GB/mês grátis**                                                        | [doc oficial](https://developers.cloudflare.com/realtime/turn/faq/) |
| **Twilio NTS — São Paulo**      | US$ 0,80/GB                                                                                         | [pricing oficial](https://www.twilio.com/en-us/stun-turn/pricing)   |
| Twilio NTS — US West / Alemanha | US$ 0,40/GB                                                                                         | idem                                                                |
| **`coturn` próprio na AWS**     | banda de saída **US$ 0,09/GB** (primeiros 10 TB, após 100 GB grátis) **+** instância **+** operação | pesquisa de custo AWS                                               |

🔴 **A conclusão não depende da premissa incerta.** Mesmo no **pior caso** — supondo que
**100 %** das consultas precisem de relay, o que nunca acontece na prática — 1.000
consultas/mês dão **540 GB**, ainda **dentro do free tier de 1.000 GB** da Cloudflare. Ou seja:

| cenário                                   | Cloudflare | Twilio (SP) | coturn AWS (só banda)                 |
| ----------------------------------------- | ---------- | ----------- | ------------------------------------- |
| 1.000 consultas/mês, 100 % relay (540 GB) | **US$ 0**  | US$ 432     | US$ 40 + instância + operação         |
| 100 consultas/mês, 15 % relay (8 GB)      | **US$ 0**  | US$ 6,50    | US$ 0 (dentro dos 100 GB) + instância |

**Recomendação: Cloudflare Realtime TURN.** Três razões, na ordem que importa:

1. **LGPD.** A doc oficial declara que a Cloudflare **não pode acessar o conteúdo da mídia** —
   WebRTC é cifrado com DTLS e ela relaya pacotes cifrados, processando só metadados
   (IP, porta, timing). E existe [DPA com cláusula específica de LGPD](https://www.cloudflare.com/cloudflare-customer-dpa/)
   (seção 7), com a ANPD como autoridade competente declarada. ⚠️ IP **é** dado pessoal, então
   ela continua sendo **operador** e o DPA precisa ser assinado — é decisão do Jurídico
   (`CF-01`, `GAP-06`), não de TI.
2. **Preço.** Zero na escala previsível, e 16× mais barato que o Twilio-SP acima do free tier.
3. **Operação.** Não há servidor para manter, atualizar nem monitorar — e hoje não existe
   ninguém designado para operar um `coturn`.

**O contra-argumento do `coturn`, honestamente:** é a única opção **sem operador externo
novo**, portanto sem base legal nova a obter. Mas não elimina o problema de dado pessoal — o
servidor ainda vê os IPs de médico e paciente —, custa mais que zero, e transfere para a equipe
a disponibilidade de um componente sem o qual a consulta cai. Como a máquina de produção é uma
**t2.small de 2 GB** que já não cabe o motor de IA (ADR-0001), o `coturn` exigiria instância
própria.

⚠️ **O que NÃO foi confirmado em fonte primária:** o preço da instância em **sa-east-1**. O
valor localizado (**US$ 15,18/mês** para `t3.small`) é de **us-east-1**; São Paulo é mais caro,
e o número exato não foi lido. Também não foi verificada em fonte primária a taxa típica de
conexões que precisam de relay — por isso a conta acima usa o pior caso, que dispensa a
premissa.

---

## Item 9 — Credenciais em texto claro no projeto de origem VidAI

**Onde:** fora deste repositório —
`~/Developer/Projects/vidai_lancamento/vidai_lancamento/`

| arquivo                   | o que contém                                                                  |
| ------------------------- | ----------------------------------------------------------------------------- |
| `deploy-novo-vps.sh:16`   | **senha root do VPS** de produção, em texto claro, com IP e usuário           |
| `deploy-novo-vps.sh`      | senha do PostgreSQL                                                           |
| `docker-compose.prod.yml` | `POSTGRES_PASSWORD` e `REDIS_PASSWORD` default em texto claro                 |
| 6 × `.env`                | nas duas árvores; o README declara chaves de Groq, Anthropic, Google e OpenAI |

⚠️ **Não li o conteúdo de nenhum `.env`.** O diagnóstico vem dos scripts e do README.

**Não é código deste repositório** e não se corrige aqui. Fica registrado por duas razões:

1. **Recomendação de rotação.** As árvores circularam como arquivo compactado (há `__MACOSX`).
   Tratando pelo pior caso plausível: rotacionar a senha root do VPS e as quatro chaves de API.
2. **Nada disso é importado.** [ADR-0001](adr/ADR-0001-motor-de-ia-roda-como-servico-python-separado.md)
   D-08 rejeita reaproveitar `.env`, `docker-compose.prod.yml` ou scripts de deploy do VidAI —
   importa-se **código**, nunca configuração.

---

## Item 10 — O comentário do `requirements.txt` do VidAI diverge do código

**Onde:** `IA-you-ai-main/requirements.txt` × `IA-you-ai-main/agents/embedding_service.py:35`

O comentário documenta `paraphrase-multilingual-mpnet-base-v2` (278 MB). O código carrega
`nomic-ai/nomic-embed-text-v1`. **O código vence** — e o modelo real é o maior dos dois.

Importa porque o dimensionamento da máquina da [ADR-0001](adr/ADR-0001-motor-de-ia-roda-como-servico-python-separado.md)
depende deste número. Quem confiar no comentário subdimensiona.

**Não é defeito deste repositório.** Registrado para não ser redescoberto na Metade 2.

---

## Item 11 — ✅ CORRIGIDO em 20/08/2026 — a teleconsulta autorizava por PAPEL e confiava em id vindo do cliente

> ✅ **Corrigido em 20/08/2026**, autorizado pelo dono (as 7 ocorrências + consentimento +
> auditoria), com o guarda `autorizacao-tem-escopo-de-objeto`, que **nasceu vermelho nas 7** e
> hoje tem **19 casos**. As **8 sabotagens** foram provadas vermelhas. Portão verde: lint 210
> (inalterado), type-check 0, e a baseline até **melhorou** em 2 warnings.
>
> 🔴 **Um achado desta correção NÃO foi corrigido, porque não é decisão técnica:** o
> consentimento LGPD nunca é perguntado a ninguém — ver o fim deste item.

**Achado na auditoria da [Sprint 1](sprints/SPRINT-1-auditoria-da-teleconsulta.md), 20/08/2026.**
Não é uma falha: é **uma classe**, com 7 ocorrências e 3 controles corretos que provam que o
padrão certo era conhecido.

### O diagnóstico

O módulo pergunta _"quem é você?"_ e nunca _"este objeto é seu?"_. O identificador (`roomId`,
`salaId`, `pacienteId`) chega **do cliente** e é usado direto no `where`. É OWASP **API1:2023
(BOLA)** — apontado em `.claude/rules/seguranca-lgpd.md` como _"o risco número um deste
projeto"_.

#### 🔴 O pior: qualquer usuário autenticado entra em qualquer consulta

Dois defeitos que **se compõem**:

| #   | onde                                           | o que faz                                                                                                                    |
| --- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| A   | `app/api/pusher/auth/route.ts:72-80`           | o ramo `presence-sala-` autoriza **qualquer** usuário autenticado em **qualquer** sala. Sem uma única verificação de vínculo |
| B   | `app/api/teleconsulta/sinalizar/route.ts:8-30` | valida só `auth()`; aceita `roomId` arbitrário do body e faz `trigger` no canal. Sem Zod, sem checar sala                    |

Compostos, permitem a um paciente qualquer: **assinar o canal da consulta de outro**, receber
`offer`/`answer`/`ICE` da negociação, injetar a própria sinalização e **estabelecer conexão
WebRTC** — ou seja, assistir a uma consulta médica alheia. O `roomId` tem 6 caracteres gerados
por `Math.random()` (`app/(medico)/_actions/teleconsulta.ts:28`), que não é criptográfico, e não
há rate limit em nenhum dos dois endpoints.

O contraste está no **mesmo arquivo**: `private-user-` confere que o canal é do próprio
usuário, `private-chat-` confere participação no grupo. Só `presence-sala-` não confere nada.
E o `autenticarCanal` final, fora dos três ramos, autoriza **qualquer nome de canal** — o
default é permitir, não negar (_fail-open_).

#### As outras 5 ocorrências

| onde                                                       | o que aceita do cliente    | consequência                                                                                                                        |
| ---------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `app/api/teleconsulta/aprovar-narrativa/route.ts:11,23-29` | `pacienteId` **e** o texto | 🔴 **qualquer médico escreve evolução clínica no prontuário de qualquer paciente**. Sem Zod, sem auditoria                          |
| `app/api/teleconsulta/transcrever/route.ts:28-33`          | `salaId`                   | o comentário diz _"Verificar acesso à sala"_ e só verifica **existência**. Grava transcrição com o `medicoId` da sala, não do autor |
| `app/(medico)/_actions/teleconsulta.ts:62`                 | `salaId`                   | qualquer médico altera o consentimento LGPD de sala alheia                                                                          |
| `app/(medico)/_actions/teleconsulta.ts:81`                 | `salaId`                   | qualquer médico encerra consulta alheia e marca a consulta como `realizada`                                                         |
| `app/(paciente)/_actions/teleconsulta.ts:90`               | `salaId`                   | qualquer paciente muda para `em_andamento` a sala de outro                                                                          |

#### Os 3 controles que provam que o padrão certo era conhecido

`criarSalaTeleconsulta:37` filtra `medicoId` · `buscarSalaPorRoomId:47` filtra `pacienteId` ·
`transcricao/route.ts:31-37` confere que o médico é o dono, ou admin. **O mesmo módulo acerta
na leitura e erra na escrita** — é o eixo da classe, e o que um guarda precisa fatiar.

#### E o consentimento LGPD não é exigido: é autodeclarado pelo cliente

Resposta ao **entregável 6** da Sprint 1. `transcrever/route.ts:15` lê `consentimento` do
`formData` e grava `consentimentoObtido: true` (linha 40) **sem nunca consultar**
`teleconsultas.consentimentoLgpd` no banco. O campo existe, é gravado — e não governa nada.
Pior: em `GlobalTeleconsultaHost.tsx:176-182`, `registrarConsentimentoLgpd` roda dentro de
`try/catch` que só faz `console.error` e **prossegue** — a gravação de áudio começa mesmo se o
registro do consentimento falhar. E as linhas 22-26 do handler são **código morto**: a
validação anterior já garantiu `consentimento === true`.

#### A auditoria não registra quem agiu

`db/schema/logs-auditoria.ts:15` **tem** `userId` e `ip`. As chamadas passam só
`{acao, entidade, entidadeId}` — em `teleconsulta.ts:66,131`, `(paciente)/teleconsulta.ts:99` e
`transcrever/route.ts:180`. Todas com `.catch(() => {})`, então a falha é silenciosa. A tabela
que a própria doc chama de _"obrigatório pela LGPD"_ registra **o quê**, nunca **quem**.

### O perigo de mexer, medido

| pergunta                             | resposta                                                                                                    |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| pontos a corrigir                    | **7** de autorização + 4 de auditoria + 1 de consentimento                                                  |
| está em produção?                    | 🔴 **o código está, e as rotas respondem.** O uso clínico não (`DO-02`)                                     |
| existe teste que prove antes/depois? | **nenhum.** É o que esta sprint precisa criar primeiro                                                      |
| o que quebra em quem consome hoje?   | nada de uso real; o risco é **regressão silenciosa** — um `where` a mais que passe a negar acesso legítimo  |
| hook                                 | 3 dos arquivos estão em `app/(medico)/` e `app/(paciente)/` — **área protegida**. Exige autorização escrita |

### Como corrigir

1. **Primeiro o guarda, vermelho** — um caso por ocorrência, mais os 3 controles corretos como
   prova de que a regra não é vácua.
2. `pusher/auth`: o ramo `presence-sala-` confere que o usuário é o médico **ou** o paciente
   daquela sala; e o default final passa a **negar** canal desconhecido.
3. `sinalizar`: Zod no payload + conferir vínculo do usuário com o `roomId`.
4. Um helper único — `garantirDonoDaSala(salaId | roomId, papel)` — em vez de repetir o `where`
   em 7 lugares. Repetição é o que produziu a divergência.
5. `aprovar-narrativa`: derivar `pacienteId` **da sala**, nunca do body.
6. Consentimento: ler do banco, não do cliente; e falhar a consulta se o registro falhar.
7. Auditoria: passar `userId` e `ip`, e **deixar de engolir** o erro.

### 🔴 O que NÃO foi corrigido: o consentimento não é perguntado a ninguém

`components/teleconsulta/GlobalTeleconsultaHost.tsx:83`

```ts
const [consentimentoTranscricao] = useState(true);
```

**Sem setter. Sem UI. Sem nenhum lugar onde alguém marque a caixa.** O campo existe no schema,
é gravado, e o valor é `true` **por construção** — não porque alguém consentiu. A pergunta do
entregável 6 (_"são exigidos, não só armazenados?"_) tem resposta pior que _"não são
exigidos"_: **não são obtidos**.

A LGPD (art. 5º, XII) define consentimento como manifestação **livre, informada e inequívoca**.
Um `useState(true)` não é manifestação de ninguém.

**Não corrigi de propósito:** criar a tela e escrever o texto do que se consente é decisão de
produto e do Jurídico — inventar o texto seria pior que a ausência, porque quem lê acredita.
🔴 **Precisa de decisão do dono.**

O que **foi** feito nesse eixo, sem inventar regra: a falha do registro deixou de ser engolida
por um `console.error`, e **a gravação de áudio só começa se o consentimento estiver registrado
no banco** (`consentimentoRegistradoRef`). A consulta em si prossegue — recusar atendimento
médico por falha de registro seria pior para o paciente que perder a transcrição.

### O guarda

`__tests__/guardas/autorizacao-tem-escopo-de-objeto.test.ts` — **19 casos.** Falha quando um handler ou action
de teleconsulta usa `salaId`/`roomId`/`pacienteId` vindo do cliente num `where` **sem** conjunção
de escopo do usuário. Fatiado **por função**, não por arquivo: a Regra 2 de
[TECNICA-DOS-GUARDAS](TECNICA-DOS-GUARDAS.md) — o defeito acontece por função, e um guarda por
arquivo passaria sobre o arquivo que acerta em 2 de 5 funções. Os 3 controles corretos entram
como casos que devem **passar**.

🔴 **A sabotagem encontrou um furo no próprio guarda.** Das 8 mutações, 7 morreram e **uma
sobreviveu**: devolver a `aprovar-narrativa` o `pacienteId` do body, **mantendo** a chamada a
`garantirDonoDaSala`. O guarda provava que a sala foi verificada, não que os dados **derivam**
dela — e verificar o dono para então gravar em outro dono é checagem decorativa. Virou o caso
_"o paciente gravado deriva da sala"_, fatiado no **insert** (não no arquivo, porque
`select({ pacienteId: teleconsultas.pacienteId })` é legítimo e não pode ser acusado). Com ele,
as 8 morrem. Registro no topo do arquivo do guarda.

---

## Item 12 — ⚠️ O mascaramento de PII da transcrição protege menos do que o comentário afirma

**Onde:** `app/api/teleconsulta/transcrever/route.ts:154-160`

✅ **Confirmado o que o critério de aceite da Sprint 1 pedia:** o mascaramento **existe** e a
versão **mascarada é a persistida** (linha 172, `textoCompleto: textoMascarado`). A precaução de
`.claude/rules/seguranca-lgpd.md` está mantida — e deve continuar.

Mas o comentário do código diz _"Remover CPF, RG, telefones, emails, endereços"_, e:

| o que o comentário afirma | o que o código faz                                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| endereços                 | 🔴 **não existe regex de endereço.** A afirmação é falsa                                                                     |
| telefones                 | só com DDD entre parênteses: `(11) 99999-9999` pega; `11999999999` **não** — e transcrição de fala raramente traz parênteses |
| nome próprio              | não é mencionado, e **não é mascarado** — numa conversa clínica, é a PII mais frequente                                      |

🔴 **E o limite estrutural:** o mascaramento acontece **depois** do Google STT. O áudio bruto —
voz, nome falado, tudo — **sai da plataforma** para o Google antes de qualquer máscara. Áudio
não se mascara com regex, exatamente como imagem não se mascara (o motivo pelo qual a extração
automática de documento foi recusada em 19/08/2026). O mascaramento protege a etapa **Gemini**,
não a etapa **STT**.

⚠️ Portanto **há dois operadores externos** recebendo dado de saúde nesta rota, não um. Base
legal e contrato de operador são decisão do Jurídico (`CF-01`, `GAP-06`), não de TI.

Menor, no mesmo trecho: `hashTexto` (linha 167) é calculado sobre o texto **não** mascarado,
enquanto o que se persiste é o mascarado — a idempotência se apoia num texto que não existe mais.

---

## Modelo de item RETRATADO

Quando algo reportado aqui não era defeito:

## Item NN — ⚠️ RETRATADO: {{o que eu disse}}

Reportei que {{X}}. **Estava errado.** {{Por quê, com a evidência.}}

O erro foi {{a causa — grep estreito, leitura apressada, doc desatualizada tomada como código}}.

Fica registrado porque retratar por escrito ensina mais que acertar — e porque a próxima sessão
não pode "consertar" um não-defeito.

---

## Itens abertos da Sprint 4 — diagnosticados em 24/08/2026

Encontrados ao conferir os 8 entregáveis da sprint contra o disco, depois de implementar o que o
dono pediu (opções de medicamento, botão de revisar, preview por perfil). **Nenhum destes foi
pedido** — ficam registrados para não serem planejados como se existissem.

### Item 8 — Caminho de hipótese manual não existe (E3 da Sprint 4)

**Onde:** `components/ia-clinica/RevisaoHumana.tsx:177-260` — a lista de opções só oferece as
hipóteses **do grafo**. `rg "manual" components/ia-clinica/` devolve zero.

**Por que importa:** o médico que conclui algo que a IA não levantou hoje só tem o caminho
"Divirjo da análise", que grava `validacao: 'divergente'` e a conclusão em texto livre — sem CID
estruturado ligado a uma hipótese própria. Funciona, mas mede errado: divergência com hipótese
nomeada e divergência sem hipótese ficam indistinguíveis no `revisoes_ia`, e é justamente essa
distinção que diria se o modelo **errou** ou se apenas **não cobriu**.

**Perigo de mexer:** baixo. Um campo novo em `revisoes-ia.ts` (nullable) e um caminho na tela.
Nenhum consumidor em produção — a tabela não é lida por nada ainda. Não há teste que prove o
antes.

### Item 9 — Rascunho da revisão não persiste (E7 da Sprint 4)

**Onde:** `components/ia-clinica/RevisaoHumana.tsx:53-60` — `modo`, `hipoteseId`, `conclusao` e
`cid` são `useState` puro. Fechar a aba perde tudo.

**Por que importa:** a conclusão do médico é texto escrito à mão, no meio de consulta. Perder por
recarregamento é a classe de defeito que faz o médico deixar de escrever justificativa — e a
justificativa é o que sustenta a Trava 2.

**Perigo de mexer:** baixo, mas com uma pergunta de LGPD antes: rascunho de conclusão clínica em
`localStorage` é **dado de saúde no navegador**, e o navegador pode ser compartilhado. A resposta
provável é rascunho no **servidor**, ligado ao médico, não no cliente — e isso muda o desenho.
**Não implementar antes de decidir isso.**

### Item 10 — Urgência não vai à tela, e o mapeamento 7→4 não está escrito (E8 da Sprint 4)

**Onde:** `lib/ia-clinica/contrato.ts` — `UrgenciaAnalise` tem **7 valores**; o desenho pede
**4 níveis** de badge nos tokens `--chart-*`. Nenhum componente lê o campo.

**Por que importa:** urgência é o dado que muda o que o médico faz **primeiro**. Estar no
contrato e não na tela é coleta sem consumidor — o oposto do que o projeto exige.

**Perigo de mexer:** médio, e não é código: o mapeamento 7→4 é **decisão de desenho** e, se dois
lugares mapearem diferente, a mesma análise aparece com urgências distintas em telas distintas.
Escrever o mapa numa constante única, com guarda de exaustividade, antes de renderizar.

---

## Normas que as normas citaram — pendentes em 24/08/2026

Descobertas **dentro** do texto das três RDCs transcritas hoje. Norma que cita norma cria
dependência, e ignorá-la é o mesmo erro de citar a 327/2019 revogada.

| norma            | quem a cita                              | o que ela decide, e o que trava sem ela                                                                                                                                                                                                                                     |
| ---------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RDC 38/2013**  | `CAN-05` (RDC 1.015/2026, Art. 5º)       | define **"doença debilitante grave"** — o critério que autoriza THC acima de 0,2 %. Sem ela, a trava de indicação da Sprint 5 (entregável 10) não tem régua, e **o nosso próprio fixture** sugere `CBD:THC 1:1` para polineuropatia diabética sem saber se ela se qualifica |
| **RDC 873/2024** | `REC-05` (RDC 1.000/2025, Art. 3º, VIII) | **institui o SNCR**. O `REC-02` exige numeração vinda dele; como se requisita, o que se registra e o que acontece na indisponibilidade estão nesta norma, não na 1.000                                                                                                      |
| **RDC 185/2001** | `ANV-04` (RDC 657/2022, Art. 4º)         | as **classes de risco** de dispositivo médico. Completa o enquadramento SaMD; não bloqueia telas, bloqueia **ligar o motor**                                                                                                                                                |

⚠️ **Perigo de mexer: nenhum** — é transcrição, não código. O perigo é o oposto: decidir sem elas.

## Item 11 — `lib/receituario/` não foi conferido contra `REC-02` e `REC-03`

**Onde:** `lib/receituario/`, `app/api/receituario/`, `app/(medico)/_actions/prescricoes.ts`.

**O que a norma exige** (RDC 1.000/2025, em vigor desde ~fevereiro de 2026):

- `REC-02` — _"Cada receituário eletrônico deve conter a **numeração individualizada previamente
  concedida por meio do SNCR**"_ (Art. 7º)
- `REC-03` — deve _"ser subscrito com **assinatura eletrônica qualificada**"_, isto é, certificado
  **ICP-Brasil** (Art. 8º, I + Art. 3º, II)

**Por que importa:** a Sprint 5 faz a **ponte** da conduta para a prescrição. Se o que existe hoje
não cumpre `REC-02`/`REC-03`, a ponte entrega conduta a um caminho não conforme — e o defeito
passa a ter origem na tela nova.

**Perigo de mexer: ALTO.** `prescricoes.medicamentos` é JSONB que alimenta **PDF assinado e
SNCR** (Item 4 do checklist). É produção. **Catalogar e medir antes**, com autorização própria —
não corrigir de passagem, e nunca no commit da Sprint 5.

**O que fazer primeiro, e não é código:** ler a **RDC 873/2024**, que é quem define o SNCR.

---

## Item 13 — 🔴 A cadeia de dosagem em produção: sem vínculo, sem escopo de objeto, e sobrescrevendo histórico

**Achado em 25/08/2026**, ao ler o código antes de começar a Sprint 5 (item 7 da fila). São
**cinco defeitos** na mesma família — a cadeia `conduta → dosagem → titulação` — e nenhum estava
catalogado. **Nenhum se corrige nesta sprint**: o desenho do caminho novo está na
[ADR-0012](adr/ADR-0012-o-sistema-avisa-o-medico-decide-na-cadeia-da-conduta.md).

### 13.1 — 🔴🔴 `criarDosagem` do route group do paciente **não tem autenticação nenhuma**

**Onde:** `app/(paciente)/_actions/dosagem.ts:43` (`criarDosagem`), `:129`
(`listarDosagensPaciente`), `:166` (`pedirRecompra`).

**Medido:** grep por `auth()`, `verificarMedico`, `verificarPaciente`, `verificarRole` e
`currentUser` no arquivo inteiro → **zero ocorrências**. As três actions aceitam `pacienteId` ou
`dosagemId` do cliente e operam direto no banco.

**Por que é grave e não é teórico:** `'use server'` publica **todo export como endpoint POST**.
Não é preciso que um componente importe a função para que ela seja chamável — o Next gera o
endpoint a partir do módulo. Que nenhum componente a importe **reduz a descoberta, não o acesso**.

**Perigo de mexer: BAIXO — e é o achado mais fácil desta lista.**

- pontos de chamada: **zero** (`app/_actions/dosagens.ts` é a versão que a UI usa — ver 13.2)
- em produção? o arquivo está em `main`, sim
- o que quebra em quem consome hoje: **nada**, porque ninguém consome
- ⚠️ a decisão a tomar não é técnica: **apagar o arquivo** ou **acrescentar auth**. Apagar remove
  superfície; acrescentar preserva um caminho que talvez tenha sido feito para algo.

### 13.2 — Duas `criarDosagem`, e as duas são chamáveis

**Onde:** `app/_actions/dosagens.ts:47` **e** `app/(paciente)/_actions/dosagem.ts:43`.

A primeira tem `verificarMedicoOuAdmin` e é a que `tab-rastreio.tsx:13` importa. A segunda é a de
13.1. Divergem também no comportamento: só a segunda cria `recompras`.

**Perigo de mexer: MÉDIO.** Unificar exige decidir qual comportamento é o certo — e a criação
automática de `recompras` é regra de negócio, não detalhe.

### 13.3 — 🔴 `atualizarDosagem` faz `UPDATE` em `gotasPorDia`

**Onde:** `app/_actions/dosagens.ts:120-159`.

É literalmente o **R-03** da [ADR-0005](adr/ADR-0005-a-cadeia-conduta-prescricao-dosagem-titulacao.md):
_"`UPDATE` em `dosagens.gotasPorDia` apaga a curva de titulação — e viola a proibição de
sobrescrever histórico clínico"_. A ADR rejeitou; o código faz.

**Perigo de mexer: MÉDIO.**

- pontos de chamada medidos: **nenhum componente a importa** hoje — mas ela é endpoint, como 13.1
- corrigir significa **trocar semântica**: "atualizar" vira "desativar + inserir nova"
- existe teste que prove antes/depois? **não** — e é por isso que o guarda
  `titulacao-nao-sobrescreve-o-anterior` nasce cobrindo o caminho novo primeiro

### 13.4 — 🔴 `editarAjusteDosagem` apaga fisicamente os itens do ajuste

**Onde:** `app/_actions/ajustes-dosagem.ts:108-127` — `db.delete(itensAjusteDosagem).where(...)`,
`DELETE` físico, seguido de reinserção.

Um ajuste de dose editado **perde o que dizia antes**, sem versão anterior e sem motivo. É a
proibição nº 4 do `CLAUDE.md` — _"alteração preserva o anterior, a data e o motivo"_.

⚠️ E a UI **diz o contrário do que o código faz** nos dois sentidos: `tab-dosagem.tsx:144` avisa
que o ajuste _"será removido permanentemente"_, mas `excluirAjusteDosagem:159` faz **soft delete**
(`deletedAt`). O usuário é avisado de uma destruição que não acontece, e não é avisado da que
acontece.

**Perigo de mexer: MÉDIO-ALTO.** É tela em produção com dado clínico já digitado. `DO-48` resolve
o lado do fluxo — a tela para de aceitar dado novo — mas **as actions continuam exportadas**, e
tirar export de `'use server'` sem varrer todos os pontos de chamada é mudança de superfície de
API em produção.

### 13.5 — 🔴 Nenhuma das actions de dosagem tem escopo de objeto (OWASP API1 / BOLA)

**Onde:** `app/_actions/dosagens.ts:47,120,190,225` · `app/_actions/ajustes-dosagem.ts:34,72,108,152`.

Todas usam `verificarMedicoOuAdmin`, que prova **papel** e não **vínculo**. Médico A cria, lista,
ajusta e desativa a dosagem do paciente do médico B — basta enviar o `pacienteId` dele. É a mesma
classe corrigida na teleconsulta em 20/08 pelo `garantirDonoDaSala` (Item 11), e a norma é
explícita: `CAN-02` restringe a prescrição a quem **acompanha clinicamente** o paciente.

**E o helper que resolveria isso existe duplicado, fora de `lib/auth/`:**
`app/_actions/revisao-ia.ts:33` e `app/_actions/anamnese-baseline.ts:52` declaram cada um o seu
`garantirMedicoDoPaciente`.

**Perigo de mexer: MÉDIO.**

- **8 funções** em 2 arquivos, mais 3 telas que as consomem (`tab-dosagem`, `tab-rastreio`, e o
  painel de teleconsulta que lê `dosagens` direto)
- em produção, **e com uso real** — diferente da teleconsulta, que nunca foi usada (`DO-02`)
- o risco concreto é **regressão de acesso legítimo**: um `where` a mais que passe a negar o
  médico certo. Mitigação exigida: guarda por função, **vermelho antes**, com os casos de acesso
  legítimo como controle
- ⚠️ **admin**: `verificarMedicoOuAdmin` hoje deixa o admin passar. Qualquer correção precisa
  decidir se o admin continua vendo dosagem de qualquer paciente — **isso é regra de negócio**,
  vai ao dono

### 13.6 — 🔴 `prescricaoTipoEnum` não comporta a **Notificação de Receita "A"**, que o `CAN-04` exige

**Onde:** `db/schema/enums.ts:107-111`.

```
prescricaoTipoEnum = ['simples', 'controle_especial', 'personalizado']
```

**O que a norma exige** (`CAN-04`, RDC 1.015/2026, Art. 37, §§ 1º e 2º): produto de Cannabis com
teor de THC **acima de 0,2%** exige que a prescrição seja acompanhada de **Notificação de Receita
"A"**. O enum não tem esse valor — então o sistema **não consegue registrar** o tipo de documento
que a norma manda usar.

**Como a Sprint 5 lidou com isso, sem corrigir:** a ponte (`lib/conduta/ponte-prescricao.ts`)
grava `controle_especial`, que é o mais próximo disponível, e a tela **avisa em vermelho** que a
Notificação "A" precisa ser emitida fora do sistema. O que o sistema avisou e o que o médico
decidiu ficam em auditoria.

🔴 **Por que denunciar em vez de gravar calado.** Gravar `controle_especial` em silêncio faria
existir um documento **plausível com o tipo errado** — e receituário controlado com tipo errado é
pior que receituário ausente, porque ninguém desconfia. É a mesma decisão de desenho que os
componentes de IA tomaram ao renderizar _"origem desconhecida: X"_ em vez de cair para um padrão.

**Perigo de mexer: ALTO.**

- `prescricoes.tipo` alimenta o **PDF assinado** e o fluxo do **SNCR** — é o Item 4 do checklist
- acrescentar valor a `pgEnum` exige migration com `ALTER TYPE ... ADD VALUE`, que **não é
  reversível** no Postgres sem recriar o tipo
- há **3 telas** que leem ou escrevem `tipo` (`tab-prescricoes.tsx`, `receituarios/page.tsx`,
  `prescricao-inline.ts`) e um `layout-builder` que decide o desenho do papel por ele
- ⚠️ e a pergunta que precede o código: **a Be4Hope pode emitir Notificação de Receita "A"?**
  Ela é documento de controle especial com numeração própria — isso é **regra de negócio e
  regulatória**, não decisão de TI. Vai ao dono antes de qualquer migration.

**O guarda já cobra a reversão:** `a-conduta-avisa-e-nao-decide` tem um caso que fica **vermelho
no dia em que o enum ganhar `notificacao_a`**, nomeando que o contorno da ponte pode sair.

### O que a Sprint 5 faz, e o que ela não faz

| faz                                                                                                  | não faz                                          |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| o caminho novo nasce com `garantirMedicoDoPaciente` de `lib/auth/escopo-paciente.ts` (ADR-0012 D-05) | corrigir as 8 funções existentes                 |
| o caminho novo insere linha nova, nunca `UPDATE` em `gotasPorDia`                                    | corrigir `atualizarDosagem`                      |
| a tela antiga para de aceitar dado novo (`DO-48`)                                                    | remover os exports de `editar`/`excluir`         |
| a conduta grava `medicamentoId` (ADR-0005 D-05)                                                      | mexer em `prescricoes.medicamentos` — é o Item 4 |

---

## Item 14 — ⚠️ RETRATADO: datei o trabalho da Sprint 5 como 24/08 quando era **25/08/2026**

Escrevi `24/08/2026` nas decisões `DO-46`, `DO-47` e `DO-48`, na ADR-0012, na terceira versão da
ADR-0005 D-03, no Item 13 deste arquivo, na Sprint 5 e no `baseline.json` — **todos feitos em
25/08/2026**. A sessão anterior é que foi 24/08, e eu herdei a data dela sem conferir o relógio.

**Corrigido em 25/08/2026**, alvo por alvo. As datas legítimas de 24/08 — `DO-36` a `DO-45`, a
transcrição das RDCs, a Sprint 4 — **não foram tocadas**.

**Por que isto importa mais do que parece:** a frase citada de uma decisão do dono vale pelo par
_frase + data_. Duas decisões sobre o mesmo assunto no mesmo dia são um contexto; em dias
diferentes são uma **mudança de posição**, e quem lê depois precisa saber qual é o caso. O `DO-44`
(24/08) e o `DO-47` (25/08) são exatamente esse par: o segundo responde a pergunta que o primeiro
deixou aberta, **no dia seguinte**, depois de a transcrição das RDCs trazer dado novo. Datados no
mesmo dia, pareceriam contradição; datados certo, são o caminho.

**A regra que sai daí:** data de registro se lê do relógio (`date`), nunca da data do documento
que se está editando. Sessão que começa lendo um handoff de ontem herda a data de ontem se
ninguém conferir.

---

## Item 15 — ✅ Cartões 16 a 19 do Trello, concluídos em 25/08/2026 (fecham a Sprint 4)

| cartão | o quê                                | onde                                                                            |
| ------ | ------------------------------------ | ------------------------------------------------------------------------------- |
| **16** | E3 — divergir alimenta o RAG         | `app/_actions/revisao-ia.ts` · `db/schema/revisoes-ia.ts` · `RevisaoHumana.tsx` |
| **17** | E7 — rascunho da revisão no servidor | `app/_actions/rascunho-revisao.ts` · `db/schema/rascunhos-revisao-ia.ts`        |
| **18** | E8 — urgência na tela                | `lib/ia-clinica/urgencia.ts` · `components/ia-clinica/SeloDeUrgencia.tsx`       |
| **19** | aba `IA Clínica` na teleconsulta     | `components/teleconsulta/PainelClinicoLateral.tsx`                              |

Decisões: `DO-49` (rótulo), `DO-50` (posição), `DO-51` (4º nível de urgência) ·
[ADR-0013](adr/ADR-0013-o-mapa-de-urgencia-mora-num-lugar-so.md) nova · ADR-0010 §5 e ADR-0011 §5
retificadas.

### 🔴 O que a implementação corrigiu no que eu tinha escrito

**O mapa de urgência não era 7→4. É 7→3, mais um derivado.** Ao medir `UrgenciaAnalise` para
implementar, os sete valores mostraram ser **dois vocabulários** — cor (`verde`/`amarelo`/
`vermelho`) e estado (`ok`/`normal`/`atencao`/`critico`) — para **três** níveis. O próprio
contrato confirma em `contrato.ts:339`: `nivel_urgencia?: 'normal' | 'atencao' | 'critico'`.

O "código roxo" de 4 níveis que eu havia descrito é do **VidAI**, e eu o repeti sem conferir o
nosso contrato. É o mesmo erro de método da retratação das contagens de guarda: **copiar um
número em vez de medi-lo**.

O 4º nível existe, mas por decisão explícita (`DO-51`) e com origem declarada: emergência **e**
`red_flags_nao_explicadas > 0` — dois campos que o motor já produz.

### O que NÃO foi feito, e por quê

- **A ingestão no corpus** — `GAP-16` (Jurídico) segue aberto. A coluna `ingeridoNoCorpusEm`
  existe e **fica vazia**, e um caso de guarda varre `app/`, `lib/` e `components/` procurando
  qualquer escrita nela. Sem a coluna, _"não ingerimos ainda"_ seria afirmação sem prova.
- **O prazo de retenção do rascunho** — decisão do Jurídico. A coluna existe e fica vazia.
- **O grafo real na aba da teleconsulta** — o motor é a Metade 2 (`DO-06`). A aba mostra o estado
  vazio, sem botão inerte.

### Achado de ambiente

🔴 **O Postgres local é um container que pode estar parado.** `behemp-postgres-dev` estava
`Exited` no meio desta sessão, e `pnpm db:migrate` falhou com `ECONNREFUSED` — erro que **não
diz** que o container caiu. Antes de culpar a migration: `docker start behemp-postgres-dev`.

---

## Item 16 — 🔴 RETRATADO: declarei os cartões 17 e 18 completos, e não estavam

Em 25/08/2026 reportei os quatro cartões (16 a 19) como entregues. O dev Davi condicionou o passo
seguinte — _"vamos para o card 7 SE e somente SE terminamos o cartão de 16 a 19 completamente"_ —
e a verificação mostrou **dois incompletos**. Ele estava certo em condicionar.

### 17 — o rascunho não protegia de "sair sem querer"

**Medido:** `grep` por `setInterval|setTimeout|beforeunload|onBlur` em `RevisaoHumana.tsx`
retornava **zero**. `salvarRascunho` só era chamada no `onClick` do botão.

**Por que isso é falhar o requisito, não uma limitação aceitável:** o `DO-41` diz literalmente
_"o médico **pode sair sem querer** e esse dado precisa ficar salvo"_. Quem sai sem querer, por
definição, **não clicou**. O mecanismo não cumpria o motivo pelo qual foi pedido — cumpria a
descrição da tela ("tem um botão de salvar rascunho"), que é coisa diferente.

**Corrigido:** auto-save com debounce de **2 s** (não por tecla — cada salvamento insere linha
nova, e salvar por tecla transformaria o histórico em ruído), mais `beforeunload` avisando quem
tenta fechar dentro da janela dos 2 s. O botão manual fica, para quem quer salvar de propósito.

⚠️ O `beforeunload` **não tenta salvar**: requisição disparada ali é cancelada pelo navegador na
maior parte das vezes, e prometer um salvamento que não acontece é pior que não prometer.

### 18 — o gatilho de urgência não estava em tela nenhuma

**Medido:** `SeloDeUrgencia` aparecia em **dois** arquivos — nele mesmo e no `PreviewGaleria.tsx`.

**Por que isso é falhar o requisito:** o `DO-42` diz _"precisamos disso **na tela**"_. Componente
que só vive no `/preview` é protótipo, não entrega. Eu construí a peça, testei a peça, e não a
montei.

**Corrigido:** montado em `PainelHipoteses.tsx`, em dois lugares e por razões diferentes:

- **selo compacto no cabeçalho**, junto da síndrome — presença permanente;
- **aviso explicado ANTES das hipóteses** — porque o nível de urgência **calibra a leitura de
  todas elas**, o mesmo raciocínio pelo qual a incompletude já aparecia antes. Em `rotina` não
  renderiza nada: aviso que aparece sempre deixa de avisar.

### O guarda também falhou, e essa é a parte que importa

Os dois passaram verdes porque o guarda checava que **o arquivo existia**, não que ele **cumpria
o motivo pelo qual foi pedido**. É uma classe de falso-verde diferente das anteriores: não é
menção × uso, é **existência × montagem**.

**Seção 6 nova no guarda**, com 6 casos: o selo está em tela de produção · o aviso vem antes das
hipóteses · o selo recebe `red_flags_nao_explicadas` (senão o 4º nível nunca acende) · o rascunho
salva sozinho · o debounce é ≥ 1 s · o botão manual continua existindo.

**4 sabotagens provam**, e duas delas reproduzem exatamente o estado anterior — o selo só no
preview, e o auto-save virando botão manual.

### A regra que sai daí

**Guarda de entrega verifica MONTAGEM, não existência.** Perguntar "o arquivo existe?" aprova
protótipo. A pergunta é "alguma tela de produção o monta?" — e, quando o requisito diz _como_ a
coisa deve funcionar ("salvar sem que o médico clique"), o guarda tem de checar **o mecanismo**,
não o rótulo do botão.

---

## Item 17 — 🔴 Dois dos três seeds não recusam rodar em produção, e 37 de 44 tabelas ficam sem dado

**Achado em 25/08/2026**, ao preparar os cartões 20 e 21 do Trello (mapeamento e seed). Os dois
achados são da mesma família e bloqueiam o QA de ponta a ponta.

### 17.1 — 🔴🔴 `db/seed.ts` e `db/seed-produtos.ts` NÃO têm a trava de produção

**Medido:** `grep NODE_ENV db/seed*.ts` acusa **um** arquivo de três.

| arquivo                   | trava                                                  |
| ------------------------- | ------------------------------------------------------ |
| `db/seed-perfis-teste.ts` | ✅ **dupla** — `NODE_ENV=production` **e** URL de Neon |
| `db/seed.ts`              | 🔴 **nenhuma**                                         |
| `db/seed-produtos.ts`     | 🔴 **nenhuma**                                         |

**A convenção do `CLAUDE.md` é explícita** (seção _"Onde script, teste e seed moram"_): seed
_"recusa rodar com `NODE_ENV=production`; idempotente; sem identificador real"_. Dois violam.

**Por que a trava dupla do `seed-perfis-teste.ts` é o padrão certo**, e está escrito no próprio
arquivo (`:15-16`): `NODE_ENV` **pode simplesmente não estar definido** num terminal qualquer.
Uma trava que depende de variável ausente não é trava. A segunda verificação — a URL apontar para
Neon — pega o caso em que alguém carregou o `.env` de produção sem definir `NODE_ENV`.

**O risco concreto:** `pnpm db:seed` com a variável de produção carregada insere **paciente
fictício no banco real**. Num sistema de saúde, dado fictício misturado a dado clínico real não é
inconveniente de ambiente — é **contaminação de prontuário**, e não há como distinguir depois
sem auditoria linha a linha.

⚠️ E o momento agrava: o próximo passo do projeto é justamente **rodar seed para preparar o QA**
(`DO-53`). É exatamente quando alguém digita `pnpm db:seed` sem pensar duas vezes.

**Perigo de mexer: BAIXO.**

- a mudança é **aditiva**: um bloco de guarda no início da função, antes de qualquer `insert`
- o padrão a copiar **já existe e funciona** — `db/seed-perfis-teste.ts:60`
- nada no comportamento em desenvolvimento muda
- ⚠️ o único efeito colateral possível é o seed **parar de rodar** onde hoje roda, se o ambiente
  estiver mal configurado — o que é o objetivo

### 17.2 — 37 de 44 tabelas ficam sem dado nenhum

**Medido:** os três seeds populam **7** tabelas — `users`, `pacientes`, `medicos`,
`medicamentos`, `gruposChat`, `participantesGrupo`, `alertasConfig`. O schema tem **44**.

**Ficam vazias**, entre outras: `triagens`, `consultas`, `teleconsultas`, `anamneses`,
`medidasDesfecho`, `rastreioUsoCannabis`, `dosagens`, `ajustesDosagem`, `itensAjusteDosagem`,
`prescricoes`, `revisoesIa`, `rascunhosRevisaoIa`, `notificacoes`, `exames`,
`autorizacoesAnvisa`, `recompras`, `evolucoes`.

**O que isso significa na tela:** existe médico, existe paciente, existe catálogo — e **não
existe um tratamento acontecendo**. Nenhuma consulta, nenhuma dose, nenhum ajuste, nenhum
histórico.

🔴 **Por que isso bloqueia o QA e não é só desconforto:** o produto tem um encadeamento de
bloqueios — paciente sem triagem não chega à teleconsulta, sem consentimento dos dois lados a
sala não abre, sem conduta não há titulação. Quem testar a sexta tela sem dado nas cinco
primeiras encontra tela vazia — e **tela vazia é indistinguível de bug para quem testa**.

**O caso mais concreto do custo:** o 4º nível de urgência (`DO-51`) só acende com emergência
**e** red flag não explicada ao mesmo tempo. Sem um paciente com essa combinação no seed, esse
nível existe no código, está coberto por guarda, e **nunca é visto por um humano** antes de um
paciente real.

### O que fazer, e em que ordem

1. **Cartão 20** — mapear quais cenários o seed precisa criar, e o que cada um torna visível
2. **Cartão 21** — escrever o seed, com a trava dupla **antes de qualquer `insert`**, e
   acrescentar a mesma trava nos dois seeds antigos
3. **Cartão 7** — só então o QA de ponta a ponta

⚠️ **A trava dos dois seeds antigos entra no Cartão 21, não em commit separado.** É exceção
consciente à regra de _"corrigir em trabalho próprio"_: rodar um seed sem trava **para preparar o
QA** é a situação de risco, e corrigir depois seria correr o risco primeiro.

### Guarda que isto pede — depois da correção, não antes

`todo-seed-recusa-producao`: varre `db/seed*.ts` e exige que **cada** arquivo tenha as duas
travas antes do primeiro `insert`. Nasce vermelho nos dois atuais — por isso entra **junto** com
a correção, e não antes (`.claude/rules/seguranca-lgpd.md`: guarda que acusa violação conhecida e
não corrigida é guarda que alguém desliga).

---

## Item 18 — ✅ Integração ChatPro, implementada e testada em 09/09/2026

**O que foi pedido:** replicar na BeHemp a integração com o ChatPro que já roda **validada em
produção** no `greens-corp` (_"O QUE ESTÁ LÁ JÁ ESTÁ VALIDADO O USO"_), com uma diferença de
fluxo: aqui o bot coleta **nome completo + e-mail**, e lá só o nome. Ao final, o link leva à
página de cadastro que a **Dryelle** está construindo.

**Decisões:** `docs/adr/ADR-0015`. **Configuração manual:** `docs/chatpro/COMO-CONECTAR-NO-PAINEL.md`.
**Contrato da tela:** `docs/chatpro/CONTRATO-DA-PAGINA-DE-CADASTRO.md`.

### O que existe no disco

| camada                               | arquivo                                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| normalização de telefone             | `lib/chatpro/telefone.ts`                                                                            |
| segredo em tempo constante           | `lib/chatpro/segredo.ts`                                                                             |
| cliente da CHAT API                  | `lib/chatpro/cliente.ts`                                                                             |
| texto da mensagem (puro)             | `lib/chatpro/mensagem-do-link.ts`                                                                    |
| núcleo: cria/reaproveita solicitação | `lib/chatpro/solicitacao.ts`                                                                         |
| tradução de UUID → nome              | `lib/chatpro/diretorio.ts`                                                                           |
| consumo da fila de eventos           | `lib/chatpro/processador.ts`                                                                         |
| validação do token do link           | `lib/chatpro/token-de-cadastro.ts`                                                                   |
| rotas                                | `app/api/chatpro/{bot-link,intake,start,processar}/`, `webhook/[pathToken]/`, `solicitacao/[token]/` |
| tabelas                              | `solicitacoes_cadastro`, `chatpro_eventos`, `chatpro_diretorio`, `chatpro_sessoes`                   |
| migrations                           | `0025_sudden_forge.sql`, `0026_bumpy_red_hulk.sql` — **zero destrutivo**                             |

### Como foi provado

**31 testes ao vivo** contra o servidor local, com o banco conferido a cada passo: segredo
ausente/errado/certo, reaproveitamento de protocolo com token novo, paciente novo, contato não
identificado, intake JSON, nome de uma palavra, webhook com token errado/certo, limpeza de
conteúdo clínico, processamento do lote, vínculo conversa↔solicitação, contador de mensagens, e
os quatro estados de recusa do link.

**417 casos em 12 guardas**, verdes. Os dois do ChatPro somam **95 casos** e foram provados por
**18 sabotagens**, todas acusadas. `pnpm build` exit **0**, com as 6 rotas presentes.

### 🔴 O que NÃO foi feito, e por quê

| #   | o que                             | por quê                                                                                             |
| --- | --------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | A tela `/cadastro/{token}`        | é trabalho da **Dryelle**. O que entreguei é o contrato que ela consome                             |
| 2   | Migration aplicada no **Neon**    | só rodou no Postgres local (`localhost:5436`). Produção é decisão de deploy                         |
| 3   | Configuração do painel do ChatPro | tarefa do dono — o guia está pronto no `COMO-CONECTAR-NO-PAINEL.md`                                 |
| 4   | Cron do processador ligado        | idem. Enquanto não estiver, eventos acumulam em `pendente` — nada se perde, mas o funil não se move |
| 5   | Teste com WhatsApp real           | exige URL pública e as credenciais do passo 1                                                       |

---

## Item 19 — 🔴 CATALOGADO: PII na query string chega ao log do proxy, que não é código nosso

**Descoberto em 09/09/2026**, lendo o que o greens-corp aprendeu com paciente real
(`HERANCA-CHATPRO-DAVI-DRYELLE.md`, atualizado em 08/09/2026 — "defeito novo 2").

**O problema.** O bloco "Requisição externa" do ChatPro chama por **GET com query string**. Lá a
query carrega `name` e `number`; **na BeHemp carrega também `email`**:

```
/api/chatpro/bot-link?name=Joana+Ribeiro+Alves&email=joana@exemplo.com&sessionId=…
```

Lá, o log da aplicação mascarava (`+559****4822`) e **o log HTTP genérico gravou a URL inteira em
texto puro**, em arquivo. Viola a regra de nunca registrar telefone em log, e é dado pessoal do
art. 11 gravado em disco.

**O nosso estado, medido:** nenhum arquivo de `app/api/chatpro/` ou `lib/chatpro/` imprime
`request.url`, `nextUrl.href` ou a query — conferido por varredura, e o guarda
`chatpro-nao-confia-no-que-chega` mantém isso (o caso quebra se telefone ou e-mail aparecer em
bloco de `console.*`).

**O que continua exposto, e é fora do código:** o **nginx/proxy à frente** (DT-006/DT-008: EC2 +
PM2) grava `access_log` com a URL completa por padrão. Nenhuma linha de TypeScript impede isso.

**O perigo de mexer:** baixo em código (não há o que mudar), médio em infraestrutura — mexer em
`access_log` afeta o diagnóstico de todas as rotas, não só desta.

**As saídas, em ordem de custo:**

| #   | saída                                                        | custo              | efeito                                               |
| --- | ------------------------------------------------------------ | ------------------ | ---------------------------------------------------- |
| 1   | `access_log off;` **só** no `location /api/chatpro/bot-link` | baixo              | resolve o caso, mantém o resto                       |
| 2   | formato de log sem `$query_string` para esse location        | baixo              | idem, preservando o `path`                           |
| 3   | mudar o canal para POST                                      | **não disponível** | o bloco do painel chama por GET; não é escolha nossa |

⚠️ **Não corrigido nesta tarefa** — é infraestrutura, está fora do escopo pedido, e exige
autorização (`CLAUDE.md`, seção de escopo). **Fica catalogado com o perigo medido.**

---

## Item 20 — ✅ A tela de cadastro do link do WhatsApp, construída em 09/09/2026

**O que foi pedido:** a tela que a Dryelle ia construir passou a ser nossa. Campos definidos
pelo dono: **nome, CPF, telefone, e-mail, senha** e _"já faz tratamento?"_ com caixa de texto
quando a resposta é sim. Motivo declarado: _"imagine o paciente que chegou na Greens ou na
BeHemp e não possui receita, ele teria que fazer a nossa teleconsulta"_. O mesmo link serve os
dois negócios — _"o WhatsApp da Greens vai enviar o link que criaremos da BeHemp"_.

### O que existe no disco

| camada                                                          | arquivo                                                                     |
| --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| a tela (Server Component, valida o token antes de pintar campo) | `app/(auth)/cadastro/[token]/page.tsx`                                      |
| o formulário (client, duas etapas do Clerk)                     | `app/(auth)/cadastro/[token]/_components/formulario-de-cadastro.tsx`        |
| a action que grava                                              | `app/_actions/cadastro-por-link.ts`                                         |
| validação de CPF por dígito verificador                         | `lib/validacao/cpf.ts`                                                      |
| guarda                                                          | `__tests__/guardas/cadastro-por-link-abre-sem-conta.test.ts` — **32 casos** |
| migration                                                       | `0027_magenta_shockwave.sql` — 5 `ADD COLUMN`, **zero destrutivo**          |

**Fluxo:** dados + senha → conta no Clerk (e-mail é o login) → código de 6 dígitos → sessão →
ficha gravada → **agendar teleconsulta**.

**Visual:** aurora de três manchas em movimento lento usando **só** `--primary`, `--secondary` e
`--color-peach`; sombra em duas camadas; validação com retorno imediato por campo; medidor de
força de senha; a caixa de texto do tratamento cresce por `grid-rows` quando a resposta é "sim".
Sem `framer-motion` (proibição 3) e sem cor nova. O CSS da aurora fica **no arquivo da página**,
via `<style precedence>` do React 19 — decoração de uma tela não engorda o design system global.
Respeita `prefers-reduced-motion`.

---

## Item 21 — 🔴 CORRIGIDO: o middleware bloquearia a integração inteira em produção

**Descoberto em 09/09/2026**, ao construir a tela. É o defeito mais grave desta frente, e o
mais fácil de não ver.

**O problema.** O middleware do Clerk protege tudo por padrão, e seu matcher declara
_"sempre roda para API routes"_. Nem `/cadastro/{token}` nem **`/api/chatpro/*`** estavam na
lista de rotas públicas (`middleware.ts:16-45`).

| quem                  | o que aconteceria em produção                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| o paciente            | clica no link do WhatsApp → cai no **login** → para se cadastrar, precisaria já estar cadastrado |
| o servidor do ChatPro | chama `/bot-link` → recebe **redirect** → o bot registra falha e transfere para a triagem humana |
| quem depurasse        | **não veria nada no log da aplicação** — a requisição nunca chega à rota                         |

🔴 **E os 31 testes ao vivo passaram verdes.** O `.env` de desenvolvimento está **sem as chaves
do Clerk** (`CLERK_SECRET_KEY` e `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` ausentes, medido), e sem
elas o middleware não bloqueia nada. Nenhuma execução local acusaria: foi preciso **ler** o
middleware.

**A regra que sai daí:** _teste que passa por ausência de configuração não testou nada._ Mesma
família do que o greens-corp viveu — 72 horas de log vazio que pareciam "não configurado" e
eram "o fluxo nunca chegou".

**Corrigido:** `'/cadastro(.*)'` e `'/api/chatpro(.*)'` na lista pública, cada um com o motivo
escrito ao lado. Não ficam desprotegidos — o token de 64 hex é a credencial do `/cadastro`, e as
rotas do ChatPro têm autenticação própria (segredo em tempo constante, token no caminho,
`CRON_SECRET`). Provado por sabotagem, com um caso de **CONTROLE** que fica vermelho se alguém
"resolver" liberando `/medico`, `/admin` ou `/paciente`.

⚠️ **O que isto sugere e NÃO foi feito:** varrer as demais rotas de API do repositório
procurando outras que dependam do middleware sem estar na lista — ou que estejam na lista sem
precisar. É trabalho próprio, fora do escopo desta tarefa, e exige autorização.

---

## Item 22 — 📋 Handoff do cadastro da Greens → BeHemp (ADR-0016)

**Decidido em 09/09/2026**, com rodadas de pesquisa antes: os dados vão por back-channel
assinado e só o token viaja com o paciente. Decisões, rejeitados e fontes em
[ADR-0016](adr/ADR-0016-o-cadastro-da-greens-chega-por-back-channel-e-so-o-token-viaja.md).
Espelho do lado da Greens: `greens-corp-backend/docs/adr/ADR-0027`.

### 🔴 Bloqueado por (não começar antes)

| #   | o quê                                                                                                                                           | dono    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | **A atualização do formulário da Greens** — a Dryelle vai subir. A lista de campos de 09/09 precisa ser reconferida antes de congelar o payload | Dryelle |
| 2   | O **aceite** do paciente no fluxo do intake (base legal da transferência) — já está sendo tratado lá                                            | Dryelle |
| 3   | O segredo compartilhado `GREENS_HANDOFF_SECRET` nos dois `.env`                                                                                 | dono    |

### Entregáveis — lado BeHemp (quem recebe)

| #   | entregável                                                                                                                                  | aceite                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | `lib/parceiros/assinatura.ts` — HMAC-SHA256 sobre `id + timestamp + corpo`, comparação em tempo constante, janela de **300 s**              | recusa assinatura errada, corpo alterado e carimbo fora da janela   |
| 2   | `POST /api/parceiros/greens/cadastro` — valida, cria `solicitacoes_cadastro` com `origem = 'greens_handoff'`, devolve `{ token, expiraEm }` | id repetido devolve o **mesmo** token, não cria segunda solicitação |
| 3   | Enum `solicitacaoCadastroOrigemEnum` + `'greens_handoff'`, e as colunas do manifesto de documentos                                          | migration aditiva; nenhuma coluna obrigatória sem default           |
| 4   | A rota do middleware liberada (`/api/parceiros(.*)`)                                                                                        | **não esquecer** — foi o `Item 21`, e o sintoma é log vazio         |
| 5   | Tela `/continuar/{token}` — dados preenchidos e editáveis, senha, código de 6 dígitos, `clerk-captcha`                                      | e-mail que já tem conta vai para o login (D-07)                     |
| 6   | Pendências dos 5 documentos visíveis e **não bloqueantes**                                                                                  | conclui o cadastro com zero documento                               |
| 7   | Encaminhar para `/paciente/anvisa` (a procuração **já existe**, não se cria)                                                                | chega na procuração logado                                          |
| 8   | Botão de volta ao **login da Greens** ao fim da procuração                                                                                  |                                                                     |
| 9   | Os 4 guardas do §4 da ADR                                                                                                                   | nascem vermelhos, provados por sabotagem                            |

### O que fica de fora, declarado

**A cópia dos arquivos** (fase 2). Fase 1 move dados de texto e o manifesto. Copiar blob de
saúde entre empresas exige URL assinada na origem, validação de MIME e tamanho no destino, store
**privado** e prazo de retenção — e o `Item 6` registra que este repositório já tem 10+ uploads em
store público, defeito conhecido e não corrigido. Código novo não repete isso.

---

## Item 23 — 📋 As três portas de entrada, e o caminho de volta (ADR-0016, 0017, 0018)

**Decidido em 09/09/2026.** Três formas de o mesmo paciente chegar, um só corredor depois — e,
para quem veio da Greens, um **retorno automático** com o que ficou pronto aqui.

```
              PACIENTE SEM RECEITA NOSSA / SEM ANVISA
                              │
     ┌────────────────────────┼────────────────────────┐
  formulário               WhatsApp                 WhatsApp
  da GREENS                da BEHEMP                da GREENS
     │ ADR-0016               │ ADR-0017              │ ADR-0018
     └────────────────────────┼────────────────────────┘
                              ▼
       solicitacoes_cadastro · mesma tela · mesma procuração
                              ▼
                  receita emitida / ANVISA concluída
                              │
                              ▼  (só para quem veio da Greens)
              ADR-0016 D-09 · retorno automático ──► Greens
```

### Ordem de execução, e o porquê dela

| #   | item                                               | por que nesta posição                                                     |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | **ADR-0016 ida** — recebe o cadastro da Greens     | é o único fluxo cujas duas pontas estão paradas hoje                      |
| 2   | **ADR-0016 D-09 volta** — devolve receita e ANVISA | a ADR-0018 **depende** deste canal; construí-lo aqui evita construir dois |
| 3   | **ADR-0017** — gatilho do bot da BeHemp            | a mecânica já está pronta (ADR-0015); falta só a regra de quando ofertar  |
| 4   | **ADR-0018** — bot da Greens com link da BeHemp    | precisa do canal de volta (2) e da regra de gatilho (3)                   |

🔴 **O item 2 antes do 4 é o que evita retrabalho.** Se a ADR-0018 fosse implementada primeiro,
ela criaria seu próprio caminho de volta — e teríamos duas rotas fazendo a mesma coisa, que é o
R-05 daquela ADR.

### Bloqueios, por item

| item          | bloqueado por                                                                    | dono           |
| ------------- | -------------------------------------------------------------------------------- | -------------- |
| ADR-0016      | atualização do formulário da Greens · aceite no intake · segredo nos dois `.env` | Dryelle / dono |
| ADR-0016 D-09 | segredo **do sentido de volta** (diferente do de ida)                            | dono           |
| ADR-0017      | nada técnico — a mecânica está no PR #36                                         | —              |
| ADR-0018      | o canal de volta pronto · credenciais da conta de ChatPro **da Greens**          | nós / dono     |

### 🔴 Duas regras que valem nas três, e não são técnicas

**1. Quem confere a receita é gente.** Manual, no painel da BeHemp, depois do envio de tudo
(ADR-0017 D-02). O dono declarou que virá IA ou orquestração — e quando vier, entra como decisão
própria, não como descoberta.

**2. A tela nunca diz que a receita é inválida.** A regra real é "só serve receita do nosso
receituário", e ela é **interna**. Receita de outro médico é **legalmente válida**: uma tela que
diga o contrário faz afirmação falsa sobre o ato de outro profissional. O que a tela diz — e é
verdade — é _"em análise"_ e _"você precisa de uma avaliação com um médico parceiro"_. Vale **nos
dois sistemas**, e pesa mais na Greens, que fala com o paciente primeiro.

### O que fica de fora das três, declarado

**Os arquivos** (fase 2, nas duas direções): manifesto agora, blob depois.
**A automação da conferência** (ADR-0017 §5): declarada como futura, com dono e sem data.

---

## Item 24 — ✅ Lado BeHemp da ADR-0016 (ida), implementado em 09/09/2026

**O que foi feito:** a ponta que **recebe** o cadastro que vem da Greens. A ponta que envia é
trabalho de lá (ADR-0027), e o caminho de volta (D-09) é item próprio.

### O contrato, que estava escondido no schema da Greens

O `§6.1` bloqueou esta implementação até o `CONTRATO §4/§6` ser cruzado. Ele **não existe como
documento** — é citado no schema e nunca foi escrito. O schema é a fonte, e especifica:

| campo (lá)         | o que fixa                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------ |
| `behempReferralId` | `VarChar(64)`, **nosso** id · _"é por ele que o webhook da Behemp localiza a solicitação"_ |
| — não é `@unique`  | deliberado: unique faria reentrega de webhook virar erro 500                               |
| `behempJourney`    | `!= NONE` → **Mercado Pago com desconto collab**; `NONE` → Cannect                         |

🔴 **Isso muda o peso do handoff:** ele não decide só um cadastro — decide **o gateway e o preço
de uma compra**. A idempotência deixou de ser higiene e virou requisito de dinheiro.

### O que existe no disco

| camada                         | arquivo                                                                          |
| ------------------------------ | -------------------------------------------------------------------------------- |
| HMAC + janela de 300 s         | `lib/parceiros/assinatura.ts`                                                    |
| recebe, idempotente por evento | `lib/parceiros/handoff.ts`                                                       |
| rota                           | `app/api/parceiros/greens/cadastro/route.ts`                                     |
| rota liberada do Clerk         | `middleware.ts` — `'/api/parceiros(.*)'`                                         |
| campos                         | `parceiro`, `evento_do_parceiro`, `pedido_do_parceiro` + origem `greens_handoff` |
| migration                      | `0028_plain_pretty_boy.sql` — **zero destrutivo**                                |
| guarda                         | `handoff-do-parceiro-e-assinado-e-idempotente` — **29 casos**, 13 sabotagens     |

### Como foi provado, ao vivo

| #   | teste                                                        | resultado                                           |
| --- | ------------------------------------------------------------ | --------------------------------------------------- |
| 1–3 | sem assinatura · assinatura errada · fora da janela (10 min) | **401** nos três                                    |
| 4   | assinatura correta                                           | **200** com `referralId` (cuid2, cabe nos 64)       |
| 5   | 🔴 **reenvio do mesmo evento**                               | **mesmo** `referralId` e protocolo, `reenvio: true` |
| 6   | corpo adulterado com assinatura do original                  | **401**                                             |
| 7   | `eventoId` do corpo divergindo do cabeçalho                  | **422 EVENTO_DIVERGENTE**                           |
| 8   | sem e-mail nem telefone                                      | **422 CONTATO_INSUFICIENTE**                        |
| 9   | banco após o reenvio                                         | **1 linha**, não duas                               |
| 10  | o paciente abre o link                                       | nome, e-mail e telefone da Greens pré-preenchidos   |

### 🔴 Dois defeitos que o próprio processo pegou

**1. O corpo sobrescrevia o `eventoId` do cabeçalho.** O `...analise.data` vinha **depois** do
`eventoId` — o oposto do que o comentário ao lado afirmava. O `tsc` acusou (`TS2783`).
**Corrigido eliminando a classe:** campo a campo, sem spread. Trocar a ordem resolveria o caso de
hoje; proibir o spread impede que um campo novo no corpo, amanhã, alcance parâmetro que ninguém
listou de propósito. O guarda cobra a ausência do spread, não a ordem.

**2. O container do Postgres estava parado** e o `db:migrate` falhava com erro que não diz isso.
Já catalogado antes; repetiu.

### O que fica de fora, declarado

| #   | o quê                                         | por quê                          |
| --- | --------------------------------------------- | -------------------------------- |
| 1   | O **caminho de volta** (ADR-0016 D-09)        | item próprio; precede a ADR-0018 |
| 2   | A ponta que **envia**, na Greens              | ADR-0027, trabalho de lá         |
| 3   | Cópia dos 5 arquivos                          | fase 2, nas duas direções        |
| 4   | `PARCEIRO_GREENS_SEGREDO_ENTRADA` em produção | segue com o dono                 |

---

## Item 25 — ✅ O caminho de volta (ADR-0016 D-09), implementado em 09/09/2026

A BeHemp avisa a Greens quando receita ou ANVISA ficam prontas, para o pedido do paciente
destravar lá **sem ninguém digitar nada**. É a segunda direção do mesmo par.

### A decisão de desenho que sustenta tudo: fila, não `fetch`

O aviso nasce no instante em que o médico assina. Um `fetch` direto ali tem **dois** modos de
falha, os dois silenciosos:

| se…                                   | o que aconteceria                                                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| a Greens estiver fora naquele segundo | o aviso **se perde para sempre** — e ninguém descobre: o médico viu a receita ser assinada, o sistema não reclamou, e o pedido nunca destrava lá |
| a Greens estiver **lenta**            | a tela do médico **trava** esperando um parceiro comercial responder                                                                             |

Gravando primeiro, indisponibilidade vira **atraso**, não perda. E `notificarParceiro` **nunca
lança**: quem a chama está no meio de um ato clínico, e falhar em avisar não pode impedir alguém
de prescrever.

### O que existe

| camada                      | arquivo                                                          |
| --------------------------- | ---------------------------------------------------------------- |
| fila durável                | `db/schema/parceiro-eventos-saida.ts`                            |
| enfileira (nunca lança)     | `lib/parceiros/notificar.ts`                                     |
| entrega com retry e backoff | `lib/parceiros/enviador.ts`                                      |
| cron                        | `app/api/parceiros/enviar/route.ts`                              |
| migration                   | `0030_lame_madripoor.sql` — **zero destrutivo**                  |
| guarda                      | `o-aviso-ao-parceiro-nao-se-perde` — **19 casos**, 13 sabotagens |

### 🔴 Uma diferença de índice que parece inconsistência e não é

| fila                                  | índice    | por quê                                                                                        |
| ------------------------------------- | --------- | ---------------------------------------------------------------------------------------------- |
| **entrada** (`solicitacoes_cadastro`) | **comum** | o remetente é o ChatPro/Greens; a reentrega deles é normal e precisa ser absorvida em silêncio |
| **saída** (`parceiro_eventos_saida`)  | **único** | quem cria somos **nós**; criar duas vezes seria bug nosso — e bug nosso deve estourar          |

### Provado ao vivo, contra um servidor que faz o papel da Greens

| #   | cenário                 | resultado                                                     |
| --- | ----------------------- | ------------------------------------------------------------- |
| 1   | entrega normal          | **200**, e a assinatura **conferiu do outro lado**            |
| 2   | Greens fora do ar (500) | reagendado, volta a `pendente`, **não se perde**              |
| 3   | cron antes da hora      | **0 reivindicados** — respeitou o backoff                     |
| 4   | Greens volta            | entregue com o **mesmo id do evento**                         |
| 5   | resposta 400            | **`falhou` na 1ª tentativa** — 4xx não se conserta insistindo |
| 6   | mesmo fato duas vezes   | `duplicate key`, **1 aviso** no banco                         |

⚠️ **O que NÃO foi testado:** a rota real da Greens — ela ainda não existe. O teste foi contra
servidor falso, que prova assinatura, retry, backoff e idempotência, **não** a integração real.
Isso só é possível depois que o lado deles subir.

### O que falta para funcionar de verdade

| #   | pendência                                                                                             | dono             |
| --- | ----------------------------------------------------------------------------------------------------- | ---------------- |
| 1   | A rota `POST /api/parceiros/behemp/atualizacao` na Greens                                             | Claude da Greens |
| 2   | `PARCEIRO_GREENS_SEGREDO_SAIDA` e `PARCEIRO_GREENS_API_URL` no `.env`                                 | dono             |
| 3   | Cron de `/api/parceiros/enviar`                                                                       | dono/deploy      |
| 4   | 🔴 **O GATILHO** — chamar `notificarParceiro()` quando a receita é assinada e quando a ANVISA conclui | ver abaixo       |

### 🔴 O gatilho NÃO foi ligado, e isso é deliberado

`notificarParceiro()` existe e funciona, mas **nada a chama ainda**. Ligá-la exige tocar o fluxo
de receituário (`lib/receituario/`) e o de ANVISA — as duas **áreas protegidas pelo hook
`escopo-autorizado`**, as duas em produção, e o `CLAUDE.md` é explícito: achado ou mudança fora do
escopo se **cataloga e pede autorização**, não se faz de passagem.

**O custo de mexer, medido:** dois pontos de chamada, uma linha cada, ambos em código clínico que
já roda. **O custo de deixar:** a fila existe e fica vazia — nenhum aviso é gerado.

**Peço autorização para ligar os dois gatilhos como trabalho próprio, em commit próprio.**

---

## Item 26 — 🔴 CATALOGADO: `users.telefone` é texto livre, e isso impede casar paciente por telefone

**Descoberto em 09/09/2026**, ao investigar se o bot da BeHemp poderia reconhecer sozinho um
paciente que já existe.

### O diagnóstico

Quatro caminhos gravam `users.telefone`. **Nenhum normaliza:**

| ponto                                           | `caminho:linha`                         | formato que grava                                                                            |
| ----------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------- |
| webhook do Clerk — **todo cadastro passa aqui** | `app/api/webhooks/clerk/route.ts:147`   | `phone_numbers[0]` (E.164) **ou** `unsafe_metadata.phone` — **misto**                        |
| médico cadastrando à mão                        | `app/(medico)/_actions/pacientes.ts:17` | `z.string().optional()` — **texto livre, zero validação**                                    |
| admin editando                                  | `app/(admin)/_actions/usuarios.ts:145`  | regex `^[\d\s()\-+]{8,20}$` — aceita `(62) 99999-9999`, `62999999999` **e** `+5562999999999` |
| cadastro por link (novo)                        | `app/_actions/cadastro-por-link.ts`     | ✅ E.164 — **o único que normaliza**                                                         |

O campo é **texto livre na prática**. Comparar por igualdade de string falha na maioria dos
casos — e falha **em silêncio**: quem procura conclui "não existe" em vez de "não sei dizer".

### O perigo de mexer, medido

|                                      |                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| pontos de escrita                    | **4**                                                                                |
| está em produção?                    | **sim** — os quatro                                                                  |
| existe teste que prove antes/depois? | **não**                                                                              |
| o que quebra ao normalizar           | nada em leitura (é só exibição hoje); a migração de dados é o risco real             |
| proporção de dados sujos             | 🔴 **NÃO MEDIDA** — o banco local tem 1 paciente e 0 telefones. Só produção responde |

### O custo de deixar

Enquanto isso vale, **nenhum lugar do sistema consegue reconhecer um paciente pelo telefone** —
não é limitação do bot, é do campo. Vale para o ChatPro, para o atendimento e para qualquer
integração futura que receba um número de fora.

### Duas correções, e elas são independentes

1. **Normalizar na comparação** (barato, sem migração): comparar só os dígitos. Resolve
   formatação e DDI; **não resolve** o celular antigo sem o 9.
2. **Normalizar o campo** (migração de dados): resolve de verdade. Exige backup, script
   idempotente, e medir antes quantas linhas mudam.

⚠️ **Nenhuma das duas foi feita.** A (1) entra na ADR-0017 como auxílio de busca — nunca como
decisão. A (2) precisa de autorização e é trabalho próprio.

---

## Item 27 — ✅ ADR-0017 implementada: a triagem do bot da BeHemp

**O que faltava:** a ADR-0015 resolveu **como** o link nasce; faltava **quando** oferecê-lo.

### O que existe

| camada                                   | arquivo                                                      |
| ---------------------------------------- | ------------------------------------------------------------ |
| o gatilho (consulta receita e ANVISA)    | `lib/chatpro/triagem.ts`                                     |
| interpreta o que o paciente escreveu     | `lib/chatpro/resposta-do-paciente.ts`                        |
| os textos, e o que eles nunca dizem      | `lib/chatpro/texto-da-triagem.ts`                            |
| a rota (`text/plain`, como o `bot-link`) | `app/api/chatpro/triagem/route.ts`                           |
| guarda                                   | `a-triagem-roteia-e-nao-julga` — **44 casos**, 14 sabotagens |

### 🔴 O defeito que só apareceu no teste ao vivo

A primeira versão interpretava a resposta com `/^(sim|nao|não|n|s)$/` — âncora total,
palavra exata. Testei com as respostas que uma pessoa dá de verdade:

| o paciente escreve     | a 1ª versão entendia | consequência                                     |
| ---------------------- | -------------------- | ------------------------------------------------ |
| `"não"`                | ✅ não tem           | ok                                               |
| **`"Não, ainda não"`** | ❌ **"não sei"**     | 🔴 **o link NÃO era oferecido a quem precisava** |
| `"Ainda não tenho"`    | ❌ "não sei"         | idem                                             |
| `"tenho mas venceu"`   | ❌ "tem"             | 🔴 mandado para o caminho errado                 |

**O paciente não escolhe entre opções — ele conversa.** A correção lê negação e afirmação
**no texto**, e trata menção a vencimento como não-ter: _"tenho, mas venceu"_ é afirmação
seguida de uma informação que a anula.

⚠️ **A negação é procurada ANTES da afirmação**, e a ordem não é detalhe: **"não tenho"
contém "tenho"**. Na ordem inversa, toda negação viraria afirmação.

### O que a tela nunca diz, e a única exceção

| ❌ nunca                        | ✅ e é verdade                                         |
| ------------------------------- | ------------------------------------------------------ |
| "sua receita é inválida"        | "você precisa de uma avaliação com um médico parceiro" |
| "não aceitamos receita de fora" | "seu documento está em análise"                        |

🔴 **A exceção é o vencimento**, e ela é nomeada: _"sua receita está vencida — receitas de
canabidiol valem 30 dias"_. É fato objetivo, regra pública (RDC 1.015/2026), e **não julga
quem a emitiu**. Esconder tiraria do paciente algo que ele confere sozinho no documento.

O guarda varre o **arquivo de textos**, não só o resultado das funções — um texto novo,
amanhã, também é alcançado.

### Provado ao vivo

| cenário                                   | resultado                                |
| ----------------------------------------- | ---------------------------------------- |
| receita vigente + ANVISA                  | não oferece · `tem_tudo`                 |
| receita **vencida**                       | oferece · **e diz que venceu**           |
| receita ok, sem ANVISA                    | oferece · _"nós cuidamos dela com você"_ |
| só **rascunho** de receita                | oferece — rascunho não é documento       |
| paciente diz "não tenho" contra a base    | **oferece** — a resposta dele vence      |
| a palavra "inválida" em qualquer resposta | **0 ocorrências**                        |

E a busca por dígitos casou os **quatro** formatos gravados: `(62) 98111-1111`,
`+5562982222222`, `62983333333` e `(62) 9 8444-4444`.

### O que fica de fora

**A configuração do fluxo no painel** — quem chama esta rota e o que faz com o cabeçalho
`x-triagem-motivo` é decisão do painel, não do código. Guia para o dono no
`docs/chatpro/COMO-CONECTAR-NO-PAINEL.md`.

## Item 28 — ✅ CORRIGIDO: o deploy passava verde e produção servia um build antigo

**Descoberto em 10/09/2026.** Entre 14/08 e 10/09 **nenhum deploy chegou ao processo em
produção**. O Actions reportava sucesso, o rsync entregava os arquivos, o PM2 reiniciava — e
o site continuava servindo um build anterior. Não havia erro em log nenhum.

### O diagnóstico

Três defeitos independentes cooperavam. **Cada um sozinho já bastava para esconder o problema.**

| #   | defeito                                                        | efeito                                                    |
| --- | -------------------------------------------------------------- | --------------------------------------------------------- |
| 1   | `package.json:7` — o script `build` terminava em `\|\| true`   | build quebrado devolvia **exit 0**                        |
| 2   | `deploy.yml` — `pm2 restart … \|\| pm2 start …`                | `restart` **reusa o caminho gravado** e não relê o script |
| 3   | nenhum passo conferia se produção passou a servir o build novo | "verde" não significava nada                              |

O (2) é a causa direta, e é comportamento documentado do PM2 ([Unitech/pm2#3054](https://github.com/Unitech/pm2/issues/3054)):
trocar o `script` e reiniciar mantém o arquivo antigo em execução. `--update-env`, `reload` e
`startOrReload` **não** corrigem — só `delete` + `start`.

**Medições que fecharam o caso:**

- produção redirecionava para `/entrar` até uma rota **inexistente** → o middleware em
  execução não era o do build entregue
- um chunk do build da vez respondia **404** em produção → quem serve os estáticos é o
  processo, e o processo era outro
- a Dryelle mediu no servidor, em 09/09: `.next/standalone/server.js` com **mtime de 14/08**
- o `git pull` + `pnpm build` manual dela **funcionou** justamente por rodar no diretório de
  onde o PM2 executa — o que confirma que rsync e PM2 estavam em diretórios diferentes

### 🔴 O risco que a correção precisou desarmar antes

`pm2 delete` não apaga arquivo, log nem código — mas **descarta o ambiente vivo do processo**.
E medimos: o deploy escrevia **12** variáveis no `.env`, enquanto `lib/env.ts` declara **61**.
As outras 49 — `CLERK_SECRET_KEY`, `BREVO_API_KEY`, `PUSHER_SECRET`, `DOCUSIGN_*` — nunca
foram escritas em arquivo nenhum: viviam só na memória do processo, herdadas do primeiro
`pm2 start` manual (o deploy #37 já tinha revelado que **não existe `.env` no servidor**).

Reproduzido localmente: **sem `CLERK_SECRET_KEY`, toda rota responde 500, inclusive as
públicas.** Um `pm2 delete` sem preservar teria derrubado o site inteiro.

### Como foi corrigido

1. `package.json` — o `build` volta a propagar falha. Provado: com o `next.config.ts`
   quebrado, antes `exit 0`, agora `exit 1`.
2. `scripts/preservar-ambiente-do-pm2.mjs` — copia para o `.env` as variáveis que só existem
   no processo, **restrito às chaves que `lib/env.ts` declara** (nunca `PATH`/`HOME`), com
   retrato do PM2 salvo antes e **nenhum valor impresso** — a saída vai para log público.
3. `scripts/pm2-do-app.mjs` — lê o caminho que o processo usa, para o deploy **comparar em vez
   de supor**.
4. `deploy.yml` — imprime o diagnóstico, preserva o ambiente, recusa mexer no processo se o
   `server.js` novo não chegou, e recria (`delete` + `start`) **apenas quando o caminho
   diverge**; caminho igual continua sendo `restart`, sem indisponibilidade.
5. `deploy.yml` — **portão pós-deploy**: baixa da URL pública um chunk com hash deste build e
   falha o job se não vier 200 em 100 s. É a única afirmação do workflow que não depende de
   nenhum passo ter "dado certo".
6. `next.config.ts` — `outputFileTracingRoot: path.join(__dirname)`, para o build local não
   divergir do build do CI. **Não era a causa** (o log do deploy #40 mostra o `server.js` no
   lugar certo), mas foi a divergência que me fez apontar a causa errada.

### O guarda

`__tests__/guardas/o-deploy-entrega-o-que-buildou.test.ts` — **21 casos**, provados por
**9 sabotagens**. Uma delas achou um defeito no próprio guarda: ele checava a _presença_ de
`exit 1` no portão, e o passo tem dois — trocar só o final por um `echo` deixava o portão
decorativo e o teste verde. Corrigido para medir o caminho de falha, não a presença.

### O que ficou de fora

- **`/api/versao` com o SHA do commit**, conferido pelo portão em vez do hash do chunk. É mais
  direto e não depende de heurística. Fora do escopo desta correção — o chunk já prova o que
  precisa hoje, e a rota nova exigiria mexer no middleware.
- **Unificar os diretórios do rsync e do PM2 no servidor.** A correção faz o deploy convergir
  sozinho para o diretório do rsync, mas o diretório antigo continua existindo na máquina.
  Limpeza é trabalho próprio, com acesso ao servidor.
- **IP Elástico na EC2** (recomendação da Dryelle). Não é causa deste incidente; evita que o
  `SERVER_IP` fique obsoleto num reboot.

## Item 29 — 🟡 PARCIAL (11/09/2026): e-mail e sistema feitos; WhatsApp bloqueado por falta de doc

**Adiado pelo dono em 10/09/2026**, ao descrever o fluxo 1 da Greens: _"isso nós fazemos depois,
deixe anotado como pendência"_. O passo 7 do fluxo dele pede _"recebe notificação email, celular
e no sistema"_.

### O diagnóstico

`app/api/anvisa/atualizar-status/route.ts:63-72` notifica **só pelo Pusher**:

```ts
await pusher.trigger(`private-user-${atualizado.pacienteId}`, 'anvisa:status-atualizado', {…});
```

Dentro do sistema funciona. Fora dele, o paciente não fica sabendo — e o paciente que veio da
Greens **não tem motivo para abrir a nossa plataforma de novo**: ele entrou para resolver a
autorização e saiu.

### O que existe e não está ligado neste ponto

| canal    | peça no projeto                     | ligada aqui? |
| -------- | ----------------------------------- | ------------ |
| e-mail   | Brevo — `lib/email/notificacoes.ts` | ❌           |
| WhatsApp | ChatPro — `lib/chatpro/cliente.ts`  | ❌           |
| sistema  | Pusher — `private-user-<id>`        | ✅           |

### A decisão de conteúdo já está tomada, e é o que destrava

A ADR-0017 fixou a regra: **fato que o paciente sente sai automático; texto que alguém compõe
passa por aprovação.** _"Sua autorização da ANVISA foi aprovada"_ é fato — sai automático, sem
fila de aprovação.

⚠️ E o que **não** pode ir junto: número do processo, nome do medicamento, ou qualquer coisa que
transforme a notificação num documento clínico trafegando por WhatsApp. O aviso diz que ficou
pronto e onde ver — o conteúdo fica na plataforma, com controle de acesso. É a mesma regra que
o guarda `o-aviso-ao-parceiro-nao-se-perde` já aplica ao aviso que vai para a Greens.

### O guarda que vai junto

Quando for implementado: o aviso ao paciente não pode carregar dado clínico, e a falha de um
canal não pode impedir os outros — nem derrubar a atualização de status, que é o fato que
importa.

### ✅ O que foi feito em 11/09/2026

`lib/anvisa/avisar-aprovacao.ts`, chamado por `app/api/anvisa/atualizar-status/route.ts` quando
o status vira `aprovado`:

| canal                  | estado                                     | nota                                                          |
| ---------------------- | ------------------------------------------ | ------------------------------------------------------------- |
| **no sistema**         | ✅ linha em `notificacoes`, com `linkAcao` | vem **primeiro**: é o único canal que não depende de terceiro |
| **e-mail**             | ✅ Brevo, `enviarEmailAnvisaAprovada`      | leva o número do processo; **nada clínico**                   |
| **celular (WhatsApp)** | 🔴 **não**                                 | ver abaixo                                                    |

O Pusher continua — ele é o canal **imediato**, não o substituto. O defeito era ele ser o
**único**: tempo real significa que quem não estava com a aba aberta nunca soube, e a
autorização demora semanas.

### 🔴 Item 29b — por que o WhatsApp NÃO entrou

**Não é esquecimento, é ausência de fonte.** `lib/chatpro/cliente.ts` só **busca** contato e
sessão — não tem método de envio. Procurei o endpoint de envio ativo nos **dois** repositórios
em 11/09/2026: a única ocorrência é o valor de enum `v5_send_message` em
`greens-corp-backend/src/modules/chatpro/types/chatpro.ts`, **sem nenhuma implementação**. Nem
o lado da Greens envia mensagem ativa.

Deduzir o path daria um envio que **falha em silêncio** — pior que canal ausente, porque
alguém passa a contar com ele.

**O que destrava:** a documentação do ChatPro para envio ativo, ou o endpoint confirmado pelo
painel. Há caso de guarda (`a-anvisa-aprovada-avisa-o-paciente`) que fica **vermelho** se
alguém acrescentar envio ao cliente sem essa conversa acontecer.

## Item 30 — 🟡 O store privado começou pelos caminhos novos (Item 6 segue aberto)

**Decisão do dono em 10/09/2026:** _"então vamos colocar no nosso store privado"_.

### O que mudou

Os **dois caminhos criados nesta sessão** passaram a gravar `access: 'private'`:

| caminho                                  | arquivo                                   |
| ---------------------------------------- | ----------------------------------------- |
| anexo enviado pelo paciente no cadastro  | `lib/documentos/anexo-do-cadastro.ts`     |
| documento que vem do parceiro no handoff | `lib/parceiros/documentos-do-parceiro.ts` |

E nasceu a porta de entrega: **`/api/documentos/<id>/arquivo`** — autentica, confere **escopo
de objeto** (o paciente, o médico DELE, ou admin), audita a leitura, e nunca entra em cache
compartilhado.

⚠️ **Ela serve os dois mundos de propósito:** blob antigo (público) é redirecionado; blob novo
é entregue por streaming autenticado. Assim a tela usa **um endereço** para qualquer documento,
e terminar o Item 6 não vai exigir tocar em tela nenhuma.

### ✅ 11/09/2026 — o grupo da tabela `documentos` foi fechado

Decisão do dono: _"AGORA É O MOMENTO de ajustarmos isso"_.

**Quatro pontos** passaram a gravar privado, e as **três telas** que os abriam passaram a
apontar para a rota autenticada — a tela ANTES do upload, que é a ordem que impede o documento
de sumir:

| ponto                                      | tela que o abre                |
| ------------------------------------------ | ------------------------------ |
| `app/_actions/documentos.ts`               | `tab-documentos.tsx` (médico)  |
| `app/_actions/documentos-paciente.ts`      | `paciente/perfil/page.tsx`     |
| `app/_actions/documentos-paciente-self.ts` | `paciente/documentos/page.tsx` |
| `app/api/upload-documento/route.ts`        | as três acima                  |

### 🔴 O que ainda falta, e por que cada um é um caso diferente

**Sete pontos continuam gravando público, e eles NÃO são iguais entre si:**

| grupo                      | pontos                                                              | por que ainda não                                                                                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **ANVISA** (jsonb, sem id) | `anvisa/upload-documento`, `anvisa/procuracao`, `webhooks/docusign` | 🔴 os documentos vivem num **jsonb dentro de `autorizacoes_anvisa`**, não na tabela `documentos` — **não têm id**, e a rota atual endereça por id. Precisa de rota própria, ou de migrar para a tabela |
| **exames**                 | `_actions/exames.ts`, `api/upload-exame`                            | tabela própria (`exames`) — mesma solução, rota própria                                                                                                                                                |
| **chat**                   | `_actions/chat.ts`                                                  | anexo de conversa; escopo é o grupo, não o paciente                                                                                                                                                    |
| **avatar**                 | `api/upload-avatar`                                                 | ⚠️ **decisão: fica público.** Foto de perfil não é dado de saúde, e privá-la só acrescentaria uma rota autenticada em todo carregamento de tela                                                        |
| **relatório**              | `api/upload-relatorio`                                              | verificar o que contém antes de decidir                                                                                                                                                                |

⚠️ **O caso da ANVISA é o mais importante e o mais caro** — é onde está a procuração assinada.
Ele exige decidir se aqueles documentos migram para a tabela `documentos` (o que resolveria de
uma vez, e daria id a eles) ou se ganham rota própria endereçada por autorização + tipo.

**Antes eram 12; são 7.** Eles não foram tocados: mexer em 14 lugares
no meio de outra tarefa é exatamente o que o `CLAUDE.md` proíbe, e cada um tem uma tela que lê
`urlBlob` direto.

```
app/_actions/documentos.ts · documentos-paciente.ts · documentos-paciente-self.ts
app/_actions/exames.ts · chat.ts
app/api/upload-documento · upload-exame · upload-avatar · upload-relatorio
app/api/anvisa/upload-documento · anvisa/procuracao
lib/integrations/blob/index.ts
```

**O perigo de mexer, medido:** cada ponto tem uma tela que usa `urlBlob` como `href`. Trocar o
upload sem trocar a tela deixa o documento invisível — e invisível é pior que público, porque
some sem avisar.

**A ordem que funciona**, e é a mesma que esta sessão usou: a rota de entrega primeiro (feita),
depois cada tela passando a apontar para ela, e **só então** o upload virando privado. Um ponto
por vez, com a tela junto.

⚠️ E os arquivos **já gravados** continuam públicos. Torná-los privados exige copiá-los, o que
é migração de dado — trabalho próprio, com o histórico preservado (proibição 4).

## Item 31 — 🟡 O limite de requisição é por PROCESSO, não compartilhado

**Criado junto com a defesa**, em 10/09/2026, e registrado no mesmo movimento porque é o tipo
de limitação que some da memória de quem não a escreveu.

`lib/seguranca/limite-de-requisicao.ts` guarda o contador **na memória do processo**. Isso
funciona hoje porque há **uma instância** (EC2 + PM2 — DT-006/DT-008).

| cenário              | efeito                                             |
| -------------------- | -------------------------------------------------- |
| uma instância (hoje) | o limite vale o que diz                            |
| duas instâncias      | cada uma conta metade — o limite efetivo **dobra** |
| reinício do processo | o contador **zera**                                |

**Quando trocar:** no dia em que houver mais de uma instância, ou um balanceador. A troca é
substituir a função `consumir` por uma sobre store compartilhado (Redis, ou a própria tabela
com `FOR UPDATE SKIP LOCKED`, que o projeto já usa nas filas). **Quem chama não muda** — foi
desenhado assim de propósito.

⚠️ **Não é motivo para adiar nada.** Sem limite nenhum, o custo de cada tentativa de força
bruta era do servidor. Com este, o atacante precisa de muitas origens para o mesmo efeito.
Melhor que nada por uma margem enorme, pior que compartilhado por uma margem conhecida.

### Como a auditoria chegou aqui

Contra o **OWASP API Security Top 10 (2023)**, medido em 10/09/2026:

| risco                           | estado                                                 |
| ------------------------------- | ------------------------------------------------------ |
| API1 — BOLA                     | ✅ escopo de objeto em 9 pontos                        |
| API2 — autenticação quebrada    | ✅ `timingSafeEqual` nos dois segredos                 |
| API3 — exposição de propriedade | ✅ guardas contra PII em log e dado clínico no payload |
| **API4 — consumo irrestrito**   | 🔴 **era o único sem defesa nenhuma** → corrigido aqui |
| replay                          | ✅ janela de 300 s com `Math.abs`                      |
| enumeração de identificador     | ✅ `cuid2`, não sequencial                             |

## Item 32 — ✅ CORRIGIDO em 21/09/2026: a migration `0039` nunca foi aplicada, e o consentimento LGPD **não era gravado em produção desde então**

**Medido em 21/09/2026** contra o banco de produção (leitura apenas), ao preparar o merge do
PR #110. Não é achado de leitura de código: é estado do banco.

### O que está faltando no banco

```
colunas reais de consentimentos:
  id, created_at, updated_at, paciente_id, finalidade,
  versao, texto_apresentado, concedido_em, revogado_em, origem
                                            ↑ sem `idioma`

enum parceiro_evento_tipo em produção: receita_emitida, anvisa_aprovada
                                       ↑ sem `cadastro_transferido`
```

Os dois objetos são exatamente o conteúdo de `db/migrations/0039_secret_randall.sql`. A
entrada dela **existe** no journal (`db/migrations/meta/_journal.json`, idx 39) e **não existe**
linha correspondente em `drizzle.__drizzle_migrations`. O mesmo vale para a `0038` — mas os
objetos da 0038 estão lá, aplicados por fora.

### 🔴 Por que ela nunca mais seria aplicada sozinha

`node_modules/drizzle-orm/pg-core/dialect.js` → `migrate()` escolhe as pendentes assim:

```js
const lastDbMigration = dbMigrations[0];          // ORDER BY created_at DESC LIMIT 1
if (!lastDbMigration || Number(lastDbMigration.created_at) < migration.folderMillis) { … }
```

Compara com o **máximo já gravado**, não com o conjunto do que rodou. Em produção o máximo é
`1789271398148` (a 0043). O `when` da 0039 é `1789142042567`, **menor**. Ela é pulada **em
silêncio**, para sempre, com qualquer conteúdo que tenha.

⚠️ **Portanto reescrever a 0039 não conserta nada.** A correção precisa ser uma migration com
`when` maior que o máximo do banco.

### O efeito, e é ativo — não é código não alcançado

| #   | caminho:linha                                   | o que acontece                                                                                                                 |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `lib/parceiros/consentimento-registrado.ts:104` | `conceder()` faz `INSERT` com `idioma: IDIOMA_DO_CONSENTIMENTO`. Sem a coluna, **falha sempre**                                |
| 2   | `lib/parceiros/consentimento-registrado.ts:53`  | `consentimentosVigentes()` faz `SELECT consentimentos.idioma` — mesma falha                                                    |
| 3   | `app/_actions/cadastro-por-link.ts:600`         | chama `conceder()` dentro de `try/catch` que só faz `console.error` → **o cadastro conclui e o consentimento não é gravado**   |
| 4   | `app/(paciente)/_actions/consentimento.ts:96`   | o mesmo `conceder()` pelo painel do paciente                                                                                   |
| 5   | `lib/parceiros/enfileirar-transferencia.ts:54`  | grava `tipo: 'cadastro_transferido'` — valor que não existe no enum. **Latente**: fica atrás do consentimento, que nunca grava |

🔴 **A prova de que é executado e falha, não de que não foi alcançado:**

```
consentimentos        : 0 linhas
solicitacoes_cadastro : 77  — das quais 7 com `status='enviada'` e `paciente_id` preenchido
```

⚠️ **O denominador honesto é 7, não 77.** `conceder()` só é chamado depois de a conta e a ficha
existirem (`cadastro-por-link.ts:600`), então as 70 solicitações que pararam em `link_gerado`
ou `link_acessado` nunca chegaram ao ponto de consentir — contá-las infla o número sem
acrescentar prova. **Zero em 7 é o que mede:** sete cadastros passaram pelo ponto onde a linha
seria gravada, e nenhuma linha existe. Se fosse código não alcançado, não haveria tentativa;
há tentativa, e ela falha todas as vezes, engolida pelo `catch`.

### E a consequência que ninguém ligaria a isto

O comentário do próprio código, em `app/_actions/cadastro-por-link.ts:593-597`, escreve o
desfecho: _"se esta gravação falhar, o que acontece é que **nada é enviado à Greens** (a P5 lê
daqui antes de montar qualquer envio)"_. Ou seja, **a transferência S2 nunca dispara**, e a
causa está três camadas abaixo de onde ela seria procurada. Ver [Item 33](#item-33) para o
motivo de o log não ter ajudado.

### Correção — preparada, provada e APLICADA em 21/09/2026

`db/migrations/0045_idioma_e_cadastro_transferido.sql`, idempotente nos dois statements, com
`when` maior que o da 0044. A 0039 fica **intacta** — num banco reconstruído do zero ela aplica
e a 0045 vira no-op. Autorização e perigo medido em `.claude/autorizacoes.txt` (21/09/2026).

**Provada com 5 cenários** em Postgres 16 descartável + `BEGIN … ROLLBACK` contra o schema real
de produção: cenário vermelho (o `INSERT` do `conceder()` falhando hoje com
`column "idioma" of relation "consentimentos" does not exist`), cenário verde (o mesmo `INSERT`
passando depois), idempotência (duas execuções seguidas, `enum_total` continua 3), no-op num
banco onde a 0039 rodou, e o valor de enum utilizável depois do `COMMIT`.

### ✅ Aplicada em produção em 21/09/2026

Autorizada pelo dono depois de backup conferido por ele (`pg_dump` na EC2,
`behemp-prod-20260921-184137.dump`, 40 MB, 424 objetos confirmados via `pg_restore --list`).

⚠️ **Foram aplicadas as DUAS, 0044 e 0045, e isso foi decisão explícita.** O migrator não
consegue aplicar uma só: ele seleciona por `max(created_at)` e pega tudo acima disso. Medido
antes de rodar, a 0044 era **no-op completo** em produção — os três objetos de schema já
existiam, o `UPDATE` de dado atingia **0 linhas** (`alertas_config` tem 1 linha e não era
`[60,30]`), e só o `SET DEFAULT` tinha efeito.

🔴 **O caminho que foi descartado, e o motivo:** aplicar a DDL da 0045 e gravar só a linha de
journal dela faria `max(created_at)` virar `1790014838175`, e a **0044 passaria a ser pulada
para sempre** — recriando exatamente o defeito que este item descreve.

**Comando, pelo caminho documentado:** `pnpm db:migrate:prod` → `[migrar] ✓ concluído`.

#### A medição, antes e depois

| o quê                                    | antes (21/09, manhã)                                          | depois (21/09, 18h41)                                                                           |
| ---------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `consentimentos.idioma`                  | **não existia**                                               | `text`, `NOT NULL`, default `'pt'::text`                                                        |
| enum `parceiro_evento_tipo`              | `receita_emitida, anvisa_aprovada`                            | **+ `cadastro_transferido`**                                                                    |
| linhas em `drizzle.__drizzle_migrations` | 46, com a 0039 ausente e `max` na 0043                        | **48**, com as entradas 44 e 45                                                                 |
| o `INSERT` do `conceder()`               | `column "idioma" of relation "consentimentos" does not exist` | **passou** — devolveu `{finalidade:'retorno_ao_parceiro', idioma:'pt', versao:'2026-09-10.v1'}` |
| linhas em `consentimentos`               | **0**, para os 7 cadastros que chegaram lá                    | 0 — mas agora por **ausência de cadastro novo**, não por falha                                  |

⚠️ **O teste do `INSERT` não invocou a função `conceder()`.** O `tsx` é devDependency e não
está instalado, então o módulo TS não pôde ser importado. O que rodou foi o **mesmo statement**
que ela monta (`consentimento-registrado.ts:98-107`), com as constantes reais e contra um
**paciente real** — a FK precisava ser exercida, porque um `paciente_id` inventado mascarou uma
primeira tentativa. Rodou dentro de `BEGIN … ROLLBACK`: nenhum consentimento falso persistiu.

🔴 **O QUE AINDA NÃO ESTÁ PROVADO.** O que se provou é que **o banco aceita** o `INSERT`. Que
a perda de consentimento parou **no fluxo real** só se prova com um cadastro de verdade
passando pelo `cadastro-por-link` e deixando linha em `consentimentos`. Até lá, este item está
corrigido na causa e **não confirmado no efeito**.

### Relacionado

Este é o segundo caso da família descrita em [03 — as migrations NÃO RODAM DO ZERO](03-CHECKLIST-MESTRE.md).
Lá o sintoma é "banco novo não nasce"; aqui é "banco existente diverge do journal **e ninguém
vê**". A causa comum é a seleção por `max(created_at)`, que trata o histórico como uma régua
e não como um conjunto.

---

## Item 33 — 🔴 `erro.name` num `new Error` é sempre `'Error'`, e foi isso que escondeu o Item 32

**Medido em 21/09/2026.** O `catch` que engole a falha do consentimento registra assim:

`app/_actions/cadastro-por-link.ts:606-609`

```ts
console.error('[cadastro] consentimento não gravado', {
  protocolo: solicitacao.protocolo,
  erro: erroDoConsentimento instanceof Error ? erroDoConsentimento.name : 'desconhecida',
});
```

`erro.name` de qualquer `new Error(...)` é a string `'Error'`. O log de produção, portanto,
diz literalmente `{ protocolo: 'SOL-000xxx', erro: 'Error' }` — **em todas as falhas, qualquer
que seja a causa**. A mensagem real (`column "idioma" of relation "consentimentos" does not
exist`) nunca chegou a lugar nenhum.

### Por que isto já era classe conhecida, e escapou assim mesmo

É exatamente o defeito que o guarda `o-motivo-do-erro-diagnostica-sem-vazar` existe para
impedir — ele nasceu de `o-cadastro-feito-nao-vira-falha`, onde o mesmo `erro.name` escondeu
por quatro dias a falha que impedia **todo** documento de paciente de ser gravado.

⚠️ **O guarda cobre a função de formatação de erro; não cobre um `console.error` escrito à mão
em outro arquivo.** A classe voltou por uma porta que o guarda não olha.

### O que a correção precisa equilibrar

As duas pontas puxam em direções opostas, e já estão resolvidas no helper existente:

- **dizer de menos** → `'Error'`, que não diagnostica nada
- **dizer demais** → o Drizzle monta a mensagem com a query inteira e os valores inline:
  `Failed query: insert into pacientes values ('529.982.247-25', …)` — PII no log

A forma já decidida no repositório é `code:constraint:table` para erro de banco, que diagnostica
melhor que a mensagem **e** não carrega valor nenhum.

### Correção proposta (não implementada)

Trocar o `erro.name` do `catch` pelo helper que já existe, e **acrescentar ao guarda** o caso
que pega `console.error` com `.name` cru fora do helper — derivado do código, não listado, para
que o próximo `catch` escrito à mão nasça coberto.

**Perigo de mexer:** baixo — é uma linha de log, sem efeito em fluxo. **Custo de deixar:** alto
e já cobrado uma vez: a próxima falha silenciosa também levará semanas para aparecer, e a
única pista será `'Error'`.

**Fora do escopo de 21/09** — catalogado, não corrigido, conforme a regra de escopo.
