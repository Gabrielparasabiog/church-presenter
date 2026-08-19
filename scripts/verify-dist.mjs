import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const requiredFiles = ['index.html', 'manifest.webmanifest', 'sw.js'];

for (const file of requiredFiles) {
  const details = await stat(join('dist', file));
  if (!details.isFile() || details.size === 0) throw new Error(`Missing or empty production artifact: ${file}`);
}

const indexHtml = await readFile(join('dist', 'index.html'), 'utf8');
if (!indexHtml.includes('/church-presenter/')) throw new Error('Production assets do not use the GitHub Pages base path.');
if (!indexHtml.includes('manifest.webmanifest')) throw new Error('The PWA manifest is not linked from the production page.');

const manifest = JSON.parse(await readFile(join('dist', 'manifest.webmanifest'), 'utf8'));
if (manifest.name !== 'Church Presenter') throw new Error('Unexpected PWA application name.');
if (manifest.display !== 'standalone') throw new Error('The PWA is not installable in standalone display mode.');
if (manifest.start_url !== './#/') throw new Error('The PWA start URL does not use the home hash route.');
if (!Array.isArray(manifest.icons) || manifest.icons.length < 2) throw new Error('The PWA icons are incomplete.');

const serviceWorker = await readFile(join('dist', 'sw.js'), 'utf8');
if (!serviceWorker.includes('index.html') || !serviceWorker.includes('manifest.webmanifest')) {
  throw new Error('The service worker does not precache the complete application shell.');
}

console.log('Verified GitHub Pages base path, installable manifest, and offline application shell.');
