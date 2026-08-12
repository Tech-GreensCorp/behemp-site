import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
import { eq } from 'drizzle-orm';

const PRODUTOS_SEED = [
  {
    nome: 'Greens MED 6300mg Full Spectrum',
    marca: 'Greens MED',
    volumeMl: 30,
    totalGotas: 900,
    cbdMgPorGota: '6.660',
    thcMgPorGota: '0.330',
    tipoEspectro: 'full' as const,
    nanotecnologia: true,
  },
  {
    nome: 'Greens MED 9000mg Broad Spectrum',
    marca: 'Greens MED',
    volumeMl: 30,
    totalGotas: 900,
    cbdMgPorGota: '10.000',
    thcMgPorGota: '0.000',
    tipoEspectro: 'broad' as const,
    nanotecnologia: true,
  },
  {
    nome: 'Greens LIFE 6000mg Isolated',
    marca: 'Greens LIFE',
    volumeMl: 30,
    totalGotas: 900,
    cbdMgPorGota: '6.660',
    thcMgPorGota: '0.000',
    tipoEspectro: 'isolado' as const,
    nanotecnologia: false,
  },
  {
    nome: 'Greens LIFE 1500mg Isolated',
    marca: 'Greens LIFE',
    volumeMl: 30,
    totalGotas: 900,
    cbdMgPorGota: '1.660',
    thcMgPorGota: '0.000',
    tipoEspectro: 'isolado' as const,
    nanotecnologia: false,
  },
  {
    nome: 'Greens LIFE 1500mg Broad Spectrum',
    marca: 'Greens LIFE',
    volumeMl: 30,
    totalGotas: 900,
    cbdMgPorGota: '1.660',
    thcMgPorGota: '0.000',
    tipoEspectro: 'broad' as const,
    nanotecnologia: false,
  },
  {
    nome: 'Greens LIFE 1500mg Full Spectrum',
    marca: 'Greens LIFE',
    volumeMl: 30,
    totalGotas: 900,
    cbdMgPorGota: '1.660',
    thcMgPorGota: '0.080',
    tipoEspectro: 'full' as const,
    nanotecnologia: false,
  },
];

async function seedProdutos() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL não configurada. Crie o arquivo .env.local');
    process.exit(1);
  }

  const sql = neon(databaseUrl);
  const db = drizzle({ client: sql, schema });

  console.log('🌱 Iniciando seed de produtos...');
  
  for (const produto of PRODUTOS_SEED) {
    const existe = await db.query.medicamentos.findFirst({
      where: eq(schema.medicamentos.nome, produto.nome),
    });
    
    if (!existe) {
      console.log(`Inserindo: ${produto.nome}`);
      await db.insert(schema.medicamentos).values({
        ...produto,
        gotasPorMl: Math.round(produto.totalGotas / produto.volumeMl),
      });
    } else {
      console.log(`Já existe: ${produto.nome}`);
    }
  }
  
  // Garante que a configuração de alertas exista
  const { alertasConfig } = await import('./schema/alertas-config');
  const existeConfig = await db.select().from(schema.alertasConfig).limit(1);
  if (existeConfig.length === 0) {
    console.log('Inserindo configuração padrão de alertas...');
    await db.insert(schema.alertasConfig).values({});
  }
  
  console.log('✅ Seed finalizado!');
  process.exit(0);
}

seedProdutos().catch((err) => {
  console.error('❌ Erro no seed:', err);
  process.exit(1);
});
