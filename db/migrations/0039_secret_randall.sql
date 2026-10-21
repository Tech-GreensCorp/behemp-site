ALTER TYPE "public"."parceiro_evento_tipo" ADD VALUE 'cadastro_transferido';--> statement-breakpoint
ALTER TABLE "consentimentos" ADD COLUMN "idioma" text DEFAULT 'pt' NOT NULL;