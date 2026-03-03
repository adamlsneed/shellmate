import { app, BrowserWindow, Menu, dialog } from 'electron';
import { createServer } from '../server/index.js';

let autoUpdater;

// electron-updater uses CJS internally — handle all interop shapes
try {
  const mod = await import('electron-updater');
  autoUpdater = mod.autoUpdater
    || mod.default?.autoUpdater
    || mod['module.exports']?.autoUpdater;
} catch {
  // Silently ignore — updater won't work in dev or if import fails
  autoUpdater = null;
}

let mainWindow = null;
let server = null;

function checkForUpdates() {
  if (!autoUpdater) return;
  autoUpdater.checkForUpdates().catch(() => {});
}

function setupAutoUpdater() {
  if (!autoUpdater || !app.isPackaged) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `Version ${info.version} is available. Download now?`,
      buttons: ['Download', 'Later'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.downloadUpdate();
      }
    });
  });

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded. Restart now to install?',
      buttons: ['Restart', 'Later'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', (err) => {
    console.log('Auto-updater error:', err?.message);
  });

  // Check for updates 3 seconds after launch
  setTimeout(() => checkForUpdates(), 3000);
}

const template = [
  ...(process.platform === 'darwin' ? [{
    label: app.name,
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      {
        label: 'Check for Updates...',
        click: () => checkForUpdates(),
      },
      { type: 'separator' },
      { role: 'quit' },
    ],
  }] : []),
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
    ],
  },
  {
    label: 'Window',
    submenu: [
      { role: 'minimize' },
      { role: 'close' },
    ],
  },
  ...(process.platform !== 'darwin' ? [{
    label: 'Help',
    submenu: [
      {
        label: 'Check for Updates...',
        click: () => checkForUpdates(),
      },
    ],
  }] : []),
];

async function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Shellmate',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`http://localhost:${port}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'production';
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  const expressApp = await createServer();

  // Listen on port 0 so the OS assigns a free port — avoids conflicts
  server = expressApp.listen(0, () => {
    const port = server.address().port;
    console.log(`Shellmate running on port ${port}`);
    createWindow(port);
  });

  setupAutoUpdater();
});

app.on('window-all-closed', () => {
  if (server) {
    server.close();
    server = null;
  }
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null && server) {
    const port = server.address().port;
    createWindow(port);
  }
});
