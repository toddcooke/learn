// Usage: node scripts/fetch-doc.mjs <url>
// Fetches a doc page (preferring the verbatim markdown sibling that
// docs.aws.amazon.com pages expose at the same path with .html replaced
// by .md), caches it under .cache/docs/, and prints the cached path.
// Re-running with the same URL reuses the cache instead of hitting the
// network again.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const CACHE_DIR = '.cache/docs';
const INDEX_PATH = path.join(CACHE_DIR, 'index.json');

function slugify(url) {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function stripHtml(html) {
  const body = html
    .replace(/^[\s\S]*?<body[^>]*>/i, '')
    .replace(/<\/body>[\s\S]*$/i, '');
  return body
    .replace(/<(script|style|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(h[1-6]|p|li|br|tr|div)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) return null;
  return res.text();
}

async function loadIndex() {
  if (!existsSync(INDEX_PATH)) return {};
  return JSON.parse(await readFile(INDEX_PATH, 'utf8'));
}

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: node scripts/fetch-doc.mjs <url>');
    process.exit(1);
  }

  await mkdir(CACHE_DIR, { recursive: true });
  const index = await loadIndex();
  const slug = slugify(url);
  const filePath = path.join(CACHE_DIR, `${slug}.md`);

  if (index[url] && existsSync(filePath)) {
    console.log(filePath);
    return;
  }

  let content = null;
  const isAwsDocsHtml = /^https:\/\/docs\.aws\.amazon\.com\/.*\.html$/.test(url);
  if (isAwsDocsHtml) {
    content = await fetchText(url.replace(/\.html$/, '.md'));
  }
  if (content === null) {
    const html = await fetchText(url);
    if (html === null) {
      console.error(`Fetch failed for ${url}`);
      process.exit(1);
    }
    content = stripHtml(html);
  }

  await writeFile(filePath, content, 'utf8');
  index[url] = { slug, fetchedAt: new Date().toISOString().slice(0, 10) };
  await writeFile(INDEX_PATH, JSON.stringify(index, null, 2), 'utf8');
  console.log(filePath);
}

main();
