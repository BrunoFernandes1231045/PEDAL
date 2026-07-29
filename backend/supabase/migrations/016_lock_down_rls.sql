-- PED-60: bloquear exposição pública da Data API (PostgREST) do Supabase.
--
-- Toda a aplicação fala com estas tabelas exclusivamente através do backend
-- Express, usando a service_role key (que ignora RLS por definição). Nenhum
-- destes dados deve ser acessível diretamente pela Data API com a chave anon
-- ou com um JWT de utilizador normal — por isso a política correta aqui é
-- "sem políticas nenhumas": ativa RLS e não cria nenhuma regra de acesso para
-- anon/authenticated, o que nega tudo (leitura e escrita) a esses papéis.

alter table localities enable row level security;
alter table candidates enable row level security;
alter table messages enable row level security;
alter table onboarding enable row level security;
alter table onboarding_progress enable row level security;
alter table contact_requests enable row level security;
alter table trainers enable row level security;
alter table stations enable row level security;
alter table needs enable row level security;
alter table notifications enable row level security;
alter table org_settings enable row level security;

-- Defesa em profundidade: revoga também os privilégios de tabela que o
-- Supabase concede por omissão a anon/authenticated, para além do RLS.
revoke all on localities, candidates, messages, onboarding, onboarding_progress,
  contact_requests, trainers, stations, needs, notifications, org_settings
  from anon, authenticated;
