ALTER TABLE "produto_arquivos" ALTER COLUMN "categoria" SET DATA TYPE text;--> statement-breakpoint
UPDATE "produto_arquivos" SET "categoria" = 'ficha_tecnica' WHERE "categoria" = 'documento';--> statement-breakpoint
UPDATE "produto_arquivos" SET "categoria" = 'coa' WHERE "categoria" = 'formula';--> statement-breakpoint
DROP TYPE "public"."produto_arquivo_categoria";--> statement-breakpoint
CREATE TYPE "public"."produto_arquivo_categoria" AS ENUM('imagem', 'coa', 'ficha_tecnica', 'ficha_informativa');--> statement-breakpoint
ALTER TABLE "produto_arquivos" ALTER COLUMN "categoria" SET DATA TYPE "public"."produto_arquivo_categoria" USING "categoria"::"public"."produto_arquivo_categoria";