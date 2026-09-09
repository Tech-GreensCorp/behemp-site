#!/usr/bin/env python3
"""
Hook PreToolUse — bloqueia ESCRITA em áreas fora do escopo autorizado.

POR QUE DENYLIST E NÃO ALLOWLIST:
allowlist precisaria conhecer de antemão todo arquivo novo do domínio comercial, e
erraria em cada arquivo que ainda não existe. Guarda que acusa inocente é guarda que
alguém desliga (Regra 2 da técnica dos guardas). A denylist protege exatamente o que
está em produção e nunca acusa arquivo novo.

O QUE ESTÁ PROTEGIDO: as áreas clínicas em produção, as migrations geradas, e as libs
de receituário/assinatura/teleconsulta/alertas. Leitura NUNCA é bloqueada — só escrita.

COMO AUTORIZAR: o dono acrescenta em .claude/autorizacoes.txt a linha
`path:<prefixo ou trecho do caminho>`. A autorização é por escrito e aparece no diff.
"""
import json
import sys
from pathlib import Path

# (padrão no caminho, por que está protegido)
PROTEGIDOS = [
    ("app/(medico)/", "área clínica em produção — fora do escopo do fluxo comercial"),
    ("app/(paciente)/", "área clínica em produção — fora do escopo do fluxo comercial"),
    ("app/(admin)/", "área administrativa em produção"),
    ("app/(public)/", "site público em produção"),
    ("db/migrations/", "migration gerada por drizzle-kit; editar à mão sem motivo escrito é proibido (AGENTS.md)"),
    ("lib/receituario/", "motor de receituário clínico (DT-002, ICP-Brasil)"),
    ("lib/docusign/", "assinatura de procuração (DT-003)"),
    ("lib/teleconsulta/", "teleconsulta em produção (DT-004, DT-007)"),
    ("lib/alertas/", "motor de alertas em produção (DT-010)"),
    ("db/schema/pacientes.ts", "schema clínico"),
    ("db/schema/medicos.ts", "schema clínico — perfil de médico, CRM e credencial de agenda"),
    ("db/schema/prescricoes.ts", "schema clínico"),
    ("db/schema/consultas.ts", "schema clínico"),
    ("AGENTS.md", "contrato do projeto — alterar exige autorização explícita"),
    (".github/workflows/", "pipeline de deploy em produção (DT-008)"),
]

FERRAMENTAS_DE_ESCRITA = {"Write", "Edit", "NotebookEdit", "MultiEdit"}


def autorizados() -> list[str]:
    arq = Path(".claude/autorizacoes.txt")
    if not arq.exists():
        return []
    saida = []
    for linha in arq.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if linha.startswith("path:") and len(linha) > 5:
            saida.append(linha[5:].strip())
    return saida


def main() -> int:
    try:
        dados = json.load(sys.stdin)
    except Exception:
        return 0

    if dados.get("tool_name") not in FERRAMENTAS_DE_ESCRITA:
        return 0

    caminho = (dados.get("tool_input") or {}).get("file_path") or ""
    if not caminho:
        return 0

    normalizado = caminho.replace("\\", "/")
    permitidos = autorizados()

    for padrao, motivo in PROTEGIDOS:
        if padrao not in normalizado:
            continue
        if any(p and p in normalizado for p in permitidos):
            return 0
        razao = (
            f"BLOQUEADO pelo hook escopo-autorizado.\n"
            f"Arquivo: {caminho}\n"
            f"Motivo: {motivo}\n\n"
            "Procedimento do CLAUDE.md, nesta ordem:\n"
            "  1. catalogar o achado no 03-CHECKLIST-MESTRE.md, seção 'fora do escopo'\n"
            "  2. MEDIR O PERIGO: o que quebra, quantos arquivos toca, está em produção?, "
            "existe teste que prove o antes e o depois?\n"
            "  3. pedir autorização com fundamentação e o custo de mexer x o de deixar\n"
            "  4. só então mexer — nunca no mesmo commit da tarefa original\n\n"
            "Para autorizar, o dono acrescenta em .claude/autorizacoes.txt:\n"
            f"  path:{normalizado}"
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
