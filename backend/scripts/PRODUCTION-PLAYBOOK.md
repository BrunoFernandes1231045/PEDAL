# Playbook de colocação em produção

Esta checklist separa o que está versionado no repositório do que tem de ser
feito ao criar ou atualizar um ambiente de produção. Deve acompanhar todas as
entregas futuras e ser atualizada quando a arquitetura, os fornecedores ou os
controlos operacionais mudarem. Não assume que já existe uma aplicação em
produção nem que um projeto Supabase anterior será reutilizado.

## 1. Definir o ambiente e a estratégia de dados

- Garantir que Railway e Supabase de produção estão separados de
  desenvolvimento/testes.
- Confirmar a URL pública canónica da aplicação.
- Decidir se os dados do Supabase atual serão migrados ou se o ambiente começa
  vazio.
- Se forem migrados dados existentes, criar primeiro uma cópia de segurança e
  reunir, por um canal independente, os UUIDs e as funções dos coordenadores.
  Não confiar em `user_metadata`.
- Preparar duas contas de teste autorizadas: um candidato e um coordenador.
- Num ambiente novo, não existem sessões para terminar. Se forem importadas
  contas, informar essas pessoas de que terão de iniciar sessão novamente e
  configurar TOTP.

## 2. Cloudflare Turnstile

1. Confirmar a conta Cloudflare da associação; criá-la no primeiro ambiente.
2. Criar ou reutilizar um widget Turnstile do tipo **Managed**.
3. Autorizar apenas os hostnames reais da aplicação.
4. Guardar a site key e a secret key no gestor de segredos do Railway.
5. Nunca usar em produção as chaves oficiais de teste `1x000...`.

Variáveis:

```text
TURNSTILE_SITE_KEY=<site-key-de-producao>
TURNSTILE_SECRET_KEY=<secret-key-de-producao>
TURNSTILE_EXPECTED_HOSTNAMES=<hostname-sem-protocolo>
SIGNUP_RATE_LIMIT=5
SIGNUP_RATE_WINDOW_SECONDS=3600
SIGNUP_PRE_RATE_LIMIT=30
SIGNUP_PRE_RATE_WINDOW_SECONDS=60
```

O plano gratuito do Turnstile é suficiente para este caso. A conta externa
continua a ser necessária porque é nela que se criam e rodam as chaves e se
limitam os hostnames.

## 3. Configurar o Supabase de produção

Criar ou selecionar o projeto Supabase de produção e configurar no Railway:

```text
NODE_ENV=production
SUPABASE_URL=https://<project-ref-producao>.supabase.co
SUPABASE_PUBLIC_URL=https://<project-ref-producao>.supabase.co
SUPABASE_ANON_KEY=<anon-public-key-do-projeto-de-producao>
SUPABASE_SERVICE_KEY=<service-role-do-projeto-de-producao>
PUBLIC_APP_URL=https://<dominio-canonico>
COORDINATOR_INVITE_REDIRECT_URL=https://<dominio-canonico>/nova-palavra-passe?tipo=convite-coordenacao
COORDINATOR_MFA_REQUIRED=true
PASSWORD_RECOVERY_EMAIL_ENABLED=true
```

No projeto Supabase:

- confirmar que backend e frontend apontam para este mesmo projeto;
- garantir que `SUPABASE_PUBLIC_URL` e `SUPABASE_URL` são exatamente iguais
  (uma barra final é ignorada pela validação de arranque);
- usar `SUPABASE_ANON_KEY` apenas na configuração pública servida ao browser;
- confirmar que `/runtime-config.js` define `window.__PEDAL_AUTH_CONFIG` antes
  dos scripts de autenticação e responde com `Cache-Control: no-store`;
- abrir `/runtime-config.js` e confirmar que contém apenas a URL pública e a
  anon key, nunca a `SUPABASE_SERVICE_KEY`;
- adicionar aos Redirect URLs:
  - `https://<dominio-canonico>/nova-palavra-passe?tipo=convite`
  - `https://<dominio-canonico>/nova-palavra-passe?tipo=convite-coordenacao`
  - `https://<dominio-canonico>/nova-palavra-passe`
- configurar SMTP com um remetente da associação e testar a entrega;
- confirmar que TOTP MFA está ativo;
- não expor a `service_role` no frontend, logs ou respostas HTTP.

## 4. Aplicar migrations

Num projeto Supabase vazio, aplicar **todos** os ficheiros existentes em
`backend/supabase/migrations/` pela ordem numérica dos nomes.

Num projeto existente, consultar o histórico de migrations e aplicar, pela mesma
ordem, todos os ficheiros ainda pendentes. Não assumir no playbook qual é a
última migration: confirmar sempre o conteúdo atual da pasta no momento da
entrega.

Quando `018_migrate_auth_roles.sql` estiver entre as migrations pendentes, um
projeto vazio não terá contas antigas para migrar. Num projeto reutilizado,
seguir imediatamente
`backend/scripts/PED-61-roles-runbook.md`: rever as contas ambíguas, inserir
apenas UUIDs confirmados na allowlist e repetir
`private.apply_ped61_auth_role_migration()`.

Não avançar para o deploy enquanto:

- existirem coordenadores importados por rever;
- a função `consume_signup_rate_limit` não estiver disponível à `service_role`;
- a lista final de coordenadores importados em `app_metadata` não tiver sido
  confirmada.

## 5. Deploy

- Fazer deploy do backend e frontend a partir do mesmo estado de código.
- Confirmar que o Railway não está a usar valores do ficheiro de exemplo.
- Verificar nos logs que não existem erros de configuração, migrations ou SMTP.
- Confirmar que a página `/nova-palavra-passe` está acessível antes de enviar o
  convite inicial ou qualquer novo convite.
- Não reverter para uma versão que volte a autorizar através de
  `user_metadata`; se surgir um problema, desativar temporariamente o registo e
  corrigir para a frente.

Para fechar temporariamente o registo sem reabrir a falha, remover/desativar a
configuração Turnstile. O endpoint fica indisponível em modo fail-closed.

## 6. Garantir uma conta de administração

Num ambiente vazio existe um problema circular: só um administrador pode
convidar outros coordenadores. Criar o primeiro administrador através do script
de bootstrap versionado no repositório, usando a `service_role` apenas no
terminal/gestor de segredos.

O bootstrap deve:

- enviar um convite de uso único para um email confirmado da associação;
- escrever `role=coordinator` e `coord_role=administracao` apenas em
  `app_metadata`;
- nunca gerar ou imprimir uma password;
- falhar se já existir um administrador; `--confirm` confirma a criação inicial,
  mas nunca ignora esta proteção;
- ser seguido da configuração TOTP no primeiro login.

Com `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `PUBLIC_APP_URL` e/ou
`COORDINATOR_INVITE_REDIRECT_URL` já disponíveis no ambiente seguro, executar
exatamente a partir da pasta `backend`:

```bash
NODE_ENV=production \
FIRST_ADMIN_EMAIL='admin@dominio-da-associacao.pt' \
FIRST_ADMIN_NAME='Nome da pessoa responsável' \
npm run bootstrap:first-admin -- --confirm
```

Não colocar a `SUPABASE_SERVICE_KEY` diretamente no comando, porque poderia
ficar no histórico da shell. O script:

- percorre todas as páginas de utilizadores Auth e recusa continuar se já
  existir uma conta com `role=coordinator` e `coord_role=administracao`;
- exige sempre `--confirm`;
- envia apenas o convite de uso único;
- nunca gera ou imprime uma password, chave, token ou URL de convite;
- remove a conta convidada se não conseguir aplicar o `app_metadata` seguro.

Depois do comando, abrir o email de convite, definir a password e configurar
TOTP. Confirmar que o primeiro acesso produz uma sessão `aal2` antes de convidar
outras pessoas.

Depois disso, todos os outros utilizadores de coordenação são criados pela área
de Gestão da aplicação.

## 7. Smoke tests autorizados

### Registo

- Sem token Turnstile: `400`.
- Com token inválido: `400`.
- Acima do limite: `429` e cabeçalho `Retry-After`.
- Com email de teste: `202`, sem password, token, ID ou confirmação de
  existência na resposta.
- Antes de abrir o convite: o login não dá acesso ao processo.
- Depois de abrir o convite e definir uma password: o login funciona e retoma a
  jornada do próprio candidato.

### BOLA/IDOR e mass assignment

- Token do candidato A + ID do candidato B: `403` em candidatos, mensagens,
  onboarding, pedidos de contacto e notificações.
- Candidato A não consegue definir estados administrativos, falsificar autoria
  ou substituir campos administrativos de agendamento.
- Coordenador sem o papel necessário não consegue alterar estados.

### Papéis e MFA

- Alterar `user_metadata.role` numa conta candidata não muda permissões.
- Token forjado/renovado de candidato recebe `403` nas rotas administrativas.
- Coordenador com sessão `aal1` recebe `403 mfa_required`.
- Depois do desafio TOTP, a sessão `aal2` funciona.
- Alterar a função de um coordenador invalida a sessão anterior.

### Data API

- Pedidos com `anon` ou JWT normal às tabelas privadas devolvem `401/403` ou
  nenhum recurso.
- Os fluxos legítimos continuam a funcionar apenas através do backend.

## 8. Evidência da entrega

Guardar, sem dados pessoais ou segredos:

- identificador do deploy;
- resultado das migrations e contagem de revisões pendentes;
- resultados dos smoke tests;
- confirmação de SMTP, Turnstile e TOTP;
- resultado da suíte automatizada;
- responsável e data da validação.
