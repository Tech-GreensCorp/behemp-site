CREATE TYPE "public"."consulta_status" AS ENUM('agendada', 'confirmada', 'realizada', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."documento_tipo" AS ENUM('rg', 'rg_responsavel', 'receita_medica', 'comprovante_residencia', 'autorizacao_anvisa');--> statement-breakpoint
CREATE TYPE "public"."grupo_chat_tipo" AS ENUM('direto', 'grupo');--> statement-breakpoint
CREATE TYPE "public"."notificacao_tipo" AS ENUM('renovacao_documento', 'recompra_medicamento', 'consulta_agendada', 'consulta_cancelada', 'nova_mensagem', 'geral');--> statement-breakpoint
CREATE TYPE "public"."paciente_status" AS ENUM('aguardando_consulta', 'em_tratamento', 'concluido', 'arquivado');--> statement-breakpoint
CREATE TYPE "public"."recompra_status" AS ENUM('agendada', 'pedida', 'entregue');--> statement-breakpoint
CREATE TYPE "public"."tratamento_tipo" AS ENUM('cbd', 'thc', 'cbd_thc');--> statement-breakpoint
CREATE TYPE "public"."triagem_status" AS ENUM('pendente', 'visualizada', 'respondida');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'medico', 'paciente');--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"nome" text NOT NULL,
	"role" "user_role" DEFAULT 'paciente' NOT NULL,
	"telefone" text,
	"avatar_url" text,
	"clerk_id" text,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "medicos" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"crm" text NOT NULL,
	"especialidade" text NOT NULL,
	"bio" text,
	"google_calendar_id" text,
	"google_refresh_token" text,
	CONSTRAINT "medicos_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "pacientes" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"medico_id" text,
	"data_nascimento" date,
	"cpf" text,
	"responsavel_nome" text,
	"responsavel_cpf" text,
	"status" "paciente_status" DEFAULT 'aguardando_consulta' NOT NULL,
	"tratamento_tipo" "tratamento_tipo",
	"endereco" text,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "pacientes_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "triagens" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dados" jsonb NOT NULL,
	"email_contato" text,
	"telefone_contato" text,
	"nome_contato" text,
	"status_visualizacao" "triagem_status" DEFAULT 'pendente' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documentos" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paciente_id" text NOT NULL,
	"tipo" "documento_tipo" NOT NULL,
	"url_blob" text NOT NULL,
	"nome_arquivo" text,
	"data_emissao" date NOT NULL,
	"data_validade" date NOT NULL,
	"observacoes" text,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "consultas" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paciente_id" text NOT NULL,
	"medico_id" text NOT NULL,
	"data_hora" timestamp with time zone NOT NULL,
	"status" "consulta_status" DEFAULT 'agendada' NOT NULL,
	"google_event_id" text,
	"google_meet_link" text,
	"observacoes" text,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "anamneses" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paciente_id" text NOT NULL,
	"conteudo" text NOT NULL,
	"criado_por" text NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "evolucoes" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paciente_id" text NOT NULL,
	"data" date NOT NULL,
	"conteudo" text NOT NULL,
	"nivel_dor" integer,
	"qualidade_sono" integer,
	"bem_estar" integer,
	"criado_por" text NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "medicamentos" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"nome" text NOT NULL,
	"principio_ativo" text,
	"gotas_por_ml" integer DEFAULT 20 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dosagens" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paciente_id" text NOT NULL,
	"medicamento_id" text NOT NULL,
	"gotas_por_dia" integer NOT NULL,
	"ml_frasco" integer NOT NULL,
	"data_inicio" date NOT NULL,
	"data_fim_prevista" date NOT NULL,
	"ativa" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recompras" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dosagem_id" text NOT NULL,
	"data_prevista" date NOT NULL,
	"status" "recompra_status" DEFAULT 'agendada' NOT NULL,
	"email_enviado_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "grupos_chat" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"nome" text,
	"tipo" "grupo_chat_tipo" DEFAULT 'direto' NOT NULL,
	"criado_por" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participantes_grupo" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"grupo_id" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mensagens" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"grupo_id" text NOT NULL,
	"autor_id" text NOT NULL,
	"conteudo" text NOT NULL,
	"lida_por" jsonb DEFAULT '[]'::jsonb,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notificacoes" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"tipo" "notificacao_tipo" NOT NULL,
	"titulo" text NOT NULL,
	"mensagem" text NOT NULL,
	"lida" boolean DEFAULT false NOT NULL,
	"link_acao" text
);
--> statement-breakpoint
CREATE TABLE "logs_auditoria" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text,
	"acao" text NOT NULL,
	"entidade" text NOT NULL,
	"entidade_id" text,
	"dados_antes" jsonb,
	"dados_depois" jsonb,
	"ip" text
);
--> statement-breakpoint
ALTER TABLE "medicos" ADD CONSTRAINT "medicos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pacientes" ADD CONSTRAINT "pacientes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pacientes" ADD CONSTRAINT "pacientes_medico_id_medicos_id_fk" FOREIGN KEY ("medico_id") REFERENCES "public"."medicos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultas" ADD CONSTRAINT "consultas_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultas" ADD CONSTRAINT "consultas_medico_id_medicos_id_fk" FOREIGN KEY ("medico_id") REFERENCES "public"."medicos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anamneses" ADD CONSTRAINT "anamneses_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anamneses" ADD CONSTRAINT "anamneses_criado_por_medicos_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."medicos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evolucoes" ADD CONSTRAINT "evolucoes_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evolucoes" ADD CONSTRAINT "evolucoes_criado_por_medicos_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."medicos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dosagens" ADD CONSTRAINT "dosagens_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dosagens" ADD CONSTRAINT "dosagens_medicamento_id_medicamentos_id_fk" FOREIGN KEY ("medicamento_id") REFERENCES "public"."medicamentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recompras" ADD CONSTRAINT "recompras_dosagem_id_dosagens_id_fk" FOREIGN KEY ("dosagem_id") REFERENCES "public"."dosagens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grupos_chat" ADD CONSTRAINT "grupos_chat_criado_por_users_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participantes_grupo" ADD CONSTRAINT "participantes_grupo_grupo_id_grupos_chat_id_fk" FOREIGN KEY ("grupo_id") REFERENCES "public"."grupos_chat"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participantes_grupo" ADD CONSTRAINT "participantes_grupo_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_grupo_id_grupos_chat_id_fk" FOREIGN KEY ("grupo_id") REFERENCES "public"."grupos_chat"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_autor_id_users_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs_auditoria" ADD CONSTRAINT "logs_auditoria_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "pacientes_medico_idx" ON "pacientes" USING btree ("medico_id");--> statement-breakpoint
CREATE INDEX "pacientes_status_idx" ON "pacientes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "documentos_paciente_idx" ON "documentos" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "documentos_validade_idx" ON "documentos" USING btree ("data_validade");--> statement-breakpoint
CREATE INDEX "consultas_paciente_idx" ON "consultas" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "consultas_medico_idx" ON "consultas" USING btree ("medico_id");--> statement-breakpoint
CREATE INDEX "consultas_data_idx" ON "consultas" USING btree ("data_hora");--> statement-breakpoint
CREATE INDEX "consultas_status_idx" ON "consultas" USING btree ("status");--> statement-breakpoint
CREATE INDEX "anamneses_paciente_idx" ON "anamneses" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "evolucoes_paciente_idx" ON "evolucoes" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "evolucoes_data_idx" ON "evolucoes" USING btree ("data");--> statement-breakpoint
CREATE INDEX "dosagens_paciente_idx" ON "dosagens" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "dosagens_ativa_idx" ON "dosagens" USING btree ("ativa");--> statement-breakpoint
CREATE INDEX "recompras_dosagem_idx" ON "recompras" USING btree ("dosagem_id");--> statement-breakpoint
CREATE INDEX "recompras_data_idx" ON "recompras" USING btree ("data_prevista");--> statement-breakpoint
CREATE INDEX "recompras_status_idx" ON "recompras" USING btree ("status");--> statement-breakpoint
CREATE INDEX "participantes_grupo_idx" ON "participantes_grupo" USING btree ("grupo_id");--> statement-breakpoint
CREATE INDEX "participantes_user_idx" ON "participantes_grupo" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mensagens_grupo_idx" ON "mensagens" USING btree ("grupo_id");--> statement-breakpoint
CREATE INDEX "mensagens_autor_idx" ON "mensagens" USING btree ("autor_id");--> statement-breakpoint
CREATE INDEX "notificacoes_user_idx" ON "notificacoes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notificacoes_lida_idx" ON "notificacoes" USING btree ("lida");--> statement-breakpoint
CREATE INDEX "logs_auditoria_user_idx" ON "logs_auditoria" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "logs_auditoria_entidade_idx" ON "logs_auditoria" USING btree ("entidade");--> statement-breakpoint
CREATE INDEX "logs_auditoria_acao_idx" ON "logs_auditoria" USING btree ("acao");