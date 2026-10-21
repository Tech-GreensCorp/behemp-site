import { notFound } from 'next/navigation';

import { PreviewGaleria } from '@/components/ia-clinica/PreviewGaleria';

/**
 * PREVISUALIZAÇÃO DE LAYOUT — sem login, sem banco, com os componentes REAIS.
 *
 * POR QUE ESTA ROTA EXISTE
 * As telas de IA clínica vivem em `app/(medico)`, atrás de login pelo Clerk. Sem as credenciais
 * de desenvolvimento, não há como abri-las — e o dono precisa **ver o layout** para aprovar.
 *
 * 🔴 POR QUE NÃO UMA CÓPIA DAS TELAS
 * O dono propôs copiar os arquivos, aprovar a cópia e transicionar depois. Funciona uma vez, e
 * depois **diverge**: a cópia aprovada e o original seguem caminhos diferentes, e o que foi
 * aprovado deixa de ser o que vai para produção. Aqui são os **mesmos componentes**, importados
 * dos mesmos arquivos, alimentados por fixture. O que você aprova é literalmente o que roda.
 *
 * 🔴 ESTA ROTA NÃO EXISTE EM PRODUÇÃO
 * `notFound()` no topo. Uma rota pública que renderiza componentes clínicos com dado de exemplo
 * não pode ser alcançável por ninguém em produção — mesmo sem dado real, ela confundiria.
 */

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Preview de layout | Be4Hope',
  // Não indexar, mesmo que a rota escape um dia.
  robots: { index: false, follow: false },
};

export default async function PreviewPage() {
  // A trava. Em produção, esta rota simplesmente não está lá.
  if (process.env.NODE_ENV === 'production') notFound();

  // O fixture congelado: a resposta real do motor, do contrato da Sprint 2.
  const { default: resposta } = await import(
    '@/__fixtures__/ia-clinica/resposta-completa-teleconsulta.json'
  );
  const { default: parcial } = await import(
    '@/__fixtures__/ia-clinica/resposta-parcial-truncada.json'
  );
  // O caso de canabidiol, com opções de medicamento por hipótese. Conteúdo clínico ILUSTRATIVO
  // e não validado — GAP-03 aberto; ver o campo `_LEIA` no próprio arquivo.
  const { default: canabidiol } = await import(
    '@/__fixtures__/ia-clinica/resposta-canabidiol-dor-cronica.json'
  );

  return (
    <PreviewGaleria
      grafoCompleto={resposta.grafo as never}
      grafoParcial={parcial.grafo as never}
      grafoCanabidiol={canabidiol.grafo as never}
    />
  );
}
