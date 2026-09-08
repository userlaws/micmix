import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await build({ entryPoints: ['src/main.ts', 'src/preload.ts'], bundle: true, platform: 'node', format: 'cjs', outdir: 'dist', outExtension: { '.js': '.cjs' }, external: ['electron'], sourcemap: true });
await build({ entryPoints: ['src/ui.tsx', 'src/audio-worker.ts'], bundle: true, platform: 'browser', outdir: 'dist', sourcemap: true });
await Promise.all(['index.html', 'audio.html'].map(name => copyFile('src/' + name, 'dist/' + name)));
