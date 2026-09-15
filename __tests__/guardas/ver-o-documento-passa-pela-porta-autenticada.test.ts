/**
 * Guarda: ver um documento passa pela porta que autentica, confere escopo e audita.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * Em 14/09/2026 o dono pediu um botão que abre o documento num modal, e a frase que define o
 * requisito é a última: _"isso é essencial até pra validar o que está chegando entre
 * empresas"_. A tela dizia "✓ rg.jpg" — o que afirma que um arquivo **chegou**, não que ele
 * **é o que diz ser**. O nome do arquivo é escolhido por quem envia.
 *
 * 🔴 E O ATALHO QUE ESTE GUARDA IMPEDE É CURTO E TENTADOR. O registro já traz `urlBlob`;
 * usá-lo no `src` é uma linha a menos e funciona na máquina de quem escreve. Está errado duas
 * vezes:
 *
 * 1. **blob novo é PRIVADO** e não abre por link direto — é exatamente para isso que ele é
 *    privado. A imagem sairia quebrada, e só em produção;
 * 2. **blob antigo é PÚBLICO** — e aí funciona, que é o pior caso: entrega RG, laudo e
 *    procuração assinada **sem autenticação, sem escopo de objeto e sem auditoria**, que é o
 *    Item 6 inteiro voltando por uma porta nova.
 *
 * A rota `GET /api/documentos/{id}/arquivo` já resolve os dois mundos, e a regra do
 * repositório é explícita: _"Entrega por Route Handler autenticado ou URL assinada de vida
 * curta. Nunca a URL crua."_
 *
 * ⚠️ E A AUDITORIA SÓ VALE SE FOR VERDADE. A rota grava `acao: 'visualizar'` a cada GET.
 * Montar o `<img>` com o modal fechado gravaria "visualizou" para quem só abriu a página — e
 * registro que afirma o que não aconteceu é pior que registro nenhum, porque alguém vai
 * defender uma decisão com ele.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { formatoDoArquivo } from '../../components/shared/documentos/visualizador-de-documento';

const RAIZ = join(import.meta.dirname, '..', '..');
const VISUALIZADOR = 'components/shared/documentos/visualizador-de-documento.tsx';

const fonte = readFileSync(join(RAIZ, VISUALIZADOR), 'utf8');

/**
 * 🔴 A ORDEM DAS TRÊS SUBSTITUIÇÕES É A CORREÇÃO, e ela nasceu de um defeito deste arquivo.
 *
 * A primeira versão tirava o comentário de JSX primeiro, com `/\{\s*\/\*[\s\S]*?\*\/\s*\}/`.
 * Parece preciso e não é: quando o `*​/` mais próximo **não** vem seguido de `}`, o motor
 * retrocede e estende o casamento até um `*​/}` lá adiante — **engolindo o código no meio**.
 * Medido: o arquivo caiu de 10.075 para 4.302 caracteres, e dois casos ficaram vermelhos
 * procurando linhas que existem.
 *
 * Tirando o bloco `/* … *​/` PRIMEIRO, o miolo do comentário de JSX já sai, e o que resta é
 * um `{ }` vazio — que a terceira linha remove sem ambiguidade nenhuma.
 */
const codigo = fonte
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1')
  .replace(/\{\s*\}/g, '');
const compacto = codigo.replace(/\s+/g, ' ');

/**
 * ⚠️ TRAVA CONTRA O PRÓPRIO INSTRUMENTO. Um limpador ganancioso apaga código e os casos
 * ficam vermelhos pelo motivo errado — ou, pior, VERDES, quando o que sumiu era o que eles
 * proibiam. Metade do arquivo é o limite: comentário aqui é denso, mas não é tudo.
 */
if (codigo.length < fonte.length * 0.3) {
  throw new Error(
    `O limpador de comentários comeu código: ${fonte.length} → ${codigo.length} caracteres.`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. A REGRA DE FORMATO — executada, não lida
// ═══════════════════════════════════════════════════════════════════════════════

describe('o formato sai do nome do arquivo, porque a tabela não guarda MIME', () => {
  it.each([
    ['rg.jpg', 'imagem'],
    ['RG.JPEG', 'imagem'],
    ['comprovante.PNG', 'imagem'],
    ['foto.webp', 'imagem'],
    ['digitalizado.avif', 'imagem'],
    ['receita.pdf', 'pdf'],
    ['RECEITA.PDF', 'pdf'],
  ])('%s → %s', (nome, esperado) => {
    expect(formatoDoArquivo(nome)).toBe(esperado);
  });

  it.each([
    ['documento.docx'],
    ['arquivo.zip'],
    ['sem-extensao'],
    ['   '],
    [''],
    [null],
    [undefined],
  ])('%s → desconhecido, e nunca uma tela em branco', (nome) => {
    expect(formatoDoArquivo(nome as string | null | undefined)).toBe('desconhecido');
  });

  it('🔴 o desconhecido NÃO é tratado como imagem', () => {
    /**
     * Cair para `imagem` faria o `<img>` falhar e a tela mostrar o ícone de imagem quebrada —
     * que o paciente lê como "meu documento se perdeu". O estado próprio existe para dizer a
     * verdade: não sabemos desenhar isto aqui.
     */
    expect(formatoDoArquivo('contrato.docx')).not.toBe('imagem');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. A PORTA
// ═══════════════════════════════════════════════════════════════════════════════

describe('o arquivo vem da rota autenticada, nunca do blob', () => {
  it('🔴 usa /api/documentos/{id}/arquivo', () => {
    expect(compacto, 'o endereço da rota autenticada sumiu').toMatch(
      /\/api\/documentos\/\$\{documentoId\}\/arquivo/,
    );
  });

  it('🔴 NÃO existe urlBlob em lugar nenhum do componente', () => {
    /**
     * Nem como prop, nem como fallback, nem "só para o caso de". Uma prop que aceita a URL do
     * blob é uma porta aberta esperando alguém passar — e quem passar não vai saber que
     * passou, porque com documento antigo funciona.
     */
    expect(
      /urlBlob/i.test(codigo),
      'o componente passou a conhecer a URL do blob — ela fura autenticação e auditoria',
    ).toBe(false);
    expect(
      /blob\.vercel-storage\.com/i.test(codigo),
      'uma URL de blob foi escrita no componente',
    ).toBe(false);
  });

  it('🔴 todo caminho que busca bytes usa o MESMO endereço', () => {
    // Um `src`/`href` a mais, apontando para outro lugar, é o defeito voltando pela borda.
    const alvos = [...compacto.matchAll(/(?:src|href)=\{([^}]+)\}/g)].map((m) => m[1].trim());
    expect(
      alvos.length,
      'nenhum src/href encontrado: o guarda ficou sem o que medir',
    ).toBeGreaterThanOrEqual(2);
    for (const alvo of alvos) {
      expect(alvo, `um src/href aponta para fora da rota autenticada: ${alvo}`).toBe('endereco');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. QUEM DESCOBRE O `id` NÃO ENTREGA O BLOB JUNTO
// ═══════════════════════════════════════════════════════════════════════════════

describe('a action que lista os documentos devolve metadado, não bytes nem URL', () => {
  const ACTION = 'app/_actions/documentos-do-paciente.ts';
  const acao = readFileSync(join(RAIZ, ACTION), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('🔴 `urlBlob` não sai no select nem no retorno', () => {
    /**
     * A coluna está na mesma linha e incluí-la é um caractere. Com documento antigo (blob
     * público) isso entrega RG e procuração assinada a quem ler a resposta da action no
     * navegador — sem autenticação, sem escopo e sem auditoria.
     */
    expect(
      /urlBlob|url_blob/i.test(acao),
      'a action passou a carregar a URL do blob — ela fura a rota autenticada',
    ).toBe(false);
  });

  it('🔴 o paciente vem da SESSÃO, e não existe parâmetro de paciente', () => {
    /**
     * Um `pacienteId` recebido é OWASP API1 por um caminho novo: papel certo, id de outro.
     * O que não é recebido não pode ser trocado.
     */
    expect(acao, 'a action deixou de resolver o paciente pela sessão').toMatch(
      /obterUsuarioAtual\(\)/,
    );
    expect(acao, 'a action deixou de amarrar a consulta ao clerkId da sessão').toMatch(
      /users\.clerkId/,
    );
    expect(
      /documentosDoPacienteAtual\(\s*[a-zA-Z]/.test(acao),
      'a action passou a receber parâmetro — e o alvo virou escolha do cliente',
    ).toBe(false);
  });

  it('documento apagado não reaparece por uma tela nova', () => {
    expect(acao, 'o filtro de soft delete sumiu').toMatch(/isNull\(documentos\.deletedAt\)/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. A AUDITORIA DIZ A VERDADE
// ═══════════════════════════════════════════════════════════════════════════════

describe('o arquivo só é buscado quando alguém de fato abre', () => {
  it('🔴 a imagem e o PDF montam condicionados a `aberto`', () => {
    /**
     * A rota audita a cada GET. Montar fechado gravaria "visualizou" para quem só passou pela
     * página — e uma auditoria inflada é pior que ausente: ela parece prova.
     */
    for (const marca of ['<img', '<iframe']) {
      const i = compacto.indexOf(marca);
      expect(i, `${marca} sumiu do componente`).toBeGreaterThan(-1);
      // A condição do bloco JSX que envolve o elemento precisa citar `aberto`.
      const antes = compacto.slice(Math.max(0, i - 220), i);
      expect(antes, `${marca} deixou de depender de \`aberto\``).toMatch(/\baberto\b/);
    }
  });

  it('o estado começa fechado', () => {
    /**
     * ⚠️ A DECLARAÇÃO EXATA, não `useState(false)` solto. A primeira versão casava com
     * qualquer `useState(false)` do arquivo — e `falhou` é um deles. A sabotagem que fazia o
     * modal nascer ABERTO passou verde: o modal aberto dispara o GET e a auditoria no
     * carregamento da página, que é o defeito que a seção inteira existe para impedir.
     */
    expect(compacto, 'o modal passou a nascer aberto').toMatch(
      /const \[aberto, setAberto\] = useState\(false\)/,
    );
  });
});
