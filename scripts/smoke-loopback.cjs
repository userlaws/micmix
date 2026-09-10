const { readFile, writeFile } = require('node:fs/promises');
const path = require('node:path');
// Real-cable transparency measurement: MicMix plays known test signals into CABLE Input exactly as it plays music,
// while the hidden worker records CABLE Output (what Discord and FiveM receive). Proves whether the MicMix graph,
// Chromium's output, VB-CABLE and Windows resampling colour the sound before any voice app touches it.
// The signals are quiet tones (-26 dBFS each, then a -12 dBFS sine) and last about eight seconds; any app
// listening on CABLE Output during the run hears them.
module.exports = async function smoke(ui, worker, root, registerFiles) {
  const plan = JSON.parse(await readFile(path.join(root, 'artifacts', 'loopback-plan.json'), 'utf8'));
  const tracks = await registerFiles([path.join(root, 'artifacts', 'loopback-tones.wav'), path.join(root, 'artifacts', 'loopback-1k.wav')]);
  const evalUi = code => ui.webContents.executeJavaScript(code);
  const evalWorker = code => worker.webContents.executeJavaScript(code);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const state = () => evalUi('window.micmix.getAudioState()');
  const command = c => evalUi('window.micmix.command(' + JSON.stringify(c) + ')');
  const waitFor = async (predicate, what) => {
    for (let i = 0; i < 100; i++) { const s = await state(); if (s.error) throw new Error(s.error); if (predicate(s)) return s; await sleep(100); }
    throw new Error('Timed out waiting for ' + what);
  };
  const devices = (await evalUi('window.micmix.getReport()')).devices;
  const explicit = d => !['default', 'communications'].includes(d.deviceId) && !/CABLE/i.test(d.label);
  const mic = devices.find(d => d.kind === 'audioinput' && explicit(d));
  if (!mic) throw new Error('No physical microphone to open the engine with.');
  const initial = await state();
  // Mic muted and at 0: the physical mic contributes nothing, so the capture is only MicMix's own playback.
  await command({ type: 'settings', settings: { ...initial.settings, levels: { mic: 0, music: 1, soundboard: 0, master: 1 },
    muted: { mic: true, music: false, soundboard: false, master: false }, monitor: false, ducking: false } });
  await command({ type: 'enqueue', tracks });
  // The worker records CABLE Output with the same raw constraints MicMix uses for microphones.
  await evalWorker(`(async () => {
    const list = await navigator.mediaDevices.enumerateDevices();
    const cable = list.find(d => d.kind === 'audioinput' && /CABLE Output/i.test(d.label) && !['default', 'communications'].includes(d.deviceId));
    if (!cable) throw new Error('CABLE Output is missing.');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: cable.deviceId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
    const ctx = new AudioContext({ latencyHint: 'interactive' }); await ctx.setSinkId({ type: 'none' });
    const analyser = ctx.createAnalyser(); analyser.fftSize = ${plan.fft}; analyser.smoothingTimeConstant = 0;
    ctx.createMediaStreamSource(stream).connect(analyser); analyser.connect(ctx.destination); await ctx.resume();
    const track = stream.getAudioTracks()[0];
    window.__loop = { ctx, stream, analyser, label: cable.label, contextRate: ctx.sampleRate, trackSettings: track.getSettings() };
  })()`);
  const probeHz = plan.tones.concat([1000, 2000, 3000, 4000, 5000]);
  const measure = seconds => evalWorker(`(async () => {
    const { analyser, ctx } = window.__loop;
    const bins = analyser.frequencyBinCount, db = new Float32Array(bins), time = new Float32Array(analyser.fftSize);
    const sum = new Float64Array(bins); let frames = 0, peak = 0, square = 0, count = 0;
    const until = performance.now() + ${seconds} * 1000;
    while (performance.now() < until) {
      analyser.getFloatFrequencyData(db); analyser.getFloatTimeDomainData(time);
      for (let i = 0; i < bins; i++) sum[i] += Math.pow(10, db[i] / 20);
      for (const s of time) { peak = Math.max(peak, Math.abs(s)); square += s * s; count++; }
      frames++;
      await new Promise(r => setTimeout(r, 120));
    }
    const avg = Array.from(sum, v => 20 * Math.log10(v / frames + 1e-12));
    const binWidth = ctx.sampleRate / analyser.fftSize;
    const level = hz => { const k = Math.round(hz / binWidth); let best = -200; for (let i = k - 2; i <= k + 2; i++) best = Math.max(best, avg[i] ?? -200); return best; };
    const sorted = avg.slice(Math.round(20 / binWidth)).sort((a, b) => a - b);
    return { frames, peak, rms: Math.sqrt(square / count), level: Object.fromEntries(${JSON.stringify(probeHz)}.map(hz => [hz, level(hz)])), spectrumMedianDb: sorted[Math.floor(sorted.length / 2)] };
  })()`);
  const dB = v => 20 * Math.log10(Math.max(v, 1e-12));
  const report = { cable: await evalWorker('({ label: window.__loop.label, contextRate: window.__loop.contextRate, trackSettings: window.__loop.trackSettings })'), plan };
  try {
    await command({ type: 'start', deviceId: mic.deviceId });
    const live = await waitFor(s => s.status === 'live', 'LIVE');
    report.engine = live.engine;
    report.silence = await measure(1);
    await command({ type: 'select', index: 0 });
    await waitFor(s => s.duration > 0 && s.index === 0, 'multitone metadata');
    await command({ type: 'play' });
    await waitFor(s => s.playing && s.position > 0.8, 'multitone playback');
    report.multitone = await measure(3);
    await command({ type: 'select', index: 1 });
    await waitFor(s => s.duration > 0 && s.index === 1, '1 kHz metadata');
    await command({ type: 'play' });
    await waitFor(s => s.playing && s.position > 0.6, '1 kHz playback');
    report.sine = await measure(2);
  } finally {
    await command({ type: 'stop' }).catch(() => {});
    await evalWorker('window.__loop.stream.getTracks().forEach(t => t.stop()); window.__loop.ctx.close()').catch(() => {});
  }
  // Frequency response: every tone relative to the 1 kHz tone, all played at the same amplitude.
  const refTone = plan.tones.find(hz => Math.abs(hz - 1000) < 2);
  const ref = report.multitone.level[refTone];
  report.response = Object.fromEntries(plan.tones.map(hz => [hz, +(report.multitone.level[hz] - ref).toFixed(2)]));
  report.flatnessDb = +Math.max(...Object.values(report.response).map(Math.abs)).toFixed(2);
  // Level accuracy: the captured multitone peak against the peak of the generated file. Chromium's DynamicsCompressor
  // applies a fixed +0.57 dB makeup gain below threshold (threshold -1 dB, ratio 20), so +0.57 dB is the exact expectation.
  report.multitoneLevelErrorDb = +(dB(report.multitone.peak) - dB(plan.multitonePeak)).toFixed(2);
  report.sineLevelErrorDb = +(dB(report.sine.rms) - dB(plan.sineAmplitude / Math.SQRT2)).toFixed(2);
  // Distortion: harmonics of the -12 dBFS sine relative to its fundamental.
  const fundamental = report.sine.level[1000];
  report.harmonicsDb = Object.fromEntries([2000, 3000, 4000, 5000].map(hz => [hz, +(report.sine.level[hz] - fundamental).toFixed(1)]));
  report.thdDb = +(10 * Math.log10([2000, 3000, 4000, 5000].reduce((sum, hz) => sum + Math.pow(10, (report.sine.level[hz] - fundamental) / 10), 0))).toFixed(1);
  report.noiseFloorDbfs = +dB(report.silence.rms).toFixed(1);
  report.silencePeakDbfs = +dB(report.silence.peak).toFixed(1);
  await writeFile(path.join(root, 'artifacts', 'loopback.json'), JSON.stringify(report, null, 2));
  console.log('\nLoopback through ' + report.cable.label + ' (engine ' + (report.engine && report.engine.sampleRate) + ' Hz, capture ' + report.cable.contextRate + ' Hz)');
  console.table(Object.entries(report.response).map(([hz, dev]) => ({ hz: Number(hz), deviationDb: dev })));
  console.log('Flatness ±' + report.flatnessDb + ' dB · level ' + report.multitoneLevelErrorDb + ' / ' + report.sineLevelErrorDb + ' dB (limiter makeup gain is +0.57 dB) · THD ' + report.thdDb + ' dB · noise floor ' + report.noiseFloorDbfs + ' dBFS RMS');
  const problems = [];
  if (report.flatnessDb > 1) problems.push('frequency response deviates ' + report.flatnessDb + ' dB');
  if (Math.abs(report.multitoneLevelErrorDb) > 1 || Math.abs(report.sineLevelErrorDb) > 1) problems.push('level error exceeds 1 dB');
  if (report.thdDb > -50) problems.push('distortion ' + report.thdDb + ' dB');
  if (report.noiseFloorDbfs > -70) problems.push('noise floor ' + report.noiseFloorDbfs + ' dBFS');
  if (report.multitone.frames < 10 || report.sine.frames < 8) problems.push('too few analyser frames');
  if (problems.length) throw new Error('Loopback is NOT transparent: ' + problems.join('; '));
  console.log('Loopback is transparent: what reaches CABLE Output is what MicMix played.');
};
