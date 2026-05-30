import { killProcesses, waitForExit } from '../_shared/processes';

const PROCS = ['Telegram.exe'];

export const killTelegramProcesses = (): Promise<void> => killProcesses(PROCS);
export const waitForTelegramExit = (timeoutMs = 5000): Promise<void> =>
  waitForExit('Telegram.exe', timeoutMs);
