# dbd-streak-overlay

Electron application that serves a dock UI for editing text and a browser source that displays the text. The dock and source communicate through a local WebSocket server. The app also checks GitHub for updates using `electron-updater`.

## Development

```bash
npm install
npm run build   # build dock and source pages into dist/
npm start       # launch the electron app
```

When running, use the tray icon to open instructions. You will need to manually create a Browser Source and a Custom Browser Dock in OBS using the provided local URLs.

## Testing

```bash
npm test
```
