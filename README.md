# dbd-streak-overlay

Electron application that connects to OBS through obs-websocket. It serves a dock UI for editing text and a browser source that displays the text. The dock and source communicate through a local WebSocket server. The app also checks GitHub for updates using `electron-updater`.

## Development

```bash
npm install
npm run build   # build dock and source pages into dist/
npm start       # launch the electron app
```

The app will attempt to create a browser source and custom dock in OBS using the built pages.

## Testing

```bash
npm test
```
