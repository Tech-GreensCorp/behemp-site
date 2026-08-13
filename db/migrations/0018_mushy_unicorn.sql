CREATE TYPE "public"."produto_arquivo_categoria" AS ENUM('imagem', 'documento', 'formula');--> statement-breakpoint
CREATE TABLE "produtos" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sku" text NOT NULL,
	"nome" text NOT NULL,
	"linha_produto" text,
	"descricao" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preco" numeric(10, 2),
	"url_compra" text NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"excluido_por" text
);
--> statement-breakpoint
CREATE TABLE "produto_arquivos" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"produto_id" text NOT NULL,
	"categoria" "produto_arquivo_categoria" NOT NULL,
	"url_blob" text NOT NULL,
	"nome_arquivo" text,
	"mimetype" text NOT NULL,
	"descricao" text
);
--> statement-breakpoint
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_excluido_por_users_id_fk" FOREIGN KEY ("excluido_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produto_arquivos" ADD CONSTRAINT "produto_arquivos_produto_id_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "produtos_sku_idx" ON "produtos" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "produtos_linha_produto_idx" ON "produtos" USING btree ("linha_produto");--> statement-breakpoint
CREATE INDEX "produtos_ativo_idx" ON "produtos" USING btree ("ativo");--> statement-breakpoint
CREATE INDEX "produto_arquivos_produto_idx" ON "produto_arquivos" USING btree ("produto_id");