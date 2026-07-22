/* pedal-onboarding.jsx — aba Formação (tutorial guiado) e aba Processo (estado + histórico) */

const { useState: useStateO, useRef: useRefO } = React;

function FormacaoView({ store }) {
  const S = store.S; const P = window.PEDAL;
  const [open, setOpen] = useStateO(null);
  const iframeRef = useRefO(null);
  const done = S.onboarding.done || {};
  const unlocked = S.validated && S.onboarding.roleAccepted;
  const count = P.MODULES.filter((m) => done[m.id]).length;

  if (!unlocked) {
    return (
      <div className="pedal-screen">
        <TabHeader title="Formação" subtitle="Tutorial guiado do piloto" />
        <div className="pedal-tabbody" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="pedal-locked">
            <div className="pedal-lockcircle"><Icon name="lock" size={26} color="var(--ink-soft)" /></div>
            <div style={{ font: '700 16px var(--display)', color: 'var(--ink)', marginTop: 14 }}>Quase lá!</div>
            <p style={{ font: '400 13.5px/1.5 var(--ui)', color: 'var(--ink-soft)', marginTop: 6, maxWidth: 240 }}>
              A tua formação abre assim que a coordenação validar a candidatura. Continua na conversa com o PEDAL. 🚲
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (open) {
    const m = P.MODULES.find((x) => x.id === open);
    const isDone = !!done[m.id];
    const content = (S.moduleContent || {})[m.id] || {};
    const vid = (content.videos && content.videos[0]) || content.video || null;
    const ytId = vid && (vid.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&\s]+)/) || vid.match(/(?:https?:\/\/)?youtu\.be\/([^?\s]+)/))?.[1];
    const vimeoId = vid && vid.match(/vimeo\.com\/(\d+)/)?.[1];
    const embedUrl = ytId ? `https://www.youtube.com/embed/${ytId}` : vimeoId ? `https://player.vimeo.com/video/${vimeoId}?autoplay=0&title=0&byline=0&portrait=0` : null;
    const goFullscreen = () => {
      const el = iframeRef.current;
      if (!el) return;
      (el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen).call(el);
    };
    return (
      <div className="pedal-screen">
        <TabHeader title={m.type} subtitle={m.dur} onBack={() => setOpen(null)} />
        <div className="pedal-tabbody">
          {embedUrl ? (
            <div>
              <div style={{ borderRadius: 16, overflow: 'hidden', background: '#000' }}>
                <iframe ref={iframeRef} src={embedUrl} style={{ width: '100%', height: 188, border: 'none', display: 'block' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen />
              </div>
              <button onClick={goFullscreen} style={{ width: '100%', marginTop: 8, padding: '9px 0', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', font: '600 13px var(--ui)', color: 'var(--ink-soft)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M16 21h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></svg>
                Ver em ecrã inteiro
              </button>
            </div>
          ) : vid ? (
            <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => window.open(vid.startsWith('http') ? vid : 'https://' + vid, '_blank')}>
              <Placeholder label={`vídeo · ${m.title}`} height={188} radius={16} />
              <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ width: 54, height: 54, borderRadius: '50%', background: 'rgba(255,255,255,.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(0,0,0,.18)' }}><Icon name="play" size={22} color="var(--primary)" /></span>
              </span>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <Placeholder label={`${m.type} · ${m.title}`} height={188} radius={16} />
              {m.type === 'Vídeo' && (
                <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <span style={{ width: 54, height: 54, borderRadius: '50%', background: 'rgba(255,255,255,.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(0,0,0,.18)' }}><Icon name="play" size={22} color="var(--primary)" /></span>
                </span>
              )}
            </div>
          )}

          <div style={{ font: '700 18px var(--display)', color: 'var(--ink)', marginTop: 16 }}>{m.title}</div>
          <p style={{ font: '400 14px/1.6 var(--ui)', color: 'var(--ink-soft)', marginTop: 8 }}>{m.desc}</p>
          {isDone ? (
            <div className="pedal-donebanner"><Icon name="check" size={18} color="var(--primary)" />Já concluíste este módulo — podes rever quando quiseres.</div>
          ) : null}
          <button className="pedal-btn primary" style={{ width: '100%', marginTop: 18 }}
            onClick={() => { store.setOnboarding({ done: { ...done, [m.id]: true } }); setOpen(null); }}>
            {isDone ? 'Rever concluído ✓' : 'Marcar como concluído'}
          </button>
          <ModuleQA module={m} content={content} store={store} />
        </div>
      </div>
    );
  }

  const allFin = count === P.MODULES.length;
  return (
    <div className="pedal-screen">
      <TabHeader title="Formação" subtitle={allFin ? 'Formação concluída 🎉' : `${count} de ${P.MODULES.length} módulos`} />
      <div className="pedal-tabbody">
        {allFin ? (
          <div className="pedal-progresscard" style={{ background: 'var(--primary-soft)', border: '1.5px solid var(--primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="pedal-modicon done" style={{ flexShrink: 0 }}><Icon name="check" size={20} color="#fff" /></div>
              <div style={{ font: '800 17px var(--display)', color: 'var(--primary-deep)', lineHeight: 1.15 }}>Formação concluída!</div>
            </div>
            <p style={{ font: '400 13px/1.55 var(--ui)', color: 'var(--ink)', margin: '10px 0 0' }}>
              Terminaste os {P.MODULES.length} módulos e a coordenação já foi notificada. O próximo passo é a <strong>formação prática</strong> com um coach na tua zona.
            </p>
            <button className="pedal-btn primary" style={{ width: '100%', marginTop: 14 }}
              onClick={() => store.goTab('conversa')}>Ver próximos passos →</button>
          </div>
        ) : (
          <div className="pedal-progresscard">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <span style={{ font: '600 13px var(--ui)', color: 'var(--ink)' }}>Progresso do onboarding</span>
              <span style={{ font: '700 13px var(--ui)', color: 'var(--accent-deep)' }}>{count}/{P.MODULES.length}</span>
            </div>
            <ProgressBar value={count} total={P.MODULES.length} />
          </div>
        )}
        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          {P.MODULES.map((m, i) => {
            const fin = !!done[m.id];
            return (
              <button key={m.id} className="pedal-modulecard" onClick={() => setOpen(m.id)}>
                <div className={'pedal-modicon' + (fin ? ' done' : '')}>
                  {fin ? <Icon name="check" size={20} color="#fff" /> : <span style={{ font: '700 15px var(--ui)', color: 'var(--ink-soft)' }}>{i + 1}</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div style={{ font: '700 14px var(--ui)', color: 'var(--ink)' }}>{m.title}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 3, alignItems: 'center' }}>
                    <Pill tone="neutral">{m.type}</Pill>
                    <span style={{ font: '500 12px var(--ui)', color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>{m.dur}</span>
                  </div>
                </div>
                <span style={{ color: 'var(--primary)', flexShrink: 0 }}><Icon name={fin ? 'arrow' : 'play'} size={18} /></span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ProcessoView({ store }) {
  const S = store.S; const P = window.PEDAL;
  const c = S.candidate;
  const curIdx = P.stageIndex(S.stage);
  // estados percorridos (ignora "lista de espera" no caminho linear se não aplicável)
  const path = P.STAGES.filter((s) => s.id !== 'espera' || S.stage === 'espera');
  const history = S.messages.filter((m) => m.from === 'system');

  return (
    <div className="pedal-screen">
      <TabHeader title="Processo" subtitle="Onde estás no caminho" />
      <div className="pedal-tabbody">
        {/* cartão de estado atual */}
        <div className="pedal-statuscard">
          <Pill tone="green"><Icon name="sparkle" size={12} />Estado atual</Pill>
          <div style={{ font: '700 22px var(--display)', color: 'var(--ink)', marginTop: 8 }}>{P.stageLabel(S.stage)}</div>
          <div style={{ font: '400 13px var(--ui)', color: 'var(--ink-soft)', marginTop: 2 }}>
            {c.name ? c.name : 'Candidato'}{c.locality ? ` · ${(P.LOCALITIES.find((l) => l.id === c.locality) || {}).name}` : ''}
          </div>
        </div>

        {/* linha do tempo do funil */}
        <div className="pedal-timeline">
          {path.map((s) => {
            const i = P.stageIndex(s.id);
            const state = i < curIdx ? 'past' : i === curIdx ? 'now' : 'future';
            return (
              <div key={s.id} className={'pedal-tlrow ' + state}>
                <div className="pedal-tldot">{state === 'past' ? <Icon name="check" size={13} color="#fff" /> : null}</div>
                <span style={{ font: state === 'now' ? '700 14px var(--ui)' : '500 14px var(--ui)', color: state === 'future' ? 'var(--ink-soft)' : 'var(--ink)' }}>{s.label}</span>
                {state === 'now' && <span style={{ marginLeft: 'auto' }}><Pill tone="amber">a decorrer</Pill></span>}
              </div>
            );
          })}
        </div>

        {/* resumo do questionário (perguntas + respostas) — visível sem scroll na conversa */}
        {Object.keys(c.interview || {}).length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ font: '700 12px var(--ui)', letterSpacing: 0.4, color: 'var(--ink-soft)', textTransform: 'uppercase', marginBottom: 10 }}>Resumo do questionário</div>
            <div className="pedal-card" style={{ animation: 'none' }}>
              <div style={{ display: 'grid', gap: 12 }}>
                {P.INTERVIEW.filter((q) => c.interview[q.id]).map((q) => (
                  <div key={q.id}>
                    <div style={{ font: '600 12px/1.4 var(--ui)', color: 'var(--ink-soft)' }}>{q.q}</div>
                    <div style={{ font: '700 13.5px/1.4 var(--ui)', color: 'var(--ink)', marginTop: 3, display: 'flex', gap: 7, alignItems: 'flex-start' }}><span style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 1 }}><Icon name="check" size={14} /></span>{c.interview[q.id]}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* histórico de interações (RNF-10) */}
        <div style={{ font: '700 12px var(--ui)', letterSpacing: 0.4, color: 'var(--ink-soft)', textTransform: 'uppercase', margin: '20px 0 10px' }}>Histórico de interações</div>
        {history.length === 0 ? (
          <div style={{ font: '400 13px var(--ui)', color: 'var(--ink-soft)' }}>Ainda sem marcos registados. Começa a conversa com o PEDAL.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {history.map((h, i) => (
              <div key={i} className="pedal-histrow"><Icon name="check" size={15} color="var(--primary)" /><span>{(h.text || '').replace(/^\s*✓\s*/, '')}</span></div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Q&A do PEDAL durante a formação (dúvidas sobre o vídeo/módulo) (RF)
function ModuleQA({ module, content, store }) {
  const P = window.PEDAL;
  const msgs = (store.S.moduleConversations && store.S.moduleConversations[module.id]) || [];
  const [v, setV] = useStateO('');
  const [busy, setBusy] = useStateO(false);

  const handleQuestion = async (q) => {
    if (!q || busy) return;
    setBusy(true);
    store.addModuleMessage(module.id, { from: 'user', text: q });
    await new Promise((r) => setTimeout(r, 650)); // pausa breve, dá sensação de "a pensar"

    const tf = P.matchIn(P.TRAINING_FAQ, q);
    if (tf) {
      store.addModuleMessage(module.id, { from: 'agent', text: tf.a });
      setBusy(false);
      return;
    }

    const agentInfo = (store.moduleAgentInfo || {})[module.id] || '';
    const docs = (store.moduleDocuments || {})[module.id] || [];
    const context = [agentInfo, ...docs.map((d) => d.text || '')].filter(Boolean);
    if (context.length) {
      const res = await store.askAI(q, context);
      if (res && res.confident && res.answer) {
        store.addModuleMessage(module.id, { from: 'agent', text: res.answer });
        setBusy(false);
        return;
      }
    }

    // Não há resposta automática — encaminhar para a coordenação com referência ao módulo
    const C = store.S.candidate || {};
    store.addContactRequest({
      name: C.name || 'Voluntário',
      contact: C.contact || '',
      email: C.email || '',
      question: q,
      live: true,
      moduleId: module.id,
      moduleTitle: module.title,
    });
    store.notify({ type: 'contacto', text: `enviou uma dúvida sobre o módulo «${module.title}»` });
    store.addModuleMessage(module.id, { from: 'agent', text: `Boa pergunta — não tenho uma resposta certa para te dar sobre isto. Enviei-a à coordenação com a referência a este módulo. A resposta aparece aqui mesmo assim que estiver pronta. 💛` });
    setBusy(false);
  };

  const ask = () => { const q = v.trim(); if (!q) return; setV(''); handleQuestion(q); };
  const suggestions = ['Não percebi bem esta parte', 'Posso rever depois?', 'Quando começo a parte prática?'];

  return (
    <div className="pedal-qabox">
      <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
        <Avatar size={30} />
        <div>
          <div style={{ font: '700 13px var(--display)', color: 'var(--ink)' }}>Dúvidas sobre este módulo?</div>
          <div style={{ font: '400 11.5px var(--ui)', color: 'var(--ink-soft)' }}>Pergunta ao PEDAL enquanto vês a formação.</div>
        </div>
      </div>

      {msgs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
          {msgs.map((m, i) => {
            if (m.coord) {
              return (
                <div key={i} style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-deep)' }} />
                    <span style={{ font: '800 9.5px var(--ui)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--accent-deep)' }}>Resposta da coordenação{m.coordAuthor ? ` · ${m.coordAuthor}` : ''}</span>
                  </div>
                  <div className="pedal-qamsg agent" style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent)' }}>{m.text}</div>
                </div>
              );
            }
            return <div key={i} className={'pedal-qamsg ' + (m.from === 'user' ? 'user' : 'agent')}>{m.text}</div>;
          })}
          {busy && <div className="pedal-qamsg agent" style={{ color: 'var(--ink-soft)' }}>a escrever…</div>}
        </div>
      )}

      {msgs.length === 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 11 }}>
          {suggestions.map((s) => (
            <button key={s} className="pedal-chip-btn" onClick={() => handleQuestion(s)}
              style={{ border: '1.5px solid var(--line)', background: 'var(--app-bg)', color: 'var(--ink)', fontWeight: 600, fontSize: 12 }}>{s}</button>
          ))}
        </div>
      )}

      <div className="pedal-qainput">
        <input className="pedal-textinput" style={{ height: 42 }} value={v} onChange={(e) => setV(e.target.value)}
          placeholder="Escreve a tua dúvida sobre o vídeo…" onKeyDown={(e) => { if (e.key === 'Enter') ask(); }} />
        <button className="pedal-sendbtn" style={{ width: 42, height: 42, opacity: v.trim() ? 1 : 0.4 }} onClick={ask} disabled={!v.trim()}><Icon name="send" size={18} color="#fff" /></button>
      </div>
    </div>
  );
}

function TabHeader({ title, subtitle, onBack }) {
  return (
    <div className="pedal-tabhead">
      {onBack && <button className="pedal-headbtn" onClick={onBack} style={{ marginRight: 4 }}><span style={{ display:'inline-flex', transform:'rotate(180deg)' }}><Icon name="arrow" size={18} color="var(--ink)" /></span></button>}
      <div>
        <div style={{ font: '800 21px var(--display)', color: 'var(--ink)', lineHeight: 1.1, letterSpacing: '-0.01em' }}>{title}</div>
        {subtitle && <div style={{ font: '500 12.5px var(--ui)', color: 'var(--ink-soft)', marginTop: 2 }}>{subtitle}</div>}
      </div>
    </div>
  );
}

Object.assign(window, { FormacaoView, ProcessoView, TabHeader, ModuleQA });
