import { db } from '@/lib/db';
import { autorizacoesAnvisa } from '@/db/schema';
import { eq, and, isNull, isNotNull } from 'drizzle-orm';
import { addYears, format } from 'date-fns';

async function main() {
  const isApply = process.argv.includes('--apply');
  console.log('Iniciando backfill de dataValidade para autorizações ANVISA aprovadas antigas...');
  console.log(
    isApply
      ? '[MODO APPLY] Os registros SERÃO atualizados.'
      : '[MODO DRY-RUN] Use --apply para executar as atualizações.\n',
  );

  const autorizacoesSemValidade = await db
    .select({
      id: autorizacoesAnvisa.id,
      dataAprovacao: autorizacoesAnvisa.dataAprovacao,
    })
    .from(autorizacoesAnvisa)
    .where(
      and(
        eq(autorizacoesAnvisa.status, 'aprovado'),
        isNull(autorizacoesAnvisa.dataValidade),
        isNotNull(autorizacoesAnvisa.dataAprovacao),
      ),
    );

  console.log(`Encontradas ${autorizacoesSemValidade.length} autorizações para atualizar.\n`);

  if (!isApply) {
    console.log('--- AMOSTRA (10 PRIMEIROS) ---');
    const amostra = autorizacoesSemValidade.slice(0, 10);
    amostra.forEach((auth, idx) => {
      const dataValidade = auth.dataAprovacao
        ? format(addYears(auth.dataAprovacao, 2), 'yyyy-MM-dd')
        : 'N/A';
      console.log(
        `${idx + 1}. ID: ${auth.id} | Aprovada: ${auth.dataAprovacao} => Validade calculada: ${dataValidade}`,
      );
    });
    console.log('\nExecute com --apply para efetivar as alterações no banco.');
    process.exit(0);
  }

  let atualizadas = 0;
  for (const auth of autorizacoesSemValidade) {
    if (auth.dataAprovacao) {
      const dataValidade = format(addYears(auth.dataAprovacao, 2), 'yyyy-MM-dd');

      await db
        .update(autorizacoesAnvisa)
        .set({ dataValidade })
        .where(eq(autorizacoesAnvisa.id, auth.id));

      atualizadas++;
    }
  }

  console.log(`Backfill concluído com sucesso. Total de registros afetados: ${atualizadas}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Erro no backfill:', err);
  process.exit(1);
});
