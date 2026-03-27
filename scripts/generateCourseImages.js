const fs = require('fs');
const path = require('path');

const courses = require('../data/coursesCatalog.json');
const outDir = path.join(__dirname, '..', 'public', 'course-images');

function escapeXml(input = '') {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapTitle(title, maxCharsPerLine = 30, maxLines = 3) {
  const words = String(title).trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
      if (lines.length >= maxLines - 1) break;
    }
  }

  if (line && lines.length < maxLines) lines.push(line);

  if (lines.length < words.length && lines.length > 0) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/\.{3}$/, '')}...`;
  }

  return lines.slice(0, maxLines);
}

function paletteForId(id) {
  const palettes = [
    ['#102344', '#1D4E89', '#3FA9F5'],
    ['#1B3A2C', '#257A5E', '#62C29F'],
    ['#3C1D36', '#76458A', '#B77FD7'],
    ['#4A2B1D', '#9A5B39', '#D59267'],
    ['#202045', '#45458D', '#8383DA'],
    ['#142D3F', '#286A92', '#57B0DF'],
  ];
  return palettes[(Number(id) || 0) % palettes.length];
}

function buildSvg(course) {
  const titleLines = wrapTitle(course.title, 34, 3).map(escapeXml);
  const category = escapeXml(course.category || 'Professional Course');
  const [c1, c2, c3] = paletteForId(course.id);

  const lineEls = titleLines
    .map((line, index) => `<tspan x="72" dy="${index === 0 ? 0 : 46}">${line}</tspan>`)
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700" viewBox="0 0 1200 700" role="img" aria-label="${escapeXml(course.title)} - Osian Academy">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="700" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${c1}"/>
      <stop offset="0.55" stop-color="${c2}"/>
      <stop offset="1" stop-color="${c3}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1020 140) rotate(135) scale(420 420)">
      <stop stop-color="#FFFFFF" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="1200" height="700" fill="url(#bg)"/>
  <rect width="1200" height="700" fill="url(#glow)"/>

  <path d="M-20 585C157 469 292 441 466 479C606 510 754 615 923 612C1028 611 1128 570 1240 496V760H-20V585Z" fill="#FFFFFF" fill-opacity="0.12"/>
  <path d="M-20 628C165 555 318 553 496 578C681 604 814 668 966 667C1055 666 1152 642 1240 606V760H-20V628Z" fill="#FFFFFF" fill-opacity="0.1"/>

  <rect x="72" y="66" width="252" height="44" rx="22" fill="#FFFFFF" fill-opacity="0.18"/>
  <text x="198" y="95" text-anchor="middle" fill="#FFFFFF" fill-opacity="0.98" font-family="Poppins,Segoe UI,Arial,sans-serif" font-size="20" font-weight="700" letter-spacing="1.2">OSIAN ACADEMY</text>

  <text x="72" y="240" fill="#FFFFFF" font-family="Poppins,Segoe UI,Arial,sans-serif" font-size="56" font-weight="800" letter-spacing="0.2">${lineEls}</text>

  <rect x="72" y="548" width="420" height="56" rx="28" fill="#0B1420" fill-opacity="0.26"/>
  <text x="96" y="584" fill="#FFFFFF" fill-opacity="0.95" font-family="Poppins,Segoe UI,Arial,sans-serif" font-size="24" font-weight="600">${category}</text>

  <circle cx="1030" cy="124" r="88" fill="#FFFFFF" fill-opacity="0.14"/>
  <circle cx="1118" cy="220" r="44" fill="#FFFFFF" fill-opacity="0.12"/>
</svg>`;
}

fs.mkdirSync(outDir, { recursive: true });

for (const course of courses) {
  const id = Number(course.id);
  if (!Number.isFinite(id) || id <= 0) continue;
  const fileName = `osian-course-${id}.svg`;
  const filePath = path.join(outDir, fileName);
  fs.writeFileSync(filePath, buildSvg(course), 'utf8');
}

console.log(`Generated ${courses.length} course images in ${outDir}`);
