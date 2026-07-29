const express = require('express');
const router = express.Router({ mergeParams: true });
const supabase = require('../db/supabase');
const { requireAuth, attachOwnCandidateId } = require('../middleware/auth');
const { cleanRequiredText, pickAllowedFields } = require('../lib/requestSecurity');

const MESSAGE_WRITABLE_FIELDS = ['content', 'node'];

function canAccessCandidate(req, candidateId) {
  return req.user.role === 'coordinator' || req.ownCandidateId === candidateId;
}

router.get('/', requireAuth, attachOwnCandidateId, async (req, res) => {
  const { id } = req.params;
  if (!canAccessCandidate(req, id)) {
    return res.status(403).json({ error: 'Proibido' });
  }
  const { data, error } = await supabase
    .from('messages').select('*').eq('candidate_id', id)
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/', requireAuth, attachOwnCandidateId, async (req, res) => {
  const { id } = req.params;
  if (!canAccessCandidate(req, id)) {
    return res.status(403).json({ error: 'Proibido' });
  }
  const message = pickAllowedFields(req.body, MESSAGE_WRITABLE_FIELDS);
  const content = cleanRequiredText(message.content);
  if (!content) return res.status(400).json({ error: 'content é obrigatório' });
  const role = req.user.role === 'coordinator' ? 'assistant' : 'user';

  const { data, error } = await supabase
    .from('messages')
    .insert({ candidate_id: id, role, content, node: message.node || null })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

module.exports = router;
