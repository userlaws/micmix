# MicMix

Windows 11 desktop audio mixer. Phase 0 only: real Electron device enumeration. Audio routing and driver installation are not implemented yet.

## Run Phase 0

1. In PowerShell, run `cd E:\mixer`.
2. Run `npm ci` to install the locked development dependencies.
3. Run `npm start` to build and open MicMix.
4. Look for **CABLE Input** under playback and **CABLE Output** under recording in diagnostics.
5. Report whether both appear. Stop here before Phase 1.

`npm run check:devices` runs the same hidden Electron audio renderer, prints actual endpoints, writes ignored `artifacts/devices.json`, and exits. A nonzero exit means the checkpoint did not pass; inspect the report for missing cable endpoints or scan errors. Device presence is not proof that audio routing works.

If mic access fails: Windows Settings > Privacy & security > Microphone > Microphone access and Let desktop apps access your microphone. Then rescan.

The Phase 0 scan briefly opens the default microphone to expose labels and immediately stops all tracks. It does not record, play, or route audio. Device changes trigger a rescan. Device reports contain machine-specific names and IDs and are ignored by Git.

Architecture and all phase checkpoints are recorded in [CLAUDE.md](CLAUDE.md). Installer, repair, and final troubleshooting guide arrive in Phase 5. No VB-CABLE driver is bundled or installed in Phase 0.
