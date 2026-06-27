const Groq = require('groq-sdk');
const { embed } = require('./embedder.cjs');
const { loadStore, search } = require('./vectorStore.cjs');

const groq = new Groq({ apiKey: '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' });

let store = null;

function getStore() {
  if (!store) store = loadStore();
  return store;
}

const SYSTEM_PROMPT = `You are a friendly and knowledgeable customer service agent for Osian Academy (osian.tech), India's premier online education platform offering live 1-on-1 training courses.

Your job is to help prospective and current students by answering questions about courses, pricing, enrollment, placement assistance, scheduling, and anything else related to Osian Academy.

Rules:
- Only answer questions based on the provided context. Do not make up information.
- If a question is not covered in the context, say: "I don't have that information right now. Please contact us at support@osianacademy.com or call +91 96242 84999 (Mon–Sun, 8 AM–8 PM IST)."
- Be warm, concise, and helpful. Use bullet points for lists.
- Never pretend to be a human — you are Osian's AI assistant.
- If someone wants to enroll, direct them to https://osian.tech/auth?mode=signup`;

async function answer(userMessage, conversationHistory = []) {
  const queryEmbedding = await embed(userMessage);
  const relevantChunks = search(getStore(), queryEmbedding, 5);
  const context = relevantChunks.map(c => c.text).join('\n\n---\n\n');

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...conversationHistory.slice(-8),
    {
      role: 'user',
      content: `Context from Osian Academy knowledge base:\n\n${context}\n\n---\n\nStudent question: ${userMessage}`,
    },
  ];

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages,
    temperature: 0.3,
    max_tokens: 512,
  });

  return completion.choices[0].message.content;
}

module.exports = { answer };
