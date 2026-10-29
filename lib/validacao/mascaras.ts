/**
 * Máscaras de DIGITAÇÃO: o campo mostra o formato enquanto a pessoa escreve. Função pura, sem `db`, sem `next/*`.
 *
 * ⚠️ Máscara é só apresentação. Quem valida é o servidor (`cpfEhValido`, os schemas Zod): o que o navegador mostra
 * não prova nada.
 */

/** `52998224725` → `529.982.247-25`, e parcial enquanto digita (`5299` → `529.9`). */
export function mascaraCpf(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/**
 * Telefone brasileiro com DDD: `(11) 99999-1234` (celular, 11 dígitos) ou `(11) 3333-1234` (fixo, 10).
 * Aceita colar com `+55`: o código do país é descartado quando sobram mais de 11 dígitos.
 */
export function mascaraTelefone(valor: string): string {
  let d = valor.replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  if (d.length <= 10) return `(${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`;
  return `(${ddd}) ${resto.slice(0, 5)}-${resto.slice(5)}`;
}
