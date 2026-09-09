import type { AudioCommand, AudioDevice, AudioState } from './shared';
import { cableSink, microphoneChoices } from './devices';

// This module runs only in the hidden renderer. No UI timer drives audio.
let epoch = 0;
let context: AudioContext | null = null;
let stream: MediaStream | null = null;
let master: GainNode | null = null;
let oscillator: OscillatorNode | null = null;
let sinkId: string | null = null;
let state: AudioState = { status: 'off', micId: null, tone: false, error: null };
function publish(patch: Partial<AudioState>) {
  state = { ...state, ...patch };
  window.audioHost.state(state);
}
export function stop(error: string | null = null) {
  ++epoch; // Invalidates any pending getUserMedia/setSinkId/resume completion.
  const old = context;
  context = null;
  if (master) { master.gain.cancelScheduledValues(0); master.gain.value = 0; master.disconnect(); }
  master = null;
  if (oscillator) { oscillator.onended = null; oscillator.stop(); oscillator.disconnect(); }
  oscillator = null;
  stream?.getTracks().forEach(track => track.stop());
  stream = null; sinkId = null;
  if (old && old.state !== 'closed') void old.close().catch(() => {});
  publish({ status: 'off', micId: null, tone: false, error });
}
export function checkDevices(devices: AudioDevice[]) {
  if (state.status !== 'live') return;
  if (!devices.some(d => d.deviceId === state.micId && d.kind === 'audioinput') ||
      !devices.some(d => d.deviceId === sinkId && d.kind === 'audiooutput') ||
      !devices.some(d => d.kind === 'audioinput' && /CABLE Output/i.test(d.label))) {
    stop('An active audio device disappeared. Reconnect it, rescan, and go LIVE again.');
  }
}
async function start(deviceId: string) {
  stop();
  const operation = epoch;
  publish({ status: 'starting', micId: deviceId });
  let acquired: MediaStream | null = null;
  let created: AudioContext | null = null;
  const current = () => { if (operation !== epoch) throw new Error('Start cancelled.'); };
  try {
    const devices = (await navigator.mediaDevices.enumerateDevices()) as AudioDevice[];
    current();
    if (!microphoneChoices(devices).some(d => d.deviceId === deviceId)) {
      throw new Error('Select a real microphone. The virtual microphone cannot be used as its own input.');
    }
    const sink = cableSink(devices);
    if (!sink || !devices.some(d => d.kind === 'audioinput' && /CABLE Output/i.test(d.label))) {
      throw new Error('MicMix Virtual Mic is missing. Reconnect or repair VB-CABLE and rescan.');
    }
    if (!('setSinkId' in AudioContext.prototype)) throw new Error('This Electron version cannot select the virtual audio output.');
    acquired = await navigator.mediaDevices.getUserMedia({ audio: {
      deviceId: { exact: deviceId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false
    }, video: false });
    current();
    stream = acquired;
    created = new AudioContext({ latencyHint: 'interactive' });
    context = created;
    // No source is connected until output selection has succeeded.
    await created.setSinkId(sink.deviceId);
    current();
    if (created.sinkId !== sink.deviceId) throw new Error('Virtual output selection did not take effect.');
    sinkId = sink.deviceId;
    const source = created.createMediaStreamSource(acquired);
    master = created.createGain();
    master.gain.value = 0;
    source.connect(master);
    master.connect(created.destination);
    await created.resume();
    current();
    if (created.state !== 'running' || acquired.getAudioTracks().some(t => t.readyState !== 'live')) {
      throw new Error('The microphone or audio engine could not start.');
    }
    const activeContext = created;
    created.addEventListener('sinkchange', () => {
      if (context === activeContext && activeContext.sinkId !== sink.deviceId) stop('Virtual output changed. Output stopped; rescan devices.');
    });
    created.addEventListener('statechange', () => {
      if (context === activeContext && state.status === 'live' && activeContext.state !== 'running') {
        stop('Audio engine was interrupted. Go LIVE again to retry.');
      }
    });
    acquired.getAudioTracks().forEach(track => track.addEventListener('ended', () => {
      if (operation === epoch) { stop('Microphone disconnected. Reconnect it and rescan devices.'); void refreshAfterLoss(); }
    }));
    master.gain.setTargetAtTime(1, created.currentTime, 0.01);
    publish({ status: 'live', error: null });
  } catch (error) {
    acquired?.getTracks().forEach(track => track.stop());
    if (created && created !== context && created.state !== 'closed') void created.close().catch(() => {});
    if (operation === epoch) stop(error instanceof Error ? error.message : String(error));
    throw error;
  }
}
let refreshAfterLoss: () => Promise<void> = async () => {};
export function onDeviceLoss(callback: () => Promise<void>) { refreshAfterLoss = callback; }
function tone() {
  if (!context || !master || state.status !== 'live') throw new Error('Go LIVE before testing the virtual output.');
  if (oscillator) return;
  const ctx = context;
  const node = ctx.createOscillator();
  const envelope = ctx.createGain();
  node.frequency.value = 440;
  const now = ctx.currentTime;
  envelope.gain.setValueAtTime(0, now);
  envelope.gain.linearRampToValueAtTime(0.1, now + 0.02); // -20 dBFS peak
  envelope.gain.setValueAtTime(0.1, now + 1.45);
  envelope.gain.linearRampToValueAtTime(0, now + 1.5);
  node.connect(envelope); envelope.connect(master);
  oscillator = node;
  node.onended = () => {
    node.disconnect(); envelope.disconnect();
    if (oscillator === node) { oscillator = null; publish({ tone: false }); }
  };
  node.start(now); node.stop(now + 1.52);
  publish({ tone: true });
}
export async function command(command: AudioCommand) {
  switch (command.type) {
    case 'start': await start(command.deviceId); break;
    case 'stop': stop(); break;
    case 'tone': tone(); break;
  }
}
