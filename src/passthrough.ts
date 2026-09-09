import { initialAudioState, emptyMeters, type AudioCommand, type AudioDevice, type AudioState, type LocalTrack, type YouTubeUpdate } from './shared';
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
let state = initialAudioState();
function publish(patch: Partial<AudioState>) {
  state = { ...state, ...patch };
  window.audioHost.state(state);
}
function disposeMusic() {
  ++playIntent;
  ++mediaVersion;
  if (activeYoutubeId) void window.audioHost.youtube({ type: 'pause' }).catch(() => {});
  activeYoutubeId = null;
  youtubeSource?.disconnect(); youtubeSource = null;
  youtubeStream?.getTracks().forEach(track => track.stop()); youtubeStream = null;
  if (element) {
    element.onended = element.onerror = element.onloadedmetadata = element.onpause = element.onplaying = null;
    element.pause(); element.removeAttribute('src'); element.load();
  }
  musicSource?.disconnect(); musicSource = null; element = null;
}
export function stop(error: string | null = null) {
  ++epoch;
  const position = element && Number.isFinite(element.currentTime) ? element.currentTime : state.position;
  disposeMusic();
  clearInterval(timer);
  if (graph) {
    for (const node of [graph.master, graph.monitorOut]) {
      node.gain.cancelScheduledValues(0); node.gain.value = 0; node.disconnect();
    }
    graph.virtualOut.disconnect();
  }
  graph = null;
  if (oscillator) { oscillator.onended = null; oscillator.stop(); oscillator.disconnect(); }
  oscillator = null;
  stream?.getTracks().forEach(track => track.stop()); stream = null;
  bridge?.stream.getTracks().forEach(track => track.stop()); bridge = null;
  const previousContexts = [context, monitorContext];
  context = monitorContext = null; sinkId = null;
  for (const previous of previousContexts) if (previous && previous.state !== 'closed') void previous.close().catch(() => {});
  publish({ status: 'off', micId: null, monitorId: null, tone: false, playing: false, buffering: false, position, error });
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
    publish({ status: 'live', monitorId: monitorId || null, error: null });
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
    if (state.index + 1 < state.queue.length) loadTrack(state.index + 1, true);
    else publish({ playing: false, position: audio.duration });
  };
  audio.src = track.url;
  audio.load();
  if (autoPlay) void play().catch(error => { if (active()) publish({ playing: false, error: String(error) }); });
}
async function play() {
  if (state.status !== 'live' || !context) throw new Error('Go LIVE before playing music.');
  if (state.index < 0 || !state.queue.length) throw new Error('Add a local audio file first.');
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
async function prepareYouTube(track: LocalTrack, position: number, autoPlay: boolean, version: number) {
  await window.audioHost.youtube({ type: 'load', videoId: track.youtubeId!, position });
  if (version !== mediaVersion) return;
  if (!context || !graph || state.status !== 'live') return;
  const ctx = context;
  // getDisplayMedia requires a video request. Discard its video track immediately;
  // the only audio source granted by main is the YouTube BrowserView's webContents.
  const captured = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 1 }, audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
  });
  if (version !== mediaVersion || ctx !== context || !graph) { captured.getTracks().forEach(t => t.stop()); return; }
  captured.getVideoTracks().forEach(t => t.stop());
  if (!captured.getAudioTracks().length) { captured.getTracks().forEach(t => t.stop()); throw new Error('Electron did not provide YouTube audio. Select the video again to retry.'); }
  youtubeStream = new MediaStream(captured.getAudioTracks());
  youtubeSource = ctx.createMediaStreamSource(youtubeStream);
  youtubeSource.connect(graph.music);
  youtubeStream.getAudioTracks().forEach(t => t.addEventListener('ended', () => {
    if (version === mediaVersion) {
      youtubeSource?.disconnect(); youtubeSource = null; youtubeStream = null;
      void window.audioHost.youtube({ type: 'pause' }).catch(() => {});
      publish({ playing: false, error: 'YouTube audio capture ended. Select the video again to retry.' });
    }
  }));
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
    const advance = state.playing && state.status === 'live';
    publish({ ...patch, playing: false, buffering: false });
    if (advance && state.index + 1 < state.queue.length) loadTrack(state.index + 1, true);
    return;
  }
  if (Object.keys(patch).length) publish(patch);
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
      ++playIntent;
      if (activeYoutubeId) await window.audioHost.youtube({ type: 'pause' });
      element?.pause(); publish({ playing: false }); break;
    case 'next':
      if (state.index + 1 < state.queue.length) loadTrack(state.index + 1, state.playing);
      else { element?.pause(); if (activeYoutubeId) await window.audioHost.youtube({ type: 'pause' }); publish({ playing: false }); }
      break;
    case 'select': loadTrack(value.index, state.playing); break;
    case 'seek':
      if (activeYoutubeId) { await window.audioHost.youtube({ type: 'seek', seconds: value.seconds }); publish({ position: value.seconds }); break; }
      if (!element || !Number.isFinite(element.duration)) throw new Error('Wait for the file to load before seeking.');
      element.currentTime = Math.min(value.seconds, element.duration);
      publish({ position: element.currentTime }); break;
    case 'remove': {
      if (!state.queue[value.index]) throw new Error('This queue item no longer exists.');
      const queue = state.queue.filter((_, index) => index !== value.index);
      const wasPlaying = state.playing;
      if (value.index === state.index) {
        disposeMusic(); publish({ queue, index: -1, position: 0, duration: 0, playing: false, buffering: false });
        if (queue.length) loadTrack(Math.min(value.index, queue.length - 1), wasPlaying);
      } else publish({ queue, index: value.index < state.index ? state.index - 1 : state.index });
      break;
    }
    case 'clear': disposeMusic(); publish({ queue: [], index: -1, position: 0, duration: 0, playing: false, buffering: false }); break;
  }
}
