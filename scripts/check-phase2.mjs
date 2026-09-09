import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
// FFmpeg is a development-only fixture generator, never an app dependency.
mkdirSync('artifacts', { recursive: true });
function ffmpeg(args) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit', windowsHide: true });
  if (result.error) throw new Error('Phase 2 codec tests require FFmpeg on PATH to generate local test fixtures. MicMix itself does not use FFmpeg.');
  if (result.status !== 0) throw new Error('Could not generate test audio.');
}
ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=330:duration=1.2:sample_rate=48000', '-y', 'artifacts/fixture.wav']);
for (const ext of ['mp3', 'flac', 'ogg']) ffmpeg(['-i', 'artifacts/fixture.wav', '-y', 'artifacts/fixture.' + ext]);
const result = spawnSync(process.execPath, ['scripts/start.mjs', '--smoke-phase2'], { stdio: 'inherit', windowsHide: false });
process.exitCode = result.status ?? 1;
