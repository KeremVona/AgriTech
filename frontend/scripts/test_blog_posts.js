import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { allTags, buildPost, formatPostDate, loadPosts, parseFrontmatter, readingMinutes, slugFromPath } from '../src/utils/blogPosts.ts';

// Front matter: quoted strings, inline arrays, dash lists, booleans, CRLF, comments.
const { data, body } = parseFrontmatter('---\r\ntitle: "A: title"\r\ntags: [a, "b c"]\r\nlist:\r\n  - x\r\n  - \'y\'\r\ndraft: true # wip\r\n---\r\nHello');
assert.equal(data.title, 'A: title');
assert.deepEqual(data.tags, ['a', 'b c']);
assert.deepEqual(data.list, ['x', 'y']);
assert.equal(data.draft, true);
assert.equal(body, 'Hello');
assert.deepEqual(parseFrontmatter('# No front matter').data, {});

// Slugs, reading time, dates.
assert.equal(slugFromPath('./blog/Plant Disease_Classifier.md'), 'plant-disease-classifier');
assert.equal(readingMinutes('word '.repeat(10)), 1);
assert.equal(readingMinutes('word '.repeat(1100)), 5);
assert.equal(formatPostDate('2026-10-30'), 'October 30, 2026');
assert.equal(formatPostDate(''), '');

// A repeated H1 is dropped; title falls back to the H1; bad dates are blanked.
const post = buildPost('./blog/x.md', '---\ntitle: Same\ndate: 2026-01-02\n---\n\n# Same\n\nBody');
assert.equal(post.body, 'Body');
assert.equal(buildPost('./blog/y.md', '# From heading\n\nText').title, 'From heading');
assert.equal(buildPost('./blog/z.md', '---\ndate: 30.10.2026\n---\nx').date, '');

// Drafts hidden in production, newest first, tags by use.
const files = {
  './blog/old.md': '---\ntitle: Old\ndate: 2025-01-01\ntags: [a]\n---\nx',
  './blog/new.md': '---\ntitle: New\ndate: 2026-01-01\ntags: [a, b]\n---\nx',
  './blog/wip.md': '---\ntitle: Wip\ndate: 2027-01-01\ndraft: true\n---\nx',
};
assert.deepEqual(loadPosts(files, { includeDrafts: false }).map((p) => p.slug), ['new', 'old']);
assert.deepEqual(loadPosts(files, { includeDrafts: true }).map((p) => p.slug), ['wip', 'new', 'old']);
assert.deepEqual(allTags(loadPosts(files, { includeDrafts: false })), ['a', 'b']);

// Every real post has a title, a valid date and a unique slug.
const dir = fileURLToPath(new URL('../src/content/blog/', import.meta.url));
const real = readdirSync(dir).filter((file) => file.endsWith('.md'));
const slugs = new Set();
for (const file of real) {
  const p = buildPost(`./blog/${file}`, readFileSync(`${dir}${file}`, 'utf8'));
  assert.ok(p.title, `${file} has a title`);
  assert.ok(p.date, `${file} has date: YYYY-MM-DD`);
  assert.ok(!slugs.has(p.slug), `${file} slug is unique`);
  slugs.add(p.slug);
}

console.log(`PASS blog posts: ${real.length} post file(s) valid`);
