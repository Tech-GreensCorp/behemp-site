#!/usr/bin/env bash
#
# SABOTA UM ARQUIVO E CONFERE QUE O GUARDA ACUSA.
#
# O que faz .... aplica uma alteração proposital, roda o guarda, restaura o arquivo.
# Como desfaz .. restaura sempre, inclusive se o guarda falhar ou o script for interrompido.
# Idempotente .. sim — o arquivo volta ao estado original em qualquer saída.
#
# 🔴 POR QUE ESTE SCRIPT EXISTE, E QUAL ERRO ELE IMPEDE
#
# O padrão que eu usava era: `sed -i` no arquivo, rodar o guarda, ler o resultado. Se o
# `sed` NÃO CASASSE — por uma quebra de linha diferente, um espaço, uma reformatação do
# Prettier — o arquivo ficava intacto, o guarda passava verde, e eu lia isso como
# "guarda defeituoso" quando na verdade a sabotagem nunca aconteceu.
#
# Isso me aconteceu de verdade em 09/09/2026: reportei uma sabotagem como "VERDE,
# defeituoso" e o defeito era do meu `sed`.
#
# A regra, que veio do lado da Greens depois de um flake deles:
#   **toda corrupção proposital precisa AFIRMAR que corrompeu.**
#
# Aqui isso é literal: se o arquivo não mudou, o script sai com erro ANTES de rodar o
# teste. Um guarda "verde" só é reportado depois de provado que o arquivo foi mesmo
# alterado.
#
# Uso:
#   scripts/sabotar-e-conferir.sh <arquivo> <guarda> '<comando de sabotagem>'
set -uo pipefail

ARQUIVO="${1:?arquivo}"
GUARDA="${2:?caminho do teste}"
COMANDO="${3:?comando de sabotagem}"

[ -f "$ARQUIVO" ] || { echo "  ✗ arquivo não existe: $ARQUIVO"; exit 2; }

BACKUP="$(mktemp)"
cp "$ARQUIVO" "$BACKUP"
# Restaura em QUALQUER saída — inclusive Ctrl+C e erro do teste.
trap 'cp "$BACKUP" "$ARQUIVO"; rm -f "$BACKUP"' EXIT INT TERM

ANTES="$(sha256sum "$ARQUIVO" | cut -d' ' -f1)"
eval "$COMANDO" >/dev/null 2>&1 || true
DEPOIS="$(sha256sum "$ARQUIVO" | cut -d' ' -f1)"

# 🔴 A AFIRMAÇÃO. Sem ela, o resto do script mede o nada.
if [ "$ANTES" = "$DEPOIS" ]; then
  echo "  ✗ SABOTAGEM NÃO APLICADA — o arquivo não mudou. O comando não casou."
  echo "    (não rode o guarda: ele passaria verde por falta de sabotagem, não por defeito)"
  exit 3
fi

# 🔴 A SAÍDA É CAPTURADA ANTES, SEM PIPE — e isto foi um bug meu, nesta mesma versão.
#
# A primeira versão fazia `pnpm vitest ... | grep -q`. Com `set -o pipefail` ligado, o
# pipeline herda o código de saída do Vitest — que é 1 justamente quando o teste FALHA.
# Então o `if` dava falso, o script caía no `else`, e reportava "GUARDA DEFEITUOSO"
# exatamente nos casos em que o guarda tinha funcionado.
#
# O script que existe para impedir conclusão falsa produziu uma conclusão falsa. A lição
# que sobra é do mesmo tamanho da que o originou: o instrumento de medida também precisa
# ser medido.
SAIDA="$(pnpm vitest run "$GUARDA" 2>&1)"

if grep -qE "Tests +[0-9]+ failed|[0-9]+ failed \|" <<<"$SAIDA"; then
  echo "  ✓ acusou"
  exit 0
fi

if ! grep -qE "Tests +[0-9]+ passed" <<<"$SAIDA"; then
  echo "  ✗ O TESTE NEM RODOU — erro de import, sintaxe ou conexão:"
  grep -iE "error|cannot|failed to" <<<"$SAIDA" | head -3 | sed 's/^/      /'
  exit 4
fi

echo "  ✗ GUARDA DEFEITUOSO — o arquivo mudou e o teste passou mesmo assim"
exit 1
