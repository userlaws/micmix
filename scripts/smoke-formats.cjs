const assert = require('node:assert/strict');
// Diagnostics > Sample rates must fill in from the Windows registry within a few seconds of opening Settings.
module.exports = async function smoke(ui) {
  const evalUi = code => ui.webContents.executeJavaScript(code);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 60 && !(await evalUi(`!!document.querySelector('.wizard')`)); i++) await sleep(50);
  await evalUi('window.micmix.completeSetup()');
  await evalUi(`(async () => { for (let i = 0; i < 60 && document.querySelector('.wizard'); i++) { const f = [...document.querySelectorAll('.wizard button')].find(b => b.textContent.trim().startsWith('Finish')); if (f) { f.click(); break; } const n = [...document.querySelectorAll('.wizard-nav button')].find(b => b.textContent.trim().startsWith('Next') && !b.disabled); if (n) n.click(); await new Promise(r => setTimeout(r, 60)); } })()`);
  await sleep(300);
  const started = Date.now();
  const direct = await evalUi(`window.micmix.getEndpointFormats()`);
  const directMs = Date.now() - started;
  assert.ok(direct.some(f => f.flow === 'render' && /CABLE Input/i.test(f.label)), 'CABLE Input format missing');
  assert.ok(direct.some(f => f.flow === 'capture' && /CABLE Output/i.test(f.label)), 'CABLE Output format missing');
  assert.ok(direct.every(f => f.sampleRate >= 8000 && f.sampleRate <= 384000 && f.channels >= 1 && f.bits >= 8), 'Implausible endpoint format');
  const t0 = Date.now();
  await evalUi(`document.querySelector('.gear').click()`);
  let text = '';
  for (let i = 0; i < 50; i++) {
    text = (await evalUi(`document.querySelector('.sample-rates')?.innerText`)) || '';
    if (text && !/^Sample rates\nunknown/.test(text)) break;
    await sleep(100);
  }
  const rowMs = Date.now() - t0;
  console.log('Sample rates (' + direct.length + ' endpoints in ' + directMs + ' ms, row filled in ' + rowMs + ' ms):', text.replace(/\n/g, ' | '));
  assert.match(text, /CABLE Input [\d,.]+ Hz/, 'Row did not show the CABLE Input rate');
  assert.match(text, /^Sample rates\n(aligned|mismatch)/, 'Row status did not resolve');
  assert.ok(rowMs < 4000, 'Sample rates took too long: ' + rowMs + ' ms');
};
