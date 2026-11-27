/**
 * Blog post parsing. Plain functions (no Vite APIs) so scripts/test_blog_posts.js can run them in Node.
 * Files are discovered in src/content/blogPosts.ts. Design: docs/superpowers/specs/2026-11-27-blog-design.md
 */

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  /** YYYY-MM-DD */
  date: string;
  tags: string[];
  author: string | null;
  cover: string | null;
  draft: boolean;
  readingMinutes: number;
  /** Markdown body without the front matter (and without a leading `# Title` that repeats the title). */
  body: string;
}

type FrontValue = string | boolean | string[];

const unquote = (value: string) => value.replace(/^(["'])([\s\S]*)\1$/, '$2').trim();

function parseValue(raw: string): FrontValue {
  const value = raw.trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map((item) => unquote(item.trim()))
      .filter(Boolean);
  }
  return unquote(value);
}

/** Splits `---` front matter from the body. Supports `key: value`, `[a, b]` and `- item` lists. */
export function parseFrontmatter(source: string): { data: Record<string, FrontValue>; body: string } {
  const text = source.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const match = text.match(/^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/);
  if (!match) return { data: {}, body: text };

  const data: Record<string, FrontValue> = {};
  let listKey: string | null = null;
  for (const line of match[1].split('\n')) {
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && listKey) {
      (data[listKey] as string[]).push(unquote(item[1]));
      continue;
    }
    const pair = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!pair) continue;
    const [, key, value] = pair;
    if (value.trim() === '') {
      data[key] = [];
      listKey = key;
    } else {
      data[key] = parseValue(value.replace(/\s+#.*$/, ''));
      listKey = null;
    }
  }
  return { data, body: text.slice(match[0].length) };
}

/** `content/blog/plant-disease-classifier.md` → `plant-disease-classifier`. */
export function slugFromPath(path: string): string {
  const file = path.split('/').pop() ?? path;
  return file
    .replace(/\.md$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** About 220 words a minute, never less than one. */
export function readingMinutes(markdown: string): number {
  const words = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`|[\]()-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

const asString = (value: FrontValue | undefined) => (typeof value === 'string' ? value : '');
const asList = (value: FrontValue | undefined) => (Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : []);

export function buildPost(path: string, source: string): BlogPost {
  const { data, body } = parseFrontmatter(source);
  const heading = body.match(/^\s*#\s+(.+?)\s*#*\s*$/m);
  const title = asString(data.title) || heading?.[1] || slugFromPath(path);
  // Drop a leading H1 that repeats the title; the page renders the title itself.
  const firstH1 = body.match(/^\s*#\s+(.+?)\s*#*\s*(?:\n|$)/);
  const content = firstH1 && firstH1[1].trim() === title.trim() ? body.slice(firstH1[0].length) : body;
  const date = asString(data.date);

  return {
    slug: slugFromPath(path),
    title,
    description: asString(data.description),
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '',
    tags: asList(data.tags),
    author: asString(data.author) || null,
    cover: asString(data.cover) || null,
    draft: data.draft === true,
    readingMinutes: readingMinutes(content),
    body: content.trim(),
  };
}

/** Newest first; undated posts last, then by title. */
export function sortPosts(posts: BlogPost[]): BlogPost[] {
  return [...posts].sort((a, b) => (b.date || '0').localeCompare(a.date || '0') || a.title.localeCompare(b.title));
}

/** Builds, hides drafts when asked, and sorts. */
export function loadPosts(files: Record<string, string>, { includeDrafts }: { includeDrafts: boolean }): BlogPost[] {
  const posts = Object.entries(files).map(([path, source]) => buildPost(path, source));
  return sortPosts(includeDrafts ? posts : posts.filter((post) => !post.draft));
}

/** Every tag used, most used first. */
export function allTags(posts: BlogPost[]): string[] {
  const counts = new Map<string, number>();
  for (const post of posts) for (const tag of post.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag]) => tag);
}

/** `2026-10-30` → `October 30, 2026` (no time zone shift). */
export function formatPostDate(date: string): string {
  if (!date) return '';
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
