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
  const mono = await render(false, false, true, 'music');
  results.monoChannelsEqual = mono.getChannelData(0).every((v, i) => Math.abs(v - mono.getChannelData(1)[i]) < 0.000001);
  assert(results.monoChannelsEqual, 'Mono output channels differ');
  const ctx = new OfflineAudioContext(1, 96000, 48000);
  const settings = structuredClone(defaultSettings);
  settings.levels.music = settings.levels.master = 1;
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
  return results;
}
