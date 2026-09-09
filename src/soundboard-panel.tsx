import React, { useEffect, useState } from 'react';
import type { PadState } from './shared';
import { acceleratorFromEvent, describeAccelerator } from './hotkeys';
import { Icon } from './icons';
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
  return <section className="card soundboard">
    <div className="card-head"><div><h2>Soundboard</h2><div className="sub">Play clips, sound effects, or memes</div></div><div className="card-actions">
      <button className={'btn small ' + (editing ? 'selected' : '')} onClick={() => { setEditing(!editing); setCapturing(null); }}>{editing ? 'Done' : 'Edit'}</button>
      <button className="btn small" disabled={!active.length} onClick={() => run(() => window.micmix.command({ type: 'stopPads' }))}><Icon name="stop" size={14} />Stop all</button></div></div>
    <div className={'pads ' + (editing ? 'editing' : '')}>{pads.map((pad, slot) => {
      const number = String(slot + 1);
      if (editing) return <div key={slot} className={'pad edit ' + (pad ? 'filled' : '')}>
        <span className="pad-number">PAD {number}</span>
        <span className="pad-title">{pad ? pad.title : 'Empty pad'}</span>
        <div className="pad-edit-actions">
          <button className="btn small" disabled={busy} onClick={() => run(() => window.micmix.assignPad(slot))}><Icon name="file" size={14} />{pad ? 'Replace clip' : 'Choose clip'}</button>
          {pad && <button className={'btn small ' + (capturing === slot ? 'selected' : '')} disabled={busy} onClick={() => setCapturing(capturing === slot ? null : slot)}><Icon name="keyboard" size={14} />
            {capturing === slot ? 'Press keys… Esc cancels, Backspace clears' : pad.hotkey ? 'Hotkey: ' + describeAccelerator(pad.hotkey) : 'Set hotkey'}</button>}
          {pad && <button className="btn small" disabled={busy} onClick={() => run(() => window.micmix.clearPad(slot))}><Icon name="trash" size={14} />Clear</button>}
        </div>
        {pad?.error && <span className="error-text">{pad.error}</span>}
      </div>;
      if (!pad) return <button key={slot} className="pad empty" disabled={busy} title="Choose a clip for this pad" onClick={() => run(() => window.micmix.assignPad(slot))}>
        <span className="pad-number">{number}</span><span className="pad-glyph"><Icon name="plus" size={20} /></span><span className="pad-title">Add sound</span><span className="pad-key" /></button>;
      const on = active.includes(slot);
      return <button key={slot} className={'pad filled ' + (on ? 'active' : '')} aria-pressed={on}
        disabled={!pad.ready || !live || busy} title={pad.error ?? pad.title} onClick={() => play(slot)}>
        <span className="pad-number">{number}</span><span className="pad-glyph"><Icon name={on ? 'stop' : 'play'} size={18} /></span>
        <span className="pad-title">{pad.title}</span>
        <span className="pad-key">{pad.error ? 'Error' : !pad.ready ? 'Loading…' : pad.hotkey ? describeAccelerator(pad.hotkey) : ''}</span>
      </button>;
    })}</div>
    <div className="soundboard-tip"><Icon name="bolt" size={14} /><span>{editing ? 'Clips: mp3, wav, flac or ogg up to 60 s, decoded once. Hotkeys need Ctrl, Alt or Shift, or an F-key / numpad key, so they never hijack typing.'
      : live ? 'Tap a pad to play, tap again to stop. Pads mix under the Pads fader and reach Discord like everything else.' : 'Go live to play pads. Hotkeys work from any app while live.'}</span></div>
  </section>;
}
