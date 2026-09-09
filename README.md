# MicMix

Turn one microphone into a full broadcast mix. MicMix blends your **voice**,
**local music**, **YouTube**, and a **soundboard**, then sends the result into
Discord, FiveM, and any Windows app through a single virtual microphone — the
**MicMix Virtual Mic** (VB-CABLE by VB-Audio, included as donationware).

Windows 11 · Electron + React + TypeScript · no account, no cloud, no downloads.

---

## Five-step quick start

1. **Install MicMix.** Run `MicMix-Setup-1.0.0.exe` and accept the elevation
   prompt (the installer needs it once to install the virtual mic driver — the
   app itself never runs elevated). It installs the **MicMix Virtual Mic** and
   may ask you to **restart Windows**; do it, so every app can see the new
   microphone.

2. **Launch MicMix and finish the one-time setup.** The wizard confirms the
   virtual mic, lets you pick your **real microphone** and **headphones**, and
   runs a LIVE + test-tone check. If the virtual mic is missing, use **Repair**
   (reinstall VB-CABLE, restart, rescan).

3. **Point your chat app at the virtual mic.**
   - **Discord:** User Settings → Voice & Video → **Input Device →
     `CABLE Output (VB-Audio Virtual Cable)`**. Set **Output Device** to your
     real headphones. Under the **Custom** input profile set **Noise
     Suppression → None**, and turn **Echo Cancellation** and **Automatic Gain
     Control off** (otherwise Discord treats your music as noise and mutes it).
   - **FiveM:** Settings → Voice Chat → **Input Device →
     `CABLE Output (VB-Audio Virtual Cable)`**.
   MicMix shows a green indicator in the footer when Discord or FiveM is running.

4. **Go LIVE and add sound.** Press **● LIVE**. Drop MP3/WAV/FLAC/OGG files or
   **paste a YouTube link** into Music and press **Play**. Assign clips to the
   **Soundboard** (Edit → Choose clip) and give them global hotkeys that work
   even in-game. Everything mixes under the **Mic / Music / Pads / Master**
   faders.

5. **Balance and check yourself.** Leave **Duck on talk** on so music dips while
   you speak. Use **Headphone monitor** to hear your mix without your own mic by
   default. Do a Discord **Mic Test** with MicMix monitoring **off** so you don't
   hear the music twice. Your devices, faders, queue, and pads are saved
   automatically for next time.

---

## Troubleshooting

**"MicMix Virtual Mic missing" / no CABLE Output in Discord.**
The VB-CABLE driver isn't installed or Windows hasn't picked it up. Open
Settings → **Run setup again** → **Repair**, or install VB-CABLE from
<https://vb-audio.com/Cable/> (run its setup as administrator), then **restart
Windows**. Confirm Windows lists **CABLE Input** (Playback) and **CABLE Output**
(Recording) under Sound settings, and click **Rescan devices**.

**Discord is silent even though MicMix meters move.**
Discord's input isn't the virtual mic, or its noise gate is eating the audio.
Set **Input Device → CABLE Output**, and in the **Custom** profile set **Noise
Suppression → None**, **Echo Cancellation off**, **Automatic Gain Control off**,
and drag **Input Sensitivity** fully left (or switch it to automatic). Krisp
noise suppression is designed to remove non-voice sound, i.e. your music.

**Robotic, crackly, or distorted audio.**
Something is clipping. Watch the Master meter and the **Peak guard active**
warning in MicMix: pull the **Master** (and the loudest source) fader down until
it stops. In Discord, keep **Automatic Gain Control off**. If only your voice is
robotic, lower the **Mic** fader so voice and music don't both slam the limiter.

**I hear the music twice / an echo.**
Two playback paths are open at once — usually MicMix's **Headphone monitor**
plus Discord's **Mic Test** (or Discord routing its own input back to you). Turn
**Headphone monitor** off while testing in Discord, and don't route CABLE Output
to your speakers in Windows.

**"This video blocks embedding, try another."**
Some YouTube videos disallow embedded playback. There's no fix on our side —
pick a different video or use the official/topic upload. Age- or region-locked
videos may also refuse to play.

---

## For developers

`npm ci` then `npm start` runs the app from source. Build and checks:

| Command | What it does |
| --- | --- |
| `npm run build` | Type-check (tsc) and bundle (esbuild) into `dist/`. |
| `npm run check:phase2` | Silent Electron playback tests (all codecs, queue, ducking, limiter, monitor). |
| `npm run check:phase3` | Silent YouTube embed load + capture test. |
| `npm run check:phase4` | Fresh-install + restart simulation (wizard, pads, hotkeys, persistence). |
| `npm run check:phase5` | About/donation UI check. |
| `npm run dist:win` | Build the NSIS installer (see below). |

**Building the installer.** The VB-CABLE driver is **not** stored in this repo.
Before `npm run dist:win`, download the standard **VB-CABLE** package from
<https://vb-audio.com/Cable/> and copy `VBCABLE_Setup_x64.exe` (and the rest of
the pack) into `build/vbcable/` — see `build/vbcable/README.txt`. The installer
(`build/installer.nsh`) installs VB-CABLE silently (`-i -h`), restarts Windows
Audio, and offers a reboot; the uninstaller offers to remove it. Only the
standard VB-CABLE may be bundled (not A+B / C+D), and the donationware
attribution shown in the installer and in **Settings → About** must remain.

Architecture and phase-by-phase checkpoints live in [CLAUDE.md](CLAUDE.md).

## Credits

The MicMix Virtual Mic is **VB-CABLE** by **Vincent Burel / VB-Audio Software**
(<https://vb-audio.com>), included as donationware. If MicMix is useful to you,
please **donate to VB-Audio** — it's what keeps the virtual cable free.

## Releases, updates and the website

Everything ships from GitHub (`userlaws/micmix`):

1. **Ship a new version.** Run `npm version patch` (or `minor` / `major`), then `git push --follow-tags`. The tag triggers `.github/workflows/release.yml`, which fetches the standard VB-CABLE pack, builds `MicMix-Setup.exe` on a Windows runner and publishes a GitHub Release with generated notes.
2. **Users get it.** The website's download button always points at `releases/latest/download/MicMix-Setup.exe`. Installed copies check for a new release a few seconds after launch (and every six hours), download it in the background with a progress card, and restart into it automatically while off air; during a live session MicMix offers "Restart now" or finishes the update on quit. Settings > Diagnostics has a manual "Check now" and an "Update automatically" switch. Windows shows one UAC prompt per update because MicMix installs per machine.
3. **Website.** Any push to `main` that touches `site/` deploys it to GitHub Pages through `.github/workflows/site.yml`.
4. **CI.** `.github/workflows/ci.yml` type-checks and bundles the app and the site on every push and pull request.

The installer is unsigned, so Windows SmartScreen shows a warning until the build gains reputation or a code-signing certificate is added to the release workflow.
