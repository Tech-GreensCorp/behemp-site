
import { clerkClient } from '@clerk/nextjs/server';
import { db } from './lib/db';
import { users, pacientes } from './db/schema';

async function run() {
  try {
    const email = 'joaogabrieldiniz23+paciente100@gmail.com';
    const password = 'Be4Hope_Paciente2026!';
    
    console.log('Criando usuário no Clerk...');
    const client = await clerkClient();
    const clerkUser = await client.users.createUser({
      emailAddress: [email],
      password,
      firstName: 'Paciente',
      lastName: 'Teste',
      publicMetadata: { role: 'paciente' }
    });

    console.log('Usuário criado no Clerk. ID:', clerkUser.id);
    
    console.log('Inserindo no banco de dados local...');
    const [user] = await db.insert(users).values({
      email,
      nome: 'Paciente Teste',
      clerkId: clerkUser.id,
      role: 'paciente',
    }).returning();

    await db.insert(pacientes).values({
      userId: user.id,
      status: 'aguardando_consulta',
      jornadaFase: 'acolhimento',
    });

    console.log('--- SUCESSO ---');
    console.log('Email:', email);
    console.log('Senha:', password);
  } catch (err) {
    console.error('Erro:', err);
  }
}

run();
