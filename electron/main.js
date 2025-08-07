import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron';
import { autoUpdater } from 'electron-updater';
import express from 'express';
import { WebSocketServer } from 'ws';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chokidar from 'chokidar';
import { exec } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;
let latestText = '';

// Serve static files built by Vite
const staticPath = path.join(__dirname, '../dist');
const appServer = express();
appServer.use(express.static(staticPath));
const server = appServer.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// WebSocket for dock/source communication
const wss = new WebSocketServer({ server });
wss.on('connection', ws => {
  ws.send(JSON.stringify({ type: 'update', text: latestText }));
  ws.on('message', data => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'update') {
        latestText = msg.text;
        wss.clients.forEach(client => {
          client.send(JSON.stringify({ type: 'update', text: latestText }));
        });
      }
    } catch (e) {
      console.error('Invalid message', e);
    }
  });
});

// Rebuild and reload clients on source changes during development
if (!app.isPackaged) {
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
}

let instructionsWin;
function createInstructionsWindow() {
  if (instructionsWin) {
    instructionsWin.focus();
    return;
  }
  instructionsWin = new BrowserWindow({
    width: 400,
    height: 300
  });
  instructionsWin.loadURL(`http://localhost:${PORT}/instructions.html`);
  instructionsWin.on('closed', () => {
    instructionsWin = null;
  });
}

app.whenReady().then(() => {
  autoUpdater.checkForUpdatesAndNotify();
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAYAAAAfSC3RAAAAQ0lEQVR42mNkYGA4weEeI8P+L5BkYGBg+MH4PyOB//8fEMHqBjiOGCFAjPACGmj7gAWuYKYD8Sw0jYWNgF6YGBC4TGFAEAI/yFF0/fyB0AAAAASUVORK5CYII='
  );
  const tray = new Tray(icon);
  tray.setToolTip('DBD Streak Overlay');
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Instructions', click: () => createInstructionsWindow() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
  tray.setContextMenu(contextMenu);
});

app.on('window-all-closed', e => {
  e.preventDefault();
});
