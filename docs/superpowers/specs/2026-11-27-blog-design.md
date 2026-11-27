# Blog — design

Date: 2026-11-27 · Branch: `feat/blog` · Routes: `/blog`, `/blog/:slug`

## Intent

A blog for the project, written as Markdown files. Adding a `.md` file to the posts folder publishes it. No list to
edit, no backend. Look and feel follow the Notion blog (notion.com/blog) and the rest of the redesigned app: calm, lots
of white space, little text on the index.

## How posts are found

- Posts live in `frontend/src/content/blog/*.md`.
- `src/content/blogPosts.ts` loads them with Vite `import.meta.glob('./blog/*.md', { query: '?raw', eager: true })`.
  In dev a new file appears after a page refresh; production picks it up on the next build. Nothing else to register.
- The slug is the file name: `plant-disease-classifier.md` → `/blog/plant-disease-classifier`.
- Parsing (front matter, reading time, sorting) is plain code in `src/utils/blogPosts.ts`, so Node tests can check it.

## Front matter

```yaml
---
title: "Post title"            # required (falls back to the first # heading)
description: "One sentence."   # shown on cards and under the title
date: 2026-10-30               # required, YYYY-MM-DD; newest first
tags: [machine learning, agriculture]   # first tag is the card label
author: "Name"                 # optional
cover: /blog/my-cover.webp     # optional image in public/blog/; a plain tile is drawn otherwise
draft: true                    # optional; shown in dev with a "Draft" badge, hidden in production builds
---
```

A draft is hidden from the pages, not removed: its text is still in the JavaScript bundle (and in the public repo).

A leading `# Title` that repeats the title is dropped, since the page already shows it.

## Pages

- **Index (`/blog`):**
  - The shared `AppHeader`, then the title "Blog" and a single line about what the blog covers.
  - Tag chips: "All" plus each tag, kept in `?tag=` so a filtered view can be linked.
  - The newest post is shown as a wide featured card. The others follow in a 1, 2 or 3-column grid, depending on screen width.
  - Each card shows the cover (or a plain tile), the first tag, the title, the description and the date, with no other text.
- **Post (`/blog/:slug`):**
  - Above the body:
    - an "← All posts" link
    - "date · N min read"
    - the title
    - the description in larger grey text
    - the author and tags
    - the cover, if the post has one
  - The body is a column about 680px wide. Headings, lists, tables, quotes, code and images are styled in
    `components/Blog/blog.css` using the `ui-*` tokens. Tables scroll sideways on phones.
  - At the end: "More posts" (up to two others) and a back link.
  - An unknown slug shows a short "Post not found" message with a link back.
- **Navigation:** "Blog" is added to the app header, the landing nav and the landing footer.

## Not doing

- No comments, newsletter, share buttons, search or pagination. Add pagination only once there are many posts.
- No CMS or backend.
- Markdown is rendered with `marked` (GFM). Posts are our own files, so the HTML is trusted.
