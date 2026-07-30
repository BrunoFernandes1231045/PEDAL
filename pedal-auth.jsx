/* pedal-auth.jsx — Fase 3: login do voluntário (AuthGate) e área de Perfil */

const { useState: useStateAu } = React;

// ── Porta de entrada do agente: login ou nova candidatura ───────────
function AuthGate({ store }) {
  const S = store.S;
  const [mode, setMode] = useStateAu('novo');
  const [email, setEmail] = useStateAu('');
  const [pw, setPw] = useStateAu('');
  const [err, setErr] = useStateAu('');
  const [loading, setLoading] = useStateAu(false);

  const tryLogin = async () => {
    if (!email.trim() || !pw.trim()) return;
    setLoading(true); setErr('');
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ email: email.trim(), password: pw.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error_description || 'Email ou palavra-passe incorretos.'); return; }

      const jwt = data.access_token;
      // role/coord_role vêm de app_metadata — user_metadata é editável pelo
      // próprio utilizador e não serve para decisões de acesso (PED-61).
      const appMeta = (data.user && data.user.app_metadata) || {};

      if (appMeta.role === 'coordinator') {
        window.location.href = 'coordenacao.html';
        return;
      }

      const meRes = await fetch('/api/candidates/me', {
        headers: { 'Authorization': `Bearer ${jwt}` },
      });
      if (!meRes.ok) { setErr('Conta encontrada, mas sem perfil de candidato associado.'); return; }
      const profile = await meRes.json();

      const STAGE_TO_NODE = { inscricao: 'triage', apresentacao: 'present', triagem: 'triage_result', espera: 'await_waitinglist', entrevista: 'interview', validacao: 'await_validation', onboarding: 'goto_onboarding', pratica: 'await_reschedule', ativo: 'active_home' };
      // O nó gravado no backend é a fonte de verdade (persiste entre sessões/dispositivos);
      // só cai para o nó genérico do estágio se este candidato nunca gravou um nó.
      const node = profile.chat_node || STAGE_TO_NODE[profile.stage] || 'triage';
      const perData = window.PEDAL && window.PEDAL.PERIODS;
      const locs = window.PEDAL && window.PEDAL.LOCALITIES;
      const periods = profile.periods ? profile.periods.split(', ').filter(Boolean).map((n) => { const f = perData && perData.find((p) => p.name === n); return f ? f.id : n; }) : [];
      const localities = profile.locality ? profile.locality.split(', ').filter(Boolean).map((n) => { const f = locs && locs.find((l) => l.name === n); return f ? f.id : n; }) : [];
      const availability = Array.isArray(profile.availability) ? profile.availability : [];
      const savedMessages = Array.isArray(profile.chat_messages) && profile.chat_messages.length ? profile.chat_messages : [];
      store.up({ candidateId: profile.id, account: { email: email.trim(), refreshToken: data.refresh_token }, ...(savedMessages.length ? { messages: savedMessages } : {}) });
      store.patchCandidate({ name: profile.name || '', email: profile.email || '', dob: profile.dob || '', contact: profile.phone || '', cc: profile.cc || '', localities, periods, availability });
      store.setStage(profile.stage || 'inscricao');
      if (profile.scheduling && profile.scheduling.slots && profile.scheduling.slots.length) {
        store.setScheduling('live', profile.scheduling);
      }
      store.setChat({ node, restoreInteraction: true });
      store.setSession(true);
      store.setCandidateJwt(jwt);
    } catch (_) {
      setErr('Erro de ligação ao servidor.');
    } finally {
      setLoading(false);
    }
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
              <input className="pedal-input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="A palavra-passe que definiste" />
            </Field>
            {err && <div className="pedal-autherr"><Icon name="shield" size={14} />{err}</div>}
            <button className="pedal-btn primary" style={{ width: '100%', marginTop: 6 }} disabled={loading || !email.trim() || !pw.trim()} onClick={tryLogin}>{loading ? 'A entrar…' : 'Entrar'}</button>
            <div style={{ textAlign: 'center', marginTop: 10 }}>
              <a href="/recuperar-palavra-passe" className="pedal-authlink">Esqueceu-se da palavra-passe?</a>
            </div>
            <p style={{ font: '400 12px/1.5 var(--ui)', color: 'var(--ink-soft)', margin: '14px 0 0', textAlign: 'center' }}>
              Depois da inscrição, recebes uma ligação para confirmar o email e definir a tua palavra-passe.
            </p>
          </div>
        ) : (
          <div style={{ marginTop: 16 }}>
            <div className="pedal-authsteps">
              {[
                { ic: 'chat', t: 'Conhece o projeto e tira dúvidas comigo' },
                { ic: 'doc', t: 'Faz a inscrição em poucos minutos' },
                { ic: 'lock', t: 'Confirmas o email e defines a tua palavra-passe' },
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
const PEDAL_AUTH_CONFIG = window.__PEDAL_AUTH_CONFIG || {};
const SUPABASE_URL = PEDAL_AUTH_CONFIG.supabaseUrl || '';
const SUPABASE_ANON_KEY = PEDAL_AUTH_CONFIG.supabaseAnonKey || '';

function LoginPanel({ store }) {
  const S = store.S;
  const hasAccount = !!S.account;
  const [email, setEmail] = useStateAu('');
  const [pw, setPw] = useStateAu('');
  const [err, setErr] = useStateAu('');
  const [hint, setHint] = useStateAu(false);
  const [loading, setLoading] = useStateAu(false);

  const tryLogin = async () => {
    if (!email.trim() || !pw.trim()) return;
    setLoading(true); setErr('');
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ email: email.trim(), password: pw.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error_description || 'Email ou palavra-passe incorretos.'); return; }

      const jwt = data.access_token;
      const meta = (data.user && data.user.user_metadata) || {};
      // role/coord_role vêm de app_metadata — user_metadata é editável pelo
      // próprio utilizador e não serve para decisões de acesso (PED-61).
      const appMeta = (data.user && data.user.app_metadata) || {};
      const role = appMeta.role;
      const coordRole = appMeta.coord_role || 'coordenacao';

      if (role === 'coordinator') {
        if (window.__PEDAL_MODE === 'coord') {
          const ROLE_DISPLAY = { administracao: 'Administração', coordenacao: 'Coordenação' };
          const roleValues = Object.values(ROLE_DISPLAY);
          const displayName = (meta.name && !roleValues.includes(meta.name)) ? meta.name : email.trim().split('@')[0];
          store.setCoordProfile({ name: displayName, email: email.trim(), phone: meta.phone || '', role: ROLE_DISPLAY[coordRole] || 'Coordenação' });
          store.setCoordRole(coordRole);
          store.setCoordJwt(jwt);
        } else {
          window.location.href = 'coordenacao.html';
        }
        return;
      }

      // Candidato: vai buscar o perfil ao backend
      const meRes = await fetch('/api/candidates/me', {
        headers: { 'Authorization': `Bearer ${jwt}` },
      });
      if (!meRes.ok) { setErr('Conta encontrada, mas sem perfil de candidato associado.'); return; }
      const profile = await meRes.json();

      const STAGE_TO_NODE = {
        inscricao: 'triage',
        apresentacao: 'present',
        triagem: 'triage_result',
        espera: 'await_waitinglist',
        entrevista: 'interview',
        validacao: 'await_validation',
        onboarding: 'goto_onboarding',
        pratica: 'await_reschedule',
        ativo: 'active_home',
      };
      // O nó gravado no backend é a fonte de verdade (persiste entre sessões/dispositivos);
      // só cai para o nó genérico do estágio se este candidato nunca gravou um nó.
      const stageNode = STAGE_TO_NODE[profile.stage] || 'triage';
      const node = profile.chat_node || stageNode;

      // Tenta recuperar IDs a partir dos nomes guardados na BD
      const perData = window.PEDAL && window.PEDAL.PERIODS;
      const locs = window.PEDAL && window.PEDAL.LOCALITIES;
      const periods = profile.periods
        ? profile.periods.split(', ').filter(Boolean).map((n) => { const f = perData && perData.find((p) => p.name === n); return f ? f.id : n; })
        : [];
      const localities = profile.locality
        ? profile.locality.split(', ').filter(Boolean).map((n) => { const f = locs && locs.find((l) => l.name === n); return f ? f.id : n; })
        : [];
      const availability = Array.isArray(profile.availability) ? profile.availability : [];

      const savedMessages = Array.isArray(profile.chat_messages) && profile.chat_messages.length ? profile.chat_messages : [];
      store.up({ candidateId: profile.id, account: { email: email.trim(), refreshToken: data.refresh_token }, ...(savedMessages.length ? { messages: savedMessages } : {}) });
      store.patchCandidate({ name: profile.name || '', email: profile.email || '', dob: profile.dob || '', contact: profile.phone || '', cc: profile.cc || '', localities, periods, availability });
      store.setStage(profile.stage || 'inscricao');
      if (profile.scheduling && profile.scheduling.slots && profile.scheduling.slots.length) {
        store.setScheduling('live', profile.scheduling);
      }
      store.setChat({ node, restoreInteraction: true });
      store.setSession(true);
      store.setCandidateJwt(jwt);
      store.goTab('conversa');
    } catch (_) {
      setErr('Erro de ligação ao servidor.');
    } finally {
      setLoading(false);
    }
  };

  if (S.emailVerificationRequired) {
    return (
      <div className="pedal-screen">
        <TabHeader title="Verifica o teu email" subtitle="Último passo antes de entrares" />
        <div className="pedal-tabbody">
          <div className="pedal-authcard" style={{ margin: 0, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📬</div>
            <div style={{ font: '800 17px var(--display)', color: 'var(--ink)', marginBottom: 8 }}>Confirma o teu email</div>
            <p style={{ font: '400 13px/1.6 var(--ui)', color: 'var(--ink-soft)', margin: '0 0 16px' }}>
              Enviámos um email de confirmação para <strong style={{ color: 'var(--ink)' }}>{S.account?.email}</strong>.<br />
              Abre-o e clica no link para activar a tua conta.
            </p>
            <div style={{ background: 'var(--surface-raised)', borderRadius: 10, padding: '12px 14px', font: '500 12px/1.5 var(--ui)', color: 'var(--ink-soft)', textAlign: 'left', marginBottom: 16 }}>
              Não encontras o email? Verifica a pasta de spam ou lixo.
            </div>
            <button className="pedal-btn ghost" style={{ width: '100%' }} onClick={() => store.goTab('conversa')}>Voltar à conversa</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pedal-screen">
      <TabHeader title="Entrar" subtitle="Acede à tua conta de voluntário" />
      <div className="pedal-tabbody">
        <div className="pedal-authcard" style={{ margin: 0 }}>
          {store.passwordJustChanged && (
            <div className="pedal-autherr" role="status" style={{ color: 'var(--primary-deep)', background: 'var(--primary-soft)' }}>
              <Icon name="check" size={14} />Palavra-passe alterada com sucesso. Já pode iniciar sessão.
            </div>
          )}
          {store.accountJustActivated && (
            <div className="pedal-autherr" role="status" style={{ color: 'var(--primary-deep)', background: 'var(--primary-soft)' }}>
              <Icon name="check" size={14} />Conta ativada e palavra-passe definida. Já podes iniciar sessão.
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 16 }}>
            <Avatar size={54} />
            <div style={{ font: '800 18px var(--display)', color: 'var(--ink)', marginTop: 12 }}>Bem-vindo(a) de volta</div>
            <p style={{ font: '400 13px/1.5 var(--ui)', color: 'var(--ink-soft)', margin: '4px 0 0', textAlign: 'center', maxWidth: 260 }}>Entra para ver e gerir o teu perfil. Para te candidatares, é só conversar com o PEDAL — não precisas de conta. 🚲</p>
          </div>
          <Field label="Email"><input className="pedal-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@email.pt" onKeyDown={(e) => e.key === 'Enter' && tryLogin()} /></Field>
          <Field label="Palavra-passe"><input className="pedal-input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="A palavra-passe que definiste" onKeyDown={(e) => e.key === 'Enter' && tryLogin()} /></Field>
          {err && <div className="pedal-autherr"><Icon name="shield" size={14} />{err}</div>}
          <button className="pedal-btn primary" style={{ width: '100%', marginTop: 6 }} onClick={tryLogin} disabled={loading || !email.trim() || !pw.trim()}>
            {loading ? 'A entrar…' : 'Entrar'}
          </button>
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <a href="/recuperar-palavra-passe" className="pedal-authlink">Esqueceu-se da palavra-passe?</a>
          </div>
          {hasAccount ? (
            <div style={{ marginTop: 12 }}>
              <button className="pedal-authlink" onClick={() => setHint((h) => !h)}>{hint ? 'Ocultar' : 'Esqueci-me dos dados de acesso'}</button>
              {hint && (
                <div className="pedal-credhint">
                  <span style={{ font: '700 10.5px var(--ui)', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent-deep)' }}>O teu email</span>
                  <div className="pedal-credrow"><span>Email</span><strong>{S.account.email}</strong></div>
                  <button className="pedal-btn ghost" style={{ width: '100%', marginTop: 10 }} onClick={() => setEmail(S.account.email)}>Preencher email</button>
                  <p style={{ font: '400 11.5px/1.5 var(--ui)', color: 'var(--ink-soft)', margin: '10px 0 0' }}>Não guardamos a tua palavra-passe — usa <a href="/recuperar-palavra-passe" className="pedal-authlink" style={{ display: 'inline' }}>recuperar palavra-passe</a> para a repor.</p>
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
  // Muda a password mesmo no Supabase (PED-59) — a versão anterior só
  // mudava o estado local, por isso a password antiga continuava válida.
  const [pwSaving, setPwSaving] = useStateAu(false);
  const savePw = async () => {
    if (pw1.length < 8) { setPwMsg('A palavra-passe deve ter pelo menos 8 caracteres.'); return; }
    if (pw1 !== pw2) { setPwMsg('As palavras-passe não coincidem.'); return; }
    setPwSaving(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${store.candidateJwt}` },
        body: JSON.stringify({ password: pw1 }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setPwMsg(d.error_description || d.msg || 'Não foi possível mudar a palavra-passe.'); return; }
      setPw1(''); setPw2(''); setPwMsg(''); setPwOpen(false);
    } catch (_) {
      setPwMsg('Erro de ligação ao servidor.');
    } finally {
      setPwSaving(false);
    }
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
              <Field label="Nova palavra-passe"><input className="pedal-input" type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} placeholder="Mínimo 8 caracteres" /></Field>
              <Field label="Confirmar palavra-passe"><input className="pedal-input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Repete a nova palavra-passe" /></Field>
              {pwMsg && <div className="pedal-autherr"><Icon name="shield" size={14} />{pwMsg}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button className="pedal-btn ghost" style={{ flex: 1 }} onClick={() => { setPwOpen(false); setPw1(''); setPw2(''); setPwMsg(''); }} disabled={pwSaving}>Cancelar</button>
                <button className="pedal-btn primary" style={{ flex: 1, opacity: pwSaving ? 0.6 : 1 }} onClick={savePw} disabled={pwSaving}>{pwSaving ? 'A guardar…' : 'Guardar'}</button>
              </div>
            </div>
          )}
        </div>

        {/* Sessão + conta */}
        <button className="pedal-listrow" style={{ marginTop: 14 }} onClick={() => { store.setCandidateJwt(null); store.reset(); }}>
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

function CoordLoginScreen({ store }) {
  const [email, setEmail] = useStateAu('');
  const [pw, setPw] = useStateAu('');
  const [mfaCode, setMfaCode] = useStateAu('');
  const [mfaStep, setMfaStep] = useStateAu(null); // null | enroll | challenge
  const [mfaContext, setMfaContext] = useStateAu(null);
  const [err, setErr] = useStateAu('');
  const [loading, setLoading] = useStateAu(false);

  const authRequest = async (path, token, method = 'POST', body) => {
    const res = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.msg || data.message || data.error_description || data.error || 'Falha na autenticação');
    return data;
  };

  // A flag vive no backend (COORDINATOR_MFA_REQUIRED, exposta em
  // /api/auth-config) porque não há bundler que injete env vars no cliente.
  // Se a leitura falhar assume-se MFA ativo: pedir um código a mais é
  // recuperável, saltá-lo quando o backend o exige devolveria 403
  // (`mfa_required`) em todas as rotas de coordenação depois do login.
  const fetchCoordinatorMfaEnabled = () => fetch('/api/auth-config')
    .then((r) => r.json())
    .then((cfg) => cfg.coordinatorMfaEnabled !== false)
    .catch(() => true);

  const finishCoordinatorLogin = (session, fallbackUser) => {
    const user = session.user || fallbackUser;
    const meta = user?.user_metadata || {};
    const appMeta = user?.app_metadata || {};
    const coordRole = appMeta.coord_role || 'coordenacao';
    const ROLE_DISPLAY = { administracao: 'Administração', coordenacao: 'Coordenação' };
    const roleValues = Object.values(ROLE_DISPLAY);
    const normalizedEmail = user?.email || email.trim();
    const displayName = (meta.name && !roleValues.includes(meta.name)) ? meta.name : normalizedEmail.split('@')[0];
    store.setCoordProfile({ name: displayName, email: normalizedEmail, phone: meta.phone || '', role: ROLE_DISPLAY[coordRole] || 'Coordenação' });
    store.setCoordRole(coordRole);
    store.setCoordJwt(session.access_token);
  };

  const handleLogin = async () => {
    if (!email || !pw) return;
    setLoading(true); setErr('');
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ email, password: pw }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error_description || 'Credenciais inválidas'); return; }
      // role/coord_role vêm de app_metadata — user_metadata é editável pelo
      // próprio utilizador e não serve para decisões de acesso (PED-61).
      const appMeta = data.user?.app_metadata || {};
      if (appMeta.role !== 'coordinator') { setErr('Esta conta não tem acesso à coordenação'); return; }
      setPw('');

      if (!(await fetchCoordinatorMfaEnabled())) {
        // Contas que já tinham TOTP configurado entram igualmente: a sessão
        // fica em AAL1 e o backend, com a flag desligada, aceita-a. O fator
        // continua registado no Supabase e volta a ser pedido se a flag for
        // reativada, sem precisar de nova configuração.
        finishCoordinatorLogin(data, data.user);
        return;
      }

      const verifiedFactor = (data.user?.factors || []).find((factor) => factor.factor_type === 'totp' && factor.status === 'verified');
      if (verifiedFactor) {
        setMfaContext({ token: data.access_token, user: data.user, factorId: verifiedFactor.id });
        setMfaStep('challenge');
        return;
      }

      // Um login anterior pode ter sido interrompido depois de criar o fator,
      // mas antes de o verificar. O segredo/QR desse fator já não é devolvido
      // em logins posteriores; removê-lo permite recomeçar de forma recuperável.
      const abandonedFactors = (data.user?.factors || []).filter((factor) => factor.factor_type === 'totp' && factor.status === 'unverified');
      for (const factor of abandonedFactors) {
        await authRequest(`/factors/${factor.id}`, data.access_token, 'DELETE');
      }

      const enrollment = await authRequest('/factors', data.access_token, 'POST', {
        factor_type: 'totp',
        friendly_name: 'PEDAL Coordenação',
        issuer: 'Pedalar Sem Idade',
      });
      setMfaContext({
        token: data.access_token,
        user: data.user,
        factorId: enrollment.id,
        qrCode: enrollment.totp?.qr_code,
        secret: enrollment.totp?.secret,
      });
      setMfaStep('enroll');
    } catch (e) {
      setErr(e.message === 'Failed to fetch'
        ? 'Erro de ligação ao servidor'
        : `Não foi possível preparar a autenticação de dois fatores: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const verifyMfa = async () => {
    if (!mfaContext || !/^\d{6}$/.test(mfaCode)) return;
    setLoading(true); setErr('');
    try {
      const challenge = await authRequest(`/factors/${mfaContext.factorId}/challenge`, mfaContext.token, 'POST', {
        factorId: mfaContext.factorId,
      });
      const session = await authRequest(`/factors/${mfaContext.factorId}/verify`, mfaContext.token, 'POST', {
        challenge_id: challenge.id,
        code: mfaCode,
      });
      finishCoordinatorLogin(session, mfaContext.user);
    } catch (e) {
      setErr('Código inválido ou expirado. Confirme o código na aplicação autenticadora e tente novamente.');
      setMfaCode('');
    } finally {
      setLoading(false);
    }
  };

  const qrCodeSrc = mfaContext?.qrCode
    ? (mfaContext.qrCode.startsWith('data:') ? mfaContext.qrCode : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(mfaContext.qrCode)}`)
    : null;

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
      <div style={{ width: 360, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: 28, boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24, gap: 8 }}>
          <div className="pedal-authlogo"><img src={window.__PEDAL_LOGO} alt="" style={{ width: 52 }} /></div>
          <div style={{ font: '800 18px var(--display)', color: 'var(--ink)', marginTop: 4 }}>Coordenação</div>
          <div style={{ font: '500 13px var(--ui)', color: 'var(--ink-soft)' }}>Pedalar Sem Idade Porto</div>
        </div>
        {store.passwordJustChanged && (
          <div className="pedal-autherr" role="status" style={{ marginBottom: 14, color: 'var(--primary-deep)', background: 'var(--primary-soft)' }}>
            <Icon name="check" size={14} />Palavra-passe alterada com sucesso. Já pode iniciar sessão.
          </div>
        )}
        {err && <div className="pedal-autherr" role="alert" style={{ marginBottom: 14 }}><Icon name="shield" size={14} />{err}</div>}
        {mfaStep ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ font: '700 15px var(--display)', color: 'var(--ink)' }}>
              {mfaStep === 'enroll' ? 'Configurar autenticação de dois fatores' : 'Código de autenticação'}
            </div>
            {mfaStep === 'enroll' && (
              <>
                <p style={{ font: '500 12.5px/1.5 var(--ui)', color: 'var(--ink-soft)', margin: 0 }}>
                  Digitalize este código numa aplicação autenticadora, como Google Authenticator, Microsoft Authenticator ou 1Password.
                </p>
                {qrCodeSrc && <img src={qrCodeSrc} alt="Código QR para configurar autenticação de dois fatores" style={{ width: 180, height: 180, alignSelf: 'center' }} />}
                {mfaContext?.secret && (
                  <div style={{ font: '500 11.5px/1.45 var(--ui)', color: 'var(--ink-soft)', overflowWrap: 'anywhere' }}>
                    Em alternativa, introduza esta chave manualmente: <strong style={{ color: 'var(--ink)', fontFamily: 'monospace' }}>{mfaContext.secret}</strong>
                  </div>
                )}
              </>
            )}
            {mfaStep === 'challenge' && (
              <p style={{ font: '500 12.5px/1.5 var(--ui)', color: 'var(--ink-soft)', margin: 0 }}>
                Introduza o código de 6 dígitos apresentado na sua aplicação autenticadora.
              </p>
            )}
            <div>
              <div style={{ font: '700 12px var(--ui)', color: 'var(--ink-soft)', marginBottom: 5 }}>Código de 6 dígitos</div>
              <input
                className="pedal-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                onKeyDown={(e) => e.key === 'Enter' && verifyMfa()}
                autoFocus
              />
            </div>
            <button className="pedal-btn primary" style={{ width: '100%', marginTop: 4 }} onClick={verifyMfa} disabled={loading || mfaCode.length !== 6}>
              {loading ? 'A verificar…' : (mfaStep === 'enroll' ? 'Ativar e entrar' : 'Verificar e entrar')}
            </button>
            <button type="button" className="pedal-btn ghost" onClick={() => { setMfaStep(null); setMfaContext(null); setMfaCode(''); setErr(''); }}>
              Voltar
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ font: '700 12px var(--ui)', color: 'var(--ink-soft)', marginBottom: 5 }}>Email</div>
              <input className="pedal-input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="coordenador@pedal.pt" />
            </div>
            <div>
              <div style={{ font: '700 12px var(--ui)', color: 'var(--ink-soft)', marginBottom: 5 }}>Palavra-passe</div>
              <input className="pedal-input" type="password" autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>
            <button className="pedal-btn primary" style={{ width: '100%', marginTop: 4 }} onClick={handleLogin} disabled={loading || !email || !pw}>
              {loading ? 'A entrar…' : 'Continuar'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 2 }}>
              <a href="/recuperar-palavra-passe" className="pedal-authlink">Esqueceu-se da palavra-passe?</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { AuthGate, ProfileView, LoginPanel, CoordLoginScreen });
