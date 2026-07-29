# PED-61 — migração de papéis e invalidação de sessões

Aplicar `backend/supabase/migrations/018_migrate_auth_roles.sql` através do
processo normal de migrations do projeto.

Antes de aplicar:

1. Fazer backup da base de dados/Auth.
2. Reunir, por um canal independente, os UUIDs e funções dos coordenadores
   existentes. Não confiar no papel guardado em `user_metadata`.
3. Informar coordenadores de que terão de iniciar sessão novamente e configurar
   TOTP no primeiro acesso.

Na primeira execução, a migration só promove coordenadores que já tenham um
papel em `app_metadata`. Contas que apenas aleguem ser coordenadores através de
`user_metadata` são bloqueadas e ficam com o estado `manual_review_required`.

Rever essas contas:

```sql
select user_id, email, previous_user_metadata, previous_app_metadata, details
from private.auth_role_migration_audit
where migration_key = 'PED-61-trusted-auth-role-migration-v2'
  and status = 'manual_review_required'
order by email;
```

Depois de confirmar cada coordenador por um canal independente, inserir o UUID
na allowlist. O campo `approved_by` deve identificar a pessoa/ticket que aprovou:

```sql
insert into private.trusted_coordinator_role_allowlist
  (user_id, coord_role, approved_by)
values
  ('<uuid-confirmado>', 'administracao', 'Nome — PED-61'),
  ('<outro-uuid-confirmado>', 'coordenacao', 'Nome — PED-61')
on conflict (user_id) do update
set coord_role = excluded.coord_role,
    approved_by = excluded.approved_by,
    approved_at = now();

select * from private.apply_ped61_auth_role_migration();
```

Nunca adicionar à allowlist uma conta apenas porque o respetivo
`user_metadata.role` diz `coordinator`.

Verificação final:

```sql
-- Deve devolver zero. Se não devolver, ainda falta revisão manual.
select count(*) as pendentes
from private.auth_role_migration_audit
where migration_key = 'PED-61-trusted-auth-role-migration-v2'
  and status = 'manual_review_required';

-- Nenhum dado de autorização deve permanecer editável pelo utilizador.
select id, email
from auth.users
where raw_user_meta_data ? 'role'
   or raw_user_meta_data ? 'coord_role';

-- Metadados legacy órfãos foram removidos sem conceder qualquer papel.
select user_id, email, previous_user_metadata, details
from private.auth_role_migration_audit
where migration_key = 'PED-61-trusted-auth-role-migration-v2'
  and status = 'removed_untrusted_metadata'
order by email;

-- Confirmar a lista final com a associação.
select
  id,
  email,
  raw_app_meta_data->>'role' as role,
  raw_app_meta_data->>'coord_role' as coord_role
from auth.users
where raw_app_meta_data->>'role' = 'coordinator'
order by email;
```

A migration remove as sessões das contas alteradas ou ambíguas. Além disso, grava
`authorization_version`; o middleware compara a versão presente no JWT com a
versão atual devolvida pelo Supabase e rejeita qualquer diferença. Alterações
futuras de função geram uma nova versão, pelo que também obrigam a novo login.
O endpoint de gestão chama ainda a função
`public.invalidate_user_auth_sessions`, executável apenas por `service_role`,
para remover imediatamente os refresh tokens/sessões desse utilizador.

Configuração necessária para PED-59:

- `PUBLIC_APP_URL=https://<dominio-da-aplicacao>` ou
  `COORDINATOR_INVITE_REDIRECT_URL=https://<dominio>/nova-palavra-passe?tipo=convite-coordenacao`
- `COORDINATOR_MFA_REQUIRED=true`
- adicionar o URL de convite à lista de Redirect URLs permitidos no Supabase;
- manter o fornecedor de email Auth do Supabase/SMTP funcional;
- confirmar que o fator TOTP está permitido no projeto Supabase.

Num projeto vazio, criar a primeira administração com o bootstrap documentado
na secção 5 de `backend/scripts/SECURITY-DEPLOYMENT-CHECKLIST.md`. A partir da
pasta `backend`, com as variáveis do projeto já carregadas:

```bash
NODE_ENV=production \
FIRST_ADMIN_EMAIL='admin@dominio-da-associacao.pt' \
FIRST_ADMIN_NAME='Nome da pessoa responsável' \
npm run bootstrap:first-admin -- --confirm
```
