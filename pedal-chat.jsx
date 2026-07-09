/* pedal-chat.jsx — motor conversacional do PEDAL (máquina de estados do funil) */

const { useState: useStateC, useEffect: useEffectC, useRef: useRefC } = React;

const WELCOME = {
  caloroso: 'Olá! 👋 Que bom ver-te por aqui. Sou o PEDAL, o teu companheiro nesta jornada para te tornares piloto voluntário. 🚲',
  profissional: 'Olá, bem-vindo(a)! Sou o PEDAL, o assistente digital da Pedalar Sem Idade. Vou acompanhá-lo no processo para se tornar piloto voluntário.',
  direto: 'Olá. Sou o PEDAL. Ajudo-te a tornares-te piloto voluntário da Pedalar Sem Idade. Vamos a isto?',
};

function uidC() { return 'm' + Math.random().toString(36).slice(2, 9); }

function ChatView({ store, tone = 'caloroso' }) {
  const S = store.S;
  const P = window.PEDAL;
  const node = (S.chat && S.chat.node) || 'welcome';

  const [typing, setTyping] = useStateC(false);
  const [interaction, setInteraction] = useStateC(null);
  const [askedActive, setAskedActive] = useStateC([]);
  const typingTimer = useRefC();
  const valTimer = useRefC();
  const scrollRef = useRefC();
  const genRef = useRefC(0);
  const triageResultRef = useRefC(null); // fresh match result from triage submit (avoids stale S.candidate)

  const { addMessage, patchCandidate, setStage, notify, setOnboarding, setChat, up } = store;
  // Localidades: vêm da BD (realLocalities), com fallback para P.LOCALITIES enquanto carrega
  const allLocalities = store.realLocalities || P.LOCALITIES;
  const locOf = (id) => allLocalities.find((l) => l.id === id) || allLocalities[0];
  const INTERVIEW = P.INTERVIEW;

  // ── fila de mensagens do agente com indicador "a escrever" ──
  function say(items, after) {
    const gen = ++genRef.current;
    const run = (i) => {
      if (gen !== genRef.current) return;
      if (i >= items.length) { setTyping(false); after && after(); return; }
      setTyping(true);
      const it = items[i];
      const d = it.delay != null ? it.delay : Math.min(1150, 430 + (it.text ? it.text.length * 11 : 240));
      typingTimer.current = setTimeout(() => {
        if (gen !== genRef.current) return;
        setTyping(false);
        addMessage({ from: 'agent', id: uidC(), ...it });
        typingTimer.current = setTimeout(() => run(i + 1), 260);
      }, d);
    };
    run(0);
  }

  // ── conteúdo de cada nó ──────────────────────────────────────
  function intro(id) {
    const c = S.candidate; const first = (c.name || '').split(' ')[0];
    switch (id) {
      case 'welcome': return [{ text: WELCOME[tone] || WELCOME.caloroso }, { text: 'Em poucos minutos mostro-te o projeto, esclareço dúvidas e ajudo-te a dar o primeiro passo. Por onde queres começar?' }];
      case 'present': return [{ text: 'Boa! 🎉 Deixa-me apresentar-te o projeto em três traços.' }, { card: 'project' }, { text: 'A formação e o seguro são connosco. Só pedimos uma coisa em troca: um compromisso de cerca de 2 horas por semana, para dar consistência aos passeios. É bom saberes isto já, para veres se encaixa na tua rotina. ⏱️' }];
      case 'faq': return [{ text: 'Pergunta à vontade! Toca num tema ou escreve a tua dúvida. 💬' }];
      case 'consent': return [{ text: 'Perfeito! Vamos tratar da tua inscrição. 📝' }];
      case 'collect': return [{ text: 'Primeiro, fico a conhecer-te.' }];
      case 'triage': return [{ text: `Prazer, ${first || 'bem-vindo'}! 🙌 Agora diz-me onde e quando gostarias de pedalar.` }];
      case 'triage_result': {
        const r = triageResultRef.current || {};
        const open = r.open || [];
        const closed = r.closed || [];
        const names = (arr) => arr.map((l) => l.name).join(', ');
        if (open.length && closed.length) {
          // Caso misto: algumas zonas com vaga, outras sem
          const openLabel = open.length === 1 ? names(open) : `${names(open)}`;
          return [
            { text: `Há procura de pilotos em ${names(open)} compatível com a tua disponibilidade! 🎉` },
            { text: `Em ${names(closed)} não há vaga compatível neste momento. 🙏 Ficam em lista de espera — avisamos-te se abrir vaga.` },
            { text: `Queres avançar com ${openLabel}, ou preferes escolher outras zonas?` },
          ];
        }
        if (open.length) {
          return [
            { text: `Boa notícia! 🎉 Há procura de pilotos em ${names(open)} compatível com a tua disponibilidade.` },
            { text: 'Contamos com cerca de 2 horas por semana da tua parte. Se isso te servir, avançamos já para uma breve entrevista — demora cerca de 2 minutos.' },
          ];
        }
        return [
          { text: `Neste momento não há vaga compatível em ${names(closed)} com a tua disponibilidade. 🙏` },
          { text: 'Ficaste automaticamente em lista de espera — avisamos-te assim que surgir uma necessidade compatível na tua zona. 💛' },
        ];
      }
      case 'waitlisted': return [{ text: 'Combinado, ficas na nossa lista! 💛 Entretanto posso esclarecer dúvidas — ou ligo-te à equipa quando quiseres.' }];
      case 'interview': return [{ text: 'Vou fazer-te algumas perguntas para a coordenação te conhecer. 🙌' }, { text: INTERVIEW[0].q }];
      case 'await_validation': return [{ text: 'Obrigado pela partilha! 🙏 A coordenação vai rever a tua candidatura — normalmente em 1 a 2 dias.' }];
      case 'role_profile': return [{ text: 'Antes da formação, conhece o perfil do piloto e o nosso compromisso mútuo.' }];
      case 'goto_onboarding': return [{ text: 'Tudo a postos! 🎓 Preparei a tua formação: 6 módulos curtos. Podes voltar a qualquer vídeo quando quiseres, sem perder o progresso.' }];
      case 'onboarding_done': return [{ text: '🎓 Concluíste o onboarding! A coordenação foi notificada com o teu progresso.' }, { text: 'O próximo passo é a formação prática com um coach de território, na tua zona — a coordenação vai propor-te horários por aqui. 🗓️' }];
      case 'schedule_practical': return [{ text: 'A coordenação propôs horários para a tua formação prática com o coach. 🗓️ Escolhe o que te der mais jeito:' }];
      case 'practical_booked': return [{ text: `Combinado! ✅ Ficas com ${pickedSlotText()}. Enviei os detalhes à coordenação e ao coach da tua zona.` }, { text: 'No dia, és acompanhado(a) do início ao fim — sem pressa, até te sentires confiante. Até já! 🚲' }];
      case 'await_reschedule': return [{ text: 'Em breve a coordenação envia-te novas datas para a formação prática. 🗓️' }];
      case 'formalize': {
        const F = P.FORMALIZATION;
        return [{ text: F.intro }, { text: 'Lê os termos abaixo, indica o teu NIF para o seguro, aceita e assina com o dedo. Demora um instante. ✍️' }];
      }
      case 'active_home': return [{ text: `Olá${first ? ', ' + first : ''}! 🙌 Já és piloto ativo — que bom!` }, { text: 'O meu papel termina aqui. Daqui em diante é o teu coach que organiza os passeios e o dia a dia. Comigo continuas a poder rever a formação e tirar dúvidas sobre a Pedalar Sem Idade.' }];
      case 'rejected': {
        const reason = (S.rejection && S.rejection.reason) || '';
        return [
          { text: `${first ? first + ', ' : ''}obrigado de coração pelo teu interesse em seres piloto voluntário. 💛` },
          { text: `Desta vez a coordenação não conseguiu avançar com a tua candidatura${reason ? `: ${reason}` : '.'}` },
          { text: 'Não leves isto como um "não" para sempre — as necessidades mudam muitas vezes e adoraríamos poder contar contigo mais à frente. Queres manter o teu perfil connosco, ou preferes apagá-lo?' },
        ];
      }
      default: return [];
    }
  }

  function stepInteraction(i) {
    const q = INTERVIEW[i];
    if (!q) return null;
    if (q.kind === 'choice') return { type: 'quick', options: q.options.map((o) => ({ label: o, interview: q.id, value: o })) };
    return { type: 'interviewText', q };
  }

  function interactionFor(id) {
    switch (id) {
      case 'welcome': return { type: 'quick', options: [{ label: 'Quero ser piloto 🚲', go: 'present', accent: 'fill' }, { label: 'Tenho uma dúvida', go: 'faq' }, { label: 'Só a explorar', go: 'present' }] };
      case 'present': return { type: 'quick', options: [{ label: 'O que é a Pedalar Sem Idade?', faq: 'missao' }, { label: 'Como é a formação?', faq: 'seguranca' }, { label: 'Quais os requisitos?', faq: 'requisitos' }, { label: 'Quero inscrever-me ✍️', go: 'consent', accent: 'fill' }] };
      case 'faq': case 'waitlisted': return { type: 'faq' };
      case 'consent': return { type: 'card:consent' };
      case 'collect': return { type: 'form_profile' };
      case 'triage': return { type: 'triage' };
      case 'triage_result': {
        const r = triageResultRef.current || {};
        const anyOpen = (r.open && r.open.length > 0);
        const anyClosed = (r.closed && r.closed.length > 0);
        if (anyOpen && anyClosed) {
          const openLabel = r.open.length === 1 ? r.open[0].name : 'as zonas disponíveis';
          return { type: 'quick', options: [
            { label: `Continuar com ${openLabel} →`, go: 'interview', accent: 'fill' },
            { label: 'Escolher outras zonas', go: 'triage' },
          ]};
        }
        return anyOpen
          ? { type: 'quick', options: [{ label: 'Começar entrevista →', go: 'interview', accent: 'fill' }, { label: 'Tenho uma dúvida', action: 'askPedal' }] }
          : { type: 'quick', options: [{ label: 'Escolher outras zonas', go: 'triage' }] };
      }
      case 'interview': return stepInteraction((S.chat && S.chat.interviewStep) || 0);
      case 'await_validation': return { type: 'note', text: '⏳ A aguardar a validação da coordenação… Recebes aviso aqui assim que a tua candidatura for aprovada.' };
      case 'role_profile': return { type: 'card:role' };
      case 'goto_onboarding': return { type: 'quick', options: [{ label: 'Abrir a minha formação →', action: 'go_formacao', accent: 'fill' }, { label: 'Tenho uma dúvida', action: 'doubt' }] };
      case 'onboarding_done': return { type: 'quick', options: [{ label: 'Quando é a formação prática?', answer: 'A coordenação vai propor-te aqui datas possíveis, conforme a disponibilidade do coach na tua zona. Aparecem nesta conversa assim que estiverem prontas. 🗓️' }] };
      case 'schedule_practical': return { type: 'schedule' };
      case 'practical_booked': return { type: 'quick', options: [{ label: 'Preciso de remarcar', action: 'reschedule' }, { label: 'Falar com a equipa', action: 'handoff' }] };
      case 'await_reschedule': return { type: 'note', text: '🗓️ A aguardar novas datas da coordenação… aparecem aqui assim que estiverem prontas.' };
      case 'formalize': return { type: 'card:formalize' };
      case 'active_home': return { type: 'activefaq' };
      case 'rejected': return { type: 'quick', options: [{ label: 'Manter o meu perfil', action: 'keep_profile', accent: 'fill' }, { label: 'Apagar o meu perfil', action: 'delete_profile' }] };
      case 'await_waitinglist': return { type: 'note', text: '💛 Estás em lista de espera. Avisamos-te assim que houver uma vaga compatível na tua zona.' };
      default: return null;
    }
  }

  // ── efeitos colaterais ao entrar num nó (estado do funil, notificações) ──
  function onEnter(id) {
    switch (id) {
      case 'welcome': if (!S.stage) setStage('inscricao'); break;
      case 'present': setStage('apresentacao'); break;
      case 'interview': setStage('entrevista'); setChat({ interviewStep: 0 }); break;
      case 'triage_result': {
        const r = triageResultRef.current || {};
        const open = r.open || [];
        const allSel = [...open, ...(r.closed || [])];
        if (open.length) notify({ type: 'qualificado', text: `é elegível em ${open.map((l) => l.name).join(', ')} — pode avançar para entrevista` });
        else { setStage('espera'); notify({ type: 'espera', text: `ficou em lista de espera (${allSel.map((l) => l.name).join(', ')})` }); }
        break;
      }
      case 'await_validation': setStage('validacao'); break;
      case 'onboarding_done': setStage('pratica'); notify({ type: 'concluido', text: 'concluiu o onboarding e está pronto(a) para a formação prática' }); break;
      case 'active_home': if (S.stage !== 'ativo') setStage('ativo'); break;
      default: break;
    }
  }

  function enterNode(id) {
    genRef.current++;
    setChat({ node: id });
    setInteraction(null);
    onEnter(id);
    const items = intro(id);
    if (items.length) say(items, () => setInteraction(interactionFor(id)));
    else setInteraction(interactionFor(id));
  }

  function pickedSlotText() {
    const sc = S.scheduling && S.scheduling[activeSchedKey];
    if (!sc || sc.chosen == null || !sc.slots[sc.chosen]) return '';
    const s = sc.slots[sc.chosen];
    return `${P.fmtDate(s.date)} às ${s.time}`;
  }

  // ── ações do utilizador ──────────────────────────────────────
  function handleQuick(opt) {
    if (opt.interview !== undefined) { answerInterview(opt.interview, opt.value); return; }
    if (opt.action === 'askPedal') {
      if (opt.label) addMessage({ from: 'user', text: opt.label });
      setInteraction(null);
      say([{ text: 'Claro! Escreve a tua dúvida e eu tento responder. 💬' }], () => setInteraction({ type: 'faq' }));
      return;
    }
    if (opt.action === 'reschedule') { requestReschedule(true); return; }
    if (opt.label) addMessage({ from: 'user', text: opt.label });
    setInteraction(null);
    if (opt.answer) { say([{ text: opt.answer }], () => setInteraction(interactionFor(node))); return; }
    if (opt.faq) { const f = P.FAQ.find((x) => x.id === opt.faq); say([{ text: f.a }], () => setInteraction(interactionFor(node))); return; }
    if (opt.action === 'go_formacao') { store.goTab('formacao'); setInteraction(interactionFor(node)); return; }
    if (opt.action === 'keep_profile') { addMessage({ from: 'user', text: opt.label }); say([{ text: 'Combinado! Guardamos o teu perfil com todo o cuidado e avisamos-te assim que surgir uma oportunidade compatível. Até breve! 🚲' }], () => setInteraction(null)); return; }
    if (opt.action === 'delete_profile') { addMessage({ from: 'user', text: opt.label }); say([{ text: 'Sem problema. Vou apagar os teus dados, ao abrigo do RGPD. 🔒' }, { text: 'Foi um gosto ter-te connosco — as portas ficam sempre abertas. Até um dia! 💛' }], () => setTimeout(() => store.reset(), 1600)); return; }
    if (opt.action === 'handoff') { goHandoff(opt.label); return; }
    if (opt.action === 'doubt') { goHandoff(''); return; }
    if (opt.go) { enterNode(opt.go); return; }
  }

  function handleChip(f) {
    addMessage({ from: 'user', text: f.q });
    setInteraction(null);
    say([{ text: f.a }], () => setInteraction(interactionFor(node)));
  }

  // chips do piloto ativo: depois de usada, a sugestão desaparece da lista
  function handleActiveChip(f) {
    setAskedActive((prev) => (prev.includes(f.id) ? prev : [...prev, f.id]));
    handleChip(f);
  }

  function answerInterview(qid, value) {
    addMessage({ from: 'user', text: value });
    const answers = { ...(S.candidate.interview || {}), [qid]: value };
    patchCandidate({ interview: answers });
    let i = ((S.chat && S.chat.interviewStep) || 0) + 1;
    while (i < INTERVIEW.length && INTERVIEW[i].skipUnless && answers[INTERVIEW[i].skipUnless.id] !== INTERVIEW[i].skipUnless.value) i++;
    setChat({ interviewStep: i });
    setInteraction(null);
    if (i < INTERVIEW.length) say([{ text: INTERVIEW[i].q }], () => setInteraction(stepInteraction(i)));
    else {
      addMessage({ from: 'system', text: '✓ Entrevista concluída — dados enviados à coordenação' });
      notify({ type: 'entrevista', text: 'concluiu a entrevista — aguarda validação' });
      if (S.candidateId && store.candidateJwt) {
        fetch(`http://localhost:3001/api/candidates/${S.candidateId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${store.candidateJwt}` },
          body: JSON.stringify({ interview: answers }),
        }).catch(() => {});
      }
      enterNode('await_validation');
    }
  }

  // abre a caixa de comentário para o voluntário escrever a dúvida → vai para a consola de gestão (RF-27)
  // coordOnly: caixa dedicada a enviar diretamente à coordenação (sem opção de perguntar ao PEDAL)
  function goHandoff(initialQuestion, opts) {
    setInteraction({ type: 'card:doubt', coordOnly: !!(opts && opts.coordOnly), initial: initialQuestion && initialQuestion !== 'Pedido de contacto a partir da conversa.' && initialQuestion !== 'Pedido de contacto de um piloto ativo.' ? initialQuestion : '' });
  }

  // tenta responder com a base de conhecimento; se não souber, re-abre a caixa pedindo confirmação para enviar à coordenação
  function tryAnswerDoubt(question) {
    const q = (question || '').trim(); if (!q) return;
    addMessage({ from: 'user', text: q });
    setInteraction(null);
    const active = S.stage === 'ativo';
    const f = active ? (P.matchIn(P.ACTIVE_FAQ, q) || P.matchFAQ(q)) : P.matchFAQ(q);
    if (f) say([{ text: f.a }], () => setInteraction(interactionFor(node)));
    else say([
      { text: 'Não tenho uma resposta certa para isto — não te quero passar informação incompleta. 🙏' },
    ], () => setInteraction({ type: 'card:doubt', initial: q, retry: true }));
  }

  // submissão da caixa de dúvida — regista o pedido na consola e confirma no chat
  function submitDoubt({ question, contact }) {
    const c = S.candidate;
    addMessage({ from: 'user', text: question });
    store.addContactRequest({
      name: c.name || 'Voluntário',
      contact: contact || c.contact || '',
      email: c.email || '',
      question,
      live: true,
    });
    addMessage({ from: 'system', text: '✓ Dúvida enviada à consola da coordenação' });
    const preview = question.length > 60 ? question.slice(0, 60) + '…' : question;
    notify({ type: 'contacto', text: `enviou uma dúvida ao agente: “${preview}”` });
    setInteraction({ type: 'card:doubt', sent: true });
  }

  // pedido de novas datas para a formação prática (antes ou depois de aceitar)
  function requestReschedule(fromBooked) {
    const c = S.candidate;
    addMessage({ from: 'user', text: fromBooked ? 'Preciso de remarcar a formação prática' : 'Nenhuma destas datas me serve' });
    store.setScheduling(activeSchedKey, { slots: [], chosen: null, rescheduleRequested: true });
    if (S.candidateId && store.candidateJwt) {
      fetch(`http://localhost:3001/api/candidates/${S.candidateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${store.candidateJwt}` },
        body: JSON.stringify({ scheduling: { slots: [], chosen: null, rescheduleRequested: true } }),
      }).catch(() => {});
    }
    setStage('pratica');
    notify({ type: 'agendado', text: fromBooked ? 'precisa de remarcar a formação prática' : 'pediu novas datas para a formação prática' });
    store.addContactRequest({ name: c.name || 'Voluntário', contact: c.contact || '', email: c.email || '', live: true,
      question: fromBooked ? 'Precisa de remarcar a formação prática já agendada — propor novas datas.' : 'Nenhuma das datas propostas para a formação prática serve — propor novas.' });
    addMessage({ from: 'system', text: 'Pedido de novas datas enviado à coordenação' });
    setInteraction(null);
    setChat({ node: 'await_reschedule' });
    say([
      { text: 'Sem problema — obrigado por avisares com antecedência. 🙏 É exatamente assim que ajudamos a instituição a organizar-se.' },
      { text: 'Já pedi à coordenação que te proponha novas datas. Aparecem aqui assim que estiverem prontas. 🗓️' },
    ], () => setInteraction(interactionFor('await_reschedule')));
  }

  function handleSend(text) {
    const t = text.trim(); if (!t) return;
    addMessage({ from: 'user', text: t });
    const active = S.stage === 'ativo';
    const f = active ? (P.matchIn(P.ACTIVE_FAQ, t) || P.matchFAQ(t)) : P.matchFAQ(t);
    if (f) say([{ text: f.a }], () => setInteraction(interactionFor(node)));
    else say([
      { text: 'Esta é uma pergunta que prefiro não responder por ti — para não te dar uma informação incompleta. 🙏' },
      { text: 'Posso enviar a tua dúvida à coordenação. Confirma o texto e envio-a já — eles respondem-te aqui mesmo.' },
    ], () => setInteraction({ type: 'card:doubt', initial: t, retry: true }));
  }

  // ── ciclo de vida ────────────────────────────────────────────
  useEffectC(() => {
    if (S.messages.length === 0) enterNode('welcome');
    else setInteraction(interactionFor(node));
    return () => { clearTimeout(typingTimer.current); clearTimeout(valTimer.current); };
    // eslint-disable-next-line
  }, []);

  // login com sessão guardada: restaura a interação correcta após o componente já ter montado
  const restoreFlag = !!(S.chat && S.chat.restoreInteraction);
  useEffectC(() => {
    if (!restoreFlag) return;
    setInteraction(interactionFor((S.chat && S.chat.node) || 'triage'));
    store.setChat({ restoreInteraction: false });
    // eslint-disable-next-line
  }, [restoreFlag]);

  // a coordenação validou → o chat avança para o perfil de função
  useEffectC(() => {
    if (S.validated && node === 'await_validation') {
      say([
        { text: '🎉 Boas notícias! A coordenação validou a tua candidatura. Bem-vindo(a) à formação!', delay: 600 },
        { text: 'A partir daqui, contamos contigo para cerca de 2 horas por semana — é esse ritmo regular que faz a diferença para quem espera por um passeio. 💛' },
      ], () => enterNode('role_profile'));
    }
    // eslint-disable-next-line
  }, [S.validated]);

  // a coordenação propôs horários → o chat mostra-os para o candidato escolher
  const schedKey = S.candidateId || 'live';
  // determine which key actually holds the proposal (coordinator may have used 'live' before candidate was in backend)
  const activeSchedKey = (S.scheduling && S.scheduling[schedKey]) ? schedKey : 'live';
  const liveSched = (S.scheduling && S.scheduling[activeSchedKey]) || null;
  const hasProposals = !!(liveSched && liveSched.slots && liveSched.slots.length && liveSched.chosen == null);
  useEffectC(() => {
    if (hasProposals && node !== 'schedule_practical' && node !== 'practical_booked') enterNode('schedule_practical');
    // eslint-disable-next-line
  }, [hasProposals]);

  const allDone = P.MODULES.every((m) => S.onboarding.done[m.id]);
  useEffectC(() => {
    // só avança para "onboarding concluído" se ainda estiver na fase de onboarding —
    // caso contrário, recarregar um piloto já em prática/formalização/ativo voltaria
    // a arrastá-lo para trás (e o setStage('pratica') do onEnter quebrava a transição).
    if (allDone && S.validated && S.stage === 'onboarding' && node !== 'onboarding_done') enterNode('onboarding_done');
    // eslint-disable-next-line
  }, [allDone, S.stage]);

  // a coordenação rejeitou / confirmou a prática / piloto ativo → transições por estado
  useEffectC(() => {
    if (S.stage === 'rejeitado' && node !== 'rejected') enterNode('rejected');
    else if (S.stage === 'formalizacao' && node !== 'formalize') enterNode('formalize');
    else if (S.stage === 'ativo' && node !== 'active_home' && node !== 'formalize') enterNode('active_home');
    // eslint-disable-next-line
  }, [S.stage]);

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

  // aniversário do piloto → o PEDAL envia os parabéns (uma vez por ano)
  useEffectC(() => {
    const dob = S.candidate.dob; if (!dob) return;
    const now = new Date(); const d = new Date(dob);
    const isBday = d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    if (isBday && S.bdayYear !== now.getFullYear()) {
      const first = (S.candidate.name || '').split(' ')[0];
      addMessage({ from: 'agent', id: uidC(), text: `🎉 Parabéns${first ? ', ' + first : ''}! Hoje é o teu dia e toda a equipa da Pedalar Sem Idade te deseja muitos sorrisos. Obrigado por pedalares connosco. 🚲🎂` });
      up({ bdayYear: now.getFullYear() });
    }
    // eslint-disable-next-line
  }, []);

  useEffectC(() => {
    const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight;
  }, [S.messages.length, typing, interaction]);

  // ── render ───────────────────────────────────────────────────
  const blocked = interaction && ['card:consent', 'card:role', 'card:handoff', 'card:doubt', 'form_profile', 'triage', 'interviewText', 'schedule', 'card:formalize'].includes(interaction.type);

  function renderMsg(m, idx) {
    if (m.from === 'system') return <div key={m.id || idx} className="pedal-sys"><Icon name="check" size={13} />{m.text}</div>;
    const agent = m.from === 'agent';
    const next = S.messages[idx + 1];
    // avatar fica junto à ÚLTIMA mensagem de uma sequência do mesmo emissor (alinhado em baixo)
    const grouped = next && next.from === m.from && next.from !== 'system';
    if (m.card === 'project') {
      return (
        <div key={m.id || idx} className="pedal-row agent">
          <div className="pedal-av">{!grouped && <Avatar />}</div>
          <div style={{ flex: 1, maxWidth: '88%' }}><ProjectCard /></div>
        </div>
      );
    }
    if (m.card === 'credentials') {
      const acc = S.account || {};
      return (
        <div key={m.id || idx} className="pedal-row agent">
          <div className="pedal-av">{!grouped && <Avatar />}</div>
          <div style={{ flex: 1, maxWidth: '88%' }}>
            <div className="pedal-card">
              <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 9 }}>
                <span style={{ color: 'var(--primary)', display: 'flex' }}><Icon name="lock" size={18} /></span>
                <span style={{ font: '700 14px var(--display)', color: 'var(--ink)' }}>A tua conta está criada 🎉</span>
              </div>
              <p style={{ font: '400 12.5px/1.5 var(--ui)', color: 'var(--ink-soft)', margin: 0 }}>
                Enviámos as credenciais de acesso para <strong style={{ color: 'var(--ink)' }}>{acc.email}</strong>. Guarda-as — podes entrar a qualquer momento.
              </p>
              <div className="pedal-credhint" style={{ marginTop: 11 }}>
                <span style={{ font: '700 10px var(--ui)', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent-deep)' }}>Enviado por email</span>
                <div className="pedal-credrow"><span>Email</span><strong>{acc.email}</strong></div>
                <div className="pedal-credrow"><span>Palavra-passe</span><strong>{acc.password}</strong></div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    if (agent && m.coord) {
      return (
        <div key={m.id || idx} className="pedal-row agent">
          <div className="pedal-av">{!grouped && <Avatar />}</div>
          <div style={{ maxWidth: '82%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, paddingLeft: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-deep)' }} />
              <span style={{ font: '800 10px var(--ui)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--accent-deep)' }}>Resposta da coordenação{m.coordAuthor ? ` · ${m.coordAuthor}` : ''}</span>
            </div>
            <div className="pedal-bubble agent" style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent)', color: 'var(--ink)' }}>{m.text}</div>
          </div>
        </div>
      );
    }
    return (
      <div key={m.id || idx} className={'pedal-row ' + (agent ? 'agent' : 'user')}>
        {agent && <div className="pedal-av">{!grouped && <Avatar />}</div>}
        <div className={'pedal-bubble ' + (agent ? 'agent' : 'user')}>{m.text}</div>
      </div>
    );
  }

  function renderInteraction() {
    if (!interaction) return null;
    const it = interaction;
    if (it.type === 'quick') return <QuickReplies options={it.options} onPick={handleQuick} />;
    if (it.type === 'note') return <div className="pedal-note">{it.text}</div>;
    if (it.type === 'faq') {
      const hasAccount = !!S.account;
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-start', paddingLeft: 46 }}>
          {P.FAQ_CHIPS.map((id) => { const f = P.FAQ.find((x) => x.id === id); return (
            <button key={id} className="pedal-chip-btn" onClick={() => handleChip(f)}
              style={{ border: '1.5px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontWeight: 600 }}>{f.q}</button>
          ); })}
          {!hasAccount && (
            <button className="pedal-chip-btn" onClick={() => { addMessage({ from: 'user', text: 'Quero inscrever-me' }); enterNode('consent'); }}
              style={{ border: '1.5px solid var(--primary)', background: 'var(--primary)', color: '#fff', fontWeight: 700 }}>Quero inscrever-me ✍️</button>
          )}
        </div>
      );
    }
    if (it.type === 'activefaq') {
      const remaining = P.ACTIVE_CHIPS.filter((id) => !askedActive.includes(id));
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-start', paddingLeft: 46 }}>
          {remaining.map((id) => { const f = P.ACTIVE_FAQ.find((x) => x.id === id); return (
            <button key={id} className="pedal-chip-btn" onClick={() => handleActiveChip(f)}
              style={{ border: '1.5px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontWeight: 600 }}>{f.q}</button>
          ); })}
          <button className="pedal-chip-btn" onClick={() => { addMessage({ from: 'user', text: 'Abrir a minha formação' }); store.goTab('formacao'); }}
            style={{ border: '1.5px solid var(--primary)', background: 'var(--primary)', color: '#fff', fontWeight: 700 }}>Abrir a minha formação →</button>
          <button className="pedal-chip-btn" onClick={() => goHandoff('', { coordOnly: true })}
            style={{ border: '1.5px solid var(--accent)', background: 'var(--accent-soft)', color: 'var(--accent-deep)', fontWeight: 700 }}>Outra dúvida · enviar à coordenação</button>
        </div>
      );
    }
    if (it.type === 'card:consent') return <ConsentCard onAccept={() => { addMessage({ from: 'system', text: 'Consentimento de dados aceite (RGPD)' }); enterNode('collect'); }} onMore={() => say([{ text: 'Os teus dados ficam acessíveis apenas à coordenação da Pedalar Sem Idade, são usados só para o processo de voluntariado e podes pedir para os eliminar a qualquer momento. 🔒' }], () => setInteraction(interactionFor('consent')))} />;
    if (it.type === 'form_profile') return <ProfileForm onSubmit={(d) => {
      patchCandidate(d);
      const pw = store.createAccount(d.email);
      store.setSession(true);
      addMessage({ from: 'user', text: `${d.name} · ${d.contact}` });
      addMessage({ from: 'system', text: 'Inscrição criada · credenciais enviadas por email' });
      addMessage({ from: 'agent', id: uidC(), card: 'credentials' });
      enterNode('triage');
    }} />;
    if (it.type === 'triage') return <TriageForm localities={allLocalities} onSubmit={(d) => {
      patchCandidate({ localities: d.localities, locality: d.locality, periods: d.periods, availability: d.availability });
      setStage('triagem');
      // Compute match NOW with fresh d.periods — S.candidate is still stale (async React update)
      const locIds = d.localities && d.localities.length ? d.localities : [d.locality];
      const sel = locIds.map((id) => locOf(id));
      const open = sel.filter((l) => P.needMatch(store.realNeeds || [], l.name, d.periods));
      const closed = sel.filter((l) => !P.needMatch(store.realNeeds || [], l.name, d.periods));
      triageResultRef.current = { open, closed };
      const selNames = locIds.map((id) => locOf(id).name).join(', ');
      const availText = d.availability.map((a) => {
        const dayName = (P.WEEKDAYS.find((x) => x.id === a.day) || {}).name || a.day;
        const perName = (P.PERIODS.find((x) => x.id === a.period) || {}).name || a.period;
        return `${dayName} ${perName.toLowerCase()}`;
      }).join(', ');
      addMessage({ from: 'user', text: `${selNames} · ${availText}` });
      enterNode('triage_result');
    }} />;
    if (it.type === 'card:role') return <RoleProfileCard profile={P.ROLE_PROFILE} onAccept={() => { setOnboarding({ roleAccepted: true }); addMessage({ from: 'system', text: 'Perfil do piloto aceite' }); enterNode('goto_onboarding'); }} />;
    if (it.type === 'card:handoff') return <HandoffCard onBack={() => setInteraction(interactionFor(node))} />;
    if (it.type === 'card:doubt') return <DoubtBoxCard initial={it.initial || ''} candidate={S.candidate} sent={!!it.sent} retry={!!it.retry} coordOnly={!!it.coordOnly}
      onAsk={tryAnswerDoubt}
      onSubmit={submitDoubt}
      onBack={() => setInteraction(interactionFor(node))} />;
    if (it.type === 'interviewText') return <InterviewText q={it.q} onSubmit={(v) => answerInterview(it.q.id, v)} />;
    if (it.type === 'schedule') {
      const slots = (liveSched && liveSched.slots) || [];
      const trainer = (liveSched && liveSched.trainerId) ? (store.realTrainers || []).find((t) => t.id === liveSched.trainerId) : null;
      const station = (liveSched && liveSched.stationId) ? (store.realStations || []).find((s) => s.id === liveSched.stationId) : null;
      return <SchedulePicker slots={slots} station={station} onRequestNew={() => requestReschedule(false)} onPick={(idx) => {
        const s = slots[idx]; const label = `${P.fmtDate(s.date)} às ${s.time}`;
        addMessage({ from: 'user', text: label });
        store.setScheduling(activeSchedKey, { chosen: idx, rescheduleRequested: false });
        if (S.candidateId && store.candidateJwt) {
          fetch(`http://localhost:3001/api/candidates/${S.candidateId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${store.candidateJwt}` },
            body: JSON.stringify({ scheduling: { ...(liveSched || {}), chosen: idx, rescheduleRequested: false } }),
          }).catch(() => {});
        }
        setStage('pratica');
        notify({ type: 'agendado', text: `agendou a formação prática para ${label}` });
        addMessage({ from: 'system', text: `Formação prática agendada · ${label}` });
        setInteraction(null);
        setChat({ node: 'practical_booked' });
        const coach = trainer ? `o ${trainer.name}, coach da tua zona,` : 'o coach da tua zona';
        const lines = [
          { text: `Combinado! ✅ Ficas com ${label}. Enviei os detalhes à coordenação${trainer ? '' : ' e ao coach da tua zona'}.` },
        ];
        if (station) lines.push({ text: `📍 Encontram-se em ${station.name}${station.address ? ` — ${station.address}` : ''}. É aí que está o tricicio.` });
        lines.push({ text: trainer ? `Quem te vai acompanhar é ${coach} que te recebe no local. Sem pressa, até te sentires confiante. Até já! 🚲` : 'No dia, és acompanhado(a) do início ao fim — sem pressa, até te sentires confiante. Até já! 🚲' });
        say(lines, () => setInteraction(interactionFor('practical_booked')));
      }} />;
    }
    if (it.type === 'card:formalize') return <FormalizationCard onConfirm={(sig, nif) => {
      store.up({ signature: sig, termsAccepted: true });
      patchCandidate({ nif });
      if (S.candidateId && store.candidateJwt) {
        fetch(`http://localhost:3001/api/candidates/${S.candidateId}/formalize`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${store.candidateJwt}` },
          body: JSON.stringify({ nif, signature: 'signed' }),
        }).catch(() => {});
      }
      addMessage({ from: 'system', text: 'Termo de compromisso assinado · NIF recolhido · piloto ativado' });
      notify({ type: 'ativo', text: 'assinou o termo de compromisso e é agora piloto voluntário ativo' });
      setStage('ativo');
      setInteraction(null);
      setChat({ node: 'active_home' });
      const first = (S.candidate.name || '').split(' ')[0];
      say([
        { text: `É oficial${first ? ', ' + first : ''}! 🎉🚲 És agora piloto voluntário ativo da Pedalar Sem Idade. Bem-vindo(a) à equipa!` },
        { text: 'A partir daqui, quem te acompanha no terreno é o teu coach de território — é com ele que combinas passeios, horários e tudo o que envolve o triciclo. 🤝' },
        { text: 'Eu fico cá para o que envolve a Pedalar Sem Idade enquanto projeto e para revisitares a formação sempre que quiseres. 📚' },
      ], () => setInteraction(interactionFor('active_home')));
    }} />;
    return null;
  }

  return (
    <div className="pedal-screen">
      <ChatHeader stageLabel={P.stageLabel(S.stage)} onHandoff={() => goHandoff('')} />
      <div className="pedal-msgs" ref={scrollRef}>
        {S.messages.map(renderMsg)}
        {typing && <div className="pedal-row agent"><div className="pedal-av"><Avatar /></div><TypingDots /></div>}
        <div className="pedal-interaction">{renderInteraction()}</div>
      </div>
      <ChatInput disabled={blocked} onSend={handleSend} />
    </div>
  );
}

function ChatHeader({ stageLabel, onHandoff }) {
  return (
    <div className="pedal-chathead">
      <Avatar size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: '700 16px var(--display)', color: 'var(--ink)', lineHeight: 1.1 }}>PEDAL</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#3DBA6B' }} />
          <span style={{ font: '500 12px var(--ui)', color: 'var(--ink-soft)' }}>Assistente · {stageLabel}</span>
        </div>
      </div>
      <button className="pedal-headbtn" onClick={onHandoff} title="Falar com a equipa">
        <Icon name="phone" size={18} />
      </button>
    </div>
  );
}

function ChatInput({ disabled, onSend }) {
  const [v, setV] = useStateC('');
  const submit = () => { if (disabled) return; const t = v; setV(''); onSend(t); };
  return (
    <div className="pedal-inputbar">
      <input className="pedal-textinput" value={v} disabled={disabled}
        placeholder={disabled ? 'Usa as opções acima 👆' : 'Escreve a tua dúvida…'}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
      <button className="pedal-sendbtn" onClick={submit} disabled={disabled || !v.trim()}
        style={{ opacity: disabled || !v.trim() ? 0.4 : 1 }}><Icon name="send" size={20} color="#fff" /></button>
    </div>
  );
}

function InterviewText({ q, onSubmit }) {
  const [v, setV] = useStateC('');
  return (
    <div className="pedal-card">
      <input className="pedal-input" value={v} onChange={(e) => setV(e.target.value)} placeholder={q.placeholder || ''} />
      {q.note && <div style={{ font: '400 11.5px var(--ui)', color: 'var(--ink-soft)', marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="lock" size={13} />{q.note}</div>}
      <button className="pedal-btn primary" disabled={v.trim().length < 3} onClick={() => onSubmit(v.trim())}
        style={{ opacity: v.trim().length < 3 ? 0.45 : 1, width: '100%', marginTop: 10 }}>Continuar</button>
    </div>
  );
}

function SchedulePicker({ slots, station, onPick, onRequestNew }) {
  const P = window.PEDAL;
  const [sel, setSel] = useStateC(null);

  if (sel != null && slots[sel]) {
    const s = slots[sel];
    return (
      <div className="pedal-card" style={{ width: '100%' }}>
        <div style={{ font: '700 13.5px var(--ui)', color: 'var(--ink)' }}>Confirmar {P.fmtDate(s.date)} · {s.time}?</div>
        {station && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 9, padding: '9px 11px', background: 'var(--app-bg)', borderRadius: 11 }}>
            <span style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 1 }}><Icon name="pin" size={15} /></span>
            <div style={{ minWidth: 0 }}>
              <div style={{ font: '700 12.5px var(--ui)', color: 'var(--ink)' }}>{station.name}</div>
              {station.address && <div style={{ font: '500 11.5px var(--ui)', color: 'var(--ink-soft)' }}>{station.address}</div>}
            </div>
          </div>
        )}
        <div className="pedal-empcard">
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--accent-deep)', flexShrink: 0, marginTop: 1 }}><Icon name="heart" size={16} /></span>
            <p style={{ font: '500 12.5px/1.55 var(--ui)', color: 'var(--accent-deep)', margin: 0 }}>
              Só um lembrete com carinho: esta formação envolve um coach, um triciclo e tempo da instituição reservados só para ti. Se aceitares e não puderes ir, esse esforço perde-se. Confirma só se tiveres a certeza desta data. 💛
            </p>
          </div>
        </div>
        <button className="pedal-btn primary" style={{ width: '100%', marginTop: 12 }} onClick={() => onPick(sel)}>Sim, confirmo a minha presença</button>
        <button className="pedal-btn ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => onRequestNew && onRequestNew()}>Nenhuma data me serve — pedir outras</button>
        <button className="pedal-authlink" style={{ display: 'block', margin: '12px auto 0' }} onClick={() => setSel(null)}>Ver as datas outra vez</button>
      </div>
    );
  }

  return (
    <div className="pedal-card" style={{ width: '100%' }}>
      <div style={{ font: '700 13px var(--ui)', color: 'var(--ink)', marginBottom: 4 }}>Horários propostos</div>
      <div style={{ font: '400 11.5px var(--ui)', color: 'var(--ink-soft)', marginBottom: 12 }}>Toca numa data para a confirmares.</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {slots.map((s, i) => (
          <button key={i} className="pedal-slotpick" onClick={() => setSel(i)}>
            <span className="pedal-slotcal"><Icon name="clock" size={17} color="var(--primary)" /></span>
            <span style={{ flex: 1, textAlign: 'left' }}>
              <span style={{ display: 'block', font: '700 13.5px var(--ui)', color: 'var(--ink)' }}>{P.fmtDate(s.date)}</span>
              <span style={{ display: 'block', font: '500 12px var(--ui)', color: 'var(--ink-soft)' }}>{s.time}</span>
            </span>
            <Icon name="arrow" size={16} color="var(--primary)" />
          </button>
        ))}
      </div>
      <button className="pedal-authlink" style={{ display: 'block', margin: '12px auto 0' }} onClick={() => onRequestNew && onRequestNew()}>Nenhuma destas me serve</button>
    </div>
  );
}

Object.assign(window, { ChatView });
