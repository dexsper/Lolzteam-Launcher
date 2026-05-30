import { killProcesses, waitForExit } from '../_shared/processes';

const PROCS = ['Steam.exe', 'steamwebhelper.exe', 'steamservice.exe'];

export const killSteamProcesses = (): Promise<void> => killProcesses(PROCS);
export const waitForSteamExit = (timeoutMs = 5000): Promise<void> =>
  waitForExit('Steam.exe', timeoutMs);
