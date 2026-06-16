# PEDAL Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Node.js + Express API that substitui o localStorage por um backend Supabase, cobrindo todas as rotas definidas no design spec.

**Architecture:** O frontend React chama a API Node.js (nunca o Supabase directamente). A API valida JWTs do Supabase Auth, aplica controlo de acesso por papel (candidate / coordinator), e executa todas as operações na BD via service key do Supabase.

**Tech Stack:** Node.js 20+, Express 4, @supabase/supabase-js v2, Jest + supertest, dotenv, cors, nodemon

---

## Ficheiros a criar

```
PEDAL/
├── backend/
│   ├── src/
│   │   ├── app.js                        ← Express app + registo de rotas
│   │   ├── index.js                      ← entry point (listen)
│   │   ├── db/
│   │   │   └── supabase.js               ← cliente Supabase (service key)
│   │   ├── middleware/
│   │   │   └── auth.js                   ← requireAuth, requireCoordinator
│   │   └── routes/
│   │       ├── candidates.js             ← CRUD + formalize
│   │       ├── messages.js               ← histórico de chat
│   │       ├── onboarding.js             ← onboarding + progresso de módulos
│   │       ├── trainers.js               ← formadores
│   │       ├── stations.js               ← pontos de encontro
│   │       ├── needs.js                  ← necessidades/vagas
│   │       ├── contactRequests.js        ← dúvidas candidato ↔ coordenação
│   │       └── dashboard.js              ← métricas agregadas
│   ├── tests/
│   │   ├── middleware/
│   │   │   └── auth.test.js
│   │   └── routes/
│   │       ├── candidates.test.js
│   │       ├── messages.test.js
│   │       ├── onboarding.test.js
│   │       ├── trainers.test.js
│   │       ├── stations.test.js
│   │       ├── needs.test.js
│   │       ├── contactRequests.test.js
│   │       └── dashboard.test.js
│   ├── supabase/
│   │   ├── migrations/
│   │   │   └── 001_initial_schema.sql
│   │   └── seed.sql
│   ├── .env.development.example
│   └── package.json
└── package.json                          ← scripts monorepo
```

---

## Task 1: Setup do projecto

**Files:**
- Create: `backend/package.json`
- Create: `backend/src/index.js`
- Create: `backend/src/app.js`
- Create: `backend/.env.development.example`

- [ ] **Step 1: Inicializar package.json**

```bash
cd backend
npm init -y
npm install express @supabase/supabase-js dotenv cors
npm install --save-dev jest supertest nodemon
```

- [ ] **Step 2: Criar estrutura de pastas**

```bash
mkdir -p src/routes src/middleware src/db tests/middleware tests/routes supabase/migrations
```

- [ ] **Step 3: Criar `.env.development.example`**

```env
SUPABASE_URL=https://<dev-project>.supabase.co
SUPABASE_SERVICE_KEY=<service-role-key-do-painel-supabase-settings-api>
PORT=3001
NODE_ENV=development
```

Copiar para `.env.development` e preencher com os valores reais do projecto `pedal-dev` no Supabase (Settings → API).

⚠️ `SUPABASE_SERVICE_KEY` tem acesso total à BD. Nunca expor ao frontend nem commitar para o repositório.

- [ ] **Step 4: Adicionar `.env.development` ao `.gitignore` (raiz do projecto)**

Verificar que o ficheiro raiz `.gitignore` contém:
```
backend/.env.development
backend/.env.production
```

Se não existir `.gitignore` na raiz, criar com esse conteúdo.

- [ ] **Step 5: Criar `package.json` scripts**

Editar `backend/package.json` e substituir o bloco `"scripts"`:

```json
{
  "scripts": {
    "dev": "NODE_ENV=development nodemon src/index.js",
    "start": "NODE_ENV=production node src/index.js",
    "test": "NODE_ENV=test jest --runInBand"
  },
  "jest": {
    "testEnvironment": "node"
  }
}
```

- [ ] **Step 6: Criar `src/index.js`**

```javascript
require('dotenv').config({ path: `.env.${process.env.NODE_ENV || 'development'}` });
const app = require('./app');

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`PEDAL API a correr na porta ${PORT}`));
```

- [ ] **Step 7: Criar `src/app.js` (placeholder)**

```javascript
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

module.exports = app;
```

- [ ] **Step 8: Testar servidor**

```bash
npm run dev
```

Noutro terminal:
```bash
curl http://localhost:3001/health
```
Expected: `{"status":"ok"}`

- [ ] **Step 9: Commit**

```bash
git add backend/
git commit -m "feat: initialise backend project structure"
```

---

## Task 2: Cliente Supabase

**Files:**
- Create: `backend/src/db/supabase.js`

- [ ] **Step 1: Criar cliente Supabase**

```javascript
// src/db/supabase.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = supabase;
```

- [ ] **Step 2: Verificar ligação (com servidor a correr)**

Adicionar temporariamente ao final de `src/index.js` após o `app.listen`:

```javascript
const supabase = require('./db/supabase');
supabase.from('localities').select('count').then(({ error }) => {
  if (error) console.error('Supabase erro:', error.message);
  else console.log('Supabase ligado');
});
```

Correr `npm run dev`. Se o schema ainda não existir, aparece erro de tabela inexistente — é esperado. Se aparecer "Supabase ligado", a chave e o URL estão correctos.

Remover esse bloco de verificação de `index.js` após confirmar.

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/supabase.js backend/src/index.js
git commit -m "feat: add Supabase client"
```

---

## Task 3: Schema da base de dados

**Files:**
- Create: `backend/supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Escrever migração SQL**

```sql
-- supabase/migrations/001_initial_schema.sql

create table localities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true
);

create table candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  name text not null,
  dob date,
  phone text,
  email text unique not null,
  stage text not null default 'welcome',
  locality_id uuid references localities(id),
  periods jsonb default '[]',
  nif text,
  signature text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  node text,
  created_at timestamptz not null default now()
);

create table onboarding (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null unique references candidates(id) on delete cascade,
  practical_date date,
  scheduling jsonb default '[]',
  formalization_data jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table onboarding_progress (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  module_id integer not null check (module_id between 1 and 6),
  completed boolean not null default false,
  completed_at timestamptz,
  unique (candidate_id, module_id)
);

create table contact_requests (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  question text not null,
  answer text,
  status text not null default 'pending' check (status in ('pending', 'answered')),
  module_id integer check (module_id between 1 and 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table trainers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  specialty text,
  locality_id uuid references localities(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table stations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  locality_id uuid references localities(id),
  created_at timestamptz not null default now()
);

create table needs (
  id uuid primary key default gen_random_uuid(),
  locality_id uuid references localities(id),
  periods jsonb default '[]',
  status text not null default 'open' check (status in ('open', 'closed')),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

- [ ] **Step 2: Executar no Supabase**

Supabase → SQL Editor → colar o SQL → Run.

Verificar no Table Editor que aparecem 9 tabelas: `localities`, `candidates`, `messages`, `onboarding`, `onboarding_progress`, `contact_requests`, `trainers`, `stations`, `needs`.

- [ ] **Step 3: Commit**

```bash
git add backend/supabase/migrations/001_initial_schema.sql
git commit -m "feat: add initial database schema"
```

---

## Task 4: Seed data

**Files:**
- Create: `backend/supabase/seed.sql`

- [ ] **Step 1: Escrever seed**

```sql
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
```

- [ ] **Step 2: Executar no Supabase**

SQL Editor → colar seed.sql → Run.

Verificar: `localities` tem 6 linhas, `needs` tem 3 linhas.

- [ ] **Step 3: Commit**

```bash
git add backend/supabase/seed.sql
git commit -m "feat: add seed data for localities and needs"
```

---

## Task 5: Auth middleware

**Files:**
- Create: `backend/src/middleware/auth.js`
- Create: `backend/tests/middleware/auth.test.js`

- [ ] **Step 1: Escrever testes (falha primeiro)**

```javascript
// tests/middleware/auth.test.js
jest.mock('../../src/db/supabase', () => ({
  auth: { getUser: jest.fn() },
}));

const supabase = require('../../src/db/supabase');
const { requireAuth, requireCoordinator } = require('../../src/middleware/auth');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('requireAuth', () => {
  it('returns 401 when no Authorization header', async () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is invalid', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid') });
    const req = { headers: { authorization: 'Bearer bad-token' } };
    const res = mockRes();
    const next = jest.fn();
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('sets req.user and calls next when token is valid', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123', user_metadata: { role: 'candidate' } } },
      error: null,
    });
    const req = { headers: { authorization: 'Bearer valid-token' } };
    const res = mockRes();
    const next = jest.fn();
    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ id: 'user-123', role: 'candidate' });
  });
});

describe('requireCoordinator', () => {
  it('returns 403 when user is candidate', () => {
    const req = { user: { id: 'u1', role: 'candidate' } };
    const res = mockRes();
    const next = jest.fn();
    requireCoordinator(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when user is coordinator', () => {
    const req = { user: { id: 'u1', role: 'coordinator' } };
    const res = mockRes();
    const next = jest.fn();
    requireCoordinator(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr testes — verificar falha**

```bash
npm test tests/middleware/auth.test.js
```
Expected: FAIL — `Cannot find module '../../src/middleware/auth'`

- [ ] **Step 3: Implementar middleware**

```javascript
// src/middleware/auth.js
const supabase = require('../db/supabase');

async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token em falta' });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Token inválido' });

  req.user = { id: user.id, role: user.user_metadata?.role || 'candidate' };
  next();
}

function requireCoordinator(req, res, next) {
  if (req.user?.role !== 'coordinator') {
    return res.status(403).json({ error: 'Acesso reservado a coordenadores' });
  }
  next();
}

module.exports = { requireAuth, requireCoordinator };
```

- [ ] **Step 4: Correr testes — verificar passagem**

```bash
npm test tests/middleware/auth.test.js
```
Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add backend/src/middleware/auth.js backend/tests/middleware/auth.test.js
git commit -m "feat: add auth middleware"
```

---

## Task 6: Candidates routes

**Files:**
- Create: `backend/src/routes/candidates.js`
- Create: `backend/tests/routes/candidates.test.js`

- [ ] **Step 1: Escrever testes (falha primeiro)**

```javascript
// tests/routes/candidates.test.js
jest.mock('../../src/db/supabase', () => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  };
  return { from: jest.fn(() => chain), auth: { admin: { createUser: jest.fn() } } };
});
jest.mock('../../src/middleware/auth', () => ({
  requireAuth: (req, res, next) => { req.user = { id: 'cand-1', role: 'candidate' }; next(); },
  requireCoordinator: (req, res, next) => next(),
}));

const request = require('supertest');
const app = require('../../src/app');
const supabase = require('../../src/db/supabase');

describe('POST /api/candidates', () => {
  it('creates candidate and auth user, returns 201', async () => {
    supabase.auth.admin.createUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } }, error: null,
    });
    supabase.from().single.mockResolvedValue({
      data: { id: 'cand-1', name: 'Maria', email: 'maria@test.com', stage: 'inscricao' },
      error: null,
    });

    const res = await request(app)
      .post('/api/candidates')
      .send({ name: 'Maria', email: 'maria@test.com', dob: '1950-01-01', phone: '912345678' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('cand-1');
    expect(res.body.initialPassword).toBeDefined();
  });

  it('returns 400 when name or email missing', async () => {
    const res = await request(app).post('/api/candidates').send({ name: 'Maria' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/candidates', () => {
  it('returns list of candidates for coordinator', async () => {
    supabase.from().select.mockResolvedValue({
      data: [{ id: 'cand-1', name: 'Maria' }], error: null,
    });
    const res = await request(app)
      .get('/api/candidates')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('GET /api/candidates/:id', () => {
  it('returns candidate data', async () => {
    supabase.from().single.mockResolvedValue({
      data: { id: 'cand-1', name: 'Maria', stage: 'triagem' }, error: null,
    });
    const res = await request(app)
      .get('/api/candidates/cand-1')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Maria');
  });
});

describe('PATCH /api/candidates/:id', () => {
  it('updates candidate data', async () => {
    supabase.from().single.mockResolvedValue({
      data: { id: 'cand-1', stage: 'triagem' }, error: null,
    });
    const res = await request(app)
      .patch('/api/candidates/cand-1')
      .set('Authorization', 'Bearer valid-token')
      .send({ stage: 'triagem' });
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('triagem');
  });
});

describe('PATCH /api/candidates/:id/formalize', () => {
  it('sets nif, signature and stage to ativo', async () => {
    supabase.from().single.mockResolvedValue({
      data: { id: 'cand-1', stage: 'ativo', nif: '123456789' }, error: null,
    });
    const res = await request(app)
      .patch('/api/candidates/cand-1/formalize')
      .set('Authorization', 'Bearer valid-token')
      .send({ nif: '123456789', signature: 'sig-base64' });
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('ativo');
  });

  it('returns 400 when nif or signature missing', async () => {
    const res = await request(app)
      .patch('/api/candidates/cand-1/formalize')
      .set('Authorization', 'Bearer valid-token')
      .send({ nif: '123456789' });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Correr testes — verificar falha**

```bash
npm test tests/routes/candidates.test.js
```
Expected: FAIL

- [ ] **Step 3: Implementar candidates routes**

```javascript
// src/routes/candidates.js
const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { requireAuth, requireCoordinator } = require('../middleware/auth');

function genPassword() {
  const words = ['pedal', 'bici', 'porto', 'piloto', 'rota'];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${word}${num}`;
}

// POST /api/candidates — público (inscrição)
router.post('/', async (req, res) => {
  const { name, email, dob, phone } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name e email são obrigatórios' });

  const initialPassword = genPassword();

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: initialPassword,
    user_metadata: { role: 'candidate' },
    email_confirm: true,
  });
  if (authError) return res.status(500).json({ error: authError.message });

  const { data, error } = await supabase
    .from('candidates')
    .insert({ name, email, dob, phone, stage: 'inscricao', user_id: authData.user.id })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ ...data, initialPassword });
});

// GET /api/candidates — coordinator only
router.get('/', requireAuth, requireCoordinator, async (req, res) => {
  const { data, error } = await supabase.from('candidates').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/candidates/:id — próprio ou coordinator
router.get('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  if (req.user.role !== 'coordinator' && req.user.id !== id) {
    return res.status(403).json({ error: 'Proibido' });
  }
  const { data, error } = await supabase
    .from('candidates').select('*').eq('id', id).single();
  if (error) return res.status(404).json({ error: 'Não encontrado' });
  res.json(data);
});

// PATCH /api/candidates/:id — próprio ou coordinator
router.patch('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  if (req.user.role !== 'coordinator' && req.user.id !== id) {
    return res.status(403).json({ error: 'Proibido' });
  }
  const { data, error } = await supabase
    .from('candidates')
    .update({ ...req.body, updated_at: new Date() })
    .eq('id', id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PATCH /api/candidates/:id/formalize — próprio candidato
router.patch('/:id/formalize', requireAuth, async (req, res) => {
  const { nif, signature } = req.body;
  if (!nif || !signature) return res.status(400).json({ error: 'nif e signature são obrigatórios' });

  const { data, error } = await supabase
    .from('candidates')
    .update({ nif, signature, stage: 'ativo', updated_at: new Date() })
    .eq('id', req.params.id).select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
```

- [ ] **Step 4: Registar rota em `src/app.js`**

```javascript
const express = require('express');
const cors = require('cors');
const candidatesRouter = require('./routes/candidates');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/candidates', candidatesRouter);

module.exports = app;
```

- [ ] **Step 5: Correr testes — verificar passagem**

```bash
npm test tests/routes/candidates.test.js
```
Expected: PASS — 7 tests

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/candidates.js backend/tests/routes/candidates.test.js backend/src/app.js
git commit -m "feat: add candidates routes (CRUD + formalize)"
```

---

## Task 7: Messages routes

**Files:**
- Create: `backend/src/routes/messages.js`
- Create: `backend/tests/routes/messages.test.js`

- [ ] **Step 1: Escrever testes (falha primeiro)**

```javascript
// tests/routes/messages.test.js
jest.mock('../../src/db/supabase', () => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn(),
  };
  return { from: jest.fn(() => chain) };
});
jest.mock('../../src/middleware/auth', () => ({
  requireAuth: (req, res, next) => { req.user = { id: 'cand-1', role: 'candidate' }; next(); },
  requireCoordinator: (req, res, next) => next(),
}));

const request = require('supertest');
const app = require('../../src/app');
const supabase = require('../../src/db/supabase');

describe('GET /api/candidates/:id/messages', () => {
  it('returns messages ordered by created_at', async () => {
    supabase.from().order.mockResolvedValue({
      data: [{ id: 'msg-1', role: 'assistant', content: 'Olá!' }], error: null,
    });
    const res = await request(app)
      .get('/api/candidates/cand-1/messages')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body[0].content).toBe('Olá!');
  });
});

describe('POST /api/candidates/:id/messages', () => {
  it('adds a message and returns 201', async () => {
    supabase.from().single.mockResolvedValue({
      data: { id: 'msg-2', role: 'user', content: 'Tenho dúvidas' }, error: null,
    });
    const res = await request(app)
      .post('/api/candidates/cand-1/messages')
      .set('Authorization', 'Bearer valid-token')
      .send({ role: 'user', content: 'Tenho dúvidas' });
    expect(res.status).toBe(201);
    expect(res.body.content).toBe('Tenho dúvidas');
  });

  it('returns 400 when role or content missing', async () => {
    const res = await request(app)
      .post('/api/candidates/cand-1/messages')
      .set('Authorization', 'Bearer valid-token')
      .send({ role: 'user' });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Correr testes — verificar falha**

```bash
npm test tests/routes/messages.test.js
```
Expected: FAIL

- [ ] **Step 3: Implementar messages routes**

```javascript
// src/routes/messages.js
const express = require('express');
const router = express.Router({ mergeParams: true });
const supabase = require('../db/supabase');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  const { id } = req.params;
  if (req.user.role !== 'coordinator' && req.user.id !== id) {
    return res.status(403).json({ error: 'Proibido' });
  }
  const { data, error } = await supabase
    .from('messages').select('*').eq('candidate_id', id)
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { role, content, node } = req.body;
  if (!role || !content) return res.status(400).json({ error: 'role e content são obrigatórios' });

  const { data, error } = await supabase
    .from('messages').insert({ candidate_id: id, role, content, node }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

module.exports = router;
```

- [ ] **Step 4: Registar em `src/app.js`**

Adicionar após o import dos candidates:
```javascript
const messagesRouter = require('./routes/messages');
// ...
app.use('/api/candidates/:id/messages', messagesRouter);
```

- [ ] **Step 5: Correr testes — verificar passagem**

```bash
npm test tests/routes/messages.test.js
```
Expected: PASS — 3 tests

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/messages.js backend/tests/routes/messages.test.js backend/src/app.js
git commit -m "feat: add messages routes"
```

---

## Task 8: Onboarding routes

**Files:**
- Create: `backend/src/routes/onboarding.js`
- Create: `backend/tests/routes/onboarding.test.js`

- [ ] **Step 1: Escrever testes (falha primeiro)**

```javascript
// tests/routes/onboarding.test.js
jest.mock('../../src/db/supabase', () => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  };
  return { from: jest.fn(() => chain) };
});
jest.mock('../../src/middleware/auth', () => ({
  requireAuth: (req, res, next) => { req.user = { id: 'cand-1', role: 'candidate' }; next(); },
  requireCoordinator: (req, res, next) => next(),
}));

const request = require('supertest');
const app = require('../../src/app');
const supabase = require('../../src/db/supabase');

describe('GET /api/candidates/:id/onboarding', () => {
  it('returns onboarding data', async () => {
    supabase.from().single.mockResolvedValue({
      data: { id: 'onb-1', candidate_id: 'cand-1', practical_date: null }, error: null,
    });
    const res = await request(app)
      .get('/api/candidates/cand-1/onboarding')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body.candidate_id).toBe('cand-1');
  });
});

describe('PATCH /api/candidates/:id/onboarding/progress/:moduleId', () => {
  it('marks module as complete', async () => {
    supabase.from().single.mockResolvedValue({
      data: { candidate_id: 'cand-1', module_id: 2, completed: true }, error: null,
    });
    const res = await request(app)
      .patch('/api/candidates/cand-1/onboarding/progress/2')
      .set('Authorization', 'Bearer valid-token')
      .send({ completed: true });
    expect(res.status).toBe(200);
    expect(res.body.completed).toBe(true);
  });
});
```

- [ ] **Step 2: Correr testes — verificar falha**

```bash
npm test tests/routes/onboarding.test.js
```
Expected: FAIL

- [ ] **Step 3: Implementar onboarding routes**

```javascript
// src/routes/onboarding.js
const express = require('express');
const router = express.Router({ mergeParams: true });
const supabase = require('../db/supabase');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  const { id } = req.params;
  if (req.user.role !== 'coordinator' && req.user.id !== id) {
    return res.status(403).json({ error: 'Proibido' });
  }
  const { data, error } = await supabase
    .from('onboarding').select('*').eq('candidate_id', id).single();
  if (error) return res.status(404).json({ error: 'Não encontrado' });
  res.json(data);
});

router.patch('/', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('onboarding')
    .upsert({ candidate_id: id, ...req.body, updated_at: new Date() })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.patch('/progress/:moduleId', requireAuth, async (req, res) => {
  const { id, moduleId } = req.params;
  const { completed } = req.body;
  const completed_at = completed ? new Date() : null;

  const { data, error } = await supabase
    .from('onboarding_progress')
    .upsert({ candidate_id: id, module_id: parseInt(moduleId), completed, completed_at })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
```

- [ ] **Step 4: Registar em `src/app.js`**

```javascript
const onboardingRouter = require('./routes/onboarding');
// ...
app.use('/api/candidates/:id/onboarding', onboardingRouter);
```

- [ ] **Step 5: Correr testes — verificar passagem**

```bash
npm test tests/routes/onboarding.test.js
```
Expected: PASS — 2 tests

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/onboarding.js backend/tests/routes/onboarding.test.js backend/src/app.js
git commit -m "feat: add onboarding routes"
```

---

## Task 9: Trainers routes

**Files:**
- Create: `backend/src/routes/trainers.js`
- Create: `backend/tests/routes/trainers.test.js`

- [ ] **Step 1: Escrever testes (falha primeiro)**

```javascript
// tests/routes/trainers.test.js
jest.mock('../../src/db/supabase', () => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  };
  return { from: jest.fn(() => chain) };
});
jest.mock('../../src/middleware/auth', () => ({
  requireAuth: (req, res, next) => { req.user = { id: 'coord-1', role: 'coordinator' }; next(); },
  requireCoordinator: (req, res, next) => next(),
}));

const request = require('supertest');
const app = require('../../src/app');
const supabase = require('../../src/db/supabase');

describe('GET /api/trainers', () => {
  it('returns active trainers', async () => {
    supabase.from().eq.mockResolvedValue({
      data: [{ id: 't-1', name: 'Ana Costa', active: true }], error: null,
    });
    const res = await request(app)
      .get('/api/trainers').set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('POST /api/trainers', () => {
  it('creates trainer and returns 201', async () => {
    supabase.from().single.mockResolvedValue({
      data: { id: 't-2', name: 'João Silva' }, error: null,
    });
    const res = await request(app)
      .post('/api/trainers').set('Authorization', 'Bearer valid-token')
      .send({ name: 'João Silva', specialty: 'Segurança' });
    expect(res.status).toBe(201);
  });

  it('returns 400 when name missing', async () => {
    const res = await request(app)
      .post('/api/trainers').set('Authorization', 'Bearer valid-token').send({});
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/trainers/:id', () => {
  it('deletes trainer and returns 204', async () => {
    supabase.from().eq.mockResolvedValue({ error: null });
    const res = await request(app)
      .delete('/api/trainers/t-1').set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(204);
  });
});
```

- [ ] **Step 2: Correr testes — verificar falha**

```bash
npm test tests/routes/trainers.test.js
```
Expected: FAIL

- [ ] **Step 3: Implementar trainers routes**

```javascript
// src/routes/trainers.js
const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { requireAuth, requireCoordinator } = require('../middleware/auth');

router.get('/', requireAuth, requireCoordinator, async (req, res) => {
  const { data, error } = await supabase.from('trainers').select('*').eq('active', true);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/', requireAuth, requireCoordinator, async (req, res) => {
  const { name, specialty, locality_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name é obrigatório' });
  const { data, error } = await supabase
    .from('trainers').insert({ name, specialty, locality_id }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.patch('/:id', requireAuth, requireCoordinator, async (req, res) => {
  const { data, error } = await supabase
    .from('trainers').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/:id', requireAuth, requireCoordinator, async (req, res) => {
  const { error } = await supabase.from('trainers').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

module.exports = router;
```

- [ ] **Step 4: Registar em `src/app.js`**

```javascript
const trainersRouter = require('./routes/trainers');
// ...
app.use('/api/trainers', trainersRouter);
```

- [ ] **Step 5: Correr testes — verificar passagem**

```bash
npm test tests/routes/trainers.test.js
```
Expected: PASS — 4 tests

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/trainers.js backend/tests/routes/trainers.test.js backend/src/app.js
git commit -m "feat: add trainers routes"
```

---

## Task 10: Stations routes

**Files:**
- Create: `backend/src/routes/stations.js`
- Create: `backend/tests/routes/stations.test.js`

- [ ] **Step 1: Escrever testes (falha primeiro)**

```javascript
// tests/routes/stations.test.js
jest.mock('../../src/db/supabase', () => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  };
  return { from: jest.fn(() => chain) };
});
jest.mock('../../src/middleware/auth', () => ({
  requireAuth: (req, res, next) => { req.user = { id: 'coord-1', role: 'coordinator' }; next(); },
  requireCoordinator: (req, res, next) => next(),
}));

const request = require('supertest');
const app = require('../../src/app');
const supabase = require('../../src/db/supabase');

describe('GET /api/stations', () => {
  it('returns stations', async () => {
    supabase.from().select.mockResolvedValue({
      data: [{ id: 'st-1', name: 'Parque das Marinhas' }], error: null,
    });
    const res = await request(app)
      .get('/api/stations').set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('POST /api/stations', () => {
  it('creates station and returns 201', async () => {
    supabase.from().single.mockResolvedValue({
      data: { id: 'st-2', name: 'Jardim do Morro' }, error: null,
    });
    const res = await request(app)
      .post('/api/stations').set('Authorization', 'Bearer valid-token')
      .send({ name: 'Jardim do Morro', address: 'Rua X' });
    expect(res.status).toBe(201);
  });

  it('returns 400 when name missing', async () => {
    const res = await request(app)
      .post('/api/stations').set('Authorization', 'Bearer valid-token').send({});
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/stations/:id', () => {
  it('deletes station and returns 204', async () => {
    supabase.from().eq.mockResolvedValue({ error: null });
    const res = await request(app)
      .delete('/api/stations/st-1').set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(204);
  });
});
```

- [ ] **Step 2: Correr testes — verificar falha**

```bash
npm test tests/routes/stations.test.js
```
Expected: FAIL

- [ ] **Step 3: Implementar stations routes**

```javascript
// src/routes/stations.js
const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { requireAuth, requireCoordinator } = require('../middleware/auth');

router.get('/', requireAuth, requireCoordinator, async (req, res) => {
  const { data, error } = await supabase.from('stations').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/', requireAuth, requireCoordinator, async (req, res) => {
  const { name, address, locality_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name é obrigatório' });
  const { data, error } = await supabase
    .from('stations').insert({ name, address, locality_id }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.patch('/:id', requireAuth, requireCoordinator, async (req, res) => {
  const { data, error } = await supabase
    .from('stations').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/:id', requireAuth, requireCoordinator, async (req, res) => {
  const { error } = await supabase.from('stations').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

module.exports = router;
```

- [ ] **Step 4: Registar em `src/app.js`**

```javascript
const stationsRouter = require('./routes/stations');
// ...
app.use('/api/stations', stationsRouter);
```

- [ ] **Step 5: Correr testes — verificar passagem**

```bash
npm test tests/routes/stations.test.js
```
Expected: PASS — 4 tests

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/stations.js backend/tests/routes/stations.test.js backend/src/app.js
git commit -m "feat: add stations routes"
```

---

## Task 11: Needs routes

**Files:**
- Create: `backend/src/routes/needs.js`
- Create: `backend/tests/routes/needs.test.js`

- [ ] **Step 1: Escrever testes (falha primeiro)**

```javascript
// tests/routes/needs.test.js
jest.mock('../../src/db/supabase', () => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  };
  return { from: jest.fn(() => chain) };
});
jest.mock('../../src/middleware/auth', () => ({
  requireAuth: (req, res, next) => { req.user = { id: 'coord-1', role: 'coordinator' }; next(); },
  requireCoordinator: (req, res, next) => next(),
}));

const request = require('supertest');
const app = require('../../src/app');
const supabase = require('../../src/db/supabase');

describe('GET /api/needs', () => {
  it('returns needs', async () => {
    supabase.from().select.mockResolvedValue({
      data: [{ id: 'n-1', status: 'open' }], error: null,
    });
    const res = await request(app)
      .get('/api/needs').set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body[0].status).toBe('open');
  });
});

describe('POST /api/needs', () => {
  it('creates need and returns 201', async () => {
    supabase.from().single.mockResolvedValue({
      data: { id: 'n-2', status: 'open' }, error: null,
    });
    const res = await request(app)
      .post('/api/needs').set('Authorization', 'Bearer valid-token')
      .send({ locality_id: 'loc-1', periods: ['Manhãs'] });
    expect(res.status).toBe(201);
  });
});

describe('PATCH /api/needs/:id', () => {
  it('closes a need', async () => {
    supabase.from().single.mockResolvedValue({
      data: { id: 'n-1', status: 'closed' }, error: null,
    });
    const res = await request(app)
      .patch('/api/needs/n-1').set('Authorization', 'Bearer valid-token')
      .send({ status: 'closed' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('closed');
  });
});
```

- [ ] **Step 2: Correr testes — verificar falha**

```bash
npm test tests/routes/needs.test.js
```
Expected: FAIL

- [ ] **Step 3: Implementar needs routes**

```javascript
// src/routes/needs.js
const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { requireAuth, requireCoordinator } = require('../middleware/auth');

router.get('/', requireAuth, requireCoordinator, async (req, res) => {
  const { data, error } = await supabase.from('needs').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/', requireAuth, requireCoordinator, async (req, res) => {
  const { locality_id, periods, description } = req.body;
  const { data, error } = await supabase
    .from('needs').insert({ locality_id, periods, description }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.patch('/:id', requireAuth, requireCoordinator, async (req, res) => {
  const { data, error } = await supabase
    .from('needs')
    .update({ ...req.body, updated_at: new Date() })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
```

- [ ] **Step 4: Registar em `src/app.js`**

```javascript
const needsRouter = require('./routes/needs');
// ...
app.use('/api/needs', needsRouter);
```

- [ ] **Step 5: Correr testes — verificar passagem**

```bash
npm test tests/routes/needs.test.js
```
Expected: PASS — 3 tests

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/needs.js backend/tests/routes/needs.test.js backend/src/app.js
git commit -m "feat: add needs routes"
```

---

## Task 12: Contact requests routes

**Files:**
- Create: `backend/src/routes/contactRequests.js`
- Create: `backend/tests/routes/contactRequests.test.js`

- [ ] **Step 1: Escrever testes (falha primeiro)**

```javascript
// tests/routes/contactRequests.test.js
jest.mock('../../src/db/supabase', () => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  };
  return { from: jest.fn(() => chain) };
});
jest.mock('../../src/middleware/auth', () => ({
  requireAuth: (req, res, next) => { req.user = { id: 'coord-1', role: 'coordinator' }; next(); },
  requireCoordinator: (req, res, next) => next(),
}));

const request = require('supertest');
const app = require('../../src/app');
const supabase = require('../../src/db/supabase');

describe('GET /api/contact-requests', () => {
  it('returns pending requests', async () => {
    supabase.from().eq.mockResolvedValue({
      data: [{ id: 'cr-1', status: 'pending' }], error: null,
    });
    const res = await request(app)
      .get('/api/contact-requests').set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body[0].status).toBe('pending');
  });
});

describe('POST /api/contact-requests', () => {
  it('creates request and returns 201', async () => {
    supabase.from().single.mockResolvedValue({
      data: { id: 'cr-2', status: 'pending' }, error: null,
    });
    const res = await request(app)
      .post('/api/contact-requests').set('Authorization', 'Bearer valid-token')
      .send({ candidate_id: 'cand-1', question: 'Como funciona?' });
    expect(res.status).toBe(201);
  });

  it('returns 400 when question missing', async () => {
    const res = await request(app)
      .post('/api/contact-requests').set('Authorization', 'Bearer valid-token')
      .send({ candidate_id: 'cand-1' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/contact-requests/:id', () => {
  it('answers a request', async () => {
    supabase.from().single.mockResolvedValue({
      data: { id: 'cr-1', status: 'answered', answer: 'Resposta aqui' }, error: null,
    });
    const res = await request(app)
      .patch('/api/contact-requests/cr-1').set('Authorization', 'Bearer valid-token')
      .send({ answer: 'Resposta aqui' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('answered');
  });

  it('returns 400 when answer missing', async () => {
    const res = await request(app)
      .patch('/api/contact-requests/cr-1').set('Authorization', 'Bearer valid-token')
      .send({});
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Correr testes — verificar falha**

```bash
npm test tests/routes/contactRequests.test.js
```
Expected: FAIL

- [ ] **Step 3: Implementar contact requests routes**

```javascript
// src/routes/contactRequests.js
const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { requireAuth, requireCoordinator } = require('../middleware/auth');

router.get('/', requireAuth, requireCoordinator, async (req, res) => {
  const { data, error } = await supabase
    .from('contact_requests').select('*').eq('status', 'pending');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/', requireAuth, async (req, res) => {
  const { candidate_id, question, module_id } = req.body;
  if (!question) return res.status(400).json({ error: 'question é obrigatório' });
  const { data, error } = await supabase
    .from('contact_requests').insert({ candidate_id, question, module_id }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.patch('/:id', requireAuth, requireCoordinator, async (req, res) => {
  const { answer } = req.body;
  if (!answer) return res.status(400).json({ error: 'answer é obrigatório' });
  const { data, error } = await supabase
    .from('contact_requests')
    .update({ answer, status: 'answered', updated_at: new Date() })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
```

- [ ] **Step 4: Registar em `src/app.js`**

```javascript
const contactRequestsRouter = require('./routes/contactRequests');
// ...
app.use('/api/contact-requests', contactRequestsRouter);
```

- [ ] **Step 5: Correr testes — verificar passagem**

```bash
npm test tests/routes/contactRequests.test.js
```
Expected: PASS — 4 tests

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/contactRequests.js backend/tests/routes/contactRequests.test.js backend/src/app.js
git commit -m "feat: add contact requests routes"
```

---

## Task 13: Dashboard route

**Files:**
- Create: `backend/src/routes/dashboard.js`
- Create: `backend/tests/routes/dashboard.test.js`

- [ ] **Step 1: Escrever testes (falha primeiro)**

```javascript
// tests/routes/dashboard.test.js
jest.mock('../../src/db/supabase', () => {
  const chain = { select: jest.fn().mockReturnThis() };
  return { from: jest.fn(() => chain) };
});
jest.mock('../../src/middleware/auth', () => ({
  requireAuth: (req, res, next) => { req.user = { id: 'coord-1', role: 'coordinator' }; next(); },
  requireCoordinator: (req, res, next) => next(),
}));

const request = require('supertest');
const app = require('../../src/app');
const supabase = require('../../src/db/supabase');

describe('GET /api/dashboard/stats', () => {
  it('returns aggregated stats', async () => {
    supabase.from().select.mockResolvedValue({
      data: [
        { stage: 'inscricao' },
        { stage: 'triagem' },
        { stage: 'triagem' },
        { stage: 'ativo' },
      ],
      error: null,
    });
    const res = await request(app)
      .get('/api/dashboard/stats').set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body.totalCandidates).toBe(4);
    expect(res.body.byStage.triagem).toBe(2);
    expect(res.body.byStage.ativo).toBe(1);
    expect(res.body.activeCount).toBe(1);
  });
});
```

- [ ] **Step 2: Correr testes — verificar falha**

```bash
npm test tests/routes/dashboard.test.js
```
Expected: FAIL

- [ ] **Step 3: Implementar dashboard route**

```javascript
// src/routes/dashboard.js
const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { requireAuth, requireCoordinator } = require('../middleware/auth');

router.get('/stats', requireAuth, requireCoordinator, async (req, res) => {
  const { data: candidates, error } = await supabase
    .from('candidates').select('stage');
  if (error) return res.status(500).json({ error: error.message });

  const byStage = candidates.reduce((acc, c) => {
    acc[c.stage] = (acc[c.stage] || 0) + 1;
    return acc;
  }, {});

  res.json({
    totalCandidates: candidates.length,
    byStage,
    activeCount: byStage['ativo'] || 0,
  });
});

module.exports = router;
```

- [ ] **Step 4: Registar em `src/app.js`**

```javascript
const dashboardRouter = require('./routes/dashboard');
// ...
app.use('/api/dashboard', dashboardRouter);
```

- [ ] **Step 5: Correr testes — verificar passagem**

```bash
npm test tests/routes/dashboard.test.js
```
Expected: PASS — 1 test

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/dashboard.js backend/tests/routes/dashboard.test.js backend/src/app.js
git commit -m "feat: add dashboard stats route"
```

---

## Task 14: app.js final + smoke test completo

**Files:**
- Modify: `backend/src/app.js`

- [ ] **Step 1: Escrever app.js final com todas as rotas**

```javascript
// src/app.js
const express = require('express');
const cors = require('cors');

const candidatesRouter    = require('./routes/candidates');
const messagesRouter      = require('./routes/messages');
const onboardingRouter    = require('./routes/onboarding');
const trainersRouter      = require('./routes/trainers');
const stationsRouter      = require('./routes/stations');
const needsRouter         = require('./routes/needs');
const contactRequestsRouter = require('./routes/contactRequests');
const dashboardRouter     = require('./routes/dashboard');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/candidates',                   candidatesRouter);
app.use('/api/candidates/:id/messages',      messagesRouter);
app.use('/api/candidates/:id/onboarding',    onboardingRouter);
app.use('/api/trainers',                     trainersRouter);
app.use('/api/stations',                     stationsRouter);
app.use('/api/needs',                        needsRouter);
app.use('/api/contact-requests',             contactRequestsRouter);
app.use('/api/dashboard',                    dashboardRouter);

module.exports = app;
```

- [ ] **Step 2: Correr todos os testes**

```bash
npm test
```
Expected: PASS — todos os testes de todas as routes e middleware

- [ ] **Step 3: Smoke test manual**

```bash
npm run dev
curl http://localhost:3001/health
```
Expected: `{"status":"ok"}`

- [ ] **Step 4: Commit**

```bash
git add backend/src/app.js
git commit -m "feat: wire all routes — backend complete"
```

---

## Task 15: Monorepo scripts

**Files:**
- Modify: `package.json` (raiz)

- [ ] **Step 1: Actualizar package.json raiz**

```json
{
  "name": "pedal",
  "private": true,
  "scripts": {
    "backend": "cd backend && npm run dev",
    "test:backend": "cd backend && npm test",
    "install:backend": "cd backend && npm install"
  }
}
```

- [ ] **Step 2: Commit final**

```bash
git add package.json
git commit -m "feat: add monorepo scripts"
```
