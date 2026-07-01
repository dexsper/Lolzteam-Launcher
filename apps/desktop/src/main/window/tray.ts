import { Menu, Tray, app, nativeImage } from 'electron';
import iconUrl from '../../renderer/assets/favicon.ico?asset';
import { setQuitting, showMainWindow } from './main-window';

let tray: Tray | null = null;

export const createTray = (): void => {
  if (tray) return;

  let image = nativeImage.createFromPath(iconUrl);
  if (!image.isEmpty()) image = image.resize({ width: 16, height: 16 });
  tray = new Tray(image.isEmpty() ? iconUrl : image);
  tray.setToolTip('Lolzteam Launcher');

  const menu = Menu.buildFromTemplate([
    { label: 'Открыть Lolzteam Launcher', click: () => showMainWindow() },
    { type: 'separator' },
    {
      label: 'Выход',
      click: () => {
        setQuitting(true);
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => showMainWindow());
  tray.on('double-click', () => showMainWindow());
};

export const destroyTray = (): void => {
  tray?.destroy();
  tray = null;
};
