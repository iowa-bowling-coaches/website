import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'https://www.iowabowlingcoaches.org';
const api = `${origin}/wp-json/wp/v2`;

async function getJson(url) {
  const response = await fetchWithRetry(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function fetchWithRetry(url, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'IowaBowlingCoachesMigration/1.0' },
        signal: AbortSignal.timeout(30_000),
      });
      if (response.ok || attempt === attempts) return response;
      lastError = new Error(`${response.status} ${response.statusText}: ${url}`);
    } catch (error) {
      lastError = error;
    }
    console.warn(`Retrying ${url} (attempt ${attempt + 1} of ${attempts})`);
  }
  throw lastError;
}

const cleanItem = item => ({
  id: item.id,
  date: item.date,
  modified: item.modified,
  slug: item.slug,
  status: item.status,
  link: item.link,
  title: item.title?.rendered ?? '',
  excerpt: item.excerpt?.rendered ?? '',
  content: item.content?.rendered ?? '',
  featuredMedia: item.featured_media || 0,
});

const [pages, posts, media] = await Promise.all([
  getJson(`${api}/pages?per_page=100&context=view`),
  getJson(`${api}/posts?per_page=100&context=view`),
  getJson(`${api}/media?per_page=100&context=view`),
]);

const content = {
  source: origin,
  importedAt: new Date().toISOString(),
  pages: pages.map(cleanItem),
  posts: posts.map(cleanItem),
  media: media.map(item => ({
    id: item.id,
    date: item.date,
    slug: item.slug,
    mediaType: item.media_type,
    mimeType: item.mime_type,
    title: item.title?.rendered ?? '',
    sourceUrl: item.source_url,
    altText: item.alt_text ?? '',
  })),
};

await mkdir(path.join(root, 'src', 'data'), { recursive: true });
await writeFile(
  path.join(root, 'src', 'data', 'wordpress-content.json'),
  `${JSON.stringify(content, null, 2)}\n`,
  'utf8',
);

for (const item of content.media) {
  const url = new URL(item.sourceUrl);
  const marker = '/wp-content/uploads/';
  const index = url.pathname.indexOf(marker);
  if (index === -1) throw new Error(`Unexpected media URL: ${item.sourceUrl}`);
  const relative = url.pathname.slice(1);
  const destination = path.join(root, 'public', ...relative.split('/'));
  try {
    const existing = await stat(destination);
    if (existing.size > 0) {
      console.log(`Kept ${relative} (${existing.size.toLocaleString()} bytes)`);
      continue;
    }
  } catch {}
  const response = await fetchWithRetry(item.sourceUrl);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${item.sourceUrl}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, bytes);
  console.log(`Downloaded ${relative} (${bytes.length.toLocaleString()} bytes)`);
}

console.log(`Imported ${content.pages.length} pages, ${content.posts.length} posts, and ${content.media.length} media items.`);
