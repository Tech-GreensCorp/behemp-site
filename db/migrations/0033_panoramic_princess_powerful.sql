--> 🔴 ESCRITA À MÃO, substituindo o que o drizzle-kit gerou.
--
-- O QUE O DRIZZLE GEROU, E POR QUE NÃO SERVE:
--   ALTER COLUMN tipo SET DATA TYPE text;
--   DROP TYPE parceiro_evento_tipo;
--   CREATE TYPE parceiro_evento_tipo AS ENUM('receita_emitida','anvisa_aprovada');
--   ALTER COLUMN tipo SET DATA TYPE parceiro_evento_tipo USING tipo::parceiro_evento_tipo;
--
-- O último passo FALHA se existir qualquer linha com 'anvisa_concluida' — o valor não
-- existe no tipo novo, e o cast estoura. O banco local está vazio; produção não se sabe,
-- e uma migration não pode depender de a tabela estar vazia.
--
-- RENAME VALUE faz a mesma coisa preservando os dados: as linhas existentes passam a ler
-- o nome novo, porque é o MESMO valor que mudou de rótulo.
--
-- Idempotente: o IF checa se o valor antigo ainda existe antes de renomear.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'parceiro_evento_tipo' AND e.enumlabel = 'anvisa_concluida'
  ) THEN
    ALTER TYPE "public"."parceiro_evento_tipo" RENAME VALUE 'anvisa_concluida' TO 'anvisa_aprovada';
  END IF;
END $$;
