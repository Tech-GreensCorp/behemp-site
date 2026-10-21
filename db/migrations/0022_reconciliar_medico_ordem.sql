-- ═══════════════════════════════════════════════════════════════════════════════
-- RECONCILIAÇÃO — escrita à mão em 20/08/2026, e o motivo importa.
--
-- O QUE ACONTECEU
-- Existem DUAS migrations numeradas 0007 neste repositório:
--   · 0007_wet_sharon_ventura.sql  → ADD COLUMN config_agenda   (está no journal)
--   · 0007_add_medico_ordem.sql    → ADD COLUMN ordem + crm DROP NOT NULL  (NÃO está)
--
-- O journal só conhece a primeira. Mas o snapshot 0007 registra `ordem` como existente — logo
-- o `db:generate` nunca vai gerar essa coluna: ele acredita que já foi aplicada.
--
-- Resultado: em produção a coluna existe, porque alguém rodou o SQL manual no banco. Em
-- qualquer banco criado do zero pelo journal, ela NÃO existe — e a home quebra com
-- `column medicos.ordem does not exist`, que é como isto foi descoberto.
--
-- POR QUE ESTA MIGRATION É SEGURA EM PRODUÇÃO
-- É idempotente. `ADD COLUMN IF NOT EXISTS` não faz nada onde a coluna existe, e
-- `DROP NOT NULL` sobre coluna já nullable também não. Em produção: no-op. Em banco novo:
-- cria o que faltava.
--
-- POR QUE NÃO MEXI NAS ENTRADAS HISTÓRICAS DO JOURNAL
-- Alterar uma entrada já aplicada muda o que o `db:migrate` acredita sobre bancos que já
-- rodaram. Acrescentar no fim é a operação que não reescreve o passado.
--
-- ⚠️ O arquivo `0007_add_medico_ordem.sql` FICA onde está, fora do journal. Apagá-lo removeria
-- a evidência de como a divergência aconteceu.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE "medicos" ADD COLUMN IF NOT EXISTS "ordem" integer;--> statement-breakpoint
ALTER TABLE "medicos" ALTER COLUMN "crm" DROP NOT NULL;
