/* pedal-ui.jsx — primitivos visuais partilhados do PEDAL */

// ── Ícones (geometria simples apenas) ────────────────────────────────
function Icon({ name, size = 20, color = 'currentColor', stroke = 2 }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'check':   return <svg {...p}><path d="M4 12.5l5 5L20 6" /></svg>;
    case 'send':    return <svg {...p}><path d="M5 12h13M12 5l7 7-7 7" /></svg>;
    case 'chat':    return <svg {...p}><path d="M4 5h16v11H9l-5 4z" /></svg>;
    case 'book':    return <svg {...p}><path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 00-3 3z" /><path d="M5 4v19" /></svg>;
    case 'route':   return <svg {...p}><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="6" r="2.5" /><path d="M8.5 18H14a3 3 0 000-6H10a3 3 0 010-6h5.5" /></svg>;
    case 'pin':     return <svg {...p}><path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.4" /></svg>;
    case 'clock':   return <svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>;
    case 'shield':  return <svg {...p}><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" /></svg>;
    case 'user':    return <svg {...p}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1.2-3.6 4-5 7-5s5.8 1.4 7 5" /></svg>;
    case 'play':    return <svg {...p} fill={color} stroke="none"><path d="M7 5l12 7-12 7z" /></svg>;
    case 'lock':    return <svg {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>;
    case 'bell':    return <svg {...p}><path d="M6 9a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6z" /><path d="M10 20a2 2 0 004 0" /></svg>;
    case 'doc':     return <svg {...p}><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4" /><path d="M10 13h5M10 16h5" /></svg>;
    case 'phone':   return <svg {...p}><path d="M6 4h4l2 5-3 2a11 11 0 005 5l2-3 5 2v4a2 2 0 01-2 2A16 16 0 014 6a2 2 0 012-2z" /></svg>;
    case 'arrow':   return <svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
    case 'heart':   return <svg {...p}><path d="M12 20s-7-4.6-9.2-9C1.3 8 3 4.5 6.5 4.5 9 4.5 12 7 12 7s3-2.5 5.5-2.5C21 4.5 22.7 8 21.2 11 19 15.4 12 20 12 20z" /></svg>;
    case 'sparkle': return <svg {...p}><path d="M12 3v6M12 15v6M3 12h6M15 12h6" /></svg>;
    case 'people':  return <svg {...p}><circle cx="9" cy="8" r="3" /><path d="M3 19c.8-3 3.2-4.5 6-4.5S14.2 16 15 19" /><path d="M16 5.5a3 3 0 010 5.8M18 19c-.3-2-1.2-3.3-2.5-4" /></svg>;
    case 'map':        return <svg {...p}><path d="M3 7l5 2 8-4 5 2v12l-5-2-8 4-5-2z" /><path d="M8 9v10M16 5v10" /></svg>;
    case 'mortarboard': return <svg {...p}><path d="M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /><path d="M22 10v6" /></svg>;
    default: return null;
  }
}

// ── Avatar PEDAL: roda de bicicleta (círculo + cubo + raios) ─────────
function PedalMark({ size = 40, color = 'var(--primary)', bg = '#fff' }) {
  const s = size, c = s / 2, r = s * 0.36;
  const spokes = [];
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i;
    spokes.push(<line key={i} x1={c} y1={c} x2={c + r * Math.cos(a)} y2={c + r * Math.sin(a)}
      stroke={color} strokeWidth={s * 0.025} strokeLinecap="round" opacity="0.55" />);
  }
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={s * 0.07} />
      {spokes}
      <circle cx={c} cy={c} r={s * 0.085} fill={color} />
    </svg>
  );
}

function Avatar({ size = 38 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
    }}>
      <PedalMark size={size * 0.74} color="#fff" />
    </div>
  );
}

// ── Indicador "a escrever" ───────────────────────────────────────────
function TypingDots() {
  return (
    <div className="pedal-typing" style={{
      display: 'inline-flex', gap: 5, alignItems: 'center',
      background: 'var(--surface)', border: '1px solid var(--line)',
      padding: '13px 16px', borderRadius: '4px 18px 18px 18px',
    }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 8, height: 8, borderRadius: '50%', background: 'var(--ink-soft)',
          opacity: 0.5, animation: `pedalBounce 1.2s ${i * 0.18}s infinite ease-in-out`,
        }} />
      ))}
    </div>
  );
}

// ── Quick replies ────────────────────────────────────────────────────
function QuickReplies({ options, onPick }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-start', marginTop: 4, paddingLeft: 46 }}>
      {options.map((o) => {
        const label = typeof o === 'string' ? o : o.label;
        const acc = typeof o === 'object' ? o.accent : null;
        const fill = acc === 'fill';
        return (
          <button key={label} className="pedal-chip-btn" onClick={() => onPick(o)}
            style={{
              border: `1.5px solid ${fill ? 'var(--primary)' : acc ? 'var(--primary)' : 'var(--line)'}`,
              color: fill ? '#fff' : acc ? 'var(--primary)' : 'var(--ink)',
              background: fill ? 'var(--primary)' : 'var(--surface)',
              fontWeight: fill || acc ? 700 : 600,
            }}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── Placeholder de imagem (riscado + legenda monospace) ──────────────
function Placeholder({ label, height = 132, radius = 14 }) {
  return (
    <div style={{
      height, borderRadius: radius, width: '100%',
      background: 'repeating-linear-gradient(135deg, var(--ph-a) 0 11px, var(--ph-b) 11px 22px)',
      border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{
        font: '600 11px/1.3 ui-monospace, "SF Mono", Menlo, monospace',
        letterSpacing: 0.4, color: 'var(--ink-soft)', textTransform: 'uppercase',
        background: 'var(--app-bg)', padding: '4px 8px', borderRadius: 6, textAlign: 'center',
      }}>{label}</span>
    </div>
  );
}

// ── Barra de progresso ───────────────────────────────────────────────
function ProgressBar({ value, total, color = 'var(--accent)' }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 8, borderRadius: 99, background: 'var(--line)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99, transition: 'width .5s cubic-bezier(.4,0,.2,1)' }} />
      </div>
      <span style={{ font: '700 12px var(--ui)', color: 'var(--ink-soft)', minWidth: 34, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

// ── Pill / badge ─────────────────────────────────────────────────────
function Pill({ children, tone = 'neutral' }) {
  const tones = {
    neutral: { bg: 'var(--app-bg)', fg: 'var(--ink-soft)', bd: 'var(--line)' },
    green:   { bg: 'var(--accent-soft)', fg: 'var(--accent-deep)', bd: 'transparent' },
    amber:   { bg: 'var(--warn-soft)', fg: 'var(--warn-deep)', bd: 'transparent' },
  }[tone];
  return (
    <span style={{
      font: '700 11px var(--ui)', letterSpacing: 0.2, padding: '4px 9px', borderRadius: 99,
      background: tones.bg, color: tones.fg, border: `1px solid ${tones.bd}`,
      display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

Object.assign(window, { Icon, PedalMark, Avatar, TypingDots, QuickReplies, Placeholder, ProgressBar, Pill });
