const https = require('https');
const fs = require('fs');
const cheerio = require('cheerio');

const SITE = 'https://samyakinfotech.com';
const OUTPUT = 'data/coursesCatalog.json';

function fetchUrl(url) {
  return new Promise((resolve) => {
    const req = https.get(
      url,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OSIAN Importer/1.0)' } },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({ ok: res.statusCode === 200, status: res.statusCode, body, url });
        });
      }
    );

    req.on('error', () => resolve({ ok: false, status: 0, body: '', url }));
    req.setTimeout(20000, () => {
      req.destroy();
      resolve({ ok: false, status: 0, body: '', url });
    });
  });
}

function decodeHtml(text = '') {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function cleanText(text = '') {
  return decodeHtml(text)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeWhitespace(text = '') {
  return text.replace(/\s+/g, ' ').trim();
}

function isNoise(text = '') {
  if (!text) return true;
  const t = text.toLowerCase();
  if (t.length < 20) return true;
  if (/(cookie|privacy policy|terms|facebook|instagram|youtube|whatsapp|telegram|copyright|all rights reserved|become a partner|about us|thank you! your application has been submitted|students placed in top companies|book free demo|apply now|enroll now|call now|new batch starts|phone:|branch|franchise|iso 9001)/i.test(t)) return true;
  if (/\bsamyak\b/i.test(t)) return true;
  if (/^(all courses|job oriented|skill enhancement|soft skills|data science|java technologies|\.net technologies|company|our students placed in top companies)$/i.test(t)) return true;
  return false;
}

function rewriteSentence(text = '') {
  const replacements = [
    [/\btraining course certification\b/gi, 'professional learning track'],
    [/\bcertification\b/gi, 'credential preparation'],
    [/\bstudents\b/gi, 'learners'],
    [/\btheory\b/gi, 'concepts'],
    [/\bpractical\b/gi, 'hands-on'],
    [/\bproject\b/gi, 'real-world assignment'],
    [/\bexam\b/gi, 'assessment'],
    [/\bjob\b/gi, 'career'],
    [/\bplacement\b/gi, 'career outcome'],
    [/\bsyllabus\b/gi, 'learning path'],
  ];

  let out = normalizeWhitespace(text);
  replacements.forEach(([from, to]) => {
    out = out.replace(from, to);
  });

  out = out
    .replace(/\bS\.?\s*No\.?\b/gi, 'Item')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!/[.!?]$/.test(out)) out += '.';
  return out;
}

function rewriteParagraph(text = '') {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return '';

  const pieces = normalized
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(rewriteSentence);

  if (!pieces.length) return '';

  // Keep structure and meaning while avoiding near-verbatim output.
  return pieces.join(' ');
}

function selectBestContentRoot($) {
  const selectors = [
    '.entry-content',
    '.post-content',
    '.single-post-content',
    '.elementor-widget-theme-post-content',
    '.elementor-location-single',
    '.course-content',
    'article',
    'main',
  ];

  let best = null;
  let bestLength = 0;

  selectors.forEach((selector) => {
    $(selector).each((_, el) => {
      const textLen = normalizeWhitespace($(el).text()).length;
      if (textLen > bestLength) {
        bestLength = textLen;
        best = el;
      }
    });
  });

  return best ? $(best) : $('body');
}

function extractStructuredContent(html) {
  const $ = cheerio.load(html);

  $('script, style, noscript, nav, footer, header, form, .sidebar, .widget, .menu, .breadcrumbs, .comment-respond, .comments-area, .related-posts, .wp-block-search').remove();

  const root = selectBestContentRoot($).clone();
  root.find('script, style, noscript, nav, footer, header, form, .sidebar, .widget, .menu, .breadcrumbs, .comment-respond, .comments-area, .related-posts, .wp-block-search').remove();

  const sections = [];
  let current = { heading: 'Course Overview', paragraphs: [], bullets: [] };

  const pushCurrent = () => {
    const uniqueParagraphs = [...new Set(current.paragraphs)].filter((p) => p.length > 30 && !isNoise(p));
    const uniqueBullets = [...new Set(current.bullets)].filter((b) => b.length > 18 && !isNoise(b));
    if (uniqueParagraphs.length || uniqueBullets.length) {
      sections.push({
        heading: current.heading,
        paragraphs: uniqueParagraphs,
        bullets: uniqueBullets,
      });
    }
  };

  root.find('h1, h2, h3, p, li').each((_, el) => {
    const tag = (el.tagName || '').toLowerCase();
    const text = normalizeWhitespace($(el).text());
    if (!text || isNoise(text)) return;

    if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
      pushCurrent();
      current = { heading: text.slice(0, 120), paragraphs: [], bullets: [] };
      return;
    }

    if (tag === 'p') {
      if (text.length > 30) current.paragraphs.push(text);
      return;
    }

    if (tag === 'li') {
      if (text.length > 18) current.bullets.push(text);
    }
  });

  pushCurrent();

  const cleanSections = sections
    .map((s) => ({
      heading: s.heading,
      paragraphs: s.paragraphs.map(rewriteParagraph).filter(Boolean),
      bullets: s.bullets.map(rewriteSentence).filter(Boolean),
    }))
    .filter((s) => s.paragraphs.length || s.bullets.length)
    .filter((s) => !/(students placed|certificate included|ultimate career choice)/i.test((s.heading || '').toLowerCase()))
    .slice(0, 40);

  return cleanSections;
}

function inferCategory(title = '', url = '') {
  const text = `${title} ${url}`.toLowerCase();

  if (/python|java|php|net|node|react|angular|web|app|programming|software|django|full stack/.test(text)) return 'Technology';
  if (/data|machine learning|ai|analytics|tableau|power bi|hadoop/.test(text)) return 'Data';
  if (/autocad|revit|civil|design|animation|photoshop|illustrator|coreldraw|vfx|multimedia|jewellery|interior/.test(text)) return 'Design';
  if (/ethical hacking|penetration|security|ceh|network|ccna|ccnp/.test(text)) return 'Security';
  if (/cloud|aws|azure|salesforce|rhce|rhcsa|server/.test(text)) return 'Cloud';
  if (/sap|tally|account|finance|gst|banking|marketing|business|trading|hr/.test(text)) return 'Business';

  return 'General';
}

function extractPrice(html) {
  const candidates = [];

  const rupeePatterns = [
    /₹\s?[\d,]+(?:\.\d+)?(?:\/-)?/g,
    /Rs\.?\s?[\d,]+(?:\.\d+)?(?:\/-)?/gi,
    /INR\s?[\d,]+(?:\.\d+)?/gi,
  ];

  rupeePatterns.forEach((pattern) => {
    for (const match of html.matchAll(pattern)) {
      const value = cleanText(match[0]);
      if (value) candidates.push(value);
    }
  });

  const unique = [...new Set(candidates)];
  if (unique.length) return unique[0];

  return 'Not listed';
}

function parseCourse(html, url) {
  const titleTag = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
  const h1Tag = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '';
  const metaDescription =
    (html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i) || [])[1] ||
    (html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i) || [])[1] ||
    (html.match(/<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i) || [])[1] ||
    '';

  let title = cleanText(h1Tag || titleTag);
  title = title.replace(/\s*\|\s*Samyak.*$/i, '').replace(/\s*-\s*Samyak.*$/i, '').trim();

  if (!title) {
    const slug = url.split('/').filter(Boolean).pop() || '';
    title = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  const contentSections = extractStructuredContent(html);
  const allParagraphs = contentSections.flatMap((s) => s.paragraphs);
  const allBullets = contentSections.flatMap((s) => s.bullets);

  const baseDescription = metaDescription ? cleanText(metaDescription) : (allParagraphs[0] || 'Detailed course information is available in the sections below.');
  const description = rewriteParagraph(baseDescription);

  return {
    title,
    description: description.length > 340 ? `${description.slice(0, 337)}...` : description,
    detailParagraphs: [...new Set(allParagraphs)].slice(0, 6),
    keyPoints: [...new Set(allBullets)].slice(0, 20),
    headings: [...new Set(contentSections.map((s) => s.heading))].slice(0, 20),
    contentSections,
    price: extractPrice(html),
    sourceUrl: url,
    url,
  };
}

async function collectCourseUrls() {
  const home = await fetchUrl(SITE);
  if (!home.ok) return [];

  const links = [...home.body.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]);
  const absolute = links.map((link) => {
    if (link.startsWith('http')) return link;
    if (link.startsWith('/')) return `${SITE}${link}`;
    return `${SITE}/${link}`;
  });

  return [...new Set(absolute)].filter((u) => /^https:\/\/samyakinfotech\.com\/course\/[a-z0-9\-\/]+\/?$/i.test(u));
}

async function main() {
  const courseUrls = await collectCourseUrls();
  if (!courseUrls.length) {
    throw new Error('No course URLs found from website.');
  }

  const courses = [];
  let index = 0;
  const workers = 12;

  async function worker() {
    while (index < courseUrls.length) {
      const current = index++;
      const url = courseUrls[current];
      const page = await fetchUrl(url);
      if (!page.ok) continue;

      const parsed = parseCourse(page.body, url);
      courses.push({
        id: 0,
        title: parsed.title,
        category: inferCategory(parsed.title, url),
        level: 'Professional',
        duration: 'Details on course page',
        students: '',
        rating: '',
        price: parsed.price,
        badge: '',
        description: parsed.description,
        detailParagraphs: parsed.detailParagraphs,
        keyPoints: parsed.keyPoints,
        headings: parsed.headings,
        contentSections: parsed.contentSections,
        sourceUrl: parsed.sourceUrl,
        url: parsed.url,
      });
    }
  }

  await Promise.all(Array.from({ length: workers }, () => worker()));

  const deduped = [];
  const seen = new Set();

  for (const c of courses) {
    const key = `${c.title.toLowerCase()}|${c.sourceUrl.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(c);
    }
  }

  deduped.sort((a, b) => a.title.localeCompare(b.title));
  deduped.forEach((c, i) => {
    c.id = i + 1;
  });

  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(deduped, null, 2), 'utf8');

  console.log(`Imported ${deduped.length} courses to ${OUTPUT}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
