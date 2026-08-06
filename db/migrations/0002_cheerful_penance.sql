CREATE TYPE "public"."jornada_fase" AS ENUM('acolhimento', 'avaliacao_medica', 'burocracia_anvisa', 'logistica', 'acompanhamento_continuo');--> statement-breakpoint
ALTER TABLE "pacientes" ADD COLUMN "jornada_fase" "jornada_fase" DEFAULT 'acolhimento' NOT NULL;--> statement-breakpoint
CREATE INDEX "pacientes_jornada_fase_idx" ON "pacientes" USING btree ("jornada_fase");