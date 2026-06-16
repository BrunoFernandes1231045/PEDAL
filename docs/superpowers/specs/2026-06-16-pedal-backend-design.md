# PEDAL — Backend Design Spec
**Data:** 16 de junho de 2026  
**Âmbito:** Migração do protótipo (localStorage) para Node.js + Supabase  
**Fase:** Backend — schema, API, auth, setup de desenvolvimento

---

## 1. Contexto

O protótipo PEDAL (React + Babel CDN + localStorage) tem todos os fluxos e UI implementados. Esta fase migra a camada de dados para uma stack de produção: Node.js (Express) como API, Supabase como base de dados e auth.

**Fora de âmbito nesta fase:**
- Integração LLM (bloqueada — sem API key Azure/Gemini)
- Migração do frontend para Vite (fase seguinte)
- Deploy Vercel + CI/CD
- Rate limiting do chatbot público (a implementar quando o LLM entrar)

**Stack decidida (documento de arquitectura, 9 junho 2026):**
- Frontend: React + Vite
- Backend: Node.js + Express
- Base de dados + Auth: Supabase
- Hosting: Vercel
- LLM: Azure ou Vertex AI (a confirmar — requisito RGPD processamento EU)

---

## 2. Schema da Base de Dados

### 2.1 Tabelas

#### `candidates`
| Coluna | Tipo | Notas |
|--------|------|-------|
| id | uuid PK | gerado automaticamente |
| user_id | uuid FK → auth.users | nullable; preenchido no fim da inscrição |
| name | text | |
| dob | date | data de nascimento |
| phone | text | |
| email | text | unique |
| stage | text | estado no funil: welcome, inscricao, triagem, entrevista, validacao, onboarding, pratica, formalizacao, ativo |
| locality_id | uuid FK → localities | |
| periods | jsonb | array de períodos disponíveis |
| nif | text | nullable; preenchido na formalização |
| signature | text | nullable; preenchido na formalização |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

#### `messages`
| Coluna | Tipo | Notas |
|--------|------|-------|
| id | uuid PK | |
| candidate_id | uuid FK → candidates | |
| role | text | 'user' ou 'assistant' |
| content | text | |
| node | text | nullable; nó do fluxo de chat |
| created_at | timestamptz | default now() |

#### `onboarding`
| Coluna | Tipo | Notas |
|--------|------|-------|
| id | uuid PK | |
| candidate_id | uuid FK → candidates | unique |
| practical_date | date | nullable |
| scheduling | jsonb | sessões agendadas |
| formalization_data | jsonb | dados complementares da formalização |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

#### `onboarding_progress`
| Coluna | Tipo | Notas |
|--------|------|-------|
| id | uuid PK | |
| candidate_id | uuid FK → candidates | |
| module_id | integer | 1 a 6 |
| completed | boolean | default false |
| completed_at | timestamptz | nullable |
| UNIQUE | (candidate_id, module_id) | |

#### `contact_requests`
| Coluna | Tipo | Notas |
|--------|------|-------|
| id | uuid PK | |
| candidate_id | uuid FK → candidates | |
| question | text | |
| answer | text | nullable |
| status | text | 'pending', 'answered' |
| module_id | integer | nullable; se dúvida de módulo de formação |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

#### `trainers`
| Coluna | Tipo | Notas |
|--------|------|-------|
| id | uuid PK | |
| name | text | |
| specialty | text | |
| locality_id | uuid FK → localities | nullable |
| active | boolean | default true |
| created_at | timestamptz | default now() |

#### `stations`
| Coluna | Tipo | Notas |
|--------|------|-------|
| id | uuid PK | |
| name | text | |
| address | text | |
| locality_id | uuid FK → localities | |
| created_at | timestamptz | default now() |

#### `localities`
| Coluna | Tipo | Notas |
|--------|------|-------|
| id | uuid PK | |
| name | text | |
| active | boolean | Matosinhos, Maia, Esposende activas; Porto, Vila do Conde, Gondomar inactivas |

#### `needs`
| Coluna | Tipo | Notas |
|--------|------|-------|
| id | uuid PK | |
| locality_id | uuid FK → localities | |
| periods | jsonb | array de períodos |
| status | text | 'open', 'closed' |
| description | text | nullable |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

### 2.2 Seed data
As tabelas `localities` e `needs` são inicializadas com os dados seed do protótipo (`PEDAL.LOCALITIES`, `PEDAL.SEED_NEEDS`).

---

## 3. Estrutura do Node.js

### 3.1 Organização de ficheiros

```
backend/
├── src/
│   ├── routes/
│   │   ├── candidates.js        ← CRUD + stage transitions
│   │   ├── messages.js          ← histórico de chat
│   │   ├── onboarding.js        ← estado de onboarding + progresso de módulos
│   │   ├── trainers.js          ← gestão de formadores
│   │   ├── stations.js          ← pontos de encontro
│   │   ├── needs.js             ← necessidades/vagas
│   │   ├── contactRequests.js   ← dúvidas candidato ↔ coordenação
│   │   └── dashboard.js         ← métricas agregadas
│   ├── middleware/
│   │   ├── auth.js              ← verifica JWT Supabase, injeta user + role
│   │   └── rateLimit.js         ← para /api/chat (fase LLM)
│   ├── db/
│   │   └── supabase.js          ← cliente Supabase com service key
│   └── app.js                   ← Express app, registo de rotas
├── .env.development
├── .env.production
└── package.json
```

### 3.2 Rotas da API

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/api/candidates` | público | Criar candidato (fim da inscrição) |
| GET | `/api/candidates` | coordinator | Listar todos os candidatos |
| GET | `/api/candidates/:id` | próprio ou coordinator | Obter candidato |
| PATCH | `/api/candidates/:id` | próprio ou coordinator | Actualizar dados / stage |
| PATCH | `/api/candidates/:id/formalize` | próprio | Receber NIF + assinatura, mudar stage para `ativo` |
| GET | `/api/candidates/:id/messages` | próprio ou coordinator | Histórico de chat |
| POST | `/api/candidates/:id/messages` | próprio | Adicionar mensagem |
| GET | `/api/candidates/:id/onboarding` | próprio ou coordinator | Estado de onboarding |
| PATCH | `/api/candidates/:id/onboarding` | próprio | Actualizar onboarding |
| PATCH | `/api/candidates/:id/onboarding/progress/:moduleId` | próprio | Marcar módulo como completo |
| GET | `/api/trainers` | coordinator | Listar formadores |
| POST | `/api/trainers` | coordinator | Adicionar formador |
| PATCH | `/api/trainers/:id` | coordinator | Actualizar formador |
| DELETE | `/api/trainers/:id` | coordinator | Remover formador |
| GET | `/api/stations` | coordinator | Listar pontos de encontro |
| POST | `/api/stations` | coordinator | Adicionar station |
| PATCH | `/api/stations/:id` | coordinator | Actualizar station |
| DELETE | `/api/stations/:id` | coordinator | Remover station |
| GET | `/api/needs` | coordinator | Listar necessidades |
| POST | `/api/needs` | coordinator | Criar necessidade |
| PATCH | `/api/needs/:id` | coordinator | Actualizar / fechar necessidade |
| GET | `/api/contact-requests` | coordinator | Listar dúvidas pendentes |
| POST | `/api/contact-requests` | próprio | Submeter dúvida |
| PATCH | `/api/contact-requests/:id` | coordinator | Responder a dúvida |
| GET | `/api/dashboard/stats` | coordinator | Métricas agregadas |
| POST | `/api/chat` | público (rate limited) | *(fase LLM — não implementado agora)* |

---

## 4. Auth

### 4.1 Papéis
Dois papéis no sistema:
- `candidate` — acede apenas aos seus próprios dados (verificado via `user_id` do JWT)
- `coordinator` — acede a todos os dados; papel guardado na tabela `users` do Supabase (`raw_user_meta_data.role = 'coordinator'`)

### 4.2 Fluxo

**Inscrição de candidato:**
1. Candidato preenche perfil + aceita RGPD
2. Backend chama `supabase.auth.admin.createUser({ email, password: gerada })` 
3. `user_id` retornado é gravado em `candidates.user_id`
4. Backend retorna JWT ao frontend

**Login:**
1. Frontend chama `supabase.auth.signInWithPassword`
2. JWT retornado é incluído em todos os pedidos: `Authorization: Bearer <token>`
3. Middleware `auth.js` verifica JWT via `supabase.auth.getUser(token)`
4. Injeta `req.user` (id, role) em todos os handlers

**Regra:** o backend nunca usa o body do pedido para identificar o utilizador — usa sempre o JWT.

---

## 5. Setup de Desenvolvimento

### 5.1 Estrutura de repositório

```
PEDAL/
├── frontend/           ← React + Vite (migração do protótipo)
├── backend/            ← Node.js + Express
└── package.json        ← scripts para correr os dois em simultâneo
```

### 5.2 Variáveis de ambiente

**`backend/.env.development`**
```env
SUPABASE_URL=https://<dev-project>.supabase.co
SUPABASE_SERVICE_KEY=<service-role-key-dev>
PORT=3001
NODE_ENV=development
```

**`backend/.env.production`**
```env
SUPABASE_URL=https://<prod-project>.supabase.co
SUPABASE_SERVICE_KEY=<service-role-key-prod>
PORT=3001
NODE_ENV=production
```

⚠️ `SUPABASE_SERVICE_KEY` nunca é exposta ao frontend. Fica apenas no backend.

### 5.3 Dois projectos Supabase

- `pedal-dev` — desenvolvimento local  
- `pedal-prod` — produção  

**Acção obrigatória antes de começar:** marcar a base de dados `pedal-dev` como persistente no painel do Supabase. Por defeito, o Supabase associa a BD à branch GitHub e apaga-a no merge.

### 5.4 MCP Server (Claude Code)
Ligar o MCP Server do Claude Code **apenas ao projecto `pedal-dev`**. Nunca ao `pedal-prod` — o Claude Code com acesso à BD de produção pode executar operações destrutivas.

### 5.5 Correr localmente

```bash
# instalar dependências
cd backend && npm install

# correr backend
npm run dev   # porta 3001

# frontend (index.html ou Vite dev server após migração)
cd frontend && npm run dev   # porta 5173
```

---

## 6. Decisões e Justificações

| Decisão | Razão |
|---------|-------|
| Node.js como camada API (não directo ao Supabase) | Abstracção correcta para produto — lógica de negócio no servidor, schema não exposto ao frontend |
| `user_id` nullable em `candidates` | Candidato existe no sistema antes de ter conta; preenchido no fim da inscrição |
| `onboarding_progress` separado | Permite queries eficientes por módulo sem parsear JSONB |
| `user_id` preenchido na inscrição | A conta é criada no fim da inscrição (após RGPD + perfil), não na formalização |
| Dois projectos Supabase | Isolamento total entre dev e prod — sem risco de dados de dev contaminarem prod |
| `SUPABASE_SERVICE_KEY` apenas no backend | A chave de serviço tem acesso total à BD; nunca deve ser exposta no cliente |

---

## 7. Fora de Âmbito (fases seguintes)

- **Migração frontend para Vite** — fase a seguir a esta
- **Integração LLM** — bloqueada (API key Azure/Vertex AI pendente; conteúdos RAG pendentes da Sílvia)
- **Rate limiting `/api/chat`** — implementar quando o LLM entrar
- **Deploy Vercel + CI/CD** — após as fases de backend e frontend estarem estáveis
- **SendGrid (email transacional)** — necessário se o volume de emails crescer além do free tier Supabase
