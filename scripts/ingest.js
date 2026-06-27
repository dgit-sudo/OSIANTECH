require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function main() {
  const { embed } = require('../src/embedder.cjs');
  const { saveStore } = require('../src/vectorStore.cjs');

  const KB_PATH = path.join(__dirname, '..', 'knowledge-base', 'osian.txt');
  const text = fs.readFileSync(KB_PATH, 'utf-8');

  const sections = text.split(/\n---\n/).map(s => s.trim()).filter(Boolean);
  const chunks = [];

  for (const section of sections) {
    if (section.length <= 800) {
      chunks.push(section);
    } else {
      const paragraphs = section.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
      let current = '';
      for (const para of paragraphs) {
        if ((current + '\n\n' + para).length > 800 && current) {
          chunks.push(current.trim());
          current = para;
        } else {
          current = current ? current + '\n\n' + para : para;
        }
      }
      if (current) chunks.push(current.trim());
    }
  }

  console.log(`Created ${chunks.length} chunks. Embedding now...`);
  console.log('(First run downloads ~23MB model — this is normal)\n');

  const store = [];
  for (let i = 0; i < chunks.length; i++) {
    process.stdout.write(`\rEmbedding ${i + 1}/${chunks.length}...`);
    const embedding = await embed(chunks[i]);
    store.push({ id: i, text: chunks[i], embedding });
  }

  saveStore(store);
  console.log(`\n\nDone! ${store.length} chunks saved to data/vector-store.json`);
  console.log('Start the server: npm start');
}

main().catch(err => {
  console.error('Ingest failed:', err.message);
  process.exit(1);
});
