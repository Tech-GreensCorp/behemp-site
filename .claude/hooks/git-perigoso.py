#!/usr/bin/env python3
"""
Hook PreToolUse — bloqueia comando git destrutivo e push direto em produção.

POR QUE ESTE HOOK EXISTE (e não uma regra no CLAUDE.md):
a doc oficial é explícita — "CLAUDE.md instructions ... are not a hard enforcement
layer" e "To block an action regardless of what Claude decides, use a PreToolUse hook".
Regra no CLAUDE.md é conselho; isto é bloqueio.

Contexto deste repositório: `main` É produção — push em main dispara o deploy
(.github/workflows/deploy.yml), que aplica migration no banco de produção sem rollback
(DT-006, DT-008).

COMO AUTORIZAR: acrescente a linha correspondente em .claude/autorizacoes.txt, no
formato `git:<trecho do comando>`. Autorização é por escrito, e fica no diff.

🔴 A PRIMEIRA VERSÃO DESTE HOOK ACUSOU UM INOCENTE, na primeira hora de vida — duas
vezes seguidas, inclusive bloqueando a própria correção.

Ela procurava o padrão em qualquer posição da string do comando. Bloqueou um
`cat >> CLAUDE.md <<EOF` cujo TEXTO mencionava o comando de formatação global: era o
corpo de um heredoc, documentação, não execução. Depois bloqueou o script que consertava
isso, porque o script continha o mesmo texto.

É a granularidade errada — o mesmo defeito da Regra 2 de docs/TECNICA-DOS-GUARDAS.md:
buscar num escopo maior que o do defeito. O defeito é "executar o comando", não
"a string contém as palavras".

Correções aplicadas:
  1. o CORPO de heredoc é removido antes da checagem;
  2. o padrão só conta em POSIÇÃO DE COMANDO — início da string, ou depois de
     ; & | && || ou nova linha;
  3. os casos de falsa acusação viraram teste em __tests__/guardas/hooks.test.sh.

Fica registrado porque a próxima pessoa que escrever um hook parecido lê este parágrafo
e não repete.
"""
import json
import re
import sys
from pathlib import Path

# Início da string, ou depois de um separador de shell. Impede que menção em texto
# (comentário, corpo de heredoc, string de documentação) seja lida como execução.
BORDA = r"(?:^|[\n;&|])\s*(?:sudo\s+)?"

# Cada padrão nasceu de um risco concreto, não de teoria.
PROIBIDOS = [
    (BORDA + r"git\s+reset\s+--hard\b", "descarta trabalho não commitado, sem recuperação"),
    (BORDA + r"git\s+push\b[^\n;|&]*(?:--force\b|-f\b)", "reescreve histórico remoto compartilhado"),
    (BORDA + r"git\s+branch\s+-D\b", "apaga branch sem checar merge"),
    (BORDA + r"git\s+checkout\s+--\s", "descarta alteração local do arquivo"),
    (BORDA + r"git\s+restore\b(?![^\n;|&]*--staged)", "descarta alteração local do arquivo"),
    (BORDA + r"git\s+clean\s+-[a-z]*[fdx]", "apaga arquivo não rastreado"),
    (BORDA + r"git\s+rm\s+-r\b", "remoção recursiva versionada"),
    (BORDA + r"git\s+push\b[^\n;|&]*\bmain\b", "push em main DISPARA DEPLOY EM PRODUÇÃO"),
    (BORDA + r"rm\s+-[a-z]*(?:rf|fr)[a-z]*\b", "remoção recursiva forçada"),
    (BORDA + r"pnpm\s+format(?![:\w])", "reescreve 233 arquivos fora de escopo (AGENTS.md proíbe)"),
]


def sem_heredoc(comando: str) -> str:
    """
    Remove o CORPO de heredocs, preservando as linhas de comando.

    O que o texto de um documento menciona não é execução — foi exatamente esta confusão
    que produziu as duas falsas acusações registradas no topo do arquivo.
    """
    saida: list[str] = []
    delimitador: str | None = None
    for linha in comando.split("\n"):
        if delimitador is None:
            saida.append(linha)
            m = re.search(r"<<-?\s*['\"]?([A-Za-z_][A-Za-z0-9_]*)['\"]?", linha)
            if m:
                delimitador = m.group(1)
        elif linha.strip() == delimitador:
            delimitador = None
    return "\n".join(saida)


def autorizados() -> list[str]:
    arq = Path(".claude/autorizacoes.txt")
    if not arq.exists():
        return []
    linhas = []
    for linha in arq.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if linha.startswith("git:") and len(linha) > 4:
            linhas.append(linha[4:].strip())
    return linhas


def main() -> int:
    try:
        dados = json.load(sys.stdin)
    except Exception:
        return 0  # hook sem opinião — nunca derrubar a sessão por erro próprio

    if dados.get("tool_name") != "Bash":
        return 0

    bruto = (dados.get("tool_input") or {}).get("command") or ""
    comando = sem_heredoc(bruto)
    permitidos = autorizados()

    for padrao, motivo in PROIBIDOS:
        if not re.search(padrao, comando, re.IGNORECASE):
            continue
        if any(trecho and trecho in bruto for trecho in permitidos):
            return 0  # autorizado por escrito
        razao = (
            f"BLOQUEADO pelo hook git-perigoso: {motivo}.\n"
            f"Comando: {bruto[:300]}\n\n"
            "Antes de insistir: diga o que quebra se isto rodar, quantos arquivos toca, "
            "e se existe teste que prove o antes e o depois.\n"
            "Para autorizar, o dono acrescenta em .claude/autorizacoes.txt a linha:\n"
            "  git:<trecho exato do comando>"
        )
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": razao,
            }
        }))
        return 0

    return 0


if __name__ == "__main__":
    sys.exit(main())
