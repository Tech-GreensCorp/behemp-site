# O contrato da página `/cadastro/{token}` — para quem constrói a tela

> **Para a Dryelle.** O backend do link único está pronto e testado. Este documento é tudo o que
> a página precisa saber — **não é necessário ler o código da integração** para construí-la.
>
> O caminho é configurável por `CHATPRO_CADASTRO_PATH` (hoje `/cadastro`). Se a tela ficar em
> outro caminho, muda-se a variável e o bot passa a montar o link novo — **sem alterar código**.

---

## O que acontece antes de a página abrir

O paciente conversa no WhatsApp, o bot pergunta **nome completo** e **e-mail**, e recebe na
conversa um link assim:

```
https://<domínio>/cadastro/d81dd006e08bbdaba8488fdf21c2c34f5d480ea3fed8332e5e89c90b11bd54bd
```

Esse token de 64 caracteres hexadecimais é **uso único**, vale **7 dias** por padrão, e é a única
credencial que o paciente tem — ele ainda não tem conta.

## Como ler os dados do link

### Opção A — Server Component (preferida)

Evita um round-trip. É o padrão do repositório (`AGENTS.md`: não chamar Route Handler local
quando a chamada direta resolve).

```tsx
import { notFound } from 'next/navigation';
import { validarTokenDeCadastro, registrarPrimeiroAcesso } from '@/lib/chatpro/token-de-cadastro';

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const resultado = await validarTokenDeCadastro(token);

  if (!resultado.valida) {
    // resultado.motivo: 'invalido' | 'expirado' | 'ja_utilizado' | 'cancelado'
    return <LinkRecusado motivo={resultado.motivo} />;
  }

  await registrarPrimeiroAcesso(resultado.id);

  return (
    <FormularioDeCadastro
      solicitacaoId={resultado.id}
      protocolo={resultado.protocolo}
      nomeCompleto={resultado.nomeCompleto}
      email={resultado.email}
      telefone={resultado.telefone}
    />
  );
}
```

### Opção B — client-side

```
GET /api/chatpro/solicitacao/{token}
```

```jsonc
// 200
{
  "sucesso": true,
  "dados": {
    "protocolo": "SOL-000004",
    "nomeCompleto": "Joana Ribeiro Alves",
    "email": "joana@exemplo.com",
    "telefone": "+5562988771234",
    "expiraEm": "2026-09-16T18:17:51.616Z",
  },
}
```

| HTTP | `codigo`       | O que a tela mostra                                                             |
| ---- | -------------- | ------------------------------------------------------------------------------- |
| 200  | —              | o formulário, pré-preenchido                                                    |
| 404  | `INVALIDO`     | "Link inválido." — **não diga se existiu**; quem chutou não deve descobrir      |
| 410  | `EXPIRADO`     | "Este link expirou. Peça um novo pelo WhatsApp." — e ofereça o caminho de volta |
| 409  | `JA_UTILIZADO` | "Já recebemos seus dados." — é sucesso passado, não erro; não assuste           |
| 410  | `CANCELADO`    | "Fale com o atendimento."                                                       |

## 🔴 As três regras que a tela precisa respeitar

### 1. Todo campo de pré-preenchimento pode vir `null`

Medido na conta real: **existe contato com nome, push_name e contact_name todos vazios.** Assumir
nome presente produz _"Olá, null!"_ — ou, pior, um formulário que trava esperando um dado que a
plataforma não tem.

**O que fazer:** trate cada campo como opcional e **peça o que faltar**. O e-mail costuma vir
(o bot pergunta), mas se vier vazio, o campo aparece em branco e obrigatório.

### 2. Os campos vêm preenchidos, mas devem ser EDITÁVEIS

O telefone é o do WhatsApp. Quem tem um contato diferente precisa poder trocar. O mesmo vale para
o nome — o paciente pode ter digitado errado no WhatsApp.

### 3. Ao enviar o formulário, chame `marcarComoUtilizada`

```ts
import { marcarComoUtilizada } from '@/lib/chatpro/token-de-cadastro';

const consumiu = await marcarComoUtilizada(solicitacaoId);
if (!consumiu) {
  // Outro envio ganhou a corrida (duplo clique é o caso comum).
  // Não é erro: os dados já chegaram. Mostre a confirmação, não uma falha.
}
```

⚠️ **Chame no fim, depois de gravar o cadastro** — não no começo. Se o envio falhar depois de
consumir o token, o paciente fica sem link e sem cadastro.

## O que a página NÃO deve fazer

| Não faça                                             | Por quê                                                                                                               |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Reimplementar "expirou?"                             | a regra de validade mora em `token-de-cadastro.ts`; duplicá-la exige dois deploys coordenados para continuar coerente |
| Colocar o token em log, analytics ou URL de terceiro | ele é a credencial inteira                                                                                            |
| Mostrar o token na tela                              | não há motivo, e ele vaza em print e em screen share                                                                  |
| Buscar dado clínico por esse token                   | ele autentica **uma solicitação de cadastro**, não um paciente. O guarda proíbe                                       |
| Deixar o token na URL após o envio                   | prefira `replace` para a tela de confirmação                                                                          |

## Como testar sem WhatsApp

```bash
# 1. gerar um link (precisa do CHATPRO_INTAKE_SECRET do .env)
curl -s -X POST http://localhost:3000/api/chatpro/intake \
  -H "x-chatpro-intake-secret: $CHATPRO_INTAKE_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"nome":"Joana Ribeiro Alves","email":"joana@exemplo.com","telefone":"62 98877-1234"}'

# 2. a resposta traz linkDeAcesso — abra no navegador
```

Para simular cada recusa, mexa direto na linha:

```sql
-- expirado
update solicitacoes_cadastro set expira_em = now() - interval '1 day' where protocolo = 'SOL-000004';
-- já utilizado
update solicitacoes_cadastro set usado_em = now() where protocolo = 'SOL-000004';
-- cancelado
update solicitacoes_cadastro set status = 'cancelada' where protocolo = 'SOL-000004';
```

## Onde ficam as decisões

`docs/adr/ADR-0015-o-chatpro-entrega-o-link-e-o-webhook-nunca-e-verdade.md` — inclusive **por que**
o token só existe como hash (e portanto por que "reenviar o mesmo link" não existe como operação:
pedir de novo **emite outro** e invalida o anterior).
