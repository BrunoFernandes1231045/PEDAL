-- Migration 006: text locality columns for needs/stations + slug for localities + seed base localities

alter table localities add column if not exists slug text;
alter table needs add column if not exists locality text;
alter table stations add column if not exists locality text;
alter table stations add column if not exists note text;

-- Seed base localities (only if table is empty)
do $$
begin
  if not exists (select 1 from localities limit 1) then
    insert into localities (name, slug) values
      ('Matosinhos', 'matosinhos'),
      ('Maia',       'maia'),
      ('Esposende',  'esposende'),
      ('Porto',      'porto'),
      ('Vila do Conde', 'vilaconde'),
      ('Gondomar',   'gondomar');
  end if;
end $$;
