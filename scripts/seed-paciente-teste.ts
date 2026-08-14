import { db } from '../lib/db';
import { users, pacientes, medicos, anamneses, medicamentos, dosagens, evolucoes, autorizacoesAnvisa, triagens, consultas, exames, documentos } from '../db/schema';
import { eq, and, like } from 'drizzle-orm';
import { addDays, subDays } from 'date-fns';

const TARGET_EMAIL = 'joaogabrieldiniz23+paciente100@gmail.com';
const EMPTY_TARGET_EMAIL = 'joaogabrieldiniz23+2paciente@gmail.com';
const SEED_MARKER = '[SEED-TESTE]';

async function main() {
  console.log('🌱 Iniciando Seed do Paciente 360°...');

  // Verificar paciente vazio
  const [emptyUser] = await db.select().from(users).where(eq(users.email, EMPTY_TARGET_EMAIL)).limit(1);
  if (emptyUser) {
    const [emptyPaciente] = await db.select().from(pacientes).where(eq(pacientes.userId, emptyUser.id)).limit(1);
    if (emptyPaciente) {
      console.log(`\nℹ️ Paciente vazio encontrado (${EMPTY_TARGET_EMAIL}). Nenhuma alteração feita nele.`);
    }
  } else {
    console.log(`\nℹ️ Paciente vazio não encontrado — criar manualmente via Clerk/registro com o email ${EMPTY_TARGET_EMAIL} para o teste de estados vazios.`);
  }

  // Verificar paciente alvo
  const [targetUser] = await db.select().from(users).where(eq(users.email, TARGET_EMAIL)).limit(1);
  if (!targetUser) {
    console.error(`\n❌ Paciente de teste não encontrado — verifique o email (${TARGET_EMAIL}).`);
    process.exit(1);
  }

  const [targetPaciente] = await db.select().from(pacientes).where(eq(pacientes.userId, targetUser.id)).limit(1);
  if (!targetPaciente) {
    console.error(`\n❌ Registro na tabela pacientes não encontrado para o usuário ${TARGET_EMAIL}.`);
    process.exit(1);
  }

  console.log(`\n✅ Paciente alvo encontrado: ${targetUser.nome} (ID: ${targetPaciente.id})`);

  // Pegar primeiro médico
  const [medico] = await db.select().from(medicos).limit(1);
  if (!medico) {
    console.error('\n❌ Nenhum médico encontrado no banco para ser o autor dos registros.');
    process.exit(1);
  }
  
  const hoje = new Date();

  // 1. Anamnese
  const [existingAnamnese] = await db.select().from(anamneses)
    .where(and(eq(anamneses.pacienteId, targetPaciente.id), like(anamneses.queixaPrincipal, `%${SEED_MARKER}%`))).limit(1);
  
  if (!existingAnamnese) {
    await db.insert(anamneses).values({
      pacienteId: targetPaciente.id,
      criadoPor: medico.id,
      queixaPrincipal: `Dor crônica lombar e insônia há 2 anos ${SEED_MARKER}`,
      historiaDoencaAtual: 'Paciente relata dor lombar contínua de intensidade 7/10, com piora noturna e insônia de manutenção. Tentou analgésicos comuns sem melhora sustentada. Iniciou tratamento com CBD há 50 dias com resposta progressiva.',
      doencasPrevias: 'Hérnia de disco L4-L5 (2023)',
      medicamentosEmUso: 'Losartana 50mg 1x/dia',
      alergias: 'Dipirona',
      tabagismo: 'nunca_fumou',
      consumoAlcool: 'ocasional',
      qualidadeSono: 'ruim',
      nivelDor: 7,
      usoPrevioCannabis: false,
      objetivosTratamento: 'Reduzir dor e melhorar qualidade do sono',
    });
    console.log('✅ Anamnese criada');
  } else {
    console.log('ℹ️ Anamnese já existia');
  }

  // 2. Medicamento
  const nomeMed = `Greens MED 6300mg Full Spectrum ${SEED_MARKER}`;
  let [medAtual] = await db.select().from(medicamentos).where(eq(medicamentos.nome, nomeMed)).limit(1);
  
  if (!medAtual) {
    // Tenta achar o real sem o marcador
    const [medReal] = await db.select().from(medicamentos).where(like(medicamentos.nome, 'Greens MED 6300mg%')).limit(1);
    if (medReal) {
      medAtual = medReal;
      console.log('ℹ️ Reutilizando medicamento existente:', medAtual.nome);
    } else {
      [medAtual] = await db.insert(medicamentos).values({
        nome: nomeMed,
        gotasPorMl: 20, // 20 gotas/ml para dar o cálculo de 50% exato (600 gotas totais / 6 gotas por dia = 100 dias)
        volumeMl: 30,
        ativo: true,
      }).returning();
      console.log('✅ Medicamento criado:', medAtual.nome);
    }
  } else {
    console.log('ℹ️ Medicamento já existia');
  }

  // 3. Dosagem Ativa
  const dataInicioDosagem = subDays(hoje, 50);
  const dataFimDosagem = addDays(dataInicioDosagem, (30 * 20) / 6); // 100 dias = hoje + 50
  
  const [existingDosagem] = await db.select().from(dosagens)
    .where(and(eq(dosagens.pacienteId, targetPaciente.id), eq(dosagens.medicamentoId, medAtual.id), eq(dosagens.ativa, true))).limit(1);
    
  if (!existingDosagem) {
    // Desativar antigas
    await db.update(dosagens).set({ ativa: false }).where(eq(dosagens.pacienteId, targetPaciente.id));
    
    await db.insert(dosagens).values({
      pacienteId: targetPaciente.id,
      medicamentoId: medAtual.id,
      gotasPorDia: 6,
      mlFrasco: 30,
      dataInicio: dataInicioDosagem.toISOString(),
      dataFimPrevista: dataFimDosagem.toISOString(),
      ativa: true,
    });
    console.log('✅ Dosagem criada (50% consumido)');
  } else {
    console.log('ℹ️ Dosagem já existia');
  }

  // 4. Evoluções
  const [existingEvo] = await db.select().from(evolucoes).where(and(eq(evolucoes.pacienteId, targetPaciente.id), like(evolucoes.conteudo, `%${SEED_MARKER}%`))).limit(1);
  if (!existingEvo) {
    await db.insert(evolucoes).values([
      {
        pacienteId: targetPaciente.id,
        criadoPor: medico.id,
        data: subDays(hoje, 40).toISOString(),
        nivelDor: 7,
        qualidadeSono: 'ruim',
        bemEstar: 'ruim',
        tipo: 'estavel',
        conteudo: `${SEED_MARKER} Início do tratamento...`,
        sintomasAtuais: 'Dor lombar intensa, insônia'
      },
      {
        pacienteId: targetPaciente.id,
        criadoPor: medico.id,
        data: subDays(hoje, 20).toISOString(),
        nivelDor: 5,
        qualidadeSono: 'regular',
        bemEstar: 'regular',
        tipo: 'positiva',
        conteudo: `${SEED_MARKER} Resposta parcial após titulação...`,
      },
      {
        pacienteId: targetPaciente.id,
        criadoPor: medico.id,
        data: subDays(hoje, 5).toISOString(),
        nivelDor: 3,
        qualidadeSono: 'boa',
        bemEstar: 'boa',
        tipo: 'positiva',
        conteudo: `${SEED_MARKER} Melhora significativa da dor e do sono...`,
      }
    ]);
    console.log('✅ Evoluções criadas (x3)');
  } else {
    console.log('ℹ️ Evoluções já existiam');
  }

  // 5. Autorização ANVISA
  const [existingAnvisa] = await db.select().from(autorizacoesAnvisa).where(and(eq(autorizacoesAnvisa.pacienteId, targetPaciente.id), like(autorizacoesAnvisa.observacoesAnvisa, `%${SEED_MARKER}%`))).limit(1);
  if (!existingAnvisa) {
    await db.insert(autorizacoesAnvisa).values({
      pacienteId: targetPaciente.id,
      status: 'aprovado',
      dataValidade: addDays(hoje, 45).toISOString(),
      modalidade: 'guiada',
      observacoesAnvisa: `${SEED_MARKER} Aprovado`,
    });
    console.log('✅ Autorização ANVISA criada (âmbar/vencendo em 45d)');
  } else {
    console.log('ℹ️ Autorização ANVISA já existia');
  }

  // 6. Triagem
  const [existingTriagem] = await db.select().from(triagens).where(eq(triagens.emailContato, TARGET_EMAIL)).limit(1);
  if (!existingTriagem) {
    await db.insert(triagens).values({
      emailContato: TARGET_EMAIL,
      nomeContato: targetUser.nome,
      dados: { queixa: 'Dor crônica', tempoSintomas: '2 anos', tratamentosAnteriores: 'Analgésicos sem sucesso', interesse: 'CBD', marcador: SEED_MARKER },
    });
    console.log('✅ Triagem criada');
  } else {
    console.log('ℹ️ Triagem já existia');
  }

  // 7. Sinais Rápidos
  const [existingConsulta] = await db.select().from(consultas).where(and(eq(consultas.pacienteId, targetPaciente.id), like(consultas.observacoes, `%${SEED_MARKER}%`))).limit(1);
  if (!existingConsulta) {
    await db.insert(consultas).values([
      { pacienteId: targetPaciente.id, medicoId: medico.id, dataHora: subDays(hoje, 20), status: 'realizada', observacoes: SEED_MARKER },
      { pacienteId: targetPaciente.id, medicoId: medico.id, dataHora: addDays(hoje, 15), status: 'agendada', observacoes: SEED_MARKER }
    ]);
    console.log('✅ Consultas criadas (1 passada, 1 futura)');
  } else {
    console.log('ℹ️ Consultas já existiam');
  }

  const [existingExame] = await db.select().from(exames).where(and(eq(exames.pacienteId, targetPaciente.id), like(exames.nomeExame, `%${SEED_MARKER}%`))).limit(1);
  if (!existingExame) {
    await db.insert(exames).values({
      pacienteId: targetPaciente.id,
      nomeExame: `Hemograma completo ${SEED_MARKER}`,
      dataExame: subDays(hoje, 30).toISOString(),
    });
    console.log('✅ Exame criado');
  } else {
    console.log('ℹ️ Exame já existia');
  }

  const [existingDoc] = await db.select().from(documentos).where(and(eq(documentos.pacienteId, targetPaciente.id), like(documentos.observacoes, `%${SEED_MARKER}%`))).limit(1);
  if (!existingDoc) {
    await db.insert(documentos).values({
      pacienteId: targetPaciente.id,
      tipo: 'receita_medica',
      urlBlob: 'https://fake.com/receita.pdf',
      dataEmissao: subDays(hoje, 160).toISOString(),
      dataValidade: addDays(hoje, 20).toISOString(),
      observacoes: SEED_MARKER,
    });
    console.log('✅ Documento criado (vencendo em 20d)');
  } else {
    console.log('ℹ️ Documento já existia');
  }

  console.log('\n🎉 Seed concluído com sucesso!');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Erro durante o seed:', err);
  process.exit(1);
});
