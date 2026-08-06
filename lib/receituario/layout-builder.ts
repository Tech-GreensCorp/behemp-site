import { svgIcone } from './icones-medicos';
import type { BlocoConfig, ContextoReceituario, ReceituarioConfig } from './tipos';

export const CANVAS_W = 794;
export const CANVAS_H = 1123;

// Blocos padrão (posições em px no canvas A4).
const BLOCOS_PADRAO: BlocoConfig[] = [
  { id: 'logo', tipo: 'logo', x: 40, y: 30, largura: 110, visivel: true },
  { id: 'clinica_nome', tipo: 'clinica_nome', x: 170, y: 34, largura: 400, fontSize: 20, negrito: true, cor: '#EA5429', visivel: true },
  { id: 'clinica_contato', tipo: 'clinica_contato', x: 170, y: 64, largura: 500, fontSize: 11, cor: '#555', visivel: true },
  { id: 'tipo_receita', tipo: 'tipo_receita', x: 40, y: 130, largura: 714, fontSize: 15, align: 'center', negrito: true, cor: '#EA5429', visivel: true },
  { id: 'paciente', tipo: 'paciente', x: 40, y: 168, largura: 714, fontSize: 13, visivel: true },
  { id: 'medicamentos', tipo: 'medicamentos', x: 40, y: 220, largura: 714, fontSize: 13, visivel: true },
  { id: 'diagnostico', tipo: 'diagnostico', x: 40, y: 470, largura: 500, fontSize: 12, visivel: false },
  { id: 'cid', tipo: 'cid', x: 40, y: 498, largura: 500, fontSize: 12, visivel: false },
  { id: 'orientacoes', tipo: 'orientacoes', x: 40, y: 540, largura: 560, fontSize: 12, visivel: true },
  { id: 'emitido_em', tipo: 'emitido_em', x: 40, y: 950, largura: 300, fontSize: 11, cor: '#555', visivel: true },
  { id: 'validade', tipo: 'validade', x: 40, y: 972, largura: 300, fontSize: 11, cor: '#555', visivel: true },
  { id: 'qr', tipo: 'qr', x: 40, y: 1000, largura: 90, fontSize: 8, visivel: true },
  { id: 'assinatura', tipo: 'assinatura', x: 470, y: 930, largura: 284, align: 'center', fontSize: 12, visivel: true },
  { id: 'carimbo', tipo: 'carimbo', x: 560, y: 1000, largura: 120, visivel: false },
  { id: 'texto_legal', tipo: 'texto_legal', x: 40, y: 1092, largura: 714, fontSize: 9, align: 'center', cor: '#999', visivel: true, texto: 'Documento assinado digitalmente com certificado ICP-Brasil. Verifique a autenticidade pelo QR Code / código de verificação.' },
  { id: 'fig_1', tipo: 'figurinha', texto: 'estetoscopio', x: 700, y: 32, largura: 48, cor: '#EA5429', visivel: true },
  { id: 'fig_2', tipo: 'figurinha', texto: 'coracao', x: 724, y: 90, largura: 34, cor: '#EA5429', visivel: true },
];

export const CONFIG_PADRAO: ReceituarioConfig = {
  corPrimaria: '#EA5429', // Laranja BeHemp
  corFundo: '#ffffff',
  estampa: { tipo: 'nenhuma', opacidade: 0.06 },
  blocos: BLOCOS_PADRAO.map((b) => ({ ...b })),
};

function esc(s: unknown): string {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[
        c
      ] as string),
  );
}
function dataBR(d: Date): string {
  const x = new Date(d);
  return isNaN(x.getTime()) ? '' : x.toLocaleDateString('pt-BR');
}
function dataHoraBR(d: Date): string {
  const x = new Date(d);
  return isNaN(x.getTime())
    ? ''
    : x.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

// Padrão RICO de ícones médicos (SVG) — usado como fundo tingido pela cor primária
function estampaMedicaDataUri(fillHex: string, opacity: number): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'><g fill='${fillHex}' fill-opacity='${opacity}'>` +
    `<path d='M18 10h7v7h7v7h-7v7h-7v-7h-7v-7h7z'/>` +
    `<rect x='96' y='14' width='34' height='13' rx='6.5'/><rect x='113' y='14' width='17' height='13' rx='6.5' fill='#000' fill-opacity='0'/>` +
    `<path d='M20 60c0 8 6 12 12 12s12-4 12-12v-8h-4v8c0 5-4 8-8 8s-8-3-8-8v-8h-4z'/><circle cx='44' cy='48' r='5'/>` +
    `<path d='M74 44l10 6 6-4 4 10 4-16 6 22h-30z' fill-opacity='${opacity}'/>` +
    `<path d='M120 52c-6 0-10 4-10 10 0 8 10 14 10 14s10-6 10-14c0-6-4-10-10-10z'/>` +
    `<rect x='16' y='96' width='20' height='34' rx='4'/><rect x='19' y='100' width='14' height='8'/>` +
    `<path d='M62 96l6 0 0 14 8 14a5 5 0 0 1-4 8h-14a5 5 0 0 1-4-8l8-14z'/>` +
    `<rect x='104' y='96' width='30' height='12' rx='6' transform='rotate(45 119 102)'/><rect x='112' y='98' width='6' height='8' fill='#000' fill-opacity='0'/>` +
    `<circle cx='75' cy='75' r='4'/><circle cx='40' cy='75' r='3'/><circle cx='110' cy='130' r='3'/>` +
    `</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export function normalizarConfig(
  c: Partial<ReceituarioConfig> | null | undefined,
): ReceituarioConfig {
  if (!c || !Array.isArray((c as ReceituarioConfig).blocos))
    return {
      ...CONFIG_PADRAO,
      blocos: BLOCOS_PADRAO.map((b) => ({ ...b })),
    };
  return {
    corPrimaria: c.corPrimaria || CONFIG_PADRAO.corPrimaria,
    corFundo: c.corFundo || '#ffffff',
    estampa: {
      tipo: c.estampa?.tipo ?? 'nenhuma',
      opacidade: c.estampa?.opacidade ?? 0.06,
    },
    blocos: (c.blocos as BlocoConfig[]).map((b) => ({ ...b })),
  };
}

function tabelaMedicamentos(ctx: ContextoReceituario): string {
  const linhas = ctx.medicamentos
    .map(
      (m) =>
        `<tr><td class="mn">${esc(m.nome)}${
          m.dose ? ' ' + esc(m.dose) : ''
        }</td><td>${esc(m.forma ?? '')}${
          m.posologia ? ' — ' + esc(m.posologia) : ''
        }</td><td>${esc(m.quantidade ?? '')}</td></tr>`,
    )
    .join('');
  return `<span class="rot">Prescrição</span><table class="meds"><thead><tr><th style="width:44%">Medicamento</th><th>Apresentação / Posologia</th><th style="width:16%">Qtd.</th></tr></thead><tbody>${linhas}</tbody></table>`;
}

function conteudoBloco(
  b: BlocoConfig,
  ctx: ContextoReceituario,
  cor: string,
): string {
  const logoUrl = b.texto || ctx.clinica.logoUrl;
  switch (b.tipo) {
    case 'logo':
      return logoUrl
        ? `<img src="${esc(logoUrl)}" style="width:100%;display:block"/>`
        : '';
    case 'clinica_nome':
      return `<div style="color:${esc(b.cor || cor)}">${esc(
        b.texto || ctx.clinica.nome,
      )}</div>`;
    case 'clinica_contato':
      return esc(
        b.texto ||
          [
            ctx.clinica.endereco,
            ctx.clinica.telefone,
            ctx.clinica.email,
            ctx.clinica.site,
          ]
            .filter(Boolean)
            .join(' · '),
      );
    case 'tipo_receita':
      return `<div style="color:${esc(
        b.cor || cor,
      )};text-transform:uppercase;letter-spacing:1px">${esc(
        ctx.receita.tipoLabel,
      )}</div>`;
    case 'paciente':
      return `<div class="pac"><span class="rot">Paciente</span><br/><strong>${esc(
        ctx.paciente.nome,
      )}</strong>${
        ctx.paciente.idade != null ? ' · ' + ctx.paciente.idade + ' anos' : ''
      }${
        ctx.paciente.sexo ? ' · ' + esc(ctx.paciente.sexo) : ''
      }</div>`;
    case 'medicamentos':
      return tabelaMedicamentos(ctx);
    case 'diagnostico':
      return `<span class="rot">Diagnóstico</span><br/>${esc(
        ctx.receita.diagnostico,
      )}`;
    case 'cid':
      return `<span class="rot">CID</span> ${esc(ctx.receita.cid)}`;
    case 'orientacoes':
      return ctx.receita.observacoes
        ? `<span class="rot">Orientações</span><br/>${esc(
            ctx.receita.observacoes,
          )}`
        : '';
    case 'emitido_em':
      return `<span class="rot">Emitido em</span> ${dataHoraBR(
        ctx.receita.emitidaEm,
      )}`;
    case 'validade':
      return `<span class="rot">Válido até</span> ${dataBR(
        ctx.receita.validade,
      )}`;
    case 'qr':
      return `<div class="qr">QR de validação</div>`;
    case 'assinatura':
      return `${
        ctx.medico.assinaturaUrl
          ? `<img src="${esc(
              ctx.medico.assinaturaUrl,
            )}" style="max-height:44px;display:block;margin:0 auto 2px"/>`
          : ''
      }<div class="linha"><strong>${esc(
        ctx.medico.nome,
      )}</strong><br/>CRM ${esc(ctx.medico.crm)}${
        ctx.medico.crmUf ? '/' + esc(ctx.medico.crmUf) : ''
      }${
        ctx.medico.rqe ? ' · RQE ' + esc(ctx.medico.rqe) : ''
      }<br/>${esc(ctx.medico.especialidade)}</div>`;
    case 'carimbo':
      return ctx.medico.carimboUrl
        ? `<img src="${esc(
            ctx.medico.carimboUrl,
          )}" style="width:100%;display:block"/>`
        : '';
    case 'figurinha':
      return svgIcone(b.texto || 'cruz', esc(b.cor || cor), b.largura);
    case 'texto_legal':
      return esc(b.texto || '');
    default:
      return '';
  }
}

// Forma decorativa
function formaHtml(b: BlocoConfig, cor: string): string {
  const kind = b.texto || 'retangulo';
  const h = kind === 'linha' ? b.altura ?? 3 : b.altura ?? b.largura;
  const radius =
    kind === 'circulo'
      ? '50%'
      : kind === 'arredondado'
        ? '12px'
        : kind === 'linha'
          ? `${h / 2}px`
          : '0';
  const fill = esc(b.cor || cor);
  return `<div style="position:absolute;left:${b.x}px;top:${b.y}px;width:${b.largura}px;height:${h}px;background:${fill};border-radius:${radius};z-index:0"></div>`;
}

export function construirHtmlDeConfig(
  configParcial: Partial<ReceituarioConfig> | null | undefined,
  ctx: ContextoReceituario,
): string {
  const cfg = normalizarConfig(configParcial);
  const cor = cfg.corPrimaria || '#EA5429';
  const corFundo = cfg.corFundo || '#ffffff';
  const fundo =
    cfg.estampa.tipo === 'medico'
      ? `background-image:${estampaMedicaDataUri(
          esc(cor),
          cfg.estampa.opacidade,
        )};background-size:150px 150px;`
      : '';

  const blocos = cfg.blocos
    .filter((b) => b.visivel)
    .map((b) => {
      if (b.tipo === 'forma') return formaHtml(b, cor);
      const style =
        `position:absolute;left:${b.x}px;top:${b.y}px;width:${b.largura}px;z-index:1;` +
        (b.fontSize ? `font-size:${b.fontSize}px;` : '') +
        `text-align:${b.align ?? 'left'};` +
        (b.negrito ? 'font-weight:700;' : '') +
        (b.cor ? `color:${esc(b.cor)};` : '');
      return `<div class="bl" style="${style}">${conteudoBloco(
        b,
        ctx,
        cor,
      )}</div>`;
    })
    .join('');

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
<style>
  @page{size:A4;margin:0}
  *{box-sizing:border-box;margin:0}
  body{font-family:"Helvetica Neue",Arial,sans-serif;color:#1a1a1a;font-size:13px}
  .canvas{position:relative;width:${CANVAS_W}px;height:${CANVAS_H}px;overflow:hidden}
  .fundo{position:absolute;inset:0;${fundo}}
  .bl{line-height:1.35}
  .rot{font-size:10px;text-transform:uppercase;color:#888;letter-spacing:.5px}
  .pac{border:1px solid #e2e2e2;border-radius:6px;padding:8px 12px}
  table.meds{width:100%;border-collapse:collapse;margin-top:6px}
  table.meds th{text-align:left;font-size:10px;text-transform:uppercase;color:#888;border-bottom:1px solid #ddd;padding:6px 4px}
  table.meds td{padding:8px 4px;border-bottom:1px solid #f0f0f0;vertical-align:top}
  .mn{font-weight:600}
  .qr{font-size:8px;color:#aaa;border:1px dashed #ccc;padding:12px;text-align:center}
  .assinatura .linha,.bl .linha{border-top:1px solid #333;padding-top:4px;text-align:center}
</style></head><body>
  <div class="canvas" style="background:${esc(corFundo)}"><div class="fundo"></div>${blocos}</div>
</body></html>`;
}
