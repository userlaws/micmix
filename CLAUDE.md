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
- Phase 1 implemented; STOP at Discord auditory checkpoint. No audible result is confirmed.
- Phase 1 startup fix: user reported no visible window. Reproduced with ui.isVisible() false; changing launcher windowsHide from true to false made visibility assertion pass. Earlier capturePage screenshot did not prove visibility. Added visible/non-minimized UI and hidden-worker regression assertions, explicit show/focus after UI load and on second launch.
- Hidden audio worker owns exact-device mic capture with all three processing flags false, interactive AudioContext, explicit setSinkId to CABLE Input, master gain, and 440 Hz / 1.5-second / -20 dBFS peak test tone.
- OFF AIR cancels pending starts, releases tracks, and closes context. Device loss, context interruption, and sink changes stop output. No monitor, mixer, limiter, or meters until Phase 2.
- Windows default recording device is now CABLE Output. The selector excludes cable and default aliases, so user must select their Yeti (or another physical mic). Explicit real default is auto-selected only when its group matches a non-cable device.
- Phase 1 validation: TypeScript/esbuild pass; silent Electron smoke checks pass (startup OFF AIR, stop IPC, reject tone while off, reject default mic and invalid commands, mic selector excludes cable, real silent setSinkId succeeds at 48000 Hz). Screenshot reviewed. No mic passthrough/tone audio was generated by these checks. Physical unplug and audible checks remain for user.
- Verified 2026-09-08: Node 22.23.2, npm 10.9.8, Git 2.40.1, Windows 11 Pro x64. Electron 44.3.0, React 19.2.8, TypeScript 5.9.3.
- TypeScript and esbuild pass. Real hidden Electron renderer enumerated 15 endpoint entries with no permission/enumeration error. Secure context and AudioContext.setSinkId supported. Default mic: Yeti Classic. Default playback: Realtek headset.
- Initial Phase 0 scan found cable missing; subsequent user log and Phase 1 smoke scan confirm both endpoints now present.
- Diagnostic report: ignored artifacts/devices.json. UI launched successfully, user visual confirmation pending. Run npm start to open it, npm run check:devices for console enumeration.
- Standard VB-CABLE now present for development. Bundled installer remains Phase 5.
