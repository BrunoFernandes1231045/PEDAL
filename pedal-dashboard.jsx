/* pedal-dashboard.jsx — painel da coordenação (RF-30 a RF-40) */

const { useState: useStateD, useEffect: useEffectD } = React;

const NOTIF_META = {
  qualificado: { icon: 'user', tone: 'green', verb: 'Candidato qualificado' },
  entrevista: { icon: 'doc', tone: 'amber', verb: 'Entrevista concluída' },
  validado: { icon: 'check', tone: 'green', verb: 'Candidatura validada' },
  concluido: { icon: 'sparkle', tone: 'green', verb: 'Onboarding concluído' },
  espera: { icon: 'clock', tone: 'neutral', verb: 'Lista de espera' },
  agendado: { icon: 'clock', tone: 'amber', verb: 'Formação prática' },
  ativo: { icon: 'sparkle', tone: 'green', verb: 'Piloto ativado' },
  rejeitado: { icon: 'doc', tone: 'neutral', verb: 'Candidatura rejeitada' },
  retomado: { icon: 'user', tone: 'green', verb: 'Retomado da lista de espera' },
  contacto: { icon: 'phone', tone: 'amber', verb: 'Pedido de contacto' },
};

// Grelha de disponibilidade dia × período (read-only, reutilizada do pedal-cards.jsx)
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

function getSchedStatus(sc) {
  if (!sc || !sc.slots || !sc.slots.length) return null;
  if (sc.status) return sc.status;
  if (sc.chosen != null) return 'confirmado';
  return 'aguarda_candidato';
}

function Dashboard({ store }) {
  const S = store.S; const P = window.PEDAL;
  const coordRole = store.coordRole || 'coordenacao';
  const ROLE_TABS = { administracao: ['operacao', 'dashboards', 'gestao'], coordenacao: ['operacao', 'dashboards', 'gestao'] };
  const ROLE_GESTAO = { administracao: ['users', 'formadores', 'necessidades', 'conteudos', 'locais', 'localidades'], coordenacao: ['necessidades', 'conteudos'] };
  const allowedTabs = ROLE_TABS[coordRole] || ROLE_TABS.coordenacao;
  const allowedGestao = ROLE_GESTAO[coordRole] || null;
  const readOnly = false;
  const [sel, setSel] = useStateD(null);
  const [schedFor, setSchedFor] = useStateD(null);
  const [slotReviewFor, setSlotReviewFor] = useStateD(null);
  const [completeFor, setCompleteFor] = useStateD(null);
  const [screen, setScreen] = useStateD(allowedTabs[0] || 'operacao');  // operacao | dashboards | gestao
  const [section, setSection] = useStateD('geral');
  const [profileOpen, setProfileOpen] = useStateD(false);
  const [notifOpen, setNotifOpen] = useStateD(false);
  const [profileModal, setProfileModal] = useStateD(null); // 'edit' | 'pw' | null

  // candidato em direto (a partir do chat)
  const liveActive = !!S.stage;
  const alreadyInBackend = S.candidateId && store.realCandidates !== null && store.realCandidates.some((c) => c.id === S.candidateId);
  const live = liveActive && !alreadyInBackend ? {
    id: 'live', name: S.candidate.name || 'Novo candidato',
    locality: ((S.candidate.localities && S.candidate.localities.length ? S.candidate.localities : [S.candidate.locality]).map((id) => (P.LOCALITIES.find((l) => l.id === id) || {}).name).filter(Boolean).join(', ')) || '—',
    localityId: (S.candidate.localities && S.candidate.localities[0]) || S.candidate.locality,
    stage: S.stage, source: 'Agente PEDAL', days: 0, initials: (S.candidate.name || 'N C').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase(), live: true,
    periods: S.candidate.periods, weekdays: [], interview: S.candidate.interview, contact: S.candidate.contact, email: S.candidate.email, dob: S.candidate.dob, nif: S.candidate.nif, contactDate: '',
  } : null;
  const seedList = P.SEED_CANDIDATES.map((c) => ({ ...c, stage: S.overrides[c.id] || c.stage, localityId: (P.LOCALITIES.find((l) => l.name === c.locality) || {}).id }));
  const realWithOverrides = store.realCandidates !== null ? store.realCandidates.map((c) => S.overrides[c.id] ? { ...c, stage: S.overrides[c.id] } : c) : null;
  const candidates = [...(live ? [live] : []), ...(realWithOverrides !== null ? realWithOverrides : seedList)];

  const isLiveCandidate = (c) => c.live || c.id === S.candidateId;

  function validate(c) {
    if (isLiveCandidate(c)) { store.up({ validated: true }); store.setStage('onboarding'); }
    else { store.setOverride(c.id, 'onboarding'); }
    store.patchRealCandidate(c.id, { stage: 'onboarding' });
    if (!isLiveCandidate(c) && store.coordJwt) {
      fetch(`/api/candidates/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${store.coordJwt}` },
        body: JSON.stringify({ stage: 'onboarding' }),
      }).catch(() => {});
    }
    store.notify({ type: 'validado', who: c.name, text: 'foi validado(a) pela coordenação — segue para onboarding' });
  }
  const schedOf = (c) => {
    const local = S.scheduling[c.id] || null;
    const api = c.scheduling || null;
    // se o local já tem chosen (candidato aceitou na mesma sessão), tem prioridade
    if (local && local.chosen != null) return { ...(api || {}), ...local };
    return api || local || null;
  };

  const cEspera = candidates.filter((c) => c.stage === 'espera').length;
  const cPratica = candidates.filter((c) => c.stage === 'pratica').length;
  const cVal = candidates.filter((c) => c.stage === 'validacao').length;
  const cAtivo = candidates.filter((c) => c.stage === 'ativo').length;
  const cContact = S.contactRequests.filter((r) => r.status === 'novo').length;

  const opsNav = [
    { id: 'contactos', label: 'Pedidos de contacto', icon: 'phone', badge: cContact },
  ];

  const ctx = { store, candidates, setSel, setSchedFor, setSlotReviewFor, setCompleteFor, validate, schedOf, setScreen, setSection, readOnly, allowedGestao, coordRole };
  const cp = store.coordProfile || {};
  const cpInit = (cp.name || 'MC').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();
  const notifs = [...S.notifs.map((n) => ({ ...n, who: n.who || (S.candidate.name || 'Novo candidato'), live: true })), ...P.SEED_NOTIFS];

  return (
    <div className="pedal-dash">
      <div className="pedal-dashhead">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src={window.__PEDAL_LOGO} alt="Pedalar Sem Idade Porto" style={{ height: 38 }} />
          <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: 14 }}>
            <div style={{ font: '800 18px var(--display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>Coordenação</div>
            <div style={{ font: '500 12px var(--ui)', color: 'var(--ink-soft)' }}>Captação & Onboarding</div>
          </div>
        </div>

        <div className="pedal-topnav">
          {allowedTabs.includes('operacao') && <button className={screen === 'operacao' ? 'on' : ''} onClick={() => setScreen('operacao')}><Icon name="route" size={15} />Operação</button>}
          {allowedTabs.includes('dashboards') && <button className={screen === 'dashboards' ? 'on' : ''} onClick={() => setScreen('dashboards')}><Icon name="sparkle" size={15} />Dashboards</button>}
          {allowedTabs.includes('gestao') && <button className={screen === 'gestao' ? 'on' : ''} onClick={() => setScreen('gestao')}><Icon name="shield" size={15} />Gestão</button>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
          <ExportMenu candidates={candidates} store={store} />
          <button className="pedal-bellbtn" onClick={() => setNotifOpen((o) => !o)} title="Notificações" aria-label="Notificações">
            <Icon name="bell" size={18} />
            {notifs.length > 0 && <span className="pedal-bellbadge">{notifs.length}</span>}
          </button>
          <div style={{ position: 'relative' }}>
            <button className="pedal-coorduser" onClick={() => setProfileOpen((o) => !o)}>
              <div className="pedal-coordav">{cpInit}</div><span>{(cp.name || 'Coordenação').split(' ')[0]} · {cp.role || 'Coordenação'}</span><Icon name="arrow" size={13} />
            </button>
            {profileOpen && <CoordProfileMenu store={store} onClose={() => setProfileOpen(false)} onOpenModal={(m) => { setProfileOpen(false); setProfileModal(m); }} />}
          </div>
          {notifOpen && <NotificationsMenu notifs={notifs} onClose={() => setNotifOpen(false)} />}
        </div>
      </div>

      {screen === 'operacao' && (
        <>
          <div className="pedal-coordnav">
            {section !== 'geral' && (
              <button className="pedal-coordtab pedal-backtab" onClick={() => setSection('geral')}>
                <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}><Icon name="arrow" size={15} /></span>Visão geral
              </button>
            )}
            {opsNav.map((n) => (
              <button key={n.id} className={'pedal-coordtab' + (section === n.id ? ' on' : '')} onClick={() => setSection(n.id)}>
                <Icon name={n.icon} size={16} />{n.label}
                {n.badge > 0 && <span className="pedal-navbadge">{n.badge}</span>}
              </button>
            ))}
          </div>
          {section === 'geral' && <OverviewSection ctx={ctx} />}
          {section === 'espera' && <WaitingList ctx={ctx} />}
          {section === 'validacao' && <ValidationList ctx={ctx} />}
          {section === 'agendamentos' && <AgendamentosSection ctx={ctx} />}
          {section === 'ativos' && <ActivePilots ctx={ctx} />}
          {section === 'contactos' && <ContactRequests ctx={ctx} />}
        </>
      )}

      {screen === 'dashboards' && <AnalyticsScreen ctx={ctx} />}
      {screen === 'gestao' && <GestaoScreen ctx={ctx} />}

      {sel && <CandidateDetail c={sel} store={store} onClose={() => setSel(null)} />}
      {schedFor && <SchedulingModal c={schedFor} store={store} onClose={() => setSchedFor(null)} />}
      {completeFor && <PracticalCompleteModal c={completeFor} store={store} onClose={() => setCompleteFor(null)} />}
      {slotReviewFor && <SlotReviewModal c={slotReviewFor} store={store} onClose={() => setSlotReviewFor(null)} />}
      {profileModal === 'edit' && <CoordEditModal store={store} onClose={() => setProfileModal(null)} />}
      {profileModal === 'pw' && <CoordPwModal store={store} onClose={() => setProfileModal(null)} />}
    </div>
  );
}

// Menu de perfil do utilizador da consola (logout, password, telefone, email)
function CoordProfileMenu({ store, onClose, onOpenModal }) {
  const cp = store.coordProfile || {};
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 55 }} onClick={onClose} />
      <div className="pedal-profilemenu">
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 }}>
          <div className="pedal-coordav" style={{ width: 40, height: 40, fontSize: 14 }}>{(cp.name || 'MC').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase()}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ font: '800 14px var(--display)', color: 'var(--ink)' }}>{cp.name}</div>
            <div style={{ font: '500 11.5px var(--ui)', color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cp.role}</div>
          </div>
        </div>
        <div className="pedal-proflist" style={{ marginBottom: 10 }}>
          <div className="pedal-profrow"><span style={{ font: '500 12.5px var(--ui)', color: 'var(--ink-soft)' }}>Email</span><span style={{ font: '700 13px var(--ui)', color: 'var(--ink)', textAlign: 'right', wordBreak: 'break-word' }}>{cp.email || '—'}</span></div>
          <div className="pedal-profrow" style={{ borderBottom: 'none' }}><span style={{ font: '500 12.5px var(--ui)', color: 'var(--ink-soft)' }}>Telefone</span><span style={{ font: '700 13px var(--ui)', color: 'var(--ink)' }}>{cp.phone || '—'}</span></div>
        </div>
        <div style={{ display: 'grid', gap: 4 }}>
          <button onClick={() => onOpenModal('edit')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, font: '700 13px var(--ui)', color: 'var(--ink)', width: '100%', textAlign: 'left' }}><Icon name="user" size={15} color="var(--primary)" />Editar telefone / email</button>
          <button onClick={() => onOpenModal('pw')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, font: '700 13px var(--ui)', color: 'var(--ink)', width: '100%', textAlign: 'left' }}><Icon name="lock" size={15} color="var(--primary)" />Mudar palavra-passe</button>
          <button onClick={() => { store.clearCoordJwt(); onClose(); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, font: '700 13px var(--ui)', color: 'var(--accent-deep)', width: '100%', textAlign: 'left', background: 'var(--accent-soft)' }}><Icon name="arrow" size={15} />Terminar sessão</button>
        </div>
      </div>
    </>
  );
}

// Bloco de confirmação de sucesso (reutilizado pelos pop-ups de perfil)
function ProfileSuccess({ title, message, onClose }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 4px 4px' }}>
      <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
        <Icon name="check" size={26} color="var(--accent-deep)" />
      </div>
      <div style={{ font: '800 17px var(--display)', color: 'var(--ink)' }}>{title}</div>
      <p style={{ font: '400 13px/1.55 var(--ui)', color: 'var(--ink-soft)', margin: '6px 0 18px' }}>{message}</p>
      <button className="pedal-btn primary" style={{ width: '100%' }} onClick={onClose}>Concluir</button>
    </div>
  );
}

// Pop-up: editar telefone / email
function CoordEditModal({ store, onClose }) {
  const cp = store.coordProfile || {};
  const [form, setForm] = useStateD({ phone: cp.phone || '', email: cp.email || '' });
  const [done, setDone] = useStateD(false);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const save = () => { if (!emailOk) return; store.setCoordProfile({ email: form.email.trim(), phone: form.phone.trim() }); setDone(true); };
  return (
    <div className="pedal-modal-wrap" onClick={onClose}>
      <div className="pedal-modal" style={{ width: 380 }} onClick={(e) => e.stopPropagation()}>
        <button className="pedal-modalclose" onClick={onClose}>✕</button>
        {done ? (
          <ProfileSuccess title="Dados atualizados" message="O teu email e telefone foram guardados com sucesso." onClose={onClose} />
        ) : (
          <>
            <div style={{ font: '800 18px var(--display)', color: 'var(--ink)', marginBottom: 4 }}>Editar contacto</div>
            <p style={{ font: '400 12.5px/1.5 var(--ui)', color: 'var(--ink-soft)', margin: '0 0 16px' }}>Atualiza o email e o telefone associados à tua conta.</p>
            <FieldLite label="Email"><input className="pedal-input" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} /></FieldLite>
            <div style={{ height: 10 }} />
            <FieldLite label="Telefone"><input className="pedal-input" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="9XX XXX XXX" /></FieldLite>
            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button className="pedal-btn ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
              <button className="pedal-btn primary" style={{ flex: 1, opacity: emailOk ? 1 : 0.45 }} disabled={!emailOk} onClick={save}>Guardar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Pop-up: mudar palavra-passe
const SUPABASE_URL_D = 'https://mamvckyoqrjhivffimob.supabase.co';
const SUPABASE_ANON_KEY_D = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hbXZja3lvcXJqaGl2ZmZpbW9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1OTUwNzIsImV4cCI6MjA5NzE3MTA3Mn0.ucPATa3CTsncwoElpF8_-XyZUgwGoBfpzQM4I9M2bMM';
function CoordPwModal({ store, onClose }) {
  const [pwCurrent, setPwCurrent] = useStateD('');
  const [pw, setPw] = useStateD('');
  const [pw2, setPw2] = useStateD('');
  const [err, setErr] = useStateD('');
  const [loading, setLoading] = useStateD(false);
  const [done, setDone] = useStateD(false);

  const save = async () => {
    if (!pwCurrent) { setErr('Introduz a palavra-passe actual.'); return; }
    if (pw.length < 4) { setErr('A nova palavra-passe deve ter pelo menos 4 caracteres.'); return; }
    if (pw !== pw2) { setErr('As palavras-passe não coincidem.'); return; }
    setLoading(true); setErr('');
    const email = (store.coordProfile || {}).email;
    try {
      // Verificar password actual
      const verifyRes = await fetch(`${SUPABASE_URL_D}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY_D },
        body: JSON.stringify({ email, password: pwCurrent }),
      });
      if (!verifyRes.ok) { setErr('Palavra-passe actual incorrecta.'); return; }
      // Actualizar para a nova password
      const updateRes = await fetch(`${SUPABASE_URL_D}/auth/v1/user`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY_D, 'Authorization': `Bearer ${store.coordJwt}` },
        body: JSON.stringify({ password: pw }),
      });
      if (!updateRes.ok) { const d = await updateRes.json(); setErr(d.message || 'Erro ao alterar palavra-passe.'); return; }
      setDone(true);
    } catch (_) { setErr('Erro de ligação ao servidor.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="pedal-modal-wrap" onClick={onClose}>
      <div className="pedal-modal" style={{ width: 380 }} onClick={(e) => e.stopPropagation()}>
        <button className="pedal-modalclose" onClick={onClose}>✕</button>
        {done ? (
          <ProfileSuccess title="Palavra-passe alterada" message="A tua palavra-passe foi atualizada com sucesso." onClose={onClose} />
        ) : (
          <>
            <div style={{ font: '800 18px var(--display)', color: 'var(--ink)', marginBottom: 4 }}>Mudar palavra-passe</div>
            <p style={{ font: '400 12.5px/1.5 var(--ui)', color: 'var(--ink-soft)', margin: '0 0 16px' }}>Escolhe uma nova palavra-passe para a tua conta.</p>
            <FieldLite label="Palavra-passe actual"><input className="pedal-input" type="password" value={pwCurrent} onChange={(e) => { setPwCurrent(e.target.value); setErr(''); }} placeholder="A tua password actual" autoFocus /></FieldLite>
            <div style={{ height: 10 }} />
            <FieldLite label="Nova palavra-passe"><input className="pedal-input" type="password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(''); }} placeholder="Mínimo 4 caracteres" /></FieldLite>
            <div style={{ height: 10 }} />
            <FieldLite label="Confirmar palavra-passe"><input className="pedal-input" type="password" value={pw2} onChange={(e) => { setPw2(e.target.value); setErr(''); }} placeholder="Repete a palavra-passe" /></FieldLite>
            {err && <div style={{ font: '600 11.5px var(--ui)', color: 'var(--primary-deep)', marginTop: 8 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button className="pedal-btn ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
              <button className="pedal-btn primary" style={{ flex: 1 }} disabled={loading} onClick={save}>{loading ? 'A guardar…' : 'Guardar'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Funil (5 estados, sem scroll) + validações + notificações ───────
function NotificationsMenu({ notifs, onClose }) {
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 55 }} onClick={onClose} />
      <div className="pedal-notifmenu">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ font: '800 14px var(--display)', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="bell" size={16} color="var(--accent-deep)" />Notificações</span>
          {notifs.length > 0 && <span className="pedal-taskbadge" style={{ background: 'var(--accent-deep)' }}>{notifs.length}</span>}
        </div>
        {notifs.length === 0 ? (
          <div className="pedal-taskempty" style={{ marginTop: 0 }}><Icon name="check" size={16} color="var(--ink-soft)" />Sem notificações por agora.</div>
        ) : (
          <div className="pedal-feed" style={{ maxHeight: 420 }}>
            {notifs.map((n, i) => {
              const meta = NOTIF_META[n.type] || NOTIF_META.qualificado;
              return (
                <div key={n.id || i} className="pedal-feedrow">
                  <div className={'pedal-feedic ' + meta.tone}><Icon name={meta.icon} size={15} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '600 12.5px/1.4 var(--ui)', color: 'var(--ink)' }}><strong style={{ fontWeight: 800 }}>{n.who}</strong> {n.text}</div>
                    <div style={{ font: '500 11px var(--ui)', color: 'var(--ink-soft)', marginTop: 2 }}>{meta.verb} · {n.live ? 'agora mesmo' : n.ago}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function OverviewSection({ ctx }) {
  const { store, candidates, setSel, setSchedFor, setCompleteFor, schedOf, setSection } = ctx;
  const S = store.S; const P = window.PEDAL;
  const inFunnel = candidates.filter((c) => P.funnelCol(c.stage));
  const metrics = [
    { label: 'No funil', value: inFunnel.length, icon: 'people', tone: 'green', section: 'geral' },
    { label: 'A validar', value: candidates.filter((c) => c.stage === 'validacao').length, icon: 'doc', tone: 'amber', section: 'validacao' },
    { label: 'Lista de espera', value: candidates.filter((c) => c.stage === 'espera').length, icon: 'clock', tone: 'amber', section: 'espera' },
    { label: 'Formação prática', value: candidates.filter((c) => c.stage === 'pratica').length, icon: 'book', tone: 'neutral', section: 'agendamentos' },
    { label: 'Pilotos ativos', value: candidates.filter((c) => c.stage === 'ativo').length, icon: 'sparkle', tone: 'green', section: 'ativos' },
  ];

  // central única de tarefas que requerem decisão manual
  const tasks = [];
  candidates.filter((c) => c.stage === 'validacao').forEach((c) => tasks.push({ key: 'val' + c.id, c, kind: 'validar', label: 'Validar candidatura', btn: 'Rever', act: () => setSel(c) }));
  candidates.filter((c) => c.stage === 'pratica').forEach((c) => {
    const sc = schedOf(c); const st = getSchedStatus(sc);
    if (!st || st === 'aguarda_candidato' || st === 'cancelado') {
      const proposed = sc && sc.slots && sc.slots.length;
      tasks.push({ key: 'sch' + c.id, c, kind: 'agendar',
        label: st === 'cancelado' ? 'Re-propor horários · sem confirmação possível' : proposed ? 'Horários propostos · aguarda resposta do candidato' : 'Propor horários da formação prática',
        btn: proposed ? 'Editar' : 'Propor', act: () => setSchedFor(c) });
    } else if (st === 'aguarda_coordenacao') {
      tasks.push({ key: 'rev' + c.id, c, kind: 'confirmar', label: 'Candidato indicou disponibilidade · confirmar ou recusar horários', btn: 'Rever', act: () => setSlotReviewFor(c) });
    } else if (st === 'confirmado') {
      const confirmedSlot = sc.slots.find((s) => s.state === 'confirmado') || (sc.chosen != null ? sc.slots[sc.chosen] : null);
      if (confirmedSlot) tasks.push({ key: 'cmp' + c.id, c, kind: 'concluir', label: `Confirmar conclusão · ${P.fmtDate(confirmedSlot.date)}`, btn: 'Concluir', act: () => setCompleteFor(c) });
    }
  });
  S.contactRequests.filter((r) => r.status === 'novo').forEach((r) => tasks.push({ key: 'ct' + r.id, name: r.name, kind: 'contacto', label: 'Dúvida do voluntário' + (r.question ? ' — “' + r.question.slice(0, 40) + (r.question.length > 40 ? '…' : '') + '”' : ''), btn: 'Responder', act: () => setSection('contactos') }));
  const kindIcon = { validar: 'doc', agendar: 'clock', confirmar: 'clock', concluir: 'check', contacto: 'chat' };
  const kindTone = { validar: 'amber', agendar: 'neutral', confirmar: 'amber', concluir: 'green', contacto: 'amber' };

  return (
    <div>
      <div className="pedal-metrics">
        {metrics.map((m) => (
          <button key={m.label} className="pedal-metric" onClick={() => setSection(m.section)}>
            <div className={'pedal-metric-ic ' + m.tone}><Icon name={m.icon} size={18} /></div>
            <div>
              <div style={{ font: '800 26px var(--display)', color: 'var(--ink)', lineHeight: 1 }}>{m.value}</div>
              <div style={{ font: '500 12px var(--ui)', color: 'var(--ink-soft)', marginTop: 3 }}>{m.label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Funil de ponta a ponta — a toda a largura */}
      <div className="pedal-panel">
        <div className="pedal-panelhead"><span style={{ font: '700 14px var(--display)', color: 'var(--ink)' }}>Funil de captação</span><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><ExportBtn rows={inFunnel} store={store} fileId="funil-processo" /></div></div>
        <div className="pedal-funnel">
          {P.FUNNEL.map((col) => {
            const list = candidates.filter((c) => P.funnelCol(c.stage) === col.id);
            return (
              <div key={col.id} className="pedal-fcol">
                <div className="pedal-kcolhead"><span>{col.label}</span><span className="pedal-kcount">{list.length}</span></div>
                <div className="pedal-kcards">
                  {list.map((c) => (
                    <button key={c.id} className={'pedal-kcard' + (c.live ? ' live' : '')} onClick={() => setSel(c)}>
                      <div className="pedal-kav">{c.initials}</div>
                      <div style={{ minWidth: 0, textAlign: 'left' }}>
                        <div style={{ font: '700 12.5px var(--ui)', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                        <div style={{ font: '500 11px var(--ui)', color: 'var(--ink-soft)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.locality}</div>
                      </div>
                      {c.live && <span className="pedal-livedot" title="Em direto" />}
                    </button>
                  ))}
                  {list.length === 0 && <div className="pedal-fempty">—</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Central de tarefas — a toda a largura */}
      <div className="pedal-panel pedal-taskpanel" style={{ marginTop: 18 }}>
        <div className="pedal-panelhead">
          <span style={{ font: '700 14px var(--display)', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>Central de tarefas{tasks.length > 0 && <span className="pedal-taskbadge">{tasks.length}</span>}</span>
          <Pill tone="amber">requer decisão</Pill>
        </div>
        {tasks.length === 0 ? (
          <div className="pedal-taskempty"><Icon name="check" size={16} color="var(--ink-soft)" />Tudo em dia — sem tarefas pendentes.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
            {tasks.map((t) => (
              <div key={t.key} className="pedal-taskrow">
                <div className={'pedal-feedic ' + (kindTone[t.kind] || 'neutral')} style={{ width: 36, height: 36 }}><Icon name={kindIcon[t.kind] || 'doc'} size={15} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '700 13px var(--ui)', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>{(t.c && t.c.name) || t.name}{t.c && t.c.live && <span className="pedal-livedot" style={{ position: 'static', margin: 0 }} />}</div>
                  <div style={{ font: '500 11.5px var(--ui)', color: 'var(--ink-soft)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.label}</div>
                </div>
                <button className="pedal-taskbtn primary" onClick={t.act}>{t.btn}</button>
              </div>
            ))}
          </div>
        )}
        <p className="pedal-tasknote">Validação, agendamento, conclusão e pedidos de contacto — tudo o que precisa de decisão humana, num só lugar.</p>
      </div>
    </div>
  );
}

// ── Lista de validação (candidatos a aguardar decisão) ──────────────
function ValidationList({ ctx }) {
  const { candidates, setSel, store } = ctx;
  const P = window.PEDAL;
  const list = candidates.filter((c) => c.stage === 'validacao');
  return (
    <div className="pedal-panel">
      <div className="pedal-panelhead">
        <span style={{ font: '700 15px var(--display)', color: 'var(--ink)' }}>Validação</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Pill tone="amber">{list.length} a aguardar</Pill>
          <ExportBtn rows={list} store={store} fileId="validacao" />
        </div>
      </div>
      {list.length === 0 ? (
        <div className="pedal-taskempty"><Icon name="check" size={16} color="var(--ink-soft)" />Nada a aguardar validação.</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {list.map((c) => (
            <button key={c.id} className="pedal-listrow" onClick={() => setSel(c)}>
              <div className="pedal-kav">{c.initials}</div>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ font: '700 13.5px var(--ui)', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>{c.name}{c.live && <span className="pedal-livedot" style={{ position: 'static', margin: 0 }} />}</div>
                <div style={{ font: '500 11.5px var(--ui)', color: 'var(--ink-soft)' }}>{c.locality} · via {c.source}</div>
              </div>
              <span className="pedal-taskbtn">Rever</span>
            </button>
          ))}
        </div>
      )}
      <p className="pedal-tasknote">Abre o candidato para ver a entrevista, validar ou rejeitar.</p>
    </div>
  );
}

// ── Lista de espera com filtros (região, período, dia da semana) ────
function WaitingList({ ctx }) {
  const { candidates, setSel, store, readOnly } = ctx;
  const P = window.PEDAL;
  const [reg, setReg] = useStateD('todas');
  const [per, setPer] = useStateD([]);
  const [wd, setWd] = useStateD([]);
  const [sel, setSel2] = useStateD(new Set());
  const toggle = (arr, set, id) => set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  const isLiveCandidate = (c) => c.live || c.id === store.S.candidateId;

  let list = candidates.filter((c) => c.stage === 'espera');
  if (reg !== 'todas') list = list.filter((c) => c.localityId === reg);
  if (per.length) list = list.filter((c) => (c.periods || []).some((p) => per.includes(p)));
  if (wd.length) list = list.filter((c) => (c.weekdays || []).some((d) => wd.includes(d)));
  const regsWith = [...new Set(candidates.filter((c) => c.stage === 'espera').map((c) => c.localityId))];

  const toggleSel = (id) => setSel2((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allChecked = list.length > 0 && list.every((c) => sel.has(c.id));
  const someChecked = list.some((c) => sel.has(c.id));
  const toggleAll = () => setSel2(allChecked ? new Set() : new Set(list.map((c) => c.id)));

  const resumeOne = (c) => {
    if (isLiveCandidate(c)) { store.up({ waitingListResumed: true }); store.setStage('validacao'); }
    else { store.setOverride(c.id, 'validacao'); }
    store.patchRealCandidate(c.id, { stage: 'validacao' });
    if (!isLiveCandidate(c) && store.coordJwt) {
      fetch(`/api/candidates/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${store.coordJwt}` },
        body: JSON.stringify({ stage: 'validacao' }),
      }).catch(() => {});
    }
    store.notify({ type: 'retomado', who: c.name, text: 'foi retomado(a) da lista de espera — aguarda validação' });
    setSel(null);
  };

  const resumeSelected = () => {
    list.filter((c) => sel.has(c.id)).forEach((c) => resumeOne(c));
    setSel2(new Set());
  };

  return (
    <div className="pedal-panel">
      <div className="pedal-panelhead">
        <span style={{ font: '700 15px var(--display)', color: 'var(--ink)' }}>Lista de espera</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Pill tone="amber">{list.length} de {candidates.filter((c) => c.stage === 'espera').length}</Pill>
          <ExportBtn rows={list} store={store} fileId="lista-espera" />
        </div>
      </div>

      <div className="pedal-filters">
        <div className="pedal-filterrow">
          <span className="pedal-filterlbl">Região</span>
          <select className="pedal-select" value={reg} onChange={(e) => setReg(e.target.value)}>
            <option value="todas">Todas as regiões</option>
            {P.LOCALITIES.filter((l) => regsWith.includes(l.id)).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div className="pedal-filterrow">
          <span className="pedal-filterlbl">Período</span>
          <div className="pedal-pickgrid">
            {P.PERIODS.map((p) => <button key={p.id} className={'pedal-pick small' + (per.includes(p.id) ? ' on' : '')} onClick={() => toggle(per, setPer, p.id)}>{p.name}</button>)}
          </div>
        </div>
        <div className="pedal-filterrow">
          <span className="pedal-filterlbl">Dia da semana</span>
          <div className="pedal-pickgrid">
            {P.WEEKDAYS.map((d) => <button key={d.id} className={'pedal-pick small' + (wd.includes(d.id) ? ' on' : '')} onClick={() => toggle(wd, setWd, d.id)}>{d.name}</button>)}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 28 }}>
          {(reg !== 'todas' || per.length || wd.length) ? (
            <button className="pedal-clearfilter" style={{ margin: 0 }} onClick={() => { setReg('todas'); setPer([]); setWd([]); }}>Limpar filtros</button>
          ) : <span />}
          {!readOnly && sel.size > 0 && (
            <button className="pedal-taskbtn" style={{ borderColor: 'var(--primary)', color: 'var(--primary-deep)' }} onClick={resumeSelected}>
              Retomar selecionados ({sel.size})
            </button>
          )}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="pedal-taskempty" style={{ marginTop: 14 }}><Icon name="clock" size={16} color="var(--ink-soft)" />Ninguém corresponde a estes filtros.</div>
      ) : (
        <>
          {!readOnly && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0 2px', borderBottom: '1px solid var(--line)', marginBottom: 4 }}>
              <input type="checkbox" checked={allChecked} ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked; }} onChange={toggleAll}
                style={{ width: 15, height: 15, accentColor: 'var(--primary)', cursor: 'pointer', flexShrink: 0 }} />
              <span style={{ font: '500 11.5px var(--ui)', color: 'var(--ink-soft)', cursor: 'pointer' }} onClick={toggleAll}>
                {allChecked ? 'Desseleccionar todos' : 'Seleccionar todos'}
              </span>
            </div>
          )}
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {list.map((c) => {
              const weekdays = (c.weekdays || []).map((d) => (P.WEEKDAYS.find((x) => x.id === d) || {}).name).join(' ');
              const perLabel = (c.periods || []).map((p) => (P.PERIODS.find((x) => x.id === p) || {}).name).join(', ') || '—';
              const checked = sel.has(c.id);
              return (
                <div key={c.id} className="pedal-listrow" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'default', background: checked ? 'var(--primary-soft)' : undefined, borderRadius: checked ? 8 : undefined, transition: 'background .15s' }}>
                  {!readOnly && (
                    <input type="checkbox" checked={checked} onChange={() => toggleSel(c.id)}
                      style={{ width: 15, height: 15, accentColor: 'var(--primary)', cursor: 'pointer', flexShrink: 0 }} />
                  )}
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
                  {!readOnly && sel.size === 0 && <button className="pedal-taskbtn" onClick={() => resumeOne(c)}>Retomar</button>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Formação prática (agendamentos) ─────────────────────────────────
function AgendamentosSection({ ctx }) {
  const { candidates, setSel, setSchedFor, setSlotReviewFor, setCompleteFor, schedOf, store } = ctx;
  const P = window.PEDAL;
  const trainerOf = (id) => (store.realTrainers || []).find((t) => t.id === id) || null;
  const stationOf = (id) => (store.realStations || []).find((s) => s.id === id) || null;
  const list = candidates.filter((c) => c.stage === 'pratica');
  const toAgendar = list.filter((c) => { const st = getSchedStatus(schedOf(c)); return !st || st === 'aguarda_candidato' || st === 'cancelado'; });
  const awaitingCoord = list.filter((c) => getSchedStatus(schedOf(c)) === 'aguarda_coordenacao');
  const agendados = list.filter((c) => getSchedStatus(schedOf(c)) === 'confirmado');
  const aFormalizar = candidates.filter((c) => c.stage === 'formalizacao');

  const planning = [...agendados].sort((a, b) => {
    const sa = schedOf(a), sb = schedOf(b);
    const da = sa.slots.find((s) => s.state === 'confirmado') || (sa.chosen != null ? sa.slots[sa.chosen] : sa.slots[0]);
    const db = sb.slots.find((s) => s.state === 'confirmado') || (sb.chosen != null ? sb.slots[sb.chosen] : sb.slots[0]);
    const ta = da.startTime || da.time || ''; const tb = db.startTime || db.time || '';
    return (da.date + ta).localeCompare(db.date + tb);
  });

  return (
    <div>
      {aFormalizar.length > 0 && (
        <div className="pedal-panel" style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div className="pedal-feedic green" style={{ width: 38, height: 38 }}><Icon name="check" size={18} /></div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ font: '700 13.5px var(--ui)', color: 'var(--ink)' }}>{aFormalizar.length} piloto{aFormalizar.length > 1 ? 's' : ''} a formalizar</div>
            <div style={{ font: '500 12px var(--ui)', color: 'var(--ink-soft)' }}>Concluíram a formação prática — aguardam aceitar os termos e assinar na app.</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {aFormalizar.map((c) => (
              <button key={c.id} className="pedal-pick small" onClick={() => setSel(c)}>{c.name}{c.live ? ' · em direto' : ''}</button>
            ))}
          </div>
        </div>
      )}

      {/* A propor — compacto */}
      <div className="pedal-panel pedal-taskpanel" style={{ marginBottom: 18 }}>
        <div className="pedal-panelhead">
          <span style={{ font: '700 14px var(--display)', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>A propor horários{toAgendar.length > 0 && <span className="pedal-taskbadge">{toAgendar.length}</span>}</span>
          <Pill tone="neutral">passo seguinte</Pill>
        </div>
        {toAgendar.length === 0 ? (
          <div className="pedal-taskempty"><Icon name="check" size={16} color="var(--ink-soft)" />Sem agendamentos por propor — toda a gente está com horário.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {toAgendar.map((c) => {
              const sc = schedOf(c); const proposed = sc && sc.slots && sc.slots.length;
              const tr = sc && trainerOf(sc.trainerId);
              return (
                <div key={c.id} className="pedal-taskrow">
                  <button className="pedal-kav" onClick={() => setSel(c)} title="Ver perfil">{c.initials}</button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '700 13px var(--ui)', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>{c.name}{c.live && <span className="pedal-livedot" style={{ position: 'static', margin: 0 }} />}</div>
                    {proposed ? <div style={{ font: '600 11.5px var(--ui)', color: 'var(--accent-deep)' }}>{sc.slots.length} horário{sc.slots.length > 1 ? 's' : ''} propostos · aguarda resposta</div>
                      : <div style={{ font: '500 11.5px var(--ui)', color: 'var(--ink-soft)' }}>{c.locality} · sem horário</div>}
                    {tr
                      ? <div style={{ font: '600 11px var(--ui)', color: 'var(--ink-soft)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="shield" size={11} color="var(--accent-deep)" />{tr.name}</div>
                      : <div style={{ font: '600 11px var(--ui)', color: 'var(--accent-deep)', marginTop: 1 }}>coach por atribuir</div>}
                  </div>
                  <button className="pedal-taskbtn" onClick={() => setSchedFor(c)}>{proposed ? 'Editar' : 'Propor'}</button>
                </div>
              );
            })}
          </div>
        )}
        <p className="pedal-tasknote">Propõe até 3 alternativas de data e hora. O voluntário seleciona os que lhe servem — depois confirmas aqui.</p>
      </div>

      {/* Aguarda confirmação da coordenação */}
      {awaitingCoord.length > 0 && (
        <div className="pedal-panel pedal-taskpanel" style={{ marginBottom: 18 }}>
          <div className="pedal-panelhead">
            <span style={{ font: '700 14px var(--display)', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
              Horários a confirmar<span className="pedal-taskbadge">{awaitingCoord.length}</span>
            </span>
            <Pill tone="amber">requer decisão</Pill>
          </div>
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {awaitingCoord.map((c) => {
              const sc = schedOf(c);
              const selCount = sc ? sc.slots.filter((s) => s.state === 'selecionado').length : 0;
              return (
                <div key={c.id} className="pedal-taskrow">
                  <button className="pedal-kav" onClick={() => setSel(c)} title="Ver perfil">{c.initials}</button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '700 13px var(--ui)', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>{c.name}{c.live && <span className="pedal-livedot" style={{ position: 'static', margin: 0 }} />}</div>
                    <div style={{ font: '600 11.5px var(--ui)', color: 'var(--accent-deep)' }}>{selCount} horário{selCount !== 1 ? 's' : ''} selecionado{selCount !== 1 ? 's' : ''} · aguarda confirmação</div>
                  </div>
                  <button className="pedal-taskbtn primary" onClick={() => setSlotReviewFor(c)}>Rever</button>
                </div>
              );
            })}
          </div>
          <p className="pedal-tasknote">O voluntário indicou os horários que lhe servem. Confirma um (quando tiveres grupo) ou recusa com justificação.</p>
        </div>
      )}

      {/* Planeamento confirmado */}
      <div className="pedal-panel">
        <div className="pedal-panelhead">
          <span style={{ font: '700 15px var(--display)', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="clock" size={16} color="var(--primary)" />
            Planeamento da formação prática
            {planning.length > 0 && <span className="pedal-taskbadge">{planning.length}</span>}
          </span>
          <Pill tone="green">horário confirmado</Pill>
        </div>
        {planning.length === 0 ? (
          <div className="pedal-taskempty"><Icon name="clock" size={16} color="var(--ink-soft)" />Ainda sem formações marcadas. Aparece aqui quando confirmas um horário.</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {planning.map((c) => {
              const sc = schedOf(c);
              const slot = sc.slots.find((s) => s.state === 'confirmado') || (sc.chosen != null ? sc.slots[sc.chosen] : null);
              const tr = trainerOf(sc.trainerId);
              const stn = stationOf(sc.stationId);
              if (!slot) return null;
              return (
                <PlanningRow
                  key={c.id}
                  c={c}
                  slot={slot}
                  trainer={tr}
                  station={stn}
                  notes={sc.notes || ''}
                  onEdit={() => setSchedFor(c)}
                  onReview={() => setSlotReviewFor(c)}
                  onComplete={() => setCompleteFor(c)}
                  onSaveNotes={(notes) => store.setScheduling(c.id, { notes })}
                  onSeeProfile={() => setSel(c)}
                />
              );
            })}
          </div>
        )}
        <p className="pedal-tasknote">Lista única ordenada pela data mais próxima. Depois da sessão, confirma a conclusão para avançar o voluntário.</p>
      </div>
    </div>
  );
}

// uma linha do planeamento confirmado — densa em informação mas legível
function PlanningRow({ c, slot, trainer, station, notes, onEdit, onReview, onComplete, onSaveNotes, onSeeProfile }) {
  const P = window.PEDAL;
  const [n, setN] = useStateD(notes);
  const [editing, setEditing] = useStateD(false);
  const dirty = n !== notes;
  const day = new Date(slot.date);
  const wd = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][day.getDay()];
  const timeStart = slot.startTime || slot.time || '';
  const timeEnd = slot.endTime || '';
  const timeDisplay = timeEnd ? `${timeStart}–${timeEnd}` : timeStart;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr auto', gap: 18, alignItems: 'stretch', background: 'var(--app-bg)', border: '1px solid var(--line)', borderRadius: 14, padding: 14 }}>
      {/* Coluna 1: cápsula de data destacada */}
      <div style={{ background: 'var(--primary-soft)', borderRadius: 12, padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--primary-soft)' }}>
        <div style={{ font: '700 10.5px var(--ui)', color: 'var(--primary-deep)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{wd}</div>
        <div style={{ font: '800 22px var(--display)', color: 'var(--primary-deep)', lineHeight: 1 }}>{String(day.getDate()).padStart(2, '0')}</div>
        <div style={{ font: '600 10.5px var(--ui)', color: 'var(--primary-deep)' }}>{['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][day.getMonth()]}</div>
        <div style={{ marginTop: 6, padding: '3px 8px', background: 'var(--surface)', borderRadius: 99, font: '800 11.5px var(--ui)', color: 'var(--primary-deep)' }}>{timeDisplay}</div>
      </div>

      {/* Coluna 2: identidade, local, coach e notas */}
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <button className="pedal-kav" onClick={onSeeProfile} title="Ver perfil" style={{ cursor: 'pointer' }}>{c.initials}</button>
          <div style={{ minWidth: 0 }}>
            <div style={{ font: '700 14.5px var(--ui)', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>{c.name}{c.live && <span className="pedal-livedot" style={{ position: 'static', margin: 0 }} />}</div>
            <div style={{ font: '500 11.5px var(--ui)', color: 'var(--ink-soft)' }}>{c.locality}{c.contact ? ' · ' + c.contact : ''}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 10px' }}>
            <Icon name="pin" size={14} color="var(--primary)" />
            <div style={{ minWidth: 0 }}>
              <div style={{ font: '700 11.5px var(--ui)', color: 'var(--ink)' }}>{station ? station.name : <em style={{ color: 'var(--accent-deep)', fontStyle: 'normal' }}>Local por atribuir</em>}</div>
              {station && station.address && <div style={{ font: '500 11px var(--ui)', color: 'var(--ink-soft)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{station.address}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 10px' }}>
            <Icon name="shield" size={14} color="var(--accent-deep)" />
            <div style={{ minWidth: 0 }}>
              <div style={{ font: '700 11.5px var(--ui)', color: 'var(--ink)' }}>{trainer ? trainer.name : <em style={{ color: 'var(--accent-deep)', fontStyle: 'normal' }}>Coach por atribuir</em>}</div>
              <div style={{ font: '500 11px var(--ui)', color: 'var(--ink-soft)' }}>{trainer ? `Coach${trainer.locality ? ' · ' + trainer.locality : ''}` : 'Atribui em "Editar"'}</div>
            </div>
          </div>
        </div>

        {/* Notas / comentários */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Icon name="chat" size={12} color="var(--ink-soft)" />
            <span style={{ font: '700 11px var(--ui)', letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Comentários da coordenação</span>
            {!editing && !n && <button className="pedal-authlink" onClick={() => setEditing(true)} style={{ marginLeft: 'auto', fontSize: 11.5 }}>Adicionar nota</button>}
            {!editing && n && <button className="pedal-authlink" onClick={() => setEditing(true)} style={{ marginLeft: 'auto', fontSize: 11.5 }}>Editar nota</button>}
          </div>
          {editing ? (
            <div>
              <textarea className="pedal-agentinfo" value={n} onChange={(e) => setN(e.target.value)} placeholder="Notas operacionais — ex.: o piloto pediu para chegar 10 min mais cedo, o coach Manuel vai trazer o triciclo grande." autoFocus style={{ background: 'var(--surface)', minHeight: 64, fontSize: 12.5 }} />
              <div style={{ display: 'flex', gap: 7, marginTop: 6, justifyContent: 'flex-end' }}>
                <button className="pedal-taskbtn" onClick={() => { setN(notes); setEditing(false); }}>Cancelar</button>
                <button className="pedal-taskbtn primary" disabled={!dirty} style={{ opacity: dirty ? 1 : 0.5 }} onClick={() => { onSaveNotes(n.trim()); setEditing(false); }}>Guardar nota</button>
              </div>
            </div>
          ) : (
            <div style={{ font: '500 12.5px/1.5 var(--ui)', color: n ? 'var(--ink)' : 'var(--ink-soft)', background: 'var(--surface)', border: '1px dashed var(--line)', borderRadius: 10, padding: '8px 11px', minHeight: 30, whiteSpace: 'pre-wrap' }}>
              {n || 'Sem comentários. Toca em "Adicionar nota" para registar algo que o coach deva saber.'}
            </div>
          )}
        </div>
      </div>

      {/* Coluna 3: ações */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center', minWidth: 130 }}>
        <button className="pedal-taskbtn primary" onClick={onComplete}><Icon name="check" size={14} color="#fff" />Concluir</button>
        <button className="pedal-taskbtn" onClick={onEdit}>Editar plano</button>
        {onReview && <button className="pedal-taskbtn" style={{ color: 'var(--accent-deep)', borderColor: 'var(--accent)' }} onClick={onReview}>Cancelar horário</button>}
      </div>
    </div>
  );
}

// ── Pilotos ativos com ordenação ────────────────────────────────────
function ActivePilots({ ctx }) {
  const { candidates, setSel, store } = ctx;
  const P = window.PEDAL;
  const [sort, setSort] = useStateD('nome');
  let list = candidates.filter((c) => c.stage === 'ativo');
  const sorters = {
    nome: (a, b) => a.name.localeCompare(b.name),
    localidade: (a, b) => (a.locality || '').localeCompare(b.locality || ''),
    recente: (a, b) => (b.since || '').localeCompare(a.since || ''),
    antiguidade: (a, b) => (b.days || 0) - (a.days || 0),
  };
  list = [...list].sort(sorters[sort]);
  return (
    <div className="pedal-panel">
      <div className="pedal-panelhead">
        <span style={{ font: '700 15px var(--display)', color: 'var(--ink)' }}>Pilotos ativos</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ font: '500 12px var(--ui)', color: 'var(--ink-soft)' }}>Ordenar por</span>
          <select className="pedal-select" style={{ width: 'auto', minWidth: 130 }} value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="nome">Nome</option>
            <option value="localidade">Localidade</option>
            <option value="recente">Mais recente</option>
            <option value="antiguidade">Antiguidade</option>
          </select>
          <ExportBtn rows={list} store={store} fileId="pilotos-ativos" />
        </div>
      </div>
      {list.length === 0 ? (
        <div className="pedal-taskempty"><Icon name="people" size={16} color="var(--ink-soft)" />Sem pilotos ativos.</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {list.map((c) => (
            <button key={c.id} className="pedal-listrow" onClick={() => setSel(c)}>
              <div className="pedal-kav" style={{ background: 'var(--primary-soft)', color: 'var(--primary-deep)' }}>{c.initials}</div>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ font: '700 13.5px var(--ui)', color: 'var(--ink)' }}>{c.name}</div>
                <div style={{ font: '500 11.5px var(--ui)', color: 'var(--ink-soft)' }}>{c.locality} · via {c.source}</div>
              </div>
              <Pill tone="green"><span className="pedal-livedot" style={{ position: 'static', background: '#3DBA6B' }} />ativo</Pill>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Exportação (Excel/CSV) ──────────────────────────────────────────
function exportCandidates(rows, store, fileId) {
  const P = window.PEDAL;
  const cols = ['Nome', 'Email', 'Telefone', 'Data de nascimento', 'CC', 'NIF', 'Profissão', 'Localidade', 'Estado', 'Disponibilidade', 'Data de contacto', 'Agendamento formação', 'Formador', 'Origem'];
  const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const lines = [cols.join(';')];
  rows.forEach((c) => {
    const sc = c.scheduling || store.S.scheduling[c.id] || null;
    const ag = sc && sc.chosen != null && sc.slots && sc.slots[sc.chosen] ? `${P.fmtDate(sc.slots[sc.chosen].date)} ${sc.slots[sc.chosen].time}` : '';
    const trainer = sc && sc.trainerId ? ((store.realTrainers || []).find((t) => t.id === sc.trainerId) || {}).name || '' : '';
    // disponibilidade: usa availability (dia+período) se disponível, senão periods
    const avail = Array.isArray(c.availability) && c.availability.length
      ? c.availability.map((a) => {
          const dName = (P.WEEKDAYS.find((x) => x.id === a.day) || {}).name || a.day;
          const pName = (P.PERIODS.find((x) => x.id === a.period) || {}).name || a.period;
          return `${dName} ${pName.toLowerCase()}`;
        }).join(', ')
      : (c.periods || []).map((p) => (P.PERIODS.find((x) => x.id === p) || {}).name || p).join(', ');
    const locality = c.locality === '—' ? '' : (c.locality || '');
    lines.push([c.name, c.email, c.contact, c.dob, c.cc, c.nif, c.profissao, locality, P.stageLabel(c.stage), avail, c.contactDate, ag, trainer, c.source].map(esc).join(';'));
  });
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `pedal-${fileId}.csv`; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// botão de exportação por secção (respeita o filtro atual da secção)
function ExportBtn({ rows, store, fileId, label }) {
  return (
    <button className="pedal-exportbtn small" onClick={() => exportCandidates(rows, store, fileId)} title="Exportar para Excel">
      <Icon name="doc" size={14} />{label || `Exportar (${rows.length})`}
    </button>
  );
}

// menu do topo: apenas o que não tem secção própria no ecrã principal
function ExportMenu({ candidates, store }) {
  const [open, setOpen] = useStateD(false);
  const groups = [
    { id: 'todos', label: 'Todos os voluntários', rows: candidates },
    { id: 'inscricao', label: 'Em processo de inscrição', rows: candidates.filter((c) => !['ativo', 'rejeitado'].includes(c.stage)) },
    { id: 'rejeitados', label: 'Candidatos rejeitados', rows: candidates.filter((c) => c.stage === 'rejeitado') },
  ];
  return (
    <div style={{ position: 'relative' }}>
      <button className="pedal-exportbtn" onClick={() => setOpen((o) => !o)}><Icon name="doc" size={15} />Exportar base de dados<Icon name="arrow" size={13} /></button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div className="pedal-exportmenu">
            <div className="pedal-exporthint">Cada secção exporta a sua própria lista (com filtros). Aqui ficam só as gerais:</div>
            {groups.map((g) => (
              <button key={g.id} className="pedal-exportitem" onClick={() => { exportCandidates(g.rows, store, g.id); setOpen(false); }}>
                <span>{g.label}</span><span className="pedal-exportcount">{g.rows.length}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Pedidos de contacto (encaminhamento PEDAL → humano) ─────────────
function ContactRequests({ ctx }) {
  const { store } = ctx;
  const reqs = store.S.contactRequests;
  const novos = reqs.filter((r) => r.status === 'novo');
  const ordered = [...novos, ...reqs.filter((r) => r.status !== 'novo')];
  const [openReply, setOpenReply] = useStateD(null);
  const [draft, setDraft] = useStateD('');
  const openFor = (id) => { setOpenReply(id); setDraft(''); };
  const send = (id) => { const t = draft.trim(); if (t.length < 2) return; store.answerContactRequest(id, t, store.coordProfile && store.coordProfile.name); setOpenReply(null); setDraft(''); };
  return (
    <div className="pedal-panel">
      <div className="pedal-panelhead">
        <span style={{ font: '700 15px var(--display)', color: 'var(--ink)' }}>Pedidos de contacto</span>
        <Pill tone="amber">{novos.length} por tratar</Pill>
      </div>
      {reqs.length === 0 ? (
        <div className="pedal-taskempty"><Icon name="check" size={16} color="var(--ink-soft)" />Sem pedidos de contacto.</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {ordered.map((r) => {
            const replying = openReply === r.id;
            return (
            <div key={r.id} className={'pedal-contactcard' + (r.status === 'resolvido' ? ' done' : '')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className={'pedal-feedic ' + (r.status === 'novo' ? 'amber' : 'green')}><Icon name={r.status === 'novo' ? 'chat' : 'check'} size={15} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '700 14px var(--ui)', color: 'var(--ink)' }}>{r.name || 'Voluntário'}</div>
                  <div style={{ font: '500 11.5px var(--ui)', color: 'var(--ink-soft)' }}>{r.ago}</div>
                </div>
                {r.status === 'novo' ? <Pill tone="amber">novo</Pill> : <Pill tone="green">resolvido</Pill>}
              </div>
              <div className="pedal-contactq"><span style={{ font: '700 10.5px var(--ui)', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Dúvida do voluntário</span>
                {r.moduleTitle && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, padding: '4px 10px', borderRadius: 99, background: 'var(--primary-soft)', color: 'var(--primary-deep)', font: '700 11px var(--ui)' }}>
                    <Icon name="book" size={12} color="var(--primary-deep)" />
                    Módulo de formação · {r.moduleTitle}
                  </div>
                )}
                <div style={{ font: '500 13px/1.5 var(--ui)', color: 'var(--ink)', marginTop: 4 }}>“{r.question}”</div>
              </div>
              {r.answer && (
                <div className="pedal-contactq" style={{ background: 'var(--accent-soft)', marginTop: 8 }}>
                  <span style={{ font: '700 10.5px var(--ui)', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent-deep)' }}>Resposta enviada{r.answeredBy ? ` · ${r.answeredBy}` : ''}</span>
                  <div style={{ font: '500 13px/1.5 var(--ui)', color: 'var(--ink)', marginTop: 4 }}>{r.answer}</div>
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 10 }}>
                {r.contact && <span style={{ display: 'flex', alignItems: 'center', gap: 6, font: '600 12.5px var(--ui)', color: 'var(--ink)' }}><Icon name="phone" size={14} color="var(--primary)" />{r.contact}</span>}
                {r.email && <span style={{ display: 'flex', alignItems: 'center', gap: 6, font: '600 12.5px var(--ui)', color: 'var(--ink)' }}><Icon name="doc" size={14} color="var(--primary)" />{r.email}</span>}
              </div>
              {r.status === 'novo' && !replying && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <button className="pedal-taskbtn primary" onClick={() => openFor(r.id)}>Responder no chat <Icon name="send" size={14} color="#fff" /></button>
                  <button className="pedal-taskbtn" onClick={() => store.resolveContact(r.id)}>Marcar como resolvido</button>
                </div>
              )}
              {r.status === 'novo' && replying && (
                <div style={{ marginTop: 12, background: 'var(--app-bg)', border: '1px solid var(--line)', borderRadius: 13, padding: 12 }}>
                  <div style={{ font: '700 11px var(--ui)', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 6 }}>Resposta {r.live ? (r.moduleId ? `\u2014 aparece no Q&A do m\u00f3dulo \u00ab${r.moduleTitle}\u00bb` : '\u2014 vai aparecer no chat do volunt\u00e1rio') : '\u2014 pedido sem chat ativo'}</div>
                  <textarea className="pedal-agentinfo" value={draft} onChange={(e) => setDraft(e.target.value)}
                    placeholder="Escreve a resposta com clareza e empatia. O voluntário vê-a no chat, com o teu nome."
                    style={{ background: 'var(--surface)', minHeight: 88 }} autoFocus />
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button className="pedal-taskbtn" onClick={() => { setOpenReply(null); setDraft(''); }}>Cancelar</button>
                    <button className="pedal-taskbtn primary" disabled={draft.trim().length < 2} style={{ opacity: draft.trim().length < 2 ? 0.5 : 1 }} onClick={() => send(r.id)}>Enviar resposta <Icon name="send" size={14} color="#fff" /></button>
                  </div>
                </div>
              )}
            </div>
          );})}
        </div>
      )}
      <p className="pedal-tasknote">As dúvidas chegam aqui sempre que o PEDAL não consegue responder. A tua resposta aparece no chat do voluntário com o teu nome.</p>
    </div>
  );
}

// ── Gestão de formadores ────────────────────────────────────────────
function TrainersAdmin({ ctx }) {
  const { store } = ctx;
  const P = window.PEDAL;
  const trainers = store.realTrainers || [];
  const [openT, setOpenT] = useStateD(null);
  const [f, setF] = useStateD({ name: '', dob: '', phone: '', email: '', locality: '' });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim());
  const activePilot = emailOk && store.realCandidates ? store.realCandidates.find((c) => c.email === f.email.trim() && c.stage === 'ativo') : null;
  const emailError = emailOk && store.realCandidates && !activePilot ? 'Este email não corresponde a nenhum piloto ativo no sistema.' : null;
  const onEmailChange = (v) => {
    const pilot = store.realCandidates && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? store.realCandidates.find((c) => c.email === v.trim() && c.stage === 'ativo') : null;
    setF((p) => ({ ...p, email: v, name: pilot ? pilot.name : p.name, phone: pilot ? pilot.contact : p.phone, dob: pilot ? (pilot.dob || '') : p.dob }));
  };
  const valid = f.name.trim().length > 1 && f.dob && f.phone.trim().length > 6 && emailOk && !emailError;
  const submit = () => { if (!valid) return; store.addTrainer({ name: f.name.trim(), dob: f.dob, phone: f.phone.trim(), email: f.email.trim(), locality: f.locality.trim() }); setF({ name: '', dob: '', phone: '', email: '', locality: '' }); };
  return (
    <div className="pedal-dashgrid">
      <div className="pedal-panel">
        <div className="pedal-panelhead"><span style={{ font: '700 15px var(--display)', color: 'var(--ink)' }}>Pilotos formadores</span><Pill tone="neutral">{trainers.length}</Pill></div>
        {trainers.length === 0 ? (
          <div className="pedal-taskempty"><Icon name="people" size={16} color="var(--ink-soft)" />Ainda sem formadores.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {trainers.map((t) => {
              const age = t.dob ? Math.floor((Date.now() - new Date(t.dob).getTime()) / 3.15576e10) : null;
              const open = openT === t.id;
              const assigned = Object.values(store.S.scheduling || {}).filter((sc) => sc && sc.trainerId === t.id).length;
              return (
                <div key={t.id}>
                  <div className="pedal-taskrow" style={open ? { borderColor: 'var(--primary)' } : null}>
                    <button className="pedal-kav" style={{ background: 'var(--accent-soft)', color: 'var(--accent-deep)' }} onClick={() => setOpenT(open ? null : t.id)}>{t.name.split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase()}</button>
                    <button style={{ flex: 1, minWidth: 0, textAlign: 'left' }} onClick={() => setOpenT(open ? null : t.id)}>
                      <div style={{ font: '700 13.5px var(--ui)', color: 'var(--ink)' }}>{t.name}{t.locality ? <span style={{ font: '500 11.5px var(--ui)', color: 'var(--ink-soft)' }}> · {t.locality}</span> : ''}</div>
                      <div style={{ font: '500 11.5px var(--ui)', color: 'var(--ink-soft)' }}>{t.email}{t.phone ? ` · ${t.phone}` : ''}{age != null ? ` · ${age} anos` : ''}</div>
                    </button>
                    <button className="pedal-iconbtn" title="Remover" onClick={() => store.removeTrainer(t.id)}>✕</button>
                  </div>
                  {open && (
                    <div className="pedal-detailbox">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 }}>
                        <div className="pedal-kav big" style={{ background: 'var(--accent-soft)', color: 'var(--accent-deep)' }}>{t.name.split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase()}</div>
                        <div>
                          <div style={{ font: '800 16px var(--display)', color: 'var(--ink)' }}>{t.name}</div>
                          <div style={{ font: '500 12px var(--ui)', color: 'var(--ink-soft)' }}>Coach de território · {t.locality || 'sem zona'}</div>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gap: 7 }}>
                        <div className="pedal-ivrow"><span style={{ color: 'var(--ink-soft)' }}>Data de nascimento</span><span style={{ fontWeight: 700, color: 'var(--ink)' }}>{t.dob ? `${P.fmtDate(t.dob)}${age != null ? ` · ${age} anos` : ''}` : '—'}</span></div>
                        <div className="pedal-ivrow"><span style={{ color: 'var(--ink-soft)' }}>Email</span><span style={{ fontWeight: 700, color: 'var(--ink)' }}>{t.email || '—'}</span></div>
                        <div className="pedal-ivrow"><span style={{ color: 'var(--ink-soft)' }}>Telefone</span><span style={{ fontWeight: 700, color: 'var(--ink)' }}>{t.phone || '—'}</span></div>
                        <div className="pedal-ivrow"><span style={{ color: 'var(--ink-soft)' }}>Território</span><span style={{ fontWeight: 700, color: 'var(--ink)' }}>{t.locality || '—'}</span></div>
                        <div className="pedal-ivrow"><span style={{ color: 'var(--ink-soft)' }}>Pilotos atribuídos</span><span style={{ fontWeight: 700, color: 'var(--ink)' }}>{assigned}</span></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="pedal-panel">
        <div className="pedal-panelhead"><span style={{ font: '700 15px var(--display)', color: 'var(--ink)' }}>Adicionar formador</span></div>
        <div style={{ display: 'grid', gap: 10 }}>
          <FieldLite label="Email">
            <input className="pedal-input" type="email" value={f.email} onChange={(e) => onEmailChange(e.target.value)} placeholder="nome@pedalarsemidade.pt" style={emailError ? { borderColor: 'var(--primary)' } : null} />
            {emailError && <p style={{ font: '500 11.5px var(--ui)', color: 'var(--primary)', margin: '4px 0 0' }}>{emailError}</p>}
            {activePilot && <p style={{ font: '500 11.5px var(--ui)', color: 'var(--accent-deep)', margin: '4px 0 0' }}>✓ Piloto ativo encontrado — dados preenchidos automaticamente.</p>}
          </FieldLite>
          <FieldLite label="Nome"><input className="pedal-input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Nome e apelido" /></FieldLite>
          <FieldLite label="Data de nascimento"><input className="pedal-input" type="date" value={f.dob} onChange={(e) => set('dob', e.target.value)} /></FieldLite>
          <FieldLite label="Telefone"><input className="pedal-input" type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="9XX XXX XXX" /></FieldLite>
          <FieldLite label="Território (opcional)">
            <select className="pedal-select" style={{ minWidth: 0, width: '100%' }} value={f.locality} onChange={(e) => set('locality', e.target.value)}>
              <option value="">—</option>
              {P.LOCALITIES.map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
            </select>
          </FieldLite>
          <button className="pedal-btn primary" disabled={!valid} style={{ width: '100%', opacity: valid ? 1 : 0.45, marginTop: 4 }} onClick={submit}>Adicionar formador</button>
        </div>
      </div>
    </div>
  );
}

function FieldLite({ label, children }) {
  return (<div><div style={{ font: '600 11.5px var(--ui)', color: 'var(--ink-soft)', marginBottom: 5 }}>{label}</div>{children}</div>);
}

const ROLE_INFO = {
  'Administração': { desc: 'Acesso total — Operação, Dashboards e Gestão. Pode criar, editar e eliminar utilizadores de coordenação.' },
  'Coordenação': { desc: 'Acesso à Operação e Dashboards. Não tem acesso à área de Gestão nem pode gerir utilizadores.' },
};
function RoleSelect({ value, onChange }) {
  const [hovered, setHovered] = useStateD(null);
  const roles = ['Administração', 'Coordenação'];
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {roles.map((r) => {
        const active = value === r;
        const isHov = hovered === r;
        return (
          <div key={r}
            onClick={() => onChange(r)}
            onMouseEnter={() => setHovered(r)}
            onMouseLeave={() => setHovered(null)}
            style={{ borderRadius: 8, border: `1.5px solid ${active ? 'var(--primary)' : isHov ? 'var(--ink-soft)' : 'var(--line)'}`, background: active ? 'var(--primary-soft)' : isHov ? 'var(--surface-raised)' : 'var(--surface)', padding: '9px 12px', cursor: 'pointer', transition: 'border-color .15s, background .15s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${active ? 'var(--primary)' : 'var(--ink-soft)'}`, background: active ? 'var(--primary)' : 'transparent', flexShrink: 0, transition: 'all .15s' }} />
              <span style={{ font: `${active ? 700 : 600} 13px var(--ui)`, color: active ? 'var(--primary-deep)' : 'var(--ink)' }}>{r}</span>
            </div>
            {(isHov || active) && (
              <div style={{ font: '400 12px/1.45 var(--ui)', color: 'var(--ink-soft)', marginTop: 6, paddingLeft: 22 }}>
                {ROLE_INFO[r].desc}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SchedulingModal({ c, store, onClose }) {
  const P = window.PEDAL;
  const sc = store.S.scheduling[c.id] || c.scheduling || {};
  const existing = sc.slots || [];
  const [rows, setRows] = useStateD(() => [0, 1, 2].map((i) => {
    const ex = existing[i] || {};
    return { date: ex.date || '', startTime: ex.startTime || ex.time || '', endTime: ex.endTime || '' };
  }));
  const [trainerId, setTrainerId] = useStateD(sc.trainerId || '');
  const [stationId, setStationId] = useStateD(sc.stationId || '');
  const setRow = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const valid = rows.filter((r) => r.date && r.startTime);
  // Para enviar uma proposta é obrigatório ter os três: pelo menos um horário, um coach e um local de encontro.
  const missing = [];
  if (valid.length === 0) missing.push('pelo menos uma alternativa de data e hora');
  if (!trainerId) missing.push('atribuir um formador (coach)');
  if (!stationId) missing.push('escolher o local de encontro');
  const canSubmit = missing.length === 0;

  const trainers = store.realTrainers || [];
  const sorted = [...trainers].sort((a, b) => {
    const am = a.locality === c.locality ? 0 : 1, bm = b.locality === c.locality ? 0 : 1;
    return am - bm || a.name.localeCompare(b.name);
  });
  const initials = (n) => n.split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();

  const confirm = () => {
    const schedData = {
      slots: valid.map((s) => ({ date: s.date, startTime: s.startTime, endTime: s.endTime || '', state: 'proposto' })),
      trainerId: trainerId || null, stationId: stationId || null, status: 'aguarda_candidato',
    };
    store.setScheduling(c.id, schedData);
    const backendId = c.live ? store.S.candidateId : c.id;
    if (backendId && store.coordJwt) {
      fetch(`/api/candidates/${backendId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${store.coordJwt}` },
        body: JSON.stringify({ scheduling: schedData }),
      }).then(() => store.patchRealCandidate(backendId, { scheduling: schedData })).catch(() => {});
    }
    const tName = (trainers.find((t) => t.id === trainerId) || {}).name;
    store.notify({ type: 'agendado', who: c.name, text: `recebeu ${valid.length} horário${valid.length > 1 ? 's' : ''} para a formação prática${tName ? ` · formador ${tName}` : ''}` });
    onClose();
  };
  const lbl = { font: '700 11px var(--ui)', letterSpacing: 0.4, color: 'var(--ink-soft)', textTransform: 'uppercase', margin: '18px 0 9px' };

  return (
    <div className="pedal-modal-wrap" onClick={onClose}>
      <div className="pedal-modal" onClick={(e) => e.stopPropagation()}>
        <button className="pedal-modalclose" onClick={onClose}>✕</button>
        <div style={{ font: '800 19px var(--display)', color: 'var(--ink)' }}>Agendar formação prática</div>
        <div style={{ font: '500 13px var(--ui)', color: 'var(--ink-soft)', marginTop: 2 }}>{c.name} · {c.locality}</div>

        <div style={lbl}>Propõe até 3 alternativas</div>
        <div style={{ display: 'grid', gap: 9 }}>
          {rows.map((r, i) => (
            <div key={i} className="pedal-slotedit" style={{ flexWrap: 'wrap', gap: 6 }}>
              <span className="pedal-slotnum">{i + 1}</span>
              <input className="pedal-input" type="date" value={r.date} onChange={(e) => setRow(i, { date: e.target.value })} style={{ flex: '1 1 120px' }} />
              <input className="pedal-input" type="time" value={r.startTime} onChange={(e) => setRow(i, { startTime: e.target.value })} style={{ flex: '1 1 80px' }} placeholder="início" />
              <span style={{ font: '500 12px var(--ui)', color: 'var(--ink-soft)', alignSelf: 'center', flexShrink: 0 }}>até</span>
              <input className="pedal-input" type="time" value={r.endTime} onChange={(e) => setRow(i, { endTime: e.target.value })} style={{ flex: '1 1 80px' }} placeholder="fim" />
            </div>
          ))}
        </div>

        <div style={lbl}>Formador (coach)</div>
        {sorted.length === 0 ? (
          <div className="pedal-taskempty"><Icon name="people" size={16} color="var(--ink-soft)" />Sem formadores — adiciona em Gestão.</div>
        ) : (
          <div style={{ display: 'grid', gap: 7 }}>
            {sorted.map((t) => (
              <button key={t.id} className={'pedal-traineropt' + (trainerId === t.id ? ' on' : '')} onClick={() => setTrainerId(trainerId === t.id ? '' : t.id)}>
                <div className="pedal-traineravsm">{initials(t.name)}</div>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div style={{ font: '700 13px var(--ui)', color: 'var(--ink)' }}>{t.name}</div>
                  <div style={{ font: '500 11.5px var(--ui)', color: 'var(--ink-soft)' }}>{t.locality || 'sem território'} · {t.phone}</div>
                </div>
                {t.locality === c.locality && trainerId !== t.id && <span className="pedal-trainertag">mesma zona</span>}
                {trainerId === t.id && <Icon name="check" size={17} color="var(--primary)" />}
              </button>
            ))}
          </div>
        )}

        <div style={lbl}>Local de encontro (parqueamento)</div>
        {(store.realStations || []).length === 0 ? (
          <div className="pedal-taskempty"><Icon name="pin" size={16} color="var(--ink-soft)" />Sem locais — adiciona em Gestão → Locais de encontro.</div>
        ) : (
          <select className="pedal-select" style={{ width: '100%', minWidth: 0 }} value={stationId} onChange={(e) => setStationId(e.target.value)}>
            <option value="">— escolher local —</option>
            {[...(store.realStations || [])].sort((a, b) => ((a.locality === c.locality ? 0 : 1) - (b.locality === c.locality ? 0 : 1))).map((s) => (
              <option key={s.id} value={s.id}>{s.name} · {s.locality}</option>
            ))}
          </select>
        )}

        <button className=”pedal-btn primary” disabled={!canSubmit} style={{ width: '100%', marginTop: 18, opacity: canSubmit ? 1 : 0.45 }} onClick={confirm}>
          {`Enviar ao voluntário${valid.length ? ` (${valid.length} alternativa${valid.length > 1 ? 's' : ''})` : ''}`}
        </button>
        {!canSubmit && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10, background: 'var(--warn-soft)', border: '1px solid var(--warn-soft)', borderRadius: 11, padding: '9px 11px' }}>
            <Icon name="shield" size={14} color="var(--warn-deep)" />
            <div style={{ font: '500 12px/1.5 var(--ui)', color: 'var(--warn-deep)' }}>
              Para enviar a proposta ao voluntário precisas de:
              <ul style={{ margin: '4px 0 0', padding: '0 0 0 16px' }}>
                {missing.map((m) => <li key={m} style={{ font: '600 12px var(--ui)' }}>{m}</li>)}
              </ul>
            </div>
          </div>
        )}
        <p className="pedal-tasknote" style={{ marginTop: 12 }}>O voluntário vê as opções na app, seleciona as que lhe servem, e tu confirmas aqui em "Rever horários".</p>
      </div>
    </div>
  );
}

function SlotReviewModal({ c, store, onClose }) {
  const P = window.PEDAL;
  const sc = store.S.scheduling[c.id] || c.scheduling || {};
  const slots = sc.slots || [];
  const selectedSlots = slots.map((s, i) => ({ s, i })).filter(({ s }) => s.state === 'selecionado');
  const confirmedSlots = slots.map((s, i) => ({ s, i })).filter(({ s }) => s.state === 'confirmado');
  const trainer = sc.trainerId ? (store.realTrainers || []).find((t) => t.id === sc.trainerId) : null;
  const station = sc.stationId ? (store.realStations || []).find((s) => s.id === sc.stationId) : null;

  const [refusing, setRefusing] = useStateD(null);
  const [refuseReason, setRefuseReason] = useStateD('');
  const [cancelling, setCancelling] = useStateD(null);
  const [cancelReason, setCancelReason] = useStateD('');
  const [doneAction, setDoneAction] = useStateD(null);

  const fmtSlot = (s) => `${P.fmtDate(s.date)} · ${s.startTime || s.time || ''}${s.endTime ? `–${s.endTime}` : ''}`;

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

  const confirmSlot = (idx) => {
    const label = fmtSlot(slots[idx]);
    const tr = trainer; const stn = station;
    let msg = `✅ A tua formação prática foi confirmada para ${label}!`;
    if (stn) msg += ` Encontram-se em ${stn.name}${stn.address ? ` — ${stn.address}` : ''}.`;
    if (tr) msg += ` O teu coach é ${tr.name}${tr.phone ? ` (${tr.phone})` : ''}.`;
    const newSlots = slots.map((s, i) => i === idx ? { ...s, state: 'confirmado' } : s);
    const notifs = [...(sc.chatNotify || []), { id: 'cn' + Math.random().toString(36).slice(2, 7), text: msg, shown: false }];
    patchSched({ ...sc, slots: newSlots, status: 'confirmado', chatNotify: notifs });
    store.notify({ type: 'agendado', who: c.name, text: `formação prática confirmada — ${label}` });
    setDoneAction('confirmed');
  };

  const refuseSlot = (idx) => {
    if (!refuseReason.trim()) return;
    const label = fmtSlot(slots[idx]);
    const newSlots = slots.map((s, i) => i === idx ? { ...s, state: 'recusado', rejectionReason: refuseReason.trim() } : s);
    const remaining = newSlots.filter((s) => s.state === 'selecionado');
    const newStatus = remaining.length === 0 ? 'cancelado' : 'aguarda_coordenacao';
    const text = remaining.length === 0
      ? `Não foi possível confirmar nenhum dos teus horários. A coordenação vai propor-te novas alternativas em breve. 🙏`
      : `O horário de ${label} foi recusado. Motivo: ${refuseReason.trim()}. Continuamos a analisar os outros horários que indicaste.`;
    const notifs = [...(sc.chatNotify || []), { id: 'cn' + Math.random().toString(36).slice(2, 7), text, shown: false }];
    patchSched({ ...sc, slots: newSlots, status: newStatus, chatNotify: notifs });
    setRefusing(null); setRefuseReason(''); setDoneAction('refused');
  };

  const cancelSlot = (idx) => {
    if (!cancelReason.trim()) return;
    const label = fmtSlot(slots[idx]);
    const newSlots = slots.map((s, i) => i === idx ? { ...s, state: 'cancelado', cancelReason: cancelReason.trim() } : s);
    const remaining = newSlots.filter((s) => s.state === 'selecionado');
    const newStatus = remaining.length > 0 ? 'aguarda_coordenacao' : 'cancelado';
    const text = remaining.length > 0
      ? `O horário confirmado de ${label} foi cancelado. Motivo: ${cancelReason.trim()}. Continuamos a verificar os teus outros horários disponíveis. 🙏`
      : `O horário confirmado de ${label} foi cancelado. Motivo: ${cancelReason.trim()}. A coordenação vai propor novas alternativas. 🙏`;
    const notifs = [...(sc.chatNotify || []), { id: 'cn' + Math.random().toString(36).slice(2, 7), text, shown: false }];
    patchSched({ ...sc, slots: newSlots, status: newStatus, chatNotify: notifs });
    setCancelling(null); setCancelReason(''); setDoneAction('cancelled');
  };

  const lbl = { font: '700 11px var(--ui)', letterSpacing: 0.4, color: 'var(--ink-soft)', textTransform: 'uppercase', margin: '16px 0 9px' };

  if (doneAction) {
    const msgs = { confirmed: ['Horário confirmado!', 'O voluntário recebeu a confirmação na app com todos os detalhes.'], refused: ['Horário recusado', 'O voluntário foi notificado na app.'], cancelled: ['Horário cancelado', 'O voluntário foi notificado na app.'] };
    const [title, msg] = msgs[doneAction];
    return (
      <div className="pedal-modal-wrap" onClick={onClose}>
        <div className="pedal-modal" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
          <ProfileSuccess title={title} message={msg} onClose={onClose} />
        </div>
      </div>
    );
  }

  return (
    <div className="pedal-modal-wrap" onClick={onClose}>
      <div className="pedal-modal" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
        <button className="pedal-modalclose" onClick={onClose}>✕</button>
        <div style={{ font: '800 19px var(--display)', color: 'var(--ink)' }}>Horários da formação prática</div>
        <div style={{ font: '500 13px var(--ui)', color: 'var(--ink-soft)', marginTop: 2 }}>{c.name} · {c.locality}</div>

        {confirmedSlots.length > 0 && (
          <>
            <div style={lbl}>Horário confirmado</div>
            {confirmedSlots.map(({ s, i }) => (
              <div key={i} style={{ background: 'var(--primary-soft)', border: '1.5px solid var(--primary)', borderRadius: 12, padding: '12px 14px', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon name="check" size={16} color="var(--primary-deep)" />
                  <div style={{ flex: 1 }}>
                    <div style={{ font: '700 13.5px var(--ui)', color: 'var(--primary-deep)' }}>{P.fmtDate(s.date)}</div>
                    <div style={{ font: '500 12px var(--ui)', color: 'var(--primary-deep)', opacity: 0.8 }}>{s.startTime || s.time || ''}{s.endTime ? `–${s.endTime}` : ''}</div>
                  </div>
                  {cancelling !== i && <button className="pedal-taskbtn" style={{ color: 'var(--accent-deep)', borderColor: 'var(--accent)' }} onClick={() => { setCancelling(i); setCancelReason(''); }}>Cancelar horário</button>}
                </div>
                {cancelling === i && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ font: '600 12px var(--ui)', color: 'var(--ink)', marginBottom: 6 }}>Motivo do cancelamento (obrigatório)</div>
                    <textarea className="pedal-agentinfo" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Ex.: Mau tempo · formador indisponível · imprevisto do voluntário…" style={{ background: 'var(--surface)', minHeight: 64, fontSize: 12.5 }} autoFocus />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                      <button className="pedal-taskbtn" onClick={() => { setCancelling(null); setCancelReason(''); }}>Cancelar</button>
                      <button className="pedal-taskbtn primary" style={{ opacity: cancelReason.trim() ? 1 : 0.45 }} disabled={!cancelReason.trim()} onClick={() => cancelSlot(i)}>Confirmar cancelamento</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {selectedSlots.length > 0 && (
          <>
            <div style={lbl}>Horários selecionados pelo voluntário</div>
            <p style={{ font: '400 12px/1.5 var(--ui)', color: 'var(--ink-soft)', marginTop: 0, marginBottom: 12 }}>Confirma quando conseguires organizar o grupo. Recusa com justificação se não for possível.</p>
            <div style={{ display: 'grid', gap: 10 }}>
              {selectedSlots.map(({ s, i }) => (
                <div key={i} style={{ border: '1.5px solid var(--line)', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Icon name="clock" size={16} color="var(--ink-soft)" />
                    <div style={{ flex: 1 }}>
                      <div style={{ font: '700 13.5px var(--ui)', color: 'var(--ink)' }}>{P.fmtDate(s.date)}</div>
                      <div style={{ font: '500 12px var(--ui)', color: 'var(--ink-soft)' }}>{s.startTime || s.time || ''}{s.endTime ? `–${s.endTime}` : ''}</div>
                    </div>
                    {refusing !== i && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="pedal-taskbtn primary" onClick={() => confirmSlot(i)}>Confirmar</button>
                        <button className="pedal-taskbtn" style={{ color: 'var(--accent-deep)', borderColor: 'var(--accent)' }} onClick={() => { setRefusing(i); setRefuseReason(''); }}>Recusar</button>
                      </div>
                    )}
                  </div>
                  {refusing === i && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ font: '600 12px var(--ui)', color: 'var(--ink)', marginBottom: 6 }}>Motivo da recusa (obrigatório)</div>
                      <textarea className="pedal-agentinfo" value={refuseReason} onChange={(e) => setRefuseReason(e.target.value)} placeholder="Ex.: Sem grupo disponível · mau tempo · formador indisponível…" style={{ background: 'var(--surface)', minHeight: 64, fontSize: 12.5 }} autoFocus />
                      <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                        <button className="pedal-taskbtn" onClick={() => { setRefusing(null); setRefuseReason(''); }}>Cancelar</button>
                        <button className="pedal-taskbtn primary" style={{ opacity: refuseReason.trim() ? 1 : 0.45 }} disabled={!refuseReason.trim()} onClick={() => refuseSlot(i)}>Confirmar recusa</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {selectedSlots.length === 0 && confirmedSlots.length === 0 && (
          <div className="pedal-taskempty" style={{ marginTop: 16 }}><Icon name="clock" size={16} color="var(--ink-soft)" />Sem horários pendentes de revisão.</div>
        )}

        {(trainer || station) && (
          <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
            {trainer && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 11 }}>
                <Icon name="shield" size={15} color="var(--accent-deep)" />
                <div><div style={{ font: '700 13px var(--ui)', color: 'var(--ink)' }}>{trainer.name}</div><div style={{ font: '500 11.5px var(--ui)', color: 'var(--ink-soft)' }}>Coach{trainer.phone ? ` · ${trainer.phone}` : ''}</div></div>
              </div>
            )}
            {station && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 11 }}>
                <Icon name="pin" size={15} color="var(--primary)" />
                <div><div style={{ font: '700 13px var(--ui)', color: 'var(--ink)' }}>{station.name}</div>{station.address && <div style={{ font: '500 11.5px var(--ui)', color: 'var(--ink-soft)' }}>{station.address}</div>}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CandidateDetail({ c, store, onClose }) {
  const P = window.PEDAL;
  const [showChat, setShowChat] = useStateD(false);
  const [rejecting, setRejecting] = useStateD(false);
  const [reason, setReason] = useStateD('');
  const readOnly = false;
  const isLiveC = c.live || c.id === store.S.candidateId;
  const curIdx = P.stageIndex(c.stage);
  const iv = isLiveC
    ? { ...(c.interview || {}), ...(store.S.candidate.interview || {}) }
    : (c.interview || {});
  const ivLabels = { gdpr: 'RGPD', conhecimento: 'Como conheceu', voluntariado: 'Voluntariado', voluntariado_info: 'Exp. voluntariado', bicicleta: 'Bicicleta', carta: 'Carta de condução' };
  const age = c.dob ? Math.floor((Date.now() - new Date(c.dob).getTime()) / 3.15576e10) : null;
  const transcript = isLiveC
    ? store.S.messages.filter((m) => m.text)
    : Array.isArray(c.chat_messages) ? c.chat_messages.filter((m) => m.text) : [];

  function doReject() {
    if (isLiveC) { store.setStage('rejeitado'); store.up({ rejection: { reason } }); } else { store.setOverride(c.id, 'rejeitado'); }
    store.patchRealCandidate(c.id, { stage: 'rejeitado' });
    if (!isLiveC && store.coordJwt) {
      fetch(`/api/candidates/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${store.coordJwt}` },
        body: JSON.stringify({ stage: 'rejeitado' }),
      }).catch(() => {});
    }
    store.notify({ type: 'rejeitado', who: c.name, text: `foi rejeitado(a)${reason ? ' — ' + reason : ''}` });
    onClose();
  }

  return (
    <div className="pedal-modal-wrap" onClick={onClose}>
      <div className="pedal-modal" onClick={(e) => e.stopPropagation()}>
        <button className="pedal-modalclose" onClick={onClose}>✕</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <div className="pedal-kav big">{c.initials}</div>
          <div>
            <div style={{ font: '800 19px var(--display)', color: 'var(--ink)' }}>{c.name}</div>
            <div style={{ font: '500 13px var(--ui)', color: 'var(--ink-soft)' }}>{c.locality} · via {c.source}</div>
          </div>
          {isLiveC && <span style={{ marginLeft: 'auto' }}><Pill tone="green"><span className="pedal-livedot" style={{ position: 'static' }} />Em direto</Pill></span>}
        </div>

        <div className="pedal-detailgrid">
          <DetailItem label="Estado" value={P.stageLabel(c.stage)} />
          <DetailItem label="Email" value={c.email || '—'} />
          <DetailItem label="Telefone" value={c.contact || '—'} />
          <DetailItem label="Data de nascimento" value={c.dob ? `${P.fmtDate(c.dob)}${age != null ? ` · ${age} anos` : ''}` : '—'} />
          {(c.availability && c.availability.length) ? (
            <div className="pedal-detailitem" style={{ gridColumn: '1 / -1' }}>
              <div style={{ font: '500 11px var(--ui)', color: 'var(--ink-soft)', marginBottom: 6 }}>Disponibilidade</div>
              <AvailabilityGrid value={c.availability} readOnly />
            </div>
          ) : (
            <DetailItem label="Disponibilidade" value={(c.periods && c.periods.length) ? c.periods.map((p) => (P.PERIODS.find((x) => x.id === p) || {}).name).join(', ') : '—'} />
          )}
          {c.nif && <DetailItem label="NIF" value={c.nif} />}
          {(c.rua || c.porta || c.codigo_postal || c.cidade) && (
            <div className="pedal-detailitem" style={{ gridColumn: '1 / -1' }}>
              <div style={{ font: '500 11px var(--ui)', color: 'var(--ink-soft)', marginBottom: 3 }}>Morada</div>
              <div style={{ font: '700 13.5px var(--ui)', color: 'var(--ink)' }}>
                {[c.rua, c.porta].filter(Boolean).join(', ')}
                {(c.codigo_postal || c.cidade) && <span style={{ fontWeight: 500, color: 'var(--ink-soft)' }}>{' · '}{[c.codigo_postal, c.cidade].filter(Boolean).join(' ')}</span>}
              </div>
            </div>
          )}
          <DetailItem label="No funil há" value={c.days === 0 ? 'hoje' : c.days + ' dias'} />
        </div>

        {c.rejectReason && (
          <div style={{ marginTop: 12, background: 'var(--app-bg)', borderRadius: 11, padding: '10px 12px', font: '500 12.5px/1.5 var(--ui)', color: 'var(--ink-soft)' }}><strong style={{ color: 'var(--ink)' }}>Motivo da rejeição:</strong> {c.rejectReason}</div>
        )}

        {(() => {
          const sc2 = c.scheduling || store.S.scheduling[c.id];
          if (!sc2 || !((sc2.slots && sc2.slots.length) || sc2.trainerId)) return null;
          const chosen = sc2.chosen != null && sc2.slots ? sc2.slots[sc2.chosen] : null;
          const tr = sc2.trainerId ? (store.realTrainers || []).find((t) => t.id === sc2.trainerId) : null;
          const stn = sc2.stationId ? (store.realStations || []).find((s) => s.id === sc2.stationId) : null;
          return (
            <div style={{ marginTop: 16 }}>
              <div style={{ font: '700 11px var(--ui)', letterSpacing: 0.4, color: 'var(--ink-soft)', textTransform: 'uppercase', marginBottom: 8 }}>Formação prática</div>
              <div style={{ display: 'grid', gap: 7 }}>
                <div className="pedal-ivrow"><span style={{ color: 'var(--ink-soft)' }}>Horário</span><span style={{ fontWeight: 700, color: 'var(--ink)' }}>{chosen ? `${P.fmtDate(chosen.date)} · ${chosen.time}` : `${(sc2.slots || []).length} proposto(s) · aguarda resposta`}</span></div>
                <div className="pedal-ivrow"><span style={{ color: 'var(--ink-soft)' }}>Formador</span><span style={{ fontWeight: 700, color: tr ? 'var(--ink)' : 'var(--accent-deep)' }}>{tr ? `${tr.name}${tr.locality ? ` · ${tr.locality}` : ''}` : 'por atribuir'}</span></div>
                <div className="pedal-ivrow"><span style={{ color: 'var(--ink-soft)' }}>Local de encontro</span><span style={{ fontWeight: 700, color: stn ? 'var(--ink)' : 'var(--accent-deep)' }}>{stn ? stn.name : 'por definir'}</span></div>
              </div>
            </div>
          );
        })()}

        {Object.keys(iv).length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ font: '700 11px var(--ui)', letterSpacing: 0.4, color: 'var(--ink-soft)', textTransform: 'uppercase', marginBottom: 8 }}>Resultado da entrevista</div>
            <div className="pedal-detailbox" style={{ marginTop: 0, display: 'grid', gap: 11 }}>
              {(() => {
                const known = (P.INTERVIEW || []).filter((q) => iv[q.id]);
                const knownIds = known.map((q) => q.id);
                const extra = Object.keys(iv).filter((k) => !knownIds.includes(k));
                return [
                  ...known.map((q) => ({ key: q.id, q: q.q, a: iv[q.id] })),
                  ...extra.map((k) => ({ key: k, q: ivLabels[k] || k, a: iv[k] })),
                ].map((row) => (
                  <div key={row.key}>
                    <div style={{ font: '600 12px/1.4 var(--ui)', color: 'var(--ink-soft)' }}>{row.q}</div>
                    <div style={{ font: '700 13.5px/1.4 var(--ui)', color: 'var(--ink)', marginTop: 3, display: 'flex', gap: 7, alignItems: 'flex-start' }}><span style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 1 }}><Icon name="check" size={14} /></span>{row.a}</div>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {transcript.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <button className="pedal-taskbtn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setShowChat((v) => !v)}>
              <Icon name="chat" size={14} />{showChat ? 'Ocultar conversa' : 'Ver conversa com o agente'}
            </button>
            {showChat && (
              <div className="pedal-transcript">
                {transcript.map((m, i) => (
                  <div key={i} className={'pedal-tmsg ' + (m.from === 'user' ? 'user' : m.from === 'system' ? 'sys' : 'agent')}>
                    <span className="pedal-tfrom">{m.from === 'user' ? c.name.split(' ')[0] : m.from === 'system' ? 'sistema' : 'PEDAL'}</span>
                    {m.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!readOnly && c.stage === 'validacao' && !rejecting && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="pedal-taskbtn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setRejecting(true)}>Rejeitar</button>
              <button className="pedal-taskbtn" style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => {
                  if (isLiveC) { store.up({ pushedToWaitingList: true }); store.setStage('espera'); }
                  else { store.setOverride(c.id, 'espera'); }
                  store.patchRealCandidate(c.id, { stage: 'espera' });
                  store.notify({ type: 'espera', who: c.name, text: 'foi colocado(a) em lista de espera pela coordenação' });
                  onClose();
                }}>Lista de espera</button>
            </div>
            <button className="pedal-btn primary" style={{ width: '100%' }}
              onClick={() => {
                if (isLiveC) { store.up({ validated: true }); store.setStage('onboarding'); }
                else { store.setOverride(c.id, 'onboarding'); }
                store.patchRealCandidate(c.id, { stage: 'onboarding' });
                store.notify({ type: 'validado', who: c.name, text: 'foi validado(a) pela coordenação — segue para onboarding' });
                onClose();
              }}>
              Validar candidatura ✓
            </button>
          </div>
        )}

        {!readOnly && rejecting && (
          <div style={{ marginTop: 16 }}>
            <div style={{ font: '700 11px var(--ui)', letterSpacing: 0.4, color: 'var(--ink-soft)', textTransform: 'uppercase', marginBottom: 8 }}>Motivo da rejeição (opcional)</div>
            <textarea className="pedal-input" style={{ height: 70, paddingTop: 10, resize: 'none' }} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: sem disponibilidade compatível, fora da área de operação…" />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="pedal-btn ghost" style={{ flex: 1 }} onClick={() => setRejecting(false)}>Cancelar</button>
              <button className="pedal-btn primary" style={{ flex: 1, background: 'var(--accent-deep)' }} onClick={doReject}>Confirmar rejeição</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div className="pedal-detailitem">
      <div style={{ font: '500 11px var(--ui)', color: 'var(--ink-soft)' }}>{label}</div>
      <div style={{ font: '700 13.5px var(--ui)', color: 'var(--ink)', marginTop: 2 }}>{value}</div>
    </div>
  );
}

// ── Ecrã Gestão: menu lateral + conteúdo central ───────────────────
function GestaoScreen({ ctx }) {
  const { store, candidates, allowedGestao } = ctx;
  const allItems = [
    { id: 'users', label: 'Utilizadores de gestão', icon: 'people' },
    { id: 'formadores', label: 'Pilotos formadores', icon: 'shield' },
    { id: 'necessidades', label: 'Necessidades / vagas', icon: 'route' },
    { id: 'localidades', label: 'Localidades', icon: 'pin' },
    { id: 'conteudos', label: 'Vídeos & conteúdos', icon: 'play' },
    { id: 'locais', label: 'Locais de encontro', icon: 'map' },
  ];
  const items = allowedGestao ? allItems.filter((it) => allowedGestao.includes(it.id)) : allItems;
  const [g, setG] = useStateD(items[0] ? items[0].id : 'users');
  return (
    <div className="pedal-gestao">
      <div className="pedal-gestaonav">
        {items.map((it) => (
          <button key={it.id} className={g === it.id ? 'on' : ''} onClick={() => setG(it.id)}><Icon name={it.icon} size={16} />{it.label}</button>
        ))}
      </div>
      <div style={{ minWidth: 0 }}>
        {g === 'users' && <GestaoUsers store={store} />}
        {g === 'formadores' && <TrainersAdmin ctx={ctx} />}
        {g === 'necessidades' && <NeedsAdmin store={store} />}
        {g === 'conteudos' && <ModuleContentAdmin store={store} />}
        {g === 'locais' && <StationsAdmin store={store} />}
        {g === 'localidades' && <LocalidadesAdmin store={store} />}
      </div>
    </div>
  );
}

// Utilizadores da consola de gestão
function GestaoUsers({ store }) {
  const { useEffect: useEffectGU } = React;
  const [users, setUsers] = useStateD(null);
  const [f, setF] = useStateD({ name: '', email: '', phone: '', role: 'Administração' });
  const [loading, setLoading] = useStateD(false);
  const [created, setCreated] = useStateD(null);
  const [err, setErr] = useStateD('');
  const [editing, setEditing] = useStateD(null);
  const [editRole, setEditRole] = useStateD('Coordenação');
  const [editLoading, setEditLoading] = useStateD(false);
  const [editErr, setEditErr] = useStateD('');
  const [confirmDel, setConfirmDel] = useStateD(null); // user a confirmar eliminação
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const loadUsers = () => {
    fetch('/api/coord-users', {
      headers: { 'Authorization': `Bearer ${store.coordJwt}` },
    }).then((r) => r.json()).then((data) => { if (Array.isArray(data)) setUsers(data); }).catch(() => setUsers([]));
  };
  useEffectGU(() => { loadUsers(); }, []);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim());
  const valid = f.name.trim().length > 1 && emailOk && !loading;

  const submit = async () => {
    if (!valid) return;
    setLoading(true); setErr('');
    try {
      const res = await fetch('/api/coord-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${store.coordJwt}` },
        body: JSON.stringify({ name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(), role: f.role }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || 'Erro ao criar utilizador.'); return; }
      setCreated({ name: f.name.trim(), email: f.email.trim(), tempPassword: data.tempPassword });
      setF({ name: '', email: '', phone: '', role: 'Administração' });
      loadUsers();
    } catch (_) { setErr('Sem ligação ao servidor.'); }
    finally { setLoading(false); }
  };

  const startEdit = (u) => { setEditing(u); setEditRole(u.role); setEditErr(''); setConfirmDel(null); };

  const saveEdit = async () => {
    if (!editing) return;
    setEditLoading(true); setEditErr('');
    try {
      const res = await fetch(`/api/coord-users/${encodeURIComponent(editing.email)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${store.coordJwt}` },
        body: JSON.stringify({ role: editRole }),
      });
      const data = await res.json();
      if (!res.ok) { setEditErr(data.error || 'Erro ao actualizar.'); return; }
      setEditing(null);
      loadUsers();
    } catch (_) { setEditErr('Sem ligação ao servidor.'); }
    finally { setEditLoading(false); }
  };

  const deleteUser = async (u) => {
    try {
      const res = await fetch(`/api/coord-users/${encodeURIComponent(u.email)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${store.coordJwt}` },
      });
      if (!res.ok) { const d = await res.json(); alert(d.error || 'Erro ao eliminar.'); return; }
      setConfirmDel(null);
      loadUsers();
    } catch (_) { alert('Sem ligação ao servidor.'); }
  };

  const admins = users ? users.filter((u) => u.role === 'Administração') : [];
  const coords = users ? users.filter((u) => u.role === 'Coordenação') : [];

  const UserRow = ({ u }) => (
    <div key={u.id} className="pedal-taskrow">
      <div className="pedal-kav" style={{ background: 'var(--accent-soft)', color: 'var(--accent-deep)' }}>{(u.name || u.email).split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase()}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: '700 13.5px var(--ui)', color: 'var(--ink)' }}>{u.name}</div>
        <div style={{ font: '500 11.5px var(--ui)', color: 'var(--ink-soft)' }}>{u.email}{u.phone ? ` · ${u.phone}` : ''}</div>
      </div>
      <button className="pedal-iconbtn" title="Editar função" onClick={() => startEdit(u)}>✎</button>
      <button className="pedal-iconbtn" title="Eliminar" style={{ color: 'var(--primary)' }} onClick={() => { setConfirmDel(u); setEditing(null); }}>✕</button>
    </div>
  );

  return (
    <div className="pedal-dashgrid">
      <div className="pedal-panel" style={{ display: 'grid', gap: 20 }}>
        {users === null ? (
          <div className="pedal-taskempty"><Icon name="people" size={16} color="var(--ink-soft)" />A carregar…</div>
        ) : (
          <>
            <div>
              <div className="pedal-panelhead" style={{ marginBottom: 8 }}>
                <span style={{ font: '700 13px var(--ui)', color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Administração</span>
                <Pill tone="neutral">{admins.length}</Pill>
              </div>
              {admins.length === 0 ? (
                <div className="pedal-taskempty"><Icon name="people" size={16} color="var(--ink-soft)" />Sem administradores.</div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>{admins.map((u) => <UserRow key={u.id} u={u} />)}</div>
              )}
            </div>
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
              <div className="pedal-panelhead" style={{ marginBottom: 8 }}>
                <span style={{ font: '700 13px var(--ui)', color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Coordenação</span>
                <Pill tone="neutral">{coords.length}</Pill>
              </div>
              {coords.length === 0 ? (
                <div className="pedal-taskempty"><Icon name="people" size={16} color="var(--ink-soft)" />Sem coordenadores.</div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>{coords.map((u) => <UserRow key={u.id} u={u} />)}</div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="pedal-panel">
        {confirmDel ? (
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ font: '700 15px var(--display)', color: 'var(--ink)' }}>Eliminar utilizador</div>
            <div style={{ background: 'var(--primary-soft)', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ font: '600 13px var(--ui)', color: 'var(--primary-deep)' }}>Tens a certeza que queres eliminar <strong>{confirmDel.name}</strong>?</div>
              <div style={{ font: '500 12px var(--ui)', color: 'var(--ink-soft)', marginTop: 4 }}>{confirmDel.email} · {confirmDel.role}</div>
              <div style={{ font: '500 12px var(--ui)', color: 'var(--ink-soft)', marginTop: 6 }}>Esta acção não pode ser desfeita.</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="pedal-btn ghost" style={{ flex: 1 }} onClick={() => setConfirmDel(null)}>Cancelar</button>
              <button className="pedal-btn primary" style={{ flex: 1 }} onClick={() => deleteUser(confirmDel)}>Eliminar</button>
            </div>
          </div>
        ) : editing ? (
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ font: '700 15px var(--display)', color: 'var(--ink)' }}>Editar função</div>
            <div style={{ font: '500 13px var(--ui)', color: 'var(--ink-soft)' }}>{editing.name} · {editing.email}</div>
            <FieldLite label="Nova função"><RoleSelect value={editRole} onChange={setEditRole} /></FieldLite>
            {editErr && <div style={{ font: '500 12px var(--ui)', color: 'var(--accent-deep)' }}>{editErr}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="pedal-btn ghost" style={{ flex: 1 }} onClick={() => setEditing(null)}>Cancelar</button>
              <button className="pedal-btn primary" style={{ flex: 1 }} disabled={editLoading || editRole === editing.role} onClick={saveEdit}>
                {editLoading ? 'A guardar…' : 'Guardar'}
              </button>
            </div>
          </div>
        ) : created ? (
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ font: '700 15px var(--display)', color: 'var(--ink)' }}>Conta criada</div>
            <div style={{ background: 'var(--accent-soft)', borderRadius: 10, padding: '14px 16px', display: 'grid', gap: 6 }}>
              <div style={{ font: '500 12px var(--ui)', color: 'var(--ink-soft)' }}>Envia estas credenciais a <strong style={{ color: 'var(--ink)' }}>{created.name}</strong>:</div>
              <div style={{ font: '500 13px var(--ui)', color: 'var(--ink)' }}>Email: <strong>{created.email}</strong></div>
              <div style={{ font: '500 13px var(--ui)', color: 'var(--ink)' }}>Password temporária: <strong style={{ fontFamily: 'monospace', background: 'var(--line)', padding: '2px 6px', borderRadius: 4 }}>{created.tempPassword}</strong></div>
            </div>
            <p style={{ font: '400 12px/1.5 var(--ui)', color: 'var(--ink-soft)', margin: 0 }}>O utilizador deve alterar a password no primeiro login.</p>
            <button className="pedal-btn ghost" style={{ width: '100%' }} onClick={() => setCreated(null)}>Adicionar outro</button>
          </div>
        ) : (
          <>
            <div className="pedal-panelhead"><span style={{ font: '700 15px var(--display)', color: 'var(--ink)' }}>Adicionar utilizador</span></div>
            <div style={{ display: 'grid', gap: 10 }}>
              <FieldLite label="Nome"><input className="pedal-input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Nome e apelido" /></FieldLite>
              <FieldLite label="Email"><input className="pedal-input" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="nome@pedalarsemidade.pt" /></FieldLite>
              <FieldLite label="Telefone"><input className="pedal-input" type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="9XX XXX XXX" /></FieldLite>
              <FieldLite label="Função"><RoleSelect value={f.role} onChange={(v) => set('role', v)} /></FieldLite>
              {err && <div style={{ font: '500 12px var(--ui)', color: 'var(--accent-deep)' }}>{err}</div>}
              <button className="pedal-btn primary" disabled={!valid} style={{ width: '100%', opacity: valid ? 1 : 0.45, marginTop: 4 }} onClick={submit}>
                {loading ? 'A criar…' : 'Adicionar utilizador'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const NEEDS_DAYS = [
  { id: 'segunda', label: 'Segunda' }, { id: 'terca',   label: 'Terça'   },
  { id: 'quarta',  label: 'Quarta'  }, { id: 'quinta',  label: 'Quinta'  },
  { id: 'sexta',   label: 'Sexta'   }, { id: 'sabado',  label: 'Sábado'  },
  { id: 'domingo', label: 'Domingo' },
];

function NeedsAdmin({ store }) {
  const localities = store.realLocalities || window.PEDAL.LOCALITIES;
  const [table, setTable] = useStateD(() => store.realNeeds || {});
  const [saved, setSaved] = useStateD(false);
  const [saving, setSaving] = useStateD(false);
  const [saveError, setSaveError] = useStateD(null);

  useEffectD(() => {
    if (store.realNeeds !== null) setTable(store.realNeeds || {});
  }, [store.realNeeds]);

  const setCell = (locName, day, field, value) => {
    setSaved(false);
    setTable((prev) => {
      const loc = { ...(prev[locName] || {}) };
      const cell = { ...(loc[day] || {}) };
      if (field === 'period') { cell.period = value || null; if (!value) cell.count = null; }
      else { cell.count = value ? Number(value) : null; }
      loc[day] = (!cell.period && !cell.count) ? null : cell;
      return { ...prev, [locName]: loc };
    });
  };

  const handleSave = async () => {
    setSaving(true); setSaveError(null);
    const result = await store.saveNeedsSchedule(table);
    setSaving(false);
    if (result && result.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      setSaveError((result && result.error) || 'Erro ao guardar');
      setTimeout(() => setSaveError(null), 5000);
    }
  };

  return (
    <div className="pedal-panel">
      <div className="pedal-panelhead">
        <span style={{ font: '700 15px var(--display)', color: 'var(--ink)' }}>Necessidades / vagas</span>
      </div>
      <p style={{ font: '400 12px/1.5 var(--ui)', color: 'var(--ink-soft)', margin: '0 0 14px' }}>
        Define para cada localidade e dia da semana o período e o número de pilotos necessários. Os candidatos são encaminhados automaticamente com base nesta tabela.
      </p>
      <div className="pedal-needs-wrap">
        <table className="pedal-needs-tbl">
          <thead>
            <tr>
              <th className="pedal-needs-loc-th">Localidade</th>
              {NEEDS_DAYS.map((d) => <th key={d.id} className="pedal-needs-day-th">{d.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {localities.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '20px', color: 'var(--ink-soft)', font: '500 13px var(--ui)' }}>Sem localidades configuradas — adiciona localidades na secção Localidades.</td></tr>
            ) : localities.map((loc) => {
              const locData = table[loc.name] || {};
              return (
                <tr key={loc.id || loc.name} className="pedal-needs-row">
                  <td className="pedal-needs-loc-td">{loc.name}</td>
                  {NEEDS_DAYS.map((d) => {
                    const cell = locData[d.id] || {};
                    return (
                      <td key={d.id} className={'pedal-needs-cell' + (cell.period ? ' per-' + cell.period : '')}>
                        <div className="pedal-needs-cell-inner">
                          <div className="pedal-needs-per-wrap">
                            <select className="pedal-needs-per" value={cell.period || ''} onChange={(e) => setCell(loc.name, d.id, 'period', e.target.value)}>
                              <option value="">—</option>
                              <option value="manha">Manhã</option>
                              <option value="tarde">Tarde</option>
                              <option value="ambos">Ambos</option>
                            </select>
                          </div>
                          {cell.period && (
                            <div className="pedal-needs-cnt-wrap">
                              <select className={'pedal-needs-cnt' + (cell.count ? ' has-val' : '')} value={cell.count || ''} onChange={(e) => setCell(loc.name, d.id, 'count', e.target.value)}>
                                <option value="">— pilotos</option>
                                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} piloto{n > 1 ? 's' : ''}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 16 }}>
        {saved && <span style={{ font: '600 13px var(--ui)', color: 'var(--accent-deep)', display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="check" size={14} color="var(--accent-deep)" />Alterações gravadas</span>}
        {saveError && <span style={{ font: '600 13px var(--ui)', color: 'var(--primary-deep)', display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="alert-circle" size={14} color="var(--primary-deep)" />{saveError}</span>}
        <button className="pedal-btn primary" style={{ opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={handleSave}>{saving ? 'A gravar…' : 'Gravar alterações'}</button>
      </div>
    </div>
  );
}

// Gestão de localidades activas
function LocalidadesAdmin({ store }) {
  const locs = store.realLocalities || [];
  const [errors, setErrors] = useStateD({});
  const [loading, setLoading] = useStateD({});
  const [newName, setNewName] = useStateD('');
  const [addErr, setAddErr] = useStateD('');
  const [adding, setAdding] = useStateD(false);

  const del = async (id) => {
    setErrors((p) => ({ ...p, [id]: '' }));
    setLoading((p) => ({ ...p, [id]: true }));
    const res = await store.removeLocality(id);
    setLoading((p) => ({ ...p, [id]: false }));
    if (!res.ok) setErrors((p) => ({ ...p, [id]: res.error }));
  };

  const add = async () => {
    const name = newName.trim();
    if (name.length < 2) return;
    setAdding(true); setAddErr('');
    const res = await store.addLocality(name);
    setAdding(false);
    if (res.ok) setNewName('');
    else setAddErr(res.error);
  };

  return (
    <div className="pedal-dashgrid">
      <div className="pedal-panel">
        <div className="pedal-panelhead">
          <span style={{ font: '700 15px var(--display)', color: 'var(--ink)' }}>Localidades activas</span>
          <Pill tone={locs.length ? 'green' : 'amber'}>{locs.length}</Pill>
        </div>
        <p style={{ font: '400 12px/1.5 var(--ui)', color: 'var(--ink-soft)', margin: '0 0 14px' }}>
          Só é possível eliminar uma localidade se não houver vagas abertas associadas.
        </p>
        {locs.length === 0 ? (
          <div className="pedal-taskempty"><Icon name="pin" size={16} color="var(--ink-soft)" />Sem localidades definidas.</div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {locs.map((l) => (
              <div key={l.id} style={{ display: 'grid', gap: 4 }}>
                <div className="pedal-stationrow">
                  <span style={{ color: 'var(--primary)', flexShrink: 0 }}><Icon name="pin" size={16} /></span>
                  <span style={{ flex: 1, font: '600 13.5px var(--ui)', color: 'var(--ink)' }}>{l.name}</span>
                  <button className="pedal-iconbtn" title="Eliminar localidade" disabled={!!loading[l.id]}
                    onClick={() => del(l.id)}>✕</button>
                </div>
                {errors[l.id] && (
                  <div style={{ font: '500 11.5px var(--ui)', color: 'var(--accent-deep)', paddingLeft: 28 }}>{errors[l.id]}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="pedal-panel">
        <div className="pedal-panelhead"><span style={{ font: '700 15px var(--display)', color: 'var(--ink)' }}>Adicionar localidade</span></div>
        <div style={{ display: 'grid', gap: 10 }}>
          <FieldLite label="Nome">
            <input className="pedal-input" value={newName} onChange={(e) => { setNewName(e.target.value); setAddErr(''); }}
              placeholder="Ex.: Vila do Conde" onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
          </FieldLite>
          {addErr && <div style={{ font: '600 11.5px var(--ui)', color: 'var(--accent-deep)' }}>{addErr}</div>}
          <button className="pedal-btn primary" disabled={newName.trim().length < 2 || adding}
            style={{ width: '100%', opacity: newName.trim().length < 2 || adding ? 0.45 : 1, marginTop: 2 }}
            onClick={add}>Adicionar localidade</button>
        </div>
      </div>
    </div>
  );
}

// Locais de encontro / parqueamento das bicicletas
function StationsAdmin({ store }) {
  const P = window.PEDAL;
  const stations = store.realStations || [];
  const [f, setF] = useStateD({ name: '', locality: '', address: '', note: '' });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  // localidades disponíveis = BD + as já usadas em locais criados (sem duplicar)
  const locOptions = (() => {
    const seen = [];
    (store.realLocalities || P.LOCALITIES).forEach((l) => { if (!seen.includes(l.name)) seen.push(l.name); });
    stations.forEach((s) => { if (s.locality && !seen.includes(s.locality)) seen.push(s.locality); });
    return seen;
  })();
  const valid = f.name.trim().length > 1 && f.locality.trim();
  const submit = () => { if (!valid) return; store.addStation({ name: f.name.trim(), locality: f.locality.trim(), address: f.address.trim(), note: f.note.trim() }); setF({ name: '', locality: '', address: '', note: '' }); };
  return (
    <div className="pedal-dashgrid">
      <div className="pedal-panel">
        <div className="pedal-panelhead"><span style={{ font: '700 15px var(--display)', color: 'var(--ink)' }}>Locais de encontro</span><Pill tone="neutral">{stations.length}</Pill></div>
        <p style={{ font: '400 12px/1.5 var(--ui)', color: 'var(--ink-soft)', margin: '0 0 12px' }}>Onde as bicicletas estão estacionadas. São propostos ao voluntário no agendamento da formação prática.</p>
        {stations.length === 0 ? (
          <div className="pedal-taskempty"><Icon name="pin" size={16} color="var(--ink-soft)" />Ainda sem locais.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {stations.map((s) => (
              <div key={s.id} className="pedal-stationrow">
                <span style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 1 }}><Icon name="pin" size={18} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '700 13.5px var(--ui)', color: 'var(--ink)' }}>{s.name} <span style={{ font: '600 11.5px var(--ui)', color: 'var(--accent-deep)' }}>· {s.locality}</span></div>
                  {s.address && <div style={{ font: '500 12px var(--ui)', color: 'var(--ink-soft)' }}>{s.address}</div>}
                  {s.note && <div style={{ font: '500 11.5px var(--ui)', color: 'var(--ink-soft)', marginTop: 2 }}>{s.note}</div>}
                </div>
                <button className="pedal-iconbtn" title="Remover" onClick={() => store.removeStation(s.id)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="pedal-panel">
        <div className="pedal-panelhead"><span style={{ font: '700 15px var(--display)', color: 'var(--ink)' }}>Adicionar local</span></div>
        <div style={{ display: 'grid', gap: 10 }}>
          <FieldLite label="Nome do local"><input className="pedal-input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex.: Base de Matosinhos" /></FieldLite>
          <FieldLite label="Localidade">
            <select className="pedal-select" style={{ minWidth: 0, width: '100%' }} value={f.locality} onChange={(e) => set('locality', e.target.value)}>
              <option value="">—</option>
              {locOptions.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </FieldLite>
          <FieldLite label="Morada"><input className="pedal-input" value={f.address} onChange={(e) => set('address', e.target.value)} placeholder="Rua, número, localidade" /></FieldLite>
          <FieldLite label="Nota (opcional)"><input className="pedal-input" value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="Ex.: 2 triciclos · entrada lateral" /></FieldLite>
          <button className="pedal-btn primary" disabled={!valid} style={{ width: '100%', opacity: valid ? 1 : 0.45, marginTop: 4 }} onClick={submit}>Adicionar local</button>
        </div>
      </div>
    </div>
  );
}

// Exportar toda a base de dados
function ExportAllPanel({ candidates, store }) {
  return (
    <div className="pedal-panel">
      <div className="pedal-panelhead"><span style={{ font: '700 15px var(--display)', color: 'var(--ink)' }}>Exportar base de dados</span></div>
      <p style={{ font: '400 13px/1.6 var(--ui)', color: 'var(--ink-soft)', margin: '0 0 16px', maxWidth: 520 }}>
        Descarrega um ficheiro Excel (CSV) com todos os pilotos e candidatos — dados pessoais, estado no funil, disponibilidade, agendamento e formador atribuído.
      </p>
      <button className="pedal-exportbtn" onClick={() => exportCandidates(candidates, store, 'base-de-dados-completa')}>
        <Icon name="doc" size={15} />Exportar todos os pilotos ({candidates.length})
      </button>
    </div>
  );
}

// ── Ecrã Dashboards (analítica) ─────────────────────────────────────
function BarChart({ rows, color = 'var(--primary)' }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div>
      {rows.map((r, i) => (
        <div key={(r.label || '') + '-' + i} className="pedal-barrow">
          <span className="pedal-barlbl">{r.label}</span>
          <div className="pedal-bartrack"><div className="pedal-barfill" style={{ width: `${Math.max(6, (r.n / max) * 100)}%`, background: color }}>{r.n}</div></div>
        </div>
      ))}
    </div>
  );
}

function AnalyticsScreen({ ctx }) {
  const { candidates, store } = ctx;
  const P = window.PEDAL;
  const total = candidates.length;
  const ativos = candidates.filter((c) => c.stage === 'ativo').length;
  const inFunnel = candidates.filter((c) => P.funnelCol(c.stage)).length;
  const conv = total ? Math.round((ativos / total) * 100) : 0;
  const activeDays = candidates.filter((c) => c.stage === 'ativo' && c.days).map((c) => c.days);
  const avgDays = activeDays.length ? Math.round(activeDays.reduce((a, b) => a + b, 0) / activeDays.length) : 0;
  const emFormacao = candidates.filter((c) => c.stage === 'onboarding' || c.stage === 'pratica' || c.stage === 'formalizacao').length;
  const formadores = (store.realTrainers || []).length;

  const byStage = P.STAGES.filter((s) => s.id !== 'rejeitado').map((s) => ({ label: s.label, n: candidates.filter((c) => c.stage === s.id).length })).filter((x) => x.n > 0);
  const byLoc = P.LOCALITIES.map((l) => ({ label: l.name, n: candidates.filter((c) => c.localityId === l.id || c.locality === l.name).length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  // conversas & tópicos (ilustrativo a partir da base de conhecimento + pedidos)
  const conversas = total + (store.S.contactRequests || []).length;
  // tópicos mais consultados — agregados por categoria (sem duplicados)
  const topicos = (() => {
    const seen = []; const out = [];
    P.FAQ_CHIPS.forEach((id, i) => {
      const f = P.FAQ.find((x) => x.id === id);
      const label = f ? f.cat : id;
      if (seen.includes(label)) { out[seen.indexOf(label)].n += Math.max(2, 14 - i * 2); }
      else { seen.push(label); out.push({ label, n: Math.max(2, 14 - i * 2) }); }
    });
    return out.sort((a, b) => b.n - a.n);
  })();

  const stats = [
    { label: 'Pilotos no funil', value: inFunnel, sub: 'em processo ativo' },
    { label: 'Taxa de conversão', value: conv + '%', sub: 'candidatos → ativos' },
    { label: 'Tempo médio', value: avgDays + ' d', sub: '1.º contacto → ativo' },
    { label: 'Pilotos ativos', value: ativos, sub: 'a pedalar' },
  ];

  return (
    <div>
      <div className="pedal-statgrid">
        {stats.map((s) => (
          <div key={s.label} className="pedal-statcard">
            <div className="pedal-bigstat">{s.value}</div>
            <div style={{ font: '700 12.5px var(--ui)', color: 'var(--ink)', marginTop: 8 }}>{s.label}</div>
            <div style={{ font: '500 11.5px var(--ui)', color: 'var(--ink-soft)', marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="pedal-dashgrid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="pedal-panel">
          <div className="pedal-panelhead"><span style={{ font: '700 14px var(--display)', color: 'var(--ink)' }}>Pilotos por estado</span></div>
          <BarChart rows={byStage} color="var(--primary)" />
        </div>
        <div className="pedal-panel">
          <div className="pedal-panelhead"><span style={{ font: '700 14px var(--display)', color: 'var(--ink)' }}>Pilotos por localidade</span></div>
          <BarChart rows={byLoc} color="var(--accent-deep)" />
        </div>
      </div>

      <div className="pedal-dashgrid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 18 }}>
        <div className="pedal-panel">
          <div className="pedal-panelhead"><span style={{ font: '700 14px var(--display)', color: 'var(--ink)' }}>Formação vs. formadores</span></div>
          <div style={{ display: 'flex', gap: 14 }}>
            <div className="pedal-statcard" style={{ flex: 1 }}>
              <div className="pedal-bigstat" style={{ color: 'var(--primary-deep)' }}>{emFormacao}</div>
              <div style={{ font: '600 12px var(--ui)', color: 'var(--ink-soft)', marginTop: 6 }}>pilotos em formação</div>
            </div>
            <div className="pedal-statcard" style={{ flex: 1 }}>
              <div className="pedal-bigstat" style={{ color: 'var(--accent-deep)' }}>{formadores}</div>
              <div style={{ font: '600 12px var(--ui)', color: 'var(--ink-soft)', marginTop: 6 }}>formadores ativos</div>
            </div>
          </div>
          <div style={{ font: '500 12px/1.5 var(--ui)', color: 'var(--ink-soft)', marginTop: 12 }}>Rácio de <strong style={{ color: 'var(--ink)' }}>{formadores ? (emFormacao / formadores).toFixed(1) : '—'}</strong> pilotos em formação por formador.</div>
        </div>
        <div className="pedal-panel">
          <div className="pedal-panelhead"><span style={{ font: '700 14px var(--display)', color: 'var(--ink)' }}>Conversas & dúvidas</span><Pill tone="neutral">{conversas} conversas</Pill></div>
          <div style={{ font: '600 11px var(--ui)', letterSpacing: 0.4, color: 'var(--ink-soft)', textTransform: 'uppercase', margin: '0 0 10px' }}>Tópicos mais consultados</div>
          <BarChart rows={topicos} color="var(--primary)" />
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Dashboard });
