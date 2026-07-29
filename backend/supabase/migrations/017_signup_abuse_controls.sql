-- PED-57: rate limit persistente e partilhado para o registo público.
--
-- A aplicação envia apenas hashes SHA-256 dos identificadores (IP e email).
-- A função adquire locks por chave numa ordem estável, para que a verificação
-- e o incremento sejam atómicos mesmo com várias instâncias do backend.

create table if not exists signup_rate_limits (
  identifier_hash text primary key,
  window_started_at timestamptz not null,
  hit_count integer not null check (hit_count > 0),
  updated_at timestamptz not null default now()
);

create index if not exists signup_rate_limits_updated_at_idx
  on signup_rate_limits (updated_at);

alter table signup_rate_limits enable row level security;
revoke all on signup_rate_limits from anon, authenticated;

create or replace function consume_signup_rate_limit(
  p_identifier_hashes text[],
  p_window_seconds integer,
  p_max_requests integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hash text;
  v_row signup_rate_limits%rowtype;
  v_now timestamptz := clock_timestamp();
  v_limited boolean := false;
  v_retry_after integer := 0;
begin
  if coalesce(array_length(p_identifier_hashes, 1), 0) = 0
     or p_window_seconds < 1
     or p_max_requests < 1 then
    raise exception 'invalid rate-limit parameters';
  end if;

  -- Locks estáveis evitam corridas e deadlocks em pedidos com o mesmo email
  -- mas IPs diferentes (ou vice-versa).
  for v_hash in
    select distinct value
    from unnest(p_identifier_hashes) as identifiers(value)
    where value is not null and value <> ''
    order by value
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_hash, 0));

    insert into signup_rate_limits (
      identifier_hash,
      window_started_at,
      hit_count,
      updated_at
    )
    values (v_hash, v_now, 1, v_now)
    on conflict (identifier_hash) do update
      set window_started_at = case
            when signup_rate_limits.window_started_at
                 <= v_now - make_interval(secs => p_window_seconds)
              then v_now
            else signup_rate_limits.window_started_at
          end,
          hit_count = case
            when signup_rate_limits.window_started_at
                 <= v_now - make_interval(secs => p_window_seconds)
              then 1
            else signup_rate_limits.hit_count + 1
          end,
          updated_at = v_now
    returning * into v_row;

    if v_row.hit_count > p_max_requests then
      v_limited := true;
      v_retry_after := greatest(
        v_retry_after,
        ceil(extract(epoch from (
          v_row.window_started_at
          + make_interval(secs => p_window_seconds)
          - v_now
        )))::integer
      );
    end if;
  end loop;

  -- Limpeza oportunista em lotes pequenos. O índice de updated_at evita um
  -- scan total e SKIP LOCKED não deixa a manutenção bloquear outros registos.
  delete from signup_rate_limits
  where identifier_hash in (
    select identifier_hash
    from signup_rate_limits
    where updated_at < v_now - interval '2 days'
    order by updated_at
    limit 200
    for update skip locked
  );

  return jsonb_build_object(
    'limited', v_limited,
    'retryAfter', greatest(v_retry_after, 0)
  );
end;
$$;

revoke all on function consume_signup_rate_limit(text[], integer, integer)
  from public, anon, authenticated;
grant execute on function consume_signup_rate_limit(text[], integer, integer)
  to service_role;
