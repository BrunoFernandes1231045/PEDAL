-- Adiciona coluna interview (JSONB) à tabela candidates
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS interview JSONB;
