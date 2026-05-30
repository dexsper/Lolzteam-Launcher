import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// Kill a list of Windows image names (e.g. ['Steam.exe', 'steamwebhelper.exe']).
// Each is killed independently; absent processes are ignored.
// No-op on non-Windows platforms — both adapters explicitly gate their login
// on `process.platform === 'win32'`, so this matches their contract.
export const killProcesses = async (imageNames: readonly string[]): Promise<void> => {
  if (process.platform !== 'win32') return;
  for (const name of imageNames) {
    try {
      await execFileAsync('taskkill', ['/F', '/IM', name], { windowsHide: true });
    } catch {
      // Process not running, taskkill returns non-zero — that's fine.
    }
  }
};

// Poll tasklist for `imageName` until it disappears or `timeoutMs` elapses.
// Returns silently on timeout (caller decides whether to proceed).
export const waitForExit = async (imageName: string, timeoutMs = 5000): Promise<void> => {
  if (process.platform !== 'win32') return;
  const needle = imageName.toLowerCase();
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const { stdout } = await execFileAsync(
        'tasklist',
        ['/FI', `IMAGENAME eq ${imageName}`, '/NH'],
        { windowsHide: true },
      );
      if (!stdout.toLowerCase().includes(needle)) return;
    } catch {
      return;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
};
