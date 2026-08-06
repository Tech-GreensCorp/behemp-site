/**
 * Seed mock para teste do fluxo ANVISA.
 * Paciente: joaogabrieldiniz23@gmail.com
 * Médico: Dr. Sidarta (já cadastrado na plataforma)
 *
 * Uso: npx tsx --env-file=.env scripts/seed-mock-anvisa.ts
 *
 * Idempotente — pode ser rodado múltiplas vezes sem duplicar dados.
 */

import { db } from '../lib/db';
import { users, pacientes, medicos, consultas, prescricoes } from '../db/schema';
import { eq, and, isNull, ilike } from 'drizzle-orm';
import { addDays } from 'date-fns';

const EMAIL_PACIENTE = 'joaogabrieldiniz23@gmail.com';
const NOME_MEDICO = 'sidarta'; // busca por ILIKE — case insensitive

async function main() {
  console.log('\n🌱 Iniciando seed mock para fluxo ANVISA...\n');

  // ── 1. Buscar paciente pelo email ──────────────────────────────
  const [userPaciente] = await db
    .select({ id: users.id, email: users.email, role: users.role, clerkId: users.clerkId })
    .from(users)
    .where(eq(users.email, EMAIL_PACIENTE))
    .limit(1);

  if (!userPaciente) {
    console.error(`❌ Usuário ${EMAIL_PACIENTE} não encontrado no banco.`);
    console.error('   Faça login com este email primeiro para criar o usuário.');
    process.exit(1);
  }
  console.log(`✅ Paciente encontrado: ${userPaciente.email} | role: ${userPaciente.role}`);

  // ── 2. Buscar Dr. Sidarta no banco ─────────────────────────────
  // Busca pelo nome do usuário vinculado ao médico (case insensitive)
  const [userSidarta] = await db
    .select({ id: users.id, nome: users.nome, email: users.email })
    .from(users)
    .where(ilike(users.nome, `%${NOME_MEDICO}%`))
    .limit(1);

  if (!userSidarta) {
    console.error('❌ Dr. Sidarta não encontrado na tabela users.');
    console.error('   Verifique se o nome está correto no banco.');
    process.exit(1);
  }
  console.log(`✅ Dr. Sidarta encontrado: ${userSidarta.nome} | ${userSidarta.email}`);

  // Buscar o registro de médico do Dr. Sidarta
  const [medicoSidarta] = await db
    .select({ id: medicos.id, crm: medicos.crm, especialidade: medicos.especialidade })
    .from(medicos)
    .where(eq(medicos.userId, userSidarta.id))
    .limit(1);

  if (!medicoSidarta) {
    console.error('❌ Registro de médico não encontrado para o Dr. Sidarta.');
    console.error('   Verifique se o perfil de médico foi criado corretamente.');
    process.exit(1);
  }
  console.log(`✅ Perfil médico: ${medicoSidarta.id} | CRM: ${medicoSidarta.crm ?? 'não informado'} | ${medicoSidarta.especialidade}`);

  // ── 3. Verificar/criar registro de paciente ────────────────────
  let paciente = await db
    .select()
    .from(pacientes)
    .where(and(eq(pacientes.userId, userPaciente.id), isNull(pacientes.deletedAt)))
    .limit(1)
    .then(r => r[0]);

  if (!paciente) {
    console.log('⚠️  Registro de paciente não encontrado. Criando...');
    const [novoPaciente] = await db.insert(pacientes).values({
      userId: userPaciente.id,
      medicoId: medicoSidarta.id,
      status: 'em_tratamento',
      jornadaFase: 'burocracia_anvisa',
      patologia: 'Epilepsia refratária',
      cpf: '000.000.000-00',
      dataNascimento: '1990-01-01',
      genero: 'Masculino',
      cidade: 'São Paulo',
      uf: 'SP',
      cep: '01310-100',
      endereco: 'Av. Paulista, 1000, Bela Vista',
    }).returning();

    paciente = novoPaciente;
    console.log(`✅ Paciente criado: ${paciente.id}`);
  } else {
    console.log(`✅ Paciente encontrado: ${paciente.id}`);

    // Garantir que está vinculado ao Dr. Sidarta
    if (paciente.medicoId !== medicoSidarta.id) {
      await db.update(pacientes)
        .set({ medicoId: medicoSidarta.id })
        .where(eq(pacientes.id, paciente.id));
      console.log(`✅ Paciente vinculado ao Dr. Sidarta`);
      paciente = { ...paciente, medicoId: medicoSidarta.id };
    }
  }

  // ── 4. Verificar/criar consulta realizada ──────────────────────
  const consultaExistente = await db
    .select({ id: consultas.id, status: consultas.status })
    .from(consultas)
    .where(
      and(
        eq(consultas.pacienteId, paciente.id),
        eq(consultas.medicoId, medicoSidarta.id),
        eq(consultas.status, 'realizada'),
        isNull(consultas.deletedAt),
      ),
    )
    .limit(1)
    .then(r => r[0]);

  let consultaId: string;

  if (!consultaExistente) {
    console.log('⚠️  Nenhuma consulta realizada com Dr. Sidarta. Criando...');
    const [novaConsulta] = await db.insert(consultas).values({
      pacienteId: paciente.id,
      medicoId: medicoSidarta.id,
      dataHora: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 dias atrás
      status: 'realizada',
      observacoes: 'Consulta inicial com Dr. Sidarta — avaliação clínica para uso de cannabis medicinal. Paciente com epilepsia refratária há 5 anos, sem resposta satisfatória a anticonvulsivantes convencionais. Indicado uso de CBD full spectrum.',
    }).returning();

    consultaId = novaConsulta.id;
    console.log(`✅ Consulta mock criada: ${consultaId} | status: realizada`);
  } else {
    consultaId = consultaExistente.id;
    console.log(`✅ Consulta realizada encontrada: ${consultaId}`);
  }

  // ── 5. Verificar/criar prescrição emitida ──────────────────────
  const prescricaoExistente = await db
    .select({ id: prescricoes.id, status: prescricoes.status })
    .from(prescricoes)
    .where(
      and(
        eq(prescricoes.pacienteId, paciente.id),
        eq(prescricoes.medicoId, medicoSidarta.id),
        isNull(prescricoes.deletedAt),
      ),
    )
    .limit(1)
    .then(r => r[0]);

  if (!prescricaoExistente) {
    console.log('⚠️  Nenhuma prescrição encontrada. Criando prescrição mock do Dr. Sidarta...');
    const [novaPrescricao] = await db.insert(prescricoes).values({
      medicoId: medicoSidarta.id,
      pacienteId: paciente.id,
      consultaId,
      tipo: 'simples',
      status: 'emitida',
      medicamentos: [
        {
          nome: 'CBD Full Spectrum',
          dose: '25mg/mL',
          forma: 'Óleo sublingual',
          posologia: '10 gotas, 3x ao dia, via sublingual',
          quantidade: '1 frasco (30mL)',
        },
      ],
      diagnostico: 'Epilepsia refratária — uso compassivo de cannabis medicinal',
      cid: 'G40.9',
      observacoes: 'Paciente com histórico de crises convulsivas frequentes. Indicação de CBD como terapia adjuvante conforme avaliação clínica.',
      orientacoes: 'Iniciar com dose baixa (5 gotas 2x/dia) e aumentar gradualmente. Retorno em 30 dias para reavaliação.',
      validade: addDays(new Date(), 30),
      assinadaDigital: false,
    }).returning();

    console.log(`✅ Prescrição mock criada: ${novaPrescricao.id} | status: emitida | médico: Dr. Sidarta`);
  } else {
    // Garantir que está com status emitida para desbloquear ANVISA
    if (prescricaoExistente.status === 'rascunho' || prescricaoExistente.status === 'cancelada') {
      await db.update(prescricoes)
        .set({ status: 'emitida' })
        .where(eq(prescricoes.id, prescricaoExistente.id));
      console.log(`✅ Prescrição atualizada para status: emitida`);
    } else {
      console.log(`✅ Prescrição encontrada: ${prescricaoExistente.id} | status: ${prescricaoExistente.status}`);
    }
  }

  // ── 6. Resumo final ────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  console.log('✅ SEED CONCLUÍDO COM SUCESSO!\n');
  console.log('📋 Resumo:');
  console.log(`   Paciente:  ${EMAIL_PACIENTE}`);
  console.log(`   Médico:    Dr. ${userSidarta.nome}`);
  console.log(`   Consulta:  realizada ✅`);
  console.log(`   Prescrição: emitida ✅`);
  console.log('\n🚀 Acesse: http://localhost:3000/paciente/anvisa');
  console.log('   O botão "Iniciar Processo" deve estar desbloqueado.\n');
}

main()
  .catch((err) => {
    console.error('❌ Erro no seed:', err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
