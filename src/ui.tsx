import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { DeviceReport } from './shared';
import './ui.css';
function App() {
  const [report, setReport] = useState<DeviceReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let received = false;
    const off = window.micmix.onReport(value => { received = true; setReport(value); setBusy(false); });
    window.micmix.getReport().then(value => { if (!received) setReport(value); }).catch(e => setError(String(e)));
    return off;
  }, []);
  const input = report?.devices.some(d => d.kind === 'audiooutput' && /CABLE Input/i.test(d.label));
  const output = report?.devices.some(d => d.kind === 'audioinput' && /CABLE Output/i.test(d.label));
  async function refresh() {
    setBusy(true); setError('');
    try { await window.micmix.refreshDevices(); }
    catch (e) { setError(String(e)); setBusy(false); }
  }
  return <main>
    <header><div><span className="eyebrow">WINDOWS AUDIO MIXER</span><h1>MicMix<span className="badge">OFF AIR</span></h1></div><span className="phase">PHASE 0 · DEVICE CHECK</span></header>
    <section className="intro"><h2>Let’s find your audio devices.</h2><p>This check runs in the dedicated hidden audio window. Your microphone is briefly opened to read device names, then released. No sound is played or routed.</p></section>
    <section className={'status ' + (input && output ? 'ok' : 'warning')} role="status">
      <strong>{!report ? 'Scanning devices…' : input && output ? 'MicMix Virtual Mic detected' : 'MicMix Virtual Mic missing'}</strong>
      <p>{input && output ? 'Both cable endpoints are present. Awaiting your checkpoint confirmation.' : 'Both playback and recording endpoints must be present before Phase 1.'}</p>
      <div>Playback endpoint: {report ? input ? 'Found' : 'Missing' : 'Checking'} · Recording endpoint: {report ? output ? 'Found' : 'Missing' : 'Checking'}</div>
    </section>
    {(error || report?.error) && <p className="error" role="alert">{error || report?.error}</p>}
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
