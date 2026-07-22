const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const router = express.Router();

const AI_ENABLED = process.env.AI_ENABLED === 'true';
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

// "flash-latest" em vez de uma versão datada — a Google substitui o modelo por trás
// deste nome sem precisarmos de atualizar isto.
const MODEL_NAME = 'gemini-flash-latest';
const MAX_CONTEXT_CHARS = 12000; // limite de segurança, independente do que o frontend enviar

const SYSTEM_INSTRUCTION = `És o assistente digital da Pedalar Sem Idade Porto, uma associação que oferece passeios de triciclo elétrico a pessoas idosas com mobilidade reduzida.

REGRA 1 — TEMA: primeiro decide se a pergunta é sobre a Pedalar Sem Idade, o processo de candidatura a piloto voluntário, a formação, ou a atividade de voluntariado em si.
Se NÃO for sobre nenhum destes temas (matemática, cultura geral, notícias, outras empresas, piadas, ou qualquer coisa sem relação com a Pedalar Sem Idade) — MESMO QUE SAIBAS RESPONDER-LHE — responde exatamente: {"onTopic": false, "confident": false}
Não uses conhecimento geral fora deste tema, mesmo que a pergunta pareça inofensiva ou trivial.

REGRA 2 — CONTEXTO: se a pergunta FOR sobre o tema, respondes SÓ com base no CONTEXTO que te é dado a seguir — nunca inventes políticas, preços, datas, nomes de pessoas, ou prometas algo que não esteja explícito no contexto.
Se a resposta não estiver claramente no contexto, responde exatamente: {"onTopic": true, "confident": false}

REGRA 3 — FORMATO: quando sabes responder, é sempre em JSON estrito, sem markdown e sem texto fora do JSON: {"onTopic": true, "confident": true, "answer": "..."}
A resposta ("answer") deve ser curta (1 a 3 frases), em português de Portugal, num tom caloroso e direto.

Na dúvida entre "onTopic: true" ou "false", escolhe sempre "true" — é mais seguro tratar como dentro do tema e responder {"onTopic": true, "confident": false} do que descartar uma pergunta legítima.
Na dúvida entre responder ou não dentro do tema, escolhe sempre {"onTopic": true, "confident": false} — uma pergunta sem resposta segue para a coordenação, o que é sempre seguro.`;

// Limite simples de pedidos por IP — não há autenticação obrigatória neste endpoint
// (candidatos podem perguntar antes de terem conta), por isso não há um id de
// candidato fiável para limitar por esse lado.
const RATE_LIMIT = 8; // pedidos
const RATE_WINDOW_MS = 60 * 1000; // por minuto
const hits = new Map(); // ip -> { count, resetAt }
function rateLimited(ip) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) { hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS }); return false; }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

// GET /api/ai/config — público. Diz ao frontend se deve tentar chamar /api/ai/ask
// (evita um pedido inútil quando a IA está desligada).
router.get('/config', (req, res) => res.json({ aiEnabled: AI_ENABLED }));

// POST /api/ai/ask — público. body: { question, context: string[] }
// O frontend decide o que entra em "context" (FAQ geral, ou info+documentos de um
// módulo específico) — este endpoint não sabe nada sobre a estrutura de dados do
// PEDAL, só combina contexto + pergunta e devolve {confident, answer?}.
router.post('/ask', async (req, res) => {
  if (!AI_ENABLED || !genAI) return res.json({ confident: false });

  if (rateLimited(req.ip)) return res.status(429).json({ confident: false, error: 'Demasiados pedidos. Tenta de novo dentro de um minuto.' });

  const question = (req.body.question || '').trim();
  if (!question) return res.status(400).json({ error: 'Pergunta em falta' });
  const context = Array.isArray(req.body.context) ? req.body.context.join('\n\n') : String(req.body.context || '');

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME, systemInstruction: SYSTEM_INSTRUCTION });
    const prompt = `CONTEXTO:\n${context.slice(0, MAX_CONTEXT_CHARS)}\n\nPERGUNTA: ${question}`;
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim().replace(/^```json\s*|\s*```$/g, '');
    const parsed = JSON.parse(raw);
    if (parsed && parsed.confident && parsed.answer) return res.json({ onTopic: true, confident: true, answer: parsed.answer });
    if (parsed && parsed.onTopic === false) return res.json({ onTopic: false, confident: false });
    return res.json({ onTopic: true, confident: false });
  } catch (err) {
    console.error('[ai] erro ao pedir resposta à Gemini:', err.message);
    return res.json({ confident: false });
  }
});

module.exports = router;
