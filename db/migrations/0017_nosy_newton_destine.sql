CREATE TYPE "public"."alerta_destinatario" AS ENUM('admin', 'paciente');--> statement-breakpoint
CREATE TYPE "public"."alerta_tipo" AS ENUM('medicacao', 'licenca_anvisa', 'mensalidade');--> statement-breakpoint
CREATE TYPE "public"."tipo_espectro" AS ENUM('isolado', 'broad', 'full');--> statement-breakpoint
CREATE TABLE "alertas_config" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"marcos_medicacao_dias" jsonb DEFAULT '[40,30,10]'::jsonb NOT NULL,
	"marcos_licenca_dias" jsonb DEFAULT '[60,30]'::jsonb NOT NULL,
	"digest_horario" text DEFAULT '08:00' NOT NULL,
	"digest_ativo" boolean DEFAULT true NOT NULL,
	"notificar_paciente" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alertas_enviados" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tipo" "alerta_tipo" NOT NULL,
	"referencia_id" text NOT NULL,
	"marco_dias" integer NOT NULL,
	"destinatario" "alerta_destinatario" NOT NULL,
	"enviado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unq_alerta_enviado" UNIQUE("tipo","referencia_id","marco_dias","destinatario")
);
--> statement-breakpoint
ALTER TABLE "procuracoes_especificas" ALTER COLUMN "docusign_status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "procuracoes_especificas" ALTER COLUMN "docusign_status" SET DEFAULT 'nao_enviado'::text;--> statement-breakpoint
DROP TYPE "public"."docusign_status";--> statement-breakpoint
CREATE TYPE "public"."docusign_status" AS ENUM('nao_enviado', 'enviado', 'visualizado', 'assinado', 'concluido', 'recusado', 'expirado');--> statement-breakpoint
ALTER TABLE "procuracoes_especificas" ALTER COLUMN "docusign_status" SET DEFAULT 'nao_enviado'::"public"."docusign_status";--> statement-breakpoint
ALTER TABLE "procuracoes_especificas" ALTER COLUMN "docusign_status" SET DATA TYPE "public"."docusign_status" USING "docusign_status"::"public"."docusign_status";--> statement-breakpoint
ALTER TABLE "medicamentos" ADD COLUMN "marca" text;--> statement-breakpoint
ALTER TABLE "medicamentos" ADD COLUMN "volume_ml" integer DEFAULT 30;--> statement-breakpoint
ALTER TABLE "medicamentos" ADD COLUMN "total_gotas" integer DEFAULT 900;--> statement-breakpoint
ALTER TABLE "medicamentos" ADD COLUMN "cbd_mg_por_gota" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "medicamentos" ADD COLUMN "thc_mg_por_gota" numeric(6, 3) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "medicamentos" ADD COLUMN "cbn_mg_por_gota" numeric(6, 3) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "medicamentos" ADD COLUMN "cbg_mg_por_gota" numeric(6, 3) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "medicamentos" ADD COLUMN "thcv_mg_por_gota" numeric(6, 3) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "medicamentos" ADD COLUMN "tipo_espectro" "tipo_espectro";--> statement-breakpoint
ALTER TABLE "medicamentos" ADD COLUMN "nanotecnologia" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "medicamentos" ADD COLUMN "preco" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "medicamentos" ADD COLUMN "ativo" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "autorizacoes_anvisa" ADD COLUMN "data_validade" date;