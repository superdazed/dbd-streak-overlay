import { app, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import express from 'express';
import { WebSocketServer } from 'ws';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OBSWebSocket from 'obs-websocket-js';

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

async function createObsItems() {
  const obs = new OBSWebSocket();
  try {
    await obs.connect('ws://127.0.0.1:4455', process.env.OBS_PASSWORD || '');
    const sourceUrl = `http://localhost:${PORT}/source.html`;
    const dockUrl = `http://localhost:${PORT}/dock.html`;
    await obs.call('CreateInput', {
      inputName: 'Electron Text Source',
      inputKind: 'browser_source',
      sceneName: 'Scene',
      inputSettings: { url: sourceUrl }
    });
    await obs.call('CreateCustomDock', {
      dockName: 'Electron Text Dock',
      url: dockUrl
    });
  } catch (err) {
    console.error('Could not create OBS items', err);
  }
}

app.whenReady().then(() => {
  autoUpdater.checkForUpdatesAndNotify();
  createObsItems();
  const win = new BrowserWindow({ show: false });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
