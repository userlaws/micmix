import { PAD_COUNT, type AudioCommand, type MixerSettings, type SoundPad, type LocalTrack } from './shared';
import { validAccelerator } from './hotkeys';
export function validSettings(value: unknown): value is MixerSettings {
  if (!value || typeof value !== 'object') return false;
  const s = value as MixerSettings;
  return ['mic', 'music', 'soundboard', 'master'].every(key => {
    const k = key as keyof MixerSettings['levels'];
    return Number.isFinite(s.levels?.[k]) && s.levels[k] >= 0 && s.levels[k] <= 1 && typeof s.muted?.[k] === 'boolean';
  }) && ['ducking', 'mono', 'monitor', 'monitorMic'].every(key => typeof s[key as keyof MixerSettings] === 'boolean') &&
    Number.isFinite(s.duckThreshold) && s.duckThreshold >= -60 && s.duckThreshold <= -10 &&
    Number.isFinite(s.duckDb) && s.duckDb >= -30 && s.duckDb <= 0 &&
    Number.isFinite(s.monitorVolume) && s.monitorVolume >= 0 && s.monitorVolume <= 1 &&
    Number.isFinite(s.monitorMusicVolume) && s.monitorMusicVolume >= 0 && s.monitorMusicVolume <= 1;
}
export function validTrack(value: unknown): value is LocalTrack {
  const t = value as LocalTrack;
  if (!t || typeof t !== 'object' || typeof t.id !== 'string' || typeof t.title !== 'string' || t.title.length > 500 || typeof t.url !== 'string') return false;
  if (t.youtubeId !== undefined) return /^[\w-]{11}$/.test(t.youtubeId) && t.url === 'https://www.youtube.com/watch?v=' + t.youtubeId;
  return /^file:\/\/\/.+\.(mp3|wav|flac|ogg)$/i.test(t.url);
}
export function validPad(value: unknown): value is SoundPad {
  const p = value as SoundPad;
  return !!p && typeof p === 'object' && Number.isInteger(p.slot) && p.slot >= 0 && p.slot < PAD_COUNT &&
    typeof p.id === 'string' && typeof p.title === 'string' && p.title.length <= 300 &&
    typeof p.url === 'string' && /^file:\/\/\/.+\.(mp3|wav|flac|ogg)$/i.test(p.url) && (p.hotkey === null || validAccelerator(p.hotkey));
}
export function validPads(value: unknown): value is (SoundPad | null)[] {
  return Array.isArray(value) && value.length === PAD_COUNT && value.every((pad, slot) => pad === null || (validPad(pad) && pad.slot === slot));
}
export function validCommand(value: unknown): value is AudioCommand {
  if (!value || typeof value !== 'object') return false;
  const c = value as AudioCommand;
  switch (c.type) {
    case 'start': return typeof c.deviceId === 'string' && c.deviceId.length > 0 && c.deviceId.length <= 512 &&
      (c.monitorId === undefined || (typeof c.monitorId === 'string' && c.monitorId.length <= 512));
    case 'stop': case 'tone': case 'play': case 'pause': case 'next': case 'clear': case 'stopPads': return true;
    case 'settings': return validSettings(c.settings);
    case 'enqueue': return Array.isArray(c.tracks) && c.tracks.length > 0 && c.tracks.length <= 200 &&
      c.tracks.every(t => t && typeof t.id === 'string');
    case 'select': case 'remove': return Number.isInteger(c.index) && c.index >= 0;
    case 'seek': return Number.isFinite(c.seconds) && c.seconds >= 0;
    case 'pads': return validPads(c.pads);
    case 'pad': return Number.isInteger(c.slot) && c.slot >= 0 && c.slot < PAD_COUNT;
    default: return false;
  }
}
