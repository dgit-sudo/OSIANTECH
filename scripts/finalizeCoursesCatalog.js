const fs = require('fs');
const path = require('path');

const catalogPath = path.join(__dirname, '..', 'data', 'coursesCatalog.json');
const imageDir = path.join(__dirname, '..', 'public', 'course-images');

const rawCourses = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

const badLinePatterns = [
  /concepts doesn.t help anyone/i,
  /certifications like microsoft/i,
  /contents are based upon the latest trends/i,
  /a detailed overview of the course/i,
  /internationally recognized certificate/i,
  /govt of india-backed/i,
  /google certificate/i,
  /nsdc certificate/i,
  /be in the spotlight/i,
  /our students placed/i,
  /thank you! your application/i,
  /phone:/i,
  /new batch every/i,
  /working professionals\.?$/i,
  /creative professionals\.?$/i,
  /career seekers\.?$/i,
  /join our 100% job assistance/i,
];

const courseProfiles = [
  {
    test: /blender|3d animation/i,
    label: '3D Motion',
    shortCode: '3D',
    palette: ['#1d3557', '#457b9d', '#f4a261'],
    summary: [
      'Learn the complete Blender workflow for modeling, surfacing, lighting, animation, and final rendering.',
      'Build production-style scenes and motion pieces while understanding how assets move from concept to polished output.',
    ],
    sections: [
      {
        heading: 'What You Will Learn',
        bullets: [
          'Create objects with polygon modeling, modifiers, and clean topology practices.',
          'Animate characters, cameras, and motion graphics with keyframes and graph tools.',
          'Set up materials, textures, lights, and render passes for polished visual output.',
        ],
      },
      {
        heading: 'Projects and Outcomes',
        bullets: [
          'Produce short animated scenes, product shots, and portfolio-ready 3D visuals.',
          'Develop a practical understanding of the Blender pipeline from layout to final render.',
        ],
      },
    ],
  },
  {
    test: /python/i,
    label: 'Python',
    shortCode: 'PY',
    palette: ['#1f3c88', '#4b7bec', '#f7b731'],
  },
  {
    test: /java(?!script)/i,
    label: 'Java',
    shortCode: 'JV',
    palette: ['#6c2bd9', '#2f80ed', '#f2994a'],
  },
  {
    test: /react|angular|vue|frontend|web design|html|css|javascript|full stack|node/i,
    label: 'Web Development',
    shortCode: 'WEB',
    palette: ['#0f766e', '#14b8a6', '#38bdf8'],
  },
  {
    test: /data|machine learning|artificial intelligence|ai|analytics|power bi|tableau|hadoop|big data/i,
    label: 'Data & AI',
    shortCode: 'DATA',
    palette: ['#0b3c5d', '#328cc1', '#d9b310'],
  },
  {
    test: /autocad|revit|civil|interior|architecture|cad/i,
    label: 'Design Tools',
    shortCode: 'CAD',
    palette: ['#3f2b96', '#a8c0ff', '#f093fb'],
  },
  {
    test: /hardware|network|ccna|ccnp|server|linux|cloud|aws|azure|security|ethical hacking/i,
    label: 'Infrastructure',
    shortCode: 'SYS',
    palette: ['#16222a', '#3a6073', '#56ccf2'],
  },
  {
    test: /tally|gst|account|finance|banking|sap|hr|marketing|trading/i,
    label: 'Business Tools',
    shortCode: 'BIZ',
    palette: ['#4b2e83', '#6a4c93', '#fcbf49'],
  },
  {
    test: /photoshop|illustrator|coreldraw|graphic|ui|ux|animation|multimedia|vfx/i,
    label: 'Creative Design',
    shortCode: 'ART',
    palette: ['#3b1c32', '#a53f6b', '#f6ad55'],
  },
];

function normalizeText(text = '') {
  return String(text)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\bfor 2026\b/gi, '')
    .replace(/\s+\./g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

function isMetaBullet(text = '') {
  return /^(next batch|course duration|eligibility|modes? of training|mode of training|batch timing)/i.test(normalizeText(text));
}

function isBadLine(text = '') {
  const value = normalizeText(text);
  if (!value) return true;
  if (value.length < 16) return true;
  return badLinePatterns.some((pattern) => pattern.test(value));
}

function uniq(items) {
  return [...new Set(items)];
}

function sentenceCase(text = '') {
  const value = normalizeText(text);
  if (!value) return '';
  const out = value.charAt(0).toUpperCase() + value.slice(1);
  return /[.!?]$/.test(out) ? out : `${out}.`;
}

function cleanBullets(list = []) {
  return uniq(
    list
      .map(normalizeText)
      .filter((item) => item.length >= 18 && !isBadLine(item))
      .map(sentenceCase)
  ).slice(0, 12);
}

function cleanParagraphs(list = []) {
  return uniq(
    list
      .map(normalizeText)
      .filter((item) => item.length >= 60 && !isBadLine(item))
      .filter((item) => !/(course duration:|eligibility:|modes? of training|next batch:|learners also work through course duration)/i.test(item))
      .map(sentenceCase)
  ).slice(0, 6);
}

function cleanHeading(text = '') {
  const value = normalizeText(text)
    .replace(/^join our 100% job assistance/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!value) return '';
  if (/google certificate|nsdc certificate|be in the spotlight|tools covered in course/i.test(value)) return '';
  return value;
}

function findProfile(course) {
  return courseProfiles.find((profile) => profile.test.test(course.title)) || {
    label: course.category || 'Professional Learning',
    shortCode: (course.category || 'Course').slice(0, 3).toUpperCase(),
    palette: ['#2d3748', '#4a5568', '#90cdf4'],
  };
}

function collectUsefulBullets(course) {
  const sectionBullets = (course.contentSections || []).flatMap((section) => section.bullets || []);
  return cleanBullets([...(course.keyPoints || []), ...sectionBullets]);
}

function collectUsefulParagraphs(course) {
  const sectionParagraphs = (course.contentSections || []).flatMap((section) => section.paragraphs || []);
  return cleanParagraphs([course.description, ...(course.detailParagraphs || []), ...sectionParagraphs]);
}

function buildDescription(course, profile, bullets, paragraphs) {
  const current = normalizeText(course.description);
  if (current && !isBadLine(current) && current.length >= 45) return sentenceCase(current.replace(/ for 2026/i, ''));

  if (paragraphs.length) return sentenceCase(paragraphs[0]);

  const intro = `${course.title} is a structured ${profile.label.toLowerCase()} course designed to help learners build practical, job-ready skills.`;
  const second = bullets[0]
    ? `The programme focuses on ${bullets[0].charAt(0).toLowerCase()}${bullets[0].slice(1).replace(/[.]$/, '')} and related workflow practice.`
    : `The programme combines guided instruction, hands-on exercises, and real project work so learners can apply the tools with confidence.`;

  return `${sentenceCase(intro)} ${sentenceCase(second)}`;
}

function buildOverviewParagraphs(course, profile, bullets, paragraphs) {
  const learningBullets = bullets.filter((bullet) => !isMetaBullet(bullet));

  if (paragraphs.length >= 2) return paragraphs.slice(0, 2);
  if (paragraphs.length === 1) {
    const extra = learningBullets[0]
      ? `Learners also work through ${learningBullets[0].charAt(0).toLowerCase()}${learningBullets[0].slice(1).replace(/[.]$/, '')} as part of a guided practical workflow.`
      : `Learners build confidence through structured exercises, demonstrations, and project-style assignments.`;
    return [paragraphs[0], sentenceCase(extra)];
  }

  return [
    sentenceCase(`${course.title} introduces learners to core ${profile.label.toLowerCase()} concepts with a strong focus on practical execution and portfolio-ready outcomes`),
    sentenceCase(`The course structure is designed to turn theory into repeatable workflow skills through guided practice, tool familiarity, and applied assignments`),
  ];
}

function buildSections(course, profile, bullets, paragraphs) {
  const cleanedSections = (course.contentSections || [])
    .map((section) => ({
      heading: cleanHeading(section.heading),
      paragraphs: cleanParagraphs(section.paragraphs || []),
      bullets: cleanBullets(section.bullets || []),
    }))
    .filter((section) => section.heading && (section.paragraphs.length || section.bullets.length));

  if (cleanedSections.length >= 2) return cleanedSections.slice(0, 8);

  if (profile.sections) {
    return [
      {
        heading: 'Course Overview',
        paragraphs: buildOverviewParagraphs(course, profile, bullets, paragraphs),
        bullets: bullets.slice(0, 4),
      },
      ...profile.sections,
    ];
  }

  return [
    {
      heading: 'Course Overview',
      paragraphs: buildOverviewParagraphs(course, profile, bullets, paragraphs),
      bullets: bullets.slice(0, 4),
    },
    {
      heading: 'Skills You Build',
      paragraphs: [],
      bullets: bullets.slice(4, 10),
    },
    {
      heading: 'Learning Outcomes',
      paragraphs: [sentenceCase(`By the end of ${course.title}, learners should be able to apply the covered tools and techniques in guided academic or professional scenarios`)],
      bullets: [],
    },
  ].filter((section) => section.paragraphs.length || section.bullets.length);
}

function toSlug(text = '') {
  return normalizeText(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function wrapTitle(title, maxLineLength = 18) {
  const words = normalizeText(title).split(' ');
  const lines = [];
  let current = '';

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxLineLength || !current) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  });

  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function escapeXml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function renderCourseImage(course, profile) {
  const [c1, c2, c3] = profile.palette;
  const lines = wrapTitle(course.title, 18);
  const chip = escapeXml(profile.label);
  const code = escapeXml(profile.shortCode);
  const titleLines = lines
    .map((line, index) => `<text x="44" y="${182 + index * 32}" font-size="26" font-weight="700" fill="#ffffff">${escapeXml(line)}</text>`)
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420" role="img" aria-label="${escapeXml(course.title)}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="55%" stop-color="${c2}"/>
      <stop offset="100%" stop-color="${c3}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.28)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
  </defs>
  <rect width="640" height="420" rx="34" fill="url(#bg)"/>
  <circle cx="518" cy="104" r="86" fill="rgba(255,255,255,0.12)"/>
  <circle cx="518" cy="104" r="60" fill="rgba(255,255,255,0.08)"/>
  <rect x="44" y="44" width="170" height="38" rx="19" fill="rgba(255,255,255,0.16)"/>
  <text x="62" y="69" font-size="20" font-weight="600" fill="#f8fafc">${chip}</text>
  <text x="500" y="117" text-anchor="middle" font-size="46" font-weight="800" fill="#ffffff">${code}</text>
  <path d="M42 300 C150 250, 240 340, 330 285 S520 230, 598 286 L598 418 L42 418 Z" fill="rgba(255,255,255,0.14)"/>
  <path d="M42 330 C140 285, 228 365, 330 320 S525 290, 598 332 L598 418 L42 418 Z" fill="rgba(10,18,31,0.16)"/>
  <g opacity="0.14" stroke="#ffffff" stroke-width="1">
    <path d="M44 114h260"/>
    <path d="M44 132h220"/>
    <path d="M44 150h180"/>
  </g>
  ${titleLines}
  <text x="44" y="378" font-size="18" font-weight="500" fill="#e5eefb">Osian Academy Course</text>
</svg>`;
}

fs.mkdirSync(imageDir, { recursive: true });

const finalized = rawCourses.map((course) => {
  const profile = findProfile(course);
  const bullets = collectUsefulBullets(course);
  const paragraphs = collectUsefulParagraphs(course);
  const contentSections = buildSections(course, profile, bullets, paragraphs);
  const imageSlug = `${String(course.id).padStart(3, '0')}-${toSlug(course.title) || `course-${course.id}`}`;
  const imageFile = `${imageSlug}.svg`;
  const imagePath = `/course-images/${imageFile}`;

  fs.writeFileSync(path.join(imageDir, imageFile), renderCourseImage(course, profile), 'utf8');

  const overviewParagraphs = cleanParagraphs(contentSections.flatMap((section) => section.paragraphs || []));

  return {
    ...course,
    description: buildDescription(course, profile, bullets, overviewParagraphs),
    detailParagraphs: overviewParagraphs.slice(0, 4),
    keyPoints: bullets,
    headings: contentSections.map((section) => section.heading),
    contentSections,
    image: imagePath,
  };
});

fs.writeFileSync(catalogPath, JSON.stringify(finalized, null, 2), 'utf8');
console.log(`Finalized ${finalized.length} courses and generated artwork in ${imageDir}`);