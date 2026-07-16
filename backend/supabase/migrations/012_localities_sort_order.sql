alter table localities add column if not exists sort_order integer not null default 0;

-- Initialise sort_order from current alphabetical order so existing data is ordered sensibly
update localities
set sort_order = sub.rn
from (
  select id, (row_number() over (order by name) - 1)::integer as rn
  from localities
  where active = true
) sub
where localities.id = sub.id;
