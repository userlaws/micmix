import { execFile } from 'node:child_process';
import type { EndpointFormat } from './shared';
// Reads the shared-mode format Windows uses for each audio endpoint from the MMDevices registry
// (PKEY_AudioEngine_DeviceFormat). Read-only, via reg.exe: no native modules, nothing is written.
// Web Audio cannot see these rates: an AudioContext resamples to whatever Windows runs the device at,
// so a 44.1 kHz cable beside a 48 kHz mic means Windows resamples twice before Discord or FiveM hears anything.
const ROOT = ['HKLM', 'SOFTWARE', 'Microsoft', 'Windows', 'CurrentVersion', 'MMDevices', 'Audio', ''].join('\\');
const NAME = '{a45c254e-df1c-4efd-8020-67d146a850e0},2';
const DEVICE = '{b3f8fa53-0004-438e-9003-51a46e139bfc},6';
const FORMAT = '{f19f064d-082c-4e27-bc73-6882a1bb8e4c},0';
// A full recursive dump of either tree takes 10-20 s (reg.exe prints thousands of lines), while a value-name search
// takes ~150 ms, so each flow is read as four small exact-name searches run in parallel and concatenated.
function query(flow: 'Render' | 'Capture'): Promise<string> {
  return Promise.all(['DeviceState', NAME, DEVICE, FORMAT].map(name => new Promise<string>(resolve => {
    execFile('reg', ['query', ROOT + flow, '/s', '/f', name, '/v', '/e'], { windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => resolve(error ? '' : stdout));
  }))).then(parts => parts.join('\n'));
}
export function parseRegistry(flow: 'render' | 'capture', text: string): EndpointFormat[] {
  const endpoints = new Map<string, { active: boolean; name?: string; device?: string; format?: string }>();
  let current: { active: boolean; name?: string; device?: string; format?: string } | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const key = /\\(\{[0-9a-f-]{36}\})(\\Properties)?$/i.exec(line);
    if (line.startsWith('HKEY_')) {
      if (key) {
        const id = key[1].toLowerCase();
        if (!endpoints.has(id)) endpoints.set(id, { active: false });
        current = endpoints.get(id)!;
      } else current = null;
      continue;
    }
    if (!current) continue;
    const value = /^(\S+)\s+(REG_\w+)\s+(.*)$/.exec(line);
    if (!value) continue;
    if (value[1] === 'DeviceState') current.active = parseInt(value[3], 16) === 1;
    else if (value[1] === NAME) current.name = value[3];
    else if (value[1] === DEVICE) current.device = value[3];
    else if (value[1] === FORMAT) current.format = value[3];
  }
  const result: EndpointFormat[] = [];
  for (const endpoint of endpoints.values()) {
    if (!endpoint.active || !endpoint.name || !endpoint.format) continue;
    // Blob = 8-byte property header, then WAVEFORMATEX: tag(2) channels(2) rate(4) bytesPerSec(4) align(2) bits(2).
    const bytes = Buffer.from(endpoint.format, 'hex');
    if (bytes.length < 24) continue;
    const channels = bytes.readUInt16LE(10), sampleRate = bytes.readUInt32LE(12), bits = bytes.readUInt16LE(22);
    if (!sampleRate || sampleRate > 400000) continue;
    const device = endpoint.device ?? '';
    // Chromium labels endpoints "Name (Device)", the same string Windows Sound settings shows.
    result.push({ flow, name: endpoint.name, device, label: device ? endpoint.name + ' (' + device + ')' : endpoint.name, sampleRate, channels, bits });
  }
  return result;
}
export async function readEndpointFormats(): Promise<EndpointFormat[]> {
  if (process.platform !== 'win32') return [];
  const [render, capture] = await Promise.all([query('Render'), query('Capture')]);
  return [...parseRegistry('render', render), ...parseRegistry('capture', capture)];
}
