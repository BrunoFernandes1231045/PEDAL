/* pedal-cards.jsx — cartões interativos apresentados dentro do chat */

const { useState, useRef, useEffect } = React;

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
    { icon: 'route', t: 'Passeios em triciclo elétrico' },
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
      <a href={window.PEDAL.PRIVACY_POLICY_URL}
        style={{ display: 'inline-block', marginTop: 10, font: '700 12.5px var(--ui)', color: 'var(--primary-deep)' }}>
        Ver documento de consentimento (RGPD)
      </a>
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
const ALL_COUNTRIES = [
  { code: 'PT', flag: '🇵🇹', label: 'Portugal',                   dialCode: '+351', placeholder: '9XX XXX XXX',      maxDigits: 9,  validate: (d) => d.length === 9 },
  { code: 'AF', flag: '🇦🇫', label: 'Afeganistão',                dialCode: '+93',  placeholder: 'XXX XXX XXXX',     maxDigits: 12, validate: (d) => d.length >= 7 },
  { code: 'ZA', flag: '🇿🇦', label: 'África do Sul',              dialCode: '+27',  placeholder: 'XX XXX XXXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'AL', flag: '🇦🇱', label: 'Albânia',                    dialCode: '+355', placeholder: 'XXX XXX XXXX',     maxDigits: 12, validate: (d) => d.length >= 7 },
  { code: 'DE', flag: '🇩🇪', label: 'Alemanha',                   dialCode: '+49',  placeholder: 'XXXX XXXXXXX',     maxDigits: 12, validate: (d) => d.length >= 7 },
  { code: 'AD', flag: '🇦🇩', label: 'Andorra',                    dialCode: '+376', placeholder: 'XXX XXX',          maxDigits: 9,  validate: (d) => d.length >= 6 },
  { code: 'AO', flag: '🇦🇴', label: 'Angola',                     dialCode: '+244', placeholder: 'XXX XXX XXX',      maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'SA', flag: '🇸🇦', label: 'Arábia Saudita',             dialCode: '+966', placeholder: 'XXX XXX XXXX',     maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'DZ', flag: '🇩🇿', label: 'Argélia',                    dialCode: '+213', placeholder: 'XXX XXX XXXX',     maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'AR', flag: '🇦🇷', label: 'Argentina',                  dialCode: '+54',  placeholder: 'XX XXXX XXXX',     maxDigits: 11, validate: (d) => d.length >= 7 },
  { code: 'AM', flag: '🇦🇲', label: 'Arménia',                    dialCode: '+374', placeholder: 'XX XXX XXX',       maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'AU', flag: '🇦🇺', label: 'Austrália',                  dialCode: '+61',  placeholder: 'XXX XXX XXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'AT', flag: '🇦🇹', label: 'Áustria',                    dialCode: '+43',  placeholder: 'XXX XXXXXXX',      maxDigits: 12, validate: (d) => d.length >= 7 },
  { code: 'AZ', flag: '🇦🇿', label: 'Azerbaijão',                 dialCode: '+994', placeholder: 'XX XXX XXXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'BS', flag: '🇧🇸', label: 'Bahamas',                    dialCode: '+1',   placeholder: '242 XXX XXXX',     maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'BD', flag: '🇧🇩', label: 'Bangladesh',                 dialCode: '+880', placeholder: 'XXXX XXXXXX',      maxDigits: 11, validate: (d) => d.length >= 7 },
  { code: 'BE', flag: '🇧🇪', label: 'Bélgica',                    dialCode: '+32',  placeholder: 'XXX XX XX XX',     maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'BZ', flag: '🇧🇿', label: 'Belize',                     dialCode: '+501', placeholder: 'XXX XXXX',         maxDigits: 8,  validate: (d) => d.length >= 7 },
  { code: 'BJ', flag: '🇧🇯', label: 'Benin',                      dialCode: '+229', placeholder: 'XX XX XX XX',      maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'BY', flag: '🇧🇾', label: 'Bielorrússia',               dialCode: '+375', placeholder: 'XX XXX XXXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'BO', flag: '🇧🇴', label: 'Bolívia',                    dialCode: '+591', placeholder: 'X XXX XXXX',       maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'BA', flag: '🇧🇦', label: 'Bósnia e Herzegovina',       dialCode: '+387', placeholder: 'XX XXX XXX',       maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'BW', flag: '🇧🇼', label: 'Botswana',                   dialCode: '+267', placeholder: 'XX XXX XXX',       maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'BR', flag: '🇧🇷', label: 'Brasil',                     dialCode: '+55',  placeholder: 'XX 9XXXX XXXX',   maxDigits: 11, validate: (d) => d.length >= 10 && d.length <= 11 },
  { code: 'BN', flag: '🇧🇳', label: 'Brunei',                     dialCode: '+673', placeholder: 'XXX XXXX',         maxDigits: 8,  validate: (d) => d.length >= 7 },
  { code: 'BG', flag: '🇧🇬', label: 'Bulgária',                   dialCode: '+359', placeholder: 'XXX XXX XXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'BF', flag: '🇧🇫', label: 'Burkina Faso',               dialCode: '+226', placeholder: 'XX XX XX XX',      maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'BI', flag: '🇧🇮', label: 'Burundi',                    dialCode: '+257', placeholder: 'XX XX XXXX',       maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'BT', flag: '🇧🇹', label: 'Butão',                      dialCode: '+975', placeholder: 'XX XXX XXX',       maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'CV', flag: '🇨🇻', label: 'Cabo Verde',                 dialCode: '+238', placeholder: 'XXX XXXX',         maxDigits: 8,  validate: (d) => d.length >= 7 },
  { code: 'CM', flag: '🇨🇲', label: 'Camarões',                   dialCode: '+237', placeholder: 'XXXX XXXX',        maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'KH', flag: '🇰🇭', label: 'Camboja',                    dialCode: '+855', placeholder: 'XX XXX XXX',       maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'CA', flag: '🇨🇦', label: 'Canadá',                     dialCode: '+1',   placeholder: 'XXX XXX XXXX',     maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'QA', flag: '🇶🇦', label: 'Catar',                      dialCode: '+974', placeholder: 'XXXX XXXX',        maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'KZ', flag: '🇰🇿', label: 'Cazaquistão',                dialCode: '+7',   placeholder: 'XXX XXX XXXX',     maxDigits: 11, validate: (d) => d.length >= 7 },
  { code: 'TD', flag: '🇹🇩', label: 'Chade',                      dialCode: '+235', placeholder: 'XX XX XX XX',      maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'CL', flag: '🇨🇱', label: 'Chile',                      dialCode: '+56',  placeholder: 'X XXXX XXXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'CN', flag: '🇨🇳', label: 'China',                      dialCode: '+86',  placeholder: 'XXX XXXX XXXX',    maxDigits: 11, validate: (d) => d.length >= 7 },
  { code: 'CY', flag: '🇨🇾', label: 'Chipre',                     dialCode: '+357', placeholder: 'XX XXXXXX',        maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'CO', flag: '🇨🇴', label: 'Colômbia',                   dialCode: '+57',  placeholder: 'XXX XXX XXXX',     maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'KM', flag: '🇰🇲', label: 'Comores',                    dialCode: '+269', placeholder: 'XXX XXXX',         maxDigits: 8,  validate: (d) => d.length >= 7 },
  { code: 'CG', flag: '🇨🇬', label: 'Congo',                      dialCode: '+242', placeholder: 'XX XXX XXXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'CD', flag: '🇨🇩', label: 'Congo (Rep. Dem.)',           dialCode: '+243', placeholder: 'XX XXX XXXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'KR', flag: '🇰🇷', label: 'Coreia do Sul',              dialCode: '+82',  placeholder: 'XX XXXX XXXX',     maxDigits: 11, validate: (d) => d.length >= 7 },
  { code: 'CI', flag: '🇨🇮', label: 'Costa do Marfim',            dialCode: '+225', placeholder: 'XX XX XX XXXX',    maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'CR', flag: '🇨🇷', label: 'Costa Rica',                 dialCode: '+506', placeholder: 'XXXX XXXX',        maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'HR', flag: '🇭🇷', label: 'Croácia',                    dialCode: '+385', placeholder: 'XX XXX XXXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'CU', flag: '🇨🇺', label: 'Cuba',                       dialCode: '+53',  placeholder: 'X XXX XXXX',       maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'DK', flag: '🇩🇰', label: 'Dinamarca',                  dialCode: '+45',  placeholder: 'XXXX XXXX',        maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'EG', flag: '🇪🇬', label: 'Egito',                      dialCode: '+20',  placeholder: 'XXX XXX XXXX',     maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'SV', flag: '🇸🇻', label: 'El Salvador',                dialCode: '+503', placeholder: 'XXXX XXXX',        maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'AE', flag: '🇦🇪', label: 'Emirados Árabes Unidos',     dialCode: '+971', placeholder: 'XX XXX XXXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'EC', flag: '🇪🇨', label: 'Equador',                    dialCode: '+593', placeholder: 'XX XXX XXXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'ER', flag: '🇪🇷', label: 'Eritreia',                   dialCode: '+291', placeholder: 'X XXX XXXX',       maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'SK', flag: '🇸🇰', label: 'Eslováquia',                 dialCode: '+421', placeholder: 'XXX XXX XXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'SI', flag: '🇸🇮', label: 'Eslovénia',                  dialCode: '+386', placeholder: 'XX XXX XXX',       maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'ES', flag: '🇪🇸', label: 'Espanha',                    dialCode: '+34',  placeholder: 'XXX XXX XXX',      maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'SZ', flag: '🇸🇿', label: 'Essuatíni',                  dialCode: '+268', placeholder: 'XXXX XXXX',        maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'US', flag: '🇺🇸', label: 'Estados Unidos',             dialCode: '+1',   placeholder: 'XXX XXX XXXX',     maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'EE', flag: '🇪🇪', label: 'Estónia',                    dialCode: '+372', placeholder: 'XXX XXXX',         maxDigits: 8,  validate: (d) => d.length >= 7 },
  { code: 'ET', flag: '🇪🇹', label: 'Etiópia',                    dialCode: '+251', placeholder: 'XX XXX XXXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'FJ', flag: '🇫🇯', label: 'Fiji',                       dialCode: '+679', placeholder: 'XXX XXXX',         maxDigits: 8,  validate: (d) => d.length >= 7 },
  { code: 'PH', flag: '🇵🇭', label: 'Filipinas',                  dialCode: '+63',  placeholder: 'XXX XXX XXXX',     maxDigits: 11, validate: (d) => d.length >= 7 },
  { code: 'FI', flag: '🇫🇮', label: 'Finlândia',                  dialCode: '+358', placeholder: 'XXX XXX XXXX',     maxDigits: 12, validate: (d) => d.length >= 7 },
  { code: 'FR', flag: '🇫🇷', label: 'França',                     dialCode: '+33',  placeholder: 'X XX XX XX XX',   maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'GA', flag: '🇬🇦', label: 'Gabão',                      dialCode: '+241', placeholder: 'X XX XX XX',       maxDigits: 8,  validate: (d) => d.length >= 7 },
  { code: 'GM', flag: '🇬🇲', label: 'Gâmbia',                     dialCode: '+220', placeholder: 'XXX XXXX',         maxDigits: 8,  validate: (d) => d.length >= 7 },
  { code: 'GH', flag: '🇬🇭', label: 'Gana',                       dialCode: '+233', placeholder: 'XX XXX XXXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'GE', flag: '🇬🇪', label: 'Geórgia',                    dialCode: '+995', placeholder: 'XXX XXX XXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'GR', flag: '🇬🇷', label: 'Grécia',                     dialCode: '+30',  placeholder: 'XXX XXX XXXX',     maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'GT', flag: '🇬🇹', label: 'Guatemala',                  dialCode: '+502', placeholder: 'X XXX XXXX',       maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'GN', flag: '🇬🇳', label: 'Guiné',                      dialCode: '+224', placeholder: 'XXX XXX XXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'GW', flag: '🇬🇼', label: 'Guiné-Bissau',               dialCode: '+245', placeholder: 'XXX XXXX',         maxDigits: 8,  validate: (d) => d.length >= 7 },
  { code: 'GQ', flag: '🇬🇶', label: 'Guiné Equatorial',           dialCode: '+240', placeholder: 'XXX XXX XXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'GY', flag: '🇬🇾', label: 'Guiana',                     dialCode: '+592', placeholder: 'XXX XXXX',         maxDigits: 8,  validate: (d) => d.length >= 7 },
  { code: 'HT', flag: '🇭🇹', label: 'Haiti',                      dialCode: '+509', placeholder: 'XXXX XXXX',        maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'HN', flag: '🇭🇳', label: 'Honduras',                   dialCode: '+504', placeholder: 'XXXX XXXX',        maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'HU', flag: '🇭🇺', label: 'Hungria',                    dialCode: '+36',  placeholder: 'XX XXX XXXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'YE', flag: '🇾🇪', label: 'Iémen',                      dialCode: '+967', placeholder: 'XXX XXX XXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'IN', flag: '🇮🇳', label: 'Índia',                      dialCode: '+91',  placeholder: 'XXXXX XXXXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'ID', flag: '🇮🇩', label: 'Indonésia',                  dialCode: '+62',  placeholder: 'XXX XXXX XXXX',    maxDigits: 12, validate: (d) => d.length >= 7 },
  { code: 'IQ', flag: '🇮🇶', label: 'Iraque',                     dialCode: '+964', placeholder: 'XXX XXX XXXX',     maxDigits: 11, validate: (d) => d.length >= 7 },
  { code: 'IR', flag: '🇮🇷', label: 'Irão',                       dialCode: '+98',  placeholder: 'XXX XXX XXXX',     maxDigits: 11, validate: (d) => d.length >= 7 },
  { code: 'IE', flag: '🇮🇪', label: 'Irlanda',                    dialCode: '+353', placeholder: 'XX XXX XXXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'IS', flag: '🇮🇸', label: 'Islândia',                   dialCode: '+354', placeholder: 'XXX XXXX',         maxDigits: 8,  validate: (d) => d.length >= 7 },
  { code: 'IL', flag: '🇮🇱', label: 'Israel',                     dialCode: '+972', placeholder: 'XX XXX XXXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'IT', flag: '🇮🇹', label: 'Itália',                     dialCode: '+39',  placeholder: 'XXX XXX XXXX',     maxDigits: 11, validate: (d) => d.length >= 7 },
  { code: 'JP', flag: '🇯🇵', label: 'Japão',                      dialCode: '+81',  placeholder: 'XX XXXX XXXX',     maxDigits: 11, validate: (d) => d.length >= 7 },
  { code: 'JO', flag: '🇯🇴', label: 'Jordânia',                   dialCode: '+962', placeholder: 'X XXXX XXXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'KW', flag: '🇰🇼', label: 'Kuwait',                     dialCode: '+965', placeholder: 'XXXX XXXX',        maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'LA', flag: '🇱🇦', label: 'Laos',                       dialCode: '+856', placeholder: 'XX XX XXX XXX',    maxDigits: 11, validate: (d) => d.length >= 7 },
  { code: 'LS', flag: '🇱🇸', label: 'Lesoto',                     dialCode: '+266', placeholder: 'X XXX XXXX',       maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'LV', flag: '🇱🇻', label: 'Letónia',                    dialCode: '+371', placeholder: 'XXX XXXXX',        maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'LB', flag: '🇱🇧', label: 'Líbano',                     dialCode: '+961', placeholder: 'XX XXX XXX',       maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'LR', flag: '🇱🇷', label: 'Libéria',                    dialCode: '+231', placeholder: 'XX XXX XXXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'LY', flag: '🇱🇾', label: 'Líbia',                      dialCode: '+218', placeholder: 'XX XXX XXXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'LI', flag: '🇱🇮', label: 'Liechtenstein',              dialCode: '+423', placeholder: 'XXX XXXX',         maxDigits: 8,  validate: (d) => d.length >= 7 },
  { code: 'LT', flag: '🇱🇹', label: 'Lituânia',                   dialCode: '+370', placeholder: 'XXX XXXXX',        maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'LU', flag: '🇱🇺', label: 'Luxemburgo',                 dialCode: '+352', placeholder: 'XXX XXX XXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'MK', flag: '🇲🇰', label: 'Macedónia do Norte',         dialCode: '+389', placeholder: 'XX XXX XXX',       maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'MG', flag: '🇲🇬', label: 'Madagáscar',                 dialCode: '+261', placeholder: 'XX XX XXX XX',     maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'MY', flag: '🇲🇾', label: 'Malásia',                    dialCode: '+60',  placeholder: 'XX XXXX XXXX',     maxDigits: 11, validate: (d) => d.length >= 7 },
  { code: 'MW', flag: '🇲🇼', label: 'Malawi',                     dialCode: '+265', placeholder: 'X XXXX XXXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'MV', flag: '🇲🇻', label: 'Maldivas',                   dialCode: '+960', placeholder: 'XXX XXXX',         maxDigits: 8,  validate: (d) => d.length >= 7 },
  { code: 'ML', flag: '🇲🇱', label: 'Mali',                       dialCode: '+223', placeholder: 'XXXX XXXX',        maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'MT', flag: '🇲🇹', label: 'Malta',                      dialCode: '+356', placeholder: 'XXXX XXXX',        maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'MA', flag: '🇲🇦', label: 'Marrocos',                   dialCode: '+212', placeholder: 'XXX XXX XXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'MU', flag: '🇲🇺', label: 'Maurícia',                   dialCode: '+230', placeholder: 'XXXX XXXX',        maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'MR', flag: '🇲🇷', label: 'Mauritânia',                 dialCode: '+222', placeholder: 'XXXX XXXX',        maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'MX', flag: '🇲🇽', label: 'México',                     dialCode: '+52',  placeholder: 'XXX XXX XXXX',     maxDigits: 11, validate: (d) => d.length >= 7 },
  { code: 'MZ', flag: '🇲🇿', label: 'Moçambique',                 dialCode: '+258', placeholder: 'XX XXX XXXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'MD', flag: '🇲🇩', label: 'Moldávia',                   dialCode: '+373', placeholder: 'XX XXX XXX',       maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'MC', flag: '🇲🇨', label: 'Mónaco',                     dialCode: '+377', placeholder: 'XX XX XX XX',      maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'MN', flag: '🇲🇳', label: 'Mongólia',                   dialCode: '+976', placeholder: 'XXXX XXXX',        maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'ME', flag: '🇲🇪', label: 'Montenegro',                 dialCode: '+382', placeholder: 'XX XXX XXX',       maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'NA', flag: '🇳🇦', label: 'Namíbia',                    dialCode: '+264', placeholder: 'XX XXX XXXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'NP', flag: '🇳🇵', label: 'Nepal',                      dialCode: '+977', placeholder: 'XXX XXX XXXX',     maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'NI', flag: '🇳🇮', label: 'Nicarágua',                  dialCode: '+505', placeholder: 'XXXX XXXX',        maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'NE', flag: '🇳🇪', label: 'Níger',                      dialCode: '+227', placeholder: 'XX XX XX XX',      maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'NG', flag: '🇳🇬', label: 'Nigéria',                    dialCode: '+234', placeholder: 'XXX XXX XXXX',     maxDigits: 11, validate: (d) => d.length >= 7 },
  { code: 'NO', flag: '🇳🇴', label: 'Noruega',                    dialCode: '+47',  placeholder: 'XXX XX XXX',       maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'NZ', flag: '🇳🇿', label: 'Nova Zelândia',              dialCode: '+64',  placeholder: 'XX XXX XXXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'OM', flag: '🇴🇲', label: 'Omã',                        dialCode: '+968', placeholder: 'XXXX XXXX',        maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'NL', flag: '🇳🇱', label: 'Países Baixos',              dialCode: '+31',  placeholder: 'X XX XX XX XX',   maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'PK', flag: '🇵🇰', label: 'Paquistão',                  dialCode: '+92',  placeholder: 'XXX XXX XXXX',     maxDigits: 11, validate: (d) => d.length >= 7 },
  { code: 'PY', flag: '🇵🇾', label: 'Paraguai',                   dialCode: '+595', placeholder: 'XXX XXX XXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'PE', flag: '🇵🇪', label: 'Peru',                       dialCode: '+51',  placeholder: 'XXX XXX XXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'PL', flag: '🇵🇱', label: 'Polónia',                    dialCode: '+48',  placeholder: 'XXX XXX XXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'CF', flag: '🇨🇫', label: 'República Centro-Africana',  dialCode: '+236', placeholder: 'XX XX XXXX',       maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'CZ', flag: '🇨🇿', label: 'República Checa',            dialCode: '+420', placeholder: 'XXX XXX XXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'DO', flag: '🇩🇴', label: 'República Dominicana',       dialCode: '+1',   placeholder: '809 XXX XXXX',     maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'RO', flag: '🇷🇴', label: 'Roménia',                    dialCode: '+40',  placeholder: 'XXX XXX XXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'RW', flag: '🇷🇼', label: 'Ruanda',                     dialCode: '+250', placeholder: 'XXX XXX XXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'RU', flag: '🇷🇺', label: 'Rússia',                     dialCode: '+7',   placeholder: 'XXX XXX XXXX',     maxDigits: 11, validate: (d) => d.length >= 7 },
  { code: 'ST', flag: '🇸🇹', label: 'São Tomé e Príncipe',        dialCode: '+239', placeholder: 'XXX XXXX',         maxDigits: 8,  validate: (d) => d.length >= 7 },
  { code: 'SN', flag: '🇸🇳', label: 'Senegal',                    dialCode: '+221', placeholder: 'XX XXX XXXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'SL', flag: '🇸🇱', label: 'Serra Leoa',                 dialCode: '+232', placeholder: 'XX XXXXXX',        maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'RS', flag: '🇷🇸', label: 'Sérvia',                     dialCode: '+381', placeholder: 'XX XXX XXXX',      maxDigits: 11, validate: (d) => d.length >= 7 },
  { code: 'SC', flag: '🇸🇨', label: 'Seicheles',                  dialCode: '+248', placeholder: 'X XX XX XX',       maxDigits: 8,  validate: (d) => d.length >= 7 },
  { code: 'SG', flag: '🇸🇬', label: 'Singapura',                  dialCode: '+65',  placeholder: 'XXXX XXXX',        maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'SY', flag: '🇸🇾', label: 'Síria',                      dialCode: '+963', placeholder: 'XXX XXX XXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'SO', flag: '🇸🇴', label: 'Somália',                    dialCode: '+252', placeholder: 'XX XXX XXX',       maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'LK', flag: '🇱🇰', label: 'Sri Lanka',                  dialCode: '+94',  placeholder: 'XX XXX XXXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'SD', flag: '🇸🇩', label: 'Sudão',                      dialCode: '+249', placeholder: 'XX XXX XXXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'SS', flag: '🇸🇸', label: 'Sudão do Sul',               dialCode: '+211', placeholder: 'XX XXX XXXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'SE', flag: '🇸🇪', label: 'Suécia',                     dialCode: '+46',  placeholder: 'XX XXX XXXX',      maxDigits: 11, validate: (d) => d.length >= 7 },
  { code: 'CH', flag: '🇨🇭', label: 'Suíça',                      dialCode: '+41',  placeholder: 'XX XXX XXXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'SR', flag: '🇸🇷', label: 'Suriname',                   dialCode: '+597', placeholder: 'XXX XXXX',         maxDigits: 8,  validate: (d) => d.length >= 7 },
  { code: 'TH', flag: '🇹🇭', label: 'Tailândia',                  dialCode: '+66',  placeholder: 'XX XXXX XXXX',     maxDigits: 11, validate: (d) => d.length >= 7 },
  { code: 'TW', flag: '🇹🇼', label: 'Taiwan',                     dialCode: '+886', placeholder: 'X XXXX XXXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'TZ', flag: '🇹🇿', label: 'Tanzânia',                   dialCode: '+255', placeholder: 'XXX XXX XXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'TL', flag: '🇹🇱', label: 'Timor-Leste',                dialCode: '+670', placeholder: 'XXX XXXX',         maxDigits: 8,  validate: (d) => d.length >= 7 },
  { code: 'TG', flag: '🇹🇬', label: 'Togo',                       dialCode: '+228', placeholder: 'XX XX XX XX',      maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'TT', flag: '🇹🇹', label: 'Trinidad e Tobago',          dialCode: '+1',   placeholder: '868 XXX XXXX',     maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'TN', flag: '🇹🇳', label: 'Tunísia',                    dialCode: '+216', placeholder: 'XX XXX XXX',       maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'TM', flag: '🇹🇲', label: 'Turquemenistão',             dialCode: '+993', placeholder: 'XX XXXXXX',        maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'TR', flag: '🇹🇷', label: 'Turquia',                    dialCode: '+90',  placeholder: 'XXX XXX XXXX',     maxDigits: 11, validate: (d) => d.length >= 7 },
  { code: 'UA', flag: '🇺🇦', label: 'Ucrânia',                    dialCode: '+380', placeholder: 'XX XXX XXXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'UG', flag: '🇺🇬', label: 'Uganda',                     dialCode: '+256', placeholder: 'XXX XXX XXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'UY', flag: '🇺🇾', label: 'Uruguai',                    dialCode: '+598', placeholder: 'X XXX XXXX',       maxDigits: 9,  validate: (d) => d.length >= 7 },
  { code: 'UZ', flag: '🇺🇿', label: 'Usbequistão',                dialCode: '+998', placeholder: 'XX XXX XXXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
  { code: 'VE', flag: '🇻🇪', label: 'Venezuela',                  dialCode: '+58',  placeholder: 'XXX XXX XXXX',     maxDigits: 11, validate: (d) => d.length >= 7 },
  { code: 'VN', flag: '🇻🇳', label: 'Vietname',                   dialCode: '+84',  placeholder: 'XXX XXX XXXX',     maxDigits: 11, validate: (d) => d.length >= 7 },
  { code: 'ZM', flag: '🇿🇲', label: 'Zâmbia',                     dialCode: '+260', placeholder: 'XXX XXX XXXX',     maxDigits: 11, validate: (d) => d.length >= 7 },
  { code: 'ZW', flag: '🇿🇼', label: 'Zimbábue',                   dialCode: '+263', placeholder: 'XX XXX XXXX',      maxDigits: 10, validate: (d) => d.length >= 7 },
];

function normalize(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function CountryDialPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus();
  }, [open]);

  const ct = ALL_COUNTRIES.find((c) => c.code === value) || ALL_COUNTRIES[0];
  const q = normalize(search.trim());
  const filtered = q
    ? ALL_COUNTRIES.filter((c) => normalize(c.label).startsWith(q) || c.dialCode.replace('+', '').startsWith(q.replace('+', '')))
    : ALL_COUNTRIES;

  return (
    <div ref={ref} style={{ position: 'relative', marginBottom: 7 }}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 11, border: '1.5px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', font: '600 13.5px var(--ui)', color: 'var(--ink)', textAlign: 'left' }}>
        <span style={{ fontSize: 20, lineHeight: 1 }}>{ct.flag}</span>
        <span style={{ flex: 1 }}>{ct.label}</span>
        <span style={{ font: '500 12px var(--ui)', color: 'var(--ink-soft)', marginRight: 2 }}>{ct.dialCode}</span>
        <span style={{ font: '500 11px var(--ui)', color: 'var(--ink-soft)', transform: open ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform .15s' }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--surface)', border: '1.5px solid var(--line)', borderRadius: 12, boxShadow: '0 8px 28px rgba(0,0,0,.13)', zIndex: 200, overflow: 'hidden' }}>
          <div style={{ padding: '8px 8px 4px' }}>
            <input ref={searchRef} type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar país ou indicativo…"
              style={{ width: '100%', boxSizing: 'border-box', padding: '7px 11px', borderRadius: 8, border: '1.5px solid var(--line)', font: '500 13px var(--ui)', color: 'var(--ink)', background: 'var(--app-bg)', outline: 'none' }} />
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto', padding: '2px 4px 6px' }}>
            {filtered.length === 0 && (
              <div style={{ padding: '10px 12px', font: '400 13px var(--ui)', color: 'var(--ink-soft)' }}>Nenhum país encontrado.</div>
            )}
            {filtered.map((c) => (
              <button key={c.code} type="button"
                onClick={() => { onChange(c.code); setOpen(false); setSearch(''); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 8, border: 'none', background: c.code === value ? 'var(--primary-soft)' : 'transparent', cursor: 'pointer', font: '500 13px var(--ui)', color: c.code === value ? 'var(--primary-deep)' : 'var(--ink)', textAlign: 'left' }}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>{c.flag}</span>
                <span style={{ flex: 1 }}>{c.label}</span>
                <span style={{ font: '500 12px var(--ui)', color: c.code === value ? 'var(--primary-deep)' : 'var(--ink-soft)' }}>{c.dialCode}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

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

  const ct = ALL_COUNTRIES.find((c) => c.code === country) || ALL_COUNTRIES[0];
  const phoneDigits = phone.replace(/\D/g, '');
  const phoneOk = ct.validate(phoneDigits);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const nifDigits = nif.replace(/\D/g, '');
  const nifOk = nifDigits.length === 9;
  const cpOk = /^\d{4}-\d{3}$/.test(codigoPostal.trim());
  const isFuture = dob && new Date(dob) > new Date();
  const age = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / 3.15576e10) : null;
  const isAdult = age !== null && age >= 18;
  const valid = name.trim().length > 1 && phoneOk && emailOk && dob && !isFuture && isAdult && cc.trim().length >= 8 && profissao.trim().length > 1 && nifOk && rua.trim().length > 2 && porta.trim().length > 0 && cpOk && cidade.trim().length > 1;

  const handleCp = (v) => {
    const digits = v.replace(/\D/g, '').slice(0, 7);
    setCodigoPostal(digits.length > 4 ? digits.slice(0, 4) + '-' + digits.slice(4) : digits);
  };

  const handleCountry = (code) => { setCountry(code); setPhone(''); };

  return (
    <div className="pedal-card">
      <Field label="Como te chamas?">
        <input className="pedal-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />
      </Field>
      <Field label="Data de nascimento">
        <input className="pedal-input" type="date" value={dob} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDob(e.target.value)} />
        {dob && isFuture && <div style={{ font: '400 11px var(--ui)', color: 'var(--accent-deep)', marginTop: 5 }}>A data de nascimento não pode ser uma data futura.</div>}
        {dob && !isFuture && !isAdult && <div style={{ font: '400 11px var(--ui)', color: 'var(--accent-deep)', marginTop: 5 }}>É preciso ter pelo menos 18 anos para te inscreveres como voluntário.</div>}
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
        <CountryDialPicker value={country} onChange={handleCountry} />
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ font: '600 13px var(--ui)', color: 'var(--ink-soft)', background: 'var(--app-bg)', border: '1.5px solid var(--line)', borderRadius: 9, padding: '8px 10px', whiteSpace: 'nowrap' }}>{ct.dialCode}</span>
          <input className="pedal-input" style={{ flex: 1, margin: 0 }} type="tel" inputMode="numeric" value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, '').slice(0, ct.maxDigits + 2))}
            placeholder={ct.placeholder} />
        </div>
        {phone && !phoneOk && <div style={{ font: '400 11px var(--ui)', color: 'var(--accent-deep)', marginTop: 5 }}>Número inválido para {ct.label}.</div>}
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
function TriageForm({ localities, initial, onSubmit }) {
  const P = window.PEDAL;
  const buildInitial = () => {
    const out = {};
    (initial || []).forEach((a) => { out[a.localityId] = { ...(out[a.localityId] || {}), [a.day]: a.period }; });
    return out;
  };
  const [locAvail, setLocAvail] = useState(buildInitial);
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
