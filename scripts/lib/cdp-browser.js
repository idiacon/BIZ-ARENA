const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function readJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
    }).on('error', reject);
  });
}

async function waitForHttp(url, attempts = 80) {
  for (let index = 0; index < attempts; index += 1) {
    try { return await readJson(url); } catch { await sleep(200); }
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function connectCdp(wsUrl) {
  const socket = new WebSocket(wsUrl);
  const pending = new Map();
  const events = [];
  let nextId = 1;
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id) {
      events.push(message);
      return;
    }
    if (!pending.has(message.id)) return;
    const entry = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(message.error.message || JSON.stringify(message.error)));
    else entry.resolve(message.result);
  });
  return {
    events,
    close: () => socket.close(),
    send(method, params = {}) {
      const id = nextId++;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
  };
}

async function connectRemoteBrowser({ cdpPort, width = 1440, height = 900, label = 'remote browser' }) {
  await waitForHttp(`http://127.0.0.1:${cdpPort}/json/version`);
  const targets = await readJson(`http://127.0.0.1:${cdpPort}/json`);
  const target = targets.find(item => item.type === 'page') || targets[0];
  if (!target?.webSocketDebuggerUrl) throw new Error(`No CDP page target for ${label}`);
  const cdp = await connectCdp(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, mobile: false, deviceScaleFactor: 1 });
  return cdp;
}

async function launchBrowser({ cdpPort, profileDir, width = 1440, height = 900 }) {
  const edgePath = EDGE_CANDIDATES.find(fs.existsSync);
  if (!edgePath) throw new Error('Microsoft Edge is required for classroom E2E');
  const process = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${profileDir}`,
    `--window-size=${width},${height}`,
    '--disable-gpu',
    '--disable-extensions',
    '--disable-component-extensions-with-background-pages',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ], { stdio: 'ignore', windowsHide: true });
  await waitForHttp(`http://127.0.0.1:${cdpPort}/json/version`);
  const targets = await readJson(`http://127.0.0.1:${cdpPort}/json`);
  const target = targets.find(item => item.type === 'page') || targets[0];
  if (!target?.webSocketDebuggerUrl) throw new Error('No Edge CDP page target');
  const cdp = await connectCdp(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, mobile: false, deviceScaleFactor: 1 });
  return { process, cdp };
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Browser evaluation failed');
  return result.result?.value;
}

async function waitFor(cdp, expression, label, attempts = 80) {
  for (let index = 0; index < attempts; index += 1) {
    if (await evaluate(cdp, expression)) return;
    await sleep(200);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function installPlayerSession(cdp, session) {
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    localStorage.setItem('bizArenaPlayerId', ${JSON.stringify(session.playerId)});
    localStorage.setItem('bizArenaRoomCode', ${JSON.stringify(session.roomCode)});
    localStorage.setItem('bizArenaSessionToken', ${JSON.stringify(session.sessionToken)});
    localStorage.setItem('bizArenaUserName', ${JSON.stringify(session.userName)});
    localStorage.setItem('bizArenaLanguage', 'ru');
    localStorage.setItem('bizArenaPerformanceMode', ${JSON.stringify(session.performanceMode || 'full')});
    localStorage.setItem('bizArenaRefreshCadence', ${JSON.stringify(session.refreshCadence || 'balanced')});
    localStorage.setItem('bizArenaAnimationMode', 'reduced');
    localStorage.setItem('bizArenaGameTab', ${JSON.stringify(session.gameTab || 'overview')});
  ` });
}

async function navigate(cdp, url) {
  await cdp.send('Page.navigate', { url });
  await waitFor(cdp, 'document.readyState === "complete"', `${url} document`);
  await waitFor(cdp, 'Boolean(document.querySelector("#app-root, .app-shell, .screen"))', `${url} app`);
}

function browserErrors(cdp) {
  return cdp.events.filter(event => event.method === 'Runtime.exceptionThrown'
    || (event.method === 'Log.entryAdded' && ['error', 'warning'].includes(event.params?.entry?.level)));
}

module.exports = {
  browserErrors,
  connectRemoteBrowser,
  evaluate,
  installPlayerSession,
  launchBrowser,
  navigate,
  readJson,
  sleep,
  waitFor,
  waitForHttp,
};
