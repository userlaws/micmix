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
  console.log('Screenshots written:', JSON.stringify(layout));
};
