import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('dist');
const required = ['index.html', 'awards/index.html', 'history/index.html', 'links/index.html', 'hall-of-fame/index.html', '404.html', '_redirects', '_headers', 'sitemap.xml', 'robots.txt'];
const errors = [];

for (const relative of required) {
  try { await stat(path.join(root, relative)); } catch { errors.push(`Missing required output: ${relative}`); }
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}

const files = await walk(root);
const htmlFiles = files.filter(file => file.endsWith('.html'));
const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));
const maxAsset = 25 * 1024 * 1024;

for (const file of files) {
  const details = await stat(file);
  if (details.size > maxAsset) errors.push(`Asset exceeds Cloudflare Pages 25 MiB limit: ${path.relative(root, file)} (${details.size} bytes)`);
}

for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  if (!html.includes('<title>')) errors.push(`Missing title: ${path.relative(root, file)}`);
  if (!html.includes('name="description"')) errors.push(`Missing description: ${path.relative(root, file)}`);
  if (html.includes('www.iowabowlingcoaches.org/wp-content/uploads/')) errors.push(`Live WordPress asset URL remains: ${path.relative(root, file)}`);
  for (const match of html.matchAll(/(?:href|src)="(\/[^"]+)"/g)) {
    const url = match[1].split(/[?#]/)[0];
    if (url === '/' || url.startsWith('//')) continue;
    const relative = url.endsWith('/') ? `${url.slice(1)}index.html` : url.slice(1);
    try { await stat(path.join(root, relative)); } catch { errors.push(`Broken internal link in ${path.relative(root, file)}: ${url}`); }
  }
}

if (pdfFiles.length !== 47) errors.push(`Expected 47 PDFs, found ${pdfFiles.length}`);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Validated ${htmlFiles.length} HTML pages, ${pdfFiles.length} PDFs, and ${files.length} total files.`);
}
