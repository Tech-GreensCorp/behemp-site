# ADR-0030 — O que depende só da TI no levantamento dos consentimentos fica aqui, para depois

> **Status:** 📋 **proposta** — 01/10/2026. Nada aqui foi implementado, e nada começa sem a ordem
> de Davi (`DO-84`).
>
> **Contexto em uma linha:** o levantamento dos consentimentos de 01/10/2026 gerou dois documentos,
> um para a TI e um para o advogado. Davi decidiu que o do advogado leva **só o que depende dele**, e
> que o que depende **só de nós** vira trabalho próprio, registrado nesta ADR para depois.
>
> **Fontes:** [`levantamentos/LEVANTAMENTO-DOS-CONSENTIMENTOS.pdf`](../levantamentos/LEVANTAMENTO-DOS-CONSENTIMENTOS.pdf)
> (TI), [`levantamentos/CONSENTIMENTOS-E-LGPD-PARA-O-JURIDICO.pdf`](../levantamentos/CONSENTIMENTOS-E-LGPD-PARA-O-JURIDICO.pdf)
> (advogado, perguntas J-01 a J-25) e o diagnóstico com `caminho:linha` nos Itens 6, 60, 61 e 67 a 75
> do [`04`](../04-LISTA-DE-AFAZERES.md).

## §0 — O que foi decidido, nas palavras de quem decidiu (01/10/2026)

| #   | o que foi dito, literal                                                                                                                            | o que isso fixa                                                                                                                                                      | ID      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | _"tira do documento né, podemos seguir com os itens que dependem da gente e não deles, so que isso em uma adr propria para depois, tira esse j25"_ | o documento do advogado leva **só** o que depende dele. A pergunta sobre os documentos abertos por link (antiga J-25) **sai**. O que depende da TI vem para esta ADR | `DO-84` |
| 2   | _"sobre o j-26 isso é sobre uma funcionalidade futura isso deve estar explicito"_                                                                  | a pergunta das cópias de segurança (hoje J-25) é sobre a **rotina futura**, e o documento diz isso com todas as letras                                               | `DO-85` |

**Contexto da decisão 1.** Davi havia apontado que a antiga J-25 tratava de problemas **já catalogados
para correção** (Itens 6 e 60). A recomendação desta sessão era manter a pergunta sobre comunicação à
ANPD (LGPD art. 48), porque corrigir não apaga o período em que os arquivos ficaram abertos. **Davi
escolheu tirar.** A pergunta não desaparece: fica registrada aqui (§3, D-04) para ser tratada com o
advogado à parte, quando Davi decidir.

## §1 — O que é "depender só da TI"

Um item entra aqui quando a correção **não precisa de resposta do Jurídico** para começar: o que
está errado é técnico, e o certo é conhecido. Quando a correção depende de texto, prazo ou base legal,
o item fica no documento do advogado e esta ADR só aponta a pergunta (§4).

## §2 — Os itens, em ordem de perigo

| ordem | o quê                                                                                                                                         | item no `04` | perigo | por que nesta posição                                                                            |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------ | ------------------------------------------------------------------------------------------------ |
| 1     | arquivos com dado pessoal e de saúde em armazenamento aberto (exames, ANVISA, procuração, chat, relatórios, avatar)                           | 6 · 60       | alto   | quem tem o endereço abre sem login, sem escopo e sem auditoria. É o maior volume de dado exposto |
| 2     | o retorno do OAuth do Google Agenda grava o token no médico que a URL disser, sem sessão e sem `state` assinado                               | 71           | alto   | uma rota, um chamador; correção pequena e de efeito grande                                       |
| 3     | o retorno do DocuSign sem validação HMAC, e o upload da ANVISA que aceita `procuracao_especifica` como arquivo avulso                         | 72           | alto   | permite marcar procuração como assinada ou enviada sem ela existir                               |
| 4     | o aceite da IA libera o navegador do médico antes do aceite do paciente                                                                       | 68           | médio  | o servidor barra o envio; hoje desligado em produção                                             |
| 5     | a tela do paciente na teleconsulta liga uma gravação local sem consentimento                                                                  | 61           | médio  | não sai do navegador, mas é captura sem base                                                     |
| 6     | sobras: `registrarConsentimentoLgpd` sem chamador, `consentimento_lgpd` e `consentimento_obtido` que não decidem nada; ADR-0007 desatualizada | 73 (parte)   | baixo  | limpeza; tirar coluna exige migration, e por isso fica por último                                |

⚠️ **O Item 67** (o botão "Entrar na Consulta" espera um aceite que a tela não pede) **não está nesta
lista de propósito.** Ele depende de duas coisas que não são da TI: a aprovação do texto (J-01 a J-04)
e uma decisão de negócio sobre o que fazer enquanto o texto não chega. **E ele ainda não foi medido em
produção**: a primeira ação é Davi ou Diniz medirem se há consultas por vídeo acontecendo.

## §3 — As decisões

### D-01 — O documento do advogado leva só o que depende dele

`DO-84`. O que é técnico sai do documento jurídico e vem para cá. **Rejeitado:** manter os achados de
segurança no documento do advogado "por transparência". Mistura o que ele precisa decidir com o que
não precisa, e alonga um documento que já tem 25 perguntas.

### D-02 — A ordem é a do perigo, e cada item é trabalho próprio

A ordem da §2. Cada item tem branch, PR e guarda próprios, como manda a regra de achado de segurança
(`.claude/rules/seguranca-lgpd.md`). **Rejeitado:** um PR único com os seis. O item 1 toca cerca de dez pontos de
upload e o store; o item 6 exige migration. Juntos, o review fica impossível e um defeito em um trava
os outros.

### D-03 — Nada começa sem a ordem de Davi

`DO-84` diz _"para depois"_. Esta ADR registra, não autoriza. **Rejeitado:** começar pelo item 2 por
ser pequeno. Pequeno não é autorizado.

### D-04 — A pergunta da comunicação à ANPD fica guardada, fora da TI

A antiga J-25 perguntava se os arquivos abertos configuram incidente a comunicar à ANPD e aos titulares
(LGPD art. 48). **A decisão de comunicar ou não é jurídica**, e Davi a tirou do documento (`DO-84`).
Ela fica aqui para não se perder. Quando Davi decidir levá-la ao advogado, a TI fornece os números que
a comunicação exigiria: quantos arquivos, de quantos pacientes, desde quando. **Esses números ainda
não foram medidos**; o único que existe é de 22/09/2026 (25 procurações assinadas, Item 6).

⚠️ **E o item 1 da §2 não espera essa decisão.** Corrigir o armazenamento é técnico e pode começar
quando Davi mandar, com ou sem a resposta sobre a comunicação.

## §4 — O que depende do Jurídico, e onde está a pergunta

Para que a resposta do advogado vire trabalho sem reabrir a conversa:

| quando o advogado responder… | vira trabalho em…                                                           | item no `04` |
| ---------------------------- | --------------------------------------------------------------------------- | ------------ |
| J-01, J-02, J-03, J-04, J-14 | liberar a coleta dos termos da teleconsulta; destrava o Item 67             | 67           |
| J-05, J-06, J-11             | botão de emergência, aceite no prontuário, botões de retirada               | 73           |
| J-07, J-08                   | texto e versão nova do compartilhamento (atravessa a Ponte com a Greens)    | 69           |
| J-09, J-10                   | registrar o aceite dos Termos com versão, inclusive pelo Google e pelo link | 70           |
| J-12, J-13                   | o que a exclusão de conta faz; exportação de dados                          | 74           |
| J-15, J-16, J-17             | Política revisada; região dos fornecedores                                  | 75           |
| J-18 a J-23                  | triagem, e-book, menores, cookies, Acesso Solidário, chamada de atendimento | —            |
| J-24                         | procuração: texto e verificação de identidade na assinatura                 | —            |
| J-25                         | a rotina de cópias de segurança, **funcionalidade futura** (`DO-85`)        | —            |

## §5 — O que fica de fora, e por quê

- **A pesquisa de região dos serviços do Google** (J-16): é pré-requisito para responder ao advogado
  com opções, e não foi feita. Entra quando Davi pedir.
- **Medir em produção** se as integrações com a planilha Google (triagem) e com o Inngest estão
  configuradas: só Davi ou Diniz alcançam a VPS.
- **Item 67**: ver a nota da §2.

## §6 — Princípio e fase (`docs/PRINCIPIOS.md`)

- §2, itens 1 a 3: **H** (segurança), fase 6.
- §2, itens 4 e 5: **H**, fase 6, e **L** (front-end), fase 2.
- §2, item 6: **F** (banco), fase 5.
- D-02: **I** (testes), fase 8, porque cada item nasce com o seu guarda.
