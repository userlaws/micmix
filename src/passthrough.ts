import { initialAudioState, emptyMeters, type AudioCommand, type AudioDevice, type AudioState, type LocalTrack, type YouTubeUpdate, type SoundPad } from './shared';
import { cableSink, microphoneChoices, playbackChoices } from './devices';
import { createMixerGraph } from './mixer-graph';

// All graph work, playback, duck detection, and metering live in this renderer.
let epoch = 0;
let context: AudioContext | null = null;
let monitorContext: AudioContext | null = null;
let stream: MediaStream | null = null;
let bridge: MediaStreamAudioDestinationNode | null = null;
let graph: ReturnType<typeof createMixerGraph> | null = null;
let oscillator: OscillatorNode | null = null;
let sinkId: string | null = null;
let timer: ReturnType<typeof setInterval> | undefined;
let element: HTMLAudioElement | null = null;
let musicSource: MediaElementAudioSourceNode | null = null;
let mediaVersion = 0;
let playIntent = 0;
let youtubeStream: MediaStream | null = null;
let youtubeSource: MediaStreamAudioSourceNode | null = null;
let activeYoutubeId: string | null = null;
let youtubeReady: Promise<void> = Promise.resolve();
let captureReady: Promise<void> | null = null;
// Auto-advance must not read state.playing at the moment a track ends: the YouTube player can report
// PAUSED or BUFFERING in the same breath as ENDED, which cleared the flag first and silently stopped
// the queue. Only an explicit pause (or going off air) should end playback, so intent is tracked here.
let paused = true;
// The mediaVersion whose end has already been handled, so a duplicate ENDED cannot double-skip.
// Playing or seeking clears it: replaying a track that already finished must end - and advance - again.
let endedVersion = -1;
let state = initialAudioState();
// Soundboard clips are decoded once per registered file and replayed from memory.
const padBuffers = new Map<string, AudioBuffer>();
const padSources = new Map<number, AudioBufferSourceNode>();
let padsVersion = 0;
function publish(patch: Partial<AudioState>) {
  state = { ...state, ...patch };
  window.audioHost.state(state);
}
// A finished track only rolls on to the next one when the operator asked for it.
function advanceOnEnd() {
  return state.settings.autoplay && state.index + 1 < state.queue.length;
}
function releaseCapture() {
  youtubeSource?.disconnect(); youtubeSource = null;
  youtubeStream?.getTracks().forEach(track => track.stop()); youtubeStream = null;
  captureReady = null;
}
function disposeMusic() {
  ++playIntent;
  ++mediaVersion;
  if (activeYoutubeId) void window.audioHost.youtube({ type: 'pause' }).catch(() => {});
  activeYoutubeId = null;
  // The captured YouTube stream is deliberately kept here: it belongs to the LIVE session, not to
  // a track. getDisplayMedia keeps delivering the view's audio across navigations and even while
  // the view is detached (scripts/smoke-capture-reuse.cjs), whereas a fresh request for a just
  // navigated view often fails with "Timeout starting video source" for about ten seconds - which
  // is what silently stopped the queue whenever one YouTube song auto-advanced to the next.
  if (element) {
    element.onended = element.onerror = element.onloadedmetadata = element.onpause = element.onplaying = null;
    element.pause(); element.removeAttribute('src'); element.load();
  }
  musicSource?.disconnect(); musicSource = null; element = null;
}
export function stop(error: string | null = null) {
  ++epoch;
  paused = true;
  stopPads();
  const position = element && Number.isFinite(element.currentTime) ? element.currentTime : state.position;
  disposeMusic();
  clearInterval(timer);
  if (graph) {
    for (const node of [graph.master, graph.voiceMaster, graph.monitorOut]) {
      node.gain.cancelScheduledValues(0); node.gain.value = 0; node.disconnect();
    }
    graph.virtualOut.disconnect();
  }
  graph = null;
  if (oscillator) { oscillator.onended = null; oscillator.stop(); oscillator.disconnect(); }
  oscillator = null;
  releaseCapture();
  stream?.getTracks().forEach(track => track.stop()); stream = null;
  bridge?.stream.getTracks().forEach(track => track.stop()); bridge = null;
  const previousContexts = [context, monitorContext];
  context = monitorContext = null; sinkId = null;
  for (const previous of previousContexts) if (previous && previous.state !== 'closed') void previous.close().catch(() => {});
  publish({ status: 'off', micId: null, monitorId: null, tone: false, playing: false, buffering: false, position, error, engine: null });
  window.audioHost.meters(emptyMeters);
}
export function checkDevices(devices: AudioDevice[]) {
  if (state.status !== 'live') return;
  if (!devices.some(d => d.deviceId === state.micId && d.kind === 'audioinput') ||
      !devices.some(d => d.deviceId === sinkId && d.kind === 'audiooutput') ||
      (state.monitorId && !playbackChoices(devices).some(d => d.deviceId === state.monitorId)) ||
      !devices.some(d => d.kind === 'audioinput' && /CABLE Output/i.test(d.label))) {
    stop('An active audio device disappeared. Reconnect it, rescan, and go LIVE again.');
  }
}
let refreshAfterLoss: () => Promise<void> = async () => {};
export function onDeviceLoss(callback: () => Promise<void>) { refreshAfterLoss = callback; }
function deviceFailure(message: string) { stop(message); void refreshAfterLoss(); }

async function start(deviceId: string, monitorId?: string) {
  stop();
  const operation = epoch;
  publish({ status: 'starting', micId: deviceId });
  let acquired: MediaStream | null = null;
  const created: AudioContext[] = [];
  const current = () => { if (operation !== epoch) throw new Error('Start cancelled.'); };
  try {
    const devices = await navigator.mediaDevices.enumerateDevices() as AudioDevice[];
    current();
    if (!microphoneChoices(devices).some(d => d.deviceId === deviceId)) {
      throw new Error('Select a real microphone. The virtual microphone cannot be used as its own input.');
    }
    const sink = cableSink(devices);
    if (!sink || !devices.some(d => d.kind === 'audioinput' && /CABLE Output/i.test(d.label))) {
      throw new Error('MicMix Virtual Mic is missing. Reconnect or repair VB-CABLE and rescan.');
    }
    if (monitorId && !playbackChoices(devices).some(d => d.deviceId === monitorId)) {
      throw new Error('Select real headphones for monitoring, not a virtual cable.');
    }
    if (state.settings.monitor && !monitorId) throw new Error('Select headphones, or disable monitoring in Settings.');
    if (!('setSinkId' in AudioContext.prototype)) throw new Error('This Electron version cannot select audio outputs.');
    acquired = await navigator.mediaDevices.getUserMedia({ audio: {
      deviceId: { exact: deviceId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false
    }, video: false });
    current(); stream = acquired;
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    created.push(ctx); context = ctx;
    await ctx.setSinkId(sink.deviceId); current();
    if (ctx.sinkId !== sink.deviceId) throw new Error('Virtual output selection did not take effect.');
    sinkId = sink.deviceId;
    if (monitorId) {
      const monitor = new AudioContext({ latencyHint: 'interactive' });
      created.push(monitor); monitorContext = monitor;
      await monitor.setSinkId(monitorId); current();
      if (monitor.sinkId !== monitorId) throw new Error('Headphone output selection did not take effect.');
    }
    graph = createMixerGraph(ctx, state.settings);
    graph.virtualOut.connect(ctx.destination);
    if (monitorContext) {
      bridge = ctx.createMediaStreamDestination();
      graph.monitorOut.connect(bridge);
      monitorContext.createMediaStreamSource(bridge.stream).connect(monitorContext.destination);
    }
    // Both outputs are selected before any real source is connected.
    ctx.createMediaStreamSource(acquired).connect(graph.mic);
    await Promise.all(created.map(c => c.resume())); current();
    if (created.some(c => c.state !== 'running') || acquired.getAudioTracks().some(t => t.readyState !== 'live')) {
      throw new Error('The microphone or audio engine could not start.');
    }
    for (const c of created) {
      const expectedSink = c === ctx ? sink.deviceId : monitorId;
      c.addEventListener('sinkchange', () => {
        if (operation === epoch && c.sinkId !== expectedSink) deviceFailure('Audio output changed. Output stopped; rescan devices.');
      });
      c.addEventListener('statechange', () => {
        if (operation === epoch && state.status === 'live' && c.state !== 'running') deviceFailure('Audio engine interrupted. Go LIVE again to retry.');
      });
    }
    acquired.getAudioTracks().forEach(track => track.addEventListener('ended', () => {
      if (operation === epoch) deviceFailure('Microphone disconnected. Reconnect it and rescan devices.');
    }));
    // Catch a device disappearing during asynchronous setup too.
    // Real engine rates for Diagnostics: Chromium resamples the mic to the context rate, and Windows resamples
    // the context to whatever it runs CABLE Input at, so both are reported beside the Windows endpoint formats.
    const micSettings = acquired.getAudioTracks()[0]?.getSettings() as (MediaTrackSettings & { sampleRate?: number; channelCount?: number }) | undefined;
    publish({ status: 'live', monitorId: monitorId || null, error: null,
      engine: { sampleRate: ctx.sampleRate, micSampleRate: micSettings?.sampleRate ?? null, micChannels: micSettings?.channelCount ?? null } });
    checkDevices(await navigator.mediaDevices.enumerateDevices() as AudioDevice[]);
    current();
    if (state.index >= 0) loadTrack(state.index, false, state.position);
    let ticks = 0;
    timer = setInterval(() => {
      if (!graph || operation !== epoch) return;
      window.audioHost.meters(graph.meter());
      if (++ticks % 5 === 0 && element && state.playing) publish({ position: element.currentTime });
    }, 50);
  } catch (error) {
    acquired?.getTracks().forEach(track => track.stop());
    if (operation === epoch) stop(error instanceof Error ? error.message : String(error));
    for (const c of created) if (c !== context && c !== monitorContext && c.state !== 'closed') void c.close().catch(() => {});
    throw error;
  }
}

function loadTrack(index: number, autoPlay: boolean, position = 0) {
  if (!state.queue[index]) throw new Error('This queue item no longer exists.');
  const track = state.queue[index];
  disposeMusic();
  if (autoPlay) paused = false;
  publish({ index, position, duration: 0, playing: false, buffering: false, error: null });
  if (track.youtubeId) {
    activeYoutubeId = track.youtubeId;
    const version = mediaVersion;
    youtubeReady = prepareYouTube(track, position, autoPlay, version);
    void youtubeReady.catch(error => { if (version === mediaVersion) publish({ playing: false, error: error instanceof Error ? error.message : String(error) }); });
    return;
  }
  if (!context || !graph) return;
  const audio = new Audio();
  element = audio; audio.preload = 'metadata';
  musicSource = context.createMediaElementSource(audio);
  musicSource.connect(graph.music);
  const version = mediaVersion;
  const active = () => element === audio && version === mediaVersion && state.status === 'live';
  audio.onloadedmetadata = () => {
    if (!active()) return;
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) { publish({ error: 'This file has no playable duration.' }); return; }
    audio.currentTime = Math.min(position, audio.duration);
    publish({ duration: audio.duration, position: audio.currentTime });
  };
  audio.onplaying = () => { if (active()) publish({ playing: true, error: null }); };
  audio.onpause = () => { if (active()) publish({ playing: false, position: audio.currentTime }); };
  audio.onerror = () => {
    if (active()) publish({ playing: false, error: 'Cannot play "' + track.title + '". The file may be missing, damaged, or use an unsupported codec. Skip it or choose another.' });
  };
  audio.onended = () => {
    if (!active()) return;
    if (advanceOnEnd()) loadTrack(state.index + 1, true);
    else { paused = true; publish({ playing: false, position: audio.duration }); }
  };
  audio.src = track.url;
  audio.load();
  if (autoPlay) void play().catch(error => { if (active()) publish({ playing: false, error: String(error) }); });
}
async function play() {
  if (state.status !== 'live' || !context) throw new Error('Go LIVE before playing music.');
  if (state.index < 0 || !state.queue.length) throw new Error('Add a local audio file first.');
  paused = false; endedVersion = -1;
  if (state.queue[state.index].youtubeId) {
    const version = mediaVersion, intent = ++playIntent;
    await youtubeReady;
    if (version !== mediaVersion || intent !== playIntent || state.status !== 'live') throw new Error('Playback cancelled.');
    if (!youtubeStream) throw new Error('YouTube audio capture is unavailable. Select the video again to retry.');
    await window.audioHost.youtube({ type: 'play' });
    return;
  }
  if (!element) loadTrack(state.index, false, state.position);
  const audio = element!;
  const version = mediaVersion;
  const intent = ++playIntent;
  await audio.play();
  if (element !== audio || version !== mediaVersion || intent !== playIntent || state.status !== 'live') {
    audio.pause(); throw new Error('Playback cancelled.');
  }
  publish({ playing: true });
}
// Chromium regularly answers the first request for a freshly navigated view with
// "Timeout starting video source" after about ten seconds, so the request gets one retry.
// This only runs once per LIVE session now, never once per track.
async function requestCapture(current: () => boolean): Promise<MediaStream> {
  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!current()) throw new Error('Playback cancelled.');
    try {
      // getDisplayMedia requires a video request. Its video track is discarded straight away;
      // the only source main ever grants is the YouTube BrowserView's own webContents.
      return await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 1 }, audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
    } catch (error) {
      last = error;
      await new Promise(resolve => setTimeout(resolve, 400));
    }
  }
  throw new Error('Electron could not capture the YouTube audio (' +
    (last instanceof Error ? last.message : String(last)) + '). Select the video again to retry.');
}
// One capture for the whole LIVE session, shared by every YouTube track in the queue.
function captureYouTube(): Promise<void> {
  if (youtubeStream?.getAudioTracks().some(track => track.readyState === 'live')) return Promise.resolve();
  if (captureReady) return captureReady;
  const operation = epoch;
  const ctx = context;
  const attempt = (async () => {
    if (!ctx || !graph || state.status !== 'live') throw new Error('Go LIVE before playing YouTube audio.');
    const captured = await requestCapture(() => operation === epoch && ctx === context);
    if (operation !== epoch || ctx !== context || !graph) { captured.getTracks().forEach(t => t.stop()); throw new Error('Playback cancelled.'); }
    captured.getVideoTracks().forEach(t => t.stop());
    if (!captured.getAudioTracks().length) { captured.getTracks().forEach(t => t.stop()); throw new Error('Electron did not provide YouTube audio. Select the video again to retry.'); }
    youtubeStream = new MediaStream(captured.getAudioTracks());
    youtubeSource = ctx.createMediaStreamSource(youtubeStream);
    youtubeSource.connect(graph.music);
    youtubeStream.getAudioTracks().forEach(track => track.addEventListener('ended', () => {
      if (operation !== epoch) return;
      releaseCapture();
      void window.audioHost.youtube({ type: 'pause' }).catch(() => {});
      publish({ playing: false, error: 'YouTube audio capture ended. Select the video again to retry.' });
    }));
  })();
  captureReady = attempt;
  // A failed request must not poison the session: clear it so the next track can try again.
  attempt.catch(() => { if (captureReady === attempt) captureReady = null; });
  return attempt;
}
async function prepareYouTube(track: LocalTrack, position: number, autoPlay: boolean, version: number) {
  await window.audioHost.youtube({ type: 'load', videoId: track.youtubeId!, position });
  if (version !== mediaVersion) return;
  if (!context || !graph || state.status !== 'live') return;
  await captureYouTube();
  if (version !== mediaVersion || state.status !== 'live') return;
  if (autoPlay) await window.audioHost.youtube({ type: 'play' });
}
export function youtubeUpdate(update: YouTubeUpdate) {
  if (!activeYoutubeId || update.videoId !== activeYoutubeId) return;
  const patch: Partial<AudioState> = {};
  if (update.title) patch.queue = state.queue.map(track => track.youtubeId === update.videoId ? { ...track, title: update.title! } : track);
  if (Number.isFinite(update.position)) patch.position = Math.max(0, update.position!);
  if (Number.isFinite(update.duration)) patch.duration = Math.max(0, update.duration!);
  if (update.error) { patch.error = update.error; patch.playing = false; }
  if (update.playerState === 1) {
    if (state.status !== 'live' || !youtubeStream) { void window.audioHost.youtube({ type: 'pause' }).catch(() => {}); }
    else { patch.playing = true; patch.buffering = false; patch.error = null; }
  } else if (update.playerState === 3) patch.buffering = true;
  else if (update.playerState === 2 || update.playerState === 5) { patch.playing = false; patch.buffering = false; }
  if (update.playerState === 0) {
    // YouTube can deliver ENDED more than once for the same video (onStateChange plus infoDelivery),
    // so the end of a track is handled once per mediaVersion.
    const ended = !paused && state.status === 'live' && endedVersion !== mediaVersion;
    endedVersion = mediaVersion;
    publish({ ...patch, playing: false, buffering: false });
    if (ended) {
      if (advanceOnEnd()) loadTrack(state.index + 1, true);
      else paused = true;
    }
    return;
  }
  if (Object.keys(patch).length) publish(patch);
}
function updatePad(slot: number, patch: Partial<AudioState['pads'][number]>) {
  publish({ pads: state.pads.map((pad, index) => index === slot && pad ? { ...pad, ...patch } : pad) });
}
function publishActivePads() { publish({ activePads: [...padSources.keys()].sort((a, b) => a - b) }); }
async function setPads(pads: (SoundPad | null)[]) {
  const version = ++padsVersion;
  stopPads();
  publish({ pads: pads.map(pad => pad ? { ...pad, ready: padBuffers.has(pad.id), error: null } : null) });
  const keep = new Set(pads.filter((pad): pad is SoundPad => !!pad).map(pad => pad.id));
  for (const id of [...padBuffers.keys()]) if (!keep.has(id)) padBuffers.delete(id);
  await Promise.all(pads.map(async (pad, slot) => {
    if (!pad || padBuffers.has(pad.id)) return;
    try {
      const bytes = await window.audioHost.readClip(pad.id);
      const data = bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const buffer = await new OfflineAudioContext(2, 48000, 48000).decodeAudioData(data);
      if (buffer.duration > 60) throw new Error('Soundboard clips must be 60 seconds or shorter.');
      if (version !== padsVersion) return;
      padBuffers.set(pad.id, buffer);
      updatePad(slot, { ready: true, error: null });
    } catch (error) {
      if (version === padsVersion) updatePad(slot, { ready: false, error: 'Cannot load "' + pad.title + '": ' + (error instanceof Error ? error.message : String(error)) });
    }
  }));
}
function playPad(slot: number) {
  if (!context || !graph || state.status !== 'live') throw new Error('Go LIVE before playing soundboard clips.');
  const pad = state.pads[slot];
  if (!pad) throw new Error('This pad is empty. Use Edit to choose a clip.');
  const existing = padSources.get(slot);
  if (existing) { existing.stop(); return; }
  const buffer = padBuffers.get(pad.id);
  if (!buffer) throw new Error(pad.error ?? 'This clip is still loading.');
  const source = context.createBufferSource();
  source.buffer = buffer; source.connect(graph.soundboard);
  source.onended = () => {
    source.disconnect();
    if (padSources.get(slot) === source) { padSources.delete(slot); publishActivePads(); }
  };
  padSources.set(slot, source); source.start(); publishActivePads();
}
function stopPads() {
  for (const source of padSources.values()) { source.onended = null; try { source.stop(); } catch { /* already ended */ } source.disconnect(); }
  padSources.clear();
  if (state.activePads.length) publish({ activePads: [] });
}
function tone() {
  if (!context || !graph || state.status !== 'live') throw new Error('Go LIVE before testing the virtual output.');
  if (oscillator) return;
  const ctx = context, node = ctx.createOscillator(), envelope = ctx.createGain(), now = ctx.currentTime;
  node.frequency.value = 440;
  envelope.gain.setValueAtTime(0, now);
  envelope.gain.linearRampToValueAtTime(0.1, now + 0.02);
  envelope.gain.setValueAtTime(0.1, now + 1.45);
  envelope.gain.linearRampToValueAtTime(0, now + 1.5);
  node.connect(envelope); envelope.connect(graph.master);
  oscillator = node;
  node.onended = () => {
    node.disconnect(); envelope.disconnect();
    if (oscillator === node) { oscillator = null; publish({ tone: false }); }
  };
  node.start(now); node.stop(now + 1.52); publish({ tone: true });
}
export async function command(value: AudioCommand) {
  switch (value.type) {
    case 'start': await start(value.deviceId, value.monitorId); break;
    case 'stop': stop(); break;
    case 'tone': tone(); break;
    case 'settings':
      if (state.status === 'live' && value.settings.monitor && !monitorContext) throw new Error('Go OFF AIR and choose headphones before enabling monitoring.');
      publish({ settings: value.settings }); graph?.apply(value.settings); break;
    case 'enqueue':
      if (state.queue.length + value.tracks.length > 500) throw new Error('Queue limit is 500 tracks.');
      publish({ queue: [...state.queue, ...value.tracks], error: null });
      if (state.index < 0 && state.queue.length) loadTrack(0, false);
      break;
    case 'play': await play(); break;
    case 'pause':
      paused = true;
      ++playIntent;
      if (activeYoutubeId) await window.audioHost.youtube({ type: 'pause' });
      element?.pause(); publish({ playing: false }); break;
    case 'next':
      if (state.index + 1 < state.queue.length) loadTrack(state.index + 1, !paused);
      else { paused = true; element?.pause(); if (activeYoutubeId) await window.audioHost.youtube({ type: 'pause' }); publish({ playing: false }); }
      break;
    case 'select': loadTrack(value.index, !paused); break;
    case 'seek':
      endedVersion = -1;
      if (activeYoutubeId) { await window.audioHost.youtube({ type: 'seek', seconds: value.seconds }); publish({ position: value.seconds }); break; }
      if (!element || !Number.isFinite(element.duration)) throw new Error('Wait for the file to load before seeking.');
      element.currentTime = Math.min(value.seconds, element.duration);
      publish({ position: element.currentTime }); break;
    case 'remove': {
      if (!state.queue[value.index]) throw new Error('This queue item no longer exists.');
      const queue = state.queue.filter((_, index) => index !== value.index);
      const wasPlaying = !paused;
      if (value.index === state.index) {
        disposeMusic(); publish({ queue, index: -1, position: 0, duration: 0, playing: false, buffering: false });
        if (queue.length) loadTrack(Math.min(value.index, queue.length - 1), wasPlaying);
      } else publish({ queue, index: value.index < state.index ? state.index - 1 : state.index });
      break;
    }
    case 'clear': disposeMusic(); publish({ queue: [], index: -1, position: 0, duration: 0, playing: false, buffering: false }); break;
    case 'pads': await setPads(value.pads); break;
    case 'pad': playPad(value.slot); break;
    case 'stopPads': stopPads(); break;
  }
}
