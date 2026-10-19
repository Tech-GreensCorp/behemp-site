ALTER TYPE "public"."documento_tipo" ADD VALUE 'contrato_termos';--> statement-breakpoint
ALTER TYPE "public"."documento_tipo" ADD VALUE 'laudo_relatorio';--> statement-breakpoint
ALTER TYPE "public"."documento_tipo" ADD VALUE 'orcamento';--> statement-breakpoint
ALTER TYPE "public"."documento_tipo" ADD VALUE 'outro';--> statement-breakpoint
ALTER TABLE "documentos" ADD COLUMN "tipo_personalizado" text;