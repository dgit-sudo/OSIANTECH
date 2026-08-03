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

function wrapTitle(title, maxCharsPerLine = 24, maxLines = 3) {
  // Split on whitespace, but also allow breaks after slashes in long tokens.
  const rawWords = String(title).trim().split(/\s+/).filter(Boolean);
  const words = [];
  for (const w of rawWords) {
    if (w.length > maxCharsPerLine && w.includes('/')) {
      // Keep the slash attached to the preceding chunk so it reads naturally.
      w.split('/').forEach((part, i, arr) => {
        if (part) words.push(i < arr.length - 1 ? `${part}/` : part);
      });
    } else {
      words.push(w);
    }
  }

  // Hard-break any single token still wider than a line.
  const safeWords = [];
  for (const w of words) {
    if (w.length > maxCharsPerLine) {
      for (let i = 0; i < w.length; i += maxCharsPerLine) {
        safeWords.push(w.slice(i, i + maxCharsPerLine));
      }
    } else {
      safeWords.push(w);
    }
  }

  const lines = [];
  let line = '';

  for (const word of safeWords) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxCharsPerLine || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    }
  }

  if (line && lines.length < maxLines) lines.push(line);

  // Count words actually rendered; if we dropped any, ellipsize the last line.
  const rendered = lines.join(' ').split(/\s+/).filter(Boolean).length;
  if (rendered < safeWords.length && lines.length) {
    let last = lines[lines.length - 1];
    while (last.length > maxCharsPerLine - 1 && last.includes(' ')) {
      last = last.slice(0, last.lastIndexOf(' '));
    }
    lines[lines.length - 1] = `${last}…`;
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
  const titleLines = wrapTitle(course.title, 22, 3).map(escapeXml);
  const category = escapeXml(course.category || 'Professional Course');
  const [c1, c2, c3] = paletteForId(course.id);

  // Vertically centre the title block so `cover` cropping never clips it.
  const lineHeight = 74;
  const blockHeight = (titleLines.length - 1) * lineHeight;
  const startY = 400 - blockHeight / 2; // vertical centre of the 750-tall canvas
  const lineEls = titleLines
    .map((line, index) => `<tspan x="80" dy="${index === 0 ? 0 : lineHeight}">${line}</tspan>`)
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750" viewBox="0 0 1200 750" role="img" aria-label="${escapeXml(course.title)} - Osian Academy">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="750" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${c1}"/>
      <stop offset="0.55" stop-color="${c2}"/>
      <stop offset="1" stop-color="${c3}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1020 150) rotate(135) scale(440 440)">
      <stop stop-color="#FFFFFF" stop-opacity="0.32"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="1200" height="750" fill="url(#bg)"/>
  <rect width="1200" height="750" fill="url(#glow)"/>

  <path d="M-20 615C157 499 292 471 466 509C606 540 754 645 923 642C1028 641 1128 600 1240 526V810H-20V615Z" fill="#FFFFFF" fill-opacity="0.1"/>
  <path d="M-20 660C165 587 318 585 496 610C681 636 814 700 966 699C1055 698 1152 674 1240 638V810H-20V660Z" fill="#FFFFFF" fill-opacity="0.08"/>

  <circle cx="1030" cy="150" r="92" fill="#FFFFFF" fill-opacity="0.13"/>
  <circle cx="1122" cy="252" r="46" fill="#FFFFFF" fill-opacity="0.1"/>

  <rect x="80" y="74" width="264" height="48" rx="24" fill="#FFFFFF" fill-opacity="0.18"/>
  <text x="212" y="105" text-anchor="middle" fill="#FFFFFF" fill-opacity="0.98" font-family="Poppins,Segoe UI,Arial,sans-serif" font-size="21" font-weight="700" letter-spacing="1.4">OSIAN ACADEMY</text>

  <text x="80" y="${startY}" fill="#FFFFFF" font-family="Poppins,Segoe UI,Arial,sans-serif" font-size="60" font-weight="800" letter-spacing="0.2">${lineEls}</text>

  <text x="80" y="662" fill="#FFFFFF" fill-opacity="0.92" font-family="Poppins,Segoe UI,Arial,sans-serif" font-size="26" font-weight="600">${category}</text>
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
