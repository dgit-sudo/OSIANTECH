const express = require('express');
const { answer } = require('../src/rag.cjs');

const router = express.Router();

const sessions = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000;

function getHistory(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return [];
  if (Date.now() - session.lastActive > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    return [];
  }
  return session.history;
}

function updateHistory(sessionId, userMessage, assistantReply) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { history: [], lastActive: Date.now() });
  }
  const session = sessions.get(sessionId);
  session.history.push({ role: 'user', content: userMessage });
  session.history.push({ role: 'assistant', content: assistantReply });
  session.lastActive = Date.now();
  if (session.history.length > 20) {
    session.history = session.history.slice(-20);
  }
}

router.post('/', async (req, res) => {
  const { message, sessionId } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }
  if (message.length > 1000) {
    return res.status(400).json({ error: 'message too long (max 1000 chars)' });
  }

  const sid = sessionId || require('crypto').randomUUID();
  const history = getHistory(sid);

  try {
    const reply = await answer(message.trim(), history);
    updateHistory(sid, message.trim(), reply);
    res.json({ reply, sessionId: sid });
  } catch (err) {
    console.error('[AI Chat Error]', err.message);
    res.status(500).json({
      error: 'Something went wrong. Please contact support@osianacademy.com or call +91 96242 84999.',
    });
  }
});

module.exports = router;
