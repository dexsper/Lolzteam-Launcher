import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const STEAM_KEY = 'HKCU\\Software\\Valve\\Steam';

const writeValue = async (
  name: string,
  type: 'REG_SZ' | 'REG_DWORD',
  data: string,
): Promise<void> => {
  await execFileAsync(
    'reg',
    ['add', STEAM_KEY, '/v', name, '/t', type, '/d', data, '/f'],
    { windowsHide: true },
  );
};

export const setAutoLoginUser = async (login: string): Promise<void> => {
  if (process.platform !== 'win32') return;
  await writeValue('AutoLoginUser', 'REG_SZ', login);
  await writeValue('RememberPassword', 'REG_DWORD', '1');
};
