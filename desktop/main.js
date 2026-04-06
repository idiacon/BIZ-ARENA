const { app, BrowserWindow } = require('electron');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const PORT = Number(process.env.PORT || 3000);
const SERVER_URL = `http://127.0.0.1:${PORT}`;
const SERVER_ENTRY = path.join(__dirname, '..', 'server.js');
const PRELOAD_ENTRY = path.join(__dirname, 'preload.js');
const DEV_ICON = path.join(__dirname, '..', 'build', 'icon.ico');
const SERVER_WAIT_TIMEOUT_MS = 15_000;
const SERVER_POLL_INTERVAL_MS = 250;

let mainWindow = null;
let serverProcess = null;
let shuttingDown = false;

function resolveDesktopDataDir() {
  return path.join(app.getPath('userData'), 'biz-arena-data');
}

function pipeOutput(stream, writer) {
  if (!stream) return;
  stream.on('data', chunk => writer(chunk.toString()));
}

function waitForServer(url, timeoutMs = SERVER_WAIT_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    function tryConnect() {
      const request = http.get(url, response => {
        response.resume();
        resolve();
      });

      request.on('error', error => {
        if (Date.now() >= deadline) {
          reject(new Error(`Biz Arena server did not start in time: ${error.message}`));
          return;
        }
        setTimeout(tryConnect, SERVER_POLL_INTERVAL_MS);
      });
    }

    tryConnect();
  });
}

async function startServer() {
  if (serverProcess) return;

  const serverCwd = app.isPackaged ? app.getPath('userData') : path.join(__dirname, '..');

  serverProcess = spawn(process.execPath, [SERVER_ENTRY], {
    cwd: serverCwd,
    env: {
      ...process.env,
      PORT: String(PORT),
      ELECTRON_RUN_AS_NODE: '1',
      BIZ_ARENA_DESKTOP: '1',
      BIZ_ARENA_DATA_DIR: resolveDesktopDataDir(),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  pipeOutput(serverProcess.stdout, message => process.stdout.write(`[biz-arena-server] ${message}`));
  pipeOutput(serverProcess.stderr, message => process.stderr.write(`[biz-arena-server] ${message}`));

  serverProcess.once('exit', code => {
    if (!shuttingDown && code !== 0) {
      console.error(`Biz Arena server exited unexpectedly with code ${code}.`);
    }
    serverProcess = null;
  });

  await waitForServer(SERVER_URL);
}

function stopServer() {
  if (!serverProcess) return;
  shuttingDown = true;
  serverProcess.kill();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#08111d',
    title: 'Biz Arena',
    autoHideMenuBar: true,
    icon: app.isPackaged ? undefined : DEV_ICON,
    webPreferences: {
      preload: PRELOAD_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.loadURL(SERVER_URL);
}

app.whenReady().then(async () => {
  await startServer();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
}).catch(error => {
  console.error(error);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopServer();
});
