const assert = require('node:assert/strict');
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
// Verifies the About/donation UI renders with the app version and VB-Audio attribution.
// No audio is produced.
module.exports = async function smoke(ui, worker, root) {
  const evalUi = code => ui.webContents.executeJavaScript(code);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // Fresh profile opens the wizard; finish it so the main screen (with the gear) is reachable.
  for (let i = 0; i < 60 && await evalUi(`!!document.querySelector('.wizard')`); i++) {
    const done = await evalUi(`(() => { const f = [...document.querySelectorAll('.wizard button')].find(b => b.textContent.trim().startsWith('Finish')); if (f) { f.click(); return true; } const n = [...document.querySelectorAll('.wizard-nav button')].find(b => b.textContent.trim().startsWith('Next') && !b.disabled); if (n) { n.click(); return false; } return null; })()`);
    if (done === null) break;
    await sleep(80);
  }
  await evalUi(`document.querySelector('.gear').click()`);
  await sleep(200);
  const about = await evalUi(`(() => {
    const heading = [...document.querySelectorAll('.about h2')][0];
    const buttons = [...document.querySelectorAll('.about button')].map(b => b.textContent.trim());
    const text = document.querySelector('.about')?.textContent || '';
    return { heading: heading?.textContent || '', buttons, mentionsVbAudio: /VB-Audio/.test(text), mentionsVbCable: /VB-CABLE/.test(text) };
  })()`);
  assert.match(about.heading, /About MicMix 1\.0\.0/, 'About shows app version: ' + about.heading);
  assert.ok(about.mentionsVbAudio && about.mentionsVbCable, 'About credits VB-CABLE / VB-Audio');
  assert.ok(about.buttons.some(b => /Donate/i.test(b)), 'Donation button present: ' + JSON.stringify(about.buttons));
  await mkdir(path.join(root, 'artifacts'), { recursive: true });
  await writeFile(path.join(root, 'artifacts', 'phase5-about.png'), (await ui.webContents.capturePage()).toPNG());
  await writeFile(path.join(root, 'artifacts', 'phase5-smoke.json'), JSON.stringify({ about }, null, 2));
  console.log('Phase 5 About checks passed:', JSON.stringify(about));
};
