import React, { useEffect, useState } from 'react';
import type { PadState } from './shared';
import { acceleratorFromEvent, describeAccelerator } from './hotkeys';
interface Props {
  pads: (PadState | null)[]; active: number[]; live: boolean; busy: boolean;
  run(action: () => Promise<void>): void; play(slot: number): void;
}
export function Soundboard({ pads, active, live, busy, run, play }: Props) {
  const [editing, setEditing] = useState(false);
  const [capturing, setCapturing] = useState<number | null>(null);
  useEffect(() => {
    if (capturing === null) return;
    const slot = capturing;
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault(); event.stopPropagation();
      if (event.code === 'Escape') { setCapturing(null); return; }
      if (event.code === 'Backspace') { run(() => window.micmix.setPadHotkey(slot, null)); setCapturing(null); return; }
      const accelerator = acceleratorFromEvent(event);
      if (!accelerator) return;
      run(() => window.micmix.setPadHotkey(slot, accelerator)); setCapturing(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [capturing, run]);
  return <section className="panel soundboard">
    <div className="panel-heading"><h2>Soundboard</h2><div className="pad-actions">
      <button className={editing ? 'selected' : ''} onClick={() => { setEditing(!editing); setCapturing(null); }}>{editing ? 'Done' : 'Edit'}</button>
      <button disabled={!active.length} onClick={() => run(() => window.micmix.command({ type: 'stopPads' }))}>Stop all</button></div></div>
    <div className={'pads ' + (editing ? 'editing' : '')}>{pads.map((pad, slot) => {
      const number = String(slot + 1).padStart(2, '0');
      if (editing) return <div key={slot} className={'pad edit ' + (pad ? 'filled' : '')}>
        <span className="pad-number">{number}</span>
        <span className="pad-title">{pad ? pad.title : 'Empty pad'}</span>
        <button disabled={busy} onClick={() => run(() => window.micmix.assignPad(slot))}>{pad ? 'Replace clip' : 'Choose clip'}</button>
        {pad && <button disabled={busy} className={capturing === slot ? 'selected' : ''} onClick={() => setCapturing(capturing === slot ? null : slot)}>
          {capturing === slot ? 'Press keys… Esc cancels, Backspace clears' : pad.hotkey ? 'Hotkey: ' + describeAccelerator(pad.hotkey) : 'Set hotkey'}</button>}
        {pad && <button disabled={busy} onClick={() => run(() => window.micmix.clearPad(slot))}>Clear pad</button>}
        {pad?.error && <span className="error-text">{pad.error}</span>}
      </div>;
      return <button key={slot} className={'pad ' + (pad ? 'filled ' : '') + (active.includes(slot) ? 'active' : '')}
        disabled={!pad || !pad.ready || !live || busy} title={pad?.error ?? pad?.title ?? 'Empty pad. Use Edit to choose a clip.'} onClick={() => play(slot)}>
        <span className="pad-number">{number}</span><span className="pad-title">{pad ? pad.title : ''}</span>
        <span className="pad-key">{pad?.error ? 'Error' : pad && !pad.ready ? 'Loading…' : pad?.hotkey ? describeAccelerator(pad.hotkey) : ''}</span>
      </button>;
    })}</div>
    <p>{editing ? 'Clips: mp3, wav, flac or ogg up to 60 s, decoded once. Hotkeys need Ctrl, Alt or Shift, or an F-key / numpad key, so they never hijack typing.'
      : live ? 'Tap a pad to play, tap again to stop. Pads mix under the Pads fader and reach Discord like everything else.' : 'Go LIVE to play pads. Hotkeys work from any app while LIVE.'}</p>
  </section>;
}
