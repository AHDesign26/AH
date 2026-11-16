import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SITE } from '../lib/seo';

export const GET: APIRoute = async (context) => {
  // canonical_slug posts are duplicates of another entry — see blog.astro.
  const posts = (await getCollection('blog'))
    .filter((post) => !post.data.canonical_slug)
    .sort((a, b) => b.data.published_date.localeCompare(a.data.published_date));

  return rss({
    title: `${SITE.name} blog`,
    description: SITE.description,
    site: context.site ?? SITE.url,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.brief || post.data.meta_desc,
      pubDate: new Date(post.data.published_date),
      link: `/post/${post.data.slug}/`,
      content: post.data.body_html,
    })),
    customData: `<language>${SITE.lang}</language>`,
  });
};
