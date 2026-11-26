import { socialUrls } from './socials';

/**
 * Single source of truth for site-level SEO data and the JSON-LD builders used
 * by BaseLayout and the content pages.
 *
 * The Organization entity is intentionally NOT typed as LocalBusiness /
 * ProfessionalService: Google requires a postal `address` for those, and we
 * don't publish one. Once there is a public address, switch `@type` to
 * ['Organization', 'ProfessionalService'] and add `address` to become eligible
 * for local rich results.
 */

export const SITE = {
  url: 'https://ahdesign.website',
  name: 'AH Design',
  shortName: 'AH-design',
  description:
    'AH Design builds fast, responsive websites and runs digital marketing, SEO and paid advertising for businesses in Bulgaria and across Europe.',
  locale: 'en_US',
  lang: 'en',
  email: 'info@ahdesign.website',
  /** E.164, used for schema.org and tel: links. */
  phone: '+359887786022',
  phoneDisplay: '(+359) 88 77 86 022',
  logo: '/static/img/root/logoAH-black.png',
  /** Social preview image, 1200x630 — see scripts/generate-og-image.mjs. */
  ogImage: '/static/img/root/og-image.png',
} as const;

/**
 * Absolute URL for a site-relative path.
 *
 * Page URLs get a trailing slash because that is what Cloudflare Pages serves:
 * the directory-format build makes /about-us 308-redirect to /about-us/. A
 * canonical or sitemap entry that redirects gets ignored, so these have to
 * match. Paths whose last segment has a file extension are left alone.
 */
export function absoluteUrl(path: string): string {
  const url = new URL(path, SITE.url);
  const isFile = /\.[a-z0-9]+$/i.test(url.pathname.split('/').pop() ?? '');
  url.pathname = isFile ? url.pathname : `${url.pathname.replace(/\/+$/, '')}/`;
  return url.href;
}

const ORG_ID = `${SITE.url}/#organization`;
const SITE_ID = `${SITE.url}/#website`;

export function organizationSchema() {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE.name,
    alternateName: SITE.shortName,
    url: SITE.url,
    description: SITE.description,
    email: SITE.email,
    telephone: SITE.phone,
    logo: {
      '@type': 'ImageObject',
      url: absoluteUrl(SITE.logo),
      width: 300,
      height: 300,
    },
    image: absoluteUrl(SITE.ogImage),
    // Only the first names the site publishes anywhere (about-us.astro) —
    // no surnames or titles exist in the site's own content to add here.
    founder: [
      { '@type': 'Person', name: 'Afif', jobTitle: 'Co-Founder, Design & SEO' },
      { '@type': 'Person', name: 'Hamid', jobTitle: 'Co-Founder, Engineering & Automation' },
    ],
    sameAs: socialUrls,
    areaServed: [
      { '@type': 'Country', name: 'Bulgaria' },
      { '@type': 'Place', name: 'Europe' },
    ],
    knowsLanguage: ['en', 'bg'],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales',
      email: SITE.email,
      telephone: SITE.phone,
      availableLanguage: ['English', 'Bulgarian'],
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Digital services',
      itemListElement: [
        'Website design and development',
        'E-commerce and custom web applications',
        'Search engine optimisation',
        'Digital marketing and paid advertising',
        'Business development and automation',
      ].map((name) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name },
      })),
    },
  };
}

export function websiteSchema() {
  return {
    '@type': 'WebSite',
    '@id': SITE_ID,
    url: SITE.url,
    name: SITE.name,
    description: SITE.description,
    inLanguage: SITE.lang,
    publisher: { '@id': ORG_ID },
  };
}

export function webPageSchema(opts: { url: string; title: string; description: string }) {
  return {
    '@type': 'WebPage',
    '@id': `${opts.url}#webpage`,
    url: opts.url,
    name: opts.title,
    description: opts.description,
    inLanguage: SITE.lang,
    isPartOf: { '@id': SITE_ID },
    about: { '@id': ORG_ID },
  };
}

/** Renders alongside an on-page FAQ (`<details>/<summary>` pairs) built from the same Q&A list. */
export function faqSchema(items: { question: string; answer: string }[]) {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

/** `items` is ordered root-first; the last entry is the current page. */
export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function serviceSchema(opts: {
  name: string;
  description: string;
  path: string;
  serviceType?: string;
  /** Fixed price in EUR, for services quoted at a single figure. */
  price?: number;
}) {
  return {
    '@type': 'Service',
    name: opts.name,
    description: opts.description,
    serviceType: opts.serviceType ?? opts.name,
    url: absoluteUrl(opts.path),
    provider: { '@id': ORG_ID },
    areaServed: [
      { '@type': 'Country', name: 'Bulgaria' },
      { '@type': 'Place', name: 'Europe' },
    ],
    ...(opts.price === undefined
      ? {}
      : {
          offers: {
            '@type': 'Offer',
            price: opts.price,
            priceCurrency: 'EUR',
            url: absoluteUrl(opts.path),
            availability: 'https://schema.org/InStock',
          },
        }),
  };
}

export function articleSchema(opts: {
  url: string;
  headline: string;
  description: string;
  datePublished: string;
  image?: string | null;
  authorName?: string | null;
  authorPath?: string | null;
  section?: string | null;
}) {
  return {
    '@type': 'BlogPosting',
    '@id': `${opts.url}#article`,
    mainEntityOfPage: { '@id': `${opts.url}#webpage` },
    url: opts.url,
    headline: opts.headline.slice(0, 110),
    description: opts.description,
    datePublished: opts.datePublished,
    dateModified: opts.datePublished,
    inLanguage: SITE.lang,
    ...(opts.image ? { image: absoluteUrl(opts.image) } : {}),
    ...(opts.section ? { articleSection: opts.section } : {}),
    author: opts.authorName
      ? {
          '@type': 'Person',
          name: opts.authorName,
          ...(opts.authorPath ? { url: absoluteUrl(opts.authorPath) } : {}),
        }
      : { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
  };
}

/**
 * ISO-8601 date for schema.org from the blog front matter, which stores
 * `published_date` as `YYYY-MM-DD` (or an empty string on a few old posts).
 */
export function isoDate(raw: string | null | undefined): string {
  if (!raw) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  return match ? match[0] : '';
}
