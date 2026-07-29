-- PED-61 — autorização apenas a partir de app_metadata.
--
-- Regra crítica: user_metadata é controlável pelo próprio utilizador e nunca
-- é usado para promover uma conta. As únicas fontes confiáveis são:
--   1. a relação candidates.user_id (papel candidate);
--   2. app_metadata já gravado pelo backend/service role;
--   3. uma allowlist de coordenadores aprovada manualmente por UUID.
--
-- Contas que só alegam ser coordenadores em user_metadata ficam bloqueadas,
-- auditadas como manual_review_required e nunca são promovidas.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.trusted_coordinator_role_allowlist (
  user_id uuid primary key references auth.users(id) on delete cascade,
  coord_role text not null check (coord_role in ('administracao', 'coordenacao')),
  approved_by text not null,
  approved_at timestamptz not null default now()
);

create table if not exists private.auth_role_migration_audit (
  migration_key text not null,
  user_id uuid not null,
  email text,
  status text not null check (
    status in (
      'migrated_candidate',
      'migrated_coordinator',
      'manual_review_required',
      'removed_untrusted_metadata'
    )
  ),
  source text not null,
  previous_user_metadata jsonb not null,
  previous_app_metadata jsonb not null,
  migrated_app_metadata jsonb,
  details text,
  first_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  primary key (migration_key, user_id)
);

-- Mantém a migration reaplicável caso uma revisão anterior desta mesma
-- migration já tenha criado a tabela com uma lista de estados mais curta.
alter table private.auth_role_migration_audit
  drop constraint if exists auth_role_migration_audit_status_check;
alter table private.auth_role_migration_audit
  add constraint auth_role_migration_audit_status_check check (
    status in (
      'migrated_candidate',
      'migrated_coordinator',
      'manual_review_required',
      'removed_untrusted_metadata'
    )
  );

revoke all on private.trusted_coordinator_role_allowlist from public, anon, authenticated;
revoke all on private.auth_role_migration_audit from public, anon, authenticated;

-- Permite ao backend (service_role) terminar sessões quando uma função muda.
-- O parâmetro nunca fica disponível a anon/authenticated.
create or replace function public.invalidate_user_auth_sessions(target_user_id uuid)
returns void
language sql
security definer
set search_path = pg_catalog, auth
as $$
  delete from auth.sessions where user_id = target_user_id;
$$;

revoke all on function public.invalidate_user_auth_sessions(uuid) from public, anon, authenticated;
grant execute on function public.invalidate_user_auth_sessions(uuid) to service_role;

create or replace function private.apply_ped61_auth_role_migration()
returns table (
  migrated_candidates integer,
  migrated_coordinators integer,
  manual_review_required integer
)
language plpgsql
security definer
set search_path = pg_catalog, private, public, auth
as $migration$
declare
  migration_name constant text := 'PED-61-trusted-auth-role-migration-v2';
  affected_user_ids uuid[];
begin
  -- 1. Candidatos: candidates.user_id é uma relação protegida e é a fonte de
  -- verdade, independentemente do que user_metadata alegue.
  select coalesce(array_agg(distinct u.id), array[]::uuid[])
    into affected_user_ids
  from auth.users u
  join public.candidates c on c.user_id = u.id
  where u.raw_app_meta_data->>'role' is distinct from 'candidate'
     or u.raw_user_meta_data ? 'role'
     or u.raw_user_meta_data ? 'coord_role'
     or not (u.raw_app_meta_data ? 'authorization_version');

  insert into private.auth_role_migration_audit (
    migration_key, user_id, email, status, source,
    previous_user_metadata, previous_app_metadata, migrated_app_metadata,
    details, resolved_at
  )
  select
    migration_name,
    u.id,
    u.email,
    'migrated_candidate',
    'public.candidates.user_id',
    coalesce(u.raw_user_meta_data, '{}'::jsonb),
    coalesce(u.raw_app_meta_data, '{}'::jsonb),
    (coalesce(u.raw_app_meta_data, '{}'::jsonb) - 'coord_role')
      || jsonb_build_object(
        'role', 'candidate',
        'authorization_version', gen_random_uuid()::text
      ),
    'Papel derivado da relação protegida candidates.user_id.',
    now()
  from auth.users u
  where u.id = any(affected_user_ids)
  on conflict (migration_key, user_id) do update
    set status = excluded.status,
        source = excluded.source,
        migrated_app_metadata = excluded.migrated_app_metadata,
        details = excluded.details,
        resolved_at = excluded.resolved_at;

  update auth.users u
  set
    raw_app_meta_data = a.migrated_app_metadata,
    raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb) - 'role' - 'coord_role',
    updated_at = now()
  from private.auth_role_migration_audit a
  where a.migration_key = migration_name
    and a.status = 'migrated_candidate'
    and u.id = a.user_id
    and u.id = any(affected_user_ids);

  delete from auth.sessions where user_id = any(affected_user_ids);
  migrated_candidates := cardinality(affected_user_ids);

  -- 2. Coordenadores já presentes em app_metadata (fonte service-role) ou
  -- aprovados explicitamente por UUID na allowlist privada.
  select coalesce(array_agg(u.id), array[]::uuid[])
    into affected_user_ids
  from auth.users u
  left join private.trusted_coordinator_role_allowlist allowlist on allowlist.user_id = u.id
  where not exists (select 1 from public.candidates c where c.user_id = u.id)
    and (u.raw_app_meta_data->>'role' = 'coordinator' or allowlist.user_id is not null)
    and (
      u.raw_app_meta_data->>'role' is distinct from 'coordinator'
      or u.raw_app_meta_data->>'coord_role' is null
      or u.raw_app_meta_data->>'coord_role' not in ('administracao', 'coordenacao')
      or u.raw_user_meta_data ? 'role'
      or u.raw_user_meta_data ? 'coord_role'
      or not (u.raw_app_meta_data ? 'authorization_version')
      or (
        allowlist.user_id is not null
        and u.raw_app_meta_data->>'coord_role' is distinct from allowlist.coord_role
      )
    );

  insert into private.auth_role_migration_audit (
    migration_key, user_id, email, status, source,
    previous_user_metadata, previous_app_metadata, migrated_app_metadata,
    details, resolved_at
  )
  select
    migration_name,
    u.id,
    u.email,
    'migrated_coordinator',
    case
      when allowlist.user_id is not null then 'private.trusted_coordinator_role_allowlist'
      else 'existing app_metadata'
    end,
    coalesce(u.raw_user_meta_data, '{}'::jsonb),
    coalesce(u.raw_app_meta_data, '{}'::jsonb),
    coalesce(u.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object(
        'role', 'coordinator',
        'coord_role', coalesce(
          allowlist.coord_role,
          case
            when u.raw_app_meta_data->>'coord_role' = 'administracao' then 'administracao'
            else 'coordenacao'
          end
        ),
        'authorization_version', gen_random_uuid()::text
      ),
    'Papel preservado a partir de fonte não editável pelo utilizador.',
    now()
  from auth.users u
  left join private.trusted_coordinator_role_allowlist allowlist on allowlist.user_id = u.id
  where u.id = any(affected_user_ids)
  on conflict (migration_key, user_id) do update
    set status = excluded.status,
        source = excluded.source,
        migrated_app_metadata = excluded.migrated_app_metadata,
        details = excluded.details,
        resolved_at = excluded.resolved_at;

  update auth.users u
  set
    raw_app_meta_data = a.migrated_app_metadata,
    raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb) - 'role' - 'coord_role',
    updated_at = now()
  from private.auth_role_migration_audit a
  where a.migration_key = migration_name
    and a.status = 'migrated_coordinator'
    and u.id = a.user_id
    and u.id = any(affected_user_ids);

  delete from auth.sessions where user_id = any(affected_user_ids);
  migrated_coordinators := cardinality(affected_user_ids);

  -- 3. Alegações antigas de coordenação sem fonte confiável: não copiar.
  -- Remover sessões bloqueia o acesso até revisão e inclusão explícita na
  -- allowlist. user_metadata fica preservado até à revisão para investigação.
  select coalesce(array_agg(u.id), array[]::uuid[])
    into affected_user_ids
  from auth.users u
  where u.raw_user_meta_data->>'role' = 'coordinator'
    and u.raw_app_meta_data->>'role' is distinct from 'coordinator'
    and not exists (select 1 from public.candidates c where c.user_id = u.id)
    and not exists (
      select 1
      from private.trusted_coordinator_role_allowlist allowlist
      where allowlist.user_id = u.id
    );

  insert into private.auth_role_migration_audit (
    migration_key, user_id, email, status, source,
    previous_user_metadata, previous_app_metadata, migrated_app_metadata,
    details, resolved_at
  )
  select
    migration_name,
    u.id,
    u.email,
    'manual_review_required',
    'untrusted user_metadata only',
    coalesce(u.raw_user_meta_data, '{}'::jsonb),
    coalesce(u.raw_app_meta_data, '{}'::jsonb),
    null,
    'Não promovido: confirmar identidade e função por canal independente e inserir o UUID na allowlist.',
    null
  from auth.users u
  where u.id = any(affected_user_ids)
  on conflict (migration_key, user_id) do nothing;

  delete from auth.sessions where user_id = any(affected_user_ids);
  manual_review_required := cardinality(affected_user_ids);

  -- 4. Outros campos legacy de autorização sem uma relação/fonte confiável
  -- (por exemplo, um órfão com apenas coord_role ou role=candidate) não podem
  -- conceder permissões. Auditá-los, removê-los e preservar app_metadata tal
  -- como está — nunca promover a conta a partir destes valores.
  select coalesce(array_agg(u.id), array[]::uuid[])
    into affected_user_ids
  from auth.users u
  where (u.raw_user_meta_data ? 'role' or u.raw_user_meta_data ? 'coord_role')
    and u.raw_user_meta_data->>'role' is distinct from 'coordinator'
    and u.raw_app_meta_data->>'role' is distinct from 'coordinator'
    and not exists (select 1 from public.candidates c where c.user_id = u.id)
    and not exists (
      select 1
      from private.trusted_coordinator_role_allowlist allowlist
      where allowlist.user_id = u.id
    );

  insert into private.auth_role_migration_audit (
    migration_key, user_id, email, status, source,
    previous_user_metadata, previous_app_metadata, migrated_app_metadata,
    details, resolved_at
  )
  select
    migration_name,
    u.id,
    u.email,
    'removed_untrusted_metadata',
    'orphaned untrusted user_metadata',
    coalesce(u.raw_user_meta_data, '{}'::jsonb),
    coalesce(u.raw_app_meta_data, '{}'::jsonb),
    coalesce(u.raw_app_meta_data, '{}'::jsonb),
    'Campos role/coord_role removidos sem promover a conta.',
    now()
  from auth.users u
  where u.id = any(affected_user_ids)
  on conflict (migration_key, user_id) do update
    set status = excluded.status,
        source = excluded.source,
        migrated_app_metadata = excluded.migrated_app_metadata,
        details = excluded.details,
        resolved_at = excluded.resolved_at;

  update auth.users u
  set
    raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb) - 'role' - 'coord_role',
    updated_at = now()
  where u.id = any(affected_user_ids);

  delete from auth.sessions where user_id = any(affected_user_ids);

  return next;
end
$migration$;

revoke all on function private.apply_ped61_auth_role_migration() from public, anon, authenticated;

-- Primeira passagem segura. Contas ambíguas são apenas auditadas/bloqueadas.
select * from private.apply_ped61_auth_role_migration();
