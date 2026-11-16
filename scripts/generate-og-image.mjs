#!/usr/bin/env node
/**
 * One-off generator for public/static/img/root/og-image.png — a proper
 * 1200x630 social-preview image. Run again by hand if the tagline/colors
 * ever need to change; not wired into the build (it's a static output, not
 * something that needs to regenerate per-build like optimize-media.mjs).
 */
import sharp from 'sharp';

const WIDTH = 1200;
const HEIGHT = 630;

const svg = `
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#201f42" />
      <stop offset="100%" stop-color="#4412c5" />
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)" />
  <circle cx="1080" cy="80" r="260" fill="#5bcdbe" opacity="0.12" />
  <circle cx="120" cy="560" r="200" fill="#9280ff" opacity="0.14" />
  <text x="90" y="330" font-family="Arial, sans-serif" font-size="64" font-weight="700" fill="#fbf3da">
    Most agencies build pages.
  </text>
  <text x="90" y="404" font-family="Arial, sans-serif" font-size="64" font-weight="700" fill="#5bcdbe">
    We build your digital peace of mind.
  </text>
  <text x="90" y="468" font-family="Arial, sans-serif" font-size="26" font-weight="400" fill="#ece9ff">
    Websites · Marketing · Automation
  </text>
  <text x="90" y="560" font-family="Arial, sans-serif" font-size="22" font-weight="600" fill="#9280ff" letter-spacing="2">
    AHDESIGN.WEBSITE
  </text>
</svg>
`;

const logo = await sharp('public/static/img/root/logoAH.png').resize({ height: 90 }).toBuffer();

await sharp(Buffer.from(svg))
  .composite([{ input: logo, left: 90, top: 70 }])
  .png({ compressionLevel: 9 })
  .toFile('public/static/img/root/og-image.png');

console.log('Wrote public/static/img/root/og-image.png');
