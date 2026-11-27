import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BLOG_POSTS, findPost } from '../content/blogPosts.ts';
import { formatPostDate } from '../utils/blogPosts.ts';
import { AppHeader } from '../components/ui/AppHeader.tsx';
import { MarkdownBody } from '../components/Blog/MarkdownBody.tsx';
import { PostCard, PostCover } from '../components/Blog/PostCard.tsx';

const BACK_LINK =
  'inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm text-ui-ink-2 hover:text-ui-ink focus-visible:outline-2 focus-visible:outline-ui-accent';

export function BlogPostPage() {
  const { slug } = useParams();
  const post = findPost(slug);
  const more = post ? BLOG_POSTS.filter((other) => other.slug !== post.slug).slice(0, 2) : [];

  useEffect(() => {
    document.title = post ? `${post.title} · AgriTech` : 'Post not found · AgriTech';
    window.scrollTo(0, 0);
  }, [post]);

  return (
    <div className="ui-page min-h-screen antialiased">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ui-ink focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <AppHeader />

      {!post ? (
        <main id="main" className="mx-auto max-w-[680px] px-4 pb-24 pt-16 text-center sm:px-6">
          <h1 className="text-3xl font-medium tracking-[-0.02em] text-ui-ink">Post not found</h1>
          <p className="mt-3 text-ui-ink-2">It may have been renamed or removed.</p>
          <Link to="/blog" className={`${BACK_LINK} mt-4`}>
            ← All posts
          </Link>
        </main>
      ) : (
        <main id="main" className="px-4 pb-24 pt-8 sm:px-6 sm:pt-12">
          <article className="mx-auto max-w-[680px]">
            <Link to="/blog" className={BACK_LINK}>
              ← All posts
            </Link>

            <header className="mt-6">
              <p className="flex flex-wrap items-center gap-x-2 text-sm text-ui-ink-3">
                {post.date && <time dateTime={post.date}>{formatPostDate(post.date)}</time>}
                {post.date && <span aria-hidden="true">·</span>}
                <span>{post.readingMinutes} min read</span>
                {post.draft && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Draft — hidden in production</span>}
              </p>
              <h1 className="mt-3 text-balance text-[34px] font-semibold leading-[1.12] tracking-[-0.025em] text-ui-ink sm:text-[44px]">
                {post.title}
              </h1>
              {post.description && <p className="mt-4 text-[19px] leading-relaxed text-ui-ink-2">{post.description}</p>}
              {(post.author || post.tags.length > 0) && (
                <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-ui-line pb-6">
                  {post.author && <p className="text-sm font-medium text-ui-ink">By {post.author}</p>}
                  {post.tags.length > 0 && (
                    <ul role="list" aria-label="Topics" className="flex flex-wrap gap-1.5">
                      {post.tags.map((tag) => (
                        <li key={tag}>
                          <Link
                            to={`/blog?tag=${encodeURIComponent(tag)}`}
                            className="block rounded-full bg-ui-warm px-2.5 py-1 text-xs capitalize text-ui-ink-2 hover:bg-ui-warm-strong hover:text-ui-ink"
                          >
                            {tag}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </header>

            {post.cover && (
              <div className="mt-8 aspect-[1.9/1] overflow-hidden rounded-2xl border border-ui-line">
                <PostCover post={post} />
              </div>
            )}

            <div className="mt-10">
              <MarkdownBody markdown={post.body} />
            </div>
          </article>

          {more.length > 0 && (
            <section aria-labelledby="more-title" className="mx-auto mt-24 max-w-6xl border-t border-ui-line pt-10">
              <h2 id="more-title" className="text-xl font-medium text-ui-ink">
                More posts
              </h2>
              <ul role="list" className="mt-6 grid gap-x-8 gap-y-12 sm:grid-cols-2">
                {more.map((other) => (
                  <li key={other.slug}>
                    <PostCard post={other} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="mx-auto mt-16 max-w-[680px]">
            <Link to="/blog" className={BACK_LINK}>
              ← All posts
            </Link>
          </div>
        </main>
      )}
    </div>
  );
}
