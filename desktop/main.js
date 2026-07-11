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

function normalizeDesktopMode(value) {
  const mode = String(value || '').toLowerCase();
  return ['server', 'client', 'unified'].includes(mode) ? mode : 'unified';
}

function inferDesktopMode() {
  const explicitMode = normalizeDesktopMode(process.env.BIZ_ARENA_DESKTOP_MODE || process.env.BIZ_ARENA_APP_MODE);
  if (explicitMode !== 'unified') return explicitMode;
  const executableName = path.basename(process.execPath || '').toLowerCase();
  if (executableName.includes('client')) return 'client';
  if (executableName.includes('server')) return 'server';
  return 'unified';
}

function appendModePath(baseUrl, mode) {
  if (!baseUrl) return SERVER_URL;
  const cleanUrl = String(baseUrl).replace(/\/+$/, '');
  if (mode === 'server' && /\/server$/i.test(cleanUrl)) return cleanUrl;
  if (mode === 'client' && /\/client$/i.test(cleanUrl)) return cleanUrl;
  if (mode === 'server') return `${cleanUrl}/server`;
  if (mode === 'client') return `${cleanUrl}/client`;
  return cleanUrl;
}

const DESKTOP_MODE = inferDesktopMode();
const SHOULD_START_LOCAL_SERVER = DESKTOP_MODE !== 'client';
const TARGET_URL = appendModePath(
  DESKTOP_MODE === 'client' ? (process.env.BIZ_ARENA_SERVER_URL || SERVER_URL) : SERVER_URL,
  DESKTOP_MODE
);

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
  if (!SHOULD_START_LOCAL_SERVER || serverProcess) return;

  const serverCwd = app.isPackaged ? app.getPath('userData') : path.join(__dirname, '..');

  serverProcess = spawn(process.execPath, [SERVER_ENTRY], {
    cwd: serverCwd,
    env: {
      ...process.env,
      PORT: String(PORT),
      ELECTRON_RUN_AS_NODE: '1',
      BIZ_ARENA_DESKTOP: '1',
      BIZ_ARENA_APP_MODE: DESKTOP_MODE,
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
    title: DESKTOP_MODE === 'server' ? 'BizArena Server' : DESKTOP_MODE === 'client' ? 'BizArena Client' : 'Biz Arena',
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

  if (DESKTOP_MODE === 'client' && !process.env.BIZ_ARENA_SERVER_URL) {
    loadClassroomClientConnectionScreen();
    return;
  }

  mainWindow.loadURL(TARGET_URL);
}

function loadClientConnectionScreen() {
  const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>BizArena Client</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; color: #f2f7ff; background:
      linear-gradient(rgba(112, 191, 255, 0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(112, 191, 255, 0.035) 1px, transparent 1px),
      radial-gradient(circle at 70% 10%, rgba(34, 185, 255, 0.18), transparent 34%),
      #06101c; background-size: 40px 40px, 40px 40px, auto, auto; }
    main { width: min(680px, calc(100vw - 32px)); display: grid; gap: 18px; padding: 28px; border: 1px solid rgba(122,190,255,.22); border-radius: 16px; background: rgba(8,20,35,.94); box-shadow: 0 24px 70px rgba(0,0,0,.35); }
    h1 { margin: 0; font-size: 28px; }
    p { margin: 0; color: #a9bdd8; line-height: 1.5; }
    label { display: grid; gap: 8px; color: #dce8f7; font-weight: 800; }
    input { width: 100%; box-sizing: border-box; border: 1px solid rgba(122,190,255,.24); border-radius: 12px; padding: 15px 16px; background: rgba(4,13,24,.9); color: #f2f7ff; font: inherit; }
    button { border: 0; border-radius: 12px; padding: 15px 18px; font: inherit; font-weight: 900; color: #04121e; background: linear-gradient(135deg, #5ed7ff, #4e8dff); cursor: pointer; }
    small { color: #7f95b2; line-height: 1.45; }
    .error { color: #ff7e8b; min-height: 20px; }
  </style>
</head>
<body>
  <main>
    <div>
      <h1>BizArena Client</h1>
      <p>Введите адрес сервера преподавателя. Все расчеты идут на компьютере Server, этот клиент только подключается к комнате.</p>
    </div>
    <label>
      Адрес сервера
      <input id="server-url" value="http://127.0.0.1:${PORT}" placeholder="http://192.168.0.10:3000" autofocus />
    </label>
    <button id="connect">Подключиться</button>
    <div id="error" class="error"></div>
    <small>После подключения введите код комнаты и название компании. Если сервер в локальной сети, адрес можно взять из BizArena Server.</small>
  </main>
  <script>
    function normalizeUrl(value) {
      var url = String(value || '').trim();
      if (!url) throw new Error('Введите адрес сервера.');
      if (!/^https?:\\/\\//i.test(url)) url = 'http://' + url;
      url = url.replace(/\\/+$/, '');
      if (!/\\/client$/i.test(url)) url += '/client';
      return url;
    }
    document.querySelector('#connect').addEventListener('click', function () {
      try { location.href = normalizeUrl(document.querySelector('#server-url').value); }
      catch (error) { document.querySelector('#error').textContent = error.message; }
    });
    document.querySelector('#server-url').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') document.querySelector('#connect').click();
    });
  </script>
</body>
</html>`;
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

function loadClassroomClientConnectionScreen() {
  const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>BizArena Client</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; color: #f2f7ff; background:
      linear-gradient(rgba(112, 191, 255, 0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(112, 191, 255, 0.035) 1px, transparent 1px),
      radial-gradient(circle at 70% 10%, rgba(34, 185, 255, 0.18), transparent 34%),
      #06101c; background-size: 40px 40px, 40px 40px, auto, auto; }
    main { width: min(720px, calc(100vw - 32px)); display: grid; gap: 18px; padding: 28px; border: 1px solid rgba(122,190,255,.22); border-radius: 16px; background: rgba(8,20,35,.94); box-shadow: 0 24px 70px rgba(0,0,0,.35); }
    h1 { margin: 0; font-size: 28px; }
    p { margin: 0; color: #a9bdd8; line-height: 1.5; }
    label { display: grid; gap: 8px; color: #dce8f7; font-weight: 800; }
    input { width: 100%; box-sizing: border-box; border: 1px solid rgba(122,190,255,.24); border-radius: 12px; padding: 15px 16px; background: rgba(4,13,24,.9); color: #f2f7ff; font: inherit; }
    button { border: 0; border-radius: 12px; padding: 15px 18px; font: inherit; font-weight: 900; color: #04121e; background: linear-gradient(135deg, #5ed7ff, #4e8dff); cursor: pointer; }
    small { color: #7f95b2; line-height: 1.45; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .error { color: #ff7e8b; min-height: 20px; }
    @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <div>
      <h1>BizArena Client</h1>
      <p>Введите адрес сервера преподавателя, код комнаты и свои данные. Все расчеты идут на компьютере Server, этот клиент только подключается к комнате.</p>
    </div>
    <label>
      Адрес сервера
      <input id="server-url" value="http://127.0.0.1:${PORT}" placeholder="http://192.168.0.10:3000" autofocus />
    </label>
    <div class="grid">
      <label>
        Код комнаты
        <input id="room-code" maxlength="5" placeholder="ABCDE" />
      </label>
      <label>
        Имя ученика
        <input id="student-name" maxlength="24" placeholder="Student-4821" />
      </label>
    </div>
    <label>
      Название компании
      <input id="company-name" maxlength="24" placeholder="Команда 11А" />
    </label>
    <button id="connect">Подключиться</button>
    <div id="error" class="error"></div>
    <small>Адрес и код комнаты показывает BizArena Server на компьютере преподавателя. Если подключение по IP не работает, проверьте /api/health, firewall и общую сеть.</small>
  </main>
  <script>
    function studentNameFallback() {
      return 'Student-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    }
    function normalizeUrl(value) {
      var url = String(value || '').trim();
      if (!url) throw new Error('Введите адрес сервера.');
      if (!/^https?:\\/\\//i.test(url)) url = 'http://' + url;
      return url.replace(/\\/+$/, '');
    }
    document.querySelector('#student-name').value = studentNameFallback();
    document.querySelector('#connect').addEventListener('click', function () {
      try {
        var base = normalizeUrl(document.querySelector('#server-url').value);
        var roomCode = document.querySelector('#room-code').value.trim().toUpperCase();
        var studentName = document.querySelector('#student-name').value.trim() || studentNameFallback();
        var companyName = document.querySelector('#company-name').value.trim();
        if (!roomCode) throw new Error('Введите код комнаты.');
        if (!companyName) throw new Error('Введите название компании.');
        var target = new URL(base + '/client');
        target.searchParams.set('roomCode', roomCode);
        target.searchParams.set('userName', studentName);
        target.searchParams.set('companyName', companyName);
        target.searchParams.set('autojoin', '1');
        location.href = target.href;
      } catch (error) {
        document.querySelector('#error').textContent = error.message;
      }
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') document.querySelector('#connect').click();
    });
  </script>
</body>
</html>`;
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
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
  shuttingDown = true;
  stopServer();
});
