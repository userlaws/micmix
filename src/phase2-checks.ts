import { createMixerGraph } from './mixer-graph';
import { defaultSettings } from './shared';
function assert(ok: boolean, message: string) { if (!ok) throw new Error(message); }
const peak = (data: Float32Array) => data.reduce((p, v) => Math.max(p, Math.abs(v)), 0);
export async function run() {
  const results: Record<string, number | boolean> = {};
  // Render real Web Audio nodes offline: no hardware destinations are involved.
  async function render(monitor: boolean, includeMic: boolean, mono: boolean, source: 'mic' | 'music') {
    const ctx = new OfflineAudioContext(2, 48000, 48000);
    const settings = structuredClone(defaultSettings);
    settings.levels = { mic: 1, music: 1, soundboard: 1, master: 1 };
    settings.monitorVolume = 1; settings.monitorMic = includeMic; settings.mono = mono;
    const graph = createMixerGraph(ctx, settings);
    const buffer = ctx.createBuffer(2, 48000, 48000);
    for (let i = 0; i < 48000; i++) {
      buffer.getChannelData(0)[i] = Math.sin(i * 2 * Math.PI * 220 / 48000) * 0.2;
      buffer.getChannelData(1)[i] = Math.sin(i * 2 * Math.PI * 220 / 48000) * 0.6;
    }
    const node = ctx.createBufferSource(); node.buffer = buffer; node.connect(graph[source]);
    (monitor ? graph.monitorOut : graph.virtualOut).connect(ctx.destination); node.start();
    return ctx.startRendering();
  }
  const excluded = await render(true, false, false, 'mic');
  results.monitorWithoutMicPeak = peak(excluded.getChannelData(0));
  assert(results.monitorWithoutMicPeak === 0, 'Mic leaked into default monitor');
  const included = await render(true, true, false, 'mic');
  results.monitorWithMicPeak = peak(included.getChannelData(0));
  assert(results.monitorWithMicPeak > 0.1, 'Include-mic monitor has no signal');
  const music = await render(true, false, false, 'music');
  results.monitorMusicPeak = peak(music.getChannelData(0));
  assert(results.monitorMusicPeak > 0.1, 'Music missing from monitor');
  // A quarter headphone-music level must quarter the monitor music but leave the outgoing mix untouched.
  async function musicPeak(monitor: boolean, monitorMusicVolume: number) {
    const c = new OfflineAudioContext(2, 48000, 48000);
    const st = structuredClone(defaultSettings);
    st.levels = { mic: 1, music: 1, soundboard: 1, master: 1 }; st.monitorVolume = 1; st.monitorMusicVolume = monitorMusicVolume;
    const g = createMixerGraph(c, st);
    const b = c.createBuffer(1, 48000, 48000);
    for (let i = 0; i < 48000; i++) b.getChannelData(0)[i] = Math.sin(i * 2 * Math.PI * 220 / 48000) * 0.4;
    const n = c.createBufferSource(); n.buffer = b; n.connect(g.music);
    (monitor ? g.monitorOut : g.virtualOut).connect(c.destination); n.start();
    return peak((await c.startRendering()).getChannelData(0));
  }
  const [monFull, monQuarter, outFull, outQuarter] = await Promise.all([musicPeak(true, 1), musicPeak(true, 0.25), musicPeak(false, 1), musicPeak(false, 0.25)]);
  results.monitorMusicQuarterRatio = monQuarter / monFull;
  assert(results.monitorMusicQuarterRatio > 0.2 && results.monitorMusicQuarterRatio < 0.3, 'Headphone music level did not scale monitor music');
  assert(Math.abs(outFull - outQuarter) < 0.001, 'Headphone music level leaked into the outgoing mix');
  const mono = await render(false, false, true, 'music');
  results.monoChannelsEqual = mono.getChannelData(0).every((v, i) => Math.abs(v - mono.getChannelData(1)[i]) < 0.000001);
  assert(results.monoChannelsEqual, 'Mono output channels differ');
  const ctx = new OfflineAudioContext(1, 96000, 48000);
  const settings = structuredClone(defaultSettings);
  settings.levels.music = settings.levels.master = 1; settings.duckDb = -12;
  const graph = createMixerGraph(ctx, settings);
  const source = ctx.createConstantSource(); source.offset.value = 0.1; source.connect(graph.music);
  graph.virtualOut.connect(ctx.destination); source.start();
  const at = async (seconds: number, rms: number) => { await ctx.suspend(seconds); graph.updateDuck(rms); void ctx.resume(); };
  const attack = at(0.2, 0.1), release = at(0.8, 0);
  const rendered = await ctx.startRendering(); await Promise.all([attack, release]);
  const values = rendered.getChannelData(0);
  const mean = (from: number, to: number) => {
    const data = values.subarray(Math.round(from * 48000), Math.round(to * 48000));
    return data.reduce((sum, n) => sum + Math.abs(n), 0) / data.length;
  };
  results.duckRatio = mean(0.65, 0.75) / mean(0.12, 0.18);
  results.releaseRatio = mean(1.85, 1.95) / mean(0.12, 0.18);
  assert(results.duckRatio > 0.24 && results.duckRatio < 0.27, 'Duck depth does not match -12 dB');
  assert(results.releaseRatio > 0.9, 'Ducking does not release');
  const overload = new OfflineAudioContext(1, 48000, 48000);
  const limiting = createMixerGraph(overload, { ...settings, levels: { mic: 1, music: 1, soundboard: 1, master: 1 } });
  const constant = overload.createConstantSource(); constant.offset.value = 1;
  constant.connect(limiting.mic); constant.connect(limiting.music); constant.connect(limiting.soundboard);
  limiting.virtualOut.connect(overload.destination); constant.start();
  const limited = await overload.startRendering();
  results.limitedSteadyPeak = peak(limited.getChannelData(0).subarray(12000));
  assert(results.limitedSteadyPeak < 1, 'Steady overload exceeds full scale');
  results.limitedTransientPeak = peak(limited.getChannelData(0));
  // Voice headroom: a quiet voice (1 kHz at -26 dBFS) under music summing to +9.5 dBFS (as a hot mic plus full music does) must survive unchanged when the
  // voice has its own limiter, and is measurably squashed when it shares the music's limiter.
  async function voiceUnderMusic(voiceHeadroom: boolean, musicLevel: number) {
    const c = new OfflineAudioContext(1, 96000, 48000);
    const st = structuredClone(defaultSettings);
    st.levels = { mic: 1, music: 1, soundboard: 1, master: 1 }; st.ducking = false; st.voiceHeadroom = voiceHeadroom;
    const g = createMixerGraph(c, st);
    const voice = c.createOscillator(); voice.frequency.value = 1000;
    const voiceGain = c.createGain(); voiceGain.gain.value = 0.05; voice.connect(voiceGain); voiceGain.connect(g.mic);
    const bed = c.createOscillator(); bed.frequency.value = 50;
    const bedGain = c.createGain(); bedGain.gain.value = musicLevel; bed.connect(bedGain); bedGain.connect(g.music);
    g.virtualOut.connect(c.destination); voice.start(); bed.start();
    const data = (await c.startRendering()).getChannelData(0).subarray(48000);
    // Goertzel at 1 kHz: amplitude of the voice tone in the output.
    const w = 2 * Math.PI * 1000 / 48000; let s0 = 0, s1 = 0, s2 = 0;
    for (const x of data) { s0 = x + 2 * Math.cos(w) * s1 - s2; s2 = s1; s1 = s0; }
    return 2 * Math.sqrt(s1 * s1 + s2 * s2 - 2 * Math.cos(w) * s1 * s2) / data.length;
  }
  results.voiceAloneHeadroom = await voiceUnderMusic(true, 0);
  results.voiceAloneShared = await voiceUnderMusic(false, 0);
  results.voiceUnderMusicHeadroom = await voiceUnderMusic(true, 3);
  results.voiceUnderMusicShared = await voiceUnderMusic(false, 3);
  // Music at the ducked level (-8 dB below a full-scale peak) is the everyday case: the voice must pass untouched.
  results.voiceUnderDuckedMusicHeadroom = await voiceUnderMusic(true, 0.35);
  // Chromium's DynamicsCompressor adds a fixed ~0.6 dB makeup gain below threshold on every path, so the headroom
  // path must match the shared path exactly rather than the raw 0.05 input.
  assert(Math.abs(results.voiceAloneHeadroom - results.voiceAloneShared) < 0.001 && results.voiceAloneHeadroom > 0.045 && results.voiceAloneHeadroom < 0.06,
    'Voice headroom path is not transparent: ' + results.voiceAloneHeadroom + ' vs shared ' + results.voiceAloneShared);
  // Under an extreme +9.5 dBFS bed the peak guard still clips the summed peaks (the voice cannot fit above music that
  // already sits at the ceiling), but the voice must survive far better than through the shared limiter.
  assert(Math.abs(results.voiceUnderDuckedMusicHeadroom - results.voiceAloneHeadroom) < 0.001, 'Voice headroom altered the voice under ducked music: ' + results.voiceUnderDuckedMusicHeadroom);
  assert(results.voiceUnderMusicHeadroom > 0.025, 'Voice headroom did not protect the voice under loud music: ' + JSON.stringify({ alone: results.voiceAloneHeadroom, headroom: results.voiceUnderMusicHeadroom, shared: results.voiceUnderMusicShared }));
  assert(results.voiceUnderMusicShared < results.voiceUnderMusicHeadroom / 2.5, 'Shared limiter unexpectedly left the voice intact: ' + JSON.stringify({ headroom: results.voiceUnderMusicHeadroom, shared: results.voiceUnderMusicShared }));
  return results;
}
