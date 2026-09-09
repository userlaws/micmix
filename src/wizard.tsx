import React, { useEffect, useState } from 'react';
import { emptyMeters, type AudioDevice, type AudioState, type AudioCommand } from './shared';
import { DeviceSelect, Level } from './controls';
import { Icon } from './icons';
interface Props {
  cable: boolean; reportError: string | null; microphones: AudioDevice[]; playbacks: AudioDevice[];
  micId: string; monitorId: string; setMicId(id: string): void; setMonitorId(id: string): void;
  audio: AudioState; busy: boolean; send(command: AudioCommand): Promise<void>; finish(): void;
}
const STEPS = ['Virtual mic', 'Devices', 'Test', 'Discord'];
export function Wizard(props: Props) {
  const { cable, audio, busy } = props;
  const [step, setStep] = useState(0);
  const [downloadError, setDownloadError] = useState('');
  const [meters, setMeters] = useState(emptyMeters);
  useEffect(() => window.micmix.onMeters(setMeters), []);
  const live = audio.status === 'live';
  const canStart = !!props.micId && cable && !busy && audio.status === 'off' && (!audio.settings.monitor || !!props.monitorId);
  return <div className="wizard-backdrop" role="dialog" aria-modal="true" aria-label="MicMix setup">
    <section className="card wizard">
      <div className="card-head"><div className="brand"><img className="logo small" src="./brand/micmix-mark.svg" alt="" width={40} height={40} /><div><h2>Set up MicMix</h2><div className="sub">Step {step + 1} of {STEPS.length} · {STEPS[step]}</div></div></div></div>
      <div className="stepper" aria-hidden="true">{STEPS.map((name, i) => <i key={name} className={i <= step ? 'done' : ''} />)}</div>
      {step === 0 && <div>
        <div className={'ok-badge ' + (cable ? '' : 'bad')}><Icon name={cable ? 'check' : 'close'} size={22} /></div>
        <h3>{cable ? 'MicMix Virtual Mic is installed' : 'MicMix Virtual Mic is missing'}</h3>
        {cable ? <p>Windows lists it as <strong>CABLE Input</strong> (playback) and <strong>CABLE Output</strong> (recording). MicMix sends your mix into CABLE Input; Discord and games listen on CABLE Output.</p>
          : <><p>Download the VB-CABLE driver ZIP, extract it, and run <strong>VBCABLE_Setup_x64.exe</strong> as administrator. After installation, restart Windows if prompted, then rescan devices. Windows must list <strong>CABLE Input</strong> and <strong>CABLE Output</strong>.</p>
            {props.reportError && <p className="error-text">{props.reportError}</p>}
            {downloadError && <p className="error-text" role="alert">{downloadError}</p>}
            <div className="wizard-actions"><button className="btn" onClick={() => {
              setDownloadError('');
              void window.micmix.downloadVbCable().catch(() => setDownloadError('Could not start the driver download. Please try again.'));
            }}>Download VB-CABLE</button>
              <button className="btn" onClick={() => void window.micmix.refreshDevices().catch(() => {})}><Icon name="refresh" size={16} />Rescan devices</button></div></>}
      </div>}
      {step === 1 && <div>
        <h3>Choose your real microphone and headphones</h3>
        <p>Your Windows defaults are preselected. The virtual cable is hidden on purpose: it is never an input to itself.</p>
        <div className="device-body"><label htmlFor="wizard-mic">Microphone</label>
          <DeviceSelect id="wizard-mic" disabled={audio.status !== 'off'} value={props.micId} onChange={props.setMicId} devices={props.microphones} placeholder="Choose your real microphone" /></div>
        <div className="device-body"><label htmlFor="wizard-monitor">Headphones (monitor)</label>
          <DeviceSelect id="wizard-monitor" disabled={audio.status !== 'off'} value={props.monitorId} onChange={props.setMonitorId} devices={props.playbacks} placeholder="Choose your headphones" /></div>
      </div>}
      {step === 2 && <div>
        <h3>Test the virtual microphone</h3>
        <p>Go LIVE, then speak: the Mic meter should move. Send the test tone: the Master meter should move. Nothing plays in your headphones until you enable monitoring.</p>
        <div className="wizard-actions">
          <button className={'btn air ' + (live ? 'live' : 'primary')} disabled={!live && !canStart}
            onClick={() => void props.send(live ? { type: 'stop' } : { type: 'start', deviceId: props.micId, monitorId: props.monitorId || undefined })}>
            {live ? '● LIVE · Go off air' : audio.status === 'starting' ? 'Starting…' : '○ Go LIVE'}</button>
          <button className="btn" disabled={!live || audio.tone || busy} onClick={() => void props.send({ type: 'tone' })}>{audio.tone ? 'Sending tone…' : 'Send test tone'}</button>
        </div>
        <div className="wizard-meter"><span className="sub">Mic</span><Level value={meters.mic} /></div>
        <div className="wizard-meter"><span className="sub">Master (what Discord hears)</span><Level value={meters.master} /></div>
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
        <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>← Back</button>
        {step < STEPS.length - 1 ? <button className="btn primary" disabled={(step === 0 && !cable) || (step === 1 && !props.micId)} onClick={() => setStep(step + 1)}>Next →</button>
          : <button className="btn primary" onClick={props.finish}>Finish</button>}
      </div>
    </section>
  </div>;
}
