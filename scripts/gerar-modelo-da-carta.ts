/**
 * Gera o modelo do PDF da carta a partir do .docx aprovado.
 *
 * O que faz ..... lê `lib/comunicados/modelo/CARTA-PACIENTES-DOACAO_VF.docx` e grava, ao lado dele,
 *                 `carta-doacao.json` (blocos, runs e formatação) e `logo.ts` (a logo em base64).
 * Como se desfaz  `git checkout -- lib/comunicados/modelo/carta-doacao.json lib/comunicados/modelo/logo.ts`.
 * Idempotente ... sim: o mesmo .docx gera os mesmos arquivos.
 *
 * Quando o texto da carta mudar: troque o .docx, rode `npx tsx scripts/gerar-modelo-da-carta.ts` e
 * commit os três arquivos juntos. O guarda `o-comunicado-assina-so-pelo-docusign` fica vermelho se
 * o JSON não corresponder ao .docx.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { docxParaModelo } from '../lib/comunicados/docx-para-modelo';

const pasta = join(__dirname, '..', 'lib', 'comunicados', 'modelo');
const { modelo, logo } = docxParaModelo(
  readFileSync(join(pasta, 'CARTA-PACIENTES-DOACAO_VF.docx')),
);

writeFileSync(join(pasta, 'carta-doacao.json'), JSON.stringify(modelo, null, 2) + '\n');
writeFileSync(
  join(pasta, 'logo.ts'),
  `/** Logo do cabeçalho da carta (word/media/image1.jpg do .docx). GERADO por scripts/gerar-modelo-da-carta.ts. */\nexport const LOGO_JPG_BASE64 =\n  '${logo.toString('base64')}';\n`,
);
console.log(`modelo: ${modelo.blocos.length} blocos · logo: ${logo.length} bytes`);
