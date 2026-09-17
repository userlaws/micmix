import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import electron from 'electron';
// Seeds an isolated profile with setup already completed (so the first-run wizard does not cover
// the video slot), then runs scripts/smoke-autoplay.cjs in it. Silent: master and mic are 0.
const userData = mkdtempSync(path.join(tmpdir(), 'micmix-autoplay-'));
writeFileSync(path.join(userData, 'config.json'), JSON.stringify({ version: 1, setupDone: true }));
const env = { ...process.env, MICMIX_USERDATA: userData };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ['.', '--smoke-autoplay'], { env, stdio: 'inherit', windowsHide: false });
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
