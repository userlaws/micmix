import type { AudioCommand, MixerSettings } from './shared';
export function validSettings(value: unknown): value is MixerSettings {
  if (!value || typeof value !== 'object') return false;
  const s = value as MixerSettings;
  return ['mic', 'music', 'soundboard', 'master'].every(key => {
    const k = key as keyof MixerSettings['levels'];
    return Number.isFinite(s.levels?.[k]) && s.levels[k] >= 0 && s.levels[k] <= 1 && typeof s.muted?.[k] === 'boolean';
  }) && ['ducking', 'mono', 'monitor', 'monitorMic'].every(key => typeof s[key as keyof MixerSettings] === 'boolean') &&
    Number.isFinite(s.duckThreshold) && s.duckThreshold >= -60 && s.duckThreshold <= -10 &&
    Number.isFinite(s.duckDb) && s.duckDb >= -30 && s.duckDb <= 0 &&
    Number.isFinite(s.monitorVolume) && s.monitorVolume >= 0 && s.monitorVolume <= 1;
}
export function validCommand(value: unknown): value is AudioCommand {
  if (!value || typeof value !== 'object') return false;
  const c = value as AudioCommand;
  switch (c.type) {
    case 'start': return typeof c.deviceId === 'string' && c.deviceId.length > 0 && c.deviceId.length <= 512 &&
      (c.monitorId === undefined || (typeof c.monitorId === 'string' && c.monitorId.length <= 512));
    case 'stop': case 'tone': case 'play': case 'pause': case 'next': case 'clear': return true;
    case 'settings': return validSettings(c.settings);
    case 'enqueue': return Array.isArray(c.tracks) && c.tracks.length > 0 && c.tracks.length <= 200 &&
      c.tracks.every(t => t && typeof t.id === 'string');
    case 'select': case 'remove': return Number.isInteger(c.index) && c.index >= 0;
    case 'seek': return Number.isFinite(c.seconds) && c.seconds >= 0;
    default: return false;
  }
}
