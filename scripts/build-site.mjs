// Assemble the static Cloudflare Pages site in site/ from the docs that live in the repo.
// Usage: npm run site:build   (then: npm run site:deploy)
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const site = join(root, 'site');

// docs/*.html are body fragments (they were written for the artifact viewer): give them a full document shell.
function page(fragmentPath, outDir, extraHead = '') {
  const body = readFileSync(join(root, fragmentPath), 'utf8');
  mkdirSync(join(site, outDir), { recursive: true });
  writeFileSync(
    join(site, outDir, 'index.html'),
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
${extraHead}
</head>
<body>
${body}
</body>
</html>
`,
  );
}

mkdirSync(site, { recursive: true });
copyFileSync(join(root, 'public/brand/tuitionpilot-app-icon.svg'), join(site, 'favicon.svg'));

page('docs/deck/deck.html', 'deck', '<style>.pdf-link{position:fixed;right:16px;bottom:16px;z-index:5;background:#D2102C;color:#fff;font:600 14px/1 system-ui,sans-serif;padding:12px 16px;border-radius:6px;text-decoration:none}@media print{.pdf-link{display:none}}</style>');
// Add the PDF download link and a way back to the landing page.
const deckIndex = join(site, 'deck', 'index.html');
writeFileSync(
  deckIndex,
  readFileSync(deckIndex, 'utf8').replace(
    '<div class="deck">',
    '<a class="pdf-link" href="/deck/TuitionPilot-Novalycs-deck.pdf">Download PDF</a>\n<div class="deck">',
  ),
);
copyFileSync(join(root, 'docs/deck/TuitionPilot-Novalycs-deck.pdf'), join(site, 'deck', 'TuitionPilot-Novalycs-deck.pdf'));

// Sponsor logos and the team photo, if they have been added.
const deckAssets = join(root, 'docs/deck/assets');
if (existsSync(deckAssets)) cpSync(deckAssets, join(site, 'deck', 'assets'), { recursive: true });

page('docs/prd.html', 'prd');

writeFileSync(
  join(site, '_headers'),
  `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()
`,
);

console.log('site/ ready: /, /deck/, /deck/TuitionPilot-Novalycs-deck.pdf, /prd/');
