const fs = require('fs');
const text = fs.readFileSync('/Users/huncho/sportsdey/apps/web/sportsdey-terms.txt', 'utf8');

const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

const sections = [];
let currentSection = null;

// The text has lines starting with numbers like "1. INTRODUCTION AND CONTRACTING PARTIES" 
// but wait, looking closely at the txt:
// 6: 1.      INTRODUCTION AND CONTRACTING PARTIES.. 1
// This is the Table of Contents!
// The actual content starts after the TOC. Let's find the first actual heading.
// 27: 	•	INTRODUCTION AND CONTRACTING PARTIES
// 39: 	•	AVAILABILITY OF THE WEBSITE AND SERVICES  
// So headings in the body are preceded by '•' and are all caps.
// Let's just find the first body heading which is line 27.
let inBody = false;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  
  if (line === '•	INTRODUCTION AND CONTRACTING PARTIES') {
    inBody = true;
  }
  
  if (!inBody) continue;

  if (line.startsWith('•	')) {
    line = line.replace('•	', '').trim();
    // Check if line is all caps (or mostly caps) and might be a title
    // Some titles have dashes or spaces, but they generally match the TOC.
    // An easy heuristic: if it's less than 100 characters and doesn't end with punctuation like .
    // Let's just create paragraphs. Actually, let's just make it a single large string or array of paragraphs.
    if (line.match(/^[A-Z \-\&\/]+$/) && line.length < 100 && line !== 'CONTENTS') {
       if (currentSection) {
         sections.push(currentSection);
       }
       currentSection = { title: line, paragraphs: [] };
    } else {
       if (!currentSection) {
          currentSection = { title: "Introduction", paragraphs: [] };
       }
       currentSection.paragraphs.push(line);
    }
  } else {
    // If it doesn't start with bullet, maybe it's still part of the paragraph or a new one.
    if (currentSection && line.length > 0) {
      currentSection.paragraphs.push(line);
    }
  }
}

if (currentSection) {
  sections.push(currentSection);
}

// Write to ts file
const outPath = '/Users/huncho/sportsdey/apps/web/src/data/terms.ts';
fs.writeFileSync(outPath, `export const termsData = ${JSON.stringify(sections, null, 2)};\n`);
console.log("Done");
