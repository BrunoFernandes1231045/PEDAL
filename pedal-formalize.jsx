/* pedal-formalize.jsx — Fase 3: formalização (termos + rubrica → piloto ativo) */

const { useState: useStateF, useRef: useRefF, useEffect: useEffectF } = React;

// ── Canvas de assinatura/rubrica (rato + toque) ─────────────────────
function SignaturePad({ onChange }) {
  const wrapRef = useRefF();
  const canvasRef = useRefF();
  const drawing = useRefF(false);
  const last = useRefF(null);
  const [hasInk, setHasInk] = useStateF(false);

  useEffectF(() => {
    const canvas = canvasRef.current; const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const resize = () => {
      const w = wrap.offsetWidth, h = wrap.offsetHeight;
      // preserva o traço ao redimensionar
      const prev = canvas.toDataURL();
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--ink') || '#2A2620';
      if (hasInk) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, w, h); img.src = prev; }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
    // eslint-disable-next-line
  }, []);

  const pos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (cx - rect.left) / rect.width * canvasRef.current.width,
      y: (cy - rect.top) / rect.height * canvasRef.current.height,
    };
  };
  const start = (e) => { e.preventDefault(); drawing.current = true; last.current = pos(e); };
  const move = (e) => {
    if (!drawing.current) return; e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const p = pos(e);
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last.current = p;
    if (!hasInk) { setHasInk(true); }
  };
  const end = () => {
    if (!drawing.current) return; drawing.current = false;
    onChange && onChange(canvasRef.current.toDataURL('image/png'));
  };
  const clear = () => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setHasInk(false); onChange && onChange(null);
  };

  return (
    <div>
      <div ref={wrapRef} className="pedal-signpad">
        <canvas ref={canvasRef}
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
        <div className="pedal-signbase" />
        {!hasInk && <div className="pedal-signhint"><Icon name="user" size={15} />Assina com o dedo ou o rato</div>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span style={{ font: '400 11px var(--ui)', color: 'var(--ink-soft)' }}>A tua rubrica</span>
        <button className="pedal-authlink" onClick={clear} disabled={!hasInk} style={{ opacity: hasInk ? 1 : 0.4 }}>Limpar</button>
      </div>
    </div>
  );
}

// ── Cartão de formalização: termos + rubrica → ativação ─────────────
function FormalizationCard({ onConfirm }) {
  const F = window.PEDAL.FORMALIZATION;
  const [ok, setOk] = useStateF(false);
  const [sig, setSig] = useStateF(null);
  const [nif, setNif] = useStateF('');
  const nifDigits = nif.replace(/\D/g, '');
  const nifOk = nifDigits.length === 9;
  const ready = ok && !!sig && nifOk;
  // Nota: a animação de entrada (cardIn) congela neste cartão quando é montado
  // ao recarregar já em "formalização" (fica preso em opacity:0). Como uma
  // animação "a correr" tem prioridade sobre o estilo inline, desativamo-la aqui
  // para garantir que o termo de compromisso é sempre visível.
  return (
    <div className="pedal-card" style={{ width: '100%', borderColor: 'var(--primary)', animation: 'none', opacity: 1, transform: 'none' }}>
      <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 8 }}>
        <span style={{ color: 'var(--primary)', display: 'flex' }}><Icon name="shield" size={20} /></span>
        <span style={{ font: '700 15px var(--display)', color: 'var(--ink)' }}>Termo de compromisso do piloto</span>
      </div>
      <div style={{ display: 'grid', gap: 2 }}>
        {F.terms.map((t) => (
          <div key={t} className="pedal-termrow"><Icon name="check" size={15} />{t}</div>
        ))}
      </div>
      <p style={{ font: '400 12px/1.5 var(--ui)', color: 'var(--ink-soft)', margin: '10px 0 0' }}>{F.closing}</p>
      <label className="pedal-checkrow" style={{ marginTop: 12 }}>
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
        <span>Li e aceito os termos de compromisso do piloto voluntário.</span>
      </label>
      <div style={{ marginTop: 14 }}>
        <div style={{ font: '700 12.5px var(--ui)', color: 'var(--ink)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 7 }}><Icon name="lock" size={14} color="var(--primary)" />NIF (para o seguro do voluntário)</div>
        <input className="pedal-input" type="tel" inputMode="numeric" value={nif}
          onChange={(e) => setNif(e.target.value.replace(/[^\d\s]/g, '').slice(0, 11))}
          placeholder="NIF · 9 dígitos" />
        <div style={{ font: '400 11.5px var(--ui)', color: nif && !nifOk ? 'var(--accent-deep)' : 'var(--ink-soft)', marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
          <Icon name="shield" size={13} />{nif && !nifOk ? 'O NIF deve ter 9 dígitos.' : 'Pedimos o NIF só agora, para ativar o teu seguro de voluntário.'}
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <SignaturePad onChange={setSig} />
      </div>
      <button className="pedal-btn primary" disabled={!ready} onClick={() => onConfirm(sig, nifDigits)}
        style={{ width: '100%', marginTop: 14, opacity: ready ? 1 : 0.45 }}>
        Confirmar e tornar-me piloto ativo 🚲
      </button>
    </div>
  );
}

Object.assign(window, { SignaturePad, FormalizationCard });
