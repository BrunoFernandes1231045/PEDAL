# PEDAL — Project Knowledge Document

**Project:** PEDAL — Agente Digital de captação de pilotos voluntários
**Organisation context:** Pedalar Sem Idade (Porto) — *Cycling Without Age*
**Main file:** `PEDAL.html` (React + Babel, split into multiple `.jsx` modules)
**Status at time of writing:** Phases 1 & 2 complete; Phase 3 in active development.

---

## Project instructions

> **Note:** This project has no separately-configured instruction file (no `CLAUDE.md` exists in the project). The text below is the **Phase 3 brief authored and pasted by the project owner**, reproduced verbatim as the governing instruction set for the current work. It is the only project-level instruction artifact.

```
Projeto: PEDAL — app de captação de pilotos voluntários (Pedalar Sem Idade Porto). Ficheiro principal: PEDAL.html (React + Babel, dividido em pedal-app.jsx, pedal-chat.jsx, pedal-dashboard.jsx, pedal-cards.jsx, pedal-data.jsx, pedal-ui.jsx). Já fiz as Fases 1 e 2. Avança com a Fase 3:

Login do voluntário — ao entrar no agente, quem já tem conta faz login. Após a fase de inscrição, são "enviadas" credenciais para o email do voluntário; ele passa a poder fazer login com esses dados.

Perfil do voluntário — a partir do momento em que tem inscrição ativa, acede ao seu perfil: ver/editar dados pessoais, mudar a password, apagar a conta.

Formalização → Ativo — após a formação prática concluída com sucesso, o piloto recebe uma notificação na área PEDAL para aceitar os termos e fazer uma assinatura/rubrica com o dedo (canvas touch). Ao confirmar, passa ao estado Ativo.

Agente em modo Ativo — quando o piloto está Ativo, mantém acesso ao agente PEDAL, mas apenas para questões práticas (instituição, bicicletas, dúvidas operacionais) — não para o funil de candidatura.

Q&A durante os vídeos de formação — no período de formação com vídeos, o voluntário pode colocar questões ao agente relacionadas com o vídeo/formação.

Aviso empático + remarcação — antes de aceitar uma das 3 datas de formação prática, o voluntário é informado, de forma simpática e empática, que aceitar e não comparecer tem impacto (tempo/dinheiro) na instituição. Pode pedir nova data (gera novo pedido de agendamento na coordenação). Depois de aceitar, também pode dizer que precisa de remarcar → novo pedido para a coordenação.

Confirmar fim da formação prática (coordenação) — lista de voluntários em formação prática onde o coordenador confirma a conclusão ou rejeita o piloto, com caixa de comentários sobre a decisão.

Upload de vídeos por fase (coordenação) — o coordenador faz upload de vídeos de instrução para cada fase de formação e pode alimentar o agente com informação sobre cada fase.

Lê os ficheiros .jsx primeiro para perceber o store (pedal-app.jsx), os nós da conversa (pedal-chat.jsx) e os estados do funil (pedal-data.jsx) antes de construir.

Sugiro fazê-la também por partes (ex.: login+perfil primeiro, depois formalização+assinatura, depois vídeos+Q&A) para manter tudo estável.
```

### Derived working principles (from the brief)

- **Build incrementally** in stable slices: *login + perfil* → *formalização + assinatura* → *vídeos + Q&A* → *coordenação*.
- **Read before writing:** always understand the store (`pedal-app.jsx`), conversation nodes (`pedal-chat.jsx`) and funnel states (`pedal-data.jsx`) before extending.
- **Tone:** empathetic, warm, human, European-Portuguese (informal *tu*), emoji used sparingly and only where the existing voice already uses them.
- **Two audiences in one product:** the volunteer-facing phone agent and the coordination-facing dashboard.

---

## Knowledge files

The "knowledge files" in this project are the source modules themselves. Each is summarised below with its purpose and a ~100-word digest.

### `PEDAL.html`
**Purpose:** Application shell and single entry point.
**Digest:** Declares the document, loads Google Fonts (*Bricolage Grotesque* for display, *Hanken Grotesk* for UI), and holds the entire CSS design system inside one `<style>` block as CSS custom properties (warm paper palette: `--bg #ECE4D6`, `--surface #FFFFFF`, `--ink #2A2620`, green `--primary #2E7D52`, amber `--accent #D98A3D`). It defines every component class (chat bubbles, cards, tab bar, dashboard panels, kanban, modals, auth/profile/signature/Q&A styles) and a `#root` mount. It loads React 18.3.1, ReactDOM and Babel (pinned + integrity-hashed), then the `.jsx` modules in dependency order, ending with `pedal-app.jsx`.

### `pedal-app.jsx`
**Purpose:** Shell, shared store, persistence, navigation and Tweaks.
**Digest:** Owns the single source of truth. Defines `INITIAL` state (stage, candidate, messages, onboarding, notifs, scheduling, overrides, trainers, contactRequests, and the Phase 3 additions: `account`, `session`, `signature`, `termsAccepted`, `moduleContent`). Persists to `localStorage` under `STORE_KEY = 'pedal_v3'`. Exposes store helpers (`addMessage`, `patchCandidate`, `setStage`, `notify`, `setOnboarding`, `setChat`, `goTab`, `reset`, scheduling/override/trainer/contact helpers, plus Phase 3 `createAccount`, `setSession`, `changePassword`, `setModuleContent`). Renders the top bar with a candidate/coordination segmented switch, the scaled iOS phone frame with tab bar (Conversa / Formação / Processo / Perfil), and gates the candidate app behind `AuthGate`.

### `pedal-data.jsx`
**Purpose:** Agnostic content layer — knowledge base, script, onboarding modules, funnel states.
**Digest:** Holds all editable content separate from logic. Defines localities, training modules (`MODULES`), funnel stages and `stageLabel`/`fmtDate` helpers, seed trainers, seed contact requests, and the FAQ knowledge base with `matchFAQ`. Phase 3 additions: `FORMALIZATION` (intro, five commitment terms, closing), `TRAINING_FAQ` (Q&A during training videos), `ACTIVE_FAQ` + `ACTIVE_CHIPS` (operational questions for active pilots — passeios, bicicletas, segurança, passageiros), a generic keyword matcher `matchIn(list, text)` with accent-insensitive scoring, and `genPassword()` which produces readable `PSI-XXX###` credentials "emailed" after enrolment.

### `pedal-chat.jsx`
**Purpose:** Conversational engine — the funnel state machine.
**Digest:** Drives the volunteer dialogue as a node machine (`welcome`, `consent`, `form_profile`, `triage`, interview steps, `schedule`, `practical_booked`, plus Phase 3 `await_reschedule`, `formalize`, `active_home`, `rejected`). Renders messages, typing indicator, quick replies, chips and inline cards. Phase 3 work: on enrolment it creates the account and shows a **credentials card**; the `SchedulePicker` now inserts an **empathetic no-show warning** before confirming a date and offers "pedir outras datas"; `requestReschedule` files a new coordination request; `FormalizationCard` confirmation flips the pilot to **Ativo**; active pilots get operational-only FAQ via `matchIn(ACTIVE_FAQ, …)`.

### `pedal-cards.jsx`
**Purpose:** Interactive cards presented inside the chat.
**Digest:** Self-contained card components rendered within agent messages — the project presentation card (`ProjectCard`), consent, role acceptance, profile form, handoff-to-human, and related inline UI. Cards use the shared `.pedal-card` styling with the `cardIn` entry animation and call back into the store/chat engine to advance the funnel. Phase 3 introduces the credentials card (rendered in the chat stream) and connects the formalization card from `pedal-formalize.jsx`.

### `pedal-onboarding.jsx`
**Purpose:** "Formação" tab (guided tutorial) and "Processo" tab (status + history).
**Digest:** Renders the training module list with progress, a per-module detail view (placeholder video with play affordance, description, mark-as-complete / review), and the volunteer's process timeline + history. Phase 3 adds `ModuleQA` — a per-module mini-chat where volunteers ask questions about the training video; it answers via `matchIn(TRAINING_FAQ, …)`, falls back to any coordinator-supplied `agentInfo` for that phase, and otherwise notes the question for the practical-session captain. Module detail now surfaces uploaded video filenames from `moduleContent`. Exports `FormacaoView`, `ProcessoView`, `TabHeader`, `ModuleQA`.

### `pedal-dashboard.jsx`
**Purpose:** Coordination panel.
**Digest:** The staff-facing console. Section navigation: Funil, Lista de espera, Formação prática (Agendamentos), Pilotos ativos, Vídeos & conteúdos, Pedidos de contacto, Gestão. Shows metrics, a five-column funnel, candidate detail modals, scheduling modal (slot proposal + trainer assignment), notification feed and CSV-style export. Phase 3: the Formação prática section lists scheduled pilots with a **"Concluir"** action opening `PracticalCompleteModal` (confirm completion → `formalizacao`, or reject → `rejeitado`, each with a decision comment); a strip surfaces pilots awaiting formalization; the new "Vídeos & conteúdos" section mounts `ModuleContentAdmin`. Added `ativo` to the notification metadata.

### `pedal-ui.jsx`
**Purpose:** Shared visual primitives.
**Digest:** Reusable building blocks used across both audiences: the `Icon` set (simple geometry only — chat, book, route, user, lock, shield, check, clock, arrow, phone, people, play, sparkle, heart, doc, send), plus `Avatar`, `Pill`, `Field`, `Placeholder` and similar atoms. Keeps presentation consistent and centralises the iconography so feature modules never hand-roll SVG. Consumed by every other module.

### `pedal-auth.jsx` *(Phase 3)*
**Purpose:** Volunteer login (`AuthGate`) and profile area (`ProfileView`).
**Digest:** `AuthGate` is the agent's front door: a segmented "Já tenho conta / Sou novo(a)" switch. Login validates email + password against the stored `account`, with a demo-credentials hint and autofill. New users start a candidature (no commitment). `ProfileView` (a fourth tab, visible once an account exists) shows the pilot's identity and stage, lets them view/edit personal data, change password (with confirmation), end the session, and delete the account (RGPD-framed confirmation that resets the store). Exports `AuthGate`, `ProfileView`.

### `pedal-formalize.jsx` *(Phase 3)*
**Purpose:** Formalization — terms + finger signature → active pilot.
**Digest:** `SignaturePad` is a touch/mouse canvas (high-DPI aware, preserves the stroke on resize, with clear control and a "sign with finger or mouse" hint). `FormalizationCard` presents the five commitment terms from `FORMALIZATION`, an "I accept" checkbox and the signature pad; the confirm button is enabled only when both are satisfied and returns the signature dataURL. On confirm, the chat engine stores the signature, marks terms accepted, fires the `ativo` notification, and transitions the pilot to **Ativo**. Exports `SignaturePad`, `FormalizationCard`.

### `pedal-coord-formacao.jsx` *(Phase 3)*
**Purpose:** Coordination — confirm/reject practical completion + per-phase video & agent content.
**Digest:** `PracticalCompleteModal` lets a coordinator review a scheduled pilot (session, captain) and either **confirm completion** (→ `formalizacao`, prompting the pilot to sign) or **reject** (→ `rejeitado`), always with a decision-comment box; both fire notifications and work for live or seed candidates. `ModuleContentAdmin` + `ModuleContentRow` let coordinators upload a video per training phase and write "informação para o agente" (`agentInfo`) that feeds the in-training Q&A, persisting via `setModuleContent`. Exports `PracticalCompleteModal`, `ModuleContentAdmin`.

### `ios-frame.jsx`
**Purpose:** Device frame.
**Digest:** A simplified iOS 26 ("Liquid Glass") device bezel with status bar, used to present the volunteer app as a real phone screen. The candidate view is rendered inside it and scaled to fit the viewport. Pure presentation; no app logic.

### `tweaks-panel.jsx`
**Purpose:** In-design tweak controls.
**Digest:** The Tweaks panel scaffold wiring the host protocol, persistence and ready-made controls. In PEDAL it backs the toolbar's Tweaks toggle (e.g. tone/theme adjustments surfaced through `pedal-app.jsx`).

### `assets/logo-psi.png`
**Purpose:** Pedalar Sem Idade brand mark shown in the top bar.

---

## Decisions and patterns

### Architecture
- **Single shared store** lives in `pedal-app.jsx`; every module receives `store` and reads `store.S`. No component owns durable state independently.
- **Persistence** is `localStorage` under a versioned key. Phase 3 bumped it from `pedal_v1` → **`pedal_v3`** because the state shape changed (added `account`, `session`, `signature`, `termsAccepted`, `moduleContent`). The loader merges persisted state over `INITIAL` field-by-field so older blobs hydrate safely.
- **Content vs. logic separation:** all copy, FAQ, modules, terms and funnel labels live in `pedal-data.jsx`; engines and views stay content-agnostic.
- **Module loading order matters** (Babel scripts don't share scope): components are exported to `window` via `Object.assign(window, {…})` at the end of each file, and `PEDAL.html` loads providers before consumers — `pedal-formalize.jsx` and `pedal-auth.jsx` load **before** `pedal-chat.jsx`; `pedal-coord-formacao.jsx` loads **before** `pedal-dashboard.jsx`; `pedal-app.jsx` loads last.
- **Scope-collision discipline:** each module destructures hooks under unique aliases (`useStateA`, `useStateC`, `useStateD`, `useStateO`, `useStateF`, `useStateAu`, `useStateCF`) to avoid global clashes across Babel scripts.

### Funnel / state model
- Stages flow: enrolment → triage → interview → **lista de espera / validação** → **formação (vídeos)** → **formação prática (agendamento)** → **formalização** → **ativo** (with **rejeitado** as a terminal branch).
- **Key Phase 3 change:** accepting a practical date no longer jumps straight to `formalizacao`. The pilot stays in **`pratica`**; only the coordinator confirming completion (in `PracticalCompleteModal`) moves them to `formalizacao`, and only the pilot's signature moves them to `ativo`. This keeps the human-in-the-loop gate authentic.
- A stage-watcher effect in `pedal-chat.jsx` reconciles chat node ↔ stage: `rejeitado`→`rejected`, `formalizacao`→`formalize`, `ativo`→`active_home`.

### Conversation engine patterns
- Dialogue is a **node machine**; each node provides intro lines (`say([...])`) and an interaction descriptor (`interactionFor(node)`): `quick`, `faq`, `activefaq`, `schedule`, `note`, `card:*`, form types.
- The text input is **blocked** while a structured interaction is active (consent, role, handoff, profile form, triage, interview text, schedule, formalize).
- **Active-pilot mode** reuses the same chat surface but routes free-text through `ACTIVE_FAQ` (operational only) instead of the candidacy funnel; unmatched questions hand off to the human team.
- **Empathetic-warning pattern:** before a date is confirmed, a dedicated warning step explains the cost of a no-show (captain + triciclo + institution time) and offers "pedir outras datas"; after acceptance, "Preciso de remarcar" files a fresh coordination request via `requestReschedule`.
- **Keyword matching** is centralised in `matchIn(list, text)` — accent-insensitive (`NFD` normalize), scored by matched-keyword length, returns best match or null.

### Coordination patterns
- Coordinator decisions are always explicit and **comment-logged**; completion confirmation tells the coordinator the pilot must still sign before becoming active.
- Decisions work uniformly for **live** (the interactive demo candidate) and **seed** candidates via `setStage` vs. `setOverride`.
- Per-phase **video upload** stores the filename (demo) and an **`agentInfo`** free-text field that directly feeds the in-training Q&A answers.

### Auth / profile / account patterns
- Credentials are **generated on enrolment** (`genPassword()` → `PSI-XXX###`), surfaced both as an in-chat credentials card and as a demo hint in `AuthGate` (since there's no real email).
- The **Perfil tab only appears once an account exists** (`hasAccount` gate in `pedal-app.jsx`).
- Account deletion is **RGPD-framed** and performs a full store reset.

### Signature pattern
- The signature canvas is **high-DPI aware**, supports both touch and mouse, preserves its stroke across resize by re-drawing from a snapshot, and returns a PNG dataURL stored in `signature`. Confirm is gated on *both* terms-accepted and a non-empty signature.

### Design-system conventions
- **Palette:** warm paper neutrals; green `--primary` for progress/positive, amber `--accent` for caution/attention; greens and ambers each have soft + deep variants. No new colours invented outside these tokens.
- **Type:** Bricolage Grotesque (display) + Hanken Grotesk (UI), set through `--display` / `--ui`.
- **Icons:** simple geometry only, centralised in `pedal-ui.jsx`; never hand-rolled per feature. Imagery uses striped placeholders, not drawn SVG.
- **Layout:** flex/grid with `gap`; explicit class-based components reused across both audiences.
- New Phase 3 styles were appended to the single `<style>` block grouped under clearly-commented "Fase 3" sections (auth, perfil, assinatura, aviso empático, conteúdos, Q&A).

### Resolved (Phase 3 close-out)
- **Formalization card stuck at `opacity:0`** — root cause was two-fold: (1) on reload of any pilot already past onboarding, the `allDone` effect in `pedal-chat.jsx` re-fired `enterNode('onboarding_done')`, whose `onEnter` ran `setStage('pratica')` and clobbered the stage-watcher's `enterNode('formalize')` (invalidating the `genRef` message queue so the card's `setInteraction` never ran); and (2) even once the card mounted, its `cardIn` entry animation froze at frame 0 (`opacity:0`, `translateY(8px)`, play-state "running" yet clock never advancing) when mounted during the post-reload effect/typing burst. **Fixes:** the `allDone` effect now only advances when `S.stage === 'onboarding'` (guarded, deps `[allDone, S.stage]`); and `FormalizationCard` renders with inline `animation:none; opacity:1; transform:none` so the commitment terms are always visible regardless of the entry-animation glitch. Verified end-to-end: terms → checkbox → finger/mouse signature → confirm → `ativo`, with the agent switching to operational-only mode.

---

## Reusable prompts

These are the refined, reusable instruction patterns established in this project.

### 1. Phase kickoff prompt (the master pattern)
Used to open a new phase of work. Captures context, lists discrete requirements, and mandates a read-first, build-in-slices approach.

```
Projeto: PEDAL — app de captação de pilotos voluntários (Pedalar Sem Idade Porto).
Ficheiro principal: PEDAL.html (React + Babel, dividido em pedal-app.jsx, pedal-chat.jsx,
pedal-dashboard.jsx, pedal-cards.jsx, pedal-data.jsx, pedal-ui.jsx). Já fiz as Fases [N-1].
Avança com a Fase [N]:

[Requisito 1 — título — descrição do comportamento esperado]
[Requisito 2 — …]
…

Lê os ficheiros .jsx primeiro para perceber o store (pedal-app.jsx), os nós da conversa
(pedal-chat.jsx) e os estados do funil (pedal-data.jsx) antes de construir.

Sugiro fazê-la também por partes (ex.: [fatia 1], depois [fatia 2], depois [fatia 3])
para manter tudo estável.
```

### 2. Read-before-build directive
```
Lê os ficheiros .jsx primeiro para perceber o store (pedal-app.jsx), os nós da conversa
(pedal-chat.jsx) e os estados do funil (pedal-data.jsx) antes de construir.
```

### 3. Incremental-slices directive
```
Faz por partes para manter tudo estável: [slice A] primeiro, depois [slice B],
depois [slice C]. Verifica cada fatia antes de avançar.
```

### 4. Empathetic-tone directive (volunteer-facing copy)
```
Mensagens ao voluntário em português europeu informal (tu), tom caloroso e empático,
emoji só onde a voz existente já usa. Antes de pedir compromissos (ex.: aceitar uma data),
explica de forma simpática o impacto de não comparecer (tempo/dinheiro da instituição).
```

### Coordination-decision directive (staff-facing)
```
Decisões da coordenação são sempre explícitas e registadas com comentário.
Confirmar conclusão → pilot passa a formalização (tem de assinar para ficar ativo);
rejeitar → estado rejeitado. Funciona tanto para o candidato "em direto" como para os seed.
```

---

## Phase 4 (current) — close-out

### Agent (candidate)
- **Entrada direta no chat** — removido o AuthGate de bloqueio; a 4.ª tab é "Entrar" (login → ver perfil) ou "Perfil" quando autenticado. A inscrição cria conta **e** inicia sessão automaticamente. `LoginPanel` em pedal-auth.jsx.
- **Triagem multi-local** — `TriageForm` permite escolher vários locais; `triage_result` avança se *algum* tiver vaga e põe os restantes em lista de espera (`candidate.localities[]`, retro-compat com `locality`).
- **Resumo da entrevista** — visível na tab Processo (pedal-onboarding.jsx) e no `CandidateDetail` da coordenação, sempre com **pergunta + resposta** (usa `P.INTERVIEW`).
- **Local de encontro** — o agendamento da formação prática inclui o local/parqueamento; mostrado ao candidato no `SchedulePicker` e no resumo do processo.
- **Responsivo** — funciona em browser de telemóvel e PC.

### Coordination (3 ecrãs via top-nav: Operação / Dashboards / Gestão)
- **Topo** — chip de perfil do utilizador (`CoordProfileMenu`: editar email/telefone, mudar password, terminar sessão) + navegação entre os 3 ecrãs.
- **Operação** — funil a toda a largura; **Central de tarefas** única (2/3: validar, agendar, concluir, contactos) + **Notificações** (1/3); sub-secções com listas/filtros e exportação CSV por secção.
- **Gestão** (menu lateral) — Utilizadores de gestão, Pilotos formadores (clicável → caixa de detalhe), **Vídeos & conteúdos** (URLs de vídeo + documentos + base de conhecimento por fase, **sem upload**), **Locais de encontro**, **Exportar base de dados** completa.
- **Dashboards** — pilotos por estado/localidade, taxa de conversão, tempo médio, formação vs. formadores, conversas & tópicos. `store`: `stations`, `mgmtUsers`, `coordProfile` em pedal-app.jsx.

### Resolved bug — `cardIn` freeze (global)
A animação de entrada `.pedal-card` congelava no frame inicial (`opacity:0`) quando o cartão era montado durante a rajada do mount (reload já num nó com cartão: triagem, formalização, etc.), deixando-o invisível. **Fix:** a keyframe `cardIn` passou a animar **apenas `translateY`** (sem opacity) — mesmo congelada, o cartão fica sempre visível. Também: o glitch de composição do tab ativo (botão errado a verde) vinha de `transition:.15s` (shorthand `all`) a interpolar `background:var(--primary)`; corrigido transicionando só `color`/`border-color` nos controlos de navegação (topnav, gestaonav, seg, coordtab).

---

## Phase 5 — needs database, NIF timing, 2h commitment

### Needs database (management-driven eligibility)
- `S.needs[]` (seeded `PEDAL.SEED_NEEDS`) — each entry = `{ id, locality, periods[] }` (open availabilities). Managed in **Gestão → Necessidades / vagas** (`NeedsAdmin`): open a locality (pick from list or add new) and toggle which availabilities are open. No availability selected = open to any.
- `PEDAL.needMatch(needs, localityName, candidatePeriods)` — eligibility helper. `'flex'` is a candidate-only wildcard (not a concrete opening); a candidate with `flex` or no preference matches any open locality; otherwise availability must intersect. Replaces the old hardcoded `LOCALITIES[].need` flag (now unused).
- Triage (`pedal-chat.jsx` `triage_result` intro/interaction/onEnter) checks `needMatch` per selected locality. Open → entrevista; no match → lista de espera (per zone). Store helpers: `addNeed/updateNeed/removeNeed` in pedal-app.jsx.

### NIF moved to formalization
- Removed the `nif` question from `PEDAL.INTERVIEW` (now 4 questions; intro text counts dynamically).
- `FormalizationCard` collects NIF (9-digit validation) alongside terms + signature; confirm is gated on all three. `onConfirm(sig, nif)` → `patchCandidate({ nif })`. Shown in `CandidateDetail` as "NIF (seguro)" when present.

### 2h/week commitment messaging
- Stated up front in `present` intro and FAQ `disponibilidade`/`obj_tempo`, reaffirmed after validation and in `ROLE_PROFILE.commitments`. Framed honestly so candidates can self-select (the 2h is often the limiting factor).

---

## Phase 6 — Cycling Without Age brand look
Applied the official **Cycling Without Age** brand book (parent movement of Pedalar Sem Idade) in `PEDAL.html` `:root`:
- **Red `#ED1C24`** = action/energy/passion → `--primary` (buttons, active tabs, user bubbles, brand mark, count badges, funnel-by-state bars).
- **Mint green `#92D2C6`** = caretaking → `--accent` (positive/"care" tones, avatars, system messages, locality bars). `--accent-deep #1F7E6D` for legible text/white-on-fill.
- Black text (`--ink #161616`), white surfaces, clean light-mint canvas. A separate muted **amber** (`--warn`) carries the "pending" tone so positive(mint) ≠ action(red) ≠ pending(amber) stay distinct (decoupled from primary/accent — was previously tied to them).
- Type → **Helvetica Neue/Arial** stack (brand's mandated online typeface); dropped the Google Fonts (Bricolage/Hanken). Slogan **"Direito a vento no cabelo"** added as a tagline under the PEDAL wordmark. Tweak palette defaults updated (red / mint / mono).

*End of document.*
