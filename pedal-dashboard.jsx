/* pedal-dashboard.jsx — painel da coordenação (RF-30 a RF-40) */

const { useState: useStateD } = React;

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

function Dashboard({ store }) {
  const S = store.S; const P = window.PEDAL;
  const [sel, setSel] = useStateD(null);
  const [schedFor, setSchedFor] = useStateD(null);
  const [completeFor, setCompleteFor] = useStateD(null);
  const [screen, setScreen] = useStateD('operacao');  // operacao | dashboards | gestao
  const [section, setSection] = useStateD('geral');     // sub-secção dentro de Operação
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
  const candidates = [...(live ? [live] : []), ...(store.realCandidates !== null ? store.realCandidates : seedList)];

  const isLiveCandidate = (c) => c.live || c.id === S.candidateId;

  function validate(c) {
    if (isLiveCandidate(c)) { store.up({ validated: true }); store.setStage('onboarding'); }
    else { store.setOverride(c.id, 'onboarding'); }
    store.notify({ type: 'validado', who: c.name, text: 'foi validado(a) pela coordenação — segue para onboarding' });
  }
  const schedOf = (c) => S.scheduling[c.id] || null;

  const cEspera = candidates.filter((c) => c.stage === 'espera').length;
  const cPratica = candidates.filter((c) => c.stage === 'pratica').length;
  const cVal = candidates.filter((c) => c.stage === 'validacao').length;
  const cAtivo = candidates.filter((c) => c.stage === 'ativo').length;
  const cContact = S.contactRequests.filter((r) => r.status === 'novo').length;

  const opsNav = [
    { id: 'contactos', label: 'Pedidos de contacto', icon: 'phone', badge: cContact },
  ];

  const ctx = { store, candidates, setSel, setSchedFor, setCompleteFor, validate, schedOf, setScreen, setSection };
  const cp = S.coordProfile || {};
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
          <button className={screen === 'operacao' ? 'on' : ''} onClick={() => setScreen('operacao')}><Icon name="route" size={15} />Operação</button>
          <button className={screen === 'dashboards' ? 'on' : ''} onClick={() => setScreen('dashboards')}><Icon name="sparkle" size={15} />Dashboards</button>
          <button className={screen === 'gestao' ? 'on' : ''} onClick={() => setScreen('gestao')}><Icon name="shield" size={15} />Gestão</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
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
      {profileModal === 'edit' && <CoordEditModal store={store} onClose={() => setProfileModal(null)} />}
      {profileModal === 'pw' && <CoordPwModal store={store} onClose={() => setProfileModal(null)} />}
    </div>
  );
}

// Menu de perfil do utilizador da consola (logout, password, telefone, email)
function CoordProfileMenu({ store, onClose, onOpenModal }) {
  const cp = store.S.coordProfile || {};
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
  const cp = store.S.coordProfile || {};
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
function CoordPwModal({ store, onClose }) {
  const [pw, setPw] = useStateD('');
  const [pw2, setPw2] = useStateD('');
  const [err, setErr] = useStateD('');
  const [done, setDone] = useStateD(false);
  const save = () => {
    if (pw.length < 4) { setErr('A palavra-passe deve ter pelo menos 4 caracteres.'); return; }
    if (pw !== pw2) { setErr('As palavras-passe não coincidem.'); return; }
    setErr(''); setDone(true);
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
            <FieldLite label="Nova palavra-passe"><input className="pedal-input" type="password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(''); }} placeholder="Mínimo 4 caracteres" /></FieldLite>
            <div style={{ height: 10 }} />
            <FieldLite label="Confirmar palavra-passe"><input className="pedal-input" type="password" value={pw2} onChange={(e) => { setPw2(e.target.value); setErr(''); }} placeholder="Repete a palavra-passe" /></FieldLite>
            {err && <div style={{ font: '600 11.5px var(--ui)', color: 'var(--primary-deep)', marginTop: 8 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button className="pedal-btn ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
              <button className="pedal-btn primary" style={{ flex: 1 }} onClick={save}>Guardar</button>
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
    const sc = schedOf(c);
    if (!sc || sc.chosen == null) tasks.push({ key: 'sch' + c.id, c, kind: 'agendar', label: (sc && sc.slots && sc.slots.length) ? 'Horários propostos · aguarda resposta' : 'Propor horários da formação prática', btn: (sc && sc.slots && sc.slots.length) ? 'Editar' : 'Propor', act: () => setSchedFor(c) });
    else tasks.push({ key: 'cmp' + c.id, c, kind: 'concluir', label: `Confirmar conclusão · ${P.fmtDate(sc.slots[sc.chosen].date)}`, btn: 'Concluir', act: () => setCompleteFor(c) });
  });
  S.contactRequests.filter((r) => r.status === 'novo').forEach((r) => tasks.push({ key: 'ct' + r.id, name: r.name, kind: 'contacto', label: 'Dúvida do voluntário' + (r.question ? ' — “' + r.question.slice(0, 40) + (r.question.length > 40 ? '…' : '') + '”' : ''), btn: 'Responder', act: () => setSection('contactos') }));
  const kindIcon = { validar: 'doc', agendar: 'clock', concluir: 'check', contacto: 'chat' };
  const kindTone = { validar: 'amber', agendar: 'neutral', concluir: 'green', contacto: 'amber' };

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
  const { candidates, setSel, store } = ctx;
  const P = window.PEDAL;
  const [reg, setReg] = useStateD('todas');
  const [per, setPer] = useStateD([]);
  const [wd, setWd] = useStateD([]);
  const toggle = (arr, set, id) => set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  let list = candidates.filter((c) => c.stage === 'espera');
  if (reg !== 'todas') list = list.filter((c) => c.localityId === reg);
  if (per.length) list = list.filter((c) => (c.periods || []).some((p) => per.includes(p)));
  if (wd.length) list = list.filter((c) => (c.weekdays || []).some((d) => wd.includes(d)));
  const regsWith = [...new Set(candidates.filter((c) => c.stage === 'espera').map((c) => c.localityId))];

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
        {(reg !== 'todas' || per.length || wd.length) ? (
          <button className="pedal-clearfilter" onClick={() => { setReg('todas'); setPer([]); setWd([]); }}>Limpar filtros</button>
        ) : null}
      </div>

      {list.length === 0 ? (
        <div className="pedal-taskempty" style={{ marginTop: 14 }}><Icon name="clock" size={16} color="var(--ink-soft)" />Ninguém corresponde a estes filtros.</div>
      ) : (
        <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
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
                  if (isLiveCandidate(c)) { store.up({ waitingListResumed: true }); store.setStage('validacao'); }
                  else { store.setOverride(c.id, 'validacao'); }
                  store.notify({ type: 'retomado', who: c.name, text: 'foi retomado(a) da lista de espera — aguarda validação' });
                  setSel(null);
                }}>Retomar</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Formação prática (agendamentos) ─────────────────────────────────
function AgendamentosSection({ ctx }) {
  const { candidates, setSel, setSchedFor, setCompleteFor, schedOf, store } = ctx;
  const P = window.PEDAL;
  const trainerOf = (id) => (store.S.trainers || []).find((t) => t.id === id) || null;
  const stationOf = (id) => (store.S.stations || []).find((s) => s.id === id) || null;
  const list = candidates.filter((c) => c.stage === 'pratica');
  const toAgendar = list.filter((c) => { const sc = schedOf(c); return !sc || sc.chosen == null; });
  const agendados = list.filter((c) => { const sc = schedOf(c); return sc && sc.chosen != null; });
  const aFormalizar = candidates.filter((c) => c.stage === 'formalizacao');

  // ordenação do planeamento confirmado por data ascendente (mais próximo primeiro)
  const planning = [...agendados].sort((a, b) => {
    const sa = schedOf(a), sb = schedOf(b);
    const da = sa.slots[sa.chosen]; const db = sb.slots[sb.chosen];
    return (da.date + da.time).localeCompare(db.date + db.time);
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
        <p className="pedal-tasknote">Propõe até 3 alternativas de data e hora; o voluntário escolhe na app. As escolhas aparecem em baixo, no Planeamento.</p>
      </div>

      {/* Planeamento confirmado — destaque visual e ação principal */}
      <div className="pedal-panel">
        <div className="pedal-panelhead">
          <span style={{ font: '700 15px var(--display)', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="clock" size={16} color="var(--primary)" />
            Planeamento da formação prática
            {planning.length > 0 && <span className="pedal-taskbadge">{planning.length}</span>}
          </span>
          <Pill tone="green">confirmados pelo voluntário</Pill>
        </div>
        {planning.length === 0 ? (
          <div className="pedal-taskempty"><Icon name="clock" size={16} color="var(--ink-soft)" />Ainda sem formações marcadas. Assim que um voluntário aceitar uma data, aparece aqui.</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {planning.map((c) => {
              const sc = schedOf(c);
              const slot = sc.slots[sc.chosen];
              const tr = trainerOf(sc.trainerId);
              const stn = stationOf(sc.stationId);
              return (
                <PlanningRow
                  key={c.id}
                  c={c}
                  slot={slot}
                  trainer={tr}
                  station={stn}
                  notes={sc.notes || ''}
                  onEdit={() => setSchedFor(c)}
                  onComplete={() => setCompleteFor(c)}
                  onSaveNotes={(notes) => store.setScheduling(c.id, { notes })}
                  onSeeProfile={() => setSel(c)}
                />
              );
            })}
          </div>
        )}
        <p className="pedal-tasknote">Lista única de tudo o que está marcado, ordenada pela data mais próxima. Edita data/coach/local em "Editar"; depois da sessão, confirma a conclusão.</p>
      </div>
    </div>
  );
}

// uma linha do planeamento confirmado — densa em informação mas legível
function PlanningRow({ c, slot, trainer, station, notes, onEdit, onComplete, onSaveNotes, onSeeProfile }) {
  const P = window.PEDAL;
  const [n, setN] = useStateD(notes);
  const [editing, setEditing] = useStateD(false);
  const dirty = n !== notes;
  const day = new Date(slot.date);
  const wd = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][day.getDay()];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr auto', gap: 18, alignItems: 'stretch', background: 'var(--app-bg)', border: '1px solid var(--line)', borderRadius: 14, padding: 14 }}>
      {/* Coluna 1: cápsula de data destacada */}
      <div style={{ background: 'var(--primary-soft)', borderRadius: 12, padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--primary-soft)' }}>
        <div style={{ font: '700 10.5px var(--ui)', color: 'var(--primary-deep)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{wd}</div>
        <div style={{ font: '800 22px var(--display)', color: 'var(--primary-deep)', lineHeight: 1 }}>{String(day.getDate()).padStart(2, '0')}</div>
        <div style={{ font: '600 10.5px var(--ui)', color: 'var(--primary-deep)' }}>{['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][day.getMonth()]}</div>
        <div style={{ marginTop: 6, padding: '3px 8px', background: 'var(--surface)', borderRadius: 99, font: '800 11.5px var(--ui)', color: 'var(--primary-deep)' }}>{slot.time}</div>
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
  const cols = ['Nome', 'Email', 'Telefone', 'Data de nascimento', 'Localidade', 'Estado', 'Disponibilidade', 'Dias da semana', 'Data de contacto', 'Agendamento formação', 'Formador', 'Origem'];
  const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const lines = [cols.join(';')];
  rows.forEach((c) => {
    const sc = store.S.scheduling[c.id];
    const ag = sc && sc.chosen != null && sc.slots[sc.chosen] ? `${P.fmtDate(sc.slots[sc.chosen].date)} ${sc.slots[sc.chosen].time}` : '';
    const trainer = sc && sc.trainerId ? ((store.S.trainers || []).find((t) => t.id === sc.trainerId) || {}).name || '' : '';
    const per = (c.periods || []).map((p) => (P.PERIODS.find((x) => x.id === p) || {}).name).join(', ');
    const wd = (c.weekdays || []).map((d) => (P.WEEKDAYS.find((x) => x.id === d) || {}).name).join(', ');
    lines.push([c.name, c.email, c.contact, c.dob, c.locality, P.stageLabel(c.stage), per, wd, c.contactDate, ag, trainer, c.source].map(esc).join(';'));
  });
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
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
    { id: 'rejeitados', label: 'Candidatos rejeitados', rows: candidates.filter((c) => c.stage === 'rejeitado') },
  ];
  return (
    <div style={{ position: 'relative' }}>
      <button className="pedal-exportbtn" onClick={() => setOpen((o) => !o)}><Icon name="doc" size={15} />Exportar Excel<Icon name="arrow" size={13} /></button>
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
  const send = (id) => { const t = draft.trim(); if (t.length < 2) return; store.answerContactRequest(id, t, store.S.coordProfile && store.S.coordProfile.name); setOpenReply(null); setDraft(''); };
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
  const trainers = store.S.trainers;
  const [openT, setOpenT] = useStateD(null);
  const [f, setF] = useStateD({ name: '', dob: '', phone: '', email: '', locality: '' });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim());
  const valid = f.name.trim().length > 1 && f.dob && f.phone.trim().length > 6 && emailOk;
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
          <FieldLite label="Nome"><input className="pedal-input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Nome e apelido" /></FieldLite>
          <FieldLite label="Data de nascimento"><input className="pedal-input" type="date" value={f.dob} onChange={(e) => set('dob', e.target.value)} /></FieldLite>
          <FieldLite label="Email"><input className="pedal-input" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="nome@pedalarsemidade.pt" /></FieldLite>
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

function SchedulingModal({ c, store, onClose }) {
  const P = window.PEDAL;
  const sc = store.S.scheduling[c.id] || {};
  const existing = sc.slots || [];
  const [rows, setRows] = useStateD(() => [0, 1, 2].map((i) => existing[i] || { date: '', time: '' }));
  const [trainerId, setTrainerId] = useStateD(sc.trainerId || '');
  const [stationId, setStationId] = useStateD(sc.stationId || '');
  const setRow = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const valid = rows.filter((r) => r.date && r.time);
  // Para enviar uma proposta é obrigatório ter os três: pelo menos um horário, um coach e um local de encontro.
  const missing = [];
  if (valid.length === 0) missing.push('pelo menos uma alternativa de data e hora');
  if (!trainerId) missing.push('atribuir um formador (coach)');
  if (!stationId) missing.push('escolher o local de encontro');
  const canSubmit = missing.length === 0;

  const trainers = store.S.trainers || [];
  const sorted = [...trainers].sort((a, b) => {
    const am = a.locality === c.locality ? 0 : 1, bm = b.locality === c.locality ? 0 : 1;
    return am - bm || a.name.localeCompare(b.name);
  });
  const initials = (n) => n.split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();

  // confirmação de horário só para candidatos seed; o "live" escolhe na app
  const [confirmIdx, setConfirmIdx] = useStateD(() => (!c.live && sc.chosen != null ? sc.chosen : null));

  const confirm = () => {
    const chosen = c.live ? (sc.chosen != null ? sc.chosen : null) : (confirmIdx != null && confirmIdx < valid.length ? confirmIdx : null);
    store.setScheduling(c.id, { slots: valid, chosen, trainerId: trainerId || null, stationId: stationId || null });
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
            <div key={i} className="pedal-slotedit">
              <span className="pedal-slotnum">{i + 1}</span>
              <input className="pedal-input" type="date" value={r.date} onChange={(e) => setRow(i, { date: e.target.value })} />
              <input className="pedal-input" type="time" value={r.time} onChange={(e) => setRow(i, { time: e.target.value })} />
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
        {(store.S.stations || []).length === 0 ? (
          <div className="pedal-taskempty"><Icon name="pin" size={16} color="var(--ink-soft)" />Sem locais — adiciona em Gestão → Locais de encontro.</div>
        ) : (
          <select className="pedal-select" style={{ width: '100%', minWidth: 0 }} value={stationId} onChange={(e) => setStationId(e.target.value)}>
            <option value="">— escolher local —</option>
            {[...(store.S.stations || [])].sort((a, b) => ((a.locality === c.locality ? 0 : 1) - (b.locality === c.locality ? 0 : 1))).map((s) => (
              <option key={s.id} value={s.id}>{s.name} · {s.locality}</option>
            ))}
          </select>
        )}

        {!c.live && valid.length > 0 && (
          <>
            <div style={lbl}>Horário confirmado (opcional)</div>
            <div className="pedal-slotconfirm">
              {valid.map((s, i) => (
                <button key={i} className={'pedal-pick small' + (confirmIdx === i ? ' on' : '')} onClick={() => setConfirmIdx(confirmIdx === i ? null : i)}>
                  {P.fmtDate(s.date)} · {s.time}
                </button>
              ))}
            </div>
            <p className="pedal-tasknote" style={{ marginTop: 6 }}>Marca o horário acordado por telefone para mover o voluntário para “Agendados”.</p>
          </>
        )}

        <button className="pedal-btn primary" disabled={!canSubmit} style={{ width: '100%', marginTop: 18, opacity: canSubmit ? 1 : 0.45 }} onClick={confirm}>
          {c.live ? `Enviar ao voluntário${valid.length ? ` (${valid.length})` : ''}` : `Guardar${valid.length ? ` (${valid.length})` : ''}`}
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
        <p className="pedal-tasknote" style={{ marginTop: 12 }}>{(c.live || c.id === store.S.candidateId) ? 'O voluntário vê as opções na app e escolhe uma. O formador acompanha-o no dia.' : 'As propostas ficam registadas para este candidato.'}</p>
      </div>
    </div>
  );
}

function CandidateDetail({ c, store, onClose }) {
  const P = window.PEDAL;
  const [showChat, setShowChat] = useStateD(false);
  const [rejecting, setRejecting] = useStateD(false);
  const [reason, setReason] = useStateD('');
  const isLiveC = c.live || c.id === store.S.candidateId;
  const curIdx = P.stageIndex(c.stage);
  const iv = c.interview || {};
  const ivLabels = { exp: 'Experiência', triciclo: 'Triciclo', carta: 'Carta', nif: 'NIF (seguro)', motivacao: 'Motivação' };
  const age = c.dob ? Math.floor((Date.now() - new Date(c.dob).getTime()) / 3.15576e10) : null;
  const transcript = isLiveC ? store.S.messages.filter((m) => m.text) : [];

  function doReject() {
    if (isLiveC) { store.setStage('rejeitado'); store.up({ rejection: { reason } }); } else { store.setOverride(c.id, 'rejeitado'); }
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
          {c.nif && <DetailItem label="NIF (seguro)" value={c.nif} />}
          <DetailItem label="No funil há" value={c.days === 0 ? 'hoje' : c.days + ' dias'} />
        </div>

        {c.rejectReason && (
          <div style={{ marginTop: 12, background: 'var(--app-bg)', borderRadius: 11, padding: '10px 12px', font: '500 12.5px/1.5 var(--ui)', color: 'var(--ink-soft)' }}><strong style={{ color: 'var(--ink)' }}>Motivo da rejeição:</strong> {c.rejectReason}</div>
        )}

        {(() => {
          const sc2 = store.S.scheduling[c.id];
          if (!sc2 || !((sc2.slots && sc2.slots.length) || sc2.trainerId)) return null;
          const chosen = sc2.chosen != null && sc2.slots ? sc2.slots[sc2.chosen] : null;
          const tr = sc2.trainerId ? (store.S.trainers || []).find((t) => t.id === sc2.trainerId) : null;
          const stn = sc2.stationId ? (store.S.stations || []).find((s) => s.id === sc2.stationId) : null;
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

        {isLiveC && transcript.length > 0 && (
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

        {c.stage === 'validacao' && !rejecting && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="pedal-taskbtn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setRejecting(true)}>Rejeitar</button>
              <button className="pedal-taskbtn" style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => {
                  if (isLiveC) { store.up({ pushedToWaitingList: true }); store.setStage('espera'); }
                  else { store.setOverride(c.id, 'espera'); }
                  store.notify({ type: 'espera', who: c.name, text: 'foi colocado(a) em lista de espera pela coordenação' });
                  onClose();
                }}>Lista de espera</button>
            </div>
            <button className="pedal-btn primary" style={{ width: '100%' }}
              onClick={() => {
                if (isLiveC) { store.up({ validated: true }); store.setStage('onboarding'); }
                else { store.setOverride(c.id, 'onboarding'); }
                store.notify({ type: 'validado', who: c.name, text: 'foi validado(a) pela coordenação — segue para onboarding' });
                onClose();
              }}>
              Validar candidatura ✓
            </button>
          </div>
        )}

        {rejecting && (
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
  const { store, candidates } = ctx;
  const [g, setG] = useStateD('users');
  const items = [
    { id: 'users', label: 'Utilizadores de gestão', icon: 'people' },
    { id: 'formadores', label: 'Pilotos formadores', icon: 'shield' },
    { id: 'necessidades', label: 'Necessidades / vagas', icon: 'route' },
    { id: 'conteudos', label: 'Vídeos & conteúdos', icon: 'play' },
    { id: 'locais', label: 'Locais de encontro', icon: 'pin' },
    { id: 'export', label: 'Exportar base de dados', icon: 'doc' },
  ];
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
        {g === 'export' && <ExportAllPanel candidates={candidates} store={store} />}
      </div>
    </div>
  );
}

// Utilizadores da consola de gestão
function GestaoUsers({ store }) {
  const users = store.S.mgmtUsers || [];
  const [f, setF] = useStateD({ name: '', email: '', phone: '', role: 'Coordenação' });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim());
  const valid = f.name.trim().length > 1 && emailOk;
  const submit = () => { if (!valid) return; store.addMgmtUser({ name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(), role: f.role }); setF({ name: '', email: '', phone: '', role: 'Coordenação' }); };
  return (
    <div className="pedal-dashgrid">
      <div className="pedal-panel">
        <div className="pedal-panelhead"><span style={{ font: '700 15px var(--display)', color: 'var(--ink)' }}>Utilizadores de gestão</span><Pill tone="neutral">{users.length}</Pill></div>
        {users.length === 0 ? (
          <div className="pedal-taskempty"><Icon name="people" size={16} color="var(--ink-soft)" />Ainda sem utilizadores.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {users.map((u) => (
              <div key={u.id} className="pedal-taskrow">
                <div className="pedal-kav" style={{ background: 'var(--accent-soft)', color: 'var(--accent-deep)' }}>{u.name.split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '700 13.5px var(--ui)', color: 'var(--ink)' }}>{u.name} <span style={{ font: '500 11.5px var(--ui)', color: 'var(--accent-deep)' }}>· {u.role}</span></div>
                  <div style={{ font: '500 11.5px var(--ui)', color: 'var(--ink-soft)' }}>{u.email}{u.phone ? ` · ${u.phone}` : ''}</div>
                </div>
                <button className="pedal-iconbtn" title="Remover" onClick={() => store.removeMgmtUser(u.id)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="pedal-panel">
        <div className="pedal-panelhead"><span style={{ font: '700 15px var(--display)', color: 'var(--ink)' }}>Adicionar utilizador</span></div>
        <div style={{ display: 'grid', gap: 10 }}>
          <FieldLite label="Nome"><input className="pedal-input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Nome e apelido" /></FieldLite>
          <FieldLite label="Email"><input className="pedal-input" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="nome@pedalarsemidade.pt" /></FieldLite>
          <FieldLite label="Telefone"><input className="pedal-input" type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="9XX XXX XXX" /></FieldLite>
          <FieldLite label="Função">
            <select className="pedal-select" style={{ minWidth: 0, width: '100%' }} value={f.role} onChange={(e) => set('role', e.target.value)}>
              <option>Coordenação</option><option>Gestão de formação</option><option>Administração</option><option>Apoio</option>
            </select>
          </FieldLite>
          <button className="pedal-btn primary" disabled={!valid} style={{ width: '100%', opacity: valid ? 1 : 0.45, marginTop: 4 }} onClick={submit}>Adicionar utilizador</button>
        </div>
      </div>
    </div>
  );
}

// Base de necessidades / vagas abertas (localidade + disponibilidades)
function NeedsAdmin({ store }) {
  const P = window.PEDAL;
  const needs = store.S.needs || [];
  const [f, setF] = useStateD({ locality: '', periods: [] });
  const [newLoc, setNewLoc] = useStateD(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const togglePeriod = (id) => setF((p) => ({ ...p, periods: p.periods.includes(id) ? p.periods.filter((x) => x !== id) : [...p.periods, id] }));
  const perName = (id) => (P.PERIODS.find((x) => x.id === id) || {}).name || id;
  const locOptions = (() => {
    const seen = []; P.LOCALITIES.forEach((l) => { if (!seen.includes(l.name)) seen.push(l.name); });
    (store.S.stations || []).forEach((s) => { if (s.locality && !seen.includes(s.locality)) seen.push(s.locality); });
    needs.forEach((n) => { if (n.locality && !seen.includes(n.locality)) seen.push(n.locality); });
    return seen;
  })();
  const dup = needs.some((n) => (n.locality || '').toLowerCase() === f.locality.trim().toLowerCase());
  const valid = f.locality.trim().length > 1 && !dup;
  const submit = () => { if (!valid) return; store.addNeed({ locality: f.locality.trim(), periods: f.periods }); setF({ locality: '', periods: [] }); setNewLoc(false); };
  return (
    <div className="pedal-dashgrid">
      <div className="pedal-panel">
        <div className="pedal-panelhead"><span style={{ font: '700 15px var(--display)', color: 'var(--ink)' }}>Necessidades abertas</span><Pill tone={needs.length ? 'green' : 'amber'}>{needs.length} zona{needs.length === 1 ? '' : 's'}</Pill></div>
        <p style={{ font: '400 12px/1.5 var(--ui)', color: 'var(--ink-soft)', margin: '0 0 12px' }}>Define onde e em que disponibilidades há vagas abertas. Candidatos compatíveis avançam para entrevista; todos os outros entram automaticamente em <strong style={{ color: 'var(--ink)' }}>lista de espera</strong>.</p>
        {needs.length === 0 ? (
          <div className="pedal-taskempty"><Icon name="route" size={16} color="var(--ink-soft)" />Sem vagas abertas — tudo entra em lista de espera.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {needs.map((n) => (
              <div key={n.id} className="pedal-stationrow" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: 'var(--primary)', flexShrink: 0 }}><Icon name="pin" size={17} /></span>
                  <div style={{ flex: 1, minWidth: 0, font: '700 13.5px var(--ui)', color: 'var(--ink)' }}>{n.locality}</div>
                  <button className="pedal-iconbtn" title="Remover vaga" onClick={() => store.removeNeed(n.id)}>✕</button>
                </div>
                <div>
                  <div style={{ font: '600 10.5px var(--ui)', letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 6 }}>Disponibilidades abertas</div>
                  <div className="pedal-pickgrid">
                    {P.PERIODS.filter((p) => p.id !== 'flex').map((p) => {
                      const on = (n.periods || []).includes(p.id);
                      return (
                        <button key={p.id} className={'pedal-pick small' + (on ? ' on' : '')}
                          onClick={() => store.updateNeed(n.id, { periods: on ? (n.periods || []).filter((x) => x !== p.id) : [...(n.periods || []), p.id] })}>{p.name}</button>
                      );
                    })}
                  </div>
                  {!(n.periods || []).filter((p) => p !== 'flex').length && <div style={{ font: '500 11px var(--ui)', color: 'var(--accent-deep)', marginTop: 6 }}>Aberta para qualquer disponibilidade.</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="pedal-panel">
        <div className="pedal-panelhead"><span style={{ font: '700 15px var(--display)', color: 'var(--ink)' }}>Abrir nova vaga</span></div>
        <div style={{ display: 'grid', gap: 10 }}>
          <FieldLite label="Localidade">
            {!newLoc ? (
              <select className="pedal-select" style={{ minWidth: 0, width: '100%' }} value={f.locality}
                onChange={(e) => { if (e.target.value === '__new') { setNewLoc(true); set('locality', ''); } else set('locality', e.target.value); }}>
                <option value="">—</option>
                {locOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                <option value="__new">➕ Nova localidade…</option>
              </select>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="pedal-input" autoFocus value={f.locality} onChange={(e) => set('locality', e.target.value)} placeholder="Ex.: Vila do Conde" />
                <button className="pedal-authlink" style={{ whiteSpace: 'nowrap' }} onClick={() => { setNewLoc(false); set('locality', ''); }}>Escolher da lista</button>
              </div>
            )}
          </FieldLite>
          <FieldLite label="Disponibilidades abertas">
            <div className="pedal-pickgrid">
              {P.PERIODS.filter((p) => p.id !== 'flex').map((p) => <button key={p.id} className={'pedal-pick small' + (f.periods.includes(p.id) ? ' on' : '')} onClick={() => togglePeriod(p.id)}>{p.name}</button>)}
            </div>
          </FieldLite>
          {dup && <div style={{ font: '600 11.5px var(--ui)', color: 'var(--accent-deep)' }}>Já existe uma vaga para esta localidade.</div>}
          <p style={{ font: '400 11px/1.5 var(--ui)', color: 'var(--ink-soft)', margin: 0 }}>Sem disponibilidade escolhida, a zona fica aberta para <strong style={{ color: 'var(--ink)' }}>qualquer</strong> disponibilidade.</p>
          <button className="pedal-btn primary" disabled={!valid} style={{ width: '100%', opacity: valid ? 1 : 0.45, marginTop: 2 }} onClick={submit}>Abrir vaga</button>
        </div>
      </div>
    </div>
  );
}

// Locais de encontro / parqueamento das bicicletas
function StationsAdmin({ store }) {
  const P = window.PEDAL;
  const stations = store.S.stations || [];
  const [f, setF] = useStateD({ name: '', locality: '', address: '', note: '' });
  const [newLoc, setNewLoc] = useStateD(false);  // a escrever uma localidade nova
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  // localidades disponíveis = base do projeto + as já usadas em locais criados (sem duplicar)
  const locOptions = (() => {
    const seen = []; P.LOCALITIES.forEach((l) => { if (!seen.includes(l.name)) seen.push(l.name); });
    stations.forEach((s) => { if (s.locality && !seen.includes(s.locality)) seen.push(s.locality); });
    return seen;
  })();
  const valid = f.name.trim().length > 1 && f.locality.trim();
  const submit = () => { if (!valid) return; store.addStation({ name: f.name.trim(), locality: f.locality.trim(), address: f.address.trim(), note: f.note.trim() }); setF({ name: '', locality: '', address: '', note: '' }); setNewLoc(false); };
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
            {!newLoc ? (
              <select className="pedal-select" style={{ minWidth: 0, width: '100%' }} value={f.locality}
                onChange={(e) => { if (e.target.value === '__new') { setNewLoc(true); set('locality', ''); } else set('locality', e.target.value); }}>
                <option value="">—</option>
                {locOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                <option value="__new">➕ Nova localidade…</option>
              </select>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="pedal-input" autoFocus value={f.locality} onChange={(e) => set('locality', e.target.value)} placeholder="Ex.: Vila do Conde" />
                <button className="pedal-authlink" style={{ whiteSpace: 'nowrap' }} onClick={() => { setNewLoc(false); set('locality', ''); }}>Escolher da lista</button>
              </div>
            )}
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
  const formadores = (store.S.trainers || []).length;

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
