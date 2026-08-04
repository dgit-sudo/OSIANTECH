'use strict';

/*
  Merge hand-written course copy into the catalog.
  Reads every data/courseCopy*.json file, applies { card, desc } per id:
    - course.description  <- desc   (full description used on detail pages)
    - course.cardLine     <- card   (one-liner used on listing/home cards)
  Prices, fees and all other fields are never touched.
*/

const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const catalogPath = path.join(dataDir, 'coursesCatalog.json');
const courses = require(catalogPath);

// Gather all copy files (courseCopy.json, courseCopy-2.json, etc.)
const copyFiles = fs.readdirSync(dataDir).filter((f) => /^courseCopy.*\.json$/i.test(f)).sort();
const copy = {};
for (const f of copyFiles) {
  const part = JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));
  Object.assign(copy, part);
}

let applied = 0;
const missing = [];
for (const course of courses) {
  const entry = copy[String(course.id)];
  if (!entry) { missing.push(course.id); continue; }
  if (entry.desc) course.description = entry.desc;
  if (entry.card) course.cardLine = entry.card;
  applied += 1;
}

fs.writeFileSync(catalogPath, `${JSON.stringify(courses, null, 2)}\n`, 'utf8');
console.log(`Applied hand-written copy to ${applied}/${courses.length} courses from ${copyFiles.length} file(s).`);
if (missing.length) console.log(`Still missing (${missing.length}): ${missing.join(', ')}`);
