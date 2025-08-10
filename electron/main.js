import { app, BrowserWindow, Tray, Menu, nativeImage, dialog } from 'electron';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import express from 'express';
import { WebSocketServer } from 'ws';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;
let latestData = null;

// Serve static files built by Vite (separate from electron-builder output)
const staticPath = path.join(__dirname, '../renderer');
const appServer = express();
appServer.use(express.static(staticPath));
// Expose app version for renderer pages
appServer.get('/version', (_req, res) => {
  try {
    res.json({ version: app.getVersion() });
  } catch (error) {
    res.status(500).json({ version: null });
  }
});
const server = appServer.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// WebSocket for dock/source communication
const wss = new WebSocketServer({ server });
wss.on('connection', ws => {
  ws.send(JSON.stringify({ type: 'update', data: latestData }));
  ws.on('message', data => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'update') {
        latestData = msg.data;
        wss.clients.forEach(client => {
          client.send(JSON.stringify({ type: 'update', data: latestData }));
        });
      }
    } catch (e) {
      console.error('Invalid message', e);
    }
  });
});

// Rebuild and reload clients on source changes during development
if (!app.isPackaged) {
  (async () => {
    const chokidar = (await import('chokidar')).default;
    const build = reload => {
      exec('npm run build', (err, stdout, stderr) => {
        if (err) {
          console.error(stderr || err);
          return;
        }
        if (reload) {
          wss.clients.forEach(client => {
            client.send(JSON.stringify({ type: 'reload' }));
          });
        }
      });
    };

    // Initial build without triggering a reload
    build(false);

    const watcher = chokidar.watch(path.join(__dirname, '../src'), {
      ignoreInitial: true
    });
    watcher.on('all', () => build(true));
  })().catch(err => console.error('Dev watcher init failed', err));
}

let instructionsWin;
let tray;

function getIconPath() {
  const packagedIcon = path.join(process.resourcesPath, 'icons', 'icon.ico');
  const devIcon = path.join(__dirname, '../build/icon.ico');
  return fs.existsSync(packagedIcon) ? packagedIcon : devIcon;
}

function isFirstRun() {
  try {
    const flagPath = path.join(app.getPath('userData'), 'first-run');
    if (fs.existsSync(flagPath)) {
      return false;
    }
    fs.writeFileSync(flagPath, new Date().toISOString(), { encoding: 'utf-8' });
    return true;
  } catch (error) {
    console.error('First-run check failed', error);
    return false;
  }
}
function createInstructionsWindow() {
  if (instructionsWin) {
    instructionsWin.focus();
    return;
  }
  instructionsWin = new BrowserWindow({
    width: 400,
    height: 300,
    autoHideMenuBar: true,
    icon: getIconPath()
  });
  instructionsWin.setMenuBarVisibility(false);
  instructionsWin.loadURL(`http://localhost:${PORT}/instructions.html`);
  instructionsWin.on('closed', () => {
    instructionsWin = null;
  });
}

app.whenReady().then(() => {
  // Ensure Windows uses the packaged app icon for taskbar grouping and shortcuts
  app.setAppUserModelId('com.superdazed.dbd-streak-overlay');

  autoUpdater.on('update-downloaded', (_evt, _notes, releaseName) => {
    const dialogOpts = {
      type: 'info',
      buttons: ['Restart', 'Later'],
      title: 'Update available',
      message: process.platform === 'win32' ? releaseNotes : releaseName,
      detail:
        'A new version of Streak Overlay for Dead by Daylight has been downloaded. Restart to apply the update.'
    };
    dialog.showMessageBox(dialogOpts).then(result => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });
  autoUpdater.on('error', err => {
    console.error('Auto update error:', err);
  });
  autoUpdater.checkForUpdates();
  tray = new Tray(getIconPath());
  tray.setToolTip('Streak Overlay for Dead by Daylight');
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Instructions', click: () => createInstructionsWindow() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
  tray.setContextMenu(contextMenu);

  // Show instructions the very first time the app is launched after install
  if (app.isPackaged && isFirstRun()) {
    createInstructionsWindow();
  }
});

app.on('window-all-closed', e => {
  e.preventDefault();
});
