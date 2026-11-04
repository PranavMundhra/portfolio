import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const documents = new Map();
const relative = (file) => path.relative(root, file).replaceAll('\\', '/');
const fail = (file, message) => errors.push(`${relative(file)}: ${message}`);
const decode = (value) => value.replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
const attributes = (text) => {
  const result = {};
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const match of text.matchAll(pattern)) result[match[1].toLowerCase()] = decode(match[2] ?? match[3] ?? match[4] ?? '');
  return result;
};
async function collect(directory) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const files = [];
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(file));
    else if (entry.name.endsWith('.html')) files.push(file);
  }
  return files;
}
const files = [path.join(root, 'index.html'), ...await collect(path.join(root, 'aisehack')), ...await collect(path.join(root, 'projects')), ...await collect(path.join(root, 'resume'))];
for (const file of files) {
  let source;
  try { source = await readFile(file, 'utf8'); }
  catch (error) { fail(file, `cannot read HTML (${error.code})`); continue; }
  const html = source.replace(/<!--[\s\S]*?-->/g, '');
  const tags = [...html.matchAll(/<([a-z][\w:-]*)\b([^>]*?)>/gi)].map((match) => ({ name: match[1].toLowerCase(), attrs: attributes(match[2]) }));
  const ids = new Set();
  for (const tag of tags) {
    if ('id' in tag.attrs) {
      if (!tag.attrs.id) fail(file, 'empty id attribute');
      if (ids.has(tag.attrs.id)) fail(file, `duplicate id "${tag.attrs.id}"`);
      ids.add(tag.attrs.id);
    }
  }
  documents.set(file, { html, tags, ids });
  if (!tags.find((tag) => tag.name === 'html' && tag.attrs.lang?.trim())) fail(file, 'missing HTML language');
  if (!/<title\b[^>]*>\s*[^<\s][\s\S]*?<\/title>/i.test(html)) fail(file, 'missing or empty page title');
  if (!tags.find((tag) => tag.name === 'meta' && tag.attrs.name?.toLowerCase() === 'description' && tag.attrs.content?.trim())) fail(file, 'missing or empty meta description');
  const headings = tags.filter((tag) => tag.name === 'h1');
  if (headings.length !== 1) fail(file, `expected one h1, found ${headings.length}`);
  const main = tags.find((tag) => tag.name === 'main');
  if (!main?.attrs.id) fail(file, 'main content requires an id for the skip link');
  else if (!tags.find((tag) => tag.name === 'a' && tag.attrs.href === `#${main.attrs.id}`)) fail(file, `missing skip link to #${main.attrs.id}`);
  if (/\[(?:CONFIRM|ADD)\s*:/i.test(html)) fail(file, 'unresolved editorial [CONFIRM] or [ADD] marker');
  for (const tag of tags) {
    if (tag.name === 'a' && (!tag.attrs.href?.trim() || tag.attrs.href === '#')) fail(file, 'empty or placeholder link');
    if (tag.name === 'img' && !('alt' in tag.attrs)) fail(file, `image ${tag.attrs.src ?? '(unknown)'} has no alt attribute`);
  }
}

// Repository links are cross-checked against the private planning notes in notes/ (not published).
// Without them, for example in a fresh clone, that one check is skipped.
let allowedRepositories = null;
for (const name of ['initial-content.md', 'initial-prototype-structure.md']) {
  let content;
  try { content = await readFile(path.join(root, 'notes', name), 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  allowedRepositories ??= new Set();
  for (const match of content.matchAll(/https:\/\/github\.com\/([^/\s)]+)\/([^/\s)#?]+)/g)) allowedRepositories.add(`${match[1]}/${match[2]}`.toLowerCase());
}
async function checkReference(file, value, label) {
  const reference = value.trim();
  if (!reference) { fail(file, `empty ${label}`); return; }
  if (/^(?:https?:)?\/\//i.test(reference)) {
    let url;
    try { url = new URL(reference.startsWith('//') ? `https:${reference}` : reference); }
    catch { fail(file, `invalid external URL: ${reference}`); return; }
    if (url.hostname === 'github.com') {
      const parts = url.pathname.split('/').filter(Boolean);
      if (allowedRepositories && parts.length >= 2 && !allowedRepositories.has(`${parts[0]}/${parts[1]}`.toLowerCase())) fail(file, `repository URL has no supplied source: ${reference}`);
    }
    return;
  }
  if (/^(?:mailto:|tel:|data:)/i.test(reference)) return;
  if (/^[a-z][a-z\d+.-]*:/i.test(reference)) { fail(file, `unsupported ${label} scheme: ${reference}`); return; }
  const [beforeHash, fragment] = reference.split('#');
  const pathname = beforeHash.split('?')[0];
  let target;
  try {
    target = !pathname ? file : pathname.startsWith('/')
      ? path.resolve(root, `.${decodeURIComponent(pathname)}`)
      : path.resolve(path.dirname(file), decodeURIComponent(pathname));
  }
  catch { fail(file, `invalid URL encoding: ${reference}`); return; }
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) { fail(file, `${label} escapes the site directory: ${reference}`); return; }
  try {
    const info = await stat(target);
    if (info.isDirectory()) target = path.join(target, 'index.html');
    await stat(target);
  } catch { fail(file, `missing local ${label}: ${reference} (resolved ${relative(target)})`); return; }
  if (fragment && target.endsWith('.html')) {
    let fragmentId;
    try { fragmentId = decodeURIComponent(fragment); }
    catch { fail(file, `invalid anchor encoding: ${reference}`); return; }
    let targetIds = documents.get(target)?.ids;
    if (!targetIds) {
      const content = await readFile(target, 'utf8');
      targetIds = new Set([...content.matchAll(/<[a-z][\w:-]*\b([^>]*?)>/gi)].map((match) => attributes(match[1]).id).filter(Boolean));
    }
    if (!targetIds.has(fragmentId)) fail(file, `missing anchor #${fragmentId} in ${relative(target)}`);
  }
}
for (const [file, document] of documents) {
  for (const tag of document.tags) {
    for (const name of ['href', 'src', 'poster']) if (name in tag.attrs) await checkReference(file, tag.attrs[name], name);
    if (tag.attrs.srcset && !tag.attrs.srcset.startsWith('data:')) {
      for (const candidate of tag.attrs.srcset.split(',')) await checkReference(file, candidate.trim().split(/\s+/)[0], 'srcset');
    }
  }
}
if (errors.length) {
  console.error(`Static site check failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):\n${errors.map((error) => `- ${error}`).join('\n')}`);
  process.exitCode = 1;
} else console.log(`Static site check passed: ${documents.size} HTML pages; local links, anchors, page metadata, and basic accessibility verified${allowedRepositories ? ', plus repository links against the notes' : ' (repository-link check skipped: no notes/ folder)'}.`);
