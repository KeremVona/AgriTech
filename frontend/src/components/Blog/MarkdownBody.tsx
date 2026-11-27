import { useMemo } from 'react';
import { marked } from 'marked';
import './blog.css';

/** Renders a post's Markdown. Posts are our own repository files, so the HTML is trusted. */
export function MarkdownBody({ markdown }: { markdown: string }) {
  const html = useMemo(() => {
    const raw = marked.parse(markdown, { gfm: true, async: false });
    return raw
      .replace(/<table>/g, '<div class="blog-table"><table>')
      .replace(/<\/table>/g, '</table></div>')
      .replace(/<a href="(https?:\/\/[^"]+)"/g, '<a href="$1" target="_blank" rel="noreferrer"');
  }, [markdown]);

  return <div className="blog-prose" dangerouslySetInnerHTML={{ __html: html }} />;
}
