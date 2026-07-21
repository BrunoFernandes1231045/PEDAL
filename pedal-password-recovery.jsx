/* pedal-password-recovery.jsx — recuperação de palavra-passe (Supabase Auth)
   Usado pelas páginas autónomas recuperar-palavra-passe.html e nova-palavra-passe.html.
   É a única parte do frontend que usa o SDK @supabase/supabase-js — o resto do
   projeto fala diretamente com a API REST do Supabase via fetch (ver pedal-auth.jsx).
   Aqui o SDK é necessário para: detetar a ligação de recuperação no URL, dar o
   evento PASSWORD_RECOVERY e trocar a palavra-passe em segurança sem manipular
   tokens à mão. */

const { useState: useStateR, useEffect: useEffectR } = React;

// Mesmo projeto Supabase (URL + anon key) já usado em pedal-auth.jsx/pedal-app.jsx/pedal-dashboard.jsx.
const SUPABASE_URL_R = 'https://mamvckyoqrjhivffimob.supabase.co';
const SUPABASE_ANON_KEY_R = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hbXZja3lvcXJqaGl2ZmZpbW9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1OTUwNzIsImV4cCI6MjA5NzE3MTA3Mn0.ucPATa3CTsncwoElpF8_-XyZUgwGoBfpzQM4I9M2bMM';

const supabaseAuthClient = window.supabase.createClient(SUPABASE_URL_R, SUPABASE_ANON_KEY_R);

// ── Deteção do evento PASSWORD_RECOVERY sem condição de corrida ─────────────
// O cliente Supabase começa a processar a ligação de recuperação do URL logo que
// é criado (linha acima), antes de qualquer componente React montar. Se só
// ouvíssemos onAuthStateChange dentro de um useEffect, podíamos perder o evento.
// Por isso a subscrição vive à parte, ao nível do módulo, desde já.
let recoveryEventSeen = false;
let recoverySession = null;
const recoveryListeners = [];
supabaseAuthClient.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    recoveryEventSeen = true;
    recoverySession = session;
    try { sessionStorage.setItem('pedal_recovery_active', '1'); } catch (_) {}
    recoveryListeners.forEach((fn) => fn(session));
  }
});

function waitForRecoverySession(onValid) {
  if (recoveryEventSeen) { onValid(recoverySession); return () => {}; }
  recoveryListeners.push(onValid);
  return () => {
    const i = recoveryListeners.indexOf(onValid);
    if (i !== -1) recoveryListeners.splice(i, 1);
  };
}

// Candidatos e coordenadores partilham este fluxo mas têm apps/páginas de login
// separadas (PEDAL.html vs coordenacao.html). A sessão de recuperação já diz o
// papel do utilizador (user_metadata.role), por isso o regresso ao login acerta
// a página certa em vez de assumir sempre "candidato".
function getLoginUrl() {
  const role = recoverySession && recoverySession.user && recoverySession.user.user_metadata && recoverySession.user.user_metadata.role;
  return role === 'coordinator' ? '/coordenacao.html' : '/PEDAL.html';
}

// ── Configuração (envio de email ligado/desligado) ──────────────────────────
// Não há Vite/bundler neste projeto, por isso a flag não vem de import.meta.env —
// é lida do backend (variável de ambiente PASSWORD_RECOVERY_EMAIL_ENABLED),
// exposta em /api/auth-config. Ver backend/src/routes/authConfig.js.
function fetchAuthConfig() {
  return fetch('/api/auth-config').then((r) => r.json()).catch(() => ({ passwordRecoveryEmailEnabled: false }));
}

// ── Serviço: pedido real de recuperação (centralizado aqui, chamado só desta página) ──
async function requestPasswordReset(emailNormalizado) {
  const cfg = await fetchAuthConfig();
  if (!cfg.passwordRecoveryEmailEnabled) {
    // O envio real está temporariamente desativado para evitar consumir
    // o limite do serviço de email incluído no Supabase (2 emails/hora).
    // Para ativar, definir PASSWORD_RECOVERY_EMAIL_ENABLED=true no backend.
    return { ok: false, disabled: true };
  }
  try {
    const { error } = await supabaseAuthClient.auth.resetPasswordForEmail(emailNormalizado, {
      redirectTo: `${window.location.origin}/nova-palavra-passe`,
    });
    if (error) return { ok: false, error };
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

function emailValido(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

// ── Componentes visuais partilhados (cópia mínima local — evita carregar
// pedal-cards.jsx só por causa do Field, que não é usado por mais nada aqui).
// Ao contrário do Field original, este usa <label htmlFor> real associada ao
// input (via inputId), como pedido para esta funcionalidade especificamente. ──
function Field({ label, inputId, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label htmlFor={inputId} style={{ display: 'block', font: '600 12px var(--ui)', color: 'var(--ink-soft)', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

function PasswordInput({ id, value, onChange, placeholder, onEnter }) {
  const [show, setShow] = useStateR(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        className="pedal-input"
        style={{ paddingRight: 40 }}
        type={show ? 'text' : 'password'}
        autoComplete="new-password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) onEnter(); }}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
        style={{ position: 'absolute', right: 10, top: 0, height: '100%', display: 'flex', alignItems: 'center', color: 'var(--ink-soft)' }}
      >
        <Icon name={show ? 'eye-off' : 'eye'} size={17} />
      </button>
    </div>
  );
}

function AuthPageShell({ title, subtitle, children }) {
  return (
    <div className="pedal-authscreen" style={{ minHeight: '100vh', overflowY: 'auto' }}>
      <div className="pedal-authtop">
        <div className="pedal-authlogo"><img src={window.__PEDAL_LOGO} alt="" style={{ width: 48 }} /></div>
        <div style={{ font: '800 22px var(--display)', color: 'var(--ink)', letterSpacing: '-0.01em', marginTop: 16, lineHeight: 1.15 }}>{title}</div>
        {subtitle && <p style={{ font: '400 14px/1.55 var(--ui)', color: 'var(--ink-soft)', margin: '8px 0 0', maxWidth: 320 }}>{subtitle}</p>}
      </div>
      <div className="pedal-authcard" style={{ maxWidth: 380 }}>
        {children}
      </div>
    </div>
  );
}

// ── Página pública /recuperar-palavra-passe ─────────────────────────────────
function RecoverPasswordPage() {
  const [email, setEmail] = useStateR('');
  const [loading, setLoading] = useStateR(false);
  const [errorMsg, setErrorMsg] = useStateR('');
  const [infoMsg, setInfoMsg] = useStateR('');

  const submit = () => {
    if (loading) return;
    setErrorMsg(''); setInfoMsg('');
    const emailNormalizado = email.trim().toLowerCase();
    if (!emailNormalizado) { setErrorMsg('Introduza o seu email.'); return; }
    if (!emailValido(emailNormalizado)) { setErrorMsg('Introduza um email válido.'); return; }

    setLoading(true);
    requestPasswordReset(emailNormalizado).then((res) => {
      setLoading(false);
      if (res.disabled) {
        setInfoMsg('O envio de emails de recuperação encontra-se temporariamente desativado.');
        return;
      }
      if (!res.ok) {
        setErrorMsg('Não foi possível processar o pedido. Aguarde alguns minutos e tente novamente.');
        return;
      }
      setInfoMsg('Se existir uma conta associada a este email, receberá uma ligação para redefinir a palavra-passe.');
    });
  };

  return (
    <AuthPageShell title="Recuperar palavra-passe" subtitle="Introduza o endereço de email associado à sua conta. Será enviada uma ligação para definir uma nova palavra-passe.">
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Field label="Email" inputId="recover-email">
          <input
            id="recover-email"
            className="pedal-input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@email.pt"
          />
        </Field>
        {errorMsg && <div className="pedal-autherr" role="alert"><Icon name="shield" size={14} />{errorMsg}</div>}
        {infoMsg && <div className="pedal-autherr" role="status" style={{ color: 'var(--primary-deep)', background: 'var(--primary-soft)' }}><Icon name="check" size={14} />{infoMsg}</div>}
        <button type="submit" className="pedal-btn primary" style={{ width: '100%', marginTop: 6 }} disabled={loading}>
          {loading ? 'A enviar…' : 'Enviar ligação de recuperação'}
        </button>
      </form>
      <div style={{ textAlign: 'center', marginTop: 14 }}>
        <button type="button" onClick={() => window.history.back()} className="pedal-authlink">← Voltar ao login</button>
      </div>
    </AuthPageShell>
  );
}

// ── Página pública /nova-palavra-passe ──────────────────────────────────────
function NewPasswordPage() {
  // 'validating' | 'valid' | 'invalid'
  const [linkStatus, setLinkStatus] = useStateR('validating');
  const [pw1, setPw1] = useStateR('');
  const [pw2, setPw2] = useStateR('');
  const [errorMsg, setErrorMsg] = useStateR('');
  const [loading, setLoading] = useStateR(false);
  const [done, setDone] = useStateR(false);

  useEffectR(() => {
    let cancelled = false;
    const markValid = () => { if (!cancelled) setLinkStatus('valid'); };

    const stopListening = waitForRecoverySession(markValid);

    // Refresh a meio do fluxo: já não há evento PASSWORD_RECOVERY para ouvir (o URL
    // já foi consumido e limpo pelo SDK), mas se esta mesma aba já o tiver visto
    // antes e ainda existir uma sessão válida, o pedido de refresh continua legítimo.
    let sawRecoveryBefore = false;
    try { sawRecoveryBefore = sessionStorage.getItem('pedal_recovery_active') === '1'; } catch (_) {}
    if (sawRecoveryBefore) {
      supabaseAuthClient.auth.getSession().then(({ data }) => {
        if (!cancelled && data && data.session) setLinkStatus('valid');
      });
    }

    // Se, passado algum tempo, nada confirmou uma sessão de recuperação real,
    // a ligação é inválida/expirada (ou foi um acesso direto sem ligação nenhuma).
    const timer = setTimeout(() => {
      if (!cancelled) setLinkStatus((s) => (s === 'validating' ? 'invalid' : s));
    }, 4000);

    return () => { cancelled = true; clearTimeout(timer); stopListening(); };
  }, []);

  const submit = () => {
    if (loading || linkStatus !== 'valid') return;
    setErrorMsg('');
    if (!pw1 || !pw2) { setErrorMsg('Preencha os dois campos de palavra-passe.'); return; }
    if (pw1.length < 8) { setErrorMsg('A palavra-passe deve ter, pelo menos, 8 caracteres.'); return; }
    if (pw1 !== pw2) { setErrorMsg('As palavras-passe introduzidas não coincidem.'); return; }

    setLoading(true);
    supabaseAuthClient.auth.updateUser({ password: pw1 }).then(({ error }) => {
      setPw1(''); setPw2('');
      if (error) {
        setLoading(false);
        setErrorMsg('Não foi possível alterar a palavra-passe. A ligação pode ter expirado. Solicite uma nova ligação e tente novamente.');
        return;
      }
      try { sessionStorage.removeItem('pedal_recovery_active'); } catch (_) {}
      const loginUrl = getLoginUrl();
      supabaseAuthClient.auth.signOut().catch(() => {}).finally(() => {
        setLoading(false);
        setDone(true);
        setTimeout(() => { window.location.href = `${loginUrl}?palavra-passe-alterada=1`; }, 1800);
      });
    });
  };

  if (linkStatus === 'validating') {
    return (
      <AuthPageShell title="Definir nova palavra-passe">
        <div role="status" style={{ font: '500 14px var(--ui)', color: 'var(--ink-soft)', textAlign: 'center', padding: '18px 0' }}>
          A validar a ligação de recuperação…
        </div>
      </AuthPageShell>
    );
  }

  if (linkStatus === 'invalid') {
    return (
      <AuthPageShell title="Ligação inválida ou expirada">
        <p style={{ font: '500 13px/1.6 var(--ui)', color: 'var(--ink-soft)', textAlign: 'center', margin: '0 0 16px' }}>
          Esta ligação de recuperação já não é válida. Solicite uma nova ligação.
        </p>
        <a href="/recuperar-palavra-passe" className="pedal-btn primary" style={{ width: '100%', display: 'block', textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}>Solicitar nova ligação</a>
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <button type="button" onClick={() => window.history.back()} className="pedal-authlink">← Voltar ao login</button>
        </div>
      </AuthPageShell>
    );
  }

  if (done) {
    return (
      <AuthPageShell title="Palavra-passe alterada">
        <div className="pedal-autherr" role="status" style={{ color: 'var(--primary-deep)', background: 'var(--primary-soft)' }}>
          <Icon name="check" size={14} />Palavra-passe alterada com sucesso. A regressar ao login…
        </div>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell title="Definir nova palavra-passe">
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Field label="Nova palavra-passe" inputId="new-pw-1">
          <PasswordInput id="new-pw-1" value={pw1} onChange={setPw1} placeholder="Mínimo 8 caracteres" onEnter={submit} />
        </Field>
        <Field label="Confirmar nova palavra-passe" inputId="new-pw-2">
          <PasswordInput id="new-pw-2" value={pw2} onChange={setPw2} placeholder="Repita a nova palavra-passe" onEnter={submit} />
        </Field>
        {errorMsg && <div className="pedal-autherr" role="alert"><Icon name="shield" size={14} />{errorMsg}</div>}
        <button type="submit" className="pedal-btn primary" style={{ width: '100%', marginTop: 6 }} disabled={loading}>
          {loading ? 'A alterar…' : 'Alterar palavra-passe'}
        </button>
      </form>
      <div style={{ textAlign: 'center', marginTop: 14 }}>
        <a href={getLoginUrl()} className="pedal-authlink">← Voltar ao login</a>
      </div>
    </AuthPageShell>
  );
}

Object.assign(window, { RecoverPasswordPage, NewPasswordPage });
