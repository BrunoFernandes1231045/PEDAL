/* pedal-data.jsx — conteúdo agnóstico do Agente Digital PEDAL
   Base de conhecimento, guião, módulos de onboarding, estados do funil e seed da coordenação.
   Exporta tudo para window.PEDAL. */

const PEDAL = {};

// Documento de consentimento de dados/imagem (RGPD) da Pedalar Sem Idade — autoalojado
// em rgpd.html a partir do PDF fornecido pela organização (não é um link do Google Docs
// porque esse exige permissões da conta que os candidatos não têm).
PEDAL.PRIVACY_POLICY_URL = '/rgpd.html';

// ── Localidades e necessidades da organização (RF-08) ────────────────
// Municípios com coach/necessidade ativa = match; restantes = lista de espera.
PEDAL.LOCALITIES = [
  { id: 'matosinhos', name: 'Matosinhos', need: true,  note: 'Coach ativo · procura de pilotos' },
  { id: 'maia',       name: 'Maia',       need: true,  note: 'Coach ativo · procura de pilotos' },
  { id: 'esposende',  name: 'Esposende',  need: true,  note: 'Em expansão · vagas a abrir' },
  { id: 'porto',      name: 'Porto',      need: false, note: 'Sem vaga imediata' },
  { id: 'vilaconde',  name: 'Vila do Conde', need: false, note: 'Sem vaga imediata' },
  { id: 'gondomar',   name: 'Gondomar',   need: false, note: 'Sem vaga imediata' },
];

PEDAL.PERIODS = [
  { id: 'manha', name: 'Manhã' },
  { id: 'tarde', name: 'Tarde' },
  { id: 'flex',  name: 'Flexível' },
];

// ── Base de NECESSIDADES (vagas abertas geridas pela coordenação) ────
PEDAL.SEED_NEEDS = [
  { id: 'nd1', locality: 'Matosinhos', periods: ['manha', 'tarde'] },
  { id: 'nd2', locality: 'Maia',       periods: ['manha'] },
  { id: 'nd3', locality: 'Esposende',  periods: ['flex'] },
];

PEDAL.DAY_TO_FULL = { seg: 'segunda', ter: 'terca', qua: 'quarta', qui: 'quinta', sex: 'sexta', sab: 'sabado', dom: 'domingo' };

// Há vaga aberta para esta localidade num dos dias/períodos exactos escolhidos pelo candidato?
// schedule: { [localityName]: { [day]: { period: 'manha'|'tarde'|'ambos', count: number } } }
// availability: [{ day: 'seg'|'ter'|..., period: 'manha'|'tarde'|'flex' }] — só as entradas desta localidade
PEDAL.needMatch = function (schedule, localityName, availability) {
  if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) return false;
  const locData = schedule[(localityName || '')];
  if (!locData) return false;
  return (availability || []).some(({ day, period }) => {
    const cell = locData[PEDAL.DAY_TO_FULL[day] || day];
    if (!cell || !cell.period) return false;
    if (period === 'flex' || cell.period === 'ambos') return true;
    return cell.period === period;
  });
};

PEDAL.DAY_PT = { segunda: 'Segunda', terca: 'Terça', quarta: 'Quarta', quinta: 'Quinta', sexta: 'Sexta', sabado: 'Sábado', domingo: 'Domingo' };

// Todos os dias/períodos com necessidade aberta nesta localidade (para sugerir alternativas
// a um candidato cuja disponibilidade escolhida não teve vaga).
PEDAL.needAlternatives = function (schedule, localityName) {
  if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) return [];
  const locData = schedule[(localityName || '')];
  if (!locData) return [];
  const DAYS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
  return DAYS.filter((day) => locData[day] && locData[day].period).map((day) => ({ day, period: locData[day].period }));
};

// Texto legível para uma lista de alternativas, ex.: "Segunda de manhã e Terça de tarde"
PEDAL.fmtAlternatives = function (alts) {
  const perName = (p) => (p === 'ambos' ? 'manhã e tarde' : p === 'manha' ? 'manhã' : 'tarde');
  const parts = (alts || []).map((a) => `${PEDAL.DAY_PT[a.day] || a.day} de ${perName(a.period)}`);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;
};

// ── Base de conhecimento / FAQ validada (RF-23 a RF-28) ──────────────
// keywords sem acentos, em minúsculas, para correspondência simples.
PEDAL.FAQ = [
  { id: 'missao', cat: 'Projeto', q: 'O que é a Pedalar Sem Idade?',
    keywords: ['o que e', 'missao', 'projeto', 'pedalar', 'sobre', 'quem sao', 'fazem'],
    a: 'Somos um projeto de voluntariado que leva pessoas com mobilidade reduzida — sobretudo idosos — a passear em triciclos elétricos. O objetivo é simples e bonito: devolver o vento na cara, o contacto com a rua e com as pessoas. 🚲' },
  { id: 'beneficiarios', cat: 'Projeto', q: 'Quem são os passageiros?',
    keywords: ['passageiro', 'beneficiario', 'idoso', 'quem leva', 'quem anda'],
    a: 'Os nossos passageiros são pessoas com mobilidade condicionada, na maioria idosos de lares e centros de dia parceiros. Cada passeio é uma janela para o exterior e uma conversa que faz a diferença.' },
  { id: 'requisitos', cat: 'Captação', q: 'Que requisitos preciso de ter?',
    keywords: ['requisito', 'preciso', 'necessario', 'condicoes', 'criterio'],
    a: 'O essencial: ser maior de idade, gostar de pessoas, ter alguma disponibilidade regular e vontade de aprender. O resto — conduzir o triciclo em segurança — ensinamos nós, com formação dedicada.' },
  { id: 'experiencia', cat: 'Captação', q: 'Preciso de experiência em bicicleta?',
    keywords: ['experiencia', 'saber andar', 'nunca andei', 'bicicleta', 'pedalar bem'],
    a: 'Não precisas de ser atleta. Se consegues andar de bicicleta com confiança, estás a meio caminho. A condução do triciclo elétrico é diferente e tem formação prática própria, com um coach a acompanhar-te.' },
  { id: 'disponibilidade', cat: 'Captação', q: 'Quanto tempo tenho de dar?',
    keywords: ['tempo', 'disponibilidade', 'horas', 'quanto', 'compromisso', 'frequencia'],
    a: 'Pedimos um compromisso de cerca de 2 horas por semana — pode ser um passeio mais longo ou dois mais curtos. É um ritmo regular que faz toda a diferença para quem espera por um passeio. Combinamos sempre os dias e horas contigo, mas é importante que essas ~2h caibam na tua rotina. ⏱️' },
  { id: 'seguranca', cat: 'Onboarding', q: 'É seguro conduzir o triciclo?',
    keywords: ['seguro?', 'seguranca', 'perigoso', 'cair', 'medo', 'risco'],
    a: 'Sim. Os triciclos elétricos são estáveis e fáceis de controlar, e nunca sais sozinho na primeira fase: há formação prática e acompanhamento de um coach de território até te sentires confiante.' },
  { id: 'seguro', cat: 'Onboarding', q: 'Estou coberto por um seguro?',
    keywords: ['seguro de', 'cobertura', 'acidente', 'nif', 'protegido'],
    a: 'Sim, todos os pilotos voluntários ativos estão cobertos por seguro durante os passeios. É por isso que, mais à frente, te pedimos o NIF — apenas para tratar do seguro.' },
  { id: 'equipamento', cat: 'Onboarding', q: 'Preciso de equipamento próprio?',
    keywords: ['equipamento', 'capacete', 'bicicleta propria', 'levar', 'comprar'],
    a: 'Não precisas de comprar nada. Os triciclos são da associação e o equipamento de segurança é fornecido. Basta roupa e calçado confortáveis.' },
  { id: 'carta', cat: 'Captação', q: 'Preciso de carta de condução?',
    keywords: ['carta', 'conducao', 'carta de'],
    a: 'A carta de condução não é obrigatória, mas é uma informação útil que recolhemos no questionário. O triciclo é elétrico e não exige carta.' },
  { id: 'idade', cat: 'Captação', q: 'Há limite de idade para ser piloto?',
    keywords: ['idade', 'velho', 'novo', 'anos', 'limite de idade'],
    a: 'Tens de ser maior de idade. A partir daí, o que conta é a vontade e a condição para conduzir em segurança. Temos pilotos de várias gerações!' },
  // Objeções frequentes (RF-26)
  { id: 'obj_tempo', cat: 'Objeção', q: 'Tenho pouco tempo livre…',
    keywords: ['pouco tempo', 'nao tenho tempo', 'ocupado', 'trabalho muito'],
    a: 'Compreendo perfeitamente. Sendo honestos contigo: pedimos cerca de 2 horas por semana, porque é o que dá consistência aos passeios. Se de momento não conseguires garantir esse tempo, guardamos o teu perfil com todo o gosto e voltamos a falar quando for mais fácil. 💛' },
  { id: 'obj_exp', cat: 'Objeção', q: 'Não tenho jeito para isto…',
    keywords: ['nao tenho jeito', 'incapaz', 'nao consigo', 'duvido'],
    a: 'A maioria dos nossos pilotos sentiu o mesmo no início. A formação foi pensada exatamente para isso: passo a passo, sem pressa, até estares à vontade. Não estás sozinho nisto.' },
];

PEDAL.FAQ_CHIPS = ['experiencia', 'disponibilidade', 'seguranca', 'seguro'];

// correspondência simples por palavra-chave (RF-04 / RF-28)
PEDAL.matchFAQ = function (text) {
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const t = norm(text);
  let best = null, bestScore = 0;
  for (const f of PEDAL.FAQ) {
    let score = 0;
    for (const k of f.keywords) { if (t.includes(norm(k))) score += k.length; }
    if (score > bestScore) { bestScore = score; best = f; }
  }
  return bestScore > 0 ? best : null;
};

// ── Questionário estruturado (RF-12) ──────────────────────────────────
PEDAL.INTERVIEW = [
  { id: 'conhecimento', kind: 'text', q: 'Como tiveste conhecimento do projeto?' },
  { id: 'voluntariado', kind: 'choice', q: 'Já fizeste voluntariado?', options: ['Sim', 'Não'] },
  { id: 'voluntariado_info', kind: 'text', q: 'Se já fizeste voluntariado antes, conta-nos sobre isso!',
    skipUnless: { id: 'voluntariado', value: 'Sim' } },
  { id: 'bicicleta', kind: 'choice', q: 'Tens experiência ou gostas de andar de bicicleta?', options: ['Sim', 'Não'] },
  { id: 'carta', kind: 'choice', q: 'Possuis carta de condução?', options: ['Sim', 'Não'] },
];

// ── Onboarding / tutorial guiado (RF-15 a RF-20) ─────────────────────
PEDAL.MODULES = [
  { id: 'm1', title: 'Partida', type: 'Vídeo', dur: '',
    desc: 'Primeira fase da formação.' },
  { id: 'm2', title: 'Largada', type: 'Vídeo', dur: '',
    desc: 'Segunda fase da formação.' },
  { id: 'm3', title: 'Fugida', type: 'Vídeo', dur: '',
    desc: 'Terceira fase da formação.' },
];

// Perfil de função (RF-20)
PEDAL.ROLE_PROFILE = {
  title: 'Perfil do Piloto Voluntário',
  commitments: [
    'Conduzir o triciclo com segurança e respeito pelo passageiro',
    'Reservar cerca de 2 horas por semana para os passeios — o ritmo que dá consistência ao projeto',
    'Cumprir os passeios combinados e avisar com antecedência se não puder',
    'Tratar cada beneficiário com dignidade, paciência e simpatia',
    'Seguir as orientações de segurança e a formação recebida',
    'Manter a confidencialidade dos dados dos passageiros',
  ],
  weGive: [
    'Formação completa e acompanhamento de um coach',
    'Triciclo, equipamento e seguro durante os passeios',
    'Uma comunidade de voluntários e apoio contínuo',
  ],
};

// ── Estados do funil (RF-31) ─────────────────────────────────────────
PEDAL.STAGES = [
  { id: 'inscricao',    label: 'Apresentação' },
  { id: 'apresentacao', label: 'Inscrição' },
  { id: 'triagem',      label: 'Triagem' },
  { id: 'espera',       label: 'Lista de espera' },
  { id: 'entrevista',   label: 'Questionário' },
  { id: 'validacao',    label: 'Validação' },
  { id: 'onboarding',   label: 'Onboarding' },
  { id: 'pratica',      label: 'Formação prática' },
  { id: 'formalizacao', label: 'Formalização' },
  { id: 'ativo',        label: 'Ativo' },
  { id: 'rejeitado',    label: 'Rejeitado' },
];
PEDAL.stageIndex = (id) => PEDAL.STAGES.findIndex((s) => s.id === id);
PEDAL.stageLabel = (id) => (PEDAL.STAGES.find((s) => s.id === id) || {}).label || id;

// Funil de captação — 5 colunas. 'aguarda' e 'formacao' têm lógica extra no dashboard.
PEDAL.FUNNEL = [
  { id: 'ite',        label: 'Inscrição, Triagem e Questionário', match: ['inscricao', 'apresentacao', 'triagem', 'entrevista'] },
  { id: 'validacao',  label: 'Validação',                       match: ['validacao'] },
  { id: 'onboarding', label: 'Onboarding',                      match: ['onboarding'] },
  { id: 'aguarda',    label: 'Aguarda Agendamento',             match: ['pratica'] },
  { id: 'formacao',   label: 'Formação',                        match: ['formalizacao'] },
];
// devolve a coluna do funil de um estado, ou null se pertence a outra secção
PEDAL.funnelCol = (stage) => (PEDAL.FUNNEL.find((c) => c.match.includes(stage)) || {}).id || null;

PEDAL.WEEKDAYS = [
  { id: 'seg', name: 'Seg' }, { id: 'ter', name: 'Ter' }, { id: 'qua', name: 'Qua' },
  { id: 'qui', name: 'Qui' }, { id: 'sex', name: 'Sex' }, { id: 'sab', name: 'Sáb' }, { id: 'dom', name: 'Dom' },
];

// Formata 'YYYY-MM-DD' para ex. "Sáb, 14 jun"
PEDAL.fmtDate = function (iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return iso;
  const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${dias[d.getDay()]}, ${d.getDate()} ${meses[d.getMonth()]}`;
};

// ── Seed de candidatos para o painel da coordenação ──────────────────
PEDAL.SEED_CANDIDATES = [
  { id: 'c1', name: 'Joana Ferreira', locality: 'Matosinhos', stage: 'ativo',      source: 'Website',  days: 21, initials: 'JF', email: 'joana.ferreira@email.pt', contact: '912 345 678', dob: '1985-04-12', periods: ['tarde'], weekdays: ['qua', 'sab'], contactDate: '2026-04-30', since: '2026-05-08' },
  { id: 'c2', name: 'Rui Marques',    locality: 'Maia',       stage: 'pratica',    source: 'Passa-palavra', days: 12, initials: 'RM', email: 'rui.marques@email.pt', contact: '913 222 111', dob: '1978-11-03', periods: ['manha'], weekdays: ['seg', 'qui'], contactDate: '2026-05-12' },
  { id: 'c3', name: 'Beatriz Sousa',  locality: 'Esposende',  stage: 'onboarding', source: 'Instagram', days: 6, initials: 'BS', email: 'beatriz.sousa@email.pt', contact: '914 555 333', dob: '1995-07-21', periods: [], weekdays: ['sab', 'dom'], contactDate: '2026-05-18' },
  { id: 'c4', name: 'Carlos Pinto',   locality: 'Matosinhos', stage: 'validacao',  source: 'Website',  days: 4, initials: 'CP', email: 'carlos.pinto@email.pt', contact: '915 888 222', dob: '1969-02-15', periods: ['tarde'], weekdays: ['ter', 'qui'], contactDate: '2026-05-20' },
  { id: 'c5', name: 'Helena Dias',    locality: 'Porto',      stage: 'espera',     source: 'Website',  days: 9, initials: 'HD', email: 'helena.dias@email.pt', contact: '916 444 777', dob: '1990-09-30', periods: ['manha', 'tarde'], weekdays: ['seg', 'ter', 'qua'], contactDate: '2026-05-15' },
  { id: 'c6', name: 'Tomás Lopes',    locality: 'Maia',       stage: 'entrevista', source: 'Evento',   days: 3, initials: 'TL', email: 'tomas.lopes@email.pt', contact: '917 111 999', dob: '2000-01-08', periods: ['flex'], weekdays: ['sex', 'sab'], contactDate: '2026-05-21' },
  { id: 'c7', name: 'Inês Carvalho',  locality: 'Gondomar',   stage: 'espera',     source: 'Instagram', days: 15, initials: 'IC', email: 'ines.carvalho@email.pt', contact: '918 333 444', dob: '1982-06-19', periods: [], weekdays: ['sab', 'dom'], contactDate: '2026-05-09' },
  { id: 'c8', name: 'Miguel Antunes', locality: 'Porto',      stage: 'espera',     source: 'Evento',   days: 22, initials: 'MA', email: 'miguel.antunes@email.pt', contact: '919 777 888', dob: '1974-12-01', periods: ['manha'], weekdays: ['seg', 'qua', 'sex'], contactDate: '2026-05-02' },
  { id: 'c9', name: 'Sara Nogueira',  locality: 'Vila do Conde', stage: 'espera',  source: 'Website',  days: 5, initials: 'SN', email: 'sara.nogueira@email.pt', contact: '910 222 333', dob: '1998-03-27', periods: ['tarde', 'flex'], weekdays: ['ter', 'qui', 'sex'], contactDate: '2026-05-19' },
  { id: 'c10', name: 'Pedro Bastos',  locality: 'Matosinhos', stage: 'ativo',      source: 'Passa-palavra', days: 64, initials: 'PB', email: 'pedro.bastos@email.pt', contact: '911 999 000', dob: '1965-08-14', periods: [], weekdays: ['sab'], contactDate: '2026-03-20', since: '2026-04-02' },
  { id: 'c11', name: 'Luís Faria', locality: 'Porto', stage: 'rejeitado', source: 'Website', days: 8, initials: 'LF', email: 'luis.faria@email.pt', contact: '912 000 111', dob: '2002-05-05', periods: ['manha'], weekdays: ['seg'], contactDate: '2026-05-10', rejectReason: 'Sem disponibilidade compatível com a operação.' },
];

// Notificações iniciais do feed da coordenação
PEDAL.SEED_NOTIFS = [
  { id: 'n0', type: 'concluido', who: 'Joana Ferreira', text: 'concluiu o onboarding e está pronta para ativação', ago: 'ontem' },
  { id: 'n1', type: 'entrevista', who: 'Tomás Lopes', text: 'concluiu o questionário — aguarda validação', ago: 'há 2 h' },
];

// Formadores / coaches de território (RF) — nome, nascimento, telefone, email
PEDAL.SEED_TRAINERS = [
  { id: 't1', name: 'Manuel Costa', dob: '1972-03-10', phone: '961 111 222', email: 'manuel.costa@pedalarsemidade.pt', locality: 'Matosinhos' },
  { id: 't2', name: 'Sofia Ramos', dob: '1980-09-05', phone: '962 333 444', email: 'sofia.ramos@pedalarsemidade.pt', locality: 'Maia' },
  { id: 't3', name: 'João Teixeira', dob: '1968-12-22', phone: '963 555 666', email: 'joao.teixeira@pedalarsemidade.pt', locality: 'Porto' },
];

// Pedidos de contacto (encaminhamento PEDAL → humano)
PEDAL.SEED_CONTACTS = [];

// Locais de encontro / parqueamento das bicicletas (geridos pela coordenação) (Fase 4)
PEDAL.SEED_STATIONS = [
  { id: 's1', name: 'Base de Matosinhos', locality: 'Matosinhos', address: 'Rua Brito Capelo 120, Matosinhos', note: '3 triciclos · junto ao mercado' },
  { id: 's2', name: 'Garagem da Maia', locality: 'Maia', address: 'Av. Visconde de Barreiros 45, Maia', note: '2 triciclos · entrada pelas traseiras' },
  { id: 's3', name: 'Ponto do Porto — Foz', locality: 'Porto', address: 'Rua do Passeio Alegre 8, Porto', note: '2 triciclos · perto do jardim' },
  { id: 's4', name: 'Base de Esposende', locality: 'Esposende', address: 'Av. Valentim Ribeiro 30, Esposende', note: '1 triciclo · em expansão' },
];

// Utilizadores da consola de gestão (Fase 4)
PEDAL.SEED_MGMT_USERS = [
  { id: 'u1', name: 'Administração', email: 'administração@pedal.pt', phone: '', role: 'Administração', createdAt: '2026-07-08' },
  { id: 'u2', name: 'Coordenador', email: 'coordenador@pedal.pt', phone: '', role: 'Coordenação', createdAt: '2026-07-08' },
];

// ── Fase 3 ───────────────────────────────────────────────────────────

// Termos de compromisso do piloto (formalização → ativo) (RF)
PEDAL.FORMALIZATION = {
  intro: 'Concluíste a formação prática com sucesso! 🎉 Para te tornares piloto voluntário ativo, falta só formalizar o teu compromisso.',
  terms: [
    'Conduzo o triciclo com segurança, respeitando o passageiro e o código da estrada.',
    'Comprometo-me com os passeios que aceitar e aviso a coordenação com antecedência se não puder comparecer.',
    'Sigo as orientações de segurança e a formação recebida em cada passeio.',
    'Mantenho a confidencialidade dos dados dos passageiros, ao abrigo do RGPD.',
    'Autorizo a cobertura pelo seguro de voluntariado durante os passeios.',
  ],
  closing: 'A tua rubrica abaixo confirma a aceitação destes termos e ativa o teu estatuto de piloto voluntário.',
};

// FAQ do período de formação (dúvidas sobre os vídeos / módulos) (RF)
PEDAL.TRAINING_FAQ = [
  { id: 'tf_rever', keywords: ['rever', 'outra vez', 'repetir', 'voltar a ver'],
    a: 'Podes rever qualquer módulo as vezes que quiseres — o teu progresso fica guardado. Toca no módulo e escolhe "Rever". 🔁' },
  { id: 'tf_ordem', keywords: ['ordem', 'sequencia', 'saltar', 'tenho de ver tudo'],
    a: 'Recomendamos seguir a ordem dos módulos, mas podes navegar à vontade. Para concluir o onboarding precisas de marcar todos como vistos. 🎓' },
  { id: 'tf_pratica', keywords: ['pratica', 'coach', 'presencial', 'quando ando', 'andar a serio'],
    a: 'Depois de veres os módulos, a coordenação propõe-te datas para a formação prática com um coach na tua zona. É aí que conduzes o triciclo pela primeira vez, sempre acompanhado(a). 🚲' },
  { id: 'tf_duvida_video', keywords: ['nao percebi', 'duvida', 'explicar', 'nao entendi', 'confuso'],
    a: 'Sem problema! Diz-me qual o ponto do vídeo que ficou confuso e tento esclarecer. Se for algo que precise de demonstração, anoto para o coach rever contigo na formação prática. 🙌' },
];

// FAQ do piloto ATIVO — só assuntos institucionais e de revisão da formação.
// Tudo o que é operacional (passeios, triciclos, logística) é responsabilidade do coach;
// o PEDAL só serve a captação/ativação + acesso à formação + dúvidas para a coordenação.
PEDAL.ACTIVE_FAQ = [
  { id: 'af_sobre', cat: 'Projeto', q: 'O que é a Pedalar Sem Idade?',
    keywords: ['o que e', 'projeto', 'pedalar sem idade', 'missao', 'movimento'],
    a: 'A Pedalar Sem Idade é um movimento internacional que devolve a idosos e a pessoas com mobilidade reduzida o gosto pelo ar livre — com passeios em triciclo elétrico, conduzidos por voluntários como tu. Em Portugal organizamo-nos em núcleos locais, em parceria com lares, centros de dia e câmaras. 🚲💛' },
  { id: 'af_lema', cat: 'Projeto', q: 'O que significa "direito a vento no cabelo"?',
    keywords: ['vento no cabelo', 'lema', 'slogan', 'direito'],
    a: 'É o nosso lema. A ideia é simples: a velhice não tira o direito de sentir o vento na cara, de sair de casa, de viver o bairro. Cada passeio é um pequeno gesto que devolve esse direito.' },
  { id: 'af_quem', cat: 'Projeto', q: 'Quem está por trás do PSI Porto?',
    keywords: ['quem', 'equipa', 'coordenacao', 'organizacao', 'porto'],
    a: 'No Porto o núcleo é coordenado por uma equipa pequena e por coaches voluntários de cada zona (Matosinhos, Maia, Gaia, Porto Centro). A coordenação é responsável por validar candidaturas, articular instituições e zelar pela segurança. Os coaches acompanham-te no dia a dia.' },
  { id: 'af_rever_formacao', cat: 'Formação', q: 'Como revejo a minha formação?',
    keywords: ['rever formacao', 'rever videos', 'voltar a formacao', 'modulos', 'video', 'aceder formacao'],
    a: 'Toca em "Formação" no menu inferior. Tens lá todos os módulos disponíveis para revisitar quando quiseres — não há limite. 📚 A coordenação atualiza os conteúdos sempre que há novidades.' },
  { id: 'af_marcar_passeio', cat: 'Operação', q: 'Como marco um passeio?',
    keywords: ['marcar passeio', 'agendar passeio', 'datas', 'horario', 'instituicao', 'lar', 'centro de dia', 'cancelar passeio', 'imprevisto'],
    a: 'A marcação de passeios é com o teu coach de território — é ele que combina datas, horários e a articulação com a instituição. Eu sou o assistente da inscrição e da formação; o dia a dia dos passeios passa pelo coach. 🤝' },
  { id: 'af_levantar_triciclo', cat: 'Operação', q: 'Onde levanto o triciclo?',
    keywords: ['levantar triciclo', 'levanto', 'onde esta', 'bicicleta', 'bateria', 'chaves', 'estacao', 'recolher', 'guardar triciclo'],
    a: 'O ponto de levantamento do triciclo é definido pelo teu coach, conforme a estação da tua zona. Fala com ele para combinarem o local e a entrega das chaves e da bateria. 🚲' },
  { id: 'af_operacional', cat: 'Operação', q: 'Como falo com a instituição / lido com imprevistos?',
    keywords: ['falo com a instituicao', 'passageiro', 'idoso', 'avaria', 'receber passageiro', 'ausencia', 'ultima hora'],
    a: 'Tudo o que é operacional — contacto com a instituição, ausências de última hora, imprevistos com o passageiro ou o triciclo — é com o teu coach de território. Eu sou um assistente do processo de inscrição e formação; o dia a dia dos passeios é coordenado pelo coach. 🤝' },
  { id: 'af_emergencia', cat: 'Segurança', q: 'O que faço numa emergência durante um passeio?',
    keywords: ['emergencia', 'urgencia', 'acidente', 'queda', 'incidente', '112', 'socorro'],
    a: 'Primeiro: 112 sempre que houver risco para o passageiro ou para ti. Depois, liga ao teu coach e à coordenação (220 000 000). Estás coberto pelo seguro de voluntariado durante o passeio. 🛟' },
  { id: 'af_apoiar', cat: 'Projeto', q: 'Como posso apoiar além de pedalar?',
    keywords: ['apoiar', 'ajudar', 'doar', 'donativo', 'divulgar', 'amigos', 'partilhar'],
    a: 'Há várias formas: partilhar o projeto com pessoas que conheças (pilotos ou instituições), apoiar com donativo via o nosso site, ou propor parcerias se trabalhas numa instituição. Fala com a coordenação que te orientamos. 💛' },
];
PEDAL.ACTIVE_CHIPS = ['af_rever_formacao', 'af_marcar_passeio', 'af_levantar_triciclo', 'af_emergencia'];

// correspondência por palavra-chave numa lista FAQ arbitrária
PEDAL.matchIn = function (list, text) {
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const t = norm(text);
  let best = null, bestScore = 0;
  for (const f of list) {
    let score = 0;
    for (const k of f.keywords) { if (t.includes(norm(k))) score += k.length; }
    if (score > bestScore) { bestScore = score; best = f; }
  }
  return bestScore > 0 ? best : null;
};

// Gera uma palavra-passe inicial legível (enviada por email após a inscrição)
PEDAL.genPassword = function () {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const nums = '23456789';
  const pick = (s, n) => Array.from({ length: n }, () => s[Math.floor(Math.random() * s.length)]).join('');
  return 'PSI-' + pick(chars, 3) + pick(nums, 3);
};

window.PEDAL = PEDAL;
