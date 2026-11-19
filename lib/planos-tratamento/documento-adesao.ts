import type { PlanoTratamentoCompleto } from '@/app/(admin)/_actions/planos-tratamento';
import { formatarCpf } from '@/lib/validacao/cpf';
import {
  formatarData,
  formatarPercentual,
  formatarValor,
  paraCentavos,
  paraReais,
  textosDaAdesao,
  ultimaParcela,
} from './calculo';
import { MODELO_COLLAB as M } from './modelo-collab';

/**
 * Documento "Adesão ao Tratamento" (Programa de Acesso Collab) — HTML A4 de 2 páginas para
 * imprimir / salvar como PDF pelo navegador.
 *
 * Reproduz `Collab_Adesao_ao_Tratamento_editavel.pdf`. Os valores chegam GRAVADOS (calculados
 * pela action) — aqui só se derivam os rótulos de texto, nunca o total.
 *
 * Função pura, sem I/O: a rota `app/api/planos-tratamento/[id]/pdf` cuida de auth e busca, e
 * este módulo pode ser renderizado fora do Next para conferir o layout.
 *
 * 🔴 Todo texto vindo do banco passa por `e()` antes de entrar no HTML.
 */

// ── Helpers ──────────────────────────────────────────────────────

function e(valor: string | number): string {
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const v = (numerico: string | number) => formatarValor(Number(numerico));

function cabecalho(): string {
  return `
    <header class="cabecalho">
      <div class="marca">be<span>.</span></div>
      <div class="programa">${e(M.programa)}</div>
    </header>`;
}

function rodape(pagina: number): string {
  return `
    <footer class="rodape">
      <span>${e(M.rodape)}</span>
      <span>Página ${pagina} de 2</span>
    </footer>`;
}

function linhaComposicao(o: {
  nome: string;
  descricao?: string;
  quantidade?: string;
  moeda: string;
  valor: string;
  classe?: string;
}): string {
  return `
    <tr class="${o.classe ?? ''}">
      <td class="item">
        <div class="item-nome">${o.nome}</div>
        ${o.descricao ? `<div class="item-desc">${o.descricao}</div>` : ''}
      </td>
      <td class="qtd">${o.quantidade ?? ''}</td>
      <td class="moeda">${o.moeda}</td>
      <td class="valor">${o.valor}</td>
    </tr>`;
}

// ── Template ─────────────────────────────────────────────────────

export function renderAdesaoHTML(p: PlanoTratamentoCompleto): string {
  const t = textosDaAdesao({
    periodoMeses: p.periodoMeses,
    medicamento: p.medicamento,
    qtdFrascos: p.qtdFrascos,
    qtdFretes: p.qtdFretes,
    qtdConsultas: p.qtdConsultas,
    parcelas: p.parcelas,
    descontoPct: Number(p.descontoPct),
  });

  // A parcela gravada é a de baixo; a última absorve o resto (ver `calcularAdesao`).
  const parcelaCentavos = paraCentavos(Number(p.valorParcela));
  const ultima = ultimaParcela(paraCentavos(Number(p.totalAdesao)), parcelaCentavos, p.parcelas);

  const beneficios = [
    { titulo: t.beneficioDesconto, texto: M.beneficioDescontoTexto },
    ...M.beneficios,
  ]
    .map(
      (b, i) => `
      <div class="beneficio">
        <div class="beneficio-num">${i + 1}</div>
        <div>
          <div class="beneficio-titulo">${e(b.titulo)}</div>
          <div class="beneficio-texto">${e(b.texto)}</div>
        </div>
      </div>`,
    )
    .join('');

  const tiles = [
    { numero: p.qtdFrascos, l1: t.frascosLinha1, l2: t.frascosLinha2 },
    { numero: p.qtdFretes, l1: t.entregasLinha1, l2: t.entregasLinha2 },
    { numero: p.qtdConsultas, l1: t.consultasLinha1, l2: t.consultasLinha2 },
  ]
    .map(
      (tile) => `
      <div class="tile">
        <div class="tile-numero">${e(tile.numero)}</div>
        <div class="tile-l1">${e(tile.l1)}</div>
        <div class="tile-l2">${e(tile.l2)}</div>
      </div>`,
    )
    .join('');

  const composicao = [
    linhaComposicao({
      nome: e(t.linhaFrascos),
      descricao: e(M.linhaFrascosDescricao),
      quantidade: `${e(p.qtdFrascos)} <span class="x">×</span> R$ <span class="unit">${v(p.valorFrasco)}</span>`,
      moeda: 'R$',
      valor: v(p.subtotalMedicamentos),
    }),
    linhaComposicao({
      nome: e(M.linhaSubsidio),
      descricao: e(M.linhaSubsidioDescricao),
      quantidade: `${e(formatarPercentual(Number(p.descontoPct)))} %`,
      moeda: '– R$',
      valor: v(p.valorSubsidio),
    }),
    linhaComposicao({
      nome: e(M.linhaMedicamentosLiquido),
      moeda: 'R$',
      valor: v(p.medicamentosLiquido),
      classe: 'destaque',
    }),
    linhaComposicao({
      nome: e(M.linhaConsultas),
      descricao: e(M.linhaConsultasDescricao),
      quantidade: `${e(p.qtdConsultas)} <span class="x">×</span> R$ <span class="unit">${v(p.valorConsulta)}</span>`,
      moeda: 'R$',
      valor: v(p.totalConsultas),
    }),
    linhaComposicao({
      nome: e(t.linhaFretes),
      descricao: e(t.linhaFretesDescricao),
      quantidade: `${e(p.qtdFretes)} <span class="x">×</span> R$ <span class="unit">${v(p.valorFrete)}</span>`,
      moeda: 'R$',
      valor: v(p.totalFretes),
    }),
  ].join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Adesão ao Tratamento - ${e(p.patientName)}</title>
  <style>
    @page { size: A4; margin: 0; }
    :root {
      --coral: #e8665c;
      --indigo: #5b66e6;
      --rosa: #fdeeeb;
      --lavanda: #eceefc;
      --texto: #222428;
      --cinza: #5c6066;
      --linha: #ece2e2;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { background: #e9e9ec; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: var(--texto);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    /* min-height, NÃO height + overflow:hidden: se um texto longo passar da folha, o conteúdo
       vaza para a próxima folha em vez de sumir da impressão (observação e rodapé incluídos). */
    .pagina {
      width: 210mm; min-height: 297mm; margin: 12px auto; background: #fff;
      padding: 16mm 18mm 12mm; display: flex; flex-direction: column;
      box-shadow: 0 2px 12px rgba(0,0,0,.12); overflow-wrap: anywhere;
    }
    .cabecalho {
      display: flex; justify-content: space-between; align-items: center;
      padding-bottom: 14px; border-bottom: 1px solid var(--linha);
    }
    .marca { font-size: 40px; font-weight: 800; color: var(--coral); letter-spacing: -2px; line-height: 1; }
    .programa { font-size: 10.5pt; color: var(--cinza); }
    .conteudo { flex: 1; }
    .rodape {
      display: flex; justify-content: space-between; padding-top: 10px;
      border-top: 1px solid var(--linha); font-size: 8.5pt; color: var(--cinza);
    }

    .eyebrow { margin-top: 44px; font-size: 9.5pt; font-weight: 700; color: var(--indigo); letter-spacing: .03em; }
    h1 { margin-top: 10px; font-size: 30pt; font-weight: 700; letter-spacing: -.3px; }
    h2 { font-size: 17pt; font-weight: 700; margin: 30px 0 12px; }

    .card { margin-top: 28px; background: var(--rosa); border-radius: 14px; padding: 20px 26px 24px; }
    .card-titulo {
      display: inline-block; background: var(--lavanda); color: var(--indigo);
      font-size: 8.5pt; font-weight: 700; padding: 6px 8px; letter-spacing: .02em;
    }
    .campos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px 18px; margin-top: 14px; }
    .campo.inteiro { grid-column: 1 / -1; }
    .campo-label { background: var(--lavanda); font-size: 8.5pt; color: var(--cinza); padding: 5px 4px; }
    .campo-valor { background: #fff; min-height: 34px; padding: 9px 6px; font-size: 11pt; }

    .intro { font-size: 10.5pt; color: var(--cinza); line-height: 1.45; }
    .beneficio { display: flex; gap: 22px; margin-top: 26px; align-items: flex-start; }
    .beneficio-num {
      flex: 0 0 38px; height: 38px; border-radius: 50%; background: var(--coral); color: #fff;
      display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 11pt;
    }
    .beneficio-titulo { font-size: 13.5pt; font-weight: 700; margin-top: 2px; }
    .beneficio-texto { font-size: 10.5pt; color: var(--cinza); line-height: 1.45; margin-top: 6px; }

    .tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
    .tile { background: var(--rosa); border-radius: 14px; padding: 18px 18px 14px; }
    .tile-numero { font-size: 28pt; font-weight: 700; color: var(--indigo); line-height: 1.1; }
    .tile-l1 { margin-top: 12px; font-size: 9.5pt; font-weight: 700; }
    .tile-l2 { margin-top: 3px; font-size: 8.5pt; color: var(--cinza); }

    table.composicao { width: 100%; border-collapse: collapse; margin-top: 6px; }
    .composicao td { padding: 14px 6px; border-bottom: 1px solid var(--linha); vertical-align: middle; }
    .composicao td.item { padding-left: 20px; }
    .item-nome { font-size: 11pt; font-weight: 700; }
    .item-desc { font-size: 8.5pt; color: var(--cinza); margin-top: 3px; }
    .composicao td.qtd { text-align: right; font-size: 11pt; white-space: nowrap; color: var(--cinza); }
    .composicao td.qtd .x { margin: 0 4px; }
    .composicao td.qtd .unit { display: inline-block; min-width: 70px; text-align: right; color: var(--texto); }
    .composicao td.moeda { text-align: right; font-size: 10.5pt; color: var(--cinza); white-space: nowrap; width: 54px; }
    .composicao td.valor { text-align: right; font-size: 11pt; font-weight: 700; white-space: nowrap; width: 110px; padding-right: 16px; }
    .composicao tr.destaque td { background: var(--rosa); }

    .total {
      margin-top: 14px; background: var(--coral); border-radius: 12px; color: #fff;
      display: flex; justify-content: space-between; align-items: center; padding: 18px 16px 18px 20px;
    }
    .total-rotulo { font-size: 13pt; font-weight: 700; letter-spacing: .01em; }
    .total-valor { font-size: 19pt; font-weight: 700; white-space: nowrap; }
    .total-valor small { font-size: 10.5pt; font-weight: 400; margin-right: 6px; }

    .parcelas { margin-top: 28px; font-size: 17pt; font-weight: 700; padding-left: 4px; }
    .parcelas .n, .parcelas .vp { color: var(--indigo); }
    .pagamento { margin-top: 10px; font-size: 10.5pt; color: var(--cinza); }

    .ajuda {
      margin-top: 30px; background: var(--rosa); border-left: 6px solid var(--coral);
      border-radius: 6px 12px 12px 6px; padding: 16px 22px;
    }
    .ajuda-titulo { font-size: 12pt; font-weight: 700; }
    .ajuda-texto { margin-top: 6px; font-size: 10.5pt; color: var(--cinza); line-height: 1.45; }
    .observacao { margin-top: 18px; font-size: 8.5pt; color: var(--cinza); line-height: 1.4; }

    .no-print { position: fixed; top: 10px; right: 10px; z-index: 9999; display: flex; gap: 8px; }
    .btn { padding: 10px 20px; cursor: pointer; border: none; color: #fff; border-radius: 6px; font-size: 13px; }
    .btn-print { background: var(--coral); }
    .btn-close { background: #5c6066; }
    .btn:hover { filter: brightness(.92); }

    @media print {
      html { background: #fff; }
      .no-print { display: none !important; }
      .pagina { margin: 0; box-shadow: none; break-after: page; }
      .pagina:last-child { break-after: auto; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()" class="btn btn-print">Imprimir / Salvar PDF</button>
    <button onclick="window.close()" class="btn btn-close">Fechar</button>
  </div>

  <section class="pagina">
    ${cabecalho()}
    <div class="conteudo">
      <div class="eyebrow">${e(M.eyebrow)}</div>
      <h1>${e(M.titulo)}</h1>

      <div class="card">
        <div class="card-titulo">${e(M.cardTitulo)}</div>
        <div class="campos">
          <div class="campo inteiro">
            <div class="campo-label">Nome do paciente</div>
            <div class="campo-valor">${e(p.patientName)}</div>
          </div>
          <div class="campo">
            <div class="campo-label">CPF</div>
            <div class="campo-valor">${e(formatarCpf(p.cpf))}</div>
          </div>
          <div class="campo">
            <div class="campo-label">Data da adesão</div>
            <div class="campo-valor">${e(formatarData(p.dataAdesao))}</div>
          </div>
          <div class="campo">
            <div class="campo-label">Período</div>
            <div class="campo-valor">${e(t.periodo)}</div>
          </div>
          <div class="campo inteiro">
            <div class="campo-label">Medicamento</div>
            <div class="campo-valor">${e(p.medicamento)}</div>
          </div>
        </div>
      </div>

      <h2>${e(M.secaoComoFunciona)}</h2>
      <p class="intro">${e(M.intro)}</p>
      ${beneficios}
    </div>
    ${rodape(1)}
  </section>

  <section class="pagina">
    ${cabecalho()}
    <div class="conteudo">
      <h2>${e(M.secaoFornecimento)}</h2>
      <div class="tiles">${tiles}</div>

      <h2 style="margin-top: 40px;">${e(M.secaoComposicao)}</h2>
      <table class="composicao"><tbody>${composicao}</tbody></table>

      <div class="total">
        <span class="total-rotulo">${e(t.rotuloTotal)}</span>
        <span class="total-valor"><small>R$</small>${v(p.totalAdesao)}</span>
      </div>

      <div class="parcelas">
        <span class="n">${e(p.parcelas)}</span> ${e(t.parcelasTexto)} R$
        <span class="vp">${v(p.valorParcela)}</span>
      </div>
      ${
        ultima !== parcelaCentavos
          ? `<p class="pagamento">Última parcela de R$ ${formatarValor(paraReais(ultima))}, com o ajuste de centavos para fechar o total.</p>`
          : ''
      }
      <p class="pagamento">${e(p.formaPagamento)}</p>

      <div class="ajuda">
        <div class="ajuda-titulo">${e(M.ajudaTitulo)}</div>
        <div class="ajuda-texto">${e(M.ajudaTexto)}</div>
      </div>
      <p class="observacao">${e(M.observacao)}</p>
    </div>
    ${rodape(2)}
  </section>
</body>
</html>`;
}
