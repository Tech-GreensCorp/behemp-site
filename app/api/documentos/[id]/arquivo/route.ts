/**
 * A ENTREGA AUTENTICADA DE UM DOCUMENTO DE PACIENTE.
 *
 * 🔴 POR QUE ESTA ROTA EXISTE
 *
 * Até 10/09/2026 todo documento deste projeto ia para store **público**: quem tivesse a URL
 * lia RG, laudo, receita e procuração assinada — sem autenticação nenhuma. É o Item 6, e a
 * regra do repositório é explícita: _"Store público significa: quem tem a URL lê, sem
 * autenticação. Obscuridade de URL não é controle de acesso."_
 *
 * Os caminhos novos passaram a gravar **privado**. Um blob privado não abre por link direto —
 * e é justamente esse o ponto. Esta rota é a porta: ela autentica, **confere escopo de
 * objeto**, e só então entrega os bytes.
 *
 * ⚠️ ELA SERVE OS DOIS MUNDOS, de propósito.
 *
 * Os documentos antigos continuam públicos — corrigi-los é trabalho próprio, e mexer em 14
 * pontos de upload no meio desta tarefa seria exatamente o que o `CLAUDE.md` proíbe. Para
 * eles, a rota **redireciona** para a URL que já existe; para os novos, faz o streaming
 * autenticado.
 *
 * Assim a tela usa UM endereço para qualquer documento, e a migração do Item 6 não vai exigir
 * tocar em tela nenhuma: o dia em que o último blob virar privado, esta rota para de
 * redirecionar sozinha.
 */

import { NextRequest, NextResponse } from 'next/server';
import { head } from '@vercel/blob';

import { garantirLeitorDoDocumento } from '@/lib/auth/escopo-documento';
import { registrarAuditoria } from '@/lib/utils/audit';

/** Lê dado de saúde: nunca pode ser servida de cache compartilhado. */
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const escopo = await garantirLeitorDoDocumento(id);
  if (!escopo.ok) {
    return NextResponse.json({ erro: escopo.erro }, { status: escopo.status });
  }

  /**
   * 🔴 LEITURA DE DOCUMENTO CLÍNICO É ACESSO AUDITÁVEL.
   *
   * As três perguntas do `.claude/rules/seguranca-lgpd.md`: quem pode ler (acima), quanto
   * tempo fica (a validade está na linha), e **o acesso é auditado** — que é esta chamada.
   * Nunca lança: uma auditoria indisponível não pode impedir o paciente de ver o próprio RG.
   */
  await registrarAuditoria({
    userId: escopo.userId,
    acao: 'visualizar',
    entidade: 'documentos',
    entidadeId: id,
  }).catch(() => {});

  const url = escopo.documento.urlBlob;

  try {
    const meta = await head(url);

    /**
     * Blob antigo, ainda público: redireciona.
     *
     * Não copiamos o arquivo nem reescrevemos a URL — isso é a migração do Item 6, e ela é
     * trabalho próprio. Aqui só garantimos que a TELA já fale com o endereço definitivo.
     */
    if (meta.contentDisposition && url.includes('/public/')) {
      return NextResponse.redirect(url);
    }

    const resposta = await fetch(url);
    if (!resposta.ok || !resposta.body) {
      return NextResponse.json({ erro: 'Documento indisponível' }, { status: 502 });
    }

    return new NextResponse(resposta.body, {
      headers: {
        'content-type': meta.contentType ?? 'application/octet-stream',
        // `inline` para abrir no navegador; o nome ajuda quem salva.
        'content-disposition': `inline; filename="${escopo.documento.nomeArquivo ?? id}"`,
        // 🔴 Dado de saúde não entra em cache de CDN nem de proxy.
        'cache-control': 'private, no-store',
      },
    });
  } catch {
    /**
     * ⚠️ O erro é genérico de propósito. Dizer "blob não encontrado" confirmaria a existência
     * do registro a quem chegou até aqui por engano — e quem chegou aqui já passou pelo
     * escopo, mas o princípio de não vazar estado interno continua valendo (AGENTS.md).
     */
    return NextResponse.json({ erro: 'Documento indisponível' }, { status: 502 });
  }
}
