// Evidence for the "never detach the YouTube view" rule in src/youtube-view.ts: getDisplayMedia can
// only capture an ATTACHED BrowserView. Parking it out of sight works here, but a view parked fully
// outside the window does NOT always get a compositor surface when it has never been on screen, so
// youtube-view.ts parks it as one pixel inside the window instead. Nothing is audible.
module.exports = async function smoke(ui, worker, root, _registerFiles, youtube) {
  const capture = () => worker.webContents.executeJavaScript(`(async () => {
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 1 }, audio: { echoCancellation: false } });
      const audio = s.getAudioTracks().length;
      s.getTracks().forEach(t => t.stop());
      return { ok: true, audio };
    } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
  })()`);
  await youtube.command({ type: 'load', videoId: 'M7lc1UVf-VE', position: 0 });
  const content = ui.getContentBounds();
  const cases = [];
  youtube.view.setBounds({ x: 40, y: 40, width: 640, height: 360 });
  cases.push(['visible 640x360', true, await capture()]);
  youtube.view.setBounds({ x: -20000, y: -20000, width: 640, height: 360 });
  cases.push(['parked offscreen', true, await capture()]);
  youtube.view.setBounds({ x: 0, y: content.height + 100, width: 640, height: 360 });
  cases.push(['below the window', true, await capture()]);
  ui.removeBrowserView(youtube.view);
  cases.push(['detached', false, await capture()]);
  let failed = 0;
  for (const [name, expected, result] of cases) {
    const pass = result.ok === expected;
    if (!pass) failed++;
    console.log('  ' + (pass ? 'ok  ' : 'FAIL') + ' ' + name.padEnd(18) + JSON.stringify(result));
  }
  if (failed) throw new Error(failed + ' capture placement case(s) behaved unexpectedly');
  console.log('capture needs an attached view; where it sits does not matter');
};
