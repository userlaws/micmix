import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { defaultSettings, PAD_COUNT, type SavedConfig } from './shared';
import { validSettings, validTrack, validPads } from './commands';
// Plain JSON in userData. Unknown or damaged content falls back to defaults field by field; never crashes.
export function defaultConfig(): SavedConfig {
  return { version: 1, setupDone: false, micLabel: null, monitorLabel: null, settings: structuredClone(defaultSettings), queue: [],
    pads: Array.from({ length: PAD_COUNT }, () => null) };
}
export function parseConfig(text: string): SavedConfig {
  const config = defaultConfig();
  let raw: Partial<SavedConfig>;
  try { raw = JSON.parse(text); } catch { return config; }
  if (!raw || typeof raw !== 'object') return config;
  if (typeof raw.setupDone === 'boolean') config.setupDone = raw.setupDone;
  for (const key of ['micLabel', 'monitorLabel'] as const) if (typeof raw[key] === 'string' && raw[key]!.length <= 300) config[key] = raw[key]!;
  if (validSettings(raw.settings)) config.settings = raw.settings;
  if (Array.isArray(raw.queue)) config.queue = raw.queue.filter(validTrack).slice(0, 500);
  if (validPads(raw.pads)) config.pads = raw.pads;
  return config;
}
export function loadConfig(file: string): SavedConfig {
  try { return parseConfig(readFileSync(file, 'utf8')); } catch { return defaultConfig(); }
}
export function saveConfig(file: string, config: SavedConfig) {
  mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + '.tmp';
  writeFileSync(temp, JSON.stringify(config, null, 2));
  renameSync(temp, file);
}
