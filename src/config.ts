import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { defaultSettings, defaultHotkeys, APP_HOTKEY_ACTIONS, PAD_COUNT, type SavedConfig, type AppHotkeys } from './shared';
import { validSettings, validTrack, validPads } from './commands';
import { validAccelerator } from './hotkeys';
// Plain JSON in userData. Unknown or damaged content falls back to defaults field by field; never crashes.
export function defaultConfig(): SavedConfig {
  return { version: 1, setupDone: false, micLabel: null, monitorLabel: null, updateCheck: true, fivemTune: true, closeToTray: true,
    hotkeys: { ...defaultHotkeys }, settings: structuredClone(defaultSettings), queue: [],
    pads: Array.from({ length: PAD_COUNT }, () => null) };
}
export function parseConfig(text: string): SavedConfig {
  const config = defaultConfig();
  let raw: Partial<SavedConfig>;
  try { raw = JSON.parse(text); } catch { return config; }
  if (!raw || typeof raw !== 'object') return config;
  if (typeof raw.setupDone === 'boolean') config.setupDone = raw.setupDone;
  if (typeof raw.updateCheck === 'boolean') config.updateCheck = raw.updateCheck;
  if (typeof raw.fivemTune === 'boolean') config.fivemTune = raw.fivemTune;
  if (typeof raw.closeToTray === 'boolean') config.closeToTray = raw.closeToTray;
  if (raw.resumeHidden === true) config.resumeHidden = true;
  // Per action: an explicit null keeps the shortcut off; anything invalid falls back to the default.
  if (raw.hotkeys && typeof raw.hotkeys === 'object') {
    for (const { action } of APP_HOTKEY_ACTIONS) {
      const value = (raw.hotkeys as Partial<AppHotkeys>)[action];
      if (value === null || validAccelerator(value)) config.hotkeys[action] = value;
    }
  }
  for (const key of ['micLabel', 'monitorLabel'] as const) if (typeof raw[key] === 'string' && raw[key]!.length <= 300) config[key] = raw[key]!;
  // Merge onto defaults so a config saved before a new setting existed still loads (keeping its other tuning).
  if (raw.settings && typeof raw.settings === 'object') {
    const merged = { ...defaultSettings, ...(raw.settings as SavedConfig['settings']) };
    if (validSettings(merged)) config.settings = merged;
  }
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
