import { build } from 'esbuild';
import { mkdir, copyFile, readdir } from 'node:fs/promises';
await mkdir('dist/brand', { recursive: true });
await build({ entryPoints: ['src/main.ts', 'src/preload.ts', 'src/youtube-preload.ts', 'src/youtube-search-preload.ts'], bundle: true, platform: 'node', format: 'cjs', outdir: 'dist', outExtension: { '.js': '.cjs' }, external: ['electron'], sourcemap: true });
await build({ entryPoints: ['src/ui.tsx', 'src/audio-worker.ts'], bundle: true, platform: 'browser', outdir: 'dist', sourcemap: true });
await build({ entryPoints: ['src/phase2-checks.ts', 'src/phase3-checks.ts'], bundle: true, platform: 'browser', format: 'esm', outdir: 'dist' });
await Promise.all(['index.html', 'audio.html'].map(name => copyFile('src/' + name, 'dist/' + name)));
// Brand assets (logo mark, About artwork, window icon) are static files referenced by relative path; the CSP forbids data: URIs.
await Promise.all((await readdir('src/brand')).map(name => copyFile('src/brand/' + name, 'dist/brand/' + name)));
