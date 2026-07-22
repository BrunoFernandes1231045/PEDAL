/* pedal-coord-formacao.jsx — Fase 3 (coordenação):
   confirmar/rejeitar o fim da formação prática + upload de vídeos e info por fase */

const { useState: useStateCF, useRef: useRefCF, useEffect: useEffectCF } = React;

// ── Modal: confirmar conclusão ou rejeitar o piloto na formação prática ──
function PracticalCompleteModal({ c, store, onClose, startEditing }) {
  const P = window.PEDAL;
  const sc = resolveSched(store.S.scheduling[c.id], c.scheduling) || {};
  const slots = sc.slots || [];
  const slot = slots.find((s) => s.state === 'confirmado' || s.state === 'definitivo') || (sc.chosen != null ? slots[sc.chosen] : null);
  const trainer = sc.trainerId ? (store.realTrainers || []).find((t) => t.id === sc.trainerId) : null;
  const station = sc.stationId ? (store.realStations || []).find((s) => s.id === sc.stationId) : null;

  const [mode, setMode] = useStateCF(null); // 'confirm' | 'reject'
  const [comment, setComment] = useStateCF('');
  const [editing, setEditing] = useStateCF(!!startEditing);
  const [editDate, setEditDate] = useStateCF(slot ? slot.date : '');
  const [editTime, setEditTime] = useStateCF(slot ? (slot.startTime || slot.time || '') : '');
  const [editTrainerId, setEditTrainerId] = useStateCF(sc.trainerId || '');
  const [editStationId, setEditStationId] = useStateCF(sc.stationId || '');

  const sortedTrainers = [...(store.realTrainers || [])].sort((a, b) =>
    (a.locality === c.locality ? 0 : 1) - (b.locality === c.locality ? 0 : 1) || a.name.localeCompare(b.name));
  const initials = (n) => n.split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();

  const patchSched = (newSc) => {
    store.setScheduling(c.id, newSc);
    const backendId = c.live ? store.S.candidateId : c.id;
    if (backendId && store.coordJwt) {
      fetch(`/api/candidates/${backendId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${store.coordJwt}` },
        body: JSON.stringify({ scheduling: newSc }),
      }).then(() => store.patchRealCandidate(backendId, { scheduling: newSc })).catch(() => {});
    }
  };

  const saveEdit = () => {
    if (!editDate || !editTime) return;

    const P = window.PEDAL;
    const newTrainer = editTrainerId ? (store.realTrainers || []).find((t) => t.id === editTrainerId) : null;
    const newStation = editStationId ? (store.realStations || []).find((s) => s.id === editStationId) : null;

    const oldDate = slot ? slot.date : null;
    const oldTime = slot ? (slot.startTime || slot.time || '') : null;
    const changed = editDate !== oldDate || editTime !== oldTime || editTrainerId !== sc.trainerId || editStationId !== sc.stationId;

    const newSlots = slots.map((s) =>
      (s.state === 'confirmado' || s.state === 'definitivo') ? { ...s, date: editDate, startTime: editTime } : s
    );
    if (!newSlots.find((s) => s.state === 'confirmado' || s.state === 'definitivo')) {
      newSlots.push({ date: editDate, startTime: editTime, state: 'confirmado' });
    }

    const notifs = [...(sc.chatNotify || [])];
    if (changed) {
      let details = `✅ A tua formação prática está marcada para ${P.fmtDate(editDate)} · ${editTime}.`;
      if (newStation) details += ` Encontram-se em ${newStation.name}${newStation.address ? ` — ${newStation.address}` : ''}.`;
      if (newTrainer) details += ` O teu coach é ${newTrainer.name}${newTrainer.phone ? ` (${newTrainer.phone})` : ''}.`;
      notifs.push({ id: 'cn' + Math.random().toString(36).slice(2, 7), text: '📋 A tua formação prática foi atualizada pela coordenação.', shown: false });
      notifs.push({ id: 'cn' + Math.random().toString(36).slice(2, 7), text: details, shown: false });
      notifs.push({ id: 'cn' + Math.random().toString(36).slice(2, 7), text: '📞 Para qualquer remarcação ou desmarcação, contacta-nos por telefone para o 123456789.', shown: false });
    }

    patchSched({ ...sc, slots: newSlots, trainerId: editTrainerId, stationId: editStationId, chatNotify: notifs });
    if (changed) store.notify({ type: 'agendado', who: c.name, text: `horário da formação prática atualizado` });
    onClose();
  };

  const moveStage = (stage) => { if (c.live) store.setStage(stage); };

  const doConfirm = () => {
    moveStage('formalizacao');
    store.patchRealCandidate(c.id, { stage: 'formalizacao' });
    if (!c.live && store.coordJwt) {
      fetch(`/api/candidates/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${store.coordJwt}` },
        body: JSON.stringify({ stage: 'formalizacao' }),
      }).catch(() => {});
    }
    if (c.live) store.up({ rejection: null });
    store.notify({ type: 'concluido', who: c.name, text: `concluiu a formação prática${comment ? ' — ' + comment : ''} · aguarda formalização` });
    onClose();
  };

  const doReject = () => {
    if (c.live) { store.setStage('rejeitado'); store.up({ rejection: { reason: comment } }); }
    store.patchRealCandidate(c.id, { stage: 'rejeitado' });
    if (!c.live && store.coordJwt) {
      fetch(`/api/candidates/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${store.coordJwt}` },
        body: JSON.stringify({ stage: 'rejeitado' }),
      }).catch(() => {});
    }
    store.notify({ type: 'rejeitado', who: c.name, text: `não concluiu a formação prática${comment ? ' — ' + comment : ''}` });
    onClose();
  };

  const lbl = { font: '700 11px var(--ui)', letterSpacing: 0.4, color: 'var(--ink-soft)', textTransform: 'uppercase', margin: '16px 0 8px' };

  return (
    <div className="pedal-modal-wrap" onClick={onClose}>
      <div className="pedal-modal" onClick={(e) => e.stopPropagation()} style={{ width: 460 }}>
        <button className="pedal-modalclose" onClick={onClose}>✕</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <div className="pedal-kav big">{c.initials}</div>
          <div>
            <div style={{ font: '800 19px var(--display)', color: 'var(--ink)' }}>{c.name}</div>
            <div style={{ font: '500 13px var(--ui)', color: 'var(--ink-soft)' }}>{c.locality} · formação prática</div>
          </div>
          {c.live && <span style={{ marginLeft: 'auto' }}><Pill tone="green"><span className="pedal-livedot" style={{ position: 'static' }} />Em direto</Pill></span>}
        </div>

        {/* Info da sessão */}
        {!editing && (
          <div style={{ display: 'grid', gap: 7, marginTop: 16 }}>
            <div className="pedal-ivrow">
              <span style={{ color: 'var(--ink-soft)' }}>Sessão</span>
              <span style={{ fontWeight: 700, color: slot ? 'var(--ink)' : 'var(--accent-deep)' }}>
                {slot ? `${P.fmtDate(slot.date)} · ${slot.startTime || slot.time || ''}` : 'sem horário confirmado'}
              </span>
            </div>
            <div className="pedal-ivrow">
              <span style={{ color: 'var(--ink-soft)' }}>Coach</span>
              <span style={{ fontWeight: 700, color: trainer ? 'var(--ink)' : 'var(--accent-deep)' }}>{trainer ? trainer.name : 'por atribuir'}</span>
            </div>
            <div className="pedal-ivrow">
              <span style={{ color: 'var(--ink-soft)' }}>Local</span>
              <span style={{ fontWeight: 700, color: station ? 'var(--ink)' : 'var(--accent-deep)' }}>{station ? station.name : 'por definir'}</span>
            </div>
          </div>
        )}

        {/* Edição inline */}
        {editing && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button className="pedal-btn ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
              <button className="pedal-btn primary" style={{ flex: 1, opacity: (editDate && editTime) ? 1 : 0.45 }} disabled={!editDate || !editTime} onClick={saveEdit}>Guardar alterações</button>
            </div>
            <div style={lbl}>Data e hora de início</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="pedal-input" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} style={{ flex: 2 }} />
              <input className="pedal-input" type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} style={{ flex: 1 }} />
            </div>
            <div style={lbl}>Coach</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {sortedTrainers.map((t) => (
                <button key={t.id} className={'pedal-traineropt' + (editTrainerId === t.id ? ' on' : '')} onClick={() => setEditTrainerId(editTrainerId === t.id ? '' : t.id)}>
                  <div className="pedal-traineravsm">{initials(t.name)}</div>
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div style={{ font: '700 13px var(--ui)', color: 'var(--ink)' }}>{t.name}</div>
                    <div style={{ font: '500 11.5px var(--ui)', color: 'var(--ink-soft)' }}>{t.locality || 'sem território'} · {t.phone}</div>
                  </div>
                  {t.locality === c.locality && editTrainerId !== t.id && <span className="pedal-trainertag">mesma zona</span>}
                  {editTrainerId === t.id && <Icon name="check" size={17} color="var(--primary)" />}
                </button>
              ))}
            </div>
            <div style={lbl}>Local de encontro</div>
            <select className="pedal-select" style={{ width: '100%' }} value={editStationId} onChange={(e) => setEditStationId(e.target.value)}>
              <option value="">— escolher local —</option>
              {[...(store.realStations || [])].sort((a, b) => (a.locality === c.locality ? 0 : 1) - (b.locality === c.locality ? 0 : 1)).map((s) => (
                <option key={s.id} value={s.id}>{s.name} · {s.locality}</option>
              ))}
            </select>
          </div>
        )}

        {!editing && (
          <>
            <div style={lbl}>Comentário sobre a decisão {mode === 'reject' ? '(recomendado)' : '(opcional)'}</div>
            <textarea className="pedal-input" style={{ height: 74, paddingTop: 10, resize: 'none' }} value={comment} onChange={(e) => setComment(e.target.value)}
              placeholder={mode === 'reject' ? 'Ex.: precisa de mais prática de travagem antes de conduzir com passageiro…' : 'Ex.: conduziu com segurança e à vontade — apto para ativação.'} />

            {!mode ? (
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button className="pedal-btn ghost" style={{ flex: 1 }} onClick={() => setMode('reject')}>Rejeitar piloto</button>
                <button className="pedal-btn primary" style={{ flex: 2 }} onClick={() => setMode('confirm')}>Aceitar piloto ✓</button>
              </div>
            ) : mode === 'confirm' ? (
              <div style={{ marginTop: 16 }}>
                <div className="pedal-empcard" style={{ background: 'var(--primary-soft)', borderColor: 'var(--primary)' }}>
                  <p style={{ font: '500 12.5px/1.5 var(--ui)', color: 'var(--primary-deep)', margin: 0 }}>Ao confirmar, o piloto recebe na app o pedido para aceitar os termos e assinar. Só depois fica ativo.</p>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button className="pedal-btn ghost" style={{ flex: 1 }} onClick={() => setMode(null)}>Voltar</button>
                  <button className="pedal-btn primary" style={{ flex: 1 }} onClick={doConfirm}>Aceitar piloto</button>
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
          </>
        )}
      </div>
    </div>
  );
}

// ── Gestão de documentos/termos que os candidatos podem consultar ──
// Uma linha de upload genérica por documento (RGPD, Prevenção de Acidentes,
// Política de comunicação, Acordo de voluntariado — ver PEDAL.CONSENT_DOCUMENTS).
function DocumentUploadRow({ store, doc }) {
  const [uploading, setUploading] = useStateCF(false);
  const [err, setErr] = useStateCF(null);
  const [dragOver, setDragOver] = useStateCF(false);
  const current = (store.documentUrls || {})[doc.settingsKey];
  const viewUrl = doc.previewUrl || `/documento.html?key=${encodeURIComponent(doc.settingsKey)}&label=${encodeURIComponent(doc.label)}`;

  const handleFile = async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') { setErr('Só é possível carregar ficheiros PDF.'); return; }
    setErr(null); setUploading(true);
    const result = await store.uploadAndSaveDocument(file, doc);
    setUploading(false);
    if (!result || !result.ok) setErr((result && result.error) || 'Erro ao enviar o ficheiro');
  };

  const remove = () => { if (window.confirm(`Remover "${doc.label}"?`)) store.saveDocumentUrl(doc.settingsKey, null, null); };

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ font: '700 12.5px var(--ui)', color: 'var(--ink)', marginBottom: 6 }}>{doc.label}</div>
      {current ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--app-bg)', border: '1px solid var(--line)', borderRadius: 12, padding: '11px 13px' }}>
            <Icon name="check" size={16} color="var(--accent-deep)" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: '700 13px var(--ui)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {current.name || 'Documento carregado'}
              </div>
              <div style={{ font: '500 11.5px var(--ui)', color: 'var(--ink-soft)' }}>É este ficheiro que os candidatos veem agora.</div>
            </div>
            <label className="pedal-authlink" style={{ cursor: 'pointer' }}>
              {uploading ? 'A enviar…' : 'Substituir'}
              <input type="file" accept="application/pdf" style={{ display: 'none' }} disabled={uploading} onChange={(e) => { handleFile(e.target.files[0]); e.target.value = ''; }} />
            </label>
            <button className="pedal-authlink" style={{ color: 'var(--accent-deep)' }} onClick={remove}>Remover</button>
          </div>
          <a href={viewUrl} className="pedal-authlink" style={{ display: 'inline-block', marginTop: 8 }}>Ver como o candidato vê</a>
        </>
      ) : (
        <label
          className="pedal-uploadbtn"
          style={{ cursor: 'pointer', justifyContent: 'center', borderColor: dragOver ? 'var(--primary)' : undefined, background: dragOver ? 'var(--primary-soft)' : undefined }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
        >
          <input type="file" accept="application/pdf" style={{ display: 'none' }} disabled={uploading} onChange={(e) => { handleFile(e.target.files[0]); e.target.value = ''; }} />
          <Icon name="doc" size={15} />{uploading ? 'A enviar…' : 'Arrasta o PDF para aqui, ou clica para escolher'}
        </label>
      )}
      {err && <div style={{ font: '600 12px var(--ui)', color: 'var(--primary-deep)', marginTop: 6 }}>{err}</div>}
    </div>
  );
}

// Admin dos documentos/termos apresentados aos candidatos — RGPD (ecrã de consentimento)
// e os 3 termos do compromisso de piloto (ecrã de formalização final).
function RgpdConsentAdmin({ store }) {
  const docs = window.PEDAL.CONSENT_DOCUMENTS || [];
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ font: '700 11px var(--ui)', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--ink-soft)', paddingBottom: 10, borderBottom: '2px solid var(--line)', marginBottom: 14 }}>
        Documentos & termos
      </div>
      <p style={{ font: '400 12px/1.5 var(--ui)', color: 'var(--ink-soft)', margin: '0 0 14px' }}>
        RGPD mostrado no ecrã de consentimento inicial; os 3 termos abaixo ficam disponíveis para consulta no ecrã final de formalização, antes de o candidato aceitar o compromisso.
      </p>
      {docs.map((doc) => <DocumentUploadRow key={doc.settingsKey} store={store} doc={doc} />)}
    </div>
  );
}

// Base de conhecimento geral (não específica de um módulo) — alimenta as respostas da
// IA no chat principal, ao lado da FAQ fixa do código. Texto livre (cola aqui FAQs,
// contactos dos capitães de zona, procedimentos, etc.).
function GeneralKnowledgeAdmin({ store }) {
  const [text, setText] = useStateCF(store.generalKnowledge || '');
  const [saving, setSaving] = useStateCF(false);
  const [saved, setSaved] = useStateCF(false);
  const [err, setErr] = useStateCF(null);
  const dirty = text.trim() !== (store.generalKnowledge || '').trim();

  useEffectCF(() => {
    if (!dirty) setText(store.generalKnowledge || '');
    // eslint-disable-next-line
  }, [store.generalKnowledge]);

  const handleSave = async () => {
    setSaving(true); setErr(null);
    const result = await store.saveGeneralKnowledge(text.trim());
    setSaving(false);
    if (result && result.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    else setErr((result && result.error) || 'Erro ao guardar');
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ font: '700 11px var(--ui)', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--ink-soft)', paddingBottom: 10, borderBottom: '2px solid var(--line)', marginBottom: 14 }}>
        Base de conhecimento geral (IA)
      </div>
      <p style={{ font: '400 12px/1.5 var(--ui)', color: 'var(--ink-soft)', margin: '0 0 10px' }}>
        Texto usado pela IA para responder a dúvidas no chat principal quando a FAQ do código não chega (ex.: FAQs completas, contactos dos capitães de zona, procedimentos). Não é mostrado diretamente a ninguém — só serve de contexto às respostas.
      </p>
      <textarea className="pedal-agentinfo" style={{ minHeight: 220 }} value={text}
        onChange={(e) => { setText(e.target.value); setSaved(false); }}
        placeholder="Cola aqui as FAQs, contactos e procedimentos que a IA deve conhecer…" />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
        {saved && !dirty && <span style={{ font: '600 12px var(--ui)', color: 'var(--accent-deep)', display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="check" size={14} color="var(--accent-deep)" />Alterações gravadas</span>}
        {err && <span style={{ font: '600 12px var(--ui)', color: 'var(--primary-deep)' }}>{err}</span>}
        <button className="pedal-taskbtn primary" disabled={!dirty} style={{ whiteSpace: 'nowrap', flexShrink: 0, opacity: dirty ? 1 : 0.5 }} onClick={handleSave}>
          <Icon name="check" size={14} color="#fff" />Gravar alterações
        </button>
      </div>
    </div>
  );
}

function IntroVideoAdmin({ store }) {
  const [url, setUrl] = useStateCF(store.introVideoUrl || '');
  const [saved, setSaved] = useStateCF(false);
  const [saving, setSaving] = useStateCF(false);
  const [err, setErr] = useStateCF(null);

  const handleSave = async () => {
    setSaving(true); setErr(null);
    const result = await store.saveIntroVideo(url.trim());
    setSaving(false);
    if (result && result.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    else setErr((result && result.error) || 'Erro ao guardar');
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ font: '700 11px var(--ui)', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--ink-soft)', paddingBottom: 10, borderBottom: '2px solid var(--line)', marginBottom: 14 }}>
        Apresentação do projecto
      </div>
      <p style={{ font: '400 12px/1.5 var(--ui)', color: 'var(--ink-soft)', margin: '0 0 10px' }}>
        URL do vídeo (Vimeo ou YouTube) que aparece no chat de candidatos quando escolhem "Quero ser piloto".
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="pedal-input"
          style={{ flex: 1, height: 38, font: '500 13px var(--ui)' }}
          placeholder="https://vimeo.com/123456789"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setSaved(false); }}
        />
        <button className="pedal-btn primary" style={{ opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={handleSave}>
          {saving ? 'A gravar…' : 'Gravar'}
        </button>
      </div>
      {saved && <div style={{ font: '600 12px var(--ui)', color: 'var(--accent-deep)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="check" size={13} color="var(--accent-deep)" />Vídeo guardado</div>}
      {err && <div style={{ font: '600 12px var(--ui)', color: 'var(--primary-deep)', marginTop: 6 }}>{err}</div>}
    </div>
  );
}

function ModuleContentAdmin({ store }) {
  const P = window.PEDAL;
  const content = store.S.moduleContent || {};

  return (
    <div className="pedal-panel">
      <div className="pedal-panelhead">
        <span style={{ font: '700 15px var(--display)', color: 'var(--ink)' }}>Vídeos & conteúdos</span>
      </div>
      <IntroVideoAdmin store={store} />
      <GeneralKnowledgeAdmin store={store} />
      <RgpdConsentAdmin store={store} />
      <div style={{ font: '700 11px var(--ui)', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--ink-soft)', paddingBottom: 10, borderBottom: '2px solid var(--line)', marginBottom: 14 }}>
        Formação
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
  const docs = (store.moduleDocuments || {})[module.id] || [];
  const savedInfo = (store.moduleAgentInfo || {})[module.id] || '';
  const [vurl, setVurl] = useStateCF('');
  const [info, setInfo] = useStateCF(savedInfo);
  const [infoSaved, setInfoSaved] = useStateCF(false);
  const [uploadingDocs, setUploadingDocs] = useStateCF(false);
  const [docsErr, setDocsErr] = useStateCF(null);
  const infoDirty = info.trim() !== savedInfo;

  // moduleAgentInfo chega de um fetch assíncrono — sincroniza o campo quando os
  // dados reais chegarem (se ainda não tiveres começado a escrever nada de novo).
  useEffectCF(() => {
    if (!infoDirty) setInfo(savedInfo);
    // eslint-disable-next-line
  }, [savedInfo]);

  const addVideo = () => { const u = vurl.trim(); if (!u) return; store.setModuleContent(module.id, { videos: [...videos, u], video: null }); setVurl(''); };
  const rmVideo = (i) => store.setModuleContent(module.id, { videos: videos.filter((_, j) => j !== i) });
  const addDocs = async (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type === 'application/pdf');
    if (!files.length) { setDocsErr('Só é possível carregar ficheiros PDF.'); return; }
    setDocsErr(null); setUploadingDocs(true);
    for (const file of files) {
      const res = await store.uploadModuleDocument(module.id, file);
      if (!res || !res.ok) { setDocsErr((res && res.error) || 'Erro ao enviar o ficheiro'); break; }
    }
    setUploadingDocs(false);
  };
  const rmDoc = (i) => store.removeModuleDocument(module.id, i);
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
                <a href={u} target="_blank" rel="noreferrer" className="pedal-videochip" style={{ flex: 1, minWidth: 0, textDecoration: 'none', wordBreak: 'break-all' }}><Icon name="play" size={13} color="var(--primary)" /><span>{u}</span></a>
                <button className="pedal-authlink" style={{ color: 'var(--ink-soft)' }} onClick={() => rmVideo(i)}>Remover</button>
              </div>
            ))}
          </div>
        )}
        {videos.length === 0 && (
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="pedal-input" style={{ flex: 1, minWidth: 0 }} value={vurl} placeholder="https://vimeo.com/…" onChange={(e) => setVurl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addVideo(); }} />
            <button className="pedal-taskbtn primary" style={{ whiteSpace: 'nowrap', flexShrink: 0 }} onClick={addVideo}><Icon name="check" size={14} color="#fff" />Adicionar</button>
          </div>
        )}
      </div>

      <div style={{ marginTop: 11 }}>
        <div style={{ font: '600 11px var(--ui)', color: 'var(--ink-soft)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="doc" size={12} color="var(--primary)" />Documentos (base de conhecimento da IA)</div>
        {docs.length > 0 && (
          <div style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
            {docs.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <a href={d.url} target="_blank" rel="noreferrer" className="pedal-videochip" style={{ flex: 1, minWidth: 0, textDecoration: 'none' }}><Icon name="doc" size={13} color="var(--primary)" /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name || short(d.url)}</span></a>
                <button className="pedal-authlink" style={{ color: 'var(--ink-soft)' }} onClick={() => rmDoc(i)}>Remover</button>
              </div>
            ))}
          </div>
        )}
        <label className="pedal-uploadbtn" style={{ cursor: 'pointer' }}>
          <input type="file" accept="application/pdf" multiple style={{ display: 'none' }} disabled={uploadingDocs} onChange={(e) => { addDocs(e.target.files); e.target.value = ''; }} />
          <Icon name="doc" size={15} />{uploadingDocs ? 'A enviar…' : 'Carregar documentos (PDF)'}
        </label>
        {docsErr && <div style={{ font: '600 12px var(--ui)', color: 'var(--primary-deep)', marginTop: 6 }}>{docsErr}</div>}
      </div>

      <div style={{ marginTop: 11 }}>
        <div style={{ font: '600 11px var(--ui)', color: 'var(--ink-soft)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="sparkle" size={12} color="var(--primary)" />Informação para o agente</div>
        <textarea className="pedal-agentinfo" value={info}
          onChange={(e) => { setInfo(e.target.value); setInfoSaved(false); }}
          placeholder="Ex.: nesta fase explicamos a assistência elétrica e os 3 níveis de apoio. Reforçar que o triciclo nunca arranca sozinho…" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          {infoSaved && !infoDirty && <span style={{ font: '600 12px var(--ui)', color: 'var(--accent-deep)', display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="check" size={14} color="var(--accent-deep)" />Alterações gravadas</span>}
          <button className="pedal-taskbtn primary" disabled={!infoDirty} style={{ whiteSpace: 'nowrap', flexShrink: 0, opacity: infoDirty ? 1 : 0.5 }}
            onClick={async () => { const res = await store.saveModuleAgentInfo(module.id, info.trim()); if (res && res.ok) setInfoSaved(true); }}><Icon name="check" size={14} color="#fff" />Gravar alterações</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PracticalCompleteModal, ModuleContentAdmin });
