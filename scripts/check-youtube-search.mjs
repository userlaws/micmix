import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import electron from 'electron';
await mkdir('artifacts/search-check', { recursive: true });
await build({ entryPoints: ['src/youtube-results.ts', 'src/youtube-search.ts', 'src/youtube-fuzzy.ts'], bundle: true, platform: 'node', format: 'cjs', outdir: 'artifacts/search-check', outExtension: { '.js': '.cjs' }, external: ['electron'] });
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
async function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: 'inherit', windowsHide: true });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error('Search check exited with ' + code)));
  });
}
await run(process.execPath, ['scripts/test-youtube-search.cjs']);
await run(electron, ['.', '--smoke-youtube-search']);
