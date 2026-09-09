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
  await sleep(300);
  await writeFile(path.join(shots, 'shot-settings.png'), (await ui.webContents.capturePage()).toPNG());
  await evalUi(`document.querySelector('.about').scrollIntoView({ block: 'end' })`);
  await sleep(300);
  await writeFile(path.join(shots, 'shot-about.png'), (await ui.webContents.capturePage()).toPNG());
  if (process.env.MICMIX_UPDATE_SIMULATE === '1') {
    await evalUi(`document.querySelector('[aria-label="Close settings"]')?.click()`);
    const waitPhase = async (phases, limit) => { for (let i = 0; i < limit; i++) { const u = await evalUi(`window.micmix.getUpdate()`); if (phases.includes(u.phase)) return u; await sleep(150); } throw new Error('update phase timeout: ' + phases); };
    const mid = await waitPhase(['downloading'], 80);
    await sleep(1800);
    await writeFile(path.join(shots, 'shot-update-downloading.png'), (await ui.webContents.capturePage()).toPNG());
    const done = await waitPhase(['downloaded', 'installing'], 80);
    await sleep(250);
    await writeFile(path.join(shots, 'shot-update-done.png'), (await ui.webContents.capturePage()).toPNG());
    const end = await waitPhase(['upToDate'], 80);
    console.log('Update simulation:', JSON.stringify({ mid: mid.phase, done: done.phase, end: end.phase, version: end.version }));
  }
  console.log('Screenshots written:', JSON.stringify(layout));
};
