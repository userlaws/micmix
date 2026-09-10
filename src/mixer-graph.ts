import type { Channel, MixerSettings, Meters } from './shared';
export const dbToGain = (db: number) => Math.pow(10, db / 20);
function peakGuard(context: BaseAudioContext) {
  // Compressor attack and makeup gain can still exceed full scale.
  // Pass normal samples unchanged; bound residual overload to -1 dBFS.
  const node = context.createWaveShaper(), curve = new Float32Array(8193), ceiling = dbToGain(-1);
  for (let i = 0; i < curve.length; i++) curve[i] = Math.max(-ceiling, Math.min(ceiling, 2 * i / (curve.length - 1) - 1));
  node.curve = curve; node.oversample = 'none';
  return node;
}
export function limiter(context: BaseAudioContext) {
  const node = context.createDynamicsCompressor();
  node.threshold.value = -1; node.knee.value = 0; node.ratio.value = 20;
  // 150 ms release: a 50 ms release on a ratio-20 limiter pumps audibly when voice and music both hit the ceiling.
  node.attack.value = 0.003; node.release.value = 0.15;
  return node;
}
export function createMixerGraph(context: BaseAudioContext, initial: MixerSettings) {
  const mic = context.createGain(), music = context.createGain(), soundboard = context.createGain();
  const master = context.createGain(), duck = context.createGain(), monitorMic = context.createGain();
  const monitorBus = context.createGain(), monitorLevel = context.createGain(), monitorMusic = context.createGain();
  // Voice headroom: the mic is routed either into the shared limiter with the music (micShared) or through
  // its own limiter (micDirect -> voiceMaster -> voiceLimiter) that only reacts to the voice's own peaks,
  // so loud music can never pump or squash speech. Both paths meet before the peak guard.
  const micShared = context.createGain(), micDirect = context.createGain(), voiceMaster = context.createGain();
  const compressor = limiter(context), voiceLimiter = limiter(context), monitorLimiter = limiter(context), mono = context.createGain();
  const guard = peakGuard(context), monitorGuard = peakGuard(context), overload = context.createAnalyser();
  overload.fftSize = 2048;
  const overloadSamples = new Float32Array(2048);
  const analysers = Object.fromEntries(['mic', 'music', 'soundboard', 'master'].map(name => {
    const analyser = context.createAnalyser(); analyser.fftSize = 2048;
    return [name, analyser];
  })) as Record<Channel, AnalyserNode>;
  const samples = Object.fromEntries(Object.keys(analysers).map(name => [name, new Float32Array(2048)])) as Record<Channel, Float32Array<ArrayBuffer>>;
  mic.connect(analysers.mic);
  analysers.mic.connect(micShared); micShared.connect(master);
  analysers.mic.connect(micDirect); micDirect.connect(voiceMaster); voiceMaster.connect(voiceLimiter); voiceLimiter.connect(overload);
  analysers.mic.connect(monitorMic); monitorMic.connect(monitorBus);
  music.connect(duck); duck.connect(analysers.music);
  soundboard.connect(analysers.soundboard);
  // Music and pads reach the outgoing mix via master, and the operator's monitor via monitorMusic,
  // so monitorMusicVolume changes headphones only and never the outgoing loudness.
  for (const node of [analysers.music, analysers.soundboard]) { node.connect(master); node.connect(monitorMusic); }
  monitorMusic.connect(monitorBus);
  master.connect(compressor); compressor.connect(overload); overload.connect(guard); guard.connect(mono); mono.connect(analysers.master);
  mono.channelCountMode = 'explicit'; mono.channelInterpretation = 'speakers';
  monitorBus.connect(monitorLimiter); monitorLimiter.connect(monitorGuard); monitorGuard.connect(monitorLevel);
  let settings = initial, ducked = false, target = 1;
  const smooth = (gain: AudioParam, value: number) => gain.setTargetAtTime(value, context.currentTime, 0.01);
  function updateDuck(rms: number) {
    const active = settings.ducking && !settings.muted.mic && settings.levels.mic > 0 && rms > dbToGain(settings.duckThreshold);
    const next = active ? dbToGain(settings.duckDb) : 1;
    if (next !== target) {
      duck.gain.setTargetAtTime(next, context.currentTime, active ? 0.05 : 0.4);
      target = next;
    }
    ducked = active;
  }
  function apply(next: MixerSettings) {
    settings = next;
    for (const [name, node] of Object.entries({ mic, music, soundboard, master }) as [Channel, GainNode][]) {
      smooth(node.gain, next.muted[name] ? 0 : next.levels[name]);
    }
    smooth(voiceMaster.gain, next.muted.master ? 0 : next.levels.master);
    smooth(micShared.gain, next.voiceHeadroom ? 0 : 1);
    smooth(micDirect.gain, next.voiceHeadroom ? 1 : 0);
    smooth(monitorBus.gain, next.muted.master ? 0 : next.levels.master);
    smooth(monitorMic.gain, next.monitorMic ? 1 : 0);
    smooth(monitorMusic.gain, next.monitorMusicVolume);
    smooth(monitorLevel.gain, next.monitor ? next.monitorVolume : 0);
    mono.channelCount = next.mono ? 1 : 2;
    if (!next.ducking || next.muted.mic || next.levels.mic === 0) updateDuck(0);
  }
  // Start silent until settings take effect; particularly the mic monitor must not leak on startup.
  for (const node of [mic, music, soundboard, master, voiceMaster, micShared, micDirect, monitorBus, monitorMic, monitorLevel, monitorMusic]) node.gain.value = 0;
  apply(initial);
  function meter(): Meters {
    const peaks = { mic: 0, music: 0, soundboard: 0, master: 0 };
    let micSquare = 0;
    for (const name of Object.keys(analysers) as Channel[]) {
      analysers[name].getFloatTimeDomainData(samples[name]);
      for (const sample of samples[name]) {
        peaks[name] = Math.max(peaks[name], Math.abs(sample));
        if (name === 'mic') micSquare += sample * sample;
      }
    }
    updateDuck(Math.sqrt(micSquare / samples.mic.length));
    overload.getFloatTimeDomainData(overloadSamples);
    // With headroom on only the voice limiter can touch speech. Without it, any shared reduction while the mic
    // carries signal is reduction applied to the voice too.
    const voiceReduction = settings.voiceHeadroom ? voiceLimiter.reduction : (peaks.mic > 0.02 ? compressor.reduction : 0);
    return { ...peaks, ducking: ducked, reduction: compressor.reduction, voiceReduction,
      overload: overloadSamples.some(sample => Math.abs(sample) > dbToGain(-1)) };
  }
  return { mic, music, soundboard, master, voiceMaster, virtualOut: analysers.master, monitorOut: monitorLevel,
    compressor, voiceLimiter, mono, duck, apply, meter, updateDuck };
}
