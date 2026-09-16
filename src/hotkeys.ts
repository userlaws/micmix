// Electron accelerator strings for soundboard pads and app shortcuts. Shared by the UI (capture) and main (validation).
const KEY = /^(F([1-9]|1[0-9]|2[0-4])|MediaPlayPause|MediaNextTrack|MediaPreviousTrack|MediaStop|[A-Z0-9]|num[0-9]|numadd|numsub|nummult|numdiv|numdec|Space|Tab|Insert|Delete|Home|End|PageUp|PageDown|Up|Down|Left|Right)$/;
const MODIFIERS = ['Ctrl', 'Alt', 'Shift'];
export function validAccelerator(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 40) return false;
  const parts = value.split('+');
  const key = parts.pop()!;
  if (!KEY.test(key) || !parts.every(part => MODIFIERS.includes(part)) || new Set(parts).size !== parts.length) return false;
  // A bare letter, digit or navigation key would hijack normal typing in every application.
  // F-keys, numpad keys and the keyboard's media keys are safe on their own.
  return parts.length > 0 || /^(F\d+|num|Media)/.test(key);
}
const NAMED: Record<string, string> = {
  NumpadAdd: 'numadd', NumpadSubtract: 'numsub', NumpadMultiply: 'nummult', NumpadDivide: 'numdiv', NumpadDecimal: 'numdec',
  Space: 'Space', Tab: 'Tab', Insert: 'Insert', Delete: 'Delete', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  MediaPlayPause: 'MediaPlayPause', MediaTrackNext: 'MediaNextTrack', MediaTrackPrevious: 'MediaPreviousTrack', MediaStop: 'MediaStop'
};
// Returns undefined when the event is only a modifier key, otherwise the accelerator the event describes.
export function acceleratorFromEvent(event: { code: string; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }): string | undefined {
  const code = event.code;
  let key: string | undefined;
  if (/^Key[A-Z]$/.test(code)) key = code.slice(3);
  else if (/^Digit[0-9]$/.test(code)) key = code.slice(5);
  else if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) key = code;
  else if (/^Numpad[0-9]$/.test(code)) key = 'num' + code.slice(6);
  else key = NAMED[code];
  if (!key) return undefined;
  const modifiers = [event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.shiftKey && 'Shift'].filter(Boolean) as string[];
  return [...modifiers, key].join('+');
}
export function describeAccelerator(value: string) {
  return value.replace(/num([0-9])/, 'Numpad $1').replace('numadd', 'Numpad +').replace('numsub', 'Numpad -')
    .replace('nummult', 'Numpad *').replace('numdiv', 'Numpad /').replace('numdec', 'Numpad .')
    .replace('MediaPlayPause', 'Media Play/Pause').replace('MediaNextTrack', 'Media Next').replace('MediaPreviousTrack', 'Media Previous').replace('MediaStop', 'Media Stop')
    .replace(/\+/g, ' + ');
}
