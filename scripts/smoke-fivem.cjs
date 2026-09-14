const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
// FiveM tuning card: asserts the switch, its status text and the toggle round trip through main; captures the card.
// NOTE: toggling edits the real %APPDATA%\CitizenFX\fivem.cfg (when FiveM is closed); it ends with tuning ON.
module.exports = async function smoke(ui) {
  const evalUi = code => ui.webContents.executeJavaScript(code);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const shots = path.join(process.cwd(), 'artifacts');
  await mkdir(shots, { recursive: true });
  for (let i = 0; i < 60 && await evalUi(`!!document.querySelector('.wizard')`); i++) {
    const done = await evalUi(`(() => { const f = [...document.querySelectorAll('.wizard button')].find(b => b.textContent.trim().startsWith('Finish')); if (f) { f.click(); return true; } const n = [...document.querySelectorAll('.wizard-nav button')].find(b => b.textContent.trim().startsWith('Next') && !b.disabled); if (n) { n.click(); return false; } return null; })()`);
    if (done === null) break;
    await sleep(80);
  }
  await sleep(300);
  await evalUi(`document.querySelector('.gear').click()`);
  await sleep(300);
  const label = '[aria-label="Tune FiveM voice for MicMix"]';
  const statusText = () => evalUi(`document.querySelector('${label}')?.closest('.row-top')?.querySelector('small')?.textContent`);
  const state = () => evalUi(`window.micmix.getIntegrations()`);
  const start = await state();
  if (!start.fivemTune || !(await evalUi(`!!document.querySelector('${label}')`))) throw new Error('FiveM tuning switch missing');
  console.log('initial:', JSON.stringify(start.fivemTune), '|', await statusText());
  // The settings sheet scrolls itself (.sheet, overflow auto), so jump it to the FiveM card before the capture.
  await evalUi(`(() => { const sheet = document.querySelector('.sheet'); const el = document.querySelector('${label}'); sheet.scrollTop = el.getBoundingClientRect().top - sheet.getBoundingClientRect().top + sheet.scrollTop - sheet.clientHeight / 2; })()`);
  await sleep(500);
  await writeFile(path.join(shots, 'shot-fivem-card.png'), (await ui.webContents.capturePage()).toPNG());
  // Off then on again: main must report restored/applied (or waiting while FiveM runs) and persist the flag.
  await evalUi(`document.querySelector('${label}').click()`);
  await sleep(400);
  const off = await state();
  const offConfig = await evalUi(`window.micmix.getConfig()`);
  console.log('off:', JSON.stringify(off.fivemTune), '|', await statusText());
  await evalUi(`document.querySelector('${label}').click()`);
  await sleep(400);
  const on = await state();
  const onConfig = await evalUi(`window.micmix.getConfig()`);
  console.log('on:', JSON.stringify(on.fivemTune), '|', await statusText());
  if (off.fivemTune.enabled || offConfig.fivemTune !== false) throw new Error('off state not applied');
  if (!on.fivemTune.enabled || onConfig.fivemTune !== true) throw new Error('on state not applied');
  const okStates = ['applied', 'waiting', 'missing'];
  if (!okStates.includes(on.fivemTune.state) || !['restored', 'waiting', 'missing'].includes(off.fivemTune.state)) throw new Error('unexpected state: ' + JSON.stringify({ off: off.fivemTune, on: on.fivemTune }));
  console.log('FiveM tuning checks passed');
};
