/* pedal-cards.jsx — cartões interativos apresentados dentro do chat */

const { useState } = React;

// Apresentação do projeto (F2 / RF-03)
function getVideoEmbed(url) {
  if (!url) return null;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return 'https://player.vimeo.com/video/' + vimeo[1] + '?autoplay=0&title=0&byline=0&portrait=0';
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (yt) return 'https://www.youtube.com/embed/' + yt[1];
  return null;
}

function ProjectCard({ videoUrl }) {
  const embedUrl = getVideoEmbed(videoUrl);
  const facts = [
    { icon: 'route', t: 'Passeios em triciclo elétrico adaptado' },
    { icon: 'people', t: 'Para idosos e pessoas com mobilidade reduzida' },
    { icon: 'heart', t: 'Contacto social, ar livre e bem-estar' },
  ];
  return (
    <div className="pedal-card">
      {embedUrl ? (
        <div style={{ borderRadius: 14, overflow: 'hidden', background: '#000', aspectRatio: '16/9', width: '100%' }}>
          <iframe src={embedUrl} style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
        </div>
      ) : (
        <div style={{
          height: 140, borderRadius: 14, width: '100%', position: 'relative',
          background: 'repeating-linear-gradient(135deg, var(--ph-a) 0 11px, var(--ph-b) 11px 22px)',
          border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'rgba(255,255,255,.9)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,.14)',
          }}>
            <span style={{ color: 'var(--primary)', display: 'flex', paddingLeft: 2 }}><Icon name="play" size={20} /></span>
          </div>
          <span style={{
            position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
            font: '600 9.5px ui-monospace,"SF Mono",Menlo,monospace',
            letterSpacing: 0.5, color: 'var(--ink-soft)', textTransform: 'uppercase',
            background: 'var(--app-bg)', padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap',
          }}>vídeo · bem-vindo à pedalar sem idade</span>
        </div>
      )}
      <div style={{ font: '700 16px var(--display)', color: 'var(--ink)', marginTop: 12 }}>
        Levamos pessoas a passear — e a sorrir.
      </div>
      <div style={{ display: 'grid', gap: 9, marginTop: 11 }}>
        {facts.map((f) => (
          <div key={f.t} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ color: 'var(--primary)', display: 'flex' }}><Icon name={f.icon} size={19} /></span>
            <span style={{ font: '500 13.5px var(--ui)', color: 'var(--ink)' }}>{f.t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Consentimento RGPD (RF-05 / RNF-07)
function ConsentCard({ onAccept, onMore }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="pedal-card">
      <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 8 }}>
        <span style={{ color: 'var(--primary)', display: 'flex' }}><Icon name="shield" size={20} /></span>
        <span style={{ font: '700 15px var(--display)', color: 'var(--ink)' }}>Antes de começarmos</span>
      </div>
      <p style={{ font: '400 13.5px/1.55 var(--ui)', color: 'var(--ink-soft)', margin: 0 }}>
        Para te acompanhar, vamos guardar alguns dados (nome, data de nascimento, contacto,
        email, localidade e disponibilidade). Usamo-los só para o processo de voluntariado e nunca
        os partilhamos sem o teu consentimento, ao abrigo do RGPD.
      </p>
      <label className="pedal-checkrow" style={{ marginTop: 12 }}>
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
        <span>Li e aceito o tratamento dos meus dados.</span>
      </label>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="pedal-btn ghost" onClick={onMore}>Saber mais</button>
        <button className="pedal-btn primary" disabled={!ok} onClick={onAccept}
          style={{ opacity: ok ? 1 : 0.45, flex: 1 }}>Aceito e quero continuar</button>
      </div>
    </div>
  );
}

// Recolha de dados básicos (RF-06)
const COUNTRIES = [
  { code: 'PT', flag: '🇵🇹', label: 'Portugal', dialCode: '+351', placeholder: '9XX XXX XXX', maxDigits: 9, validate: (d) => d.length === 9 },
  { code: 'BR', flag: '🇧🇷', label: 'Brasil',   dialCode: '+55',  placeholder: 'XX 9XXXX XXXX', maxDigits: 11, validate: (d) => d.length >= 10 && d.length <= 11 },
];

function ProfileForm({ onSubmit }) {
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('PT');
  const [email, setEmail] = useState('');
  const [cc, setCc] = useState('');
  const [profissao, setProfissao] = useState('');
  const [nif, setNif] = useState('');
  const [rua, setRua] = useState('');
  const [porta, setPorta] = useState('');
  const [codigoPostal, setCodigoPostal] = useState('');
  const [cidade, setCidade] = useState('');

  const ct = COUNTRIES.find((c) => c.code === country) || COUNTRIES[0];
  const phoneDigits = phone.replace(/\D/g, '');
  const phoneOk = ct.validate(phoneDigits);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const nifDigits = nif.replace(/\D/g, '');
  const nifOk = nifDigits.length === 9;
  const cpOk = /^\d{4}-\d{3}$/.test(codigoPostal.trim());
  const valid = name.trim().length > 1 && phoneOk && emailOk && dob && cc.trim().length >= 8 && profissao.trim().length > 1 && nifOk && rua.trim().length > 2 && porta.trim().length > 0 && cpOk && cidade.trim().length > 1;

  const handleCp = (v) => {
    const digits = v.replace(/\D/g, '').slice(0, 7);
    setCodigoPostal(digits.length > 4 ? digits.slice(0, 4) + '-' + digits.slice(4) : digits);
  };

  const handleCountry = (code) => { setCountry(code); setPhone(''); };

  return (
    <div className="pedal-card">
      <Field label="Como te chamas?">
        <input className="pedal-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome e apelido" />
      </Field>
      <Field label="Data de nascimento">
        <input className="pedal-input" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
      </Field>
      <Field label="Número do Cartão de Cidadão">
        <input className="pedal-input" value={cc} onChange={(e) => setCc(e.target.value.replace(/[^\d]/g, '').slice(0, 8))} placeholder="XXXXXXXX" maxLength={8} />
      </Field>
      <Field label="NIF">
        <input className="pedal-input" type="tel" inputMode="numeric" value={nif} onChange={(e) => setNif(e.target.value.replace(/[^\d]/g, '').slice(0, 9))} placeholder="9 dígitos" maxLength={9} />
        {nif && !nifOk && <div style={{ font: '400 11px var(--ui)', color: 'var(--accent-deep)', marginTop: 5 }}>O NIF deve ter 9 dígitos.</div>}
      </Field>
      <Field label="Profissão">
        <input className="pedal-input" value={profissao} onChange={(e) => setProfissao(e.target.value)} placeholder="Ex.: Professor, Engenheiro, Reformado…" />
      </Field>
      <Field label="Morada">
        <input className="pedal-input" value={rua} onChange={(e) => setRua(e.target.value)} placeholder="Rua / Avenida / Travessa…" />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Field label="Nº da porta">
          <input className="pedal-input" value={porta} onChange={(e) => setPorta(e.target.value)} placeholder="Ex.: 12 3ºDto" />
        </Field>
        <Field label="Código postal">
          <input className="pedal-input" type="tel" inputMode="numeric" value={codigoPostal} onChange={(e) => handleCp(e.target.value)} placeholder="XXXX-XXX" maxLength={8} />
        </Field>
      </div>
      <Field label="Localidade">
        <input className="pedal-input" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Cidade / Vila" />
      </Field>
      <Field label="Telemóvel">
        <div style={{ display: 'flex', gap: 6, marginBottom: 7 }}>
          {COUNTRIES.map((c) => (
            <button key={c.code} type="button" onClick={() => handleCountry(c.code)}
              style={{ flex: 1, padding: '7px 10px', borderRadius: 9, border: `2px solid ${country === c.code ? 'var(--primary)' : 'var(--line)'}`, background: country === c.code ? 'var(--primary-soft)' : 'var(--surface)', cursor: 'pointer', font: '600 12.5px var(--ui)', color: country === c.code ? 'var(--primary-deep)' : 'var(--ink-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all .13s' }}>
              <span style={{ fontSize: 16 }}>{c.flag}</span>{c.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ font: '600 13px var(--ui)', color: 'var(--ink-soft)', background: 'var(--app-bg)', border: '1.5px solid var(--line)', borderRadius: 9, padding: '8px 10px', whiteSpace: 'nowrap' }}>{ct.dialCode}</span>
          <input className="pedal-input" style={{ flex: 1, margin: 0 }} type="tel" inputMode="numeric" value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, '').slice(0, ct.maxDigits + 2))}
            placeholder={ct.placeholder} />
        </div>
        {phone && !phoneOk && <div style={{ font: '400 11px var(--ui)', color: 'var(--accent-deep)', marginTop: 5 }}>{ct.code === 'PT' ? 'Número português: 9 dígitos.' : 'Número brasileiro: 10-11 dígitos (com DDD).'}</div>}
      </Field>
      <Field label="Email">
        <input className="pedal-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@email.pt" />
        <div style={{ font: '400 11px var(--ui)', color: 'var(--ink-soft)', marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="lock" size={12} />Enviamos para aqui os teus dados de acesso à app.</div>
      </Field>
      <button className="pedal-btn primary" disabled={!valid} onClick={() => onSubmit({ name: name.trim(), dob, cc: cc.trim(), nif: nifDigits, profissao: profissao.trim(), rua: rua.trim(), porta: porta.trim(), codigo_postal: codigoPostal.trim(), cidade: cidade.trim(), contact: ct.dialCode + phoneDigits, email: email.trim() })}
        style={{ opacity: valid ? 1 : 0.45, width: '100%', marginTop: 4 }}>Continuar</button>
    </div>
  );
}

// Triagem: localidade(s) + disponibilidade por dia×período (RF-07)
// locAvail: { [locId]: { [dayId]: periodId | null } }
function TriageForm({ localities, onSubmit }) {
  const P = window.PEDAL;
  const [locAvail, setLocAvail] = useState({});
  const [openLoc, setOpenLoc] = useState(null);

  const getAvail = (locId) => locAvail[locId] || {};
  const selectedDays = (locId) => Object.keys(getAvail(locId));
  const hasAnyPeriod = (locId) => Object.values(getAvail(locId)).some((p) => p != null);
  const isSelected = (locId) => hasAnyPeriod(locId);

  const toggleDay = (locId, dayId) => {
    setLocAvail((prev) => {
      const cur = { ...(prev[locId] || {}) };
      if (dayId in cur) { delete cur[dayId]; } else { cur[dayId] = null; }
      return { ...prev, [locId]: cur };
    });
  };

  const setPeriod = (locId, dayId, periodId) => {
    setLocAvail((prev) => ({
      ...prev,
      [locId]: { ...(prev[locId] || {}), [dayId]: prev[locId]?.[dayId] === periodId ? null : periodId },
    }));
  };

  const clearLoc = (locId) => setLocAvail((prev) => { const n = { ...prev }; delete n[locId]; return n; });

  const handleLocClick = (locId) => {
    if (openLoc === locId) {
      if (hasAnyPeriod(locId)) return; // só fecha se não há preferências
      setOpenLoc(null);
    } else {
      setOpenLoc(locId);
    }
  };

  const summary = (locId) => {
    const avail = getAvail(locId);
    return Object.entries(avail)
      .filter(([, p]) => p != null)
      .map(([dId, pId]) => {
        const d = P.WEEKDAYS.find((w) => w.id === dId);
        const p = P.PERIODS.find((x) => x.id === pId);
        return `${d?.name} · ${p?.name}`;
      }).join('  ·  ');
  };

  const valid = localities.some((l) => hasAnyPeriod(l.id));

  const handleSubmit = () => {
    const selLocs = localities.filter((l) => hasAnyPeriod(l.id)).map((l) => l.id);
    const availability = [];
    const periodsSet = new Set();
    selLocs.forEach((locId) => {
      Object.entries(getAvail(locId)).forEach(([dayId, periodId]) => {
        if (periodId) { availability.push({ day: dayId, period: periodId, localityId: locId }); periodsSet.add(periodId); }
      });
    });
    onSubmit({ localities: selLocs, locality: selLocs[0], availability, periods: [...periodsSet] });
  };

  const btnBase = { padding: '6px 11px', borderRadius: 8, cursor: 'pointer', font: '600 12px var(--ui)', transition: 'all .12s' };

  return (
    <div className="pedal-card">
      <Field label="Onde e quando podes pedalar?">
        <div style={{ display: 'grid', gap: 6 }}>
          {localities.map((loc) => {
            const open = openLoc === loc.id;
            const selected = isSelected(loc.id);
            const days = selectedDays(loc.id);
            const sum = !open ? summary(loc.id) : null;
            const canClose = !hasAnyPeriod(loc.id);
            return (
              <div key={loc.id}>
                <button onClick={() => handleLocClick(loc.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: open ? '10px 10px 0 0' : 10, border: `1.5px solid ${selected || open ? 'var(--primary)' : 'var(--line)'}`, background: 'var(--surface)', cursor: 'pointer', transition: 'all .15s' }}>
                  <span style={{ font: '700 13.5px var(--ui)', color: selected || open ? 'var(--primary)' : 'var(--ink)' }}>{loc.name}</span>
                  <span style={{ font: '500 12px var(--ui)', color: 'var(--ink-soft)' }}>{open ? '▲' : '▼'}</span>
                </button>

                {!open && sum && (
                  <div style={{ padding: '5px 14px 6px', borderRadius: '0 0 8px 8px', border: '1.5px solid var(--primary)', borderTop: 'none', background: 'var(--primary-soft)', font: '500 11px var(--ui)', color: 'var(--primary-deep)' }}>{sum}</div>
                )}

                {open && (
                  <div style={{ border: '1.5px solid var(--primary)', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '12px 14px 14px', background: 'var(--surface)' }}>
                    <div style={{ font: '600 11.5px var(--ui)', color: 'var(--ink-soft)', marginBottom: 8 }}>Dias disponíveis</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: days.length ? 14 : 0 }}>
                      {P.WEEKDAYS.map((day) => {
                        const on = days.includes(day.id);
                        return (
                          <button key={day.id} onClick={() => toggleDay(loc.id, day.id)} style={{ ...btnBase, border: `1.5px solid ${on ? 'var(--primary)' : 'var(--line)'}`, background: on ? 'var(--primary-soft)' : 'var(--surface)', color: on ? 'var(--primary-deep)' : 'var(--ink)' }}>{day.name}</button>
                        );
                      })}
                    </div>

                    {days.length > 0 && (
                      <div>
                        <div style={{ font: '600 11.5px var(--ui)', color: 'var(--ink-soft)', marginBottom: 8 }}>Preferência por dia</div>
                        <div style={{ display: 'grid', gap: 7 }}>
                          {days.map((dayId) => {
                            const day = P.WEEKDAYS.find((d) => d.id === dayId);
                            const selP = getAvail(loc.id)[dayId];
                            return (
                              <div key={dayId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ font: '700 12px var(--ui)', color: 'var(--ink)', width: 30, flexShrink: 0 }}>{day?.name}</span>
                                {P.PERIODS.map((period) => {
                                  const on = selP === period.id;
                                  return (
                                    <button key={period.id} onClick={() => setPeriod(loc.id, dayId, period.id)} style={{ ...btnBase, border: `1.5px solid ${on ? 'var(--primary)' : 'var(--line)'}`, background: on ? 'var(--primary)' : 'var(--surface)', color: on ? '#fff' : 'var(--ink)' }}>{period.name}</button>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                      {days.length > 0 ? (
                        <button onClick={() => clearLoc(loc.id)} style={{ font: '600 11.5px var(--ui)', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Limpar</button>
                      ) : <span />}
                      {!canClose && (
                        <span style={{ font: '500 11px var(--ui)', color: 'var(--ink-soft)' }}>Limpa as preferências para fechar</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Field>

      <button className="pedal-btn primary" disabled={!valid} onClick={handleSubmit} style={{ opacity: valid ? 1 : 0.45, width: '100%', marginTop: 8 }}>Ver disponibilidade</button>
    </div>
  );
}

// Perfil de função + aceitação (RF-20)
function RoleProfileCard({ profile, onAccept }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="pedal-card">
      <div style={{ font: '700 15px var(--display)', color: 'var(--ink)', marginBottom: 8 }}>{profile.title}</div>
      <div style={{ font: '700 11px var(--ui)', letterSpacing: 0.4, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: 6 }}>O que esperamos de ti</div>
      <div style={{ display: 'grid', gap: 7 }}>
        {profile.commitments.map((c) => (
          <div key={c} style={{ display: 'flex', gap: 8 }}>
            <span style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 1 }}><Icon name="check" size={16} /></span>
            <span style={{ font: '500 13px/1.4 var(--ui)', color: 'var(--ink)' }}>{c}</span>
          </div>
        ))}
      </div>
      <div style={{ font: '700 11px var(--ui)', letterSpacing: 0.4, color: 'var(--accent-deep)', textTransform: 'uppercase', margin: '13px 0 6px' }}>O que recebes de nós</div>
      <div style={{ display: 'grid', gap: 7 }}>
        {profile.weGive.map((c) => (
          <div key={c} style={{ display: 'flex', gap: 8 }}>
            <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}><Icon name="heart" size={15} /></span>
            <span style={{ font: '500 13px/1.4 var(--ui)', color: 'var(--ink)' }}>{c}</span>
          </div>
        ))}
      </div>
      <label className="pedal-checkrow" style={{ marginTop: 13 }}>
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
        <span>Li e aceito o perfil e o compromisso do piloto.</span>
      </label>
      <button className="pedal-btn primary" disabled={!ok} onClick={onAccept}
        style={{ opacity: ok ? 1 : 0.45, width: '100%', marginTop: 12 }}>Aceitar e ver a formação</button>
    </div>
  );
}

// Caixa de comentário para enviar dúvida à coordenação (RF-27 / handoff humano)
function DoubtBoxCard({ initial = '', candidate, sent, retry, coordOnly, onAsk, onSubmit, onBack }) {
  const [text, setText] = useState(initial);
  const [contact, setContact] = useState((candidate && candidate.contact) || '');
  const hasContact = !!(candidate && candidate.contact);
  const valid = text.trim().length >= 3;
  const directSend = retry || coordOnly; // caixa que só envia à coordenação, sem "Perguntar ao PEDAL"

  if (sent) {
    return (
      <div className="pedal-card" style={{ borderColor: 'var(--accent)' }}>
        <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 8 }}>
          <span style={{ color: 'var(--accent-deep)', display: 'flex' }}><Icon name="check" size={20} /></span>
          <span style={{ font: '700 15px var(--display)', color: 'var(--ink)' }}>Dúvida enviada à coordenação</span>
        </div>
        <p style={{ font: '400 13px/1.55 var(--ui)', color: 'var(--ink-soft)', margin: 0 }}>
          A equipa recebeu a tua pergunta na consola de gestão e responde-te aqui mesmo, neste chat, assim que possível. 💛
        </p>
        <div className="pedal-contactrow" style={{ marginTop: 11 }}>
          <span style={{ color: 'var(--primary)' }}><Icon name="phone" size={17} /></span>
          <span style={{ font: '700 13.5px var(--ui)', color: 'var(--ink)' }}>220 000 000</span>
          <span style={{ font: '400 11.5px var(--ui)', color: 'var(--ink-soft)', marginLeft: 'auto' }}>seg–sex · 9h–18h</span>
        </div>
        {onBack && <button className="pedal-btn ghost" onClick={onBack} style={{ width: '100%', marginTop: 10 }}>Voltar à conversa</button>}
      </div>
    );
  }

  return (
    <div className="pedal-card" style={{ borderColor: 'var(--accent)' }}>
      <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 8 }}>
        <span style={{ color: 'var(--accent-deep)', display: 'flex' }}><Icon name="chat" size={20} /></span>
        <span style={{ font: '700 15px var(--display)', color: 'var(--ink)' }}>{retry ? 'Enviar esta dúvida à coordenação?' : (coordOnly ? 'Enviar dúvida à coordenação' : 'Tens uma dúvida?')}</span>
      </div>
      <p style={{ font: '400 12.5px/1.5 var(--ui)', color: 'var(--ink-soft)', margin: '0 0 11px' }}>
        {retry
          ? 'Como não consegui responder com certeza, posso encaminhar a tua dúvida à coordenação — eles respondem-te aqui no chat. Ou podes voltar à conversa.'
          : (coordOnly
            ? 'Escreve a tua pergunta e enviamo-la diretamente à coordenação — eles respondem-te aqui no chat. 💛'
            : 'Escreve a tua pergunta. Eu tento responder primeiro; se não conseguir, podes enviar diretamente à coordenação.')}
      </p>
      <Field label="A tua dúvida">
        <textarea className="pedal-agentinfo" value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Por ex.: como funciona o seguro de voluntariado?"
          style={{ minHeight: 80, resize: 'vertical' }} />
      </Field>
      {!hasContact && (
        <Field label="Como te contactamos? (opcional)">
          <input className="pedal-input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Telemóvel ou email" />
        </Field>
      )}
      {!directSend && onAsk && (
        <button className="pedal-btn primary" disabled={!valid} onClick={() => onAsk(text.trim())}
          style={{ opacity: valid ? 1 : 0.45, width: '100%' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, justifyContent: 'center' }}>Perguntar ao PEDAL <Icon name="arrow" size={14} color="#fff" /></span>
        </button>
      )}
      {directSend && (
        <button
          className="pedal-btn primary"
          disabled={!valid}
          onClick={() => onSubmit({ question: text.trim(), contact: contact.trim() })}
          style={{ opacity: valid ? 1 : 0.45, width: '100%' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, justifyContent: 'center' }}>Enviar à coordenação <Icon name="send" size={14} color="#fff" /></span>
        </button>
      )}
      {directSend && (
        <div style={{ font: '400 11.5px/1.5 var(--ui)', color: 'var(--ink-soft)', marginTop: 9, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <Icon name="lock" size={12} /><span>Se enviares à coordenação, a mensagem fica registada na consola da Pedalar Sem Idade.</span>
        </div>
      )}
      {onBack && <button className="pedal-authlink" onClick={onBack} style={{ display: 'block', margin: '10px auto 0' }}>Voltar à conversa</button>}
    </div>
  );
}

// Encaminhamento para contacto humano (RF-27 / RNF-06)
function HandoffCard({ onBack }) {
  return (
    <div className="pedal-card" style={{ borderColor: 'var(--accent)' }}>
      <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 8 }}>
        <span style={{ color: 'var(--accent-deep)', display: 'flex' }}><Icon name="people" size={20} /></span>
        <span style={{ font: '700 15px var(--display)', color: 'var(--ink)' }}>Falar com a equipa</span>
      </div>
      <p style={{ font: '400 13.5px/1.55 var(--ui)', color: 'var(--ink-soft)', margin: 0 }}>
        Há coisas que se resolvem melhor pessoa a pessoa. A coordenação foi avisada e vai
        contactar-te. Se preferires, liga-nos:
      </p>
      <div className="pedal-contactrow" style={{ marginTop: 11 }}>
        <span style={{ color: 'var(--primary)' }}><Icon name="phone" size={17} /></span>
        <span style={{ font: '700 14px var(--ui)', color: 'var(--ink)' }}>220 000 000</span>
        <span style={{ font: '400 12px var(--ui)', color: 'var(--ink-soft)', marginLeft: 'auto' }}>seg–sex · 9h–18h</span>
      </div>
      {onBack && <button className="pedal-btn ghost" onClick={onBack} style={{ width: '100%', marginTop: 10 }}>Voltar à conversa</button>}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ font: '600 12px var(--ui)', color: 'var(--ink-soft)', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

Object.assign(window, { ProjectCard, ConsentCard, ProfileForm, TriageForm, RoleProfileCard, HandoffCard, DoubtBoxCard, Field });
