/**
 * CRIA AS CONTAS DE LOGIN DE TESTE NO CLERK — uma por papel, para desenvolvimento local.
 *
 * O QUE FAZ
 * Cria (ou reaproveita) três usuários no Clerk com senha, define `publicMetadata.role` em cada um
 * e casa o `clerk_id` com a linha de `users` já criada por `db/seed-perfis-teste.ts`, pelo e-mail.
 * Depois disto, os três fazem login de verdade em /entrar.
 *
 * COMO SE DESFAZ
 *   node scripts/criar-usuarios-clerk-teste.mjs --remover
 * apaga as três contas no Clerk e zera o `clerk_id` das três linhas. Nada mais é tocado.
 *
 * IDEMPOTENTE: sim. Rodar duas vezes não duplica — procura por e-mail antes de criar, e atualiza
 * o papel de quem já existe.
 *
 * 🔴 DE ONDE VEM A CHAVE, E POR QUE ISSO IMPORTA
 * Não há chave do Clerk no `.env` deste ambiente. A que este script usa vem do **modo keyless**
 * do Clerk, que criou uma aplicação temporária sozinho quando o dev server subiu — está em
 * `.clerk/.tmp/keyless.json`, que o `.gitignore` já cobre (linha 87).
 * Consequência: esta aplicação é **temporária e do ambiente local**. Ela não é a conta Clerk de
 * produção, e as contas criadas aqui não existem lá. Para tornar a aplicação permanente, é
 * preciso reivindicá-la pelo `claimUrl` do mesmo arquivo.
 *
 * 🔴 RECUSA RODAR CONTRA PRODUÇÃO: se a chave for `sk_live_`, ou se a DATABASE_URL for do Neon,
 * o script aborta. Criar usuário de teste em produção é incidente, não erro.
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';

/**
 * 🔴 POR QUE O E-MAIL TERMINA EM `+clerk_test@example.com`, E POR QUE NÃO HÁ SENHA
 *
 * A aplicação de desenvolvimento tem `password.used_for_first_factor: false` — medido em
 * 20/08/2026 no `/v1/environment` dela. Ou seja: **senha não entra**, o único primeiro fator
 * habilitado é `email_code`. E um código enviado para `@example.com` não chega a lugar nenhum.
 *
 * A saída não é gambiarra, é um recurso do Clerk para instância de development: e-mail com o
 * subendereço `+clerk_test` é uma **conta de teste**, e o código de verificação dela é fixo em
 * `424242` — nada é enviado. Documentado em clerk.com/docs/testing/test-emails-and-phones.
 *
 * Consequência prática: o login destes três é *e-mail + código 424242*, não e-mail + senha.
 * Se um dia a aplicação passar a aceitar senha como primeiro fator (é uma chave no Dashboard,
 * não na Backend API), a senha abaixo já estará definida e passa a valer também.
 */
const SENHA = 'Be4Hope!Teste2026';
const CODIGO_DE_TESTE = '424242';

const PERFIS = [
  {
    email: 'admin+clerk_test@example.com',
    nome: 'Ana',
    sobrenome: 'Administradora',
    role: 'admin',
  },
  { email: 'medico+clerk_test@example.com', nome: 'Marcos', sobrenome: 'Teste', role: 'medico' },
  {
    email: 'paciente+clerk_test@example.com',
    nome: 'Pedro',
    sobrenome: 'Paciente',
    role: 'paciente',
  },
];

function lerChave() {
  // Ordem: .env explícito ganha do keyless — se alguém configurou a chave, é a dela que vale.
  const doEnv = process.env.CLERK_SECRET_KEY;
  if (doEnv) return { chave: doEnv, origem: 'CLERK_SECRET_KEY do ambiente' };
  try {
    const j = JSON.parse(readFileSync('.clerk/.tmp/keyless.json', 'utf8'));
    if (j.secretKey) return { chave: j.secretKey, origem: 'modo keyless (aplicação temporária)' };
  } catch {
    /* sem keyless */
  }
  throw new Error(
    'Nenhuma chave secreta do Clerk encontrada.\n' +
      'Ou defina CLERK_SECRET_KEY, ou suba o dev server uma vez para o modo keyless criar a app.',
  );
}

function lerUrlDoBanco() {
  // O .env não é carregado automaticamente num .mjs — lemos à mão, só a chave que importa.
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const txt = readFileSync('.env', 'utf8');
  const m = txt.match(/^DATABASE_URL\s*=\s*"?([^"\n\r]+)"?/m);
  if (!m) throw new Error('DATABASE_URL não encontrada no .env.');
  return m[1].trim();
}

function abortarSeProducao(chave, url) {
  if (chave.startsWith('sk_live_')) {
    throw new Error('A chave é sk_live_ (produção). Este script não cria usuário de teste lá.');
  }
  if (/neon\.tech|neon\.build/.test(url)) {
    throw new Error('DATABASE_URL aponta para o Neon. Este script não roda contra produção.');
  }
}

const { chave, origem } = lerChave();
const urlBanco = lerUrlDoBanco();
abortarSeProducao(chave, urlBanco);

async function clerk(caminho, opcoes = {}) {
  const r = await fetch(`https://api.clerk.com/v1${caminho}`, {
    ...opcoes,
    headers: {
      Authorization: `Bearer ${chave}`,
      'Content-Type': 'application/json',
      ...(opcoes.headers ?? {}),
    },
  });
  const corpo = await r.text();
  let json = null;
  try {
    json = corpo ? JSON.parse(corpo) : null;
  } catch {
    /* resposta não-JSON */
  }
  return { ok: r.ok, status: r.status, json, corpo };
}

/** Procura por e-mail. Retorna o usuário do Clerk ou null. */
async function procurar(email) {
  const r = await clerk(`/users?email_address=${encodeURIComponent(email)}&limit=1`);
  if (!r.ok) throw new Error(`busca falhou (${r.status}): ${r.corpo.slice(0, 300)}`);
  const lista = Array.isArray(r.json) ? r.json : (r.json?.data ?? []);
  return lista[0] ?? null;
}

async function criar() {
  console.log(`Chave: ${origem}`);
  console.log(`Banco: ${urlBanco.replace(/:[^:@]*@/, ':***@')}\n`);

  const cliente = new pg.Client({ connectionString: urlBanco });
  await cliente.connect();
  const resultados = [];

  try {
    for (const p of PERFIS) {
      let usuario = await procurar(p.email);

      if (usuario) {
        // Já existe: só garante o papel e a senha, para o login ser previsível.
        const r = await clerk(`/users/${usuario.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            password: SENHA,
            skip_password_checks: true,
            public_metadata: { role: p.role },
          }),
        });
        if (!r.ok) throw new Error(`PATCH ${p.email} (${r.status}): ${r.corpo.slice(0, 400)}`);
        console.log(`  = ${p.role.padEnd(9)} já existia — papel e senha reafirmados`);
      } else {
        const r = await clerk('/users', {
          method: 'POST',
          body: JSON.stringify({
            email_address: [p.email],
            password: SENHA,
            first_name: p.nome,
            last_name: p.sobrenome,
            public_metadata: { role: p.role },
            // Sem isto o Clerk recusa senha que ele considere fraca ou vazada — e aqui a senha
            // é deliberadamente conhecida, porque é credencial de teste local.
            skip_password_checks: true,
          }),
        });
        if (!r.ok) throw new Error(`POST ${p.email} (${r.status}): ${r.corpo.slice(0, 400)}`);
        usuario = r.json;
        console.log(`  + ${p.role.padEnd(9)} criado no Clerk`);
      }

      // Casa com a linha do banco pelo e-mail. Se o seed não rodou, avisa em vez de inventar.
      const upd = await cliente.query(
        'UPDATE users SET clerk_id = $1 WHERE email = $2 RETURNING id',
        [usuario.id, p.email],
      );
      if (upd.rowCount === 0) {
        console.log(`    ⚠️  sem linha em "users" para ${p.email} — rode: pnpm db:seed-perfis`);
      } else {
        console.log(`    clerk_id preenchido em users (${usuario.id})`);
      }
      resultados.push({ ...p, clerkId: usuario.id, noBanco: upd.rowCount > 0 });
    }
  } finally {
    await cliente.end();
  }

  const linha = (t) => `│ ${t.padEnd(72)}│`;
  console.log(`
┌─────────────────────────────────────────────────────────────────────────┐
${linha('CREDENCIAIS DE TESTE — localhost:3000/entrar')}
├─────────────────────────────────────────────────────────────────────────┤
${resultados.map((r) => linha(`${r.role.padEnd(9)} ${r.email}`)).join('\n')}
${linha('')}
${linha(`código de verificação (as três):  ${CODIGO_DE_TESTE}`)}
${linha('')}
${linha('Em /entrar: digite o e-mail, peça o código, digite 424242.')}
${linha('Nenhum e-mail é enviado — é conta de teste do Clerk em development.')}
└─────────────────────────────────────────────────────────────────────────┘

Cada um cai na sua área: admin → /admin · médico → /medico · paciente → /paciente
Para desfazer:  node scripts/criar-usuarios-clerk-teste.mjs --remover
`);
}

async function remover() {
  const cliente = new pg.Client({ connectionString: urlBanco });
  await cliente.connect();
  try {
    for (const p of PERFIS) {
      const u = await procurar(p.email);
      if (u) {
        const r = await clerk(`/users/${u.id}`, { method: 'DELETE' });
        console.log(`  ${r.ok ? '-' : '!'} ${p.email} ${r.ok ? 'removido do Clerk' : r.status}`);
      } else {
        console.log(`  = ${p.email} não existia no Clerk`);
      }
      await cliente.query('UPDATE users SET clerk_id = NULL WHERE email = $1', [p.email]);
    }
  } finally {
    await cliente.end();
  }
  console.log('\nclerk_id zerado nas três linhas. As linhas de "users" seguem lá.');
}

const alvo = process.argv.includes('--remover') ? remover : criar;
alvo()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('\n🔴', e instanceof Error ? e.message : e);
    process.exit(1);
  });
