# MicMix

Windows 11 desktop audio mixer. Phase 1 mic passthrough is user-confirmed. Phase 2 adds local music, a queue, mixer, ducking, limiter, headphone monitoring, and meters. Phase 2 audible quality is awaiting the user's checkpoint. The bundled installer arrives in Phase 5.

## Run Phase 2 and test in Discord

1. Close the old MicMix window. In PowerShell run `cd E:\mixer`, then `npm start`. On a new checkout, run `npm ci` first.
2. Select **Microphone (Yeti Classic)** or your physical mic, and your real headphones as **Headphone monitor**. Use **Add files** or drop MP3, WAV, FLAC, or OGG files into Music. Go **LIVE**, then **Play**. Queue selection changes the selected song; Play starts it. End-of-track advances automatically. OFF AIR pauses and silences both outputs; going LIVE again requires pressing Play to resume.
3. In Discord: **User Settings > Voice & Video > Input Device > CABLE Output (VB-Audio Virtual Cable)**. Set Discord's Output Device to your real headphones. In MicMix's gear settings, uncheck **Headphone monitor enabled** while using Discord's **Mic Test > Let's Check** so music is not heard through two paths.
4. Check that Discord receives music and voice together. Speak: music should dip; stop speaking: it should recover. Adjust Mic/Music/Master faders and mutes; try pause, seek, skip, and removing a queue item. Ducking defaults to -12 dB with a -40 dBFS threshold. If room noise keeps ducking engaged, move the threshold toward -30 dBFS. Try the mono toggle too.
5. Stop Discord's mic test, re-enable MicMix monitoring, and check headphones receive music without your mic. Briefly enable **Include microphone in headphones** to test that option, then disable it again. Go OFF AIR and confirm silence. Report results before Phase 3. Optionally unplug the active mic/headphones: expect OFF AIR and a banner; reconnect, rescan, select devices, and go LIVE manually.

`npm run build` checks TypeScript and bundles the app. `npm run check:phase2` generates local codec fixtures, runs offline Web Audio tests, and runs actual Electron playback tests with virtual master and headphone output muted. It checks all four formats, queue operations, seek, pause, cancellation, corrupt-file handling, meters, mono, ducking, and monitor exclusion. Reports/screenshots are in ignored `artifacts/phase2-*`. These tests never certify audible behavior. The fixture generator uses FFmpeg already installed on the developer machine; MicMix does not invoke or require FFmpeg at runtime. The live-context test uses this machine's Yeti and Realtek headset endpoints.

The limiter uses a DynamicsCompressorNode (-1 dB threshold, ratio 20, 3 ms attack), followed by a -1 dBFS sample peak guard because the compressor alone can overshoot. A **Peak guard active** message means source/master levels should be reduced. Music ducking uses a separate GainNode, leaving the Music fader setting intact. Meter/RMS sampling runs at 20 Hz in the hidden audio renderer; React only displays reports.

Monitoring uses a second AudioContext on an explicitly selected non-cable device, fed through a MediaStreamAudioDestinationNode bridge. The monitor receives music by default and the mic only when enabled. Master volume and mute affect both paths; monitor volume affects headphones only. Settings and queue are session-only until Phase 4. Soundboard pads remain disabled until Phase 4; YouTube arrives in Phase 3.

`npm run check:devices` runs the same hidden Electron audio renderer, prints actual endpoints, writes ignored `artifacts/devices.json`, and exits. A nonzero exit means the checkpoint did not pass; inspect the report for missing cable endpoints or scan errors. Device presence is not proof that audio routing works.

If mic access fails: Windows Settings > Privacy & security > Microphone > Microphone access and Let desktop apps access your microphone. Then rescan.

The initial device scan briefly opens the default microphone to expose labels and immediately stops all tracks. Later scans do not open another microphone while LIVE. Device changes trigger a rescan. LIVE captures the explicitly selected mic with echo cancellation, noise suppression, and automatic gain control disabled. OFF AIR releases it. Device reports contain machine-specific names and IDs and are ignored by Git.

Architecture and all phase checkpoints are recorded in [CLAUDE.md](CLAUDE.md). Installer, repair, and final troubleshooting guide arrive in Phase 5. No VB-CABLE driver is bundled or installed in Phase 0.
