const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = Number(process.env.BIZ_ARENA_SCREENSHOT_PORT || 3220);
const TEACHER_CDP_PORT = Number(process.env.BIZ_ARENA_TEACHER_CDP_PORT || 9340);
const STUDENT_CDP_PORT = Number(process.env.BIZ_ARENA_STUDENT_CDP_PORT || 9341);
const OUTPUT_DIR = process.env.BIZ_ARENA_SCREENSHOT_DIR
  ? path.resolve(process.env.BIZ_ARENA_SCREENSHOT_DIR)
  : path.join(ROOT, 'tmp', 'screenshots-v18-desktop-pilot');

const DESKTOP = { width: 1440, height: 900, mobile: false, deviceScaleFactor: 1 };
const MIN_DESKTOP = { width: 1000, height: 760, mobile: false, deviceScaleFactor: 1 };
const ULTRAWIDE = { width: 3440, height: 1440, mobile: false, deviceScaleFactor: 1 };
const QA_VIEWPORTS = [
  MIN_DESKTOP,
  DESKTOP,
  { width: 1920, height: 1080, mobile: false, deviceScaleFactor: 1 },
  { width: 2560, height: 1440, mobile: false, deviceScaleFactor: 1 },
  ULTRAWIDE,
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function readJson(url) {
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

async function waitForHttp(url, attempts = 70) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      await readJson(url);
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

async function launchBrowser({ cdpPort, profileDir, viewport, label }) {
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${profileDir}`,
    `--window-size=${viewport.width},${viewport.height}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ], {
    stdio: 'ignore',
    windowsHide: true,
  });

  await waitForHttp(`http://127.0.0.1:${cdpPort}/json/version`);
  const targets = await readJson(`http://127.0.0.1:${cdpPort}/json`);
  const target = targets.find(item => item.type === 'page') || targets[0];
  if (!target?.webSocketDebuggerUrl) throw new Error(`No CDP target for ${label}`);
  const cdp = await connectCdp(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', viewport);
  return { edge, cdp };
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Runtime evaluation failed');
  }
  return result.result?.value;
}

async function waitFor(cdp, expression, label, attempts = 80) {
  for (let index = 0; index < attempts; index += 1) {
    if (await evaluate(cdp, expression)) return;
    await sleep(200);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function collectViewportAudit(cdp, label) {
  const result = await evaluate(cdp, `(() => {
    const markers = ['????', 'вЂ', 'в‚', 'Ð', 'Ñ', 'Рџ', 'РЎ', 'Рќ', 'Рґ', 'Рё', 'Рѕ', 'СЃ', 'С‚', 'СЊ', 'С‹'];
    const text = document.body.innerText || '';
    const textMarkers = markers.filter(marker => text.includes(marker));
    const viewport = window.innerWidth;
    const root = document.documentElement;
    const body = document.body;
    const insideHorizontalScroller = node => {
      let current = node.parentElement;
      while (current) {
        const style = getComputedStyle(current);
        if (['auto', 'scroll'].includes(style.overflowX) && current.scrollWidth > current.clientWidth + 4) return true;
        current = current.parentElement;
      }
      return false;
    };
    const overflow = Math.max(root.scrollWidth - viewport, body.scrollWidth - viewport);
    const overflowNodes = [...document.querySelectorAll('body *')]
      .filter(node => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && (rect.left < -4 || rect.right > viewport + 4) && !insideHorizontalScroller(node);
      })
      .map(node => {
        const rect = node.getBoundingClientRect();
        return {
          tag: node.tagName,
          id: node.id || '',
          className: String(node.className || '').slice(0, 120),
          text: String(node.innerText || node.textContent || '').trim().slice(0, 80),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .slice(0, 8);
    return {
      label: ${JSON.stringify(label)},
      ok: textMarkers.length === 0 && overflow <= 4 && overflowNodes.length === 0,
      textMarkers,
      viewport,
      rootScrollWidth: root.scrollWidth,
      bodyScrollWidth: body.scrollWidth,
      overflow,
      overflowNodes,
    };
  })()`);
  if (!result.ok) {
    throw new Error(`${label} failed screenshot audit: ${JSON.stringify(result)}`);
  }
  return result;
}

async function collectTextVisibilityAudit(cdp, label, selectors) {
  const result = await evaluate(cdp, `(() => {
    const checks = ${JSON.stringify(selectors)};
    const nodes = checks.map(entry => {
      const check = typeof entry === 'string' ? { selector: entry, fit: false } : entry;
      const selector = check.selector;
      const node = document.querySelector(selector);
      if (!node) return { selector, ok: false, reason: 'missing' };
      const text = String(node.innerText || node.textContent || '').trim();
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      const range = document.createRange();
      range.selectNodeContents(node);
      const textRect = range.getBoundingClientRect();
      const fits = !check.fit || textRect.width <= rect.width + 1;
      const container = check.containerSelector ? document.querySelector(check.containerSelector) : null;
      const containerRect = container?.getBoundingClientRect() || null;
      const insideContainer = !check.containerSelector || Boolean(
        containerRect
        && rect.left >= containerRect.left - 1
        && rect.right <= containerRect.right + 1
      );
      const ok = Boolean(text)
        && style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity || 1) > 0.05
        && rect.width >= 24
        && rect.height >= 12
        && textRect.width >= 8
        && textRect.height >= 8
        && fits
        && insideContainer;
      return {
        selector,
        ok,
        reason: ok ? '' : !fits ? 'text-clipped' : !insideContainer ? 'outside-container' : 'text-not-painted',
        fit: Boolean(check.fit),
        containerSelector: check.containerSelector || '',
        text: text.slice(0, 80),
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        color: style.color,
        rect: {
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
        textRect: {
          width: Math.round(textRect.width),
          height: Math.round(textRect.height),
        },
        containerRect: containerRect ? {
          left: Math.round(containerRect.left),
          right: Math.round(containerRect.right),
          clientWidth: container.clientWidth,
          scrollWidth: container.scrollWidth,
          scrollLeft: Math.round(container.scrollLeft),
        } : null,
      };
    });
    return { label: ${JSON.stringify(label)}, ok: nodes.every(node => node.ok), nodes };
  })()`);
  if (!result.ok) {
    throw new Error(`${label} failed text visibility audit: ${JSON.stringify(result)}`);
  }
  return result;
}

async function capture(cdp, fileName, prep = '') {
  if (prep) await evaluate(cdp, prep);
  await sleep(450);
  const result = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const filePath = path.join(OUTPUT_DIR, fileName);
  fs.writeFileSync(filePath, Buffer.from(result.data, 'base64'));
  console.log(`saved ${filePath}`);
}

function scrollBelowSticky(selector) {
  return `(() => {
    const target = document.querySelector(${JSON.stringify(selector)});
    if (!target) return false;
    const sticky = document.querySelector('.game-control-panel');
    const targetTop = window.scrollY + target.getBoundingClientRect().top;
    const offset = (sticky?.getBoundingClientRect().height || 0) + 16;
    window.scrollTo(0, Math.max(0, targetTop - offset));
    return true;
  })()`;
}

async function setSessionScript(cdp, session) {
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      localStorage.setItem('bizArenaPlayerId', ${JSON.stringify(session.playerId)});
      localStorage.setItem('bizArenaRoomCode', ${JSON.stringify(session.roomCode)});
      localStorage.setItem('bizArenaSessionToken', ${JSON.stringify(session.sessionToken)});
      localStorage.setItem('bizArenaUserName', ${JSON.stringify(session.userName)});
      localStorage.setItem('bizArenaLanguage', 'ru');
      localStorage.setItem('bizArenaPerformanceMode', ${JSON.stringify(session.performanceMode || 'full')});
      localStorage.setItem('bizArenaRefreshCadence', ${JSON.stringify(session.refreshCadence || 'balanced')});
      localStorage.setItem('bizArenaAnimationMode', ${JSON.stringify(session.animationMode || 'reduced')});
      localStorage.setItem('bizArenaGameTab', ${JSON.stringify(session.gameTab || 'overview')});
    `,
  });
}

async function navigateApp(cdp, route) {
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}${route}` });
  await waitFor(cdp, 'document.readyState === "complete"', `${route} loaded`);
  await waitFor(cdp, '!!document.querySelector("#app-root, .app-shell, .screen")', `${route} app shell`);
  await sleep(800);
}

async function openScreen(cdp, screenId) {
  const opened = await evaluate(cdp, `(() => {
    if (document.querySelector(${JSON.stringify(`#${screenId}.active`)})) return true;
    const button = document.querySelector(${JSON.stringify(`[data-open-screen="${screenId}"]`)});
    if (!button) return false;
    button.click();
    return true;
  })()`);
  if (opened) await sleep(600);
  return opened;
}

function safeKill(child) {
  if (!child) return;
  try {
    child.kill();
  } catch {
    // ignore process cleanup races on Windows
  }
}

function safeRm(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (error) {
    console.warn(`Could not remove ${dir}: ${error.message}`);
  }
}

async function main() {
  if (!fs.existsSync(EDGE_PATH)) {
    throw new Error(`Microsoft Edge was not found at ${EDGE_PATH}`);
  }
  ensureDir(OUTPUT_DIR);

  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biz-arena-classroom-data-'));
  const teacherProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biz-arena-teacher-edge-'));
  const studentProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biz-arena-student-edge-'));
  const server = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      BIZ_ARENA_APP_MODE: 'server',
      BIZ_ARENA_DATA_DIR: dataDir,
    },
    stdio: 'ignore',
    windowsHide: true,
  });

  let teacherBrowser;
  let studentBrowser;
  const layoutAudits = [];
  try {
    await waitForHttp(`http://127.0.0.1:${PORT}/api/health`);

    const teacher = await postJson(`http://127.0.0.1:${PORT}/api/rooms/create`, {
      roomName: 'ROOM-7A3F',
      companyName: 'Альфа',
      userName: 'А. Кузнецов',
      avatar: 'AK',
      teacherHost: true,
      scenarioKey: 'motorcycles',
      difficulty: 'easy',
      maxPlayers: 8,
      dayLimit: 15,
      turnDurationMs: 300000,
    });
    const roomCode = teacher.roomCode;
    const student = await postJson(`http://127.0.0.1:${PORT}/api/rooms/join`, {
      roomCode,
      companyName: 'Бета',
      userName: 'Иван 11А',
      avatar: 'IB',
    });
    const secondStudent = await postJson(`http://127.0.0.1:${PORT}/api/rooms/join`, {
      roomCode,
      companyName: 'Гамма',
      userName: 'Мария 11Б',
      avatar: 'MG',
    });

    await postJson(`http://127.0.0.1:${PORT}/api/action`, {
      playerId: student.playerId,
      sessionToken: student.sessionToken,
      action: 'toggle-ready',
    });
    await postJson(`http://127.0.0.1:${PORT}/api/action`, {
      playerId: secondStudent.playerId,
      sessionToken: secondStudent.sessionToken,
      action: 'toggle-ready',
    });

    teacherBrowser = await launchBrowser({
      cdpPort: TEACHER_CDP_PORT,
      profileDir: teacherProfileDir,
      viewport: DESKTOP,
      label: 'teacher',
    });
    await setSessionScript(teacherBrowser.cdp, {
      ...teacher,
      roomCode,
      userName: 'А. Кузнецов',
      gameTab: 'teacher',
    });
    await navigateApp(teacherBrowser.cdp, '/server');
    await openScreen(teacherBrowser.cdp, 'lobby-screen');
    await waitFor(teacherBrowser.cdp, '!!document.querySelector("#lobby-screen.active")', 'teacher lobby');
    layoutAudits.push(await collectViewportAudit(teacherBrowser.cdp, 'teacher lobby desktop'));
    await capture(teacherBrowser.cdp, '01-teacher-lobby-desktop.png', 'window.scrollTo(0, 0)');

    studentBrowser = await launchBrowser({
      cdpPort: STUDENT_CDP_PORT,
      profileDir: studentProfileDir,
      viewport: DESKTOP,
      label: 'student',
    });
    await setSessionScript(studentBrowser.cdp, {
      ...student,
      roomCode,
      userName: 'Иван 11А',
      performanceMode: 'lite',
      refreshCadence: 'slow',
      gameTab: 'operations',
    });
    await navigateApp(studentBrowser.cdp, `/client?roomCode=${encodeURIComponent(roomCode)}`);
    await openScreen(studentBrowser.cdp, 'lobby-screen');
    await waitFor(studentBrowser.cdp, '!!document.querySelector("#lobby-screen.active")', 'student lobby');
    layoutAudits.push(await collectViewportAudit(studentBrowser.cdp, 'student lobby desktop'));
    const studentLobbyTextAudit = await collectTextVisibilityAudit(studentBrowser.cdp, 'student lobby text', [
      '#lobby-screen .panel-header .factory-node-label',
      '#lobby-screen .panel-header h2',
      '#lobby-screen .panel-header .muted',
      '.student-lobby-main h3',
    ]);
    await capture(studentBrowser.cdp, '02-student-lobby-ready-desktop.png', 'window.scrollTo(0, 0)');

    await postJson(`http://127.0.0.1:${PORT}/api/server/action`, {
      roomCode,
      action: 'start-game',
    });
    await sleep(900);

    await navigateApp(teacherBrowser.cdp, '/server');
    await openScreen(teacherBrowser.cdp, 'game-screen');
    await waitFor(teacherBrowser.cdp, '!!document.querySelector("#game-screen.active")', 'teacher game');
    await evaluate(teacherBrowser.cdp, `document.querySelector('[data-game-tab="teacher"]')?.click()`);
    await waitFor(teacherBrowser.cdp, '!!document.querySelector(\'[data-game-panel="teacher"]:not(.hidden)\')', 'teacher cockpit');
    layoutAudits.push(await collectViewportAudit(teacherBrowser.cdp, 'teacher cockpit desktop'));
    await capture(teacherBrowser.cdp, '03-teacher-cockpit-desktop.png', 'window.scrollTo(0, 0)');

    for (const viewport of QA_VIEWPORTS) {
      await teacherBrowser.cdp.send('Emulation.setDeviceMetricsOverride', viewport);
      await sleep(250);
      layoutAudits.push(await collectViewportAudit(teacherBrowser.cdp, `teacher cockpit ${viewport.width}px`));
    }

    await teacherBrowser.cdp.send('Emulation.setDeviceMetricsOverride', MIN_DESKTOP);
    await sleep(350);
    await capture(teacherBrowser.cdp, '04-teacher-cockpit-1000x760.png', 'window.scrollTo(0, 0)');
    await teacherBrowser.cdp.send('Emulation.setDeviceMetricsOverride', ULTRAWIDE);
    await sleep(350);
    await capture(teacherBrowser.cdp, '05-teacher-cockpit-3440x1440.png', 'window.scrollTo(0, 0)');

    await navigateApp(studentBrowser.cdp, `/client?roomCode=${encodeURIComponent(roomCode)}`);
    await openScreen(studentBrowser.cdp, 'game-screen');
    await waitFor(studentBrowser.cdp, '!!document.querySelector("#game-screen.active")', 'student game');
    await evaluate(studentBrowser.cdp, `document.querySelector('.app-sidebar-nav [data-role-tab="student"][data-game-tab="operations"]')?.click()`);
    for (const viewport of QA_VIEWPORTS) {
      await studentBrowser.cdp.send('Emulation.setDeviceMetricsOverride', viewport);
      await sleep(250);
      layoutAudits.push(await collectViewportAudit(studentBrowser.cdp, `student game lite ${viewport.width}px`));
    }
    await studentBrowser.cdp.send('Emulation.setDeviceMetricsOverride', MIN_DESKTOP);
    await evaluate(studentBrowser.cdp, `document.querySelector('.app-sidebar-nav [data-role-tab="student"][data-game-tab="operations"]')?.click()`);
    await sleep(350);
    const studentDesktopTopbarTextAudit = await collectTextVisibilityAudit(studentBrowser.cdp, 'student desktop topbar text', [
      '.game-room-chip .game-chip-label',
      '.game-room-chip strong',
      '.game-room-chip small',
      '.game-server-chip .game-chip-label',
      '.game-server-chip strong',
      '.game-server-chip small',
      '.game-time-chip strong',
      '.game-profile-chip strong',
    ]);
    const studentDesktopNavigationTextAudit = await collectTextVisibilityAudit(studentBrowser.cdp, 'student desktop navigation text', [
      {
        selector: '.app-sidebar-link.active',
        fit: true,
        containerSelector: '.app-sidebar-nav',
      },
    ]);
    await capture(studentBrowser.cdp, '06-student-game-1000x760.png', 'window.scrollTo(0, 0)');
    await studentBrowser.cdp.send('Emulation.setDeviceMetricsOverride', ULTRAWIDE);
    await sleep(350);
    await capture(studentBrowser.cdp, '07-student-game-3440x1440.png', 'window.scrollTo(0, 0)');

    await postJson(`http://127.0.0.1:${PORT}/api/server/action`, {
      roomCode,
      action: 'next-turn',
    });
    await sleep(900);
    await navigateApp(studentBrowser.cdp, `/client?roomCode=${encodeURIComponent(roomCode)}`);
    await openScreen(studentBrowser.cdp, 'game-screen');
    await waitFor(
      studentBrowser.cdp,
      `document.querySelector('.turn-review-card')?.dataset.turnReviewContract === 'cause-effect-v1' && document.querySelectorAll('[data-turn-review-section]').length >= 3`,
      'student cause-effect turn review',
    );
    await studentBrowser.cdp.send('Emulation.setDeviceMetricsOverride', DESKTOP);
    await evaluate(studentBrowser.cdp, `document.querySelector('.app-sidebar-nav [data-role-tab="student"][data-game-tab="operations"]')?.click()`);
    await sleep(350);
    layoutAudits.push(await collectViewportAudit(studentBrowser.cdp, 'student turn review desktop'));
    await capture(studentBrowser.cdp, '08-student-turn-review-1440x900.png', scrollBelowSticky('.turn-review-card'));
    for (const viewport of QA_VIEWPORTS) {
      await studentBrowser.cdp.send('Emulation.setDeviceMetricsOverride', viewport);
      await sleep(250);
      layoutAudits.push(await collectViewportAudit(studentBrowser.cdp, `student turn review ${viewport.width}px`));
    }
    await studentBrowser.cdp.send('Emulation.setDeviceMetricsOverride', MIN_DESKTOP);
    await sleep(350);
    await capture(studentBrowser.cdp, '09-student-turn-review-1000x760.png', scrollBelowSticky('.turn-review-card'));
    await studentBrowser.cdp.send('Emulation.setDeviceMetricsOverride', ULTRAWIDE);
    await sleep(350);
    await capture(studentBrowser.cdp, '10-student-turn-review-3440x1440.png', scrollBelowSticky('.turn-review-card'));

    const audit = {
      capturedAt: new Date().toISOString(),
      port: PORT,
      roomCode,
      files: [
        '01-teacher-lobby-desktop.png',
        '02-student-lobby-ready-desktop.png',
        '03-teacher-cockpit-desktop.png',
        '04-teacher-cockpit-1000x760.png',
        '05-teacher-cockpit-3440x1440.png',
        '06-student-game-1000x760.png',
        '07-student-game-3440x1440.png',
        '08-student-turn-review-1440x900.png',
        '09-student-turn-review-1000x760.png',
        '10-student-turn-review-3440x1440.png',
      ],
      checks: {
        teacherGameVisible: await evaluate(teacherBrowser.cdp, 'Boolean(document.querySelector("#game-screen.active"))'),
        studentLiteMode: await evaluate(studentBrowser.cdp, 'document.body.dataset.performanceMode || document.documentElement.dataset.performanceMode || ""'),
        studentLobbyTextAudit,
        studentDesktopTopbarTextAudit,
        studentDesktopNavigationTextAudit,
        studentTurnReviewContract: await evaluate(studentBrowser.cdp, `({
          contract: document.querySelector('.turn-review-card')?.dataset.turnReviewContract || '',
          sections: [...document.querySelectorAll('[data-turn-review-section]')].map(node => node.dataset.turnReviewSection),
        })`),
        studentOperationsLayout: await evaluate(studentBrowser.cdp, `(() => {
          const pick = selector => {
            const node = document.querySelector(selector);
            if (!node) return null;
            const rect = node.getBoundingClientRect();
            return {
              selector,
              text: String(node.innerText || '').slice(0, 160),
              top: Math.round(rect.top),
              left: Math.round(rect.left),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              order: getComputedStyle(node).order || '',
              display: getComputedStyle(node).display || '',
            };
          };
          return [
            '.game-topbar',
            '.game-next-action-chip',
            '.student-route-panel',
            '.factory-map-header',
            '.factory-campus',
          ].map(pick);
        })()`),
        layoutAudits,
      },
    };
    fs.writeFileSync(path.join(OUTPUT_DIR, 'audit.json'), JSON.stringify(audit, null, 2), 'utf8');
    console.log(`audit ${path.join(OUTPUT_DIR, 'audit.json')}`);
  } finally {
    if (teacherBrowser?.cdp) teacherBrowser.cdp.close();
    if (studentBrowser?.cdp) studentBrowser.cdp.close();
    safeKill(teacherBrowser?.edge);
    safeKill(studentBrowser?.edge);
    safeKill(server);
    await sleep(900);
    safeRm(dataDir);
    safeRm(teacherProfileDir);
    safeRm(studentProfileDir);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
