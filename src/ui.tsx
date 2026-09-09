import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { DeviceReport, AudioState, AudioCommand } from './shared';
import { microphoneChoices } from './devices';
import './ui.css';
function App() {
  const [report, setReport] = useState<DeviceReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [audio, setAudio] = useState<AudioState>({ status: 'off', micId: null, tone: false, error: null });
  const [micId, setMicId] = useState('');
  const [commandBusy, setCommandBusy] = useState(false);
  useEffect(() => {
    let received = false;
    const off = window.micmix.onAudioState(value => { received = true; setAudio(value); });
    window.micmix.getAudioState().then(value => { if (!received) setAudio(value); }).catch(e => setError(String(e)));
    return off;
  }, []);
  useEffect(() => {
    let received = false;
    const off = window.micmix.onReport(value => { received = true; setReport(value); setBusy(false); });
    window.micmix.getReport().then(value => { if (!received) setReport(value); }).catch(e => setError(String(e)));
    return off;
  }, []);
  const input = report?.devices.some(d => d.kind === 'audiooutput' && /CABLE Input/i.test(d.label));
  const output = report?.devices.some(d => d.kind === 'audioinput' && /CABLE Output/i.test(d.label));
  const microphones = microphoneChoices(report?.devices ?? []);
  useEffect(() => {
    if (micId && !microphones.some(d => d.deviceId === micId)) setMicId('');
    if (!micId && report) {
      const defaultMic = report.devices.find(d => d.kind === 'audioinput' && d.deviceId === 'default');
      const match = microphones.find(d => defaultMic?.groupId && d.groupId === defaultMic.groupId);
      if (match) setMicId(match.deviceId);
    }
  }, [report, micId]);
  async function send(command: AudioCommand) {
    setError(''); setCommandBusy(true);
    try { await window.micmix.command(command); }
    catch (e) { setError(String(e)); }
    finally { setCommandBusy(false); }
  }
  async function refresh() {
    setBusy(true); setError('');
    try { await window.micmix.refreshDevices(); }
    catch (e) { setError(String(e)); setBusy(false); }
  }
  return <main>
    <header><div><span className="eyebrow">WINDOWS AUDIO MIXER</span><h1>MicMix</h1></div>
      <button className={'air ' + (audio.status === 'live' ? 'live' : '')}
        disabled={audio.status === 'off' && (commandBusy || !micId || !input || !output || !report?.setSinkIdSupported)}
        onClick={() => void send(audio.status === 'off' ? { type: 'start', deviceId: micId } : { type: 'stop' })}>
        {audio.status === 'live' ? 'LIVE — Go off air' : audio.status === 'starting' ? 'Starting… Cancel' : 'OFF AIR — Go live'}
      </button></header>
    <section className="intro"><span className="phase">PHASE 1 · MIC PASSTHROUGH</span><h2>Your mic, through MicMix.</h2>
      <p>Choose your physical microphone and go LIVE. Your voice goes to MicMix Virtual Mic. Use Discord’s mic test to listen; local monitoring arrives in Phase 2.</p></section>
    <section className="controls"><label htmlFor="microphone">Microphone</label>
      <select id="microphone" value={micId} disabled={audio.status !== 'off' || commandBusy} onChange={event => setMicId(event.target.value)}>
        <option value="">Choose your real microphone</option>
        {microphones.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
      </select>
      <p>Virtual cable inputs are excluded to prevent feedback. Go OFF AIR before changing microphones.</p>
      <button disabled={audio.status !== 'live' || audio.tone || commandBusy} onClick={() => void send({ type: 'tone' })}>
        {audio.tone ? 'Sending test tone…' : 'Send 1.5-second test tone'}
      </button><p>440 Hz · quiet test level · sent to the virtual microphone while LIVE.</p>
    </section>
    <section className={'status ' + (input && output ? 'ok' : 'warning')} role="status">
      <strong>{!report ? 'Scanning devices…' : input && output ? 'MicMix Virtual Mic detected' : 'MicMix Virtual Mic missing'}</strong>
      <p>{input && output ? 'Both endpoints are present. Audio quality still needs your Discord test.' : 'Both playback and recording endpoints must be present to go LIVE.'}</p>
      <div>Playback endpoint: {report ? input ? 'Found' : 'Missing' : 'Checking'} · Recording endpoint: {report ? output ? 'Found' : 'Missing' : 'Checking'}</div>
    </section>
    {(error || audio.error || report?.error) && <p className="error" role="alert">{error || audio.error || report?.error}</p>}
    <section className="guide"><h2>Discord checkpoint</h2><p>Discord → User Settings → Voice &amp; Video → Input Device → <strong>CABLE Output (VB-Audio Virtual Cable)</strong>. Set Output Device to your real headphones, then use Mic Test → Let’s Check.</p>
      <p>Speak, send the test tone, then go OFF AIR. Report whether voice and tone are audible and whether OFF AIR silences both. No audio test is marked passed automatically.</p></section>
    <section><div className="section-title"><h2>Audio device diagnostics</h2><button onClick={refresh} disabled={busy}>{busy ? 'Scanning…' : 'Rescan devices'}</button></div>
      <p>Raw Windows names are shown here for checkpoint verification.</p>
      <div className="table-wrap"><table><thead><tr><th>Direction</th><th>Windows device name</th></tr></thead><tbody>
        {report?.devices.map(d => <tr key={d.kind + d.deviceId}><td>{d.kind === 'audioinput' ? 'Recording / mic' : 'Playback / speaker'}</td><td>{d.label || '(label unavailable)'}</td></tr>)}
      </tbody></table></div>
      {report && report.devices.length === 0 && <p>No audio endpoints returned.</p>}
    </section>
    <footer>AudioContext.setSinkId: {report ? report.setSinkIdSupported ? 'Supported' : 'Unavailable' : 'Checking'}<br />{report ? 'Last scan: ' + new Date(report.scannedAt).toLocaleTimeString() : 'Waiting for audio worker'}</footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App />);
