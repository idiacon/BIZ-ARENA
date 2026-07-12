const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 3210;
const CDP_PORT = 9333;
const VIEWPORT = { width: 1600, height: 1000 };
const MIN_DESKTOP = { width: 1000, height: 760 };
const ULTRAWIDE = { width: 3440, height: 1440 };
const ENTRY_ONLY = process.env.BIZ_ARENA_CAPTURE_ENTRY_ONLY === '1';

const screenshotsDir = path.join(ROOT, 'defense-assets', 'screenshots');
const resultsDir = path.join(ROOT, 'defense-assets', 'results');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

function postJson(url, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const request = http.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, response => {
      let responseBody = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { responseBody += chunk; });
      response.on('end', () => {
        if (response.statusCode >= 400) {
          reject(new Error(`${response.statusCode}: ${responseBody}`));
          return;
        }
        try {
          resolve(responseBody ? JSON.parse(responseBody) : {});
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

async function waitForHttp(url, attempts = 50) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      await getJson(url);
      return;
    } catch {
      await sleep(200);
    }
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function connectCdp(wsUrl) {
  const socket = new WebSocket(wsUrl);
  const pending = new Map();
  let nextId = 1;

  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message || JSON.stringify(message.error)));
    else resolve(message.result);
  });

  function send(method, params = {}) {
    const id = nextId;
    nextId += 1;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
    });
  }

  return {
    send,
    close: () => socket.close(),
  };
}

async function main() {
  if (!fs.existsSync(EDGE_PATH)) {
    throw new Error(`Microsoft Edge was not found at ${EDGE_PATH}`);
  }

  ensureDir(screenshotsDir);
  ensureDir(resultsDir);

  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biz-arena-defense-data-'));
  const edgeProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biz-arena-edge-'));
  const server = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      BIZ_ARENA_DATA_DIR: dataDir,
    },
    stdio: 'ignore',
    windowsHide: true,
  });

  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${edgeProfileDir}`,
    `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ], {
    stdio: 'ignore',
    windowsHide: true,
  });

  let cdp;
  function safeRm(dir) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Could not remove temp directory ${dir}: ${error.message}`);
    }
  }
  try {
    await waitForHttp(`http://127.0.0.1:${PORT}/api/meta`);
    await waitForHttp(`http://127.0.0.1:${CDP_PORT}/json/version`);
    const targets = await getJson(`http://127.0.0.1:${CDP_PORT}/json`);
    const pageTarget = targets.find(target => target.type === 'page') || targets[0];
    cdp = await connectCdp(pageTarget.webSocketDebuggerUrl);

    const send = cdp.send;
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      deviceScaleFactor: 1,
      mobile: false,
    });

    async function evaluate(expression) {
      const result = await send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.text || 'Runtime evaluation failed');
      }
      return result.result?.value;
    }

    async function waitFor(expression, label, attempts = 50) {
      for (let index = 0; index < attempts; index += 1) {
        if (await evaluate(expression)) return;
        await sleep(200);
      }
      throw new Error(`Timed out waiting for ${label}`);
    }

    async function screenshot(fileName, prep = '') {
      if (prep) await evaluate(prep);
      await sleep(350);
      const result = await send('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
        captureBeyondViewport: false,
      });
      fs.writeFileSync(path.join(screenshotsDir, fileName), Buffer.from(result.data, 'base64'));
      console.log(`saved ${fileName}`);
    }

    async function clickSelector(selector, label) {
      const ok = await evaluate(`(() => {
        const node = document.querySelector(${JSON.stringify(selector)});
        if (!node) return false;
        node.scrollIntoView({ block: 'center', inline: 'center' });
        node.click();
        return true;
      })()`);
      if (!ok) {
        const diagnostics = await evaluate(`(() => ({
          screen: document.querySelector('.screen.active')?.id || '',
          gameTab: document.body.dataset.gameTab || '',
          factoryActions: [...document.querySelectorAll('[data-factory-action]')].map(node => ({
            action: node.dataset.factoryAction || '',
            value: node.dataset.assembleValue || '',
            disabled: Boolean(node.disabled),
            text: String(node.textContent || '').trim().slice(0, 80),
          })),
          visiblePanel: document.querySelector('[data-game-panel]:not(.hidden)')?.dataset.gamePanel || '',
        }))()`);
        throw new Error(`Could not click ${label || selector}: ${JSON.stringify(diagnostics)}`);
      }
      await sleep(750);
    }

    async function setViewport(viewport) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await sleep(250);
    }

    async function assertViewport(label) {
      const result = await evaluate(`(() => {
        const width = window.innerWidth;
        const overflow = Math.max(
          document.documentElement.scrollWidth - width,
          document.body.scrollWidth - width,
        );
        return { width, overflow, ok: overflow <= 4 };
      })()`);
      if (!result.ok) throw new Error(`${label} overflows viewport: ${JSON.stringify(result)}`);
      console.log(`viewport ${label} ${JSON.stringify(result)}`);
    }

    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}` });
    await waitFor('document.readyState === "complete" && !!document.querySelector("#main-menu-screen.active")', 'main menu');
    await screenshot('01-main-menu.png', 'window.scrollTo(0, 0)');
    await setViewport(MIN_DESKTOP);
    await assertViewport('role entry 1000x760');
    await screenshot('01-main-menu-1000x760.png', 'window.scrollTo(0, 0)');
    await setViewport(ULTRAWIDE);
    await assertViewport('role entry 3440x1440');
    await screenshot('01-main-menu-3440x1440.png', 'window.scrollTo(0, 0)');
    await setViewport(VIEWPORT);

    await screenshot('02-role-entry.png', `(() => {
      const studentEntry = document.querySelector('[data-entry-role="student"]');
      studentEntry?.focus();
      window.scrollTo(0, 0);
    })()`);
    await clickSelector('[data-entry-role="teacher"]', 'teacher role');
    await waitFor('!!document.querySelector("#server-home-screen.active")', 'teacher start');
    await screenshot('02-teacher-start.png', 'window.scrollTo(0, 0)');
    await clickSelector('[data-teacher-entry-action="create"]', 'create room entry');
    await waitFor('!!document.querySelector("#create-room-screen.active")', 'create room');
    await screenshot('02-create-room.png', 'window.scrollTo(0, 0)');
    await evaluate('showScreen("main-menu-screen", { addToHistory: false })');
    await clickSelector('[data-entry-role="student"]', 'student role');
    await waitFor('!!document.querySelector("#join-room-screen.active")', 'student join');
    await screenshot('02-student-join.png', 'window.scrollTo(0, 0)');
    await evaluate('showScreen("main-menu-screen", { addToHistory: false })');

    if (ENTRY_ONLY) return;

    const lobbyResult = await evaluate(`(async () => {
      window.__lastAlert = '';
      window.alert = message => { window.__lastAlert = String(message || ''); };
      try {
        await createRoom({
          roomName: 'Учебная комната кафедры',
          companyName: 'Команда Альфа',
          scenarioKey: 'motorcycles',
          difficulty: 'easy',
        });
        showScreen('lobby-screen', { addToHistory: false });
        return { ok: true, screen: document.querySelector('.screen.active')?.id || '', alert: window.__lastAlert };
      } catch (error) {
        return { ok: false, error: error.message, screen: document.querySelector('.screen.active')?.id || '', alert: window.__lastAlert };
      }
    })()`);
    if (!lobbyResult.ok) {
      throw new Error(`Lobby room failed: ${lobbyResult.error || lobbyResult.alert || 'unknown error'}`);
    }
    await waitFor('!!document.querySelector("#lobby-screen.active")', 'lobby room');
    await screenshot('02-lobby-room.png', 'window.scrollTo(0, 0)');

    const demoResult = await evaluate(`(async () => {
      window.__lastAlert = '';
      window.alert = message => { window.__lastAlert = String(message || ''); };
      try {
        await createDemoSession();
        return {
          ok: true,
          screen: document.querySelector('.screen.active')?.id || '',
          playerId: localStorage.getItem('bizArenaPlayerId') || '',
          alert: window.__lastAlert,
        };
      } catch (error) {
        return {
          ok: false,
          error: error.message,
          screen: document.querySelector('.screen.active')?.id || '',
          alert: window.__lastAlert,
        };
      }
    })()`);
    if (!demoResult.ok) {
      throw new Error(`Demo session failed: ${demoResult.error || demoResult.alert || 'unknown error'}`);
    }
    console.log(`demo screen ${demoResult.screen || 'unknown'} player ${demoResult.playerId || 'none'}`);
    await waitFor('!!document.querySelector("#game-screen.active")', 'demo start');
    await screenshot('03-demo-started.png', 'window.scrollTo(0, 0)');
    await screenshot('03-tutorial-overlay.png', 'startTutorial(); window.scrollTo(0, 0)');
    await clickSelector('[data-factory-node="warehouse"]', 'tutorial warehouse');
    await clickSelector('[data-game-tab="purchase"]', 'tutorial purchase tab');
    await clickSelector('[data-supplier-offer]', 'tutorial buy supplier lot');
    await clickSelector('[data-game-tab="competitors"]', 'tutorial personnel tab');
    await clickSelector('[data-personnel-hire]', 'tutorial hire worker');
    await clickSelector('[data-game-tab="operations"]', 'tutorial operations tab');
    await clickSelector('[data-factory-node="assembly"]', 'tutorial assembly');
    await clickSelector('[data-factory-action="assemble-product"][data-assemble-value="1"]', 'tutorial assemble one');
    await clickSelector('[data-game-tab="market"]', 'tutorial marketing tab');
    await clickSelector('.market-trade-desk', 'tutorial trade desk');
    await clickSelector('[data-market-sale-action="submit"]', 'tutorial submit sale');
    await clickSelector('[data-market-turn-action]', 'tutorial finish turn');
    await clickSelector('#tutorial-next-button', 'tutorial close');
    await waitFor('!document.querySelector("#tutorial-overlay:not(.hidden)")', 'tutorial completion');
    await screenshot('03-tutorial-complete.png', 'window.scrollTo(0, 0)');
    await evaluate('stopTutorial()');
    await evaluate('document.querySelector(\'[data-game-tab="operations"]\').click()');
    await waitFor('!!document.querySelector(\'[data-game-panel="operations"]:not(.hidden)\')', 'operations tab restored');
    await screenshot('04-production.png', 'document.querySelector("#factory-operations")?.scrollIntoView({ block: "start" })');
    await evaluate('document.querySelector(\'[data-game-tab="overview"]\').click()');
    await waitFor('!!document.querySelector(\'[data-game-panel="overview"]:not(.hidden)\')', 'finance tab');
    await screenshot('04-finance.png', 'window.scrollTo(0, 0)');

    await evaluate('document.querySelector(\'[data-game-tab="market"]\').click()');
    await waitFor('!!document.querySelector(\'[data-game-panel="market"]:not(.hidden)\')', 'market tab');
    await screenshot('05-market-terminal.png', 'window.scrollTo(0, 0)');
    await evaluate('document.querySelector(\'[data-game-tab="competitors"]\').click()');
    await waitFor('!!document.querySelector(\'[data-game-panel="competitors"]:not(.hidden)\')', 'personnel tab');
    await screenshot('05-personnel.png', 'window.scrollTo(0, 0)');
    await setViewport(MIN_DESKTOP);
    await assertViewport('personnel 1000x760');
    await screenshot('05-personnel-1000x760.png', 'window.scrollTo(0, 0)');
    await setViewport(ULTRAWIDE);
    await assertViewport('personnel 3440x1440');
    await screenshot('05-personnel-3440x1440.png', 'window.scrollTo(0, 0)');
    await setViewport(VIEWPORT);
    await evaluate('document.querySelector(\'[data-game-tab="purchase"]\').click()');
    await waitFor('!!document.querySelector(\'[data-game-panel="purchase"]:not(.hidden)\')', 'purchase tab');
    await screenshot('05-purchase.png', 'window.scrollTo(0, 0)');
    await evaluate('document.querySelector(\'[data-game-tab="events"]\').click()');
    await waitFor('!!document.querySelector(\'[data-game-panel="events"]:not(.hidden)\')', 'reports tab');
    await screenshot('05-reports.png', 'window.scrollTo(0, 0)');
    await evaluate('document.querySelector(\'[data-game-tab="market"]\').click()');
    await waitFor('!!document.querySelector(\'[data-game-panel="market"]:not(.hidden)\')', 'market tab restored');
    await screenshot('05-contracts.png', 'document.querySelector("#contract-board")?.scrollIntoView({ block: "start" })');

    let finalState = null;
    for (let turn = 0; turn < 12; turn += 1) {
      finalState = await evaluate(`(async () => {
        await refreshState();
        return { room: state.room, player: state.player };
      })()`);
      if (finalState.room.status === 'finished') break;
      await evaluate(`sendAction('next-turn', undefined, { throwOnError: true })`);
    }
    finalState = await evaluate(`(async () => {
      await refreshState();
      return { room: state.room, player: state.player };
    })()`);
    await evaluate('(async () => { await refreshState(); showScreen("results-screen", { addToHistory: false }); })()');

    await waitFor('!!document.querySelector("#results-screen.active")', 'results screen');
    const presentationAudit = await evaluate(`(() => {
      const leaderboardText = String(document.querySelector('#leaderboard-results')?.textContent || '');
      const eventLogText = String(document.querySelector('#event-log-results')?.textContent || '');
      const visibleText = leaderboardText + '\\n' + eventLogText;
      const forbidden = /AI Manager|cleared the sell order|strategic round|\\b[a-z]+_[a-z_]+\\b/i;
      const match = visibleText.match(forbidden);
      return { ok: !match, match: match?.[0] || '', sample: visibleText.slice(0, 700) };
    })()`);
    if (!presentationAudit.ok) {
      throw new Error(`raw event log labels: ${JSON.stringify(presentationAudit)}`);
    }
    await screenshot('06-leaderboard.png', 'document.querySelector("#leaderboard-results")?.scrollIntoView({ block: "start" })');
    await setViewport(MIN_DESKTOP);
    await assertViewport('results 1000x760');
    await screenshot('06-leaderboard-1000x760.png', 'document.querySelector("#leaderboard-results")?.scrollIntoView({ block: "start" })');
    await setViewport(ULTRAWIDE);
    await assertViewport('results 3440x1440');
    await screenshot('06-leaderboard-3440x1440.png', 'document.querySelector("#leaderboard-results")?.scrollIntoView({ block: "start" })');
    await setViewport(VIEWPORT);
    await screenshot('07-results.png', 'window.scrollTo(0, 0)');

    const room = finalState.room;
    const player = finalState.player;
    const winner = (room.players || []).find(item => item.id === room.winnerPlayerId) || (room.leaderboard || [])[0] || null;
    const exportPayload = {
      project: 'Biz Arena',
      version: packageJson.version,
      exportedAt: new Date().toISOString(),
      purpose: 'Defense screenshot export preview',
      room: {
        code: room.code,
        name: room.name,
        status: room.status,
        scenario: room.scenarioLabel,
        difficulty: room.difficulty,
        dayLimit: room.settings?.dayLimit,
        finalDay: room.day,
      },
      summary: {
        playerCompany: player.name,
        playerNetWorth: player.netWorth,
        playerDebt: player.debt,
        playerDebrief: player.playerDebrief || null,
      },
      classDebrief: room.classDebrief || null,
      winner: winner ? {
        company: winner.name,
        userName: winner.userName,
        netWorth: winner.netWorth,
      } : null,
      leaderboard: (room.leaderboard || []).map((item, index) => ({
        rank: index + 1,
        company: item.name,
        netWorth: item.netWorth,
        isBot: Boolean(item.isBot),
      })),
      contracts: room.contractBoard || [],
    };
    const jsonPath = path.join(resultsDir, 'biz-arena-results-demo.json');
    fs.writeFileSync(jsonPath, JSON.stringify(exportPayload, null, 2), 'utf8');

    const previewHtmlPath = path.join(resultsDir, 'export-preview.html');
    fs.writeFileSync(previewHtmlPath, `<!doctype html>
<meta charset="utf-8" />
<title>Biz Arena results export</title>
<style>
  body { margin: 0; background: #08111d; color: #eef4ff; font: 18px/1.5 Consolas, monospace; }
  main { padding: 36px; }
  h1 { font: 700 32px/1.2 Arial, sans-serif; margin: 0 0 20px; }
  pre { white-space: pre-wrap; background: rgba(255,255,255,0.06); border: 1px solid rgba(140,183,255,0.18); border-radius: 8px; padding: 24px; }
</style>
<main>
  <h1>biz-arena-results-demo.json</h1>
  <pre>${JSON.stringify(exportPayload, null, 2).replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]))}</pre>
</main>`, 'utf8');

    await send('Page.navigate', { url: `file:///${previewHtmlPath.replace(/\\/g, '/')}` });
    await waitFor('document.readyState === "complete" && document.body.innerText.includes("leaderboard")', 'export JSON preview');
    await screenshot('08-export-json.png', 'window.scrollTo(0, 0)');

    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}` });
    await waitFor('document.readyState === "complete"', 'app reload');
    await evaluate('showScreen("about-screen", { addToHistory: false })');
    await screenshot('09-about.png', 'window.scrollTo(0, 0)');
    await evaluate('showScreen("settings-screen", { addToHistory: false })');
    await screenshot('10-settings-language.png', 'window.scrollTo(0, 0)');

    console.log(`results ${jsonPath}`);
  } finally {
    if (cdp) cdp.close();
    edge.kill();
    server.kill();
    await sleep(800);
    safeRm(dataDir);
    safeRm(edgeProfileDir);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
