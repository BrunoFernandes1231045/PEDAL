-- Adicionar campos em falta à tabela trainers
alter table trainers add column if not exists dob date;
alter table trainers add column if not exists phone text;
alter table trainers add column if not exists email text;
alter table trainers add column if not exists locality text;
