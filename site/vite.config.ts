import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import { site } from './src/site-config';
import { FAQ } from './src/content/faq';

// GitHub Pages serves project sites under /<repo>/; the deploy workflow passes the base path and public URL.
const base = ((process.env.VITE_BASE ?? '').replace(/\/+$/, '') || '') + '/';
const siteUrl = (process.env.SITE_URL || site.siteUrl).replace(/\/+$/, '');
const appVersion = process.env.VITE_APP_VERSION || JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const abs = (path: string) => siteUrl + path;

// Injects title, description, canonical, Open Graph, Twitter and JSON-LD into index.html at
// build time, and emits robots.txt + sitemap.xml, all from src/site-config.ts and src/content/faq.ts.
function seo(): Plugin {
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: site.name,
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Windows 10, Windows 11',
      softwareVersion: appVersion,
      description: site.description,
      image: abs(site.ogImage),
      url: siteUrl,
      downloadUrl: site.downloadUrl.startsWith('http') ? site.downloadUrl : abs('/#download'),
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      featureList: [
        'Play YouTube audio through your microphone',
        'Play MP3, WAV, FLAC and OGG files with a queue',
        'Automatic music ducking when you speak',
        'Soundboard with global hotkeys',
        'Headphone monitoring and built-in limiter',
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: site.name,
      url: siteUrl,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ];
  const tags = [
    `<title>${esc(site.title)}</title>`,
    `<meta name="description" content="${esc(site.description)}" />`,
    `<meta name="keywords" content="${esc(site.keywords.join(', '))}" />`,
    `<meta name="robots" content="index, follow, max-image-preview:large" />`,
    `<link rel="canonical" href="${siteUrl}/" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(site.name)}" />`,
    `<meta property="og:locale" content="en_US" />`,
    `<meta property="og:url" content="${siteUrl}/" />`,
    `<meta property="og:title" content="${esc(site.title)}" />`,
    `<meta property="og:description" content="${esc(site.description)}" />`,
    `<meta property="og:image" content="${abs(site.ogImage)}" />`,
    `<meta property="og:image:width" content="${site.ogImageWidth}" />`,
    `<meta property="og:image:height" content="${site.ogImageHeight}" />`,
    `<meta property="og:image:alt" content="${esc(site.name + ' logo')}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(site.title)}" />`,
    `<meta name="twitter:description" content="${esc(site.description)}" />`,
    `<meta name="twitter:image" content="${abs(site.ogImage)}" />`,
    `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`,
  ];
  const today = new Date().toISOString().slice(0, 10);
  return {
    name: 'micmix-seo',
    transformIndexHtml(html) {
      return html.replace('<!--seo-->', tags.join('\n    '));
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n\nSitemap: ${abs('/sitemap.xml')}\n`,
      });
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source:
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          `  <url><loc>${siteUrl}/</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>1.0</priority></url>\n` +
          '</urlset>\n',
      });
    },
  };
}

export default defineConfig({
  base,
  define: { 'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion) },
  plugins: [react(), tailwindcss(), seo()],
  server: { port: 5173 },
});
