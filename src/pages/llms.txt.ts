import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { llmsIndex } from '../lib/llms';

export const GET: APIRoute = async () => {
  // Skip scraped duplicates; they canonicalise to another post.
  const posts = (await getCollection('blog'))
    .filter((p) => !p.data.canonical_slug)
    .sort((a, b) => b.data.published_date.localeCompare(a.data.published_date))
    .map((p) => ({
      slug: p.data.slug,
      title: p.data.title,
      brief: p.data.brief || p.data.meta_desc,
    }));

  return new Response(llmsIndex(posts), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
