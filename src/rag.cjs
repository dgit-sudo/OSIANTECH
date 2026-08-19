const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');
const { embed } = require('./embedder.cjs');
const { loadStore, search } = require('./vectorStore.cjs');

let store = null;
let coursesCatalog = null;
let kbRawText = null;

function getStore() {
  if (!store) {
    try {
      store = loadStore();
    } catch {
      store = [];
    }
  }
  return store;
}

function getCatalog() {
  if (!coursesCatalog) {
    try {
      coursesCatalog = require('../data/coursesCatalog.json');
    } catch {
      coursesCatalog = [];
    }
  }
  return coursesCatalog;
}

function getKbText() {
  if (!kbRawText) {
    try {
      const kbPath = path.join(__dirname, '..', 'knowledge-base', 'osian.txt');
      kbRawText = fs.readFileSync(kbPath, 'utf8');
    } catch {
      kbRawText = '';
    }
  }
  return kbRawText;
}

const SYSTEM_PROMPT = `You are a friendly and knowledgeable customer service agent for Osian Academy (osian.tech), India's premier online education platform offering live 1-on-1 training courses.

Your job is to help prospective and current students by answering questions about courses, pricing, enrollment, placement assistance, scheduling, and anything else related to Osian Academy.

Rules:
- Only answer questions based on the provided context. Do not make up information.
- If a question is not covered in the context, say: "I don't have that information right now. Please contact us at info@osian.tech or call +919624284999 (Mon–Sun, 8 AM–8 PM IST)."
- Be warm, concise, and helpful. Use bullet points for lists.
- Never pretend to be a human — you are Osian's AI assistant.
- If someone wants to enroll, direct them to https://osian.tech/auth?mode=signup`;

/**
 * Intelligent fallback generator when Groq API key is missing, invalid, or rate-limited.
 */
function generateFallbackAnswer(userMessage, contextChunks = []) {
  const query = userMessage.toLowerCase().trim();

  // 1. Greetings & Intro
  if (/^(hi|hello|hey|greetings|good\s*(morning|afternoon|evening)|hola)\b/i.test(query)) {
    return `Hello! 👋 I'm **Osian's AI Assistant**. How can I help you today?\n\nFeel free to ask about:\n- 📚 **Course details & curriculum**\n- 💰 **Course fees & pricing**\n- 🎯 **Live 1-on-1 mentor sessions**\n- 💼 **100% Placement assistance**\n- 📅 **Flexible scheduling & enrollment**`;
  }

  // 2. Specific Course Lookup
  const catalog = getCatalog();
  const matchedCourse = catalog.find(c => query.includes(c.title.toLowerCase()) || (c.subject && query.includes(c.subject.toLowerCase())));
  if (matchedCourse) {
    const feeStr = matchedCourse.price || (matchedCourse.nonMetroFee ? `₹${matchedCourse.nonMetroFee.toLocaleString('en-IN')}` : 'Contact for pricing');
    const metroFeeStr = matchedCourse.metroFee ? ` (Metro: ₹${matchedCourse.metroFee.toLocaleString('en-IN')})` : '';
    return `Here are the details for **${matchedCourse.title}**:\n\n` +
      `- **Category**: ${matchedCourse.category || 'Professional'}\n` +
      `- **Duration**: ${matchedCourse.duration || 'Flexible'}\n` +
      `- **Fee**: ${feeStr}\n` +
      `- **Format**: Live 1-on-1 private sessions with an industry mentor\n` +
      `- **Overview**: ${matchedCourse.cardLine || matchedCourse.description}\n\n` +
      `👉 [Click here to view full curriculum & enroll](https://osian.tech/courses/${matchedCourse.id})`;
  }

  // 3. Pricing / Fees questions
  if (/(fee|price|cost|how much|charges|pricing|tuition)/i.test(query)) {
    return `**Osian Academy Course Fees**:\n\n` +
      `- Course fees range from **₹3,750** for focused skill tracks to comprehensive job-ready diplomas.\n` +
      `- Every course includes **live 1-on-1 private instruction**, practical projects, certification, and dedicated placement support.\n` +
      `- You can view exact fees for every track on our [Courses Catalog](https://osian.tech/courses).\n\n` +
      `Need custom pricing or batch scheduling? Contact our team at **info@osian.tech** or call **+919624284999**.`;
  }

  // 4. Placement / Job Guarantee questions
  if (/(placement|job|hire|career|salary|internship|interview)/i.test(query)) {
    return `**Osian Academy 100% Placement Assistance**:\n\n` +
      `- 💼 **Resume & LinkedIn Optimization**: Customized for high ATS scores.\n` +
      `- 🎯 **Mock Technical Interviews**: Real-world interview drills with senior engineers.\n` +
      `- 🤝 **Hiring Network**: Direct referrals to 500+ top tech companies and startups.\n` +
      `- 📊 **Job-Readiness Score**: Employer-recognized performance metric.`;
  }

  // 5. Scheduling / Timings questions
  if (/(timing|schedule|time|weekend|evening|class time|when)/i.test(query)) {
    return `**Flexible 1-on-1 Scheduling**:\n\n` +
      `- Because every session is **private and 1-on-1**, class timings are tailored entirely around your schedule.\n` +
      `- Slots are available **Monday to Sunday from 8:00 AM to 8:00 PM IST** (including evening and weekend slots).\n` +
      `- You can reschedule any session up to 2 hours before the start time with zero penalties.`;
  }

  // 6. Context-based response from retrieved vector chunks
  if (contextChunks && contextChunks.length > 0) {
    const topChunk = contextChunks[0].text;
    const cleanChunk = topChunk.replace(/^###\s+/gm, '').trim();
    if (cleanChunk.length > 40) {
      return `Here is what I found regarding your question:\n\n${cleanChunk}\n\nFor more details or personalized guidance, reach out to us at **info@osian.tech** or call **+919624284999**.`;
    }
  }

  // 7. General fallback
  return `I'd be glad to help with that! At Osian Academy, all courses are conducted as **live 1-on-1 private sessions** with industry experts and 100% dedicated placement support.\n\n` +
    `- Browse our full catalog: [https://osian.tech/courses](https://osian.tech/courses)\n` +
    `- Contact our advisors: **info@osian.tech** | **+919624284999** (Mon–Sun, 8 AM–8 PM IST).`;
}

async function answer(userMessage, conversationHistory = []) {
  if (!userMessage || !userMessage.trim()) {
    return "Hi! How can I assist you with your learning goals today?";
  }

  let relevantChunks = [];
  try {
    const queryEmbedding = await embed(userMessage);
    relevantChunks = search(getStore(), queryEmbedding, 5);
  } catch (err) {
    console.warn('[RAG Vector Search Warning]', err.message);
  }

  // Try calling Groq if API key is provided
  const apiKey = process.env.GROQ_API_KEY;
  if (apiKey && apiKey.trim().length > 10) {
    try {
      const groq = new Groq({ apiKey });
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
        model: 'groq/compound-mini',
        messages,
        temperature: 0.3,
        max_tokens: 512,
      });

      const reply = completion.choices[0]?.message?.content;
      if (reply && reply.trim()) {
        return reply.trim();
      }
    } catch (err) {
      console.warn('[Groq LLM Fallback Triggered]', err.message);
    }
  }

  // Resilient intelligent fallback
  return generateFallbackAnswer(userMessage, relevantChunks);
}

module.exports = { answer };
