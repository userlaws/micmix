# MicMix

## Working agreement
- Build a Windows 11 Electron + React + TypeScript desktop app in phases below.
- Stop at every CHECKPOINT. Only the user can confirm audible results; never claim an audio test passed without their report.
- Commit each phase. Read this file before continuing after a context reset.
- Prefer boring, reliable code. No native Node modules, Rust, Python, accounts, cloud, auto-updater, EQ, plugins, Spotify, yt-dlp, or media downloading.
- Stop for actions requiring the user's hearing, an admin prompt, or a reboot; provide exact instructions.

## Architecture
- Main process owns windows, IPC, embedded YouTube BrowserView, globalShortcut, persistence, integration, and installer/repair entry points.
- One visible React UI: dark single window; LIVE/OFF AIR, Mic/Music/Soundboard strips and master, central music/queue/video panel, right soundboard, bottom device/Discord/FiveM status, one settings gear. No nested menus.
- A separate hidden renderer owns all Web Audio processing and device enumeration. No UI rendering, animations, or meters in that window. UI communicates over narrow typed IPC.
- Virtual output AudioContext: latencyHint interactive, setSinkId to the output whose label contains CABLE Input. Second AudioContext for monitoring on real playback hardware. Default monitor excludes mic; optional include-mic toggle.
- User-selected mic getUserMedia disables echoCancellation, noiseSuppression, and autoGainControl.
- Source GainNodes -> master GainNode -> DynamicsCompressorNode limiter (threshold -1 dB, ratio 20, fast attack). Optional mono downmix on virtual output.
- Mic RMS drives music auto-duck with configurable threshold/depth (default -12 dB), 50 ms attack and 400 ms release using setTargetAtTime. Toggle in settings.
- AnalyserNode peak meters per source, reported at 20 Hz. Handle device disappearance with banner and re-enumeration, never a crash.
- Local mp3/wav/flac/ogg use audio elements + MediaElementSourceNode; drag/drop, queue, play/pause/skip.
- YouTube embed URL youtube.com/embed/ID?enablejsapi=1 in BrowserView, IFrame API postMessage for playback/seek/queue; Chromium autoplay policy disabled. Requested capture is desktopCapturer/setDisplayMediaRequestHandler for that webContents, with own output muted. Verify Electron/Windows support before implementation: never substitute system-wide loopback or claim muted capture works without testing. Embed failures show: "This video blocks embedding, try another".
- Soundboard decodes local clips once into AudioBuffers; globalShortcut hotkeys.

## Installation and integrations
- electron-builder NSIS; standard VB-CABLE only, package from vb-audio.com in build/vbcable. Verify redistribution and silent-install terms before bundling. Include donationware attribution and donation link in installer and About.
- Installer elevates once, installs driver, restarts Windows Audio service via net stop audiosrv / net start audiosrv, checks devices, offers reboot if needed. App never elevated. Uninstaller offers VB-CABLE removal.
- UI calls cable "MicMix Virtual Mic" except diagnostics and guided instructions which must show real Windows names.
- First launch confirms CABLE Input and Output, Repair if missing; defaults to default mic/playback, test tone plus meter. Save settings; wizard repeats only if cable disappears.
- Discord official local RPC ports 6463–6472: GET_VOICE_SETTINGS, remember previous input, SET_VOICE_SETTINGS to CABLE Output, connected indicator and revert. Verify official authorization requirements and restoration behavior; restore explicitly if needed, disconnect on exit. Never edit Discord files. Fall back to exact manual menu path when unavailable.
- Detect FiveM process; guided Settings > Voice Chat > Input Device > CABLE Output only, no automation.

## Phases and checkpoints
0. Toolchain; enumerate and print real audio devices from Electron. CHECKPOINT: user confirms CABLE devices appear.
1. Mic -> Web Audio -> CABLE Input and test tone. CHECKPOINT: user selects CABLE Output in Discord and uses mic test.
2. Local files, mixer, ducking, limiter, monitor, meters. CHECKPOINT: file + mic + ducking in Discord.
3. YouTube panel and captured audio. CHECKPOINT: paste link, play, friend hears it.
4. Soundboard, hotkeys, first-launch, Discord RPC, FiveM card, settings persistence. CHECKPOINT: delete config and simulate fresh install.
5. Bundled VB-CABLE installer; README five-step guide and troubleshooting for missing CABLE, silent Discord, robotic audio, double monitoring, blocked embeds.

## Current state
- Phase 0 PASSED: user supplied Electron log with CABLE Input and CABLE Output and authorized Phase 1.
- Phase 1 PASSED: user confirmed hearing their voice, ringing resolved after routing guidance, and OFF AIR silences / LIVE restores voice. User authorized Phase 2.
- Phase 2 implemented; STOP at file + mic + ducking Discord checkpoint. Phase 2 audible quality, physical device disconnects, and subjective monitoring latency remain unconfirmed.
- Phase 3 implemented; STOP at the paste-link / play / friend-hears-it checkpoint. No audible Phase 3 result is confirmed. Phase 2's Discord checkpoint is also still unconfirmed by the user.
- Phase 3 code: src/youtube-url.ts (URL parsing plus embed-error messages), src/youtube-view.ts (BrowserView lifecycle in main), src/youtube-preload.ts (IFrame API postMessage bridge, no filesystem or IPC exposed to the remote page), capture wiring in src/passthrough.ts, video panel and slot bounds in src/ui.tsx.
- Capture is verified, not assumed: scripts/capture-probe.cjs measured getDisplayMedia audio peak 0.49 from a BrowserView whose webContents was setAudioMuted(true), with enableLocalEcho false. No system-wide loopback is used; setDisplayMediaRequestHandler only ever grants the YouTube view's frame to the hidden worker frame.
- YouTube embeds run in their own session partition with permissions denied, downloads blocked, navigation blocked, window.open denied, audio muted. Player state, position, duration, title and error codes flow to the worker; the worker feeds the captured MediaStream into the existing music gain, so ducking, master, limiter, mono and monitor all apply. Error 101/150 shows "This video blocks embedding, try another".
- Video BrowserView bounds follow the UI slot via ResizeObserver, and detach when offscreen or smaller than 200x200.
- User report after Phase 3: YouTube audio in Discord mic test "plays and then stops" at low level. 45 s silent soak (npm run build && node scripts/start.mjs --smoke-youtube-soak, artifacts/youtube-soak.json) showed capture never dropped and the player never paused; music peak fell from ~0.6 to ~0.16 exactly when the Yeti was hot, i.e. auto-duck at the old -40 dBFS threshold. Fixes: defaults are now full level (mic/music/soundboard/master 1.0), duck threshold -30 dBFS, embed forced to unMute + setVolume 100 on ready. Discord Custom profile must have Noise Suppression None, Echo Cancellation off, AGC off, Input Sensitivity fully left or automatic; Krisp and the manual gate suppress music. Audible result still unconfirmed.
- main.ts loads any scripts/smoke-<name>.cjs via --smoke-<name>.
- Phase 3 verification passed: TypeScript/esbuild; npm run check:phase3 (silent, master 0 and monitor off) loaded a real embed, captured audio peak 0.156, metadata title/duration 22:24, play, pause, seek to 10 s, auto-advance path, non-YouTube URL rejected, master peak 0 while muted, OFF AIR clean. artifacts/phase3-player.png shows the live embedded player. npm run check:capture and npm run check:youtube rerun the probes.
- Phase 2 graph is in src/mixer-graph.ts; lifecycle/local music in src/passthrough.ts. Independent source gains, duck gain, master, compressor, sample peak guard, optional mono, and per-source/master analysers. RMS and peak reports at 20 Hz; playback position at 4 Hz. Audio remains in hidden renderer.
- Compressor-only overload test FAILED above full scale. Added WaveShaperNode sample peak guard after compressor to cap at -1 dBFS, with an overload indicator. Normal samples below ceiling pass unchanged; overload should be corrected with faders. This is not an EQ feature.
- Monitor uses a second AudioContext with explicit non-cable sink, bridged from music plus optional mic via MediaStreamAudioDestinationNode. Default excludes mic. Master affects both paths; independent monitor volume/mute. OFF AIR releases mic, closes both contexts, pauses music and retains queue/position in memory. LIVE does not automatically restart music.
- Files are selected via dialog or dropped File objects through preload webUtils; main validates extensions/file existence and registers IDs. Enqueue IPC only accepts registered files. Worker owns each audio element and MediaElementAudioSourceNode; old sources/elements are disposed when changing tracks. Queue supports play/pause/seek/skip/select/remove/clear and auto-advance, capped at 500.
- Phase 2 verification passed: TypeScript/esbuild; real muted Electron playback of generated wav/mp3/flac/ogg; seek/pause/auto-advance/queue removals, corrupt file recovery, cancelled startup stays OFF AIR; meter reports and zero master signal during muted checks. Offline real Web Audio tests measured monitor-mic exclusion peak 0, duck ratio 0.2512 (-12 dB), release ratio 0.9513, identical mono channels, and overload output max 0.89125 (-1 dBFS). UI and settings screenshots inspected; visible UI and hidden audio worker assertions pass.
- Run npm run check:phase2 to reproduce. FFmpeg is used ONLY as a development fixture generator, already present on this machine; app runtime has no FFmpeg dependency and downloads nothing. Codec fixtures/reports/screenshots are ignored under artifacts/. Test selects this machine's Yeti and Realtek headset but mutes all physical outputs before creating live contexts. User must evaluate audible results.
- For Discord mic-test checkpoint, disable MicMix monitoring to prevent music being heard twice; then stop Discord mic test and test MicMix monitoring separately. Settings/queue persistence remains Phase 4.
- Phase 1 startup fix: user reported no visible window. Reproduced with ui.isVisible() false; changing launcher windowsHide from true to false made visibility assertion pass. Earlier capturePage screenshot did not prove visibility. Added visible/non-minimized UI and hidden-worker regression assertions, explicit show/focus after UI load and on second launch.
- Hidden audio worker owns exact-device mic capture with all three processing flags false, interactive AudioContext, explicit setSinkId to CABLE Input, master gain, and 440 Hz / 1.5-second / -20 dBFS peak test tone.
- OFF AIR cancels pending starts, releases tracks, and closes contexts. Device loss, context interruption, and sink changes stop output.
- Windows default recording device is now CABLE Output. The selector excludes cable and default aliases, so user must select their Yeti (or another physical mic). Explicit real default is auto-selected only when its group matches a non-cable device.
- Phase 1 validation: TypeScript/esbuild pass; silent Electron smoke checks pass (startup OFF AIR, stop IPC, reject tone while off, reject default mic and invalid commands, mic selector excludes cable, real silent setSinkId succeeds at 48000 Hz). Screenshot reviewed. No mic passthrough/tone audio was generated by these checks. Physical unplug and audible checks remain for user.
- Verified 2026-09-08: Node 22.23.2, npm 10.9.8, Git 2.40.1, Windows 11 Pro x64. Electron 44.3.0, React 19.2.8, TypeScript 5.9.3.
- TypeScript and esbuild pass. Real hidden Electron renderer enumerated 15 endpoint entries with no permission/enumeration error. Secure context and AudioContext.setSinkId supported. Default mic: Yeti Classic. Default playback: Realtek headset.
- Initial Phase 0 scan found cable missing; subsequent user log and Phase 1 smoke scan confirm both endpoints now present.
- Diagnostic report: ignored artifacts/devices.json. UI launched successfully, user visual confirmation pending. Run npm start to open it, npm run check:devices for console enumeration.
- Standard VB-CABLE now present for development. Bundled installer remains Phase 5.
