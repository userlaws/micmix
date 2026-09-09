// Shared by the Support section and the build-time FAQPage structured data (vite.config.ts).
export const FAQ: { q: string; a: string }[] = [
  {
    q: 'Nobody can hear my music, only my voice.',
    a: 'Check that the app you are talking in has MicMix Virtual Mic selected as its input, not your real microphone. In Discord, also set Noise Suppression to None and turn off Echo Cancellation and Automatic Gain Control in a Custom voice profile, since those filters treat music as noise.',
  },
  {
    q: 'MicMix says the virtual mic is missing.',
    a: 'Open Settings and press Repair. This re-runs the driver install. If Windows just installed it, a reboot is usually needed before every app can see the new device.',
  },
  {
    q: 'My voice sounds robotic or choppy.',
    a: 'Make sure only MicMix is using your real microphone. If another app has exclusive control of the device, release it there. Also confirm your headset and mic are not both being processed by a third-party enhancement suite.',
  },
  {
    q: 'I hear the music twice.',
    a: 'That is MicMix monitoring plus the other app playing it back. Either lower "Music in my headphones" in MicMix or turn off monitoring while you use a mic test in Discord.',
  },
  {
    q: 'A YouTube video says it blocks embedding.',
    a: 'Some channels disable playback outside youtube.com. MicMix cannot override that. Try another upload of the same track or use a local file.',
  },
  {
    q: 'Is it really free?',
    a: 'Yes. MicMix is free and has no account, no subscription and no ads. The bundled virtual audio driver is VB-CABLE by VB-Audio, distributed as donationware. If it helps you, consider sending them a donation.',
  },
];
