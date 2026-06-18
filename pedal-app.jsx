/* pedal-app.jsx — shell, store partilhado, persistência, navegação e Tweaks */

const { useState: useStateA, useEffect: useEffectA } = React;

const STORE_KEY = 'pedal_v3';
const INITIAL = {
  stage: null,
  candidate: { name: '', contact: '', email: '', dob: '', locality: '', localities: [], periods: [], interview: {} },
  messages: [],
  onboarding: { done: {}, roleAccepted: false },
  notifs: [],
  validated: false,
  rejection: null,
  chat: { node: 'welcome', interviewStep: 0 },
  tab: 'conversa',
  scheduling: {},   // { [candidateId]: { slots, chosen, trainerId } }
  overrides: {},    // { [candidateId]: stage } — decisões da coordenação sobre candidatos seed
  trainers: (window.PEDAL && window.PEDAL.SEED_TRAINERS || []).map((t) => ({ ...t })),
  contactRequests: (window.PEDAL && window.PEDAL.SEED_CONTACTS || []).map((c) => ({ ...c })),
  candidateId: null,        // ID do candidato no backend (Supabase)
  account: null,            // { email, password, createdAt } — criada após a inscrição
  session: { authed: false },// sessão ativa no agente (login)
  signature: null,          // dataURL da rubrica do piloto (formalização)
  termsAccepted: false,     // termos de compromisso aceites
  moduleContent: {},        // { [moduleId]: { videos:[], docs:[], agentInfo } } — conteúdos por fase
  stations: (window.PEDAL && window.PEDAL.SEED_STATIONS || []).map((s) => ({ ...s })),  // locais de encontro
  needs: (window.PEDAL && window.PEDAL.SEED_NEEDS || []).map((n) => ({ ...n })),         // necessidades/vagas abertas
  mgmtUsers: (window.PEDAL && window.PEDAL.SEED_MGMT_USERS || []).map((u) => ({ ...u })), // utilizadores de gestão
  coordProfile: { name: 'Maria Coelho', email: 'maria.coelho@pedalarsemidade.pt', phone: '936 100 200', role: 'Coordenação' },
  moduleConversations: {},   // { [moduleId]: [{ from, text, coord?, coordAuthor?, ts }] }
};

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { ...INITIAL };
    const p = JSON.parse(raw);
    return { ...INITIAL, ...p, candidate: { ...INITIAL.candidate, ...(p.candidate || {}) }, onboarding: { ...INITIAL.onboarding, ...(p.onboarding || {}) }, chat: { ...INITIAL.chat, ...(p.chat || {}) }, scheduling: { ...(p.scheduling || {}) }, overrides: { ...(p.overrides || {}) }, trainers: p.trainers || INITIAL.trainers, contactRequests: p.contactRequests || INITIAL.contactRequests, session: { ...INITIAL.session, ...(p.session || {}) }, moduleContent: { ...(p.moduleContent || {}) }, stations: p.stations || INITIAL.stations, mgmtUsers: p.mgmtUsers || INITIAL.mgmtUsers, needs: p.needs || INITIAL.needs, coordProfile: { ...INITIAL.coordProfile, ...(p.coordProfile || {}) }, moduleConversations: { ...(p.moduleConversations || {}) } };
  } catch (e) { return { ...INITIAL }; }
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": ["#ED1C24", "#FDE7E8", "#C4151C"],
  "textSize": "Normal",
  "tone": "Caloroso"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [S, setS] = useStateA(loadStore);
  const [view, setView] = useStateA('candidate');
  const [resetKey, setResetKey] = useStateA(0);
  const [scale, setScale] = useStateA(1);
  const [coordJwt, setCoordJwtRaw] = useStateA(null); // não persiste no localStorage
  const [realCandidates, setRealCandidates] = useStateA(null);

  useEffectA(() => { localStorage.setItem(STORE_KEY, JSON.stringify(S)); }, [S]);

  // Quando o candidato se regista, cria-o também no backend (não-bloqueante)
  useEffectA(() => {
    if (S.account && !S.candidateId && S.candidate.name && S.candidate.email) {
      fetch('http://localhost:3001/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: S.candidate.name, email: S.candidate.email, dob: S.candidate.dob || null, phone: S.candidate.contact || null }),
      })
        .then((r) => r.json())
        .then((data) => { if (data.id) setS((p) => ({ ...p, candidateId: data.id })); })
        .catch(() => {});
    }
  }, [S.account]);

  useEffectA(() => {
    if (view !== 'candidate') { setScale(1); return; }
    const fit = () => {
      const s = Math.min(1, (window.innerHeight - 92) / 860, (window.innerWidth - 28) / 402);
      setScale(Math.max(0.5, s));
    };
    fit(); window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [view]);

  // ── store helpers (functional updates) ──
  const addMessage = (m) => setS((p) => ({ ...p, messages: [...p.messages, { id: m.id || ('m' + Math.random().toString(36).slice(2, 9)), ...m }] }));
  const patchCandidate = (c) => setS((p) => ({ ...p, candidate: { ...p.candidate, ...c } }));
  const setStage = (stage) => setS((p) => ({ ...p, stage }));
  const notify = (n) => setS((p) => ({ ...p, notifs: [{ id: 'n' + Math.random().toString(36).slice(2, 8), ts: Date.now(), ...n }, ...p.notifs] }));
  const setOnboarding = (o) => setS((p) => ({ ...p, onboarding: { ...p.onboarding, ...o } }));
  const setChat = (c) => setS((p) => ({ ...p, chat: { ...p.chat, ...c } }));
  const up = (patch) => setS((p) => ({ ...p, ...patch }));
  const goTab = (tab) => setS((p) => ({ ...p, tab }));
  const setScheduling = (id, data) => setS((p) => ({ ...p, scheduling: { ...p.scheduling, [id]: { ...(p.scheduling[id] || { slots: [], chosen: null }), ...data } } }));
  const setOverride = (id, stage) => setS((p) => ({ ...p, overrides: { ...p.overrides, [id]: stage } }));
  const addTrainer = (t) => setS((p) => ({ ...p, trainers: [...p.trainers, { id: 't' + Math.random().toString(36).slice(2, 8), ...t }] }));
  const removeTrainer = (id) => setS((p) => ({ ...p, trainers: p.trainers.filter((t) => t.id !== id) }));
  const addContactRequest = (r) => setS((p) => ({ ...p, contactRequests: [{ id: 'cr' + Math.random().toString(36).slice(2, 8), ago: 'agora mesmo', status: 'novo', ...r }, ...p.contactRequests] }));
  const resolveContact = (id) => setS((p) => ({ ...p, contactRequests: p.contactRequests.map((c) => (c.id === id ? { ...c, status: 'resolvido' } : c)) }));
  const addModuleMessage = (moduleId, message) => setS((p) => ({ ...p, moduleConversations: { ...p.moduleConversations, [moduleId]: [...(p.moduleConversations[moduleId] || []), { ts: Date.now(), ...message }] } }));
  // resposta da coordenação a uma dúvida: marca o pedido como resolvido E publica a resposta
  // — no chat principal se a dúvida veio dali, ou no Q&A do módulo se foi feita durante a formação
  const answerContactRequest = (id, answer, author) => setS((p) => {
    const text = (answer || '').trim(); if (!text) return p;
    const req = (p.contactRequests || []).find((c) => c.id === id);
    const liveReq = req && req.live;
    const authorName = author || (p.coordProfile && p.coordProfile.name) || 'Coordenação';
    const msg = { id: 'm' + Math.random().toString(36).slice(2, 9), from: 'agent', coord: true, coordAuthor: authorName, text, originalQuestion: req && req.question };
    let messages = p.messages;
    let moduleConversations = p.moduleConversations;
    if (liveReq) {
      if (req && req.moduleId) {
        moduleConversations = { ...moduleConversations, [req.moduleId]: [...(moduleConversations[req.moduleId] || []), { from: 'agent', coord: true, coordAuthor: authorName, text, ts: Date.now() }] };
        // notificação no chat principal a indicar que a coordenação respondeu naquele módulo
        messages = [...messages, { id: 'm' + Math.random().toString(36).slice(2, 9), from: 'system', text: `🎓 A coordenação respondeu à tua dúvida no módulo «${req.moduleTitle || 'formação'}» — abre o módulo para a veres.` }];
      } else {
        messages = [...messages, msg];
      }
    }
    return {
      ...p,
      contactRequests: p.contactRequests.map((c) => (c.id === id ? { ...c, status: 'resolvido', answer: text, answeredAt: Date.now(), answeredBy: authorName } : c)),
      messages,
      moduleConversations,
      notifs: liveReq ? [{ id: 'n' + Math.random().toString(36).slice(2, 8), ts: Date.now(), type: 'resposta', text: req && req.moduleId ? `a coordenação respondeu à dúvida do módulo «${req.moduleTitle}»` : 'a coordenação respondeu a uma dúvida no chat' }, ...p.notifs] : p.notifs,
    };
  });
  // — Fase 3: conta, sessão, perfil, formalização e conteúdos —
  const createAccount = (email) => { const password = window.PEDAL.genPassword(); setS((p) => ({ ...p, account: { email, password, createdAt: Date.now() } })); return password; };
  const setSession = (authed) => setS((p) => ({ ...p, session: { ...p.session, authed } }));
  const changePassword = (password) => setS((p) => ({ ...p, account: { ...(p.account || {}), password } }));
  const setModuleContent = (id, patch) => setS((p) => ({ ...p, moduleContent: { ...p.moduleContent, [id]: { ...(p.moduleContent[id] || {}), ...patch } } }));
  const setCoordJwt = (jwt) => setCoordJwtRaw(jwt);
  const clearCoordJwt = () => { setCoordJwtRaw(null); setRealCandidates(null); };

  useEffectA(() => {
    if (!coordJwt) { setRealCandidates(null); return; }
    fetch('http://localhost:3001/api/candidates', {
      headers: { 'Authorization': `Bearer ${coordJwt}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        setRealCandidates(data.map((c) => {
          const parts = (c.name || '').split(' ');
          const initials = [parts[0], parts[parts.length - 1]].filter(Boolean).map((p) => p[0].toUpperCase()).join('');
          const days = c.created_at ? Math.floor((Date.now() - new Date(c.created_at)) / 86400000) : 0;
          return { id: c.id, name: c.name, email: c.email, contact: c.phone || '', dob: c.dob || '', stage: c.stage || 'inscricao', locality: '—', localityId: null, initials, days, source: 'PEDAL', periods: [], weekdays: [], contactDate: c.created_at ? c.created_at.slice(0, 10) : '' };
        }));
      })
      .catch(() => {});
  }, [coordJwt]);

  // — Fase 4: locais de encontro, utilizadores de gestão e perfil da coordenação —
  const addStation = (st) => setS((p) => ({ ...p, stations: [...(p.stations || []), { id: 'st' + Math.random().toString(36).slice(2, 8), ...st }] }));
  const updateStation = (id, patch) => setS((p) => ({ ...p, stations: (p.stations || []).map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const removeStation = (id) => setS((p) => ({ ...p, stations: (p.stations || []).filter((s) => s.id !== id) }));
  const addMgmtUser = (u) => setS((p) => ({ ...p, mgmtUsers: [...(p.mgmtUsers || []), { id: 'u' + Math.random().toString(36).slice(2, 8), createdAt: new Date().toISOString().slice(0, 10), ...u }] }));
  const removeMgmtUser = (id) => setS((p) => ({ ...p, mgmtUsers: (p.mgmtUsers || []).filter((u) => u.id !== id) }));
  const setCoordProfile = (patch) => setS((p) => ({ ...p, coordProfile: { ...p.coordProfile, ...patch } }));
  const addNeed = (n) => setS((p) => ({ ...p, needs: [...(p.needs || []), { id: 'nd' + Math.random().toString(36).slice(2, 8), ...n }] }));
  const updateNeed = (id, patch) => setS((p) => ({ ...p, needs: (p.needs || []).map((n) => (n.id === id ? { ...n, ...patch } : n)) }));
  const removeNeed = (id) => setS((p) => ({ ...p, needs: (p.needs || []).filter((n) => n.id !== id) }));
  const reset = () => { localStorage.removeItem(STORE_KEY); setS({ ...INITIAL, candidate: { ...INITIAL.candidate, localities: [] }, messages: [], notifs: [], onboarding: { done: {}, roleAccepted: false }, chat: { node: 'welcome', interviewStep: 0 }, scheduling: {}, overrides: {}, trainers: INITIAL.trainers.map((t) => ({ ...t })), contactRequests: INITIAL.contactRequests.map((c) => ({ ...c })), account: null, session: { authed: false }, signature: null, termsAccepted: false, moduleContent: {}, stations: INITIAL.stations.map((s) => ({ ...s })), mgmtUsers: INITIAL.mgmtUsers.map((u) => ({ ...u })), needs: INITIAL.needs.map((n) => ({ ...n })), coordProfile: { ...INITIAL.coordProfile }, moduleConversations: {} }); setResetKey((k) => k + 1); };

  const store = { S, addMessage, patchCandidate, setStage, notify, setOnboarding, setChat, up, goTab, reset, setScheduling, setOverride, addTrainer, removeTrainer, addContactRequest, resolveContact, answerContactRequest, addModuleMessage, createAccount, setSession, changePassword, setModuleContent, addStation, updateStation, removeStation, addMgmtUser, removeMgmtUser, setCoordProfile, addNeed, updateNeed, removeNeed, coordJwt, setCoordJwt, clearCoordJwt, realCandidates };

  const tone = (t.tone || 'Caloroso').toLowerCase();
  const fs = { Normal: 1, Grande: 1.13, Maior: 1.26 }[t.textSize] || 1;
  const pal = t.palette || TWEAK_DEFAULTS.palette;
  const themeVars = { '--primary': pal[0], '--primary-soft': pal[1], '--primary-deep': pal[2], '--fs': fs };

  const unlocked = S.validated && S.onboarding.roleAccepted;
  const obCount = window.PEDAL.MODULES.filter((m) => S.onboarding.done[m.id]).length;
  const authed = S.session && S.session.authed;
  const hasAccount = !!S.account;
  const formalizePending = S.stage === 'formalizacao';
  const tabs = [
    { id: 'conversa', label: 'Conversa', icon: 'chat' },
    { id: 'formacao', label: 'Formação', icon: 'book' },
    { id: 'processo', label: 'Processo', icon: 'route' },
  ];
  tabs.push({ id: 'perfil', label: authed ? 'Perfil' : 'Entrar', icon: 'user' });

  return (
    <div className="pedal-stage" style={themeVars}>
      <div className="pedal-topbar">
        <div className="pedal-brandmini"><img src={window.__PEDAL_LOGO} alt="Pedalar Sem Idade Porto" className="pedal-logo" /><span className="pedal-brandsep">·</span><PedalMark size={20} color="var(--primary)" /><span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>PEDAL<em style={{ font: '400 9.5px var(--ui)', fontStyle: 'italic', color: 'var(--ink-soft)', letterSpacing: 0, fontWeight: 400 }}>Direito a vento no cabelo</em></span></div>
        <div className="pedal-seg">
          <button className={view === 'candidate' ? 'on' : ''} onClick={() => setView('candidate')}><Icon name="chat" size={15} />Candidato</button>
          <button className={view === 'coordination' ? 'on' : ''} onClick={() => setView('coordination')}><Icon name="people" size={15} />Coordenação</button>
        </div>
        <button className="pedal-reset" onClick={reset} title="Recomeçar a demonstração">Recomeçar</button>
      </div>

      {view === 'candidate' ? (
        <div className="pedal-phonewrap">
          <div className="pedal-phonescale" style={{ transform: `scale(${scale})` }}>
            <IOSDevice width={402} height={860}>
              <div className="pedal-app" style={themeVars}>
                <div className="pedal-viewport">
                  <div style={{ display: S.tab === 'conversa' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
                    <ChatView key={resetKey} store={store} tone={tone} />
                  </div>
                  {S.tab === 'formacao' && <FormacaoView store={store} />}
                  {S.tab === 'processo' && <ProcessoView store={store} />}
                  {S.tab === 'perfil' && <ProfileView store={store} />}
                </div>
                <div className="pedal-tabbar">
                  {tabs.map((tb) => (
                    <button key={tb.id} className={'pedal-tab' + (S.tab === tb.id ? ' on' : '')} onClick={() => goTab(tb.id)}>
                      <span style={{ position: 'relative' }}>
                        <Icon name={tb.icon} size={22} />
                        {tb.id === 'formacao' && unlocked && obCount < window.PEDAL.MODULES.length && <span className="pedal-tabbadge" />}
                        {tb.id === 'conversa' && formalizePending && <span className="pedal-tabbadge" />}
                      </span>
                      <span>{tb.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </IOSDevice>
          </div>
        </div>
      ) : coordJwt ? (
        <div className="pedal-dashwrap"><Dashboard store={store} /></div>
      ) : (
        <CoordLoginScreen store={store} />
      )}

      <TweaksPanel>
        <TweakSection label="Tom de voz do PEDAL" />
        <TweakRadio label="Tom" value={t.tone} options={['Caloroso', 'Profissional', 'Direto']} onChange={(v) => setTweak('tone', v)} />
        <TweakSection label="Acessibilidade" />
        <TweakRadio label="Tamanho do texto" value={t.textSize} options={['Normal', 'Grande', 'Maior']} onChange={(v) => setTweak('textSize', v)} />
        <TweakSection label="Cor da marca" />
        <TweakColor label="Paleta" value={t.palette} options={[
          ['#ED1C24', '#FDE7E8', '#C4151C'],
          ['#1F7E6D', '#E7F4F1', '#155E51'],
          ['#161616', '#ECECEC', '#000000'],
          ['#3A6EA5', '#E2ECF6', '#264C75'],
        ]} onChange={(v) => setTweak('palette', v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
