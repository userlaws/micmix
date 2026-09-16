const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
// Captures the main screen, the settings sheet and the wizard for visual review. No audio is produced.
module.exports = async function smoke(ui, worker, root) {
  const evalUi = code => ui.webContents.executeJavaScript(code);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const shots = path.join(root, 'artifacts');
  await mkdir(shots, { recursive: true });
  for (let i = 0; i < 60 && !(await evalUi(`!!document.querySelector('.wizard')`)); i++) await sleep(50);
  await sleep(400);
  await writeFile(path.join(shots, 'shot-wizard.png'), (await ui.webContents.capturePage()).toPNG());
  for (let i = 0; i < 60 && await evalUi(`!!document.querySelector('.wizard')`); i++) {
    const done = await evalUi(`(() => { const f = [...document.querySelectorAll('.wizard button')].find(b => b.textContent.trim().startsWith('Finish')); if (f) { f.click(); return true; } const n = [...document.querySelectorAll('.wizard-nav button')].find(b => b.textContent.trim().startsWith('Next') && !b.disabled); if (n) { n.click(); return false; } return null; })()`);
    if (done === null) break;
    await sleep(80);
  }
  await sleep(300);
  const layout = await evalUi(`({ scrollHeight: document.documentElement.scrollHeight, innerHeight: window.innerHeight, innerWidth: window.innerWidth })`);
  await writeFile(path.join(shots, 'shot-main.png'), (await ui.webContents.capturePage()).toPNG());
  await evalUi(`document.querySelector('.gear').click()`);
  // The Sample rates row reads the Windows registry through main; wait for it so the screenshot shows real values.
  for (let i = 0; i < 50 && (await evalUi(`document.querySelector('.sample-rates .val')?.textContent`)) === 'unknown'; i++) await sleep(100);
  console.log('Sample rates row:', await evalUi(`document.querySelector('.sample-rates')?.innerText`));
  await sleep(300);
  await writeFile(path.join(shots, 'shot-settings.png'), (await ui.webContents.capturePage()).toPNG());
  await evalUi(`document.querySelector('.about').scrollIntoView({ block: 'end' })`);
  await sleep(900); // smooth scroll must finish so the section list highlight settles
  await writeFile(path.join(shots, 'shot-about.png'), (await ui.webContents.capturePage()).toPNG());
  if (process.env.MICMIX_UPDATE_SIMULATE === '1') {
    await evalUi(`document.querySelector('[aria-label="Close settings"]')?.click()`);
    const waitPhase = async (phases, limit) => { for (let i = 0; i < limit; i++) { const u = await evalUi(`window.micmix.getUpdate()`); if (phases.includes(u.phase)) return u; await sleep(150); } throw new Error('update phase timeout: ' + phases); };
    const mid = await waitPhase(['downloading'], 80);
    await sleep(1800);
    await writeFile(path.join(shots, 'shot-update-chip.png'), (await ui.webContents.capturePage()).toPNG());
    await evalUi(`document.querySelector('.update-chip').click()`);
    await sleep(300);
    await writeFile(path.join(shots, 'shot-update-downloading.png'), (await ui.webContents.capturePage()).toPNG());
    const done = await waitPhase(['downloaded'], 80);
    await sleep(400);
    await writeFile(path.join(shots, 'shot-update-done.png'), (await ui.webContents.capturePage()).toPNG());
    // Guarded automatic restart: a countdown appears only after the idle window (4 s in simulation) with
    // nothing playing; "Not now" snoozes it; left alone, it restarts by itself.
    const waitRestart = async (want, limit) => { for (let i = 0; i < limit; i++) { const u = await evalUi(`window.micmix.getUpdate()`); if (u.phase === 'downloaded' && (!!u.restartAt) === want) return u; if (u.phase !== 'downloaded') throw new Error('unexpected phase ' + u.phase); await sleep(150); } throw new Error('countdown ' + (want ? 'never started' : 'never stopped')); };
    // LIVE guard, silently (master 0, monitor off, real mic): no countdown may start while live, and a running
    // countdown must die the moment the user goes live.
    const goLive = () => evalUi(`(async () => { const s = await window.micmix.getAudioState(); await window.micmix.command({ type: 'settings', settings: { ...s.settings, levels: { ...s.settings.levels, master: 0 }, monitor: false, monitorVolume: 0 } });
      const devices = (await window.micmix.getReport()).devices; const mic = devices.find(d => d.kind === 'audioinput' && !['default', 'communications'].includes(d.deviceId) && !/CABLE/i.test(d.label) && /Yeti/i.test(d.label)) || devices.find(d => d.kind === 'audioinput' && !['default', 'communications'].includes(d.deviceId) && !/CABLE/i.test(d.label));
      await window.micmix.command({ type: 'start', deviceId: mic.deviceId }); for (let i = 0; i < 100; i++) { const a = await window.micmix.getAudioState(); if (a.status === 'live') return; await new Promise(r => setTimeout(r, 100)); } throw new Error('live timeout'); })()`);
    await goLive();
    await sleep(9000); // well past the 4 s idle window
    if ((await evalUi(`window.micmix.getUpdate()`)).restartAt) throw new Error('countdown must never start while LIVE');
    await evalUi(`window.micmix.command({ type: 'stop' })`);
    await waitRestart(true, 80); // off air + idle -> countdown
    await goLive();
    await waitRestart(false, 20); // going live cancels it
    await sleep(7000); // longer than the countdown: still live, still no restart
    if ((await evalUi(`window.micmix.getUpdate()`)).phase !== 'downloaded') throw new Error('restart must not fire while LIVE');
    await evalUi(`window.micmix.command({ type: 'stop' })`);
    await waitRestart(true, 80);
    await sleep(600);
    await writeFile(path.join(shots, 'shot-update-countdown.png'), (await ui.webContents.capturePage()).toPNG());
    await evalUi(`[...document.querySelectorAll('.update-pop button')].find(b => b.textContent.includes('Not now')).click()`);
    await waitRestart(false, 20);
    const snoozed = await evalUi(`window.micmix.getUpdate()`);
    if (snoozed.restartAt) throw new Error('Not now must clear the countdown');
    await evalUi(`window.micmix.getAudioState()`); // no UI interaction from here: stays idle
    await waitRestart(true, 120); // snooze (4 s) then idle again -> new countdown
    const end = await waitPhase(['upToDate'], 120); // and this time it restarts on its own
    console.log('Update simulation:', JSON.stringify({ mid: mid.phase, done: done.phase, end: end.phase, version: end.version }));
  }
  console.log('Screenshots written:', JSON.stringify(layout));
};
