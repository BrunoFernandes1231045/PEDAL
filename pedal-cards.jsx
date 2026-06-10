/* pedal-cards.jsx — cartões interativos apresentados dentro do chat */

const { useState } = React;

// Apresentação do projeto (F2 / RF-03)
function ProjectCard() {
  const facts = [
    { icon: 'route', t: 'Passeios em triciclo elétrico adaptado' },
    { icon: 'people', t: 'Para idosos e pessoas com mobilidade reduzida' },
    { icon: 'heart', t: 'Contacto social, ar livre e bem-estar' },
  ];
  return (
    <div className="pedal-card">
      <Placeholder label="foto · passeio com beneficiário" height={120} />
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
function ProfileForm({ onSubmit }) {
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const valid = name.trim().length > 1 && phone.trim().length > 6 && emailOk && dob;
  return (
    <div className="pedal-card">
      <Field label="Como te chamas?">
        <input className="pedal-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome e apelido" />
      </Field>
      <Field label="Data de nascimento">
        <input className="pedal-input" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
      </Field>
      <Field label="Telemóvel">
        <input className="pedal-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9XX XXX XXX" />
      </Field>
      <Field label="Email">
        <input className="pedal-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@email.pt" />
        <div style={{ font: '400 11px var(--ui)', color: 'var(--ink-soft)', marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="lock" size={12} />Enviamos para aqui os teus dados de acesso à app.</div>
      </Field>
      <button className="pedal-btn primary" disabled={!valid} onClick={() => onSubmit({ name: name.trim(), dob, contact: phone.trim(), email: email.trim() })}
        style={{ opacity: valid ? 1 : 0.45, width: '100%', marginTop: 4 }}>Continuar</button>
    </div>
  );
}

// Triagem: localidade(s) + disponibilidade (RF-07) — permite escolher vários locais
function TriageForm({ localities, periods, onSubmit }) {
  const [locs, setLocs] = useState(['matosinhos']);
  const [per, setPer] = useState(['flex']);
  const toggle = (id) => setPer((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const toggleLoc = (id) => setLocs((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  return (
    <div className="pedal-card">
      <Field label="Onde gostarias de pedalar? (podes escolher vários)">
        <div className="pedal-pickgrid">
          {localities.map((l) => (
            <button key={l.id} onClick={() => toggleLoc(l.id)}
              className={'pedal-pick' + (locs.includes(l.id) ? ' on' : '')}>
              {l.name}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Que disponibilidade tens?">
        <div className="pedal-pickgrid">
          {periods.map((p) => (
            <button key={p.id} onClick={() => toggle(p.id)}
              className={'pedal-pick' + (per.includes(p.id) ? ' on' : '')}>
              {p.name}
            </button>
          ))}
        </div>
      </Field>
      <button className="pedal-btn primary" disabled={!per.length || !locs.length}
        onClick={() => onSubmit({ localities: locs, locality: locs[0], periods: per })}
        style={{ opacity: (per.length && locs.length) ? 1 : 0.45, width: '100%', marginTop: 4 }}>Ver disponibilidade</button>
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
