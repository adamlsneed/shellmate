import { app, BrowserWindow, Menu, dialog, shell } from 'electron';
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
let expressAppRef = null;

let manualUpdateCheck = false;

function checkForUpdates() {
  if (!autoUpdater) return;
  manualUpdateCheck = true;
  autoUpdater.checkForUpdates().catch((err) => {
    manualUpdateCheck = false;
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Update Check Failed',
        message: `Could not check for updates: ${err?.message || 'Unknown error'}`,
      });
    }
  });
}

function setupAutoUpdater() {
  if (!autoUpdater || !app.isPackaged) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    manualUpdateCheck = false;
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `Version ${info.version} is available. Download now?`,
      buttons: ['Download', 'Later'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) {
        // Show progress notification while downloading
        if (mainWindow) {
          mainWindow.setProgressBar(0.01); // indeterminate start
        }
        autoUpdater.downloadUpdate().catch((err) => {
          if (mainWindow) mainWindow.setProgressBar(-1);
          dialog.showMessageBox(mainWindow, {
            type: 'error',
            title: 'Download Failed',
            message: `Could not download the update: ${err?.message || 'Unknown error'}. Please try again later.`,
          });
        });
      }
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    if (mainWindow) {
      mainWindow.setProgressBar(progress.percent / 100);
    }
  });

  autoUpdater.on('update-downloaded', () => {
    if (mainWindow) mainWindow.setProgressBar(-1); // clear progress bar
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

  autoUpdater.on('update-not-available', () => {
    console.log('Auto-updater: no update available (current version is latest)');
    if (manualUpdateCheck && mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'No Update Available',
        message: `You're running the latest version (${app.getVersion()}).`,
      });
    }
    manualUpdateCheck = false;
  });

  autoUpdater.on('error', (err) => {
    console.log('Auto-updater error:', err?.message);
    if (mainWindow) mainWindow.setProgressBar(-1);
  });

  autoUpdater.on('checking-for-update', () => {
    console.log('Auto-updater: checking for updates...');
  });

  // Check for updates 3 seconds after launch (silent — no dialog if up to date)
  setTimeout(() => {
    if (!autoUpdater) return;
    autoUpdater.checkForUpdates().catch(() => {});
  }, 3000);
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

async function createWindow(port, expressApp) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Shellmate',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const token = expressApp?.locals?.authToken || '';
  mainWindow.loadURL(`http://localhost:${port}?token=${token}`);

  // Prevent navigation away from the app
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`http://localhost:${port}`)) {
      event.preventDefault();
    }
  });

  // Open external links in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(`http://localhost:${port}`)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

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
  expressAppRef = expressApp;

  // Listen on port 0 so the OS assigns a free port — avoids conflicts
  server = expressApp.listen(0, () => {
    const port = server.address().port;
    console.log(`Shellmate running on port ${port}`);
    createWindow(port, expressApp);
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
    createWindow(port, expressAppRef);
  }
});
