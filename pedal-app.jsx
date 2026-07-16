/* pedal-app.jsx — shell, store partilhado, persistência, navegação e Tweaks */

const { useState: useStateA, useEffect: useEffectA, useRef: useRefA } = React;

const STORE_KEY = 'pedal_v3';
const INITIAL = {
  stage: null,
  candidate: { name: '', contact: '', email: '', dob: '', cc: '', locality: '', localities: [], periods: [], interview: {} },
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
  emailVerificationRequired: false, // true quando EMAIL_VERIFICATION=true no backend
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
  const [view, setView] = useStateA(window.__PEDAL_MODE === 'coord' ? 'coordination' : 'candidate');
  const [resetKey, setResetKey] = useStateA(0);
  const [scale, setScale] = useStateA(1);
  const [coordJwt, setCoordJwtRaw] = useStateA(null); // não persiste no localStorage
  const [coordRole, setCoordRoleRaw] = useStateA(null);
  const [coordProfile, setCoordProfileRaw] = useStateA(null); // não persiste no localStorage — isolado por tab
  const [realCandidates, setRealCandidates] = useStateA(null);
  const [realTrainers, setRealTrainers] = useStateA(null);
  const [realNeeds, setRealNeeds] = useStateA(null);
  const [introVideoUrl, setIntroVideoUrl] = useStateA(null);
  const [realStations, setRealStations] = useStateA(null);
  const [realLocalities, setRealLocalities] = useStateA(null);
  const [candidateJwt, setCandidateJwtRaw] = useStateA(null);
  const [chatLoaded, setChatLoaded] = useStateA(false);
  const msgSyncTimer = useRefA();
  const nodeSyncTimer = useRefA();
  const chatLoadedFor = useRefA(null);

  useEffectA(() => { localStorage.setItem(STORE_KEY, JSON.stringify(S)); }, [S]);

  // Sincronização em tempo real entre separadores (candidato ↔ coordenação)
  useEffectA(() => {
    const onStorage = (e) => {
      if (e.key === STORE_KEY && e.newValue) {
        try { setS(JSON.parse(e.newValue)); } catch (_) {}
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Guarda mensagens na BD sempre que mudam (debounced 1.5s)
  useEffectA(() => {
    clearTimeout(msgSyncTimer.current);
    if (!S.candidateId || !candidateJwt || !S.messages.length) return;
    msgSyncTimer.current = setTimeout(() => {
      fetch(`/api/candidates/${S.candidateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${candidateJwt}` },
        body: JSON.stringify({ chat_messages: S.messages }),
      }).catch(() => {});
    }, 1500);
  }, [S.messages, candidateJwt]);

  // Guarda nó actual do chat na BD (debounced 1s)
  const chatNode = S.chat ? S.chat.node : null;
  useEffectA(() => {
    clearTimeout(nodeSyncTimer.current);
    if (!S.candidateId || !candidateJwt || !chatNode) return;
    nodeSyncTimer.current = setTimeout(() => {
      fetch(`/api/candidates/${S.candidateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${candidateJwt}` },
        body: JSON.stringify({ chat_node: chatNode }),
      }).catch(() => {});
    }, 1000);
  }, [chatNode, S.candidateId, candidateJwt]);

  // Carrega histórico de mensagens e nó quando candidato autentica (uma vez por candidato)
  useEffectA(() => {
    if (!S.candidateId || !candidateJwt) {
      if (!chatLoaded) setChatLoaded(true);
      return;
    }
    if (chatLoadedFor.current === S.candidateId) {
      if (!chatLoaded) setChatLoaded(true);
      return;
    }
    fetch(`/api/candidates/${S.candidateId}`, {
      headers: { 'Authorization': `Bearer ${candidateJwt}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data) return;
        const msgs = Array.isArray(data.chat_messages) && data.chat_messages.length > 0 ? data.chat_messages : null;
        const cn = data.chat_node || null;
        const sched = data.scheduling || null;
        const candId = S.candidateId;
        // stages definidos pela coordenação que o candidato precisa de receber
        const coordStages = ['formalizacao', 'ativo', 'rejeitado'];
        const stageSync = data.stage && coordStages.includes(data.stage) ? data.stage : null;
        if (msgs || cn || sched || stageSync) {
          setS((p) => ({
            ...p,
            ...(msgs ? { messages: msgs } : {}),
            ...(sched && candId ? { scheduling: { ...p.scheduling, [candId]: sched } } : {}),
            ...(stageSync && stageSync !== p.stage ? { stage: stageSync } : {}),
            chat: cn ? { ...p.chat, node: cn, restoreInteraction: !!(msgs && msgs.length > 0) } : p.chat,
          }));
        }
      })
      .catch(() => {})
      .finally(() => {
        chatLoadedFor.current = S.candidateId;
        setChatLoaded(true);
      });
  }, [S.candidateId, candidateJwt]);

  // Polling do agendamento — candidato busca o seu registo para detectar proposta da coordenação
  useEffectA(() => {
    if (!S.candidateId || !candidateJwt) return;
    const pollSched = () => {
      fetch(`/api/candidates/${S.candidateId}`, {
        headers: { 'Authorization': `Bearer ${candidateJwt}` },
      })
        .then((r) => r.json())
        .then((data) => {
          if (!data) return;
          setS((p) => {
            let next = p;
            if (data.scheduling) {
              const cur = p.scheduling[p.candidateId];
              if (JSON.stringify(cur) !== JSON.stringify(data.scheduling)) {
                // não sobrescrever uma aceitação local com dados antigos do Supabase
                if (!(cur && cur.chosen != null && data.scheduling.chosen == null)) {
                  next = { ...next, scheduling: { ...next.scheduling, [p.candidateId]: data.scheduling } };
                }
              }
            }
            // sincroniza stages definidos pela coordenação
            const coordStages = ['formalizacao', 'ativo', 'rejeitado'];
            if (data.stage && coordStages.includes(data.stage) && data.stage !== p.stage) {
              next = { ...next, stage: data.stage };
            }
            return next;
          });
        })
        .catch(() => {});
    };
    pollSched();
    const timer = setInterval(pollSched, 15000);
    return () => clearInterval(timer);
  }, [S.candidateId, candidateJwt]);

  // Re-autentica na carga da página se já tem credenciais guardadas mas não tem JWT
  useEffectA(() => {
    if (!S.account?.email || !S.account?.password || candidateJwt) return;
    fetch('https://mamvckyoqrjhivffimob.supabase.co/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hbXZja3lvcXJqaGl2ZmZpbW9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1OTUwNzIsImV4cCI6MjA5NzE3MTA3Mn0.ucPATa3CTsncwoElpF8_-XyZUgwGoBfpzQM4I9M2bMM' },
      body: JSON.stringify({ email: S.account.email, password: S.account.password }),
    })
      .then((r) => r.json())
      .then((d) => { if (d.access_token) { console.log('[PEDAL] re-auth ok'); setCandidateJwtRaw(d.access_token); } else { console.log('[PEDAL] re-auth falhou:', d.error); } })
      .catch(() => {});
  }, []); // só na montagem

  // Quando o candidato se regista, cria-o também no backend (não-bloqueante)
  useEffectA(() => {
    if (S.account && !S.candidateId && S.candidate.name && S.candidate.email) {
      fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: S.candidate.name, email: S.candidate.email, dob: S.candidate.dob || null, phone: S.candidate.contact || null, cc: S.candidate.cc || null, profissao: S.candidate.profissao || null, nif: S.candidate.nif || null, rua: S.candidate.rua || null, porta: S.candidate.porta || null, codigo_postal: S.candidate.codigo_postal || null, cidade: S.candidate.cidade || null, password: S.account.password }),
      })
        .then((r) => r.json())
        .then(async (data) => {
          if (!data.id) return;
          setS((p) => ({ ...p, candidateId: data.id, emailVerificationRequired: !!data.emailVerificationRequired }));
          if (data.emailVerificationRequired) return; // não auto-login — espera verificação de email
          try {
            const authRes = await fetch('https://mamvckyoqrjhivffimob.supabase.co/auth/v1/token?grant_type=password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hbXZja3lvcXJqaGl2ZmZpbW9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1OTUwNzIsImV4cCI6MjA5NzE3MTA3Mn0.ucPATa3CTsncwoElpF8_-XyZUgwGoBfpzQM4I9M2bMM' },
              body: JSON.stringify({ email: S.candidate.email, password: S.account.password }),
            });
            const authData = await authRes.json();
            if (authData.access_token) setCandidateJwtRaw(authData.access_token);
          } catch (_) {}
        })
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
  const addTrainer = (t) => {
    if (!coordJwt) return;
    fetch('/api/trainers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${coordJwt}` },
      body: JSON.stringify(t),
    }).then((r) => r.json()).then((created) => {
      if (created && created.id) setRealTrainers((prev) => [...(prev || []), created]);
    }).catch(() => {});
  };
  const removeTrainer = (id) => {
    if (!coordJwt) return;
    fetch(`/api/trainers/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${coordJwt}` },
    }).then((r) => { if (r.ok) setRealTrainers((prev) => (prev || []).filter((t) => t.id !== id)); }).catch(() => {});
  };
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
  const setCoordRole = (role) => setCoordRoleRaw(role);
  const clearCoordJwt = () => { setCoordJwtRaw(null); setCoordRoleRaw(null); setRealCandidates(null); setRealTrainers(null); setRealStations(null); setCoordProfileRaw(null); };
  const patchRealCandidate = (id, patch) => setRealCandidates((prev) => prev ? prev.map((c) => c.id === id ? { ...c, ...patch } : c) : prev);

  // Localidades e necessidades: endpoints públicos, carregados na montagem
  useEffectA(() => {
    fetch('/api/localities')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setRealLocalities(data); })
      .catch(() => {});
  }, []);

  useEffectA(() => {
    fetch('/api/needs')
      .then((r) => r.json())
      .then((data) => { if (data && typeof data === 'object' && !Array.isArray(data)) setRealNeeds(data); })
      .catch(() => {});
  }, []);

  useEffectA(() => {
    fetch('/api/settings/intro_video_url')
      .then((r) => r.json())
      .then((data) => { if (data && data.url) setIntroVideoUrl(data.url); })
      .catch(() => {});
  }, []);

  // Refetch needs quando o candidato chega ao formulário de triagem — garante dados frescos
  useEffectA(() => {
    if (S.chat && S.chat.node === 'triage') {
      fetch('/api/needs')
        .then((r) => r.json())
        .then((data) => { if (data && typeof data === 'object' && !Array.isArray(data)) setRealNeeds(data); })
        .catch(() => {});
    }
  }, [S.chat && S.chat.node]);

  useEffectA(() => {
    if (!coordJwt) { setRealTrainers(null); return; }
    fetch('/api/trainers', { headers: { 'Authorization': `Bearer ${coordJwt}` } })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setRealTrainers(data); })
      .catch(() => {});
  }, [coordJwt]);

  useEffectA(() => {
    if (!coordJwt) { setRealStations(null); return; }
    fetch('/api/stations', { headers: { 'Authorization': `Bearer ${coordJwt}` } })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setRealStations(data); })
      .catch(() => {});
  }, [coordJwt]);

  useEffectA(() => {
    if (!coordJwt) { setRealCandidates(null); return; }
    const mapC = (c) => {
      const parts = (c.name || '').split(' ');
      const initials = [parts[0], parts[parts.length - 1]].filter(Boolean).map((p) => p[0].toUpperCase()).join('');
      const days = c.created_at ? Math.floor((Date.now() - new Date(c.created_at)) / 86400000) : 0;
      const perData = window.PEDAL && window.PEDAL.PERIODS;
      const rawPeriods = c.periods ? c.periods.split(', ').filter(Boolean) : [];
      const periods = rawPeriods.map((p) => { const f = perData && perData.find((x) => x.name === p); return f ? f.id : p; });
      return { id: c.id, name: c.name, email: c.email, contact: c.phone || '', dob: c.dob || '', cc: c.cc || '', profissao: c.profissao || '', nif: c.nif || '', stage: c.stage || 'inscricao', locality: c.locality || '—', localityId: null, initials, days, source: 'PEDAL', periods, availability: Array.isArray(c.availability) ? c.availability : [], weekdays: [], contactDate: c.created_at ? c.created_at.slice(0, 10) : '', scheduling: c.scheduling || null, interview: c.interview || null, chat_messages: Array.isArray(c.chat_messages) ? c.chat_messages : null, rua: c.rua || '', porta: c.porta || '', codigo_postal: c.codigo_postal || '', cidade: c.cidade || '' };
    };
    const loadCandidates = () => {
      fetch('/api/candidates', { headers: { 'Authorization': `Bearer ${coordJwt}` } })
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) setRealCandidates(data.map(mapC)); })
        .catch(() => {});
    };
    loadCandidates();
    const pollTimer = setInterval(loadCandidates, 5000);
    return () => clearInterval(pollTimer);
  }, [coordJwt]);

  // Sincroniza stage com o backend sempre que muda
  useEffectA(() => {
    if (!S.stage || !S.candidateId || !candidateJwt) return;
    const base = `/api/candidates/${S.candidateId}`;
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

  // — Fase 4: locais de encontro (API), utilizadores de gestão e perfil da coordenação —
  const addStation = (st) => {
    if (!coordJwt) return;
    fetch('/api/stations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${coordJwt}` },
      body: JSON.stringify(st),
    }).then((r) => r.json()).then((created) => {
      if (created && created.id) setRealStations((prev) => [...(prev || []), created]);
    }).catch(() => {});
  };
  const updateStation = (id, patch) => {
    if (!coordJwt) return;
    fetch(`/api/stations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${coordJwt}` },
      body: JSON.stringify(patch),
    }).then((r) => r.json()).then((updated) => {
      if (updated && updated.id) setRealStations((prev) => (prev || []).map((s) => s.id === id ? updated : s));
    }).catch(() => {});
  };
  const removeStation = (id) => {
    if (!coordJwt) return;
    fetch(`/api/stations/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${coordJwt}` },
    }).then((r) => { if (r.ok) setRealStations((prev) => (prev || []).filter((s) => s.id !== id)); }).catch(() => {});
  };
  const addMgmtUser = (u) => setS((p) => ({ ...p, mgmtUsers: [...(p.mgmtUsers || []), { id: 'u' + Math.random().toString(36).slice(2, 8), createdAt: new Date().toISOString().slice(0, 10), ...u }] }));
  const removeMgmtUser = (id) => setS((p) => ({ ...p, mgmtUsers: (p.mgmtUsers || []).filter((u) => u.id !== id) }));
  const updateMgmtUser = (id, patch) => setS((p) => ({ ...p, mgmtUsers: (p.mgmtUsers || []).map((u) => u.id === id ? { ...u, ...patch } : u) }));
  const setCoordProfile = (patch) => setCoordProfileRaw((p) => ({ ...(p || {}), ...patch }));
  const saveIntroVideo = (url) => {
    if (!coordJwt) return Promise.resolve({ ok: false, error: 'Sem sessão activa' });
    return fetch('/api/settings/intro_video_url', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${coordJwt}` },
      body: JSON.stringify({ url }),
    }).then((r) => r.json().then((data) => {
      if (r.ok && data && data.url !== undefined) {
        setIntroVideoUrl(data.url || null);
        return { ok: true };
      }
      return { ok: false, error: (data && data.error) || 'Erro ao guardar' };
    })).catch(() => ({ ok: false, error: 'Erro de rede' }));
  };

  const saveNeedsSchedule = (schedule) => {
    if (!coordJwt) return Promise.resolve({ ok: false, error: 'Sem sessão activa' });
    return fetch('/api/needs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${coordJwt}` },
      body: JSON.stringify(schedule),
    }).then((r) => r.json().then((data) => {
      if (r.ok && data && typeof data === 'object' && !Array.isArray(data) && !data.error) {
        setRealNeeds(data);
        return { ok: true };
      }
      return { ok: false, error: (data && data.error) || 'Erro ao guardar' };
    })).catch(() => ({ ok: false, error: 'Erro de rede' }));
  };
  const addLocality = (name) => {
    if (!coordJwt) return Promise.resolve({ ok: false, error: 'Sem sessão' });
    return fetch('/api/localities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${coordJwt}` },
      body: JSON.stringify({ name }),
    }).then((r) => r.json().then((d) => {
      if (r.ok) { setRealLocalities((prev) => [...(prev || []), d].sort((a, b) => a.name.localeCompare(b.name, 'pt'))); return { ok: true }; }
      return { ok: false, error: d.error || 'Erro ao criar' };
    })).catch(() => ({ ok: false, error: 'Erro de rede' }));
  };
  const removeLocality = (id) => {
    if (!coordJwt) return Promise.resolve({ ok: false, error: 'Sem sessão' });
    return fetch(`/api/localities/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${coordJwt}` },
    }).then((r) => {
      if (r.ok) { setRealLocalities((prev) => (prev || []).filter((l) => l.id !== id)); return { ok: true }; }
      return r.json().then((d) => ({ ok: false, error: d.error || 'Erro ao eliminar' }));
    }).catch(() => ({ ok: false, error: 'Erro de rede' }));
  };
  const renameLocality = (id, oldName, newName) => {
    if (!coordJwt) return Promise.resolve({ ok: false, error: 'Sem sessão' });
    return fetch(`/api/localities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${coordJwt}` },
      body: JSON.stringify({ name: newName }),
    }).then((r) => r.json().then((d) => {
      if (r.ok) {
        setRealLocalities((prev) => (prev || []).map((l) => l.id === id ? { ...l, name: newName } : l));
        setRealCandidates((prev) => prev ? prev.map((c) => ({
          ...c,
          locality: c.locality === oldName ? newName : c.locality,
          localities: c.localities ? c.localities.map((loc) => loc === oldName ? newName : loc) : c.localities,
        })) : prev);
        setRealTrainers((prev) => prev ? prev.map((t) => t.locality === oldName ? { ...t, locality: newName } : t) : prev);
        setRealStations((prev) => prev ? prev.map((s) => s.locality === oldName ? { ...s, locality: newName } : s) : prev);
        return { ok: true };
      }
      return { ok: false, error: d.error || 'Erro ao renomear' };
    })).catch(() => ({ ok: false, error: 'Erro de rede' }));
  };
  const reorderLocalities = (orderedSlugs) => {
    if (!coordJwt) return Promise.resolve({ ok: false, error: 'Sem sessão' });
    setRealLocalities((prev) => {
      if (!prev) return prev;
      const map = Object.fromEntries(prev.map((l) => [l.id, l]));
      return orderedSlugs.map((s) => map[s]).filter(Boolean);
    });
    return fetch('/api/localities/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${coordJwt}` },
      body: JSON.stringify({ order: orderedSlugs }),
    }).then((r) => r.json().then((d) => {
      if (r.ok) return { ok: true };
      return { ok: false, error: d.error || 'Erro ao reordenar' };
    })).catch(() => ({ ok: false, error: 'Erro de rede' }));
  };

  const reset = () => {
    // Preservar configuração da coordenação — o reset só reinicia o fluxo do candidato
    const coordData = {
      moduleContent: S.moduleContent || {},
      mgmtUsers: S.mgmtUsers && S.mgmtUsers.length ? S.mgmtUsers : INITIAL.mgmtUsers.map((u) => ({ ...u })),
      coordProfile: { ...INITIAL.coordProfile, ...(S.coordProfile || {}) },
      moduleConversations: S.moduleConversations || {},
    };
    localStorage.removeItem(STORE_KEY);
    setS({ ...INITIAL, candidate: { ...INITIAL.candidate, localities: [] }, messages: [], notifs: [], onboarding: { done: {}, roleAccepted: false }, chat: { node: 'welcome', interviewStep: 0 }, scheduling: {}, overrides: {}, contactRequests: INITIAL.contactRequests.map((c) => ({ ...c })), account: null, session: { authed: false }, signature: null, termsAccepted: false, ...coordData });
    setResetKey((k) => k + 1);
  };

  const store = { S, addMessage, patchCandidate, setStage, notify, setOnboarding, setChat, up, goTab, reset, setScheduling, setOverride, addTrainer, removeTrainer, addContactRequest, resolveContact, answerContactRequest, addModuleMessage, createAccount, setSession, changePassword, setModuleContent, addStation, updateStation, removeStation, addMgmtUser, removeMgmtUser, updateMgmtUser, setCoordProfile, saveNeedsSchedule, saveIntroVideo, addLocality, removeLocality, renameLocality, reorderLocalities, coordJwt, setCoordJwt, clearCoordJwt, coordRole, setCoordRole, coordProfile, setCoordProfile, patchRealCandidate, realCandidates, realTrainers, realNeeds, realStations, realLocalities, introVideoUrl, candidateJwt, setCandidateJwt: setCandidateJwtRaw, setView, chatLoaded };

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
    { id: 'formacao', label: 'Formação', icon: 'mortarboard' },
    { id: 'processo', label: 'Processo', icon: 'route' },
  ];
  tabs.push({ id: 'perfil', label: authed ? 'Perfil' : 'Entrar', icon: 'user' });

  return (
    <div className="pedal-stage" style={themeVars}>
      <div className="pedal-topbar">
        <div className="pedal-brandmini"><img src={window.__PEDAL_LOGO} alt="Pedalar Sem Idade Porto" className="pedal-logo" /><span className="pedal-brandsep">·</span><PedalMark size={20} color="var(--primary)" /><span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>PEDAL<em style={{ font: '400 9.5px var(--ui)', fontStyle: 'italic', color: 'var(--ink-soft)', letterSpacing: 0, fontWeight: 400 }}>Direito a vento no cabelo</em></span></div>
        {window.__PEDAL_MODE !== 'coord' && <button className="pedal-reset" onClick={reset} title="Recomeçar a demonstração">Recomeçar</button>}
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

      {view === 'candidate' && <TweaksPanel>
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
      </TweaksPanel>}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
