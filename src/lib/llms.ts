/**
 * Shared content for /llms.txt and /llms-full.txt.
 *
 * llms.txt is a curated, link-first map of the site for AI assistants
 * (https://llmstxt.org). Keep the prose here in sync with the pages it
 * describes, prices especially, since assistants will quote them.
 */

import { SITE, absoluteUrl } from './seo';

export interface PageEntry {
  path: string;
  title: string;
  summary: string;
}

export const KEY_PAGES: PageEntry[] = [
  {
    path: '/',
    title: 'Home',
    summary:
      'Overview of AH Design: website design and development, digital marketing and advertising, and business development.',
  },
  {
    path: '/services',
    title: 'Services',
    summary:
      'The three service lines in detail: websites and web apps, digital marketing and SEO, business scaling.',
  },
  {
    path: '/web_development',
    title: 'Website Design & Development',
    summary:
      'Responsive websites, e-commerce, custom web applications, CMS builds, QA and testing.',
  },
  {
    path: '/ads-service',
    title: 'Advertising Solutions',
    summary:
      'Paid advertising and campaign production: audio and video materials, digital and offline events.',
  },
  {
    path: '/migration',
    title: 'Migration: move off monthly fees',
    summary:
      'One-time EUR 700 service that rebuilds an existing Wix, Squarespace, GoDaddy or WordPress site on infrastructure the client owns, so the monthly bill goes to zero.',
  },
  {
    path: '/price',
    title: 'Prices',
    summary: 'Published starting prices for one-off website packages and monthly growth packages.',
  },
  {
    path: '/projects',
    title: 'Projects',
    summary: 'Portfolio of delivered client websites and brands.',
  },
  {
    path: '/about-us',
    title: 'About us',
    summary: 'Who AH Design is, how the team works, and the delivery process.',
  },
  {
    path: '/fricta',
    title: 'Fricta: Operational Intelligence',
    summary:
      'Sub-brand for operational audits, AI workflow systems, process optimisation and custom internal tools.',
  },
  {
    path: '/contact',
    title: 'Contact',
    summary: `Contact form, email ${SITE.email}, phone ${SITE.phoneDisplay}.`,
  },
  {
    path: '/blog',
    title: 'Blog',
    summary: 'Articles on web design, SEO and launching a website.',
  },
  {
    path: '/privacy',
    title: 'Privacy Policy',
    summary:
      'What personal data the contact and order forms collect, who processes it, and GDPR rights.',
  },
];

export interface Package {
  name: string;
  /** Starting price in EUR, or null when the tier is quoted individually. */
  amount: number | null;
  desc: string;
}

/**
 * Mirrors the cards on /price, and feeds both llms.txt and the OfferCatalog
 * structured data on that page. Update these together with the markup.
 */
export const WEBSITE_PACKAGES: Package[] = [
  {
    name: 'The One',
    amount: 500,
    desc: 'A focused single-page presence to get you online fast. Statically built, no CMS; content changes are handled by us at EUR 50/hour.',
  },
  {
    name: 'The Move',
    amount: 700,
    desc: 'You already have a site. We move it off the subscription: up to 8 pages rebuilt statically, form, email routing, redirects, domain and accounts transferred into your name.',
  },
  {
    name: 'The Core',
    amount: 1200,
    desc: 'A complete multi-page site with full CMS handover. Most popular.',
  },
  {
    name: 'The Growth',
    amount: 2500,
    desc: 'A scalable site with dynamic content and integrations.',
  },
  {
    name: 'The Infinite',
    amount: null,
    desc: 'A bespoke platform with e-commerce and ongoing support.',
  },
];

export const GROWTH_PACKAGES: Package[] = [
  { name: 'Starter Visibility', amount: 150, desc: 'Get found, get noticed, and start winning.' },
  {
    name: 'Digital Authority',
    amount: 300,
    desc: 'Establish credibility and convert visitors into loyal clients. Most popular.',
  },
  {
    name: 'Scale & Automate',
    amount: 500,
    desc: 'Eliminate manual tasks and fuel rapid expansion.',
  },
  {
    name: 'The Growth Engine',
    amount: null,
    desc: 'Your dedicated partner for end-to-end success.',
  },
];

export function priceLabel(pkg: Package, monthly: boolean): string {
  if (pkg.amount === null) return 'custom pricing';
  return `from ${pkg.amount} EUR${monthly ? '/month' : ''}`;
}

const OVERVIEW = `> ${SITE.description}

AH Design is a digital agency working in English and Bulgarian, serving clients
in Bulgaria and across Europe. Three service lines: website design and
development, digital marketing and paid advertising, and business development
and automation. Contact: ${SITE.email}, ${SITE.phoneDisplay}.`;

function pageList(pages: PageEntry[]): string {
  return pages.map((p) => `- [${p.title}](${absoluteUrl(p.path)}): ${p.summary}`).join('\n');
}

function packageList(items: Package[], monthly: boolean): string {
  return items.map((p) => `- ${p.name}, ${priceLabel(p, monthly)}. ${p.desc}`).join('\n');
}

/** The llms.txt body: overview, key pages, pricing, then blog links. */
export function llmsIndex(posts: { slug: string; title: string; brief: string }[]): string {
  return `# ${SITE.name}

${OVERVIEW}

## Key pages

${pageList(KEY_PAGES)}

## Website packages (one-off)

${packageList(WEBSITE_PACKAGES, false)}

## Growth packages (monthly retainer)

${packageList(GROWTH_PACKAGES, true)}

Prices are starting points; individual quotes are provided for specific
requirements. Ordering and enquiries: ${absoluteUrl('/contact')}

## Blog posts

${posts.map((p) => `- [${p.title}](${absoluteUrl(`/post/${p.slug}`)}): ${truncate(p.brief, 160)}`).join('\n')}
`;
}

/** Collapse HTML to readable plain text for llms-full.txt. */
export function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}
