# Segurança e LGPD — requisito, não etapa final

> Regra sem `paths:` — vale em toda sessão, e é re-injetada depois de `/compact`. Decisão do
> dono em 19/08/2026: *"tudo relacionado a LGPD e cibersegurança tem que ser levado
> extremamente a sério, pelo menos nessa nova implementação; o que já tinha sido feito nós
> deixamos para revisar futuramente."*

## As três perguntas que todo item novo responde antes de ser implementado

Nenhum item novo — rota, action, tabela, upload — nasce sem resposta escrita para:

1. **Quem pode ler?** Papel **e** escopo de objeto. Papel certo + id alheio é OWASP API1
   (BOLA) — o risco número um deste projeto.
2. **Quanto tempo fica?** Prazo de retenção declarado. Se o prazo é decisão jurídica, o campo
   existe e fica vazio — nunca se chuta o número.
3. **O acesso é auditado?** Leitura de dado sensível registra `registrarAuditoria` com
   `acao: 'visualizar'`. Agregado sem PII não precisa.

## Arquivo e upload

- **Store privado.** Store público significa: quem tem a URL lê, **sem autenticação**.
  Obscuridade de URL não é controle de acesso.
- Entrega por **Route Handler autenticado** ou URL assinada de vida curta. Nunca a URL crua.
- URL de arquivo sensível **não** vai para log, e-mail, notificação, nem tela de quem não pode ler.
- Valide **tamanho, MIME e permissão no servidor** antes do upload — nunca só no client.

## Dado que sai da plataforma

- Antes de enviar qualquer coisa a serviço externo, pergunte **o que exatamente sai**.
- O repositório **já** mascara PII por regex antes de chamar o Gemini
  (`app/api/teleconsulta/transcrever/route.ts:156-160`) e persiste a versão mascarada.
  **Manter essa precaução.** Texto se mascara; **imagem não** — por isso a extração
  automática de documento com dado de saúde foi recusada por esse motivo em 19/08/2026.
- Serviço externo novo, com dado pessoal, exige **base legal e contrato de operador**. É
  decisão do Jurídico, não de TI.

## Minimização

- Campo novo com dado pessoal só entra se **algum consumidor declarado o usa**. Campo sem
  consumidor é coleta sem finalidade.
- **Quem não é parte do cuidado vê agregado, nunca identidade.** E a agregação acontece **na
  query**, não no componente: trazer as linhas para somar no client significa que a PII já
  chegou lá.

## Achado de segurança em código existente

**Catalogar, não corrigir no meio da tarefa.** Nesta ordem:

1. Item no `docs/03-CHECKLIST-MESTRE.md`, seção *achados catalogados*
2. Diagnóstico no `docs/04-LISTA-DE-AFAZERES.md` com `caminho:linha` **e o perigo de mexer medido**:
   quantos pontos de chamada · está em produção? · existe teste que prove antes/depois? · o
   que quebra em quem consome hoje?
3. Autorização do dono, com o custo de mexer × o custo de deixar
4. Trabalho próprio, em commit próprio — nunca junto da tarefa original

⚠️ Guarda para violação **conhecida e não corrigida** só entra **depois** da correção. Guarda
que acusa 10 violações no dia 1 é guarda que alguém desliga.

## Conhecido e não corrigido (não repetir no código novo)

- **10+ uploads em store público** com RG, laudo, receita, exame e procuração assinada —
  diagnóstico em `docs/04-LISTA-DE-AFAZERES.md` Item 6. **Código novo não repete isso.**
