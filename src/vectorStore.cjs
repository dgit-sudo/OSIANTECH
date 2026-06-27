const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, '..', 'data', 'vector-store.json');

function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function saveStore(chunks) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(chunks, null, 2));
}

function loadStore() {
  if (!fs.existsSync(STORE_PATH)) {
    throw new Error('Vector store not found. Run: node scripts/ingest.js');
  }
  return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
}

function search(store, queryEmbedding, topK = 5) {
  const scored = store.map(chunk => ({
    ...chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

module.exports = { saveStore, loadStore, search };
