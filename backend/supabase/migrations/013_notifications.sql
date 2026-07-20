-- Feed de notificações da coordenação (RF) — antes só existia em localStorage,
-- por isso nunca chegava a outro dispositivo/browser.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references candidates(id) on delete set null,
  type text not null,
  who text,
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists notifications_created_at_idx on notifications (created_at desc);
