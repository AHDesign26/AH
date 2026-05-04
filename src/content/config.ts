import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    slug: z.string(),
    title: z.string(),
    subtitle: z.string().nullable().optional(),
    published_date: z.string(),
    published_date_raw: z.string(),
    published_date_day: z.string(),
    published_date_month: z.string(),
    category_slug: z.string().nullable(),
    category_title: z.string().nullable(),
    author_slug: z.string().nullable(),
    author_id: z.number().nullable(),
    hero_image: z.string().nullable(),
    hero_alt: z.string().default(''),
    thumbnail: z.string().nullable(),
    thumbnail_alt: z.string().default(''),
    brief: z.string().default(''),
    meta_title: z.string(),
    meta_desc: z.string().default(''),
    original_url: z.string().nullable(),
    body_html: z.string(),
  }),
});

const authors = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/authors' }),
  schema: z.object({
    id: z.number(),
    slug: z.string(),
    name: z.string(),
    position: z.string().nullable().optional(),
    bio_html: z.string().default(''),
    photo: z.string().nullable(),
    photo_alt: z.string().default(''),
  }),
});

const categories = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/categories' }),
  schema: z.object({
    slug: z.string(),
    title: z.string(),
  }),
});

export const collections = { blog, authors, categories };
