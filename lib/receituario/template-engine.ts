import Handlebars from 'handlebars';

// Helpers de formatação (determinísticos, sem I/O)
Handlebars.registerHelper('dataBR', (d: unknown) => {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(String(d));
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR');
});

Handlebars.registerHelper('dataHoraBR', (d: unknown) => {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(String(d));
  if (isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
});

Handlebars.registerHelper('maiusc', (s: unknown) =>
  String(s ?? '').toUpperCase(),
);

/** Renderiza o layout HTML do template com o contexto. Cache de compilação por layout. */
const cacheCompilado = new Map<string, Handlebars.TemplateDelegate>();

export function renderizarTemplate(
  layoutHtml: string,
  contexto: Record<string, unknown>,
): string {
  let compilado = cacheCompilado.get(layoutHtml);
  if (!compilado) {
    compilado = Handlebars.compile(layoutHtml, {
      noEscape: false,
      strict: false,
    });
    cacheCompilado.set(layoutHtml, compilado);
  }
  return compilado(contexto);
}
