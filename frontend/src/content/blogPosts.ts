import { loadPosts } from '../utils/blogPosts.ts';

/**
 * Every Markdown file in ./blog becomes a post — add a file, and it shows up (refresh in dev, rebuild for production).
 * Posts with `draft: true` show only in dev.
 */
const files = import.meta.glob<string>('./blog/*.md', { query: '?raw', import: 'default', eager: true });

export const BLOG_POSTS = loadPosts(files, { includeDrafts: import.meta.env.DEV });

export function findPost(slug: string | undefined) {
  return BLOG_POSTS.find((post) => post.slug === slug) ?? null;
}
