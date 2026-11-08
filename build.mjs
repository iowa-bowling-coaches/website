import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'dist');
const origin = 'https://www.iowabowlingcoaches.org';
const data = JSON.parse(await readFile(path.join(root, 'src', 'data', 'wordpress-content.json'), 'utf8'));

const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

const plainText = html => String(html)
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&hellip;/g, '…')
  .replace(/&nbsp;/g, ' ')
  .replace(/&#8217;/g, '’')
  .replace(/&#8211;/g, '–')
  .replace(/&amp;/g, '&')
  .replace(/&#x([0-9a-f]+);/gi, (_, value) => String.fromCodePoint(Number.parseInt(value, 16)))
  .replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value)))
  .replace(/\s+/g, ' ')
  .trim();

const localize = html => String(html)
  .replaceAll(`${origin}/wp-content/uploads/`, '/wp-content/uploads/')
  .replaceAll(`${origin}/33-2/`, '/awards/')
  .replaceAll(`${origin}/history/`, '/history/')
  .replaceAll(`${origin}/links/`, '/links/')
  .replaceAll(`${origin}/hall-of-fame/`, '/hall-of-fame/')
  .replace(/\sclass="wp-[^"]*"/g, '')
  .replace(/\sdata-(?:type|id)="[^"]*"/g, '');

const formattedDate = value => new Intl.DateTimeFormat('en-US', {
  year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago',
}).format(new Date(`${value.slice(0, 10)}T12:00:00-06:00`));

const navItems = [
  ['home', '/', 'Home'],
  ['awards', '/awards/', 'Awards'],
  ['history', '/history/', 'History'],
  ['hall-of-fame', '/hall-of-fame/', 'Hall of Fame'],
  ['links', '/links/', 'Links'],
];

const bowlingMark = `<svg class="brand-mark" viewBox="0 0 54 64" aria-hidden="true"><path d="M22 5c0 5-4 8-4 13 0 3 2 6 4 8-8 3-14 11-14 20 0 9 8 14 19 14s19-5 19-14c0-9-6-17-14-20 2-2 4-5 4-8 0-5-4-8-4-13h-3l-2 7-2-7h-3Z"/><circle cx="23" cy="44" r="2.3"/><circle cx="31" cy="41" r="2.3"/><circle cx="32" cy="49" r="2.3"/></svg>`;

const header = current => `<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <div class="header-inner">
    <a class="brand" href="/" aria-label="Iowa Bowling Coaches Association home">${bowlingMark}<span><strong>Iowa Bowling Coaches</strong><small>Supporting Iowa high school bowling</small></span></a>
    <button class="menu-button" type="button" aria-expanded="false" aria-controls="site-navigation">Menu</button>
    <nav id="site-navigation" class="site-nav" aria-label="Main navigation">${navItems.map(([key, href, label]) => `<a href="${href}"${current === key ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
  </div>
</header>`;

const page = ({ title, description, current, content, canonical = '/', bodyClass = '' }) => `<!doctype html>
<html lang="en"><head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="theme-color" content="#10254a">
  <link rel="canonical" href="${origin}${canonical}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/styles.css?v=20261108-1">
  <title>${escapeHtml(title)} | Iowa Bowling Coaches Association</title>
</head><body class="${bodyClass}">
${header(current)}
<main id="main">${content}</main>
<footer class="site-footer"><div><p><strong>Iowa Bowling Coaches Association</strong></p><p>Celebrating and supporting high school bowlers and coaches across Iowa.</p></div><p class="footer-links"><a href="/awards/">Awards archive</a><a href="/history/">Program history</a></p></footer>
<script src="/site.js" defer></script>
</body></html>\n`;

const findPage = title => data.pages.find(item => item.title === title);
const awardsPage = findPage('Awards');
const historyPage = findPage('History');
const linksPage = findPage('Links');
const hallPage = findPage('Hall of Fame');
if (!awardsPage || !historyPage || !linksPage || !hallPage) throw new Error('A required WordPress page is missing from the snapshot.');

const posts = [...data.posts].sort((a, b) => b.date.localeCompare(a.date));
const postPath = post => `/${post.date.slice(0, 4)}/${post.date.slice(5, 7)}/${post.date.slice(8, 10)}/${post.slug}/`;
const articleCards = posts.map(post => `<article class="update-card">
  <p class="eyebrow">${formattedDate(post.date)}</p>
  <h2><a href="${postPath(post)}">${post.title}</a></h2>
  <p>${escapeHtml(plainText(post.excerpt || post.content))}</p>
  <a class="text-link" href="${postPath(post)}">Read update <span aria-hidden="true">→</span></a>
</article>`).join('');

const home = page({
  title: 'Home',
  description: 'Awards, history, and updates from the Iowa Bowling Coaches Association.',
  current: 'home',
  canonical: '/',
  bodyClass: 'home',
  content: `<section class="hero"><div class="hero-content"><p class="eyebrow light">Iowa high school bowling</p><h1>Honoring excellence.<br>Preserving the history.</h1><p>Find All-State and All-District awards, historic tournament programs, and association updates in one place.</p><div class="hero-actions"><a class="button primary" href="/awards/">View awards</a><a class="button secondary" href="/history/">Explore history</a></div></div><div class="lane-art" aria-hidden="true"><span class="pin pin-one"></span><span class="pin pin-two"></span><span class="ball"><i></i><i></i><i></i></span></div></section>
  <section class="quick-links" aria-label="Featured resources"><a href="/awards/"><span>Latest honors</span><strong>2025–26 Awards</strong><i>All-State and All-District selections</i></a><a href="/history/"><span>From the archive</span><strong>State programs</strong><i>Documents spanning Iowa bowling history</i></a><a href="/hall-of-fame/"><span>Coming next</span><strong>Hall of Fame</strong><i>A new home for lasting achievements</i></a></section>
  <section class="section-wrap updates"><div class="section-heading"><div><p class="eyebrow">Association news</p><h2>Latest updates</h2></div><p>Announcements and season information for Iowa bowling coaches.</p></div><div class="card-grid">${articleCards}</div></section>`,
});

const contentPage = ({ source, current, canonical, description, intro, extraClass = '' }) => page({
  title: source.title,
  description,
  current,
  canonical,
  bodyClass: extraClass,
  content: `<section class="page-hero"><div><p class="eyebrow">Iowa Bowling Coaches Association</p><h1>${source.title}</h1><p>${intro}</p></div></section><article class="content-shell ${extraClass}">${localize(source.content)}</article>`,
});

const awards = contentPage({ source: awardsPage, current: 'awards', canonical: '/awards/', description: 'Iowa high school bowling All-State, All-District, and Academic All-State awards.', intro: 'All-State, All-District, and Academic All-State recognition by season.', extraClass: 'awards-content' });
const history = contentPage({ source: historyPage, current: 'history', canonical: '/history/', description: 'Historical Iowa high school bowling tournament programs and documents.', intro: 'Tournament programs and documents preserved by season.', extraClass: 'history-content' });
const links = page({
  title: 'Links', current: 'links', canonical: '/links/',
  description: 'Official Iowa high school bowling organizations and resources.',
  content: `<section class="page-hero"><div><p class="eyebrow">Official resources</p><h1>Links</h1><p>State organizations serving Iowa high school bowlers, schools, and coaches.</p></div></section><section class="content-shell link-cards"><a href="https://www.iahsaa.org/bowling/"><span>IHSAA</span><strong>Iowa High School Athletic Association</strong><i>Official boys bowling information and postseason resources</i></a><a href="https://ighsau.org/sports/bowling"><span>IGHSAU</span><strong>Iowa Girls High School Athletic Union</strong><i>Official girls bowling information and postseason resources</i></a></section>`,
});
const hall = page({
  title: 'Hall of Fame', current: 'hall-of-fame', canonical: '/hall-of-fame/',
  description: 'Iowa Bowling Coaches Association Hall of Fame.',
  content: `<section class="page-hero hall-hero"><div><p class="eyebrow">Recognizing lasting impact</p><h1>Hall of Fame</h1><p>A permanent home for the coaches and contributors who shaped Iowa high school bowling.</p></div></section><section class="content-shell coming-soon"><div class="medallion" aria-hidden="true">IBCA</div><p class="eyebrow">Coming soon</p><h2>Building the inaugural collection</h2><p>${escapeHtml(plainText(hallPage.content))} We’ll share inductees and nomination information here as the program develops.</p></section>`,
});

const articlePages = posts.map(post => ({
  route: postPath(post),
  html: page({
    title: post.title,
    description: plainText(post.excerpt || post.content).slice(0, 155),
    current: 'home', canonical: postPath(post), bodyClass: 'article-page',
    content: `<article class="article-shell"><a class="back-link" href="/">← All updates</a><p class="eyebrow">${formattedDate(post.date)}</p><h1>${post.title}</h1><div class="article-body">${localize(post.content)}</div></article>`,
  }),
}));

const notFound = page({
  title: 'Page not found', description: 'The requested page could not be found.', canonical: '/404.html',
  content: `<section class="not-found"><p class="eyebrow">404</p><h1>That page is out of bounds.</h1><p>The page may have moved during our website update.</p><a class="button primary" href="/">Return home</a></section>`,
});

const routes = [
  ['index.html', home],
  ['awards/index.html', awards],
  ['history/index.html', history],
  ['links/index.html', links],
  ['hall-of-fame/index.html', hall],
  ['404.html', notFound],
  ...articlePages.map(article => [`${article.route.slice(1)}index.html`, article.html]),
];

const sitemapUrls = ['/', '/awards/', '/history/', '/links/', '/hall-of-fame/', ...posts.map(postPath)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.map(url => `  <url><loc>${origin}${url}</loc></url>`).join('\n')}\n</urlset>\n`;
const redirects = [
  '/33-2/ /awards/ 301',
  '/about-theme/ / 301',
  '/contact-theme/ / 301',
  '/sample-page/ / 301',
  '/home/ / 301',
  '/?page_id=33 /awards/ 301',
].join('\n') + '\n';
const headers = `/*\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: SAMEORIGIN\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n\n/wp-content/uploads/*\n  Cache-Control: public, max-age=31536000, immutable\n`;

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const [relative, html] of routes) {
  const destination = path.join(out, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, html, 'utf8');
}
await cp(path.join(root, 'public'), out, { recursive: true });
await Promise.all([
  writeFile(path.join(out, 'sitemap.xml'), sitemap, 'utf8'),
  writeFile(path.join(out, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`, 'utf8'),
  writeFile(path.join(out, '_redirects'), redirects, 'utf8'),
  writeFile(path.join(out, '_headers'), headers, 'utf8'),
]);
console.log(`Built ${routes.length} HTML pages and ${data.media.length} preserved media items in dist/.`);
