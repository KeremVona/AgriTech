import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BLOG_POSTS } from '../content/blogPosts.ts';
import { allTags } from '../utils/blogPosts.ts';
import { AppHeader } from '../components/ui/AppHeader.tsx';
import { FeaturedPostCard, PostCard } from '../components/Blog/PostCard.tsx';

const TAGS = allTags(BLOG_POSTS);

const chip = (active: boolean) =>
  `shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm capitalize transition-colors focus-visible:outline-2 focus-visible:outline-ui-accent ${
    active ? 'bg-ui-ink text-white' : 'text-ui-ink-2 hover:bg-ui-warm hover:text-ui-ink'
  }`;

export function BlogIndexPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tag = searchParams.get('tag');
  const activeTag = tag && TAGS.includes(tag) ? tag : null;
  const posts = activeTag ? BLOG_POSTS.filter((post) => post.tags.includes(activeTag)) : BLOG_POSTS;
  const [featured, ...rest] = posts;

  useEffect(() => {
    document.title = 'Blog · AgriTech';
  }, []);

  return (
    <div className="ui-page min-h-screen antialiased">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ui-ink focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <AppHeader />

      <main id="main" className="mx-auto max-w-6xl px-4 pb-24 pt-12 sm:px-6 sm:pt-16">
        <h1 className="text-[40px] font-medium leading-[1.05] tracking-[-0.03em] text-ui-ink sm:text-6xl">Blog</h1>
        <p className="mt-3 max-w-xl text-[17px] leading-relaxed text-ui-ink-2">Notes from building AgriTech: the models, the maps and the field data.</p>

        {TAGS.length > 1 && (
          <nav aria-label="Filter by topic" className="-mx-4 mt-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <ul role="list" className="flex gap-1 border-b border-ui-line pb-3">
              <li>
                <button type="button" className={chip(!activeTag)} aria-pressed={!activeTag} onClick={() => setSearchParams({}, { replace: true })}>
                  All
                </button>
              </li>
              {TAGS.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    className={chip(activeTag === name)}
                    aria-pressed={activeTag === name}
                    onClick={() => setSearchParams({ tag: name }, { replace: true })}
                  >
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {featured ? (
          <>
            <section aria-label="Latest post" className="mt-10">
              <FeaturedPostCard post={featured} />
            </section>
            {rest.length > 0 && (
              <section aria-label="More posts" className="mt-16 border-t border-ui-line pt-10">
                <ul role="list" className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((post) => (
                    <li key={post.slug}>
                      <PostCard post={post} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : (
          <p className="mt-16 rounded-2xl bg-ui-warm px-6 py-12 text-center text-ui-ink-2">No posts yet.</p>
        )}
      </main>
    </div>
  );
}
