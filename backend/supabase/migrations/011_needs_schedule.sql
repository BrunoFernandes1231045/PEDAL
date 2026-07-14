-- Tabela de configurações globais da organização (chave-valor JSONB)
-- Usada para guardar a tabela de necessidades/vagas por localidade+dia
CREATE TABLE IF NOT EXISTS org_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
