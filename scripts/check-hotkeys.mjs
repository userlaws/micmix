import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import electron from 'electron';
// Seeds an isolated profile with setup already completed, then runs scripts/smoke-hotkeys.cjs in it.
const userData = mkdtempSync(path.join(tmpdir(), 'micmix-hotkeys-'));
writeFileSync(path.join(userData, 'config.json'), JSON.stringify({ version: 1, setupDone: true }));
const env = { ...process.env, MICMIX_USERDATA: userData };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ['.', '--smoke-hotkeys'], { env, stdio: 'inherit', windowsHide: false });
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
