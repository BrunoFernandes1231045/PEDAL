-- Adiciona colunas cc e profissao à tabela candidates
alter table candidates add column if not exists cc text;
alter table candidates add column if not exists profissao text;
