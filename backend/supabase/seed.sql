-- supabase/seed.sql

insert into localities (id, name, active) values
  (gen_random_uuid(), 'Matosinhos', true),
  (gen_random_uuid(), 'Maia', true),
  (gen_random_uuid(), 'Esposende', true),
  (gen_random_uuid(), 'Porto', false),
  (gen_random_uuid(), 'Vila do Conde', false),
  (gen_random_uuid(), 'Gondomar', false);

insert into needs (locality_id, periods, description)
select id, '["Manhãs","Fins de semana"]', 'Piloto para percursos matinais em Matosinhos'
from localities where name = 'Matosinhos';

insert into needs (locality_id, periods, description)
select id, '["Tardes"]', 'Piloto para percursos da tarde na Maia'
from localities where name = 'Maia';

insert into needs (locality_id, periods, description)
select id, '["Flexível"]', 'Piloto com horário flexível em Esposende'
from localities where name = 'Esposende';
