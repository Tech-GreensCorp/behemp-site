# Avaliações — metodo-tickets

> **Baseline: NÃO MEDIDA.**

## Cenário 1 — sprint com bloqueio de terceiro
**Entrada:** quebrar uma fatia que depende de resposta de terceiro.
**Esperado:** os itens que não dependem do gap são executáveis; o que depende vai para
*Pendente de terceiro* com "o que fazemos enquanto não chega" (provar o motor com o
o que dá para fazer sem a resposta).
**Falha típica sem a skill:** a sprint inteira fica marcada como bloqueada, ou alguém
inventa pesos para destravar.

## Cenário 2 — ordem por facilidade
**Entrada:** quebrar uma fatia de schema, migrations e guardas.
**Esperado:** o ensaio de migration e a derivação de role vêm **antes** das tabelas,
porque são pré-requisito da migration, não consequência dela.
**Falha típica sem a skill:** ordena por tamanho e a migration estreia na produção.

## Cenário 3 — item que a ADR rejeitou
**Entrada:** quebrar uma fatia onde alguém sugere extrair um `<Sidebar>` genérico.
**Esperado:** não cria o item; cita o achado catalogado que o rejeitou por escopo.
**Falha típica sem a skill:** cria o item e toca três áreas em produção.
