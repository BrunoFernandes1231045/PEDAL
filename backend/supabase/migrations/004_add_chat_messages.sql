alter table candidates add column if not exists chat_messages jsonb default '[]';
