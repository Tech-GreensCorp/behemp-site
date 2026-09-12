/**
 * A ABA ABERTA SOBREVIVE AO DEPLOY — o id do build é o mesmo dos dois lados.
 *
 * 🔴 O INCIDENTE, medido em produção em 11/09/2026. O dono estava preenchendo o cadastro,
 * com uploads já feitos, quando um deploy subiu. O log do servidor encheu de:
 *
 *     Error: Failed to find Server Action "008065c0a9b43d5159f5fab6b82ff097c889a321e1".
 *     This request might be from an older or newer deployment.
 *
 * Os ids de Server Action são **hashes gerados no build**. Quando o build troca, a aba que
 * ficou aberta continua chamando o hash antigo, e ele não existe mais no servidor.
 *
 * ⚠️ E A MENSAGEM DA TELA PIORA O CASO: ela diz _"tente novamente em instantes"_ — e tentar
 * de novo **não resolve**, porque a aba continua velha. Só recarregar resolve, e ninguém sabe
 * disso. O paciente tenta, falha, tenta, desiste.
 *
 * 🔴 A CORREÇÃO É O `deploymentId`. O Next compara o id do cliente com o do servidor e, na
 * divergência, força **recarga completa** em vez de navegação — doc oficial: _"triggers a
 * hard navigation (full page reload) instead of a client-side navigation"_.
 *
 * ⚠️ E O PERIGO MORA NA METADE: o id precisa ser o **mesmo** no build e em runtime. Se só o
 * build tiver, o header do servidor nunca bate com o do cliente e **toda** navegação vira
 * recarga completa — o site fica lento sem ninguém entender por quê. Por isso os dois casos
 * abaixo exigem as duas pontas, e não uma.
 *
 * É a mesma família de `o-segredo-cadastrado-chega-ao-servidor`: cadastrar de um lado não
 * basta, o deploy escreve uma lista FIXA e o que fica fora nunca chega ao processo.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..', '..');
const ler = (p: string) => readFileSync(join(RAIZ, p), 'utf8');
const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const CONFIG = semComentarios(ler('next.config.ts'));
const DEPLOY = ler('.github/workflows/deploy.yml').replace(/^\s*#.*$/gm, '');

/** O bloco `env:` do passo que roda `pnpm build`. */
function envDoBuild(): string {
  const i = DEPLOY.indexOf('run: pnpm build');
  expect(i, 'não achei o passo de build').toBeGreaterThan(-1);
  const antes = DEPLOY.slice(0, i);
  return antes.slice(antes.lastIndexOf('env:'));
}

describe('a aba aberta sobrevive ao deploy', () => {
  it('⚠️ VACUIDADE: o deploy tem um passo de build com env', () => {
    expect(envDoBuild()).toContain('NEXT_PUBLIC_APP_URL');
  });

  it('🔴 o `next.config.ts` DECLARA o deploymentId', () => {
    // Sem a declaração, o Next não emite o header nem o atributo, e a comparação não existe.
    expect(CONFIG).toMatch(/deploymentId:/);
  });

  it('🔴 e o valor vem do AMBIENTE, nunca fixo no arquivo', () => {
    // Um valor fixo nunca muda entre deploys — teria a declaração e nenhum efeito.
    const i = CONFIG.indexOf('deploymentId:');
    const linha = CONFIG.slice(i, CONFIG.indexOf('\n', i));
    expect(linha).toContain('process.env.NEXT_DEPLOYMENT_ID');
    expect(linha).not.toMatch(/deploymentId:\s*['"`]/);
  });

  it('🔴 o BUILD recebe o id', () => {
    expect(envDoBuild()).toMatch(/NEXT_DEPLOYMENT_ID:/);
  });

  it('🔴 e o SERVIDOR recebe o MESMO id — metade não basta', () => {
    // Com o id só no build, o header do servidor nunca bate e toda navegação vira recarga.
    expect(DEPLOY).toMatch(/gravar\s+NEXT_DEPLOYMENT_ID/);
  });

  it('🔴 os dois lados usam a MESMA fonte — senão divergem a cada deploy', () => {
    const fonteNoBuild = envDoBuild().match(/NEXT_DEPLOYMENT_ID:\s*\$\{\{\s*([^}]+?)\s*\}\}/)?.[1];
    const fonteNoServidor = DEPLOY.match(
      /gravar\s+NEXT_DEPLOYMENT_ID\s+"\$\{\{\s*([^}]+?)\s*\}\}"/,
    )?.[1];
    expect(fonteNoBuild, 'sem fonte no build').toBeTruthy();
    expect(fonteNoServidor, 'sem fonte no servidor').toBeTruthy();
    expect(fonteNoBuild).toBe(fonteNoServidor);
  });

  it('⚠️ e a fonte muda a cada deploy — um valor constante não protegeria nada', () => {
    const fonte = envDoBuild().match(/NEXT_DEPLOYMENT_ID:\s*\$\{\{\s*([^}]+?)\s*\}\}/)?.[1] ?? '';
    // `github.sha` muda por commit. `github.repository` ou um literal não mudariam.
    expect(fonte).toMatch(/sha|run_id|run_number/);
  });

  it('⚠️ em desenvolvimento o id é vazio — o comportamento de antes fica intacto', () => {
    const i = CONFIG.indexOf('deploymentId:');
    expect(CONFIG.slice(i, CONFIG.indexOf('\n', i))).toMatch(/\|\|\s*undefined/);
  });
});
