import assert from 'node:assert/strict';
import { readFile, access, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve('dist-pages');
const base = `/${(process.env.PAGES_BASE_PATH ?? '').replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/');
const html = await readFile(resolve(output, 'index.html'), 'utf8');
assert.match(html, /Arcana/);
const links = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]);
assert.ok(links.some(url => url.endsWith('.js')), 'JavaScript entry point exists');
assert.ok(links.some(url => url.endsWith('.css')), 'Stylesheet exists');
for (const url of links) {
  assert.ok(url.startsWith(base), `Asset uses deployment path: ${url}`);
  await access(resolve(output, url.slice(base.length)));
}
const symbols = JSON.parse(await readFile('lib/card-symbols.json', 'utf8'));
for (const { image } of Object.values(symbols)) {
  const url = new URL(image.replace(/^\//, ''), `https://example.test${base}`);
  assert.ok(url.pathname.startsWith(base), `Symbol stays inside deployment: ${image}`);
  await access(resolve(output, url.pathname.slice(base.length)));
}
assert.ok(!(await readdir(output)).includes('cards'), 'Downloaded card art must not be deployed');
assert.ok(!(await readdir(output)).includes('server'), 'Pages output is static');
console.log(`Static entry point and ${Object.keys(symbols).length} symbols verified at ${base}`);
