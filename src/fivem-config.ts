import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
// FiveM keeps its saved console variables in %APPDATA%\CitizenFX\fivem.cfg ("seta" lines) and executes that
// file on every launch. Two of them decide how the CABLE Output stream is treated before it reaches Mumble:
//   voice_enableNoiseSuppression  RNNoise on the mic input (default true). Trained on lone speech; music and a
//                                 full-range mic come out hollow and underwater. Archived by FiveM itself.
//   voice_inBitrate               Opus bitrate, default 48000 constant mono. At 64000 and above FiveM switches
//                                 the encoder to its low-delay music mode. Not archived by FiveM, so the line is
//                                 dropped on exit and MicMix puts it back.
// 96 kbps, not higher: FXServer's built-in Mumble server hard-codes a 144 kbps per-client budget and silently
// drops voice packets over it, counting 32 bytes of overhead per 40 ms packet. 128 kbps would use ~96% of that
// budget and risk choppy voice; 96 kbps uses ~74% and is still twice FiveM's default.
// FiveM rewrites the whole file when it exits, so edits only stick when FiveM is closed. Everything else in the
// file (key binds, profile settings, other convars) is preserved byte for byte.
export const FIVEM_TUNING = { noiseSuppression: false, bitrate: 96000 } as const;
export interface FivemVoiceValues { noiseSuppression: boolean | null; bitrate: number | null }

export function fivemConfigPath(appData = process.env.APPDATA): string | null {
  return appData ? path.join(appData, 'CitizenFX', 'fivem.cfg') : null;
}
const KEYS = { noise: 'voice_enableNoiseSuppression', bitrate: 'voice_inBitrate' } as const;
function lineFor(key: string) { return new RegExp('^\\s*seta?\\s+"?' + key + '"?\\s+"?([^"\\r\\n]*)"?\\s*$', 'i'); }
function setaLine(key: string, value: string) { return 'seta "' + key + '" "' + value + '"'; }

export function readFivemVoice(text: string): FivemVoiceValues {
  const values: FivemVoiceValues = { noiseSuppression: null, bitrate: null };
  for (const line of text.split(/\r?\n/)) {
    const noise = lineFor(KEYS.noise).exec(line);
    if (noise) values.noiseSuppression = !/^(false|0)$/i.test(noise[1].trim());
    const bitrate = lineFor(KEYS.bitrate).exec(line);
    if (bitrate) { const n = Number.parseInt(bitrate[1], 10); values.bitrate = Number.isFinite(n) ? n : null; }
  }
  return values;
}
export function fivemVoiceTuned(text: string): boolean {
  const values = readFivemVoice(text);
  return values.noiseSuppression === FIVEM_TUNING.noiseSuppression && values.bitrate === FIVEM_TUNING.bitrate;
}
// Returns the edited file text. tune=true writes the MicMix values; tune=false puts FiveM's defaults back
// (noise suppression on, bitrate line removed). Line endings follow the file (FiveM writes CRLF).
export function applyFivemVoice(text: string, tune: boolean): string {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const trailing = /\r?\n$/.test(text) || text.length === 0;
  const lines = text.length ? text.split(/\r?\n/) : [];
  if (trailing && lines.length && lines[lines.length - 1] === '') lines.pop();
  const wanted: Array<{ key: string; value: string | null }> = tune
    ? [{ key: KEYS.noise, value: 'false' }, { key: KEYS.bitrate, value: String(FIVEM_TUNING.bitrate) }]
    : [{ key: KEYS.noise, value: 'true' }, { key: KEYS.bitrate, value: null }];
  for (const { key, value } of wanted) {
    const matcher = lineFor(key);
    let found = false;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (!matcher.test(lines[i])) continue;
      if (value === null) { lines.splice(i, 1); continue; }
      if (!found) { lines[i] = setaLine(key, value); found = true; } else lines.splice(i, 1); // keep one copy
    }
    if (!found && value !== null) {
      // Insert in alphabetical position among FiveM's own sorted seta block, or at the end of the file.
      let at = lines.length;
      for (let i = 0; i < lines.length; i++) {
        const m = /^seta\s+"([^"]+)"/.exec(lines[i]);
        if (m && m[1] > key) { at = i; break; } // byte order, like FiveM's own sorted block
      }
      lines.splice(at, 0, setaLine(key, value));
    }
  }
  return lines.join(eol) + (trailing || lines.length ? eol : '');
}
// Reads, edits and atomically rewrites fivem.cfg. Returns null when nothing changed, else the new text.
// The file is handled as latin1 so every byte round-trips exactly, whatever encoding FiveM used.
export function writeFivemVoice(file: string, tune: boolean): string | null {
  if (!existsSync(file)) throw new Error('FiveM settings file not found');
  const text = readFileSync(file, 'latin1');
  const next = applyFivemVoice(text, tune);
  if (next === text) return null;
  const temp = file + '.micmix-tmp';
  writeFileSync(temp, next, 'latin1');
  renameSync(temp, file);
  return next;
}
