#!/usr/bin/env node
// Every page that loads prefs-boot.js must also un-hide itself.
//
// prefs-boot.js hides the whole document before first paint when the saved
// language is not English, so a returning Arabic reader never sees a flash of
// the hardcoded English markup. Each page is then expected to reveal it again
// once its own script has swapped the text. A page that forgets never comes
// back: full height, full markup, nothing on screen.
//
// That failure is invisible in the obvious test. Loading the page fresh, or
// clicking the language toggle, both work fine -- prefs-boot has already run
// and decided not to hide. It only shows up for a visitor who *arrives* with
// Arabic saved, which is every returning Arabic reader and no first-time
// developer. It has shipped three times now: legal.html, admin-accounts.html,
// admin-questions.html and billing-callback.html.
//
// So it is checked here rather than left to whoever writes the next page.

const fs = require('fs');
const path = require('path');

const WEB = path.join(__dirname, '..', 'apps', 'web');
const BOOT = 'prefs-boot.js';
// Any of these counts as handing visibility back.
const RESTORE = [
  /document\.documentElement\.style\.visibility\s*=\s*['"]{2}/,
  /document\.documentElement\.style\.removeProperty\(\s*['"]visibility['"]\s*\)/,
  /documentElement\.style\.visibility\s*=\s*['"]visible['"]/,
];

const offenders = [];
for (const name of fs.readdirSync(WEB).filter((f) => f.endsWith('.html')).sort()) {
  const src = fs.readFileSync(path.join(WEB, name), 'utf8');
  if (!src.includes(BOOT)) continue;
  if (!RESTORE.some((re) => re.test(src))) offenders.push(name);
}

if (offenders.length) {
  console.error('These pages load prefs-boot.js but never un-hide the document.');
  console.error('They render blank for anyone whose saved site language is not English:\n');
  for (const name of offenders) console.error('  apps/web/' + name);
  console.error("\nAdd this as the last line of the page's own script:\n");
  console.error("  document.documentElement.style.visibility = '';\n");
  process.exit(1);
}

console.log('All pages loading prefs-boot.js un-hide the document.');
