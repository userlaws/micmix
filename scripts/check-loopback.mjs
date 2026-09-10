import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
// Generates the loopback fixtures in pure Node (no FFmpeg), then runs the real-cable measurement.
mkdirSync('artifacts', { recursive: true });
const RATE = 48000, FFT = 32768, BIN = RATE / FFT;
// Log-spaced tones snapped to FFT bin centres so every tone lands on one analyser bin.
const wanted = [50, 80, 125, 200, 315, 500, 800, 1000, 1600, 2500, 4000, 6300, 8000, 10000, 12500, 16000, 18000];
const tones = wanted.map(f => Math.round(f / BIN) * BIN);
function wav(samples) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + samples.length * 4, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(3, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24); header.writeUInt32LE(RATE * 4, 28); header.writeUInt16LE(4, 32); header.writeUInt16LE(32, 34);
  header.write('data', 36); header.writeUInt32LE(samples.length * 4, 40);
  return Buffer.concat([header, Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength)]);
}
const multitone = new Float32Array(RATE * 6);
let peak = 0;
for (let i = 0; i < multitone.length; i++) {
  let v = 0;
  for (let t = 0; t < tones.length; t++) v += 0.05 * Math.sin(2 * Math.PI * tones[t] * i / RATE + t * 2.399);
  multitone[i] = v; peak = Math.max(peak, Math.abs(v));
}
if (peak > 0.7) throw new Error('Multitone peak ' + peak + ' is too close to the limiter; change the phases.');
const sine = new Float32Array(RATE * 4);
for (let i = 0; i < sine.length; i++) sine[i] = 0.25 * Math.sin(2 * Math.PI * 1000 * i / RATE);
writeFileSync('artifacts/loopback-tones.wav', wav(multitone));
writeFileSync('artifacts/loopback-1k.wav', wav(sine));
writeFileSync('artifacts/loopback-plan.json', JSON.stringify({ rate: RATE, fft: FFT, tones, toneAmplitude: 0.05, multitonePeak: peak, sineAmplitude: 0.25 }, null, 2));
const result = spawnSync(process.execPath, ['scripts/start.mjs', '--smoke-loopback'], { stdio: 'inherit', windowsHide: false });
process.exitCode = result.status ?? 1;
