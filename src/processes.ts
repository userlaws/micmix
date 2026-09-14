import { execFile } from 'node:child_process';
// Detection only. Discord is never automated; FiveM's saved voice settings are tuned in src/fivem-config.ts.
export function runningProcessNames(): Promise<Set<string>> {
  return new Promise(resolve => {
    execFile('tasklist', ['/FO', 'CSV', '/NH'], { windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (error, stdout) => {
      const names = new Set<string>();
      if (!error) for (const line of stdout.split(/\r?\n/)) {
        const match = /^"([^"]+)"/.exec(line);
        if (match) names.add(match[1].toLowerCase());
      }
      resolve(names);
    });
  });
}
export async function integrationStatus(): Promise<{ discord: boolean; fivem: boolean }> {
  const names = await runningProcessNames();
  return {
    discord: ['discord.exe', 'discordptb.exe', 'discordcanary.exe'].some(name => names.has(name)),
    fivem: [...names].some(name => /^fivem(_b\d+)?(_gtaprocess)?\.exe$/.test(name))
  };
}
