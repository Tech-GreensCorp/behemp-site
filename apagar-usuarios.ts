import { neon } from '@neondatabase/serverless';

async function apagar() {
  const sql = neon(process.env.DATABASE_URL!);
  const emails = [
    'joao.bernardino@greens-corp.com',
    'victor@greens-corp.com',
    'guilhermejoazeiro@gmail.com',
    'guilherme@greens-corp.com',
  ];

  for (const email of emails) {
    const users = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (users.length === 0) continue;
    const user = users[0];

    try {
      await sql`DELETE FROM mensagens WHERE remetente_id = ${user.id}`;
    } catch {}
    try {
      await sql`DELETE FROM participantes_grupo WHERE user_id = ${user.id}`;
    } catch {}

    try {
      await sql`DELETE FROM logs_auditoria WHERE user_id = ${user.id}`;
    } catch {}
    try {
      await sql`DELETE FROM notificacoes WHERE user_id = ${user.id}`;
    } catch {}
    try {
      await sql`DELETE FROM medicos WHERE user_id = ${user.id}`;
    } catch {}

    try {
      const paciente = await sql`SELECT id FROM pacientes WHERE user_id = ${user.id}`;
      if (paciente.length > 0) {
        try {
          await sql`DELETE FROM logs_auditoria WHERE paciente_id = ${paciente[0].id}`;
        } catch {}
        try {
          await sql`DELETE FROM teleconsultas WHERE paciente_id = ${paciente[0].id}`;
        } catch {}
        try {
          await sql`DELETE FROM consultas WHERE paciente_id = ${paciente[0].id}`;
        } catch {}
        try {
          await sql`DELETE FROM prescricoes WHERE paciente_id = ${paciente[0].id}`;
        } catch {}
        try {
          await sql`DELETE FROM prontuarios WHERE paciente_id = ${paciente[0].id}`;
        } catch {}
        try {
          await sql`DELETE FROM pacientes WHERE user_id = ${user.id}`;
        } catch {}
      }
    } catch {}

    try {
      await sql`DELETE FROM users WHERE id = ${user.id}`;
      console.log(`✅ ${email} deletado com sucesso do banco de dados local!`);
    } catch (e) {
      console.log(`Falha ao apagar user ${email} do banco. Causa dependência FK:`, e);
    }
  }
  console.log('Limpeza de DB finalizada.');
}

apagar().then(() => process.exit(0));
