# MicMix

Windows 11 desktop audio mixer. Phase 1: mic passthrough to VB-CABLE and a test tone. Audio quality is awaiting the user's checkpoint. The bundled installer arrives in Phase 5.

## Run Phase 1 and test in Discord

1. Close the old MicMix window. In PowerShell run `cd E:\mixer`, then `npm start`. On a new checkout, run `npm ci` first.
2. Select **Microphone (Yeti Classic)** or your physical mic. Click **Go live**. If Windows defaults to the virtual cable, MicMix deliberately requires a physical mic selection to prevent feedback.
3. In Discord: **User Settings > Voice & Video > Input Device > CABLE Output (VB-Audio Virtual Cable)**. Set Discord's Output Device to your real headphones. Start **Mic Test > Let's Check**.
4. Speak, then click **Send 1.5-second test tone**. Check voice clarity, delay, and whether the short tone is audible. MicMix itself does not monitor locally yet. Discord processing may suppress a steady tone; report voice and tone separately.
5. Click **Go off air** and confirm silence, including if stopped during a tone. Go live again and repeat. Report results before Phase 2. Optionally disconnect the selected mic while live: expect OFF AIR and a banner; reconnect, rescan, select the mic, and restart manually.

`npm run build` checks TypeScript and bundles the app. After building, `node scripts/start.mjs --smoke-phase1` performs silent Electron checks and writes `artifacts/phase1-smoke.json` and `artifacts/phase1-ui.png`. It checks real sink selection without connecting any source, IPC validation, and UI state. It never certifies audible behavior.

`npm run check:devices` runs the same hidden Electron audio renderer, prints actual endpoints, writes ignored `artifacts/devices.json`, and exits. A nonzero exit means the checkpoint did not pass; inspect the report for missing cable endpoints or scan errors. Device presence is not proof that audio routing works.

If mic access fails: Windows Settings > Privacy & security > Microphone > Microphone access and Let desktop apps access your microphone. Then rescan.

The initial device scan briefly opens the default microphone to expose labels and immediately stops all tracks. Later scans do not open another microphone while LIVE. Device changes trigger a rescan. LIVE captures the explicitly selected mic with echo cancellation, noise suppression, and automatic gain control disabled. OFF AIR releases it. Device reports contain machine-specific names and IDs and are ignored by Git.

Architecture and all phase checkpoints are recorded in [CLAUDE.md](CLAUDE.md). Installer, repair, and final troubleshooting guide arrive in Phase 5. No VB-CABLE driver is bundled or installed in Phase 0.
