#!/usr/bin/env bash
# Guarda dos hooks de bloqueio — .claude/hooks/git-perigoso.py e escopo-autorizado.py
#
# POR QUE ESTE ARQUIVO EXISTE
# Em 19/08/2026, na primeira hora de vida, `git-perigoso.py` acusou dois inocentes:
#   1. um `cat >> CLAUDE.md <<EOF` cujo TEXTO mencionava o comando de formatação global;
#   2. o próprio script que consertava o defeito (1), pelo mesmo motivo.
# Causa: o padrão era procurado em qualquer posição da string, não em posição de comando,
# e o corpo do heredoc era lido como se fosse execução. Granularidade errada — Regra 2 de
# docs/TECNICA-DOS-GUARDAS.md.
#
# Os dois casos estão abaixo como CONTROLE (devem PASSAR). Sem eles, a correção não tem
# prova, e a terceira falsa acusação chega sem aviso.
#
# ⚠️ ESTE ARQUIVO NÃO É MAIS TEMPORÁRIO. Em 20/08/2026 o guarda foi migrado para Vitest
# (hooks-de-escopo.test.ts), e o dono decidiu MANTER OS DOIS: este roda sem node_modules,
# o que serve para conferir os hooks numa máquina sem `pnpm install` — inclusive antes do
# install, que foi exatamente o estado do repositório nas duas primeiras sessões.
#
# 🔴 O PREÇO DE MANTER DOIS: eles podem divergir em silêncio, e o que divergir mente.
# Por isso o arquivo em Vitest tem um caso de PARIDADE que falha se qualquer caso daqui
# não existir lá. Ao acrescentar caso aqui, acrescente lá também — o guarda vai cobrar.
#
# Uso: bash __tests__/guardas/hooks-de-escopo.test.sh

set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1

FALHAS=0
TOTAL=0

# executa o hook e diz se ele BLOQUEOU
roda() { # $1 = script, $2 = json
  local out
  out=$(printf '%s' "$2" | python3 "$1" 2>/dev/null)
  if printf '%s' "$out" | grep -q '"permissionDecision": *"deny"'; then
    echo "BLOQUEIA"
  else
    echo "PASSA"
  fi
}

verifica() { # $1 = esperado, $2 = descricao, $3 = script, $4 = json
  TOTAL=$((TOTAL + 1))
  local obtido
  obtido=$(roda "$3" "$4")
  if [ "$obtido" = "$1" ]; then
    printf '  ok   %-56s %s\n' "$2" "$obtido"
  else
    printf '  FALHA %-55s esperado=%s obtido=%s\n' "$2" "$1" "$obtido"
    FALHAS=$((FALHAS + 1))
  fi
}

GIT=.claude/hooks/git-perigoso.py
ESC=.claude/hooks/escopo-autorizado.py

echo "── teste de vacuidade: os hooks existem e respondem ──"
for h in "$GIT" "$ESC"; do
  TOTAL=$((TOTAL + 1))
  if [ -f "$h" ] && python3 -c "import ast,sys; ast.parse(open(sys.argv[1]).read())" "$h"; then
    printf '  ok   %s\n' "$h"
  else
    printf '  FALHA %s não existe ou não compila\n' "$h"
    FALHAS=$((FALHAS + 1))
  fi
done
# Sem isto, um hook apagado faria todos os "PASSA" abaixo passarem sobre nada.
TOTAL=$((TOTAL + 1))
if [ "$(grep -c 'BORDA +' "$GIT")" -ge 8 ]; then
  printf '  ok   git-perigoso enxerga >=8 padrões em posição de comando\n'
else
  printf '  FALHA git-perigoso tem menos de 8 padrões — regex ou lista quebrada\n'
  FALHAS=$((FALHAS + 1))
fi

# INCIDENTE 3 (19/08/2026): o command do settings.json usava caminho RELATIVO
# (`python3 .claude/hooks/x.py`). Quando o shell não estava na raiz do repo, python3 saía
# com código 2 — que é BLOQUEIO — e o hook passou a bloquear tudo, inclusive a própria
# correção. Este caso prova que o caminho resolve de qualquer diretório.
TOTAL=$((TOTAL + 1))
if grep -q 'rev-parse --show-toplevel' .claude/settings.json; then
  printf '  ok   settings.json resolve o hook pela raiz do repo, não por caminho relativo\n'
else
  printf '  FALHA settings.json usa caminho relativo — bloqueia tudo fora da raiz\n'
  FALHAS=$((FALHAS + 1))
fi
TOTAL=$((TOTAL + 1))
if ( cd docs 2>/dev/null && printf '%s' '{"tool_name":"Bash","tool_input":{"command":"git status"}}' \
      | python3 "$(git rev-parse --show-toplevel)/.claude/hooks/git-perigoso.py" >/dev/null 2>&1 ); then
  printf '  ok   hook executa a partir de um subdiretório\n'
else
  printf '  FALHA hook não executa fora da raiz — INCIDENTE 3 voltou\n'
  FALHAS=$((FALHAS + 1))
fi

echo "── git-perigoso: deve BLOQUEAR ──"
verifica BLOQUEIA "git reset --hard" "$GIT" '{"tool_name":"Bash","tool_input":{"command":"git reset --hard HEAD~1"}}'
verifica BLOQUEIA "git push --force" "$GIT" '{"tool_name":"Bash","tool_input":{"command":"git push --force origin feat/x"}}'
verifica BLOQUEIA "git push origin main" "$GIT" '{"tool_name":"Bash","tool_input":{"command":"git push origin main"}}'
verifica BLOQUEIA "git branch -D" "$GIT" '{"tool_name":"Bash","tool_input":{"command":"git branch -D feat/x"}}'
verifica BLOQUEIA "git clean -fd" "$GIT" '{"tool_name":"Bash","tool_input":{"command":"git clean -fd"}}'
verifica BLOQUEIA "rm -rf" "$GIT" '{"tool_name":"Bash","tool_input":{"command":"rm -rf node_modules"}}'
verifica BLOQUEIA "formatacao global" "$GIT" '{"tool_name":"Bash","tool_input":{"command":"pnpm format"}}'
verifica BLOQUEIA "depois de && (posicao de comando)" "$GIT" '{"tool_name":"Bash","tool_input":{"command":"pnpm lint && git reset --hard"}}'

echo "── git-perigoso: deve PASSAR (controle) ──"
verifica PASSA "git status" "$GIT" '{"tool_name":"Bash","tool_input":{"command":"git status --short --branch"}}'
verifica PASSA "format:check (nao e o global)" "$GIT" '{"tool_name":"Bash","tool_input":{"command":"pnpm format:check CLAUDE.md"}}'
verifica PASSA "git restore --staged" "$GIT" '{"tool_name":"Bash","tool_input":{"command":"git restore --staged CLAUDE.md"}}'
verifica PASSA "git push em branch de feature" "$GIT" '{"tool_name":"Bash","tool_input":{"command":"git push origin feat/flow-representatives"}}'
verifica PASSA "comando autorizado por escrito (mecanismo)"   "$GIT" '{"tool_name":"Bash","tool_input":{"command":"git rm -r docs/kit-claude-code"}}'
verifica PASSA "ferramenta que nao e Bash" "$GIT" '{"tool_name":"Write","tool_input":{"command":"git reset --hard"}}'

echo "── git-perigoso: os dois INCIDENTES de falsa acusação (19/08/2026) ──"
verifica PASSA "REGRESSAO 1: heredoc que MENCIONA o comando" "$GIT" '{"tool_name":"Bash","tool_input":{"command":"cat >> CLAUDE.md <<EOF\n- nao rodar pnpm format global\n- nao usar git reset --hard\nEOF"}}'
verifica PASSA "REGRESSAO 2: script que conserta o proprio hook" "$GIT" '{"tool_name":"Bash","tool_input":{"command":"python3 - <<PYEOF\nt = t.replace(\"pnpm format\", \"x\")\nt = t.replace(\"git reset --hard\", \"y\")\nPYEOF"}}'
verifica PASSA "REGRESSAO 3: comentario mencionando o comando" "$GIT" '{"tool_name":"Bash","tool_input":{"command":"echo ok # lembrar: nunca git reset --hard aqui"}}'
# REGRESSAO 4 — descoberta pela sabotagem da migração para Vitest (20/08/2026). É o UNICO
# caso que discrimina a protecao `sem_heredoc`: aqui o comando perigoso esta no INICIO de
# uma linha do corpo do heredoc, onde a BORDA de posicao de comando casa. Sem sem_heredoc,
# este documento voltaria a ser lido como execucao. Sem este caso, neutralizar sem_heredoc
# mantinha os 34 casos verdes — mutante sobrevivente.
verifica PASSA "REGRESSAO 4: heredoc cuja LINHA COMECA com o comando" "$GIT" '{"tool_name":"Bash","tool_input":{"command":"cat >> docs/x.md <<EOF\ngit reset --hard descarta trabalho\npnpm format reescreve 360 arquivos\nEOF"}}'

echo "── escopo-autorizado: deve BLOQUEAR escrita ──"
verifica BLOQUEIA "area clinica (medico)" "$ESC" '{"tool_name":"Write","tool_input":{"file_path":"app/(medico)/medico/x.tsx"}}'
verifica BLOQUEIA "area clinica (paciente)" "$ESC" '{"tool_name":"Edit","tool_input":{"file_path":"app/(paciente)/paciente/x.tsx"}}'
verifica BLOQUEIA "migration gerada" "$ESC" '{"tool_name":"Edit","tool_input":{"file_path":"db/migrations/0018_x.sql"}}'
verifica BLOQUEIA "schema de medicos (clinico)"           "$ESC" '{"tool_name":"Write","tool_input":{"file_path":"db/schema/medicos.ts"}}'
verifica BLOQUEIA "lib de receituario" "$ESC" '{"tool_name":"Edit","tool_input":{"file_path":"lib/receituario/tipos.ts"}}'
# ⚠️ Em 20/08/2026 `deploy.yml` e `ci.yml` foram AUTORIZADOS por escrito para receber o
# portão de qualidade. Este caso passou a usar um workflow NAO autorizado, para continuar
# provando a protecao generica de .github/workflows/ — e o caso seguinte prova o mecanismo
# de autorizacao por path. Quando o guarda acusou esta mudanca, ele estava certo.
verifica BLOQUEIA "workflow NAO autorizado" "$ESC" '{"tool_name":"Edit","tool_input":{"file_path":".github/workflows/novo-pipeline.yml"}}'
verifica PASSA "workflow autorizado por escrito (mecanismo path:)" "$ESC" '{"tool_name":"Edit","tool_input":{"file_path":".github/workflows/deploy.yml"}}'
verifica BLOQUEIA "contrato do projeto" "$ESC" '{"tool_name":"Edit","tool_input":{"file_path":"AGENTS.md"}}'

echo "── escopo-autorizado: deve PASSAR (controle) ──"
verifica PASSA "componente compartilhado novo" "$ESC" '{"tool_name":"Write","tool_input":{"file_path":"components/shared/novo-componente.tsx"}}'
verifica PASSA "schema novo (nao clinico)" "$ESC" '{"tool_name":"Write","tool_input":{"file_path":"db/schema/nova-entidade.ts"}}'
verifica PASSA "docs do projeto" "$ESC" '{"tool_name":"Write","tool_input":{"file_path":"docs/03-CHECKLIST-MESTRE.md"}}'
verifica PASSA "guarda novo" "$ESC" '{"tool_name":"Write","tool_input":{"file_path":"__tests__/guardas/roleDerivaDoEnum.test.ts"}}'
verifica PASSA "LEITURA de area protegida nunca bloqueia" "$ESC" '{"tool_name":"Read","tool_input":{"file_path":"app/(medico)/medico/x.tsx"}}'

echo
if [ "$FALHAS" -eq 0 ]; then
  echo "verde — $TOTAL casos, 0 falhas"
  exit 0
fi
echo "VERMELHO — $TOTAL casos, $FALHAS falha(s)"
exit 1
