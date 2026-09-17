// Does a getDisplayMedia stream of the YouTube view survive navigating that view to another video?
// If it does, auto-advance never needs to re-request capture. Nothing audible: no live context.
module.exports = async function smoke(ui, worker, root, _registerFiles, youtube) {
  const run = code => worker.webContents.executeJavaScript(`(async () => { try { return await (async () => { ${code} })(); } catch (e) { return { error: String((e && e.message) || e) }; } })()`);
  youtube.bounds({ x: 40, y: 40, width: 640, height: 360 });
  await youtube.command({ type: 'load', videoId: 'M7lc1UVf-VE', position: 0 });
  console.log('captured while the first video is loaded:', JSON.stringify(await run(`
    const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 1 }, audio: { echoCancellation: false } });
    s.getVideoTracks().forEach(t => t.stop());
    window.__probe = s;
    const ctx = new AudioContext();
    window.__probeCtx = ctx;
    const src = ctx.createMediaStreamSource(s);
    const an = ctx.createAnalyser(); an.fftSize = 2048;
    src.connect(an);
    window.__probeAnalyser = an;
    return { audio: s.getAudioTracks().length, state: s.getAudioTracks()[0].readyState };
  `)));
  const peak = () => run(`
    const an = window.__probeAnalyser, buf = new Float32Array(an.fftSize);
    let best = 0;
    for (let i = 0; i < 40; i++) {
      an.getFloatTimeDomainData(buf);
      for (const v of buf) best = Math.max(best, Math.abs(v));
      await new Promise(r => setTimeout(r, 50));
    }
    return { peak: Number(best.toFixed(4)), track: window.__probe.getAudioTracks()[0].readyState };
  `);
  await youtube.command({ type: 'play' });
  await new Promise(r => setTimeout(r, 3000));
  console.log('first video playing:      ', JSON.stringify(await peak()));
  await youtube.command({ type: 'load', videoId: 'aqz-KE-bpKQ', position: 0 });
  console.log('after navigating (paused):', JSON.stringify(await peak()));
  await youtube.command({ type: 'play' });
  await new Promise(r => setTimeout(r, 4000));
  console.log('second video playing:     ', JSON.stringify(await peak()));
  ui.removeBrowserView(youtube.view);
  await new Promise(r => setTimeout(r, 1500));
  console.log('while view is detached:   ', JSON.stringify(await peak()));
  ui.addBrowserView(youtube.view);
  youtube.view.setBounds({ x: 40, y: 40, width: 640, height: 360 });
  await new Promise(r => setTimeout(r, 1500));
  console.log('after re-attaching:       ', JSON.stringify(await peak()));
  await youtube.command({ type: 'load', videoId: 'M7lc1UVf-VE', position: 30 });
  await youtube.command({ type: 'play' });
  await new Promise(r => setTimeout(r, 4000));
  console.log('third video playing:      ', JSON.stringify(await peak()));
  await run(`window.__probe.getTracks().forEach(t => t.stop()); await window.__probeCtx.close();`);
};
