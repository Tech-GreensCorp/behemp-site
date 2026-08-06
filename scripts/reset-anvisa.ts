import { db } from '../lib/db';
import { autorizacoesAnvisa } from '../db/schema';
import { eq } from 'drizzle-orm';

async function reset() {
  const pacienteAliasId = 'pk6vm7yrk5ya6k72v23buxs3';

  // Fazer hard delete das autorizações antigas deste paciente
  // para que a tela inicie limpa do zero
  await db.delete(autorizacoesAnvisa).where(eq(autorizacoesAnvisa.pacienteId, pacienteAliasId));

  console.log('✅ Histórico de ANVISA deletado com sucesso para o paciente de teste.');
}

reset().catch(console.error).finally(() => process.exit(0));
