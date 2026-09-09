// Edit these to point the site at your real release.
export const site = {
  name: 'MicMix',
  // Injected from the root package.json at build time (VITE_APP_VERSION); the fallback is only for odd local runs.
  version: import.meta.env?.VITE_APP_VERSION || '1.0.0',
  // Public origin of this site, no trailing slash: canonical URL, Open Graph, sitemap.xml, robots.txt.
  // The GitHub Pages workflow overrides it with SITE_URL, so this default only matters for local builds.
  siteUrl: 'https://userlaws.github.io/micmix',
  title: 'MicMix - Play music through your mic in Discord, FiveM and any voice chat',
  description:
    'MicMix mixes your microphone with YouTube, local music and a soundboard into one virtual mic for Windows. Free, no account, works in Discord, FiveM, Teams and games.',
  keywords: ['play music through mic', 'virtual microphone', 'Discord music', 'FiveM music', 'soundboard', 'YouTube through mic', 'Windows'],
  ogImage: '/brand/og-image.png',
  ogImageWidth: 1200,
  ogImageHeight: 630,
  // "Download for Windows" always points at the newest GitHub Release asset, so every release is live at once.
  downloadUrl: import.meta.env?.VITE_DOWNLOAD_URL || 'https://github.com/userlaws/micmix/releases/latest/download/MicMix-Setup.exe',
  releasesUrl: import.meta.env?.VITE_RELEASES_URL || 'https://github.com/userlaws/micmix/releases',
  supportEmail: 'aracenajake@gmail.com',
  donateUrl: 'https://shop.vb-audio.com/en/win-apps/11-vb-cable.html',
  vbAudioUrl: 'https://vb-audio.com/Cable/',
};
