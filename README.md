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

4. **Go LIVE and add sound.** Press **● LIVE**. Drop MP3/WAV/FLAC/OGG files,
   **search YouTube inside MicMix**, or paste a YouTube link into Music, then
   press **Play**. Assign clips to the
   **Soundboard** (Edit → Choose clip) and give them global hotkeys that work
   even in-game. Everything mixes under the **Mic / Music / Pads / Master**
   faders.

5. **Balance and check yourself.** Leave **Duck on talk** on so music dips while
   you speak. Use **Headphone monitor** to hear your mix without your own mic by
   default. Do a Discord **Mic Test** with MicMix monitoring **off** so you don't
   hear the music twice. Your devices, faders, queue, and pads are saved
   automatically for next time.

**Keyboard shortcuts (work from any app, even in-game).** Change or turn them
off in **Settings → Shortcuts & tray**; click a key button, press the new combo,
Backspace clears it. Media keys (Play/Pause, Next, Previous, Stop) are allowed
on their own; everything else needs Ctrl, Alt or Shift, or an F-key / numpad
key, so normal typing is never hijacked. Defaults:

| Action | Default |
| --- | --- |
| Play / pause music | Ctrl + Alt + P |
| Next track | Ctrl + Alt + N |
| Previous track | Ctrl + Alt + B |
| Mute / unmute mic | Ctrl + Alt + K |
| Stop all pads | Ctrl + Alt + X |
| Go live / off air | Ctrl + Alt + L |
| Show / hide MicMix | Ctrl + Alt + H |

**Tray.** Closing the window hides MicMix next to the clock and keeps the
virtual mic running; click the tray icon to bring it back, right-click for
Go live, Play/Pause, Next, Mute and **Quit**. Turn this off in
**Settings → Shortcuts & tray** if you prefer close to quit.

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

**My voice sounds boxy, muffled or squashed (especially in FiveM).**
Check three things, in order.

1. **Is the limiter working on your voice?** Watch the small line under the **Mic**
   fader while you talk. If it says **Limiting your voice**, the mic is hitting the
   ceiling: turn your microphone's own gain knob down, or lower the **Mic** fader,
   until the line stays quiet. A compressed voice sounds flat and "in a box".
2. **Voice headroom** (Settings → Monitoring & output, on by default) gives your
   voice its own limiter, so loud music can never pump or squash your words. It
   works best with ducking on; if **Peak guard active** appears while both are
   loud, lower the Music fader a little.
3. **Sample rates** (Settings → Diagnostics) lists the rate Windows runs your mic,
   CABLE Input and CABLE Output at, plus the MicMix engine when live. If they
   differ, Windows resamples between them. Set each device to **48000 Hz** in
   Windows Settings → System → Sound → device → **Format**.

Everything after CABLE Output belongs to the voice app. Discord sends about
64 kbps Opus with its processing off when you follow the Custom-profile steps.
FiveM is harsher: it runs a speech-only noise suppressor (RNNoise) plus a
high-pass filter, an automatic gain control and a voice gate on everything it
captures, then encodes it as 48 kbps mono, and with the common
`voice_useNativeAudio` setup the result is played back inside the game engine
with distance and room effects. Music through that chain sounds low, hollow and
"in a fish bowl" even when Discord sounds fine.

MicMix fixes the part it can: **Tune FiveM voice for MicMix** (Settings →
Discord & FiveM, on by default) sets `voice_enableNoiseSuppression false` and
`voice_inBitrate 96000` in FiveM's saved settings file
(`%APPDATA%\CitizenFXivem.cfg`). FiveM rewrites that file when it exits, so
MicMix writes it while FiveM is closed and again after every FiveM session; the
card shows *Applied*, *Waiting* or an error. Turning the switch off restores
FiveM's defaults. The remaining filter, gain control and in-game effects are
FiveM's and cannot be changed from outside; use push-to-talk so the voice gate
never cuts the music, and ask a friend to disable "native audio" on their side
if the reverb is the problem. `npm run check:loopback` measures the MicMix →
VB-CABLE path end to end if you want proof that the app itself is transparent.

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
| `npm run check:youtube-search` | Live search, fuzzy ranking, thumbnails, queue additions, cancellation, and error recovery. |
| `npm run check:phase4` | Fresh-install + restart simulation (wizard, pads, hotkeys, persistence). |
| `npm run check:hotkeys` | App shortcuts (defaults, validation, conflicts, every action) and close-to-tray, silently. |
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
2. **Users get it.** The website's download button always points at `releases/latest/download/MicMix-Setup.exe`. Installed copies check for a new release a few seconds after launch (and every six hours), download it in the background, and show a small **Update** chip next to the settings gear. Click it for the release notes and **Restart now**; MicMix never restarts on its own, and while live the restart waits until you go off air. An ignored update installs the next time you quit. Settings > Updates has a manual "Check now" and an "Update automatically" switch. Windows shows one UAC prompt per update because MicMix installs per machine.
3. **Website.** Any push to `main` that touches `site/` deploys it to GitHub Pages through `.github/workflows/site.yml`.
4. **CI.** `.github/workflows/ci.yml` type-checks and bundles the app and the site on every push and pull request.

The installer is unsigned, so Windows SmartScreen shows a warning until the build gains reputation or a code-signing certificate is added to the release workflow.
