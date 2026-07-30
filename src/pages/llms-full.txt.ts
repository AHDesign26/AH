import type { APIRoute } from 'astro';
import { getCollection, getEntry } from 'astro:content';
import { llmsIndex, stripHtml } from '../lib/llms';
import { SITE } from '../lib/seo';

/**
 * llms.txt plus the full text of every blog post, so an assistant can answer
 * from the articles without fetching each page.
 */
export const GET: APIRoute = async () => {
  // Skip scraped duplicates; they canonicalise to another post.
  const posts = (await getCollection('blog'))
    .filter((p) => !p.data.canonical_slug)
    .sort((a, b) => b.data.published_date.localeCompare(a.data.published_date));

  const index = llmsIndex(
    posts.map((p) => ({
      slug: p.data.slug,
      title: p.data.title,
      brief: p.data.brief || p.data.meta_desc,
    })),
  );

  const articles = await Promise.all(
    posts.map(async (post) => {
      const author = post.data.author_slug
        ? await getEntry('authors', post.data.author_slug)
        : null;
      const meta = [
        `URL: ${SITE.url}/post/${post.data.slug}`,
        `Published: ${post.data.published_date}`,
        author ? `Author: ${author.data.name}` : null,
        post.data.category_title ? `Category: ${post.data.category_title}` : null,
      ].filter(Boolean);

      return [
        `## ${post.data.title}`,
        post.data.subtitle ?? null,
        '',
        meta.join('\n'),
        '',
        stripHtml(post.data.body_html),
      ]
        .filter((part) => part !== null)
        .join('\n');
    }),
  );

  const body = `${index}\n---\n\n# Full article text\n\n${articles.join('\n\n---\n\n')}\n`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
