const assert = require('node:assert/strict');
const { BrowserWindow } = require('electron');
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
module.exports = async function (ui, worker, root, _registerFiles, youtube) {
  const run = code => ui.webContents.executeJavaScript(code);
  async function waitFor(code, message) {
    for (let i = 0; i < 240; i++) { if (await run(code)) return; await sleep(100); }
    throw new Error(message + ': ' + await run('document.body.innerText'));
  }
  async function input(value) {
    await run(`(() => {
      const input = document.querySelector('input[aria-label="Search YouTube or paste a video link"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event('input', { bubbles: true })); input.focus();
    })()`);
    await sleep(50);
  }
  async function submit(mode = 'button') {
    if (mode === 'enter') {
      ui.focus(); ui.webContents.focus();
      ui.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Return' });
      ui.webContents.sendInputEvent({ type: 'char', keyCode: '\r' });
      ui.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Return' });
    } else await run('document.querySelector(".source-row button[type=submit]").click()');
  }
  await run('window.micmix.completeSetup()');
  await ui.loadURL(ui.webContents.getURL());
  await sleep(300);
  await mkdir(path.join(root, 'artifacts'), { recursive: true });
  for (const mode of ['enter', 'button']) {
    await input('drake');
    await submit(mode);
    await waitFor('document.querySelectorAll(".search-result").length > 0', mode + ' did not return results');
    assert.equal(BrowserWindow.getAllWindows().length, 2, 'Search opened another window');
    assert.equal(await run('document.querySelectorAll("iframe,video,webview").length'), 0);
    await waitFor('document.querySelector(".result-thumbnail img")?.naturalWidth > 0', 'Thumbnails did not load');
    assert.ok(await run('document.querySelectorAll(".result-duration").length > 0'));
    assert.ok(await run('document.querySelectorAll(".result-channel").length > 0'));
    console.log('PASS integrated search via', mode, ': results, thumbnails, metadata, no extra window');
    if (mode === 'button') {
      for (const width of [1400, 1000]) {
        ui.setSize(width, 980);
        await sleep(300);
        await run('document.querySelector(".card.music").scrollIntoView({block:"start"}); window.scrollBy(0,-44)');
        await sleep(200);
        assert.ok(await run('document.documentElement.scrollWidth <= window.innerWidth'), 'Horizontal overflow');
        const rect = await run('(() => { const r = document.querySelector(".card.music").getBoundingClientRect(); return {x:Math.floor(r.x),y:Math.max(0,Math.floor(r.y)),width:Math.ceil(r.width),height:Math.min(Math.floor(r.height),window.innerHeight - Math.max(0,Math.floor(r.y)))}; })()');
        await writeFile(path.join(root, 'artifacts', 'youtube-browser-' + width + '.png'), (await ui.webContents.capturePage(rect)).toPNG());
      }
    }
    await run('document.querySelector(".search-done").click()');
    await waitFor('!document.querySelector(".search-results")', 'Done did not close results');
  }
  const realFetch = global.fetch;
  // Controlled data checks queue behavior without loading a real YouTube player.
  const realCommand = youtube.command;
  youtube.command = async () => {};
  const fixture = 'ytInitialData = ' + JSON.stringify({ contents: [
    { videoRenderer: { videoId: 'M7lc1UVf-VE', title: { simpleText: 'First <song> }; & music' }, ownerText: { simpleText: 'Test artist' }, lengthText: { simpleText: '3:21' } } },
    { videoRenderer: { videoId: 'abcdefghijk', title: { simpleText: 'Second song' } } }
  ] }) + ';';
  global.fetch = async () => new Response(fixture);
  await input('test songs'); await submit();
  await waitFor('document.querySelectorAll(".search-result").length === 2', 'Fixture did not load');
  await run('document.querySelector(".result-thumbnail img").dispatchEvent(new Event("error"))');
  await waitFor('!!document.querySelector(".result-thumbnail > svg")', 'Missing thumbnail fallback');
  assert.equal(await run('document.querySelector(".result-info h4").textContent'), 'First <song> }; & music');
  await run('document.querySelectorAll(".result-add")[0].click()');
  await waitFor('document.querySelectorAll(".result-add.is-added").length === 1', 'Add did not mark queued result');
  await run('document.querySelectorAll(".result-add")[1].click()');
  await waitFor('document.querySelectorAll(".result-add.is-added").length === 2', 'Second add failed');
  const queued = await run('window.micmix.getAudioState()');
  assert.equal(queued.queue.length, 2);
  assert.equal(queued.index, 0, 'Adding a result interrupted the selected song');
  assert.equal(queued.queue[0].title, 'First <song> }; & music');
  assert.ok(await run('!!document.querySelector(".search-results")'), 'Adding closed the results');
  assert.equal(youtube.view.webContents.getURL(), '', 'Search started a video renderer');
  await run('document.querySelector(".search-done").click()');
  await input('https://www.youtube.com/watch?v=abcdefghijk'); await submit();
  await waitFor('document.querySelector(".source-row input").value === ""', 'Pasted video link did not load');
  assert.equal((await run('window.micmix.getAudioState()')).index, 2, 'Load link no longer selects the loaded track');
  console.log('PASS queue titles, multi-add, no interruption, literal markup, pasted links');
  await run('window.micmix.command({type:"clear"})');
  global.fetch = async () => { throw new Error('Test offline'); };
  await input('offline'); await submit();
  await waitFor('document.querySelector(".search-empty")?.textContent.includes("Test offline")', 'Network error missing');
  global.fetch = async () => new Response('ytInitialData = {};');
  await run('document.querySelector(".search-empty button").click()');
  await waitFor('document.querySelector(".search-empty h4")?.textContent === "No videos found"', 'Empty/retry state missing');
  let aborted = false;
  global.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => { aborted = true; reject(new Error('canceled')); }, { once: true });
  });
  await input('slow'); await submit();
  await waitFor('!!document.querySelector(".search-loading")', 'Loading state missing');
  await run('document.querySelector(".search-done").click()');
  await waitFor('!document.querySelector(".search-results")', 'Cancel failed');
  assert.ok(aborted, 'Cancellation did not abort the request');
  global.fetch = async () => new Response(fixture);
  await input('recovery'); await submit();
  await waitFor('document.querySelectorAll(".search-result").length === 2', 'Search did not recover');
  await run('document.querySelector(".source-row input").dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))');
  await waitFor('!document.querySelector(".search-results")', 'Escape failed');
  await input('switch tabs'); await submit();
  await waitFor('document.querySelectorAll(".search-result").length === 2', 'Tab test search did not load');
  await run('document.querySelectorAll(".segment button")[1].click()');
  await waitFor('!document.querySelector(".youtube-browser") && !!document.querySelector(".player")', 'Local tab failed to restore player');
  await run('document.querySelectorAll(".segment button")[0].click()');
  await waitFor('!!document.querySelector(".youtube-browser") && !document.querySelector(".search-results")', 'YouTube tab did not reset cleanly');
  global.fetch = realFetch; youtube.command = realCommand;
  console.log('PASS inline loading/error/empty states, retry, request cancellation, recovery, Escape');
};
