# Availability Grid + Waiting List Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the period/day chips with a day×period availability grid, implement automatic waiting-list routing when no vaga matches, add a coordinator "Lista de espera" button on validation, and add waiting-list management (Retomar) to the dashboard.

**Architecture:** Option C (hybrid) — availability stored as `{day, period}` tuples for UI richness; matching continues to use derived `periods` array for simplicity. No change to the `needs` table schema.

**Tech Stack:** React JSX (no build step), Node.js/Express backend, Supabase (Postgres).

---

## 1. Data Model

### New column on `candidates`
```sql
alter table candidates add column if not exists availability jsonb default '[]';
```
Shape: `[{"day": "seg", "period": "manha"}, {"day": "ter", "period": "tarde"}]`

### Derived `periods` field
When saving availability, the backend (or frontend before POST/PATCH) extracts unique period IDs:
```js
periods = [...new Set(availability.map(a => a.period))]
```
The existing `PEDAL.needMatch(needs, locality, periods)` function is unchanged.

### Periods redefined (remove `fimsem`)
```js
PEDAL.PERIODS = [
  { id: 'manha', name: 'Manhã' },
  { id: 'tarde', name: 'Tarde' },
  { id: 'flex',  name: 'Flexível' },
]
```
Weekend is represented by selecting Sáb and/or Dom rows in the grid — not a separate period.

### Days (unchanged IDs, just for reference)
`seg, ter, qua, qui, sex, sab, dom`

### `needs` table — no change
Vagas continue as `locality_id + periods[]`. Only display label changes: remove "Fins de semana".

### Funnel — add `espera`
```js
PEDAL.FUNNEL = [
  { id: 'inscricao',  label: 'Inscrição',       match: ['inscricao', 'apresentacao'] },
  { id: 'triagem',    label: 'Triagem',          match: ['triagem'] },
  { id: 'espera',     label: 'Lista de espera',  match: ['espera'] },
  { id: 'entrevista', label: 'Entrevista',        match: ['entrevista'] },
  { id: 'validacao',  label: 'Validação',         match: ['validacao'] },
  { id: 'onboarding', label: 'Onboarding',        match: ['onboarding'] },
]
```

---

## 2. Availability Grid UI

### Component: `AvailabilityGrid`
A reusable component used in two modes:
- **Edit mode** (candidate TriageForm): cells are toggleable
- **Read mode** (coordinator CandidateDetail): cells are display-only

```
         Manhã   Tarde   Flex
  Seg    [ ]     [ ]     [ ]
  Ter    [ ]     [ ]     [ ]
  Qua    [ ]     [ ]     [ ]
  Qui    [ ]     [ ]     [ ]
  Sex    [ ]     [ ]     [ ]
  Sáb    [ ]     [ ]     [ ]
  Dom    [ ]     [ ]     [ ]
```

Active cells are highlighted (same colour as existing active chips).

**Props:**
```js
AvailabilityGrid({ value, onChange, readOnly })
// value: [{day, period}] array
// onChange: (newValue) => void  — only in edit mode
// readOnly: boolean
```

**Validation:** at least one cell selected before candidate can submit TriageForm.

### Changes to `TriageForm` (pedal-cards.jsx)
- Remove existing period chips and day chips
- Replace with `AvailabilityGrid` (edit mode)
- Submission payload:
```js
{
  availability: [{ day: 'seg', period: 'manha' }, ...],
  periods: [...new Set(availability.map(a => a.period))],  // derived
  localities: [...],
  locality: locs[0],
}
```

### Changes to `pedal-data.jsx`
- Remove `fimsem` from `PEDAL.PERIODS`
- Add `PEDAL.DAYS = [{id:'seg',name:'Seg'}, ..., {id:'dom',name:'Dom'}]` (may already exist as `WEEKDAYS`)
- Add `espera` to `PEDAL.FUNNEL`

---

## 3. Waiting List Flow

### 3a. Automatic routing (triage_result node — pedal-chat.jsx)

**No match found:**
1. Stage set to `espera`
2. Candidate sees message:
   > "Neste momento não temos necessidade de pilotos em [localidade] com a tua disponibilidade. Ficaste em lista de espera — assim que surgir uma vaga compatível, a coordenação entra em contacto contigo. 🙏"
3. Interaction → `{ type: 'await_waitinglist' }` (simple "Entendido" button that dismisses to a waiting screen)
4. Coordinator dashboard feed notification: `"[Nome] foi automaticamente para lista de espera — sem vaga em [localidade]"`

**Match found:** unchanged (advances to entrevista).

### 3b. Coordinator button "Lista de espera" (pedal-dashboard.jsx — CandidateDetail)

Added alongside "Validar" and "Rejeitar" when `c.stage === 'validacao'`:
- Sets candidate stage → `espera`
- Coordinator feed notification: `"[Nome] foi colocado(a) em lista de espera pela coordenação"`
- Candidate receives chat message:
  > "A coordenação colocou-te em lista de espera. Assim que houver disponibilidade, serás contactado(a). 🙏"

### 3c. "Lista de espera" section in dashboard + Retomar

New section in the coordinator dashboard showing all candidates with `stage === 'espera'`.

Each row shows: name, locality, availability grid (read-only, compact), date added.

**"Retomar" button:**
- Sets candidate stage → `validacao`
- Coordinator feed notification: `"[Nome] foi retomado(a) da lista de espera — aguarda validação"`
- Candidate receives chat message:
  > "Boa notícia! A coordenação retomou a tua candidatura. Estamos a analisar o teu perfil — aguarda a validação. 🎉"
- Candidate automatically appears in the Validação list for normal validation flow

---

## 4. Dashboard Changes (pedal-dashboard.jsx)

### 4a. Funnel column
`espera` added to `PEDAL.FUNNEL` (Section 1 above) so the funnel board shows a "Lista de espera" column with candidate count.

### 4b. ValidationList section header
Add "Lista de espera" tab or section alongside the existing Validação list. Clicking a candidate in the espera list opens CandidateDetail.

### 4c. CandidateDetail — availability display
Replace period chips with `AvailabilityGrid` in read-only mode. Shows the candidate's full day×period availability to the coordinator.

### 4d. NeedsAdmin
Visual only: remove "Fins de semana" period chip from the needs management UI. No structural change.

---

## 5. Backend Changes

### candidates.js
`POST /` and `PATCH /:id` accept `availability` field. When `availability` is provided, derive `periods` server-side:
```js
if (availability) {
  periods = [...new Set(availability.map(a => a.period))]
}
```

### Migration
```sql
-- 003_add_availability.sql
alter table candidates add column if not exists availability jsonb default '[]';
```

---

## 6. Files Changed

| File | Change |
|---|---|
| `backend/supabase/migrations/003_add_availability.sql` | New — adds `availability` column |
| `backend/src/routes/candidates.js` | Accept + derive `availability` → `periods` |
| `pedal-data.jsx` | Remove `fimsem` from PERIODS; add `espera` to FUNNEL |
| `pedal-cards.jsx` | New `AvailabilityGrid` component; rewrite `TriageForm` |
| `pedal-chat.jsx` | Updated triage_result payload; espera message + interaction |
| `pedal-dashboard.jsx` | 3rd button; espera section + Retomar; grid read-only in CandidateDetail; NeedsAdmin period label |

---

## 7. Out of Scope

- Changing the `needs` table to per-day slots (deferred — Option B)
- Email/SMS notifications (notifications are in-app dashboard feed only)
- Candidate app showing "you are #N in the waiting list"
