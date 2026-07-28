-- Rastreio de tempo em cada fase, para o email "continuas interessado?"
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS stage_since TIMESTAMPTZ DEFAULT now();
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS stage_reminder_sent_at TIMESTAMPTZ;
