const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const {
  browserErrors,
  evaluate,
  installPlayerSession,
  launchBrowser,
  navigate,
  sleep,
  waitFor,
  waitForHttp,
} = require('./lib/cdp-browser');

const ROOT_DIR = path.resolve(__dirname, '..');
const STUDENT_COUNT = 30;
const RUN_COUNT = 3;
const INTERACTIONS_PER_RUN = 20;
const CPU_SLOWDOWN_RATE = 4;
const INTERACTION_P95_BUDGET_MS = 200;
const PERFORMANCE_MODE = 'standard';
const VIEWPORT = Object.freeze({ width: 1440, height: 900 });
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-');
const OUTPUT_DIR = path.join(ROOT_DIR, '.runtime', 'ui-performance', RUN_ID);
const LATEST_REPORT = path.join(ROOT_DIR, '.runtime', 'ui-performance', 'ui-performance-latest.json');
const REQUESTED_PORT = Number(process.env.BIZ_ARENA_UI_TRACE_PORT || 0);

function percentile(values, ratio) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))] || 0;
}

function canListen(port) {
  return new Promise(resolve => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)));
  });
}

async function choosePort() {
  if (REQUESTED_PORT) {
    if (await canListen(REQUESTED_PORT)) return REQUESTED_PORT;
    throw new Error(`Requested UI trace port ${REQUESTED_PORT} is already in use.`);
  }
  for (let port = 35320; port < 35420; port += 1) {
    if (await canListen(port)) return port;
  }
  throw new Error('Could not find a free localhost port for UI tracing.');
}

async function requestJson(baseUrl, pathname, { method = 'GET', body, teacherToken, playerToken } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(teacherToken ? { authorization: `Bearer ${teacherToken}` } : {}),
      ...(playerToken ? { 'X-Player-Session': playerToken } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${method} ${pathname} failed (${response.status}): ${JSON.stringify(payload)}`);
  return payload;
}

async function connectStudentSocket(baseUrl, port, student) {
  const ticket = await requestJson(baseUrl, '/api/realtime/ticket', {
    method: 'POST',
    body: { playerId: student.playerId },
    playerToken: student.sessionToken,
  });
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws?ticket=${encodeURIComponent(ticket.ticket)}`);
    const timeout = setTimeout(() => reject(new Error(`WebSocket timeout for ${student.playerId}`)), 5000);
    socket.once('message', chunk => {
      const message = JSON.parse(String(chunk));
      clearTimeout(timeout);
      if (message.type !== 'connected') {
        reject(new Error(`Unexpected WebSocket response for ${student.playerId}: ${String(chunk)}`));
        return;
      }
      resolve(socket);
    });
    socket.once('error', reject);
  });
}

async function waitForCdpEvent(cdp, method, startIndex, attempts = 200) {
  for (let index = 0; index < attempts; index += 1) {
    const event = cdp.events.slice(startIndex).find(item => item.method === method);
    if (event) return event;
    await sleep(50);
  }
  throw new Error(`Timed out waiting for CDP event ${method}`);
}

async function saveTraceStream(cdp, handle, outputPath) {
  const chunks = [];
  while (true) {
    const chunk = await cdp.send('IO.read', { handle });
    chunks.push(chunk.base64Encoded ? Buffer.from(chunk.data, 'base64') : Buffer.from(chunk.data, 'utf8'));
    if (chunk.eof) break;
  }
  await cdp.send('IO.close', { handle });
  fs.writeFileSync(outputPath, Buffer.concat(chunks));
  return fs.statSync(outputPath).size;
}

async function waitForSceneDecode(cdp) {
  return evaluate(cdp, `(async () => {
    await document.fonts.ready;
    const scene = document.querySelector('.student-factory-scene');
    if (!scene) throw new Error('Student factory scene is missing.');
    const background = getComputedStyle(scene).backgroundImage;
    const match = background.match(/url\\(["']?(.*?)["']?\\)/);
    if (match?.[1]) {
      const image = new Image();
      image.src = match[1];
      if (typeof image.decode === 'function') await image.decode();
      else await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
    }
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return { background, deviceMemory: navigator.deviceMemory, hardwareConcurrency: navigator.hardwareConcurrency };
  })()`);
}

async function runHotspotInteractions(cdp, count) {
  return evaluate(cdp, `(async () => {
    const selectors = [
      '[data-scene-station="workforce"]',
      '[data-scene-station="assembly"]',
    ];
    const durations = [];
    for (let index = 0; index < ${count}; index += 1) {
      const selector = selectors[index % selectors.length];
      const node = document.querySelector(selector);
      if (!node) throw new Error('Missing measurable hotspot: ' + selector);
      performance.mark('biz-arena-interaction-start-' + index);
      const startedAt = performance.now();
      node.click();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const duration = performance.now() - startedAt;
      performance.measure('biz-arena-hotspot-interaction-' + index, {
        start: 'biz-arena-interaction-start-' + index,
        duration,
      });
      durations.push(Math.round(duration * 100) / 100);
    }
    return durations;
  })()`);
}

async function traceRun({ baseUrl, student, runNumber }) {
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), `biz-arena-ui-trace-${runNumber}-`));
  let browser;
  try {
    browser = await launchBrowser({
      cdpPort: 9560 + runNumber,
      profileDir,
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    });
    await browser.cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN_RATE });
    await browser.cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        Object.defineProperty(navigator, 'deviceMemory', { configurable: true, get: () => 6 });
        Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, get: () => 4 });
      `,
    });
    await installPlayerSession(browser.cdp, {
      ...student,
      userName: student.userName,
      performanceMode: PERFORMANCE_MODE,
      refreshCadence: 'balanced',
      gameTab: 'operations',
    });
    await navigate(browser.cdp, `${baseUrl}/client?roomCode=${encodeURIComponent(student.roomCode)}&quality=${PERFORMANCE_MODE}`);
    await waitFor(browser.cdp, 'typeof state !== "undefined" && state.room?.status === "running"', `trace run ${runNumber} running room`);
    await evaluate(browser.cdp, `(() => {
      showScreen('game-screen', { addToHistory: false });
      setGameTab('operations');
      return true;
    })()`);
    await waitFor(browser.cdp, 'Boolean(document.querySelector(".student-tycoon-console [data-scene-station=workforce]"))', `trace run ${runNumber} student scene`);
    const environment = await waitForSceneDecode(browser.cdp);
    await runHotspotInteractions(browser.cdp, 4);

    const traceStartIndex = browser.cdp.events.length;
    await browser.cdp.send('Tracing.start', {
      categories: 'devtools.timeline,blink.user_timing,v8',
      options: 'sampling-frequency=10000',
      transferMode: 'ReturnAsStream',
    });
    const durationsMs = await runHotspotInteractions(browser.cdp, INTERACTIONS_PER_RUN);
    await browser.cdp.send('Tracing.end');
    const complete = await waitForCdpEvent(browser.cdp, 'Tracing.tracingComplete', traceStartIndex);
    const tracePath = path.join(OUTPUT_DIR, `chromium-run-${runNumber}.json`);
    const traceBytes = await saveTraceStream(browser.cdp, complete.params.stream, tracePath);
    const errors = browserErrors(browser.cdp);
    const interactionP95Ms = percentile(durationsMs, 0.95);
    return {
      runNumber,
      interactionCount: durationsMs.length,
      interactionP95Ms,
      interactionMaxMs: Math.max(...durationsMs),
      interactionAvgMs: Math.round((durationsMs.reduce((sum, value) => sum + value, 0) / durationsMs.length) * 100) / 100,
      durationsMs,
      environment,
      browserErrors: errors,
      tracePath: path.relative(ROOT_DIR, tracePath).replace(/\\/g, '/'),
      traceBytes,
      ok: durationsMs.length >= INTERACTIONS_PER_RUN && interactionP95Ms < INTERACTION_P95_BUDGET_MS && errors.length === 0,
    };
  } finally {
    try { browser?.cdp?.close(); } catch {}
    try { browser?.process?.kill(); } catch {}
    await sleep(350);
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const port = await choosePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biz-arena-ui-trace-data-'));
  const server = spawn(process.execPath, ['server.js'], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      PORT: String(port),
      BIZ_ARENA_HOST: '127.0.0.1',
      BIZ_ARENA_DEPLOYMENT: 'cloud',
      BIZ_ARENA_APP_MODE: 'server',
      BIZ_ARENA_STORAGE: 'json',
      BIZ_ARENA_DATA_DIR: dataDir,
      BIZ_ARENA_PUBLIC_URL: baseUrl,
      BIZ_ARENA_ALLOW_REGISTRATION: 'true',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const serverOutput = [];
  const sockets = [];
  server.stdout.on('data', chunk => serverOutput.push(String(chunk)));
  server.stderr.on('data', chunk => serverOutput.push(String(chunk)));

  try {
    await waitForHttp(`${baseUrl}/api/health`).catch(error => {
      const detail = serverOutput.join('').trim();
      if (detail) error.message = `${error.message}\nServer output:\n${detail}`;
      throw error;
    });
    const registered = await requestJson(baseUrl, '/api/teacher/register', {
      method: 'POST',
      body: {
        email: `ui-trace-${Date.now()}@example.com`,
        password: 'ui-trace-classroom-42',
        displayName: 'UI Trace Teacher',
      },
    });
    const teacherToken = registered.teacherSessionToken;
    const created = await requestJson(baseUrl, '/api/teacher/action', {
      method: 'POST',
      teacherToken,
      body: {
        action: 'create-room',
        roomName: '30 Player UI Trace',
        companyName: 'Teacher Console',
        scenarioKey: 'motorcycles',
        difficulty: 'easy',
        maxPlayers: STUDENT_COUNT,
        tickMode: 'manual',
        dayLimit: 15,
        turnDurationMs: 300000,
      },
    });
    const roomCode = created.result.roomCode;
    const students = await Promise.all(Array.from({ length: STUDENT_COUNT }, (_, index) => requestJson(baseUrl, '/api/rooms/join', {
      method: 'POST',
      body: {
        roomCode,
        userName: `Trace Student ${index + 1}`,
        companyName: `Trace Company ${index + 1}`,
      },
    })));
    await Promise.all(students.map((student, index) => requestJson(baseUrl, '/api/action', {
      method: 'POST',
      body: {
        playerId: student.playerId,
        sessionToken: student.sessionToken,
        actionId: `trace-ready-${index}`,
        action: 'toggle-ready',
      },
    })));
    sockets.push(...await Promise.all(students.map(student => connectStudentSocket(baseUrl, port, student))));
    await requestJson(baseUrl, '/api/teacher/action', {
      method: 'POST',
      teacherToken,
      body: { action: 'start-game', roomCode },
    });
    await requestJson(baseUrl, '/api/teacher/action', {
      method: 'POST',
      teacherToken,
      body: { action: 'next-turn', roomCode },
    });

    const tracedStudent = { ...students[0], roomCode, userName: 'Trace Student 1' };
    const runs = [];
    for (let runNumber = 1; runNumber <= RUN_COUNT; runNumber += 1) {
      console.error(`[ui-performance] run ${runNumber}/${RUN_COUNT}`);
      runs.push(await traceRun({ baseUrl, student: tracedStudent, runNumber }));
    }
    const report = {
      ok: runs.length === RUN_COUNT && runs.every(run => run.ok),
      contract: 'dual-role-ui-performance-v1',
      generatedAt: new Date().toISOString(),
      room: { code: roomCode, students: students.length, websocketConnections: sockets.filter(socket => socket.readyState === WebSocket.OPEN).length },
      parameters: {
        browser: 'Microsoft Edge Chromium headless',
        rendererEquivalent: 'software-rendered conservative integrated-graphics equivalent',
        performanceMode: PERFORMANCE_MODE,
        viewport: VIEWPORT,
        cpuSlowdownRate: CPU_SLOWDOWN_RATE,
        emulatedDeviceMemoryGb: 6,
        emulatedHardwareConcurrency: 4,
        warmupTurnCount: 1,
        warmupInteractions: 4,
        interactionsPerRun: INTERACTIONS_PER_RUN,
        runCount: RUN_COUNT,
        interactionP95BudgetMs: INTERACTION_P95_BUDGET_MS,
      },
      worstInteractionP95Ms: Math.max(...runs.map(run => run.interactionP95Ms)),
      runs,
    };
    fs.mkdirSync(path.dirname(LATEST_REPORT), { recursive: true });
    fs.writeFileSync(path.join(OUTPUT_DIR, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    fs.writeFileSync(LATEST_REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exitCode = 1;
  } finally {
    sockets.forEach(socket => {
      try { socket.close(); } catch {}
    });
    try { server.kill(); } catch {}
    await sleep(400);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
