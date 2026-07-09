-- Adiciona coluna scheduling (JSONB) à tabela candidates
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS scheduling JSONB;
