CREATE TYPE "public"."consumo_alcool" AS ENUM('nao_consome', 'regular', 'ocasional');--> statement-breakpoint
CREATE TYPE "public"."evolucao_tipo" AS ENUM('positiva', 'estavel', 'negativa');--> statement-breakpoint
CREATE TYPE "public"."qualidade_sono_enum" AS ENUM('ruim', 'regular', 'boa', 'excelente');--> statement-breakpoint
CREATE TYPE "public"."tabagismo" AS ENUM('nunca_fumou', 'ex_fumante', 'fumante');--> statement-breakpoint
ALTER TYPE "public"."documento_tipo" ADD VALUE 'documento_pessoal';--> statement-breakpoint
ALTER TYPE "public"."documento_tipo" ADD VALUE 'oficio_anvisa';--> statement-breakpoint
CREATE TABLE "exames" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paciente_id" text NOT NULL,
	"nome_exame" text NOT NULL,
	"data_exame" date NOT NULL,
	"observacoes" text,
	"url_arquivo" text,
	"nome_arquivo" text,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ajustes_dosagem" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paciente_id" text NOT NULL,
	"data_ajuste" date NOT NULL,
	"proxima_revisao" date,
	"motivo_ajuste" text NOT NULL,
	"criado_por" text NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "itens_ajuste_dosagem" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ajuste_id" text NOT NULL,
	"tipo_canabinoide" text NOT NULL,
	"nova_dosagem" text NOT NULL,
	"dosagem_anterior" text,
	"frequencia" text NOT NULL,
	"concentracao_thc" text,
	"concentracao_cbd" text,
	"via_administracao" text
);
--> statement-breakpoint
CREATE TABLE "relatorios" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paciente_id" text NOT NULL,
	"titulo" text NOT NULL,
	"url_pdf" text,
	"criado_por" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anamneses" ALTER COLUMN "conteudo" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "evolucoes" ALTER COLUMN "qualidade_sono" SET DATA TYPE text USING CASE WHEN "qualidade_sono" IS NULL THEN NULL WHEN "qualidade_sono" <= 3 THEN 'ruim' WHEN "qualidade_sono" <= 5 THEN 'regular' WHEN "qualidade_sono" <= 7 THEN 'boa' ELSE 'excelente' END;--> statement-breakpoint
ALTER TABLE "evolucoes" ALTER COLUMN "qualidade_sono" SET DATA TYPE "public"."qualidade_sono_enum" USING "qualidade_sono"::"public"."qualidade_sono_enum";--> statement-breakpoint
ALTER TABLE "evolucoes" ALTER COLUMN "bem_estar" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "anamneses" ADD COLUMN "queixa_principal" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "anamneses" ADD COLUMN "historia_doenca_atual" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "anamneses" ADD COLUMN "doencas_previas" text;--> statement-breakpoint
ALTER TABLE "anamneses" ADD COLUMN "medicamentos_em_uso" text;--> statement-breakpoint
ALTER TABLE "anamneses" ADD COLUMN "alergias" text;--> statement-breakpoint
ALTER TABLE "anamneses" ADD COLUMN "historico_familiar" text;--> statement-breakpoint
ALTER TABLE "anamneses" ADD COLUMN "historia_social" text;--> statement-breakpoint
ALTER TABLE "anamneses" ADD COLUMN "tabagismo" "tabagismo" NOT NULL DEFAULT 'nunca_fumou';--> statement-breakpoint
ALTER TABLE "anamneses" ADD COLUMN "consumo_alcool" "consumo_alcool" NOT NULL DEFAULT 'nao_consome';--> statement-breakpoint
ALTER TABLE "anamneses" ADD COLUMN "qualidade_sono" "qualidade_sono_enum" NOT NULL DEFAULT 'regular';--> statement-breakpoint
ALTER TABLE "anamneses" ADD COLUMN "atividade_fisica" text;--> statement-breakpoint
ALTER TABLE "anamneses" ADD COLUMN "nivel_dor" integer;--> statement-breakpoint
ALTER TABLE "anamneses" ADD COLUMN "objetivos_tratamento" text;--> statement-breakpoint
ALTER TABLE "anamneses" ADD COLUMN "uso_previo_cannabis" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "evolucoes" ADD COLUMN "tipo" "evolucao_tipo" NOT NULL DEFAULT 'estavel';--> statement-breakpoint
ALTER TABLE "evolucoes" ADD COLUMN "sintomas_atuais" text;--> statement-breakpoint
ALTER TABLE "evolucoes" ADD COLUMN "efeitos_colaterais" text;--> statement-breakpoint
ALTER TABLE "exames" ADD CONSTRAINT "exames_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ajustes_dosagem" ADD CONSTRAINT "ajustes_dosagem_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ajustes_dosagem" ADD CONSTRAINT "ajustes_dosagem_criado_por_medicos_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."medicos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itens_ajuste_dosagem" ADD CONSTRAINT "itens_ajuste_dosagem_ajuste_id_ajustes_dosagem_id_fk" FOREIGN KEY ("ajuste_id") REFERENCES "public"."ajustes_dosagem"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relatorios" ADD CONSTRAINT "relatorios_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relatorios" ADD CONSTRAINT "relatorios_criado_por_medicos_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."medicos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exames_paciente_idx" ON "exames" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "ajustes_dosagem_paciente_idx" ON "ajustes_dosagem" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "itens_ajuste_id_idx" ON "itens_ajuste_dosagem" USING btree ("ajuste_id");--> statement-breakpoint
CREATE INDEX "relatorios_paciente_idx" ON "relatorios" USING btree ("paciente_id");