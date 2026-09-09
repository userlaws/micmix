import React, { useEffect, useState } from 'react';
import { emptyMeters, type AudioDevice, type AudioState, type AudioCommand } from './shared';
interface Props {
  cable: boolean; reportError: string | null; microphones: AudioDevice[]; playbacks: AudioDevice[];
  micId: string; monitorId: string; setMicId(id: string): void; setMonitorId(id: string): void;
  audio: AudioState; busy: boolean; send(command: AudioCommand): Promise<void>; finish(): void;
}
const STEPS = ['Virtual mic', 'Devices', 'Test', 'Discord'];
export function Wizard(props: Props) {
  const { cable, audio, busy } = props;
  const [step, setStep] = useState(0);
  const [meters, setMeters] = useState(emptyMeters);
  useEffect(() => window.micmix.onMeters(setMeters), []);
  const live = audio.status === 'live';
  const canStart = !!props.micId && cable && !busy && audio.status === 'off' && (!audio.settings.monitor || !!props.monitorId);
  return <div className="wizard-backdrop" role="dialog" aria-modal="true" aria-label="MicMix setup">
    <section className="panel wizard">
      <div className="panel-heading"><h2>Set up MicMix</h2><span className="muted">STEP {step + 1} OF {STEPS.length} · {STEPS[step].toUpperCase()}</span></div>
      {step === 0 && <div>
        <h3>{cable ? '✓ MicMix Virtual Mic is installed' : 'MicMix Virtual Mic is missing'}</h3>
        {cable ? <p>Windows lists it as <strong>CABLE Input</strong> (playback) and <strong>CABLE Output</strong> (recording). MicMix sends your mix into CABLE Input; Discord and games listen on CABLE Output.</p>
          : <><p>MicMix needs the VB-CABLE driver. Repair: install VB-CABLE from vb-audio.com (run its setup as administrator), then restart Windows or the Windows Audio service, and rescan. Windows must list <strong>CABLE Input</strong> and <strong>CABLE Output</strong>.</p>
            {props.reportError && <p className="error-text">{props.reportError}</p>}
            <div className="wizard-actions"><button onClick={() => void window.micmix.openVbCableSite()}>Open vb-audio.com/Cable</button>
              <button onClick={() => void window.micmix.refreshDevices().catch(() => {})}>Rescan devices</button></div></>}
      </div>}
      {step === 1 && <div>
        <h3>Choose your real microphone and headphones</h3>
        <p>Your Windows defaults are preselected. The virtual cable is hidden on purpose: it is never an input to itself.</p>
        <label htmlFor="wizard-mic">Microphone<select id="wizard-mic" disabled={audio.status !== 'off'} value={props.micId} onChange={e => props.setMicId(e.target.value)}>
          <option value="">Choose your real microphone</option>{props.microphones.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}</select></label>
        <label htmlFor="wizard-monitor">Headphones (monitor)<select id="wizard-monitor" disabled={audio.status !== 'off'} value={props.monitorId} onChange={e => props.setMonitorId(e.target.value)}>
          <option value="">Choose your headphones</option>{props.playbacks.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}</select></label>
      </div>}
      {step === 2 && <div>
        <h3>Test the virtual microphone</h3>
        <p>Go LIVE, then speak: the Mic meter should move. Send the test tone: the Master meter should move. Nothing plays in your headphones until you enable monitoring.</p>
        <div className="wizard-actions">
          <button className={'air ' + (live ? 'live' : '')} disabled={!live && !canStart}
            onClick={() => void props.send(live ? { type: 'stop' } : { type: 'start', deviceId: props.micId, monitorId: props.monitorId || undefined })}>
            {live ? '● LIVE · Go off air' : audio.status === 'starting' ? 'Starting…' : '○ Go LIVE'}</button>
          <button disabled={!live || audio.tone || busy} onClick={() => void props.send({ type: 'tone' })}>{audio.tone ? 'Sending tone…' : 'Send test tone'}</button>
        </div>
        <label>Mic<meter min="0" max="1" low={0.7} high={0.9} optimum={0.3} value={meters.mic} /></label>
        <label>Master (what Discord hears)<meter min="0" max="1" low={0.7} high={0.9} optimum={0.3} value={meters.master} /></label>
        {audio.error && <p className="error-text">{audio.error}</p>}
      </div>}
      {step === 3 && <div>
        <h3>Point Discord at the virtual microphone</h3>
        <ol className="steps">
          <li>Discord → <strong>User Settings → Voice & Video</strong>.</li>
          <li><strong>Input Device</strong> → <strong>CABLE Output (VB-Audio Virtual Cable)</strong>.</li>
          <li>Output Device → your real headphones.</li>
          <li>Input profile <strong>Custom</strong>: Noise Suppression <strong>None</strong>, Echo Cancellation <strong>off</strong>, Automatic Gain Control <strong>off</strong>, Input Sensitivity automatic or fully left. Otherwise Discord treats music as noise.</li>
          <li>Use Discord's mic test with MicMix monitoring off, so you don't hear the music twice.</li>
        </ol>
        <p>FiveM: <strong>Settings → Voice Chat → Input Device → CABLE Output (VB-Audio Virtual Cable)</strong>. MicMix shows both apps in the status bar when they are running.</p>
      </div>}
      <div className="wizard-nav">
        <button disabled={step === 0} onClick={() => setStep(step - 1)}>← Back</button>
        {step < STEPS.length - 1 ? <button className="play" disabled={(step === 0 && !cable) || (step === 1 && !props.micId)} onClick={() => setStep(step + 1)}>Next →</button>
          : <button className="play" onClick={props.finish}>Finish</button>}
      </div>
    </section>
  </div>;
}
