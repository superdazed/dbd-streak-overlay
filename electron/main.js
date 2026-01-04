import { app, BrowserWindow, Tray, Menu, nativeImage, dialog, globalShortcut } from 'electron';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import express from 'express';
import { WebSocketServer } from 'ws';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import fs from 'node:fs';
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.whenReady().then(() => {
    dialog.showMessageBoxSync({
      type: 'warning',
      title: 'Streak Overlay for Dead by Daylight',
      message: 'Streak Overlay for Dead by Daylight is already running. Check the tray for the app.'
    });
    app.quit();
  });
} else {
const __dirname = path.dirname(fileURLToPath(import.meta.url));
let port = 3000;
let latestData = null;

// Serve static files built by Vite (separate from electron-builder output)
const staticPath = path.join(__dirname, '../renderer');
const appServer = express();
appServer.use(express.static(staticPath));
// Friendly extensionless routes for OBS users
appServer.get('/source', (_req, res) => {
  res.sendFile(path.join(staticPath, 'source.html'));
});
appServer.get('/dock', (_req, res) => {
  res.sendFile(path.join(staticPath, 'dock.html'));
});
appServer.get('/about', (_req, res) => {
  res.sendFile(path.join(staticPath, 'about.html'));
});
// Manual update check triggered from renderer
appServer.post('/api/check-updates', async (_req, res) => {
  try {
    const currentVersion = app.getVersion();
    const result = await autoUpdater.checkForUpdates();
    const latestVersion = result?.updateInfo?.version || null;
    const updateAvailable = Boolean(latestVersion && latestVersion !== currentVersion);
    res.json({ ok: true, updateAvailable, currentVersion, latestVersion });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error) });
  }
});
// Expose app version for renderer pages
appServer.get('/version', (_req, res) => {
  try {
    res.json({ version: app.getVersion() });
  } catch (error) {
    res.status(500).json({ version: null });
  }
});
// Fetch release notes from GitHub
appServer.get('/api/release-notes', async (_req, res) => {
  try {
    const currentVersion = app.getVersion();
    const repo = 'superdazed/dbd-streak-overlay';
    
    // Try to fetch release by tag (e.g., v0.3.0)
    let releaseUrl = `https://api.github.com/repos/${repo}/releases/tags/v${currentVersion}`;
    let response = await fetch(releaseUrl);
    
    // If tag doesn't exist, try without 'v' prefix
    if (!response.ok) {
      releaseUrl = `https://api.github.com/repos/${repo}/releases/tags/${currentVersion}`;
      response = await fetch(releaseUrl);
    }
    
    // If still not found, try to get the latest release
    if (!response.ok) {
      releaseUrl = `https://api.github.com/repos/${repo}/releases/latest`;
      response = await fetch(releaseUrl);
    }
    
    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}`);
    }
    
    const release = await response.json();
    res.json({ 
      ok: true, 
      body: release.body || '',
      tagName: release.tag_name || '',
      publishedAt: release.published_at || ''
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error) });
  }
});
function logAddress() {
  port = server.address().port;
  console.log(`Server running at http://localhost:${port}`);
}

const server = appServer.listen(port, logAddress);
server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    server.listen(0, logAddress);
  } else {
    console.error('Server error:', err);
  }
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
        updateGlobalShortcut();
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

let aboutWin;
let tray;

function getIconPath() {
  const packagedIcon = path.join(process.resourcesPath, 'icons', 'icon.ico');
  const devIcon = path.join(__dirname, '../build/icon.ico');
  return fs.existsSync(packagedIcon) ? packagedIcon : devIcon;
}

function createAboutWindow() {
  if (aboutWin) {
    aboutWin.focus();
    return;
  }
  aboutWin = new BrowserWindow({
    width: 800,
    height: 650,
    minWidth: 800,
    minHeight: 650,
    autoHideMenuBar: true,
    icon: getIconPath()
  });
  aboutWin.setMenuBarVisibility(false);
  aboutWin.loadURL(`http://localhost:${port}/about`);
  aboutWin.on('closed', () => {
    aboutWin = null;
  });
}

function updateGlobalShortcut() {
  globalShortcut.unregister('`');
  
  if (latestData && latestData.scoreboard && latestData.scoreboard.oneVOneMode === true) {
    const ret = globalShortcut.register('`', () => {
      wss.clients.forEach(client => {
        client.send(JSON.stringify({ type: 'timer-toggle' }));
      });
    });
    
    if (!ret) {
      console.log('Global shortcut registration failed');
    }
  }
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.superdazed.dbd-streak-overlay');
  
  updateGlobalShortcut();

  // Custom update prompts
  autoUpdater.on('update-downloaded', (_evt, _notes, releaseName) => {
    const dialogOpts = {
      type: 'info',
      buttons: ['Restart now', 'Later'],
      title: 'Update ready',
      message: 'Streak Overlay for Dead by Daylight',
      detail: 'An new version of Streak Overlay for Dead by Daylight is ready to install. Restart to apply the update.'
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
    { label: 'About', click: () => createAboutWindow() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    createAboutWindow();
  });

  // Show About window on every launch
  createAboutWindow();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', e => {
  e.preventDefault();
});
}
