/* pedal-coord-formacao.jsx — Fase 3 (coordenação):
   confirmar/rejeitar o fim da formação prática + upload de vídeos e info por fase */

const { useState: useStateCF, useRef: useRefCF } = React;

// ── Modal: confirmar conclusão ou rejeitar o piloto na formação prática ──
function PracticalCompleteModal({ c, store, onClose }) {
  const P = window.PEDAL;
  const sc = store.S.scheduling[c.id] || {};
  const slot = sc.chosen != null && sc.slots ? sc.slots[sc.chosen] : null;
  const trainer = sc.trainerId ? (store.realTrainers || []).find((t) => t.id === sc.trainerId) : null;
  const [mode, setMode] = useStateCF(null); // 'confirm' | 'reject'
  const [comment, setComment] = useStateCF('');

  const moveStage = (stage) => { if (c.live) store.setStage(stage); else store.setOverride(c.id, stage); };

  const doConfirm = () => {
    moveStage('formalizacao');
    if (c.live) store.up({ rejection: null });
    store.notify({ type: 'concluido', who: c.name, text: `concluiu a formação prática${comment ? ' — ' + comment : ''} · aguarda formalização` });
    onClose();
  };
  const doReject = () => {
    if (c.live) { store.setStage('rejeitado'); store.up({ rejection: { reason: comment } }); }
    else { store.setOverride(c.id, 'rejeitado'); }
    store.notify({ type: 'rejeitado', who: c.name, text: `não concluiu a formação prática${comment ? ' — ' + comment : ''}` });
    onClose();
  };

  return (
    <div className="pedal-modal-wrap" onClick={onClose}>
      <div className="pedal-modal" onClick={(e) => e.stopPropagation()} style={{ width: 440 }}>
        <button className="pedal-modalclose" onClick={onClose}>✕</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <div className="pedal-kav big">{c.initials}</div>
          <div>
            <div style={{ font: '800 19px var(--display)', color: 'var(--ink)' }}>{c.name}</div>
            <div style={{ font: '500 13px var(--ui)', color: 'var(--ink-soft)' }}>{c.locality} · formação prática</div>
          </div>
          {c.live && <span style={{ marginLeft: 'auto' }}><Pill tone="green"><span className="pedal-livedot" style={{ position: 'static' }} />Em direto</Pill></span>}
        </div>

        <div style={{ display: 'grid', gap: 7, marginTop: 16 }}>
          <div className="pedal-ivrow"><span style={{ color: 'var(--ink-soft)' }}>Sessão</span><span style={{ fontWeight: 700, color: 'var(--ink)' }}>{slot ? `${P.fmtDate(slot.date)} · ${slot.time}` : 'sem horário confirmado'}</span></div>
          <div className="pedal-ivrow"><span style={{ color: 'var(--ink-soft)' }}>Coach</span><span style={{ fontWeight: 700, color: trainer ? 'var(--ink)' : 'var(--accent-deep)' }}>{trainer ? trainer.name : 'por atribuir'}</span></div>
        </div>

        <div style={{ font: '700 11px var(--ui)', letterSpacing: 0.4, color: 'var(--ink-soft)', textTransform: 'uppercase', margin: '18px 0 8px' }}>
          Comentário sobre a decisão {mode === 'reject' ? '(recomendado)' : '(opcional)'}
        </div>
        <textarea className="pedal-input" style={{ height: 74, paddingTop: 10, resize: 'none' }} value={comment} onChange={(e) => setComment(e.target.value)}
          placeholder={mode === 'reject' ? 'Ex.: precisa de mais prática de travagem antes de conduzir com passageiro…' : 'Ex.: conduziu com segurança e à vontade — apto para ativação.'} />

        {!mode ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="pedal-btn ghost" style={{ flex: 1 }} onClick={() => setMode('reject')}>Rejeitar piloto</button>
            <button className="pedal-btn primary" style={{ flex: 2 }} onClick={() => setMode('confirm')}>Confirmar conclusão ✓</button>
          </div>
        ) : mode === 'confirm' ? (
          <div style={{ marginTop: 16 }}>
            <div className="pedal-empcard" style={{ background: 'var(--primary-soft)', borderColor: 'var(--primary)' }}>
              <p style={{ font: '500 12.5px/1.5 var(--ui)', color: 'var(--primary-deep)', margin: 0 }}>Ao confirmar, o piloto recebe na app o pedido para aceitar os termos e assinar. Só depois fica ativo.</p>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="pedal-btn ghost" style={{ flex: 1 }} onClick={() => setMode(null)}>Voltar</button>
              <button className="pedal-btn primary" style={{ flex: 1 }} onClick={doConfirm}>Confirmar conclusão</button>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="pedal-btn ghost" style={{ flex: 1 }} onClick={() => setMode(null)}>Voltar</button>
              <button className="pedal-btn primary" style={{ flex: 1, background: 'var(--accent-deep)' }} onClick={doReject}>Confirmar rejeição</button>
            </div>
          </div>
        )}
        <p className="pedal-tasknote" style={{ marginTop: 14 }}>A confirmação da formação prática é sempre uma decisão da equipa, registada com o teu comentário.</p>
      </div>
    </div>
  );
}

// ── Gestão de conteúdos de formação: vídeos e info do agente por fase ──
function ModuleContentAdmin({ store }) {
  const P = window.PEDAL;
  const content = store.S.moduleContent || {};

  return (
    <div className="pedal-panel">
      <div className="pedal-panelhead">
        <span style={{ font: '700 15px var(--display)', color: 'var(--ink)' }}>Vídeos & conteúdos</span>
      </div>
      <p style={{ font: '400 12.5px/1.5 var(--ui)', color: 'var(--ink-soft)', margin: '0 0 14px' }}>
        Carrega o vídeo de cada fase e escreve a informação que o PEDAL deve usar para responder às dúvidas dos voluntários durante a formação.
      </p>
      <div className="pedal-modadmin">
        {P.MODULES.map((m, i) => (
          <ModuleContentRow key={m.id} module={m} index={i} content={content[m.id] || {}} store={store} />
        ))}
      </div>
    </div>
  );
}

function ModuleContentRow({ module, index, content, store }) {
  const videos = content.videos || (content.video ? [content.video] : []);
  const docs = content.docs || [];
  const [vurl, setVurl] = useStateCF('');
  const [info, setInfo] = useStateCF(content.agentInfo || '');
  const [infoSaved, setInfoSaved] = useStateCF(false);
  const infoDirty = info.trim() !== (content.agentInfo || '');
  const addVideo = () => { const u = vurl.trim(); if (!u) return; store.setModuleContent(module.id, { videos: [...videos, u], video: null }); setVurl(''); };
  const rmVideo = (i) => store.setModuleContent(module.id, { videos: videos.filter((_, j) => j !== i) });
  const addDocs = (fileList) => { const names = Array.from(fileList || []).map((f) => f.name).filter(Boolean); if (!names.length) return; store.setModuleContent(module.id, { docs: [...docs, ...names] }); };
  const rmDoc = (i) => store.setModuleContent(module.id, { docs: docs.filter((_, j) => j !== i) });
  const short = (u) => { const s = u.replace(/^https?:\/\/(www\.)?/, ''); return s.length > 40 ? s.slice(0, 40) + '…' : s; };
  return (
    <div className="pedal-modadminrow">
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <div className="pedal-modicon" style={{ width: 34, height: 34, borderRadius: 10 }}><span style={{ font: '700 13px var(--ui)', color: 'var(--ink-soft)' }}>{index + 1}</span></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: '700 13.5px var(--ui)', color: 'var(--ink)' }}>{module.title}</div>
          <div style={{ font: '500 11.5px var(--ui)', color: 'var(--ink-soft)' }}>{module.type} · {module.dur}</div>
        </div>
      </div>

      <div style={{ marginTop: 11 }}>
        <div style={{ font: '600 11px var(--ui)', color: 'var(--ink-soft)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="play" size={12} color="var(--primary)" />Vídeos da fase (URL)</div>
        {videos.length > 0 && (
          <div style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
            {videos.map((u, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <a href={u} target="_blank" rel="noreferrer" className="pedal-videochip" style={{ flex: 1, minWidth: 0, textDecoration: 'none' }}><Icon name="play" size={13} color="var(--primary)" /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{short(u)}</span></a>
                <button className="pedal-authlink" style={{ color: 'var(--ink-soft)' }} onClick={() => rmVideo(i)}>Remover</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="pedal-input" style={{ flex: 1, minWidth: 0 }} value={vurl} placeholder="https://vimeo.com/…" onChange={(e) => setVurl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addVideo(); }} />
          <button className="pedal-taskbtn primary" style={{ whiteSpace: 'nowrap', flexShrink: 0 }} onClick={addVideo}><Icon name="check" size={14} color="#fff" />Adicionar</button>
        </div>
      </div>

      <div style={{ marginTop: 11 }}>
        <div style={{ font: '600 11px var(--ui)', color: 'var(--ink-soft)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="doc" size={12} color="var(--primary)" />Documentos (base de conhecimento)</div>
        {docs.length > 0 && (
          <div style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
            {docs.map((u, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="pedal-videochip" style={{ flex: 1, minWidth: 0 }}><Icon name="doc" size={13} color="var(--primary)" /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u}</span></span>
                <button className="pedal-authlink" style={{ color: 'var(--ink-soft)' }} onClick={() => rmDoc(i)}>Remover</button>
              </div>
            ))}
          </div>
        )}
        <label className="pedal-uploadbtn" style={{ cursor: 'pointer' }}>
          <input type="file" multiple style={{ display: 'none' }} onChange={(e) => { addDocs(e.target.files); e.target.value = ''; }} />
          <Icon name="doc" size={15} />Carregar documentos
        </label>
      </div>

      <div style={{ marginTop: 11 }}>
        <div style={{ font: '600 11px var(--ui)', color: 'var(--ink-soft)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="sparkle" size={12} color="var(--primary)" />Informação para o agente</div>
        <textarea className="pedal-agentinfo" value={info}
          onChange={(e) => { setInfo(e.target.value); setInfoSaved(false); }}
          placeholder="Ex.: nesta fase explicamos a assistência elétrica e os 3 níveis de apoio. Reforçar que o triciclo nunca arranca sozinho…" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          {infoSaved && !infoDirty && <span style={{ font: '600 12px var(--ui)', color: 'var(--accent-deep)', display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="check" size={14} color="var(--accent-deep)" />Alterações gravadas</span>}
          <button className="pedal-taskbtn primary" disabled={!infoDirty} style={{ whiteSpace: 'nowrap', flexShrink: 0, opacity: infoDirty ? 1 : 0.5 }}
            onClick={() => { store.setModuleContent(module.id, { agentInfo: info.trim() }); setInfoSaved(true); }}><Icon name="check" size={14} color="#fff" />Gravar alterações</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PracticalCompleteModal, ModuleContentAdmin });
