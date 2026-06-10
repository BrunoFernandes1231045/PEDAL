/* pedal-auth.jsx — Fase 3: login do voluntário (AuthGate) e área de Perfil */

const { useState: useStateAu } = React;

// ── Porta de entrada do agente: login ou nova candidatura ───────────
function AuthGate({ store }) {
  const S = store.S;
  const hasAccount = !!S.account;
  const [mode, setMode] = useStateAu(hasAccount ? 'login' : 'novo');
  const [email, setEmail] = useStateAu('');
  const [pw, setPw] = useStateAu('');
  const [err, setErr] = useStateAu('');
  const [hint, setHint] = useStateAu(false);

  const tryLogin = () => {
    const acc = S.account;
    if (!acc) { setErr('Ainda não tens conta. As credenciais são enviadas por email depois da inscrição.'); return; }
    if (email.trim().toLowerCase() === (acc.email || '').toLowerCase() && pw.trim() === acc.password) {
      setErr(''); store.setSession(true);
    } else { setErr('Email ou palavra-passe incorretos. Confirma os dados enviados por email.'); }
  };

  return (
    <div className="pedal-authscreen">
      <div className="pedal-authtop">
        <div className="pedal-authlogo"><Avatar size={62} /></div>
        <div style={{ font: '800 23px var(--display)', color: 'var(--ink)', letterSpacing: '-0.01em', marginTop: 16, lineHeight: 1.15 }}>Olá! Sou o PEDAL</div>
        <p style={{ font: '400 14px/1.55 var(--ui)', color: 'var(--ink-soft)', margin: '8px 0 0', maxWidth: 280 }}>
          O assistente digital da Pedalar Sem Idade. Entra na tua conta ou começa a tua candidatura a piloto voluntário. 🚲
        </p>
      </div>

      <div className="pedal-authcard">
        <div className="pedal-authseg">
          <button className={mode === 'login' ? 'on' : ''} onClick={() => { setMode('login'); setErr(''); }}>Já tenho conta</button>
          <button className={mode === 'novo' ? 'on' : ''} onClick={() => { setMode('novo'); setErr(''); }}>Sou novo(a)</button>
        </div>

        {mode === 'login' ? (
          <div style={{ marginTop: 16 }}>
            <Field label="Email">
              <input className="pedal-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@email.pt" />
            </Field>
            <Field label="Palavra-passe">
              <input className="pedal-input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="A que recebeste por email" />
            </Field>
            {err && <div className="pedal-autherr"><Icon name="shield" size={14} />{err}</div>}
            <button className="pedal-btn primary" style={{ width: '100%', marginTop: 6 }} onClick={tryLogin}>Entrar</button>
            {hasAccount ? (
              <div style={{ marginTop: 12 }}>
                <button className="pedal-authlink" onClick={() => setHint((h) => !h)}>{hint ? 'Ocultar credenciais de demonstração' : 'Esqueci-me dos dados de acesso'}</button>
                {hint && (
                  <div className="pedal-credhint">
                    <span style={{ font: '700 10.5px var(--ui)', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent-deep)' }}>Demonstração · enviadas por email</span>
                    <div className="pedal-credrow"><span>Email</span><strong>{S.account.email}</strong></div>
                    <div className="pedal-credrow"><span>Palavra-passe</span><strong>{S.account.password}</strong></div>
                    <button className="pedal-btn ghost" style={{ width: '100%', marginTop: 10 }} onClick={() => { setEmail(S.account.email); setPw(S.account.password); }}>Preencher automaticamente</button>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ font: '400 12px/1.5 var(--ui)', color: 'var(--ink-soft)', margin: '14px 0 0', textAlign: 'center' }}>
                Ainda sem conta? As credenciais chegam por email assim que terminares a inscrição.
              </p>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 16 }}>
            <div className="pedal-authsteps">
              {[
                { ic: 'chat', t: 'Conhece o projeto e tira dúvidas comigo' },
                { ic: 'doc', t: 'Faz a inscrição em poucos minutos' },
                { ic: 'lock', t: 'Recebes as credenciais de acesso por email' },
              ].map((s) => (
                <div key={s.t} className="pedal-authstep">
                  <span className="pedal-authstepic"><Icon name={s.ic} size={16} color="var(--primary)" /></span>
                  <span>{s.t}</span>
                </div>
              ))}
            </div>
            <button className="pedal-btn primary" style={{ width: '100%', marginTop: 18 }} onClick={() => store.setSession(true)}>Começar a minha candidatura →</button>
            <p style={{ font: '400 11.5px/1.5 var(--ui)', color: 'var(--ink-soft)', margin: '12px 0 0', textAlign: 'center' }}>
              Sem compromisso. Podes só explorar e decidir mais tarde.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Painel de login (acede ao perfil; entrada direta no agente dispensa-o) ──
function LoginPanel({ store }) {
  const S = store.S;
  const hasAccount = !!S.account;
  const [email, setEmail] = useStateAu('');
  const [pw, setPw] = useStateAu('');
  const [err, setErr] = useStateAu('');
  const [hint, setHint] = useStateAu(false);
  const tryLogin = () => {
    const acc = S.account;
    if (!acc) { setErr('Ainda não tens conta. Faz a tua inscrição na conversa com o PEDAL e recebes as credenciais por email.'); return; }
    if (email.trim().toLowerCase() === (acc.email || '').toLowerCase() && pw.trim() === acc.password) { setErr(''); store.setSession(true); }
    else setErr('Email ou palavra-passe incorretos. Confirma os dados enviados por email.');
  };
  return (
    <div className="pedal-screen">
      <TabHeader title="Entrar" subtitle="Acede à tua conta de voluntário" />
      <div className="pedal-tabbody">
        <div className="pedal-authcard" style={{ margin: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 16 }}>
            <Avatar size={54} />
            <div style={{ font: '800 18px var(--display)', color: 'var(--ink)', marginTop: 12 }}>Bem-vindo(a) de volta</div>
            <p style={{ font: '400 13px/1.5 var(--ui)', color: 'var(--ink-soft)', margin: '4px 0 0', textAlign: 'center', maxWidth: 260 }}>Entra para ver e gerir o teu perfil. Para te candidatares, é só conversar com o PEDAL — não precisas de conta. 🚲</p>
          </div>
          <Field label="Email"><input className="pedal-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@email.pt" /></Field>
          <Field label="Palavra-passe"><input className="pedal-input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="A que recebeste por email" /></Field>
          {err && <div className="pedal-autherr"><Icon name="shield" size={14} />{err}</div>}
          <button className="pedal-btn primary" style={{ width: '100%', marginTop: 6 }} onClick={tryLogin}>Entrar</button>
          {hasAccount ? (
            <div style={{ marginTop: 12 }}>
              <button className="pedal-authlink" onClick={() => setHint((h) => !h)}>{hint ? 'Ocultar credenciais de demonstração' : 'Esqueci-me dos dados de acesso'}</button>
              {hint && (
                <div className="pedal-credhint">
                  <span style={{ font: '700 10.5px var(--ui)', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent-deep)' }}>Demonstração · enviadas por email</span>
                  <div className="pedal-credrow"><span>Email</span><strong>{S.account.email}</strong></div>
                  <div className="pedal-credrow"><span>Palavra-passe</span><strong>{S.account.password}</strong></div>
                  <button className="pedal-btn ghost" style={{ width: '100%', marginTop: 10 }} onClick={() => { setEmail(S.account.email); setPw(S.account.password); }}>Preencher automaticamente</button>
                </div>
              )}
            </div>
          ) : (
            <button className="pedal-btn ghost" style={{ width: '100%', marginTop: 10 }} onClick={() => store.goTab('conversa')}>Falar com o PEDAL e inscrever-me →</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Área de Perfil do voluntário (inscrição ativa) ──────────────────
function ProfileView({ store }) {
  const S = store.S; const P = window.PEDAL;
  const authed = S.session && S.session.authed;
  if (!authed) return <LoginPanel store={store} />;
  const c = S.candidate;
  const acc = S.account || {};
  const initials = (c.name || 'N C').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();

  const [editing, setEditing] = useStateAu(false);
  const [form, setForm] = useStateAu({ name: c.name, dob: c.dob, contact: c.contact, email: c.email, locality: c.locality });
  const setF = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((form.email || '').trim());
  const canSave = (form.name || '').trim().length > 1 && (form.contact || '').trim().length > 6 && emailOk;

  const [pwOpen, setPwOpen] = useStateAu(false);
  const [pw1, setPw1] = useStateAu('');
  const [pw2, setPw2] = useStateAu('');
  const [pwMsg, setPwMsg] = useStateAu('');
  const [confirmDel, setConfirmDel] = useStateAu(false);

  const save = () => {
    if (!canSave) return;
    store.patchCandidate({ name: form.name.trim(), dob: form.dob, contact: form.contact.trim(), email: form.email.trim(), locality: form.locality });
    if (form.email.trim() && form.email.trim() !== acc.email) store.up({ account: { ...acc, email: form.email.trim() } });
    setEditing(false);
  };
  const savePw = () => {
    if (pw1.length < 4) { setPwMsg('A palavra-passe deve ter pelo menos 4 caracteres.'); return; }
    if (pw1 !== pw2) { setPwMsg('As palavras-passe não coincidem.'); return; }
    store.changePassword(pw1); setPw1(''); setPw2(''); setPwMsg(''); setPwOpen(false);
  };

  const locName = (c.localities && c.localities.length ? c.localities : [c.locality]).map((id) => (P.LOCALITIES.find((l) => l.id === id) || {}).name).filter(Boolean).join(', ') || '—';

  return (
    <div className="pedal-screen">
      <TabHeader title="Perfil" subtitle="A tua conta de voluntário" />
      <div className="pedal-tabbody">
        <div className="pedal-statuscard" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="pedal-kav big" style={{ background: 'var(--primary-soft)', color: 'var(--primary-deep)' }}>{initials}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ font: '800 19px var(--display)', color: 'var(--ink)', lineHeight: 1.15 }}>{c.name || 'Voluntário'}</div>
            <div style={{ font: '500 12.5px var(--ui)', color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{acc.email || c.email}</div>
            <div style={{ marginTop: 6 }}><Pill tone={S.stage === 'ativo' ? 'green' : 'amber'}><Icon name="sparkle" size={11} />{P.stageLabel(S.stage)}</Pill></div>
          </div>
        </div>

        {/* Dados pessoais */}
        <div className="pedal-profsec">
          <div className="pedal-profsechead">
            <span>Dados pessoais</span>
            {!editing && <button className="pedal-authlink" onClick={() => { setForm({ name: c.name, dob: c.dob, contact: c.contact, email: c.email, locality: c.locality }); setEditing(true); }}>Editar</button>}
          </div>
          {!editing ? (
            <div className="pedal-proflist">
              <ProfRow label="Nome" value={c.name || '—'} />
              <ProfRow label="Data de nascimento" value={c.dob ? P.fmtDate(c.dob) : '—'} />
              <ProfRow label="Telemóvel" value={c.contact || '—'} />
              <ProfRow label="Email" value={c.email || '—'} />
              <ProfRow label="Localidade" value={locName} last />
            </div>
          ) : (
            <div style={{ padding: '4px 2px' }}>
              <Field label="Nome"><input className="pedal-input" value={form.name} onChange={(e) => setF('name', e.target.value)} /></Field>
              <Field label="Data de nascimento"><input className="pedal-input" type="date" value={form.dob} onChange={(e) => setF('dob', e.target.value)} /></Field>
              <Field label="Telemóvel"><input className="pedal-input" type="tel" value={form.contact} onChange={(e) => setF('contact', e.target.value)} /></Field>
              <Field label="Email"><input className="pedal-input" type="email" value={form.email} onChange={(e) => setF('email', e.target.value)} /></Field>
              <Field label="Localidade">
                <select className="pedal-select" style={{ width: '100%', minWidth: 0 }} value={form.locality} onChange={(e) => setF('locality', e.target.value)}>
                  {P.LOCALITIES.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </Field>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button className="pedal-btn ghost" style={{ flex: 1 }} onClick={() => setEditing(false)}>Cancelar</button>
                <button className="pedal-btn primary" style={{ flex: 1, opacity: canSave ? 1 : 0.45 }} disabled={!canSave} onClick={save}>Guardar</button>
              </div>
            </div>
          )}
        </div>

        {/* Segurança */}
        <div className="pedal-profsec">
          <div className="pedal-profsechead">
            <span>Segurança</span>
            {!pwOpen && <button className="pedal-authlink" onClick={() => { setPwOpen(true); setPwMsg(''); }}>Mudar palavra-passe</button>}
          </div>
          {!pwOpen ? (
            <div className="pedal-proflist"><ProfRow label="Palavra-passe" value="••••••••" last /></div>
          ) : (
            <div style={{ padding: '4px 2px' }}>
              <Field label="Nova palavra-passe"><input className="pedal-input" type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} placeholder="Mínimo 4 caracteres" /></Field>
              <Field label="Confirmar palavra-passe"><input className="pedal-input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Repete a nova palavra-passe" /></Field>
              {pwMsg && <div className="pedal-autherr"><Icon name="shield" size={14} />{pwMsg}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button className="pedal-btn ghost" style={{ flex: 1 }} onClick={() => { setPwOpen(false); setPw1(''); setPw2(''); setPwMsg(''); }}>Cancelar</button>
                <button className="pedal-btn primary" style={{ flex: 1 }} onClick={savePw}>Guardar</button>
              </div>
            </div>
          )}
        </div>

        {/* Sessão + conta */}
        <button className="pedal-listrow" style={{ marginTop: 14 }} onClick={() => store.setSession(false)}>
          <span className="pedal-headbtn" style={{ width: 34, height: 34 }}><Icon name="arrow" size={16} color="var(--primary)" /></span>
          <span style={{ flex: 1, textAlign: 'left', font: '700 13.5px var(--ui)', color: 'var(--ink)' }}>Terminar sessão</span>
        </button>

        {!confirmDel ? (
          <button className="pedal-listrow" style={{ marginTop: 8, borderColor: 'var(--accent-soft)' }} onClick={() => setConfirmDel(true)}>
            <span className="pedal-headbtn" style={{ width: 34, height: 34, background: 'var(--accent-soft)', color: 'var(--accent-deep)', borderColor: 'var(--accent-soft)' }}>✕</span>
            <span style={{ flex: 1, textAlign: 'left', font: '700 13.5px var(--ui)', color: 'var(--accent-deep)' }}>Apagar a minha conta</span>
          </button>
        ) : (
          <div className="pedal-card" style={{ marginTop: 8, borderColor: 'var(--accent)' }}>
            <div style={{ font: '700 14px var(--display)', color: 'var(--ink)' }}>Apagar a conta?</div>
            <p style={{ font: '400 12.5px/1.5 var(--ui)', color: 'var(--ink-soft)', margin: '6px 0 0' }}>
              Os teus dados são eliminados ao abrigo do RGPD e o teu processo de voluntariado termina. Esta ação não pode ser desfeita.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="pedal-btn ghost" style={{ flex: 1 }} onClick={() => setConfirmDel(false)}>Manter conta</button>
              <button className="pedal-btn primary" style={{ flex: 1, background: 'var(--accent-deep)' }} onClick={() => store.reset()}>Apagar definitivamente</button>
            </div>
          </div>
        )}
        <p style={{ font: '400 11px/1.5 var(--ui)', color: 'var(--ink-soft)', margin: '14px 0 0', textAlign: 'center' }}>
          A Pedalar Sem Idade trata os teus dados ao abrigo do RGPD.
        </p>
      </div>
    </div>
  );
}

function ProfRow({ label, value, last }) {
  return (
    <div className="pedal-profrow" style={last ? { borderBottom: 'none' } : null}>
      <span style={{ font: '500 12.5px var(--ui)', color: 'var(--ink-soft)' }}>{label}</span>
      <span style={{ font: '700 13.5px var(--ui)', color: 'var(--ink)', textAlign: 'right', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

Object.assign(window, { AuthGate, ProfileView, LoginPanel });
