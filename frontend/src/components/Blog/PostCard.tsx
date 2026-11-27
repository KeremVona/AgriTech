import { Link } from 'react-router-dom';
import { formatPostDate, type BlogPost } from '../../utils/blogPosts.ts';
import { LeafMark } from '../Landing/primitives.tsx';

/** Cover image, or a quiet tile when the post has none. */
export function PostCover({ post, className = '' }: { post: BlogPost; className?: string }) {
  if (post.cover) {
    return <img src={post.cover} alt="" loading="lazy" className={`h-full w-full object-cover ${className}`} />;
  }
  return (
    <div aria-hidden="true" className={`flex h-full w-full items-center justify-center bg-ui-accent-soft ${className}`}>
      <LeafMark className="h-14 w-14 opacity-80" />
    </div>
  );
}

function Meta({ post }: { post: BlogPost }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-ui-ink-3">
      {post.tags[0] && <span className="font-medium capitalize text-ui-accent-hover">{post.tags[0]}</span>}
      {post.tags[0] && post.date && <span aria-hidden="true">·</span>}
      {post.date && <time dateTime={post.date}>{formatPostDate(post.date)}</time>}
      {post.draft && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">Draft</span>}
    </p>
  );
}

const CARD_LINK =
  'group block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ui-accent';

export function PostCard({ post }: { post: BlogPost }) {
  return (
    <Link to={`/blog/${post.slug}`} className={CARD_LINK}>
      <div className="aspect-[1.9/1] overflow-hidden rounded-2xl border border-ui-line">
        <PostCover post={post} className="transition-transform duration-300 group-hover:scale-[1.02]" />
      </div>
      <div className="mt-4">
        <Meta post={post} />
        <h3 className="mt-1.5 text-lg font-medium leading-snug tracking-[-0.01em] text-ui-ink group-hover:underline group-hover:underline-offset-4">
          {post.title}
        </h3>
        {post.description && <p className="mt-1.5 line-clamp-2 text-[15px] leading-relaxed text-ui-ink-2">{post.description}</p>}
      </div>
    </Link>
  );
}

/** The newest post: wide, image beside the text on large screens. */
export function FeaturedPostCard({ post }: { post: BlogPost }) {
  return (
    <Link to={`/blog/${post.slug}`} className={`${CARD_LINK} grid items-center gap-6 lg:grid-cols-[1.25fr_1fr] lg:gap-10`}>
      <div className="aspect-[1.9/1] overflow-hidden rounded-2xl border border-ui-line">
        <PostCover post={post} className="transition-transform duration-300 group-hover:scale-[1.02]" />
      </div>
      <div>
        <Meta post={post} />
        <h2 className="mt-2 text-[28px] font-medium leading-[1.15] tracking-[-0.02em] text-ui-ink group-hover:underline group-hover:underline-offset-4 sm:text-[34px]">
          {post.title}
        </h2>
        {post.description && <p className="mt-3 text-[17px] leading-relaxed text-ui-ink-2">{post.description}</p>}
        <p className="mt-4 text-sm text-ui-ink-3">{post.readingMinutes} min read</p>
      </div>
    </Link>
  );
}
