/* pedal-password-recovery.jsx — recuperação de palavra-passe (Supabase Auth)
   Usado pelas páginas autónomas recuperar-palavra-passe.html e nova-palavra-passe.html.
   É a única parte do frontend que usa o SDK @supabase/supabase-js — o resto do
   projeto fala diretamente com a API REST do Supabase via fetch (ver pedal-auth.jsx).
   Aqui o SDK é necessário para: detetar a ligação de recuperação no URL, dar o
   evento PASSWORD_RECOVERY e trocar a palavra-passe em segurança sem manipular
   tokens à mão. */

const { useState: useStateR, useEffect: useEffectR } = React;

// O backend injeta a configuração pública antes deste script ser avaliado.
const passwordRecoveryAuthConfig = window.__PEDAL_AUTH_CONFIG || {};
const SUPABASE_URL_R = passwordRecoveryAuthConfig.supabaseUrl || '';
const SUPABASE_ANON_KEY_R = passwordRecoveryAuthConfig.supabaseAnonKey || '';

// Guardar a intenção antes de o SDK consumir os parâmetros Auth do URL.
// Recuperações e convites partilham esta página; num convite o utilizador
// define a primeira password sem a aplicação gerar ou revelar credenciais.
const passwordLinkQuery = new URLSearchParams(window.location.search);
const passwordLinkHash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
const passwordLinkType = passwordLinkHash.get('type') || passwordLinkQuery.get('type');
const passwordLinkPurpose = passwordLinkQuery.get('tipo') || (passwordLinkType === 'invite' ? 'convite' : 'recuperacao');
const isInviteLink = passwordLinkPurpose.startsWith('convite') || passwordLinkType === 'invite';
const hasInviteAuthEvidence = passwordLinkType === 'invite'
  && (passwordLinkHash.has('access_token') || passwordLinkQuery.has('code'));
const PASSWORD_LINK_MARKER_KEY = 'pedal_password_link_marker';

const supabaseAuthClient = window.supabase.createClient(SUPABASE_URL_R, SUPABASE_ANON_KEY_R);

// ── Deteção de recuperação/convite sem condição de corrida ──────────────────
// O cliente Supabase começa a processar a ligação de recuperação do URL logo que
// é criado (linha acima), antes de qualquer componente React montar. Se só
// ouvíssemos onAuthStateChange dentro de um useEffect, podíamos perder o evento.
// Por isso a subscrição vive à parte, ao nível do módulo, desde já.
let recoveryEventSeen = false;
let recoverySession = null;
const recoveryListeners = [];

function readPasswordLinkMarker() {
  try {
    const raw = sessionStorage.getItem(PASSWORD_LINK_MARKER_KEY);
    if (!raw) return null;
    const marker = JSON.parse(raw);
    return marker && typeof marker.userId === 'string' && typeof marker.purpose === 'string'
      ? marker
      : null;
  } catch (_) {
    return null;
  }
}

function writePasswordLinkMarker(purpose, session) {
  const userId = session?.user?.id;
  if (!userId) return;
  try {
    sessionStorage.setItem(PASSWORD_LINK_MARKER_KEY, JSON.stringify({ purpose, userId }));
    // Remover marcadores menos restritivos de versões anteriores.
    sessionStorage.removeItem('pedal_password_link_active');
    sessionStorage.removeItem('pedal_password_link_purpose');
    sessionStorage.removeItem('pedal_recovery_active');
  } catch (_) {}
}

supabaseAuthClient.auth.onAuthStateChange((event, session) => {
  const validRecovery = event === 'PASSWORD_RECOVERY';
  // SIGNED_IN é emitido quando o SDK troca um convite válido por uma sessão.
  // INITIAL_SESSION pode ser apenas uma sessão antiga do browser: só a aceitamos
  // para retomar uma ligação já validada nesta aba e para o mesmo user.id.
  const marker = readPasswordLinkMarker();
  const validInviteSignIn = isInviteLink && hasInviteAuthEvidence && event === 'SIGNED_IN' && session;
  const validInviteResume = isInviteLink
    && event === 'INITIAL_SESSION'
    && session
    && marker?.purpose === 'convite'
    && marker.userId === session.user?.id;
  const validInvite = validInviteSignIn || validInviteResume;
  if (validRecovery || validInvite) {
    recoveryEventSeen = true;
    recoverySession = session;
    writePasswordLinkMarker(validInvite ? 'convite' : 'recuperacao', session);
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
// papel do utilizador (app_metadata.role — não user_metadata, que é editável
// pelo próprio utilizador e não serve para decisões de acesso, PED-61), por
// isso o regresso ao login acerta a página certa em vez de assumir "candidato".
function getLoginUrl() {
  const role = recoverySession && recoverySession.user && recoverySession.user.app_metadata && recoverySession.user.app_metadata.role;
  return role === 'coordinator' ? '/coordenacao.html' : '/PEDAL.html';
}

function getCompletionUrl() {
  return `${getLoginUrl()}?${isInviteLink ? 'conta-ativada=1' : 'palavra-passe-alterada=1'}`;
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

    // Refresh a meio do fluxo: o URL já foi consumido pelo SDK, mas a sessão
    // continua legítima se esta mesma aba já tiver validado a ligação.
    const marker = readPasswordLinkMarker();
    if (marker) {
      supabaseAuthClient.auth.getSession().then(({ data }) => {
        const session = data && data.session;
        const expectedPurpose = isInviteLink ? 'convite' : 'recuperacao';
        if (!cancelled
          && session
          && marker.purpose === expectedPurpose
          && marker.userId === session.user?.id) {
          recoverySession = data.session;
          setLinkStatus('valid');
        }
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
      try {
        sessionStorage.removeItem(PASSWORD_LINK_MARKER_KEY);
        sessionStorage.removeItem('pedal_password_link_active');
        sessionStorage.removeItem('pedal_password_link_purpose');
        sessionStorage.removeItem('pedal_recovery_active');
      } catch (_) {}
      const completionUrl = getCompletionUrl();
      supabaseAuthClient.auth.signOut().catch(() => {}).finally(() => {
        setLoading(false);
        setDone(true);
        setTimeout(() => { window.location.href = completionUrl; }, 1800);
      });
    });
  };

  if (linkStatus === 'validating') {
    return (
      <AuthPageShell title={isInviteLink ? 'Ativar conta' : 'Definir nova palavra-passe'}>
        <div role="status" style={{ font: '500 14px var(--ui)', color: 'var(--ink-soft)', textAlign: 'center', padding: '18px 0' }}>
          A validar a ligação…
        </div>
      </AuthPageShell>
    );
  }

  if (linkStatus === 'invalid') {
    return (
      <AuthPageShell title="Ligação inválida ou expirada">
        <p style={{ font: '500 13px/1.6 var(--ui)', color: 'var(--ink-soft)', textAlign: 'center', margin: '0 0 16px' }}>
          {isInviteLink
            ? 'Este convite já não é válido. Peça à associação que envie um novo convite.'
            : 'Esta ligação de recuperação já não é válida. Solicite uma nova ligação.'}
        </p>
        {!isInviteLink && <a href="/recuperar-palavra-passe" className="pedal-btn primary" style={{ width: '100%', display: 'block', textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}>Solicitar nova ligação</a>}
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <button type="button" onClick={() => window.history.back()} className="pedal-authlink">← Voltar ao login</button>
        </div>
      </AuthPageShell>
    );
  }

  if (done) {
    return (
      <AuthPageShell title={isInviteLink ? 'Conta ativada' : 'Palavra-passe alterada'}>
        <div className="pedal-autherr" role="status" style={{ color: 'var(--primary-deep)', background: 'var(--primary-soft)' }}>
          <Icon name="check" size={14} />{isInviteLink ? 'Conta ativada com sucesso.' : 'Palavra-passe alterada com sucesso.'} A regressar ao login…
        </div>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell title={isInviteLink ? 'Ativar conta' : 'Definir nova palavra-passe'} subtitle={isInviteLink ? 'Defina uma palavra-passe pessoal para concluir o convite.' : null}>
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
