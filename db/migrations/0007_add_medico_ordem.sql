ALTER TABLE "medicos" ADD COLUMN "ordem" integer;
ALTER TABLE "medicos" ALTER COLUMN "crm" DROP NOT NULL;
