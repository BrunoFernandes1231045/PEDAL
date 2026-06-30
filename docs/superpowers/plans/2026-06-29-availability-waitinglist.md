# Availability Grid + Waiting List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the period/day chips with a day×period availability grid, auto-route candidates to waiting list when no vaga matches, add coordinator controls to push to/resume from waiting list.

**Architecture:** Option C hybrid — `availability` JSONB array of `{day, period}` tuples stored per candidate; `periods` array derived from it for `needMatch` matching (unchanged). Six tasks ordered by dependency: DB → data layer → grid component + CSS → chat signals → state sync → dashboard.

**Tech Stack:** React JSX (no build, global script tags), Node.js/Express backend, Supabase Postgres. CSS inline in PEDAL.html.

## Global Constraints

- Never expose `SUPABASE_SERVICE_KEY` in frontend.
- All backend env in `backend/.env.development` (never commit).
- Run backend with `npm run dev` (not `npm start`).
- Frontend served via `npx serve .` on port 3000.
- React hooks aliased per file: `pedal-cards.jsx` → `useState`; `pedal-chat.jsx` → `useStateC / useEffectC / useRefC`; `pedal-dashboard.jsx` → `useStateD`; `pedal-app.jsx` → `useStateA / useEffectA / useRefA`.
- No build step — changes are live on page reload.
- `store.setOverride(id, stage)` for non-live (seed) candidates; `store.up({...}); store.setStage(stage)` for live candidates.

---

### Task 1: Database migration + backend PATCH derives `periods` from `availability`

**Files:**
- Create: `backend/supabase/migrations/003_add_availability.sql`
- Modify: `backend/src/routes/candidates.js` (PATCH route ~line 85)

**Interfaces:**
- Produces: `availability` JSONB column on `candidates`; PATCH `/api/candidates/:id` auto-derives `periods` when `availability` is sent

- [ ] **Step 1: Create migration file**

```sql
-- backend/supabase/migrations/003_add_availability.sql
alter table candidates add column if not exists availability jsonb default '[]';
```

- [ ] **Step 2: Run the migration in Supabase**

Open the Supabase dashboard → SQL Editor, paste and run:
```sql
alter table candidates add column if not exists availability jsonb default '[]';
```
Expected: green "Success" banner. Verify in Table Editor that column `availability` appears on `candidates`.

- [ ] **Step 3: Update the PATCH route to derive `periods` from `availability`**

In `backend/src/routes/candidates.js`, replace the PATCH handler body (lines ~85–97):

```javascript
// PATCH /api/candidates/:id — próprio ou coordinator
router.patch('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  if (req.user.role !== 'coordinator') {
    const { data: own } = await supabase.from('candidates').select('user_id').eq('id', id).single();
    if (!own || own.user_id !== req.user.id) return res.status(403).json({ error: 'Proibido' });
  }
  const body = { ...req.body };
  if (body.availability && Array.isArray(body.availability)) {
    body.periods = [...new Set(body.availability.map((a) => a.period))];
  }
  const { data, error } = await supabase
    .from('candidates')
    .update({ ...body, updated_at: new Date() })
    .eq('id', id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
```

- [ ] **Step 4: Restart backend and verify**

```
cd backend && npm run dev
```

Send a test PATCH (in browser console, after logging in as a test candidate):
```javascript
fetch('http://localhost:3001/api/candidates/YOUR_ID', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer YOUR_JWT' },
  body: JSON.stringify({ availability: [{ day: 'seg', period: 'manha' }, { day: 'ter', period: 'tarde' }] })
}).then(r => r.json()).then(console.log)
```
Expected: response includes `availability: [{day:'seg',period:'manha'},{day:'ter',period:'tarde'}]` and `periods: ['manha','tarde']`.

- [ ] **Step 5: Commit**

```bash
git add backend/supabase/migrations/003_add_availability.sql backend/src/routes/candidates.js
git commit -m "feat: add availability column and derive periods in PATCH"
```

---

### Task 2: Data layer — remove `fimsem`, add `espera` to FUNNEL

**Files:**
- Modify: `pedal-data.jsx` (lines 18–32, 165–174)

**Interfaces:**
- Produces: `PEDAL.PERIODS` without `fimsem`; `PEDAL.FUNNEL` with `espera` column; `PEDAL.SEED_NEEDS` without `fimsem`

- [ ] **Step 1: Remove `fimsem` from PERIODS and update SEED_NEEDS**

In `pedal-data.jsx`, replace lines 18–32:

```javascript
PEDAL.PERIODS = [
  { id: 'manha', name: 'Manhã' },
  { id: 'tarde', name: 'Tarde' },
  { id: 'flex',  name: 'Flexível' },
];

// ── Base de NECESSIDADES (vagas abertas geridas pela coordenação) ────
PEDAL.SEED_NEEDS = [
  { id: 'nd1', locality: 'Matosinhos', periods: ['manha', 'tarde'] },
  { id: 'nd2', locality: 'Maia',       periods: ['manha'] },
  { id: 'nd3', locality: 'Esposende',  periods: ['flex'] },
];
```

- [ ] **Step 2: Add `espera` to FUNNEL**

In `pedal-data.jsx`, replace lines 165–172:

```javascript
PEDAL.FUNNEL = [
  { id: 'inscricao',  label: 'Inscrição',       match: ['inscricao', 'apresentacao'] },
  { id: 'triagem',    label: 'Triagem',          match: ['triagem'] },
  { id: 'espera',     label: 'Lista de espera',  match: ['espera'] },
  { id: 'entrevista', label: 'Entrevista',        match: ['entrevista'] },
  { id: 'validacao',  label: 'Validação',         match: ['validacao'] },
  { id: 'onboarding', label: 'Onboarding',        match: ['onboarding'] },
];
```

- [ ] **Step 3: Verify in browser**

Open `http://localhost:3000/PEDAL.html`, open DevTools console and run:
```javascript
window.PEDAL.PERIODS
// Expected: [{id:'manha',name:'Manhã'},{id:'tarde',name:'Tarde'},{id:'flex',name:'Flexível'}]
window.PEDAL.FUNNEL.map(f => f.id)
// Expected: ['inscricao','triagem','espera','entrevista','validacao','onboarding']
```

Open coordinator dashboard. The funnel board should now show a "Lista de espera" column.

- [ ] **Step 4: Commit**

```bash
git add pedal-data.jsx
git commit -m "feat: remove fimsem period, add espera to funnel"
```

---

### Task 3: `AvailabilityGrid` component + `TriageForm` rewrite + CSS

**Files:**
- Modify: `pedal-cards.jsx` (lines 94–127 — TriageForm; add AvailabilityGrid before it)
- Modify: `PEDAL.html` (CSS section — add grid styles)

**Interfaces:**
- Produces: `AvailabilityGrid({ value, onChange, readOnly })` — reusable grid; updated `TriageForm` that calls `onSubmit({ localities, locality, availability, periods })`
- Consumes: `PEDAL.PERIODS` (3 items, no fimsem); `PEDAL.WEEKDAYS` (7 items)

- [ ] **Step 1: Add CSS for the availability grid to PEDAL.html**

Find the line with `.pedal-pickgrid` in the `<style>` block of `PEDAL.html` (around line 147). Add after the `.pedal-pick.on svg` rule:

```css
/* availability grid */
.pedal-avail-grid{display:grid; gap:2px; margin-top:4px;}
.pedal-avail-header{display:grid; grid-template-columns:40px repeat(3,1fr); gap:2px; margin-bottom:2px;}
.pedal-avail-col-head{font:600 11px var(--ui); color:var(--ink-soft); text-align:center; padding:3px 0;}
.pedal-avail-row{display:grid; grid-template-columns:40px repeat(3,1fr); gap:2px;}
.pedal-avail-day{font:600 12px var(--ui); color:var(--ink-soft); display:flex; align-items:center; padding-left:2px;}
.pedal-avail-cell{height:30px; border-radius:7px; border:1.5px solid var(--line); background:var(--app-bg); cursor:pointer; transition:.12s;}
.pedal-avail-cell.on{border-color:var(--primary); background:var(--primary-soft);}
.pedal-avail-cell.readonly{cursor:default; pointer-events:none;}
.pedal-avail-cell.on.readonly{background:var(--primary-soft); border-color:var(--primary);}
```

- [ ] **Step 2: Add `AvailabilityGrid` component to `pedal-cards.jsx`**

Insert this new component just before the `TriageForm` function (before line 94):

```javascript
// Grelha de disponibilidade dia × período (edit + read-only)
function AvailabilityGrid({ value, onChange, readOnly }) {
  const P = window.PEDAL;
  const isOn = (day, period) => (value || []).some((a) => a.day === day && a.period === period);
  function toggle(day, period) {
    if (readOnly) return;
    const next = isOn(day, period)
      ? (value || []).filter((a) => !(a.day === day && a.period === period))
      : [...(value || []), { day, period }];
    onChange(next);
  }
  return (
    <div className="pedal-avail-grid">
      <div className="pedal-avail-header">
        <div />
        {P.PERIODS.map((p) => (
          <div key={p.id} className="pedal-avail-col-head">{p.name}</div>
        ))}
      </div>
      {P.WEEKDAYS.map((d) => (
        <div key={d.id} className="pedal-avail-row">
          <div className="pedal-avail-day">{d.name}</div>
          {P.PERIODS.map((p) => (
            <button key={p.id} type="button"
              className={'pedal-avail-cell' + (isOn(d.id, p.id) ? ' on' : '') + (readOnly ? ' readonly' : '')}
              onClick={() => toggle(d.id, p.id)} />
          ))}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `TriageForm` to use the grid**

Replace the existing `TriageForm` function (lines 94–127) with:

```javascript
// Triagem: localidade(s) + disponibilidade por dia×período (RF-07)
function TriageForm({ localities, onSubmit }) {
  const [locs, setLocs] = useState(['matosinhos']);
  const [availability, setAvailability] = useState([]);
  const toggleLoc = (id) => setLocs((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const valid = locs.length > 0 && availability.length > 0;
  function handleSubmit() {
    const periods = [...new Set(availability.map((a) => a.period))];
    onSubmit({ localities: locs, locality: locs[0], availability, periods });
  }
  return (
    <div className="pedal-card">
      <Field label="Onde gostarias de pedalar? (podes escolher vários)">
        <div className="pedal-pickgrid">
          {localities.map((l) => (
            <button key={l.id} onClick={() => toggleLoc(l.id)}
              className={'pedal-pick' + (locs.includes(l.id) ? ' on' : '')}>
              {l.name}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Qual é a tua disponibilidade? (seleciona os dias e horários)">
        <AvailabilityGrid value={availability} onChange={setAvailability} />
      </Field>
      <button className="pedal-btn primary" disabled={!valid}
        onClick={handleSubmit}
        style={{ opacity: valid ? 1 : 0.45, width: '100%', marginTop: 8 }}>
        Ver disponibilidade
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Verify in browser**

Open `http://localhost:3000/PEDAL.html`, go through the flow until the triage form. Confirm:
- Period+day chips are gone
- 7×3 grid appears with Seg–Dom rows and Manhã / Tarde / Flexível columns
- Clicking cells toggles them on/off (highlighted)
- "Ver disponibilidade" button is disabled until at least one cell is selected
- Submitting with some cells selected advances to the triage result

- [ ] **Step 5: Commit**

```bash
git add PEDAL.html pedal-cards.jsx
git commit -m "feat: add AvailabilityGrid component and rewrite TriageForm"
```

---

### Task 4: Chat flow — triage payload + waiting list signals

**Files:**
- Modify: `pedal-chat.jsx`
  - Triage handler ~line 466 (update payload + user message)
  - `intro()` `triage_result` case ~line 59 (update no-match message)
  - `interactionFor()` `triage_result` case ~line 114 (remove "Avisem-me" button)
  - `interactionFor()` — add `await_waitinglist` case ~line 131
  - After existing effects — add two new effects for coordinator signals

**Interfaces:**
- Consumes: `S.pushedToWaitingList` flag (set by coordinator); `S.waitingListResumed` flag (set by coordinator)
- Produces: candidate chat messages on waiting list events; `await_waitinglist` interaction node

- [ ] **Step 1: Update triage form handler to pass `availability`**

In `pedal-chat.jsx`, find the triage interaction handler (~line 466). Replace it:

```javascript
if (it.type === 'triage') return <TriageForm localities={P.LOCALITIES} onSubmit={(d) => {
  patchCandidate({ localities: d.localities, locality: d.locality, periods: d.periods, availability: d.availability });
  setStage('triagem');
  const selNames = (d.localities && d.localities.length ? d.localities : [d.locality]).map((id) => locOf(id).name).join(', ');
  const availText = d.availability.map((a) => {
    const dayName = (P.WEEKDAYS.find((x) => x.id === a.day) || {}).name || a.day;
    const perName = (P.PERIODS.find((x) => x.id === a.period) || {}).name || a.period;
    return `${dayName} ${perName.toLowerCase()}`;
  }).join(', ');
  addMessage({ from: 'user', text: `${selNames} · ${availText}` });
  enterNode('triage_result');
}} />;
```

- [ ] **Step 2: Update `intro('triage_result')` no-match message**

In `pedal-chat.jsx`, find the `triage_result` case inside `intro()` (~line 59). Replace the no-match return (the last `return` of the case):

```javascript
return [
  { text: `Neste momento não há vaga compatível em ${names(sel)} com a tua disponibilidade. 🙏` },
  { text: 'Ficaste automaticamente em lista de espera — avisamos-te assim que surgir uma necessidade compatível na tua zona. 💛' },
];
```

- [ ] **Step 3: Update `interactionFor('triage_result')` no-match case**

In `pedal-chat.jsx`, find the `triage_result` case inside `interactionFor()` (~line 114). Replace the no-match return:

```javascript
: { type: 'quick', options: [{ label: 'Escolher outras zonas', go: 'triage' }] };
```

- [ ] **Step 4: Add `await_waitinglist` to `interactionFor()`**

In `pedal-chat.jsx`, in the `interactionFor()` switch, add before the `default` case:

```javascript
case 'await_waitinglist': return { type: 'note', text: '💛 Estás em lista de espera. Avisamos-te assim que houver uma vaga compatível na tua zona.' };
```

- [ ] **Step 5: Add two effects for coordinator signals**

In `pedal-chat.jsx`, after the existing `useEffectC(() => { if (S.stage === 'rejeitado' ...`, add:

```javascript
// coordenação colocou candidato em lista de espera manualmente
useEffectC(() => {
  if (!S.pushedToWaitingList) return;
  store.up({ pushedToWaitingList: false });
  setChat({ node: 'await_waitinglist' });
  say([
    { text: 'A coordenação colocou-te em lista de espera por agora. 🙏' },
    { text: 'Assim que surgir uma vaga compatível na tua zona, entraremos em contacto contigo. 💛' },
  ], () => setInteraction(interactionFor('await_waitinglist')));
  // eslint-disable-next-line
}, [S.pushedToWaitingList]);

// coordenação retomou candidato da lista de espera
useEffectC(() => {
  if (!S.waitingListResumed) return;
  store.up({ waitingListResumed: false });
  setChat({ node: 'await_validation' });
  say([
    { text: '🎉 Boa notícia! A coordenação retomou a tua candidatura.' },
    { text: 'Estamos a analisar o teu perfil — assim que tivermos uma decisão, avisamos-te aqui. 🙏' },
  ], () => setInteraction(interactionFor('await_validation')));
  // eslint-disable-next-line
}, [S.waitingListResumed]);
```

- [ ] **Step 6: Verify in browser**

Test no-match path:
1. Start a new candidacy, fill in the profile form
2. In the triage form, select a locality with **no** vaga (e.g. Porto), select any availability cells
3. Submit — the chat should show the "não há vaga" + "lista de espera" messages
4. The interaction at the bottom should show only "Escolher outras zonas" (no "Avisem-me" button)

Check DevTools Console → Application → localStorage → `pedal_v3` → `stage` should be `espera`.

- [ ] **Step 7: Commit**

```bash
git add pedal-chat.jsx
git commit -m "feat: update triage payload, waiting list messages and coordinator signals"
```

---

### Task 5: State sync — `availability` to backend + coordinator data loader

**Files:**
- Modify: `pedal-app.jsx`
  - Stage sync effect ~lines 208–223 (add availability sync)
  - Coordinator data loader ~line 201 (add `availability` field)

**Interfaces:**
- Consumes: `S.candidate.availability` (set after triage form)
- Produces: `availability` saved to Supabase; coordinator's `realCandidates` array includes `availability`

- [ ] **Step 1: Add availability to the stage sync effect**

In `pedal-app.jsx`, find the `useEffectA` that syncs stage/periods/locality to backend (~lines 208–223). Add after the localities sync block (after line 222, before line 223):

```javascript
    if (S.candidate.availability && S.candidate.availability.length) {
      fetch(base, { method: 'PATCH', headers: hdrs, body: JSON.stringify({ availability: S.candidate.availability }) }).catch(() => {});
    }
```

So the full effect becomes:
```javascript
  useEffectA(() => {
    if (!S.stage || !S.candidateId || !candidateJwt) return;
    const base = `http://localhost:3001/api/candidates/${S.candidateId}`;
    const hdrs = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${candidateJwt}` };
    fetch(base, { method: 'PATCH', headers: hdrs, body: JSON.stringify({ stage: S.stage }) }).catch(() => {});
    if (S.candidate.periods && S.candidate.periods.length) {
      const perData = window.PEDAL && window.PEDAL.PERIODS;
      const periodsText = S.candidate.periods.map((id) => perData ? ((perData.find((p) => p.id === id) || {}).name || id) : id).join(', ');
      fetch(base, { method: 'PATCH', headers: hdrs, body: JSON.stringify({ periods: periodsText }) }).catch(() => {});
    }
    if (S.candidate.localities && S.candidate.localities.length) {
      const locs = window.PEDAL && window.PEDAL.LOCALITIES;
      const names = S.candidate.localities.map((id) => locs ? ((locs.find((l) => l.id === id) || {}).name || id) : id).join(', ');
      fetch(base, { method: 'PATCH', headers: hdrs, body: JSON.stringify({ locality: names }) }).catch(() => {});
    }
    if (S.candidate.availability && S.candidate.availability.length) {
      fetch(base, { method: 'PATCH', headers: hdrs, body: JSON.stringify({ availability: S.candidate.availability }) }).catch(() => {});
    }
  }, [S.stage, candidateJwt]);
```

- [ ] **Step 2: Add `availability` to coordinator real-candidates data loader**

In `pedal-app.jsx`, find the coordinator `.map()` that builds candidate objects from Supabase data (~line 201). Add `availability` to the returned object:

```javascript
return {
  id: c.id, name: c.name, email: c.email, contact: c.phone || '', dob: c.dob || '',
  stage: c.stage || 'inscricao', locality: c.locality || '—', localityId: null,
  initials, days, source: 'PEDAL',
  periods: c.periods ? c.periods.split(', ').filter(Boolean) : [],
  availability: Array.isArray(c.availability) ? c.availability : [],
  weekdays: [],
  contactDate: c.created_at ? c.created_at.slice(0, 10) : '',
};
```

- [ ] **Step 3: Verify in browser**

1. Log in as a test candidate, go through triage (select a locality + cells)
2. Open DevTools → Network tab — confirm a PATCH to `/api/candidates/:id` fires with `availability` in the body
3. Check Supabase Table Editor: candidate row should have `availability` populated
4. Open coordinator dashboard — real candidate's `availability` should now load

- [ ] **Step 4: Commit**

```bash
git add pedal-app.jsx
git commit -m "feat: sync availability to backend and include in coordinator data"
```

---

### Task 6: Coordinator dashboard — 3rd button, Retomar, availability grid

**Files:**
- Modify: `pedal-dashboard.jsx`
  - `NOTIF_META` ~line 5 (add `retomado`)
  - `WaitingList` component ~lines 454–468 (add Retomar button)
  - `CandidateDetail` ~line 1079 (replace period chips with AvailabilityGrid)
  - `CandidateDetail` ~lines 1146–1153 (add "Lista de espera" button)

**Interfaces:**
- Consumes: `AvailabilityGrid` (defined in pedal-cards.jsx, globally available); `store.up`, `store.setStage`, `store.setOverride`, `store.notify`
- Produces: coordinator can push candidate to `espera` from validacao; coordinator can retomar candidate from espera to validacao; availability grid visible in candidate detail

- [ ] **Step 1: Add `retomado` to NOTIF_META**

In `pedal-dashboard.jsx`, add to `NOTIF_META` (after the `rejeitado` entry):

```javascript
retomado: { icon: 'user', tone: 'green', verb: 'Retomado da lista de espera' },
```

- [ ] **Step 2: Add "Lista de espera" button in CandidateDetail for validacao stage**

In `pedal-dashboard.jsx`, find the `{c.stage === 'validacao' && !rejecting && (` block (~line 1146). Replace it:

```javascript
{c.stage === 'validacao' && !rejecting && (
  <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
    <button className="pedal-btn ghost" style={{ flex: 1 }} onClick={() => setRejecting(true)}>Rejeitar</button>
    <button className="pedal-btn ghost" style={{ flex: 1 }}
      onClick={() => {
        if (c.live) { store.up({ pushedToWaitingList: true }); store.setStage('espera'); }
        else { store.setOverride(c.id, 'espera'); }
        store.notify({ type: 'espera', who: c.name, text: 'foi colocado(a) em lista de espera pela coordenação' });
        onClose();
      }}>Lista de espera</button>
    <button className="pedal-btn primary" style={{ flex: 1 }}
      onClick={() => {
        if (c.live) { store.up({ validated: true }); store.setStage('onboarding'); }
        else { store.setOverride(c.id, 'onboarding'); }
        store.notify({ type: 'validado', who: c.name, text: 'foi validado(a) pela coordenação — segue para onboarding' });
        onClose();
      }}>
      Validar candidatura ✓
    </button>
  </div>
)}
```

- [ ] **Step 3: Replace period chips with AvailabilityGrid in CandidateDetail**

In `pedal-dashboard.jsx`, find line 1079:
```javascript
<DetailItem label="Disponibilidade" value={(c.periods && c.periods.length) ? c.periods.map((p) => (P.PERIODS.find((x) => x.id === p) || {}).name).join(', ') : '—'} />
```

Replace with:
```javascript
{(c.availability && c.availability.length) ? (
  <div className="pedal-detailitem" style={{ gridColumn: '1 / -1' }}>
    <div style={{ font: '500 11px var(--ui)', color: 'var(--ink-soft)', marginBottom: 6 }}>Disponibilidade</div>
    <AvailabilityGrid value={c.availability} readOnly />
  </div>
) : (
  <DetailItem label="Disponibilidade" value={(c.periods && c.periods.length) ? c.periods.map((p) => (P.PERIODS.find((x) => x.id === p) || {}).name).join(', ') : '—'} />
)}
```

- [ ] **Step 4: Add "Retomar" button to WaitingList rows**

In `pedal-dashboard.jsx`, find the `WaitingList` row render (~lines 454–467). Replace the entire `list.map(...)` block:

```javascript
{list.map((c) => {
  const weekdays = (c.weekdays || []).map((d) => (P.WEEKDAYS.find((x) => x.id === d) || {}).name).join(' ');
  const perLabel = (c.periods || []).map((p) => (P.PERIODS.find((x) => x.id === p) || {}).name).join(', ') || '—';
  return (
    <div key={c.id} className="pedal-listrow" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'default' }}>
      <button style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', minWidth: 0 }} onClick={() => setSel(c)}>
        <div className="pedal-kav">{c.initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: '700 13.5px var(--ui)', color: 'var(--ink)' }}>{c.name}</div>
          <div style={{ font: '500 11.5px var(--ui)', color: 'var(--ink-soft)' }}>{c.locality} · {perLabel}</div>
        </div>
        <div style={{ textAlign: 'right', marginRight: 4 }}>
          <div style={{ font: '600 11.5px var(--ui)', color: 'var(--accent-deep)' }}>{c.days} dias</div>
          {weekdays && <div style={{ font: '500 11px var(--ui)', color: 'var(--ink-soft)' }}>{weekdays}</div>}
        </div>
      </button>
      <button className="pedal-taskbtn" onClick={() => {
        if (c.live) { store.up({ waitingListResumed: true }); store.setStage('validacao'); }
        else { store.setOverride(c.id, 'validacao'); }
        store.notify({ type: 'retomado', who: c.name, text: 'foi retomado(a) da lista de espera — aguarda validação' });
      }}>Retomar</button>
    </div>
  );
})}
```

- [ ] **Step 5: Verify in browser — full flow**

**Test A — Coordinator pushes to waiting list:**
1. Open coordinator dashboard, find a candidate in Validação
2. Click to open their detail — confirm 3 buttons: "Rejeitar", "Lista de espera", "Validar candidatura ✓"
3. Click "Lista de espera" — candidate should move to waiting list
4. Notification should appear in coordinator feed

**Test B — Retomar:**
1. In coordinator dashboard → Lista de espera section
2. Each row should show a "Retomar" button on the right
3. Click "Retomar" on a candidate — they should disappear from waiting list and appear in Validação
4. Notification appears in feed: "foi retomado(a) da lista de espera — aguarda validação"

**Test C — Availability grid in detail:**
1. Open any candidate with `availability` data
2. Detail modal should show the day×period grid (read-only) instead of period chips

**Test D — Live candidate (open two tabs):**
1. Tab 1: PEDAL.html — go through triage with no-match locality → arrives at waiting list message
2. Tab 2: coordenacao.html → find candidate in Lista de espera → click Retomar
3. Tab 1 should auto-update showing: "🎉 Boa notícia! A coordenação retomou a tua candidatura."

- [ ] **Step 6: Commit**

```bash
git add pedal-dashboard.jsx
git commit -m "feat: coordinator waiting list button, retomar, availability grid in detail"
```

---

## Self-Review

**Spec coverage:**
- ✅ Auto waiting list when no match (Task 4 — `intro` + `interactionFor` + existing `onEnter`)
- ✅ Candidate message on auto-waitlist (Task 4 — updated intro messages)
- ✅ Coordinator notification on auto-waitlist (existing `onEnter` already calls `notify`)
- ✅ Coordinator "Lista de espera" button (Task 6)
- ✅ Candidate message when coordinator pushes to waitlist (Task 4 — `pushedToWaitingList` effect)
- ✅ Retomar button in waiting list (Task 6)
- ✅ Retomar sends back to validacao (Task 6)
- ✅ Candidate message on retomar (Task 4 — `waitingListResumed` effect)
- ✅ New availability grid UI (Task 3)
- ✅ `fimsem` removed from PERIODS (Task 2)
- ✅ `espera` in FUNNEL (Task 2)
- ✅ Grid in coordinator detail read-only (Task 6)
- ✅ `availability` synced to backend (Task 5)
- ✅ DB column (Task 1)

**No placeholders found.**

**Type consistency:** `availability` is `{day: string, period: string}[]` throughout. `periods` is `string[]` (IDs) throughout. `store.up({pushedToWaitingList: true/false})` and `store.up({waitingListResumed: true/false})` are boolean flags consistent across Tasks 4 and 6.
