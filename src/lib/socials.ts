import data from '../data/socials.json';

/**
 * Social links, edited at /admin under "Site settings".
 *
 * One source for the header menu, the footer, the homepage hero and the
 * schema.org sameAs list, so adding or removing a profile is a single change
 * in the CMS rather than an edit in five templates. A blank URL removes the
 * link everywhere instead of leaving a dead one behind.
 */

export interface Social {
  key: string;
  /** Footer wording. */
  name: string;
  /** The two-letter form the header and hero rows use. */
  short: string;
  url: string;
}

/** Display order, and the only keys the CMS form offers. */
const PROFILES: { key: keyof typeof data; name: string; short: string }[] = [
  { key: 'facebook', name: 'Facebook', short: 'FB' },
  { key: 'instagram', name: 'Instagram', short: 'IG' },
  { key: 'linkedin', name: 'LinkedIn', short: 'IN' },
  { key: 'youtube', name: 'YouTube', short: 'YT' },
];

/** Profiles that have a URL set, in display order. */
export const socials: Social[] = PROFILES.map((p) => ({
  ...p,
  key: p.key,
  url: (data[p.key] ?? '').trim(),
})).filter((s) => s.url !== '');

/** Rendered separately: it sits with the phone number, not the profile list. */
export const whatsappUrl: string = (data.whatsapp ?? '').trim();

/** Absolute profile URLs for schema.org sameAs. */
export const socialUrls: string[] = socials.map((s) => s.url);
