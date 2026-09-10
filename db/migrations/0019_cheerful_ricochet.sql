CREATE TYPE "public"."adesao_relatada" AS ENUM('tomou_como_prescrito', 'tomou_menos', 'tomou_mais', 'interrompeu', 'nao_iniciou');--> statement-breakpoint
CREATE TYPE "public"."origem_produto" AS ENUM('importado', 'nacional_registrado', 'associacao', 'artesanal', 'desconhecida');--> statement-breakpoint
CREATE TYPE "public"."periodo_contagem" AS ENUM('dia', 'semana', 'mes');--> statement-breakpoint
CREATE TYPE "public"."resposta_percebida" AS ENUM('melhorou_muito', 'melhorou_pouco', 'sem_mudanca', 'piorou', 'nao_sabe');--> statement-breakpoint
CREATE TYPE "public"."situacao_uso_cannabis" AS ENUM('primeiro_uso', 'usa_atualmente', 'usou_e_parou');--> statement-breakpoint
CREATE TYPE "public"."via_administracao" AS ENUM('oral', 'sublingual', 'inalada', 'topica', 'outra');--> statement-breakpoint
CREATE TABLE "medidas_desfecho" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paciente_id" text NOT NULL,
	"consulta_id" text,
	"anamnese_id" text,
	"medido_em" date NOT NULL,
	"nivel_dor" integer,
	"qualidade_sono" integer,
	"nivel_ansiedade" integer,
	"qualidade_vida_global" integer,
	"crises_contagem" integer,
	"crises_periodo" "periodo_contagem",
	"pressao_sistolica" integer,
	"pressao_diastolica" integer,
	"peso_kg" numeric(5, 1),
	"observacao" text,
	"registrado_por" text NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rastreio_uso_cannabis" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paciente_id" text NOT NULL,
	"anamnese_id" text,
	"situacao" "situacao_uso_cannabis" NOT NULL,
	"produto_descrito" text,
	"medicamento_id" text,
	"proporcao_cbd_thc" text,
	"dose_relatada" text,
	"mg_dia_estimado" numeric(8, 2),
	"via_administracao" "via_administracao",
	"origem" "origem_produto",
	"uso_desde" date,
	"resposta_percebida" "resposta_percebida",
	"efeito_adverso_relatado" text,
	"adesao" "adesao_relatada",
	"motivo_nao_adesao" text,
	"expectativa" text,
	"receio" text,
	"uso_recreativo_concomitante" boolean,
	"observacao" text,
	"registrado_por" text NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "medidas_desfecho" ADD CONSTRAINT "medidas_desfecho_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medidas_desfecho" ADD CONSTRAINT "medidas_desfecho_consulta_id_consultas_id_fk" FOREIGN KEY ("consulta_id") REFERENCES "public"."consultas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medidas_desfecho" ADD CONSTRAINT "medidas_desfecho_anamnese_id_anamneses_id_fk" FOREIGN KEY ("anamnese_id") REFERENCES "public"."anamneses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medidas_desfecho" ADD CONSTRAINT "medidas_desfecho_registrado_por_medicos_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."medicos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rastreio_uso_cannabis" ADD CONSTRAINT "rastreio_uso_cannabis_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rastreio_uso_cannabis" ADD CONSTRAINT "rastreio_uso_cannabis_anamnese_id_anamneses_id_fk" FOREIGN KEY ("anamnese_id") REFERENCES "public"."anamneses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rastreio_uso_cannabis" ADD CONSTRAINT "rastreio_uso_cannabis_medicamento_id_medicamentos_id_fk" FOREIGN KEY ("medicamento_id") REFERENCES "public"."medicamentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rastreio_uso_cannabis" ADD CONSTRAINT "rastreio_uso_cannabis_registrado_por_medicos_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."medicos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "medidas_desfecho_paciente_data_idx" ON "medidas_desfecho" USING btree ("paciente_id","medido_em");--> statement-breakpoint
CREATE INDEX "medidas_desfecho_consulta_idx" ON "medidas_desfecho" USING btree ("consulta_id");--> statement-breakpoint
CREATE INDEX "medidas_desfecho_anamnese_idx" ON "medidas_desfecho" USING btree ("anamnese_id");--> statement-breakpoint
CREATE INDEX "rastreio_uso_paciente_idx" ON "rastreio_uso_cannabis" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "rastreio_uso_anamnese_idx" ON "rastreio_uso_cannabis" USING btree ("anamnese_id");--> statement-breakpoint
CREATE INDEX "rastreio_uso_situacao_idx" ON "rastreio_uso_cannabis" USING btree ("situacao");