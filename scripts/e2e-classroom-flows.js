const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { browserErrors, evaluate, installPlayerSession, launchBrowser, navigate, sleep, waitFor, waitForHttp } = require('./lib/cdp-browser');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.BIZ_ARENA_E2E_PORT || 3420);
const DESKTOP_VIEWPORTS = [
  { width: 1000, height: 760 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
  { width: 3440, height: 1440 },
];
const SCREEN_PREREQUISITES = Object.freeze({
  'lobby-screen': 'typeof state !== "undefined" && Boolean(state.room)',
  'game-screen': 'typeof state !== "undefined" && Boolean(state.room && ["running", "paused"].includes(state.room.status))',
  'results-screen': 'typeof state !== "undefined" && Boolean(state.room && state.room.status === "finished")',
});

function postJson(url, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const request = http.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, response => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { raw += chunk; });
      response.on('end', () => {
        if (response.statusCode >= 400) return reject(new Error(`${response.statusCode}: ${raw}`));
        try { resolve(raw ? JSON.parse(raw) : {}); } catch (error) { reject(error); }
      });
    });
    request.on('error', reject);
    request.end(body);
  });
}

function getJson(url, sessionToken = '') {
  return new Promise((resolve, reject) => {
    const request = http.get(url, {
      headers: sessionToken ? { 'X-Player-Session': sessionToken } : {},
    }, response => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { raw += chunk; });
      response.on('end', () => {
        if (response.statusCode >= 400) return reject(new Error(`${response.statusCode}: ${raw}`));
        try { resolve(raw ? JSON.parse(raw) : {}); } catch (error) { reject(error); }
      });
    });
    request.on('error', reject);
  });
}

function stop(child) { try { child?.kill(); } catch {} }
function remove(dir) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }

async function openScreen(cdp, screenId) {
  const prerequisite = SCREEN_PREREQUISITES[screenId];
  if (prerequisite) await waitFor(cdp, prerequisite, `${screenId} state prerequisite`);
  const opened = await evaluate(cdp, `(() => {
    if (document.querySelector(${JSON.stringify(`#${screenId}.active`)})) return true;
    const trigger = document.querySelector(${JSON.stringify(`[data-open-screen="${screenId}"]`)});
    if (!trigger) return false;
    trigger.click();
    return true;
  })()`);
  assert.equal(opened, true, `No navigation control for ${screenId}`);
  await waitFor(cdp, `Boolean(document.querySelector(${JSON.stringify(`#${screenId}.active`)}))`, screenId);
}

async function assertReadableVisibleText(cdp, label) {
  const result = await evaluate(cdp, `(() => {
    const text = document.body.innerText || '';
    const markers = ['????', 'вЂ', 'в‚', 'Ð', 'Ñ', 'Рџ', 'РЎ', 'Рќ', 'Рґ', 'Рё', 'Рѕ', 'СЃ', 'С‚', 'СЊ', 'С‹'];
    const offenders = markers.filter(marker => text.includes(marker));
    return { ok: offenders.length === 0, offenders, sample: text.slice(0, 240) };
  })()`);
  assert.equal(result.ok, true, `${label} has mojibake in visible text: ${JSON.stringify(result)}`);
}

async function assertNoHorizontalOverflow(cdp, label) {
  const result = await evaluate(cdp, `(() => {
    const root = document.documentElement;
    const body = document.body;
    const viewport = window.innerWidth;
    const insideHorizontalScroller = node => {
      let current = node.parentElement;
      while (current) {
        const style = getComputedStyle(current);
        if (['auto', 'scroll'].includes(style.overflowX) && current.scrollWidth > current.clientWidth + 4) return true;
        current = current.parentElement;
      }
      return false;
    };
    const rootOverflow = root.scrollWidth - viewport;
    const bodyOverflow = body.scrollWidth - viewport;
    const offenders = [...document.querySelectorAll('body *')]
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
    return { ok: rootOverflow <= 4 && bodyOverflow <= 4 && offenders.length === 0, viewport, rootScrollWidth: root.scrollWidth, bodyScrollWidth: body.scrollWidth, rootOverflow, bodyOverflow, offenders };
  })()`);
  assert.equal(result.ok, true, `${label} has horizontal overflow: ${JSON.stringify(result)}`);
}

async function assertResponsiveMatrix(cdp, label, viewports = DESKTOP_VIEWPORTS) {
  for (const viewport of viewports) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      ...viewport,
      mobile: false,
      deviceScaleFactor: 1,
    });
    await sleep(250);
    await assertReadableVisibleText(cdp, `${label} ${viewport.width}x${viewport.height}`);
    await assertNoHorizontalOverflow(cdp, `${label} ${viewport.width}x${viewport.height}`);
  }
}

async function captureResultsExport(cdp) {
  await evaluate(cdp, `(() => {
    window.__resultsExportCapture = null;
    if (!window.__resultsExportHookInstalled) {
      const originalCreateObjectURL = URL.createObjectURL.bind(URL);
      URL.createObjectURL = blob => {
        const url = originalCreateObjectURL(blob);
        blob.text().then(text => {
          window.__resultsExportCapture = {
            ...(window.__resultsExportCapture || {}),
            text,
            type: blob.type,
          };
        });
        return url;
      };
      document.addEventListener('click', event => {
        const anchor = event.target?.closest?.('a[download]');
        if (!anchor) return;
        window.__resultsExportCapture = {
          ...(window.__resultsExportCapture || {}),
          filename: anchor.download,
        };
      }, true);
      window.__resultsExportHookInstalled = true;
    }
    document.querySelector('#export-results')?.click();
    return true;
  })()`);
  await waitFor(
    cdp,
    'Boolean(window.__resultsExportCapture?.text && window.__resultsExportCapture?.filename)',
    'results export capture'
  );
  return evaluate(cdp, `(() => ({
    filename: window.__resultsExportCapture.filename,
    type: window.__resultsExportCapture.type,
    payload: JSON.parse(window.__resultsExportCapture.text),
  }))()`);
}

async function visibleSidebarGameTabs(cdp) {
  return evaluate(cdp, `(() => {
    const isVisible = node => {
      if (!node) return false;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    return [...document.querySelectorAll('[data-navigation-surface="game-sidebar"] [data-game-tab]')]
      .filter(isVisible)
      .map(node => node.dataset.gameTab);
  })()`);
}

async function legacyGameTabStripAbsent(cdp) {
  return evaluate(cdp, `(() => {
    const node = document.querySelector('[data-navigation-surface="legacy-tab-strip"]');
    return node === null;
  })()`);
}

async function studentPerformanceSnapshot(cdp, url, mode) {
  await navigate(cdp, `${url}&quality=${mode}`);
  await openScreen(cdp, 'game-screen');
  await evaluate(cdp, 'document.querySelector("[data-game-tab=operations]")?.click()');
  await waitFor(cdp, 'Boolean(document.querySelector(".student-factory-scene .student-factory-node"))', `${mode} student factory scene`);
  return evaluate(cdp, `(() => {
    const isVisible = node => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const scene = document.querySelector('.student-factory-scene');
    const floor = document.querySelector('.student-factory-scene-floor');
    const node = document.querySelector('.student-factory-node');
    const sceneStyle = getComputedStyle(scene);
    const floorStyle = getComputedStyle(floor);
    const nodeStyle = getComputedStyle(node);
    return {
      mode: document.documentElement.dataset.performanceMode,
      animationMode: document.documentElement.dataset.animationMode,
      controls: {
        allButtons: document.querySelectorAll('#game-screen button').length,
        visibleButtons: [...document.querySelectorAll('#game-screen.active button')].filter(isVisible).length,
        routeSteps: document.querySelectorAll('.student-route-panel [data-student-route-step]').length,
        sceneNodes: document.querySelectorAll('.student-factory-scene .student-factory-node').length,
      },
      scene: {
        backgroundImage: sceneStyle.backgroundImage,
        afterDisplay: getComputedStyle(scene, '::after').display,
        floorDisplay: floorStyle.display,
        floorShadow: floorStyle.boxShadow,
        nodeShadow: nodeStyle.boxShadow,
        nodeTransform: nodeStyle.transform,
      },
    };
  })()`);
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biz-arena-e2e-data-'));
  const teacherProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'biz-arena-e2e-teacher-'));
  const studentProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'biz-arena-e2e-student-'));
  const server = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), BIZ_ARENA_APP_MODE: 'server', BIZ_ARENA_DATA_DIR: dataDir }, stdio: 'ignore', windowsHide: true });
  let teacherBrowser;
  let studentBrowser;
  try {
    await waitForHttp(`http://127.0.0.1:${PORT}/api/health`);
    const teacher = await postJson(`http://127.0.0.1:${PORT}/api/rooms/create`, { roomName: 'E2E Classroom', companyName: 'Teacher Console', userName: 'Teacher E2E', teacherHost: true, scenarioKey: 'motorcycles', difficulty: 'easy', maxPlayers: 30, dayLimit: 15, turnDurationMs: 300000 });
    teacherBrowser = await launchBrowser({ cdpPort: 9440, profileDir: teacherProfile });
    await installPlayerSession(teacherBrowser.cdp, { ...teacher, userName: 'Teacher E2E', gameTab: 'teacher' });
    await navigate(teacherBrowser.cdp, `http://127.0.0.1:${PORT}/server`);
    await openScreen(teacherBrowser.cdp, 'lobby-screen');
    assert.equal(await evaluate(teacherBrowser.cdp, `document.body.textContent.includes(${JSON.stringify(teacher.roomCode)})`), true);
    assert.equal(await evaluate(teacherBrowser.cdp, 'document.querySelectorAll("#lobby-screen.active [data-host-action=\\"start-game\\"]").length'), 1);
    assert.equal(await evaluate(teacherBrowser.cdp, 'Boolean(document.querySelector("#lobby-screen.active .teacher-lobby-command-card"))'), true);
    assert.equal(await evaluate(teacherBrowser.cdp, 'document.querySelector("#lobby-screen.active .teacher-lobby-start-gate")?.dataset.startGateReason'), 'students');
    assert.equal(await evaluate(teacherBrowser.cdp, 'document.querySelector("#lobby-screen.active .teacher-lobby-start-gate")?.dataset.startGateCanStart'), 'false');
    assert.equal(await evaluate(teacherBrowser.cdp, 'document.querySelector("#lobby-screen.active [data-host-action=\\"start-game\\"]").disabled'), true);

    const student = await postJson(`http://127.0.0.1:${PORT}/api/rooms/join`, { roomCode: teacher.roomCode, companyName: 'Beta', userName: 'Student E2E' });
    await postJson(`http://127.0.0.1:${PORT}/api/action`, { playerId: student.playerId, sessionToken: student.sessionToken, action: 'toggle-ready' });
    await sleep(700);
    await navigate(teacherBrowser.cdp, `http://127.0.0.1:${PORT}/server`);
    await openScreen(teacherBrowser.cdp, 'lobby-screen');
    assert.equal(await evaluate(teacherBrowser.cdp, 'document.querySelector("#lobby-screen.active .teacher-lobby-preflight-head span")?.textContent.trim()'), '5/5');
    assert.equal(await evaluate(teacherBrowser.cdp, 'document.querySelectorAll("#lobby-screen.active .teacher-lobby-stepper > span").length'), 5);
    assert.deepEqual(await evaluate(teacherBrowser.cdp, '[...document.querySelectorAll("#lobby-screen.active [data-preflight-step]")].map(node => node.dataset.preflightStep)'), ['session', 'student-link', 'students', 'readiness', 'settings']);
    assert.equal(await evaluate(teacherBrowser.cdp, 'document.querySelector("#lobby-screen.active .teacher-lobby-preflight")?.dataset.preflightReady'), 'true');
    assert.equal(await evaluate(teacherBrowser.cdp, 'document.querySelector("#lobby-screen.active .teacher-lobby-preflight")?.dataset.preflightNext'), 'ready');
    assert.equal(await evaluate(teacherBrowser.cdp, 'document.querySelector("#lobby-screen.active .teacher-lobby-start-gate")?.dataset.startGateReason'), 'ready');
    assert.equal(await evaluate(teacherBrowser.cdp, 'document.querySelector("#lobby-screen.active .teacher-lobby-start-gate")?.dataset.startGateCanStart'), 'true');
    assert.equal(await evaluate(teacherBrowser.cdp, '!document.querySelector("#lobby-screen.active [data-host-action=\\"start-game\\"]").disabled'), true);
    assert.equal(await evaluate(teacherBrowser.cdp, 'document.querySelector("#lobby-screen.active [data-preflight-action=\\"start-match\\"]") === document.querySelector("#lobby-screen.active [data-host-action=\\"start-game\\"]")'), true);
    assert.equal(await evaluate(teacherBrowser.cdp, 'Boolean(document.querySelector("#lobby-screen.active .lobby-classroom-hero"))'), false);
    await assertReadableVisibleText(teacherBrowser.cdp, 'teacher lobby desktop');
    await assertNoHorizontalOverflow(teacherBrowser.cdp, 'teacher lobby desktop');

    studentBrowser = await launchBrowser({ cdpPort: 9441, profileDir: studentProfile });
    await installPlayerSession(studentBrowser.cdp, { ...student, userName: 'Student E2E', performanceMode: 'lite', refreshCadence: 'slow', gameTab: 'operations' });
    await navigate(studentBrowser.cdp, `http://127.0.0.1:${PORT}/client?roomCode=${teacher.roomCode}`);
    await openScreen(studentBrowser.cdp, 'lobby-screen');
    assert.equal(await evaluate(studentBrowser.cdp, 'document.documentElement.dataset.performanceMode === "lite"'), true);
    assert.equal(await evaluate(studentBrowser.cdp, 'document.querySelectorAll("#lobby-screen.active [data-lobby-ready]").length'), 1);
    assert.equal(await evaluate(studentBrowser.cdp, 'Boolean(document.querySelector("#lobby-screen.active .student-lobby-card"))'), true);
    assert.equal(await evaluate(studentBrowser.cdp, 'Boolean(document.querySelector("#lobby-screen.active .lobby-classroom-hero"))'), false);
    assert.equal(await evaluate(studentBrowser.cdp, 'document.querySelector("#lobby-screen.active [data-preflight-action]") === null'), true);
    assert.equal(await evaluate(studentBrowser.cdp, 'getComputedStyle(document.querySelector("#lobby-screen.active .lobby-settings-panel")).display === "none"'), true);
    await assertReadableVisibleText(studentBrowser.cdp, 'student lobby desktop');
    await assertNoHorizontalOverflow(studentBrowser.cdp, 'student lobby desktop');

    await postJson(`http://127.0.0.1:${PORT}/api/server/action`, { roomCode: teacher.roomCode, action: 'start-game' });
    await sleep(700);
    await navigate(teacherBrowser.cdp, `http://127.0.0.1:${PORT}/server`);
    await openScreen(teacherBrowser.cdp, 'game-screen');
    await evaluate(teacherBrowser.cdp, 'document.querySelector("[data-game-tab=teacher]")?.click()');
    await waitFor(teacherBrowser.cdp, 'Boolean(document.querySelector("[data-game-panel=teacher]:not(.hidden)"))', 'teacher cockpit');
    assert.deepEqual(await visibleSidebarGameTabs(teacherBrowser.cdp), ['teacher', 'overview', 'competitors', 'market', 'events', 'statistics']);
    assert.equal(await legacyGameTabStripAbsent(teacherBrowser.cdp), true);
    assert.equal(await evaluate(teacherBrowser.cdp, 'document.querySelectorAll("[data-game-panel=\\"teacher\\"] [data-host-action=\\"pause-game\\"]").length'), 1);
    assert.equal(await evaluate(teacherBrowser.cdp, 'document.querySelectorAll("[data-game-panel=\\"teacher\\"] .teacher-control-card").length'), 1);
    assert.equal(await evaluate(teacherBrowser.cdp, 'document.querySelectorAll("[data-game-panel=\\"teacher\\"] .teacher-now-card").length'), 1);
    assert.equal(await evaluate(teacherBrowser.cdp, 'document.querySelector("[data-game-panel=\\"teacher\\"] .teacher-control-card")?.dataset.teacherLifecycleContract'), 'teacher-lifecycle-v1');
    assert.equal(await evaluate(teacherBrowser.cdp, 'document.querySelector("[data-game-panel=\\"teacher\\"] .teacher-control-card")?.dataset.teacherPhase'), 'running');
    await assertReadableVisibleText(teacherBrowser.cdp, 'teacher cockpit desktop');
    await assertNoHorizontalOverflow(teacherBrowser.cdp, 'teacher cockpit desktop');
    await assertResponsiveMatrix(teacherBrowser.cdp, 'teacher cockpit');
    assert.deepEqual(await visibleSidebarGameTabs(teacherBrowser.cdp), ['teacher', 'overview', 'competitors', 'market', 'events', 'statistics']);

    await navigate(studentBrowser.cdp, `http://127.0.0.1:${PORT}/client?roomCode=${teacher.roomCode}`);
    await openScreen(studentBrowser.cdp, 'game-screen');
    await evaluate(studentBrowser.cdp, 'document.querySelector("[data-game-tab=operations]")?.click()');
    await waitFor(studentBrowser.cdp, 'Boolean(document.querySelector(".student-route-panel .student-primary-next-action"))', 'student first turn');
    assert.equal(await evaluate(studentBrowser.cdp, 'document.querySelectorAll(".student-route-panel .student-primary-next-action").length'), 1);
    assert.equal(await evaluate(studentBrowser.cdp, 'document.querySelector(".student-route-panel")?.dataset.studentFlowContract'), 'first-turn-v2');
    assert.equal(await evaluate(studentBrowser.cdp, 'Boolean(document.querySelector(".student-route-panel")?.dataset.studentPrimaryStep)'), true);
    assert.equal(await evaluate(studentBrowser.cdp, 'document.querySelectorAll(".student-route-panel [data-student-route-step]").length'), 5);
    assert.equal(await evaluate(studentBrowser.cdp, 'document.querySelector("[data-game-tab=teacher]") === null || getComputedStyle(document.querySelector("[data-game-tab=teacher]")).display === "none"'), true);
    assert.deepEqual(await visibleSidebarGameTabs(studentBrowser.cdp), ['overview', 'purchase', 'operations', 'market', 'competitors', 'events']);
    assert.equal(await legacyGameTabStripAbsent(studentBrowser.cdp), true);
    await assertReadableVisibleText(studentBrowser.cdp, 'student first turn desktop');
    await assertNoHorizontalOverflow(studentBrowser.cdp, 'student first turn desktop');

    const studentProfileUrl = `http://127.0.0.1:${PORT}/client?roomCode=${teacher.roomCode}`;
    const fullProfile = await studentPerformanceSnapshot(studentBrowser.cdp, studentProfileUrl, 'full');
    const standardProfile = await studentPerformanceSnapshot(studentBrowser.cdp, studentProfileUrl, 'standard');
    const liteProfile = await studentPerformanceSnapshot(studentBrowser.cdp, studentProfileUrl, 'lite');
    assert.deepEqual(standardProfile.controls, fullProfile.controls);
    assert.deepEqual(liteProfile.controls, fullProfile.controls);
    assert.equal(fullProfile.mode, 'full');
    assert.notEqual(fullProfile.scene.backgroundImage, 'none');
    assert.notEqual(fullProfile.scene.floorDisplay, 'none');
    assert.equal(standardProfile.mode, 'standard');
    assert.notEqual(standardProfile.scene.backgroundImage, 'none');
    assert.notEqual(standardProfile.scene.floorDisplay, 'none');
    assert.equal(standardProfile.scene.afterDisplay, 'none');
    assert.equal(standardProfile.scene.floorShadow, 'none');
    assert.equal(liteProfile.mode, 'lite');
    assert.equal(liteProfile.animationMode, 'off');
    assert.equal(liteProfile.scene.backgroundImage, 'none');
    assert.equal(liteProfile.scene.floorDisplay, 'none');
    assert.equal(liteProfile.scene.nodeShadow, 'none');
    assert.equal(liteProfile.scene.nodeTransform, 'none');
    await assertNoHorizontalOverflow(studentBrowser.cdp, 'student Lite profile desktop');

    await assertResponsiveMatrix(studentBrowser.cdp, 'student first turn');
    assert.deepEqual(await visibleSidebarGameTabs(studentBrowser.cdp), ['overview', 'purchase', 'operations', 'market', 'competitors', 'events']);

    const studentNextAction = await evaluate(studentBrowser.cdp, 'document.querySelector(".student-route-panel .student-primary-next-action")?.textContent.trim()');
    const studentSessionBeforeRefresh = await evaluate(studentBrowser.cdp, '({ playerId: localStorage.bizArenaPlayerId, sessionToken: localStorage.bizArenaSessionToken })');
    const teacherStateBeforeRefresh = await getJson(
      `http://127.0.0.1:${PORT}/api/state?view=full&playerId=${encodeURIComponent(teacher.playerId)}`,
      teacher.sessionToken
    );
    assert.equal(teacherStateBeforeRefresh.room.players.length, 1);

    await navigate(studentBrowser.cdp, `http://127.0.0.1:${PORT}/client?roomCode=${teacher.roomCode}`);
    await waitFor(studentBrowser.cdp, 'Boolean(document.querySelector("#game-screen.active .student-route-panel .student-primary-next-action"))', 'student reconnect');
    assert.equal(await evaluate(studentBrowser.cdp, 'document.querySelectorAll(".student-route-panel .student-primary-next-action").length'), 1);
    assert.equal(await evaluate(studentBrowser.cdp, 'document.querySelector(".student-route-panel")?.dataset.studentFlowContract'), 'first-turn-v2');
    assert.deepEqual(await evaluate(studentBrowser.cdp, '({ playerId: localStorage.bizArenaPlayerId, sessionToken: localStorage.bizArenaSessionToken })'), studentSessionBeforeRefresh);
    assert.equal(await evaluate(studentBrowser.cdp, 'document.documentElement.dataset.performanceMode === "lite"'), true);
    assert.equal(await evaluate(studentBrowser.cdp, 'document.querySelector(".student-route-panel .student-primary-next-action")?.textContent.trim()'), studentNextAction);
    const teacherStateAfterRefresh = await getJson(
      `http://127.0.0.1:${PORT}/api/state?view=full&playerId=${encodeURIComponent(teacher.playerId)}`,
      teacher.sessionToken
    );
    assert.equal(teacherStateAfterRefresh.room.players.length, 1);

    await teacherBrowser.cdp.send('Emulation.clearDeviceMetricsOverride');
    await navigate(teacherBrowser.cdp, `http://127.0.0.1:${PORT}/server`);
    await openScreen(teacherBrowser.cdp, 'game-screen');
    await evaluate(teacherBrowser.cdp, 'document.querySelector("[data-game-tab=teacher]")?.click()');
    await waitFor(teacherBrowser.cdp, 'document.querySelector("[data-game-panel=\\"teacher\\"] .teacher-control-card")?.dataset.teacherPhase === "running"', 'teacher running lifecycle');
    await evaluate(teacherBrowser.cdp, 'document.querySelector("[data-game-panel=\\"teacher\\"] [data-host-action=\\"pause-game\\"]")?.click()');
    await waitFor(teacherBrowser.cdp, 'document.querySelector("[data-game-panel=\\"teacher\\"] .teacher-control-card")?.dataset.teacherPhase === "paused"', 'teacher pause lifecycle');
    assert.equal(await evaluate(teacherBrowser.cdp, 'document.querySelector("[data-game-panel=\\"teacher\\"] .teacher-control-card")?.dataset.teacherPrimaryAction'), 'resume-game');

    const teacherSessionBeforeReconnect = await evaluate(teacherBrowser.cdp, '({ playerId: localStorage.bizArenaPlayerId, sessionToken: localStorage.bizArenaSessionToken })');
    await navigate(teacherBrowser.cdp, `http://127.0.0.1:${PORT}/server`);
    await waitFor(teacherBrowser.cdp, 'document.querySelector("[data-game-panel=\\"teacher\\"] .teacher-control-card")?.dataset.teacherPhase === "paused"', 'teacher paused room after reconnect');
    await openScreen(teacherBrowser.cdp, 'game-screen');
    await evaluate(teacherBrowser.cdp, 'document.querySelector("[data-game-tab=teacher]")?.click()');
    await waitFor(teacherBrowser.cdp, 'document.querySelector("[data-game-panel=\\"teacher\\"] .teacher-control-card")?.dataset.teacherPhase === "paused"', 'teacher paused state after reconnect');
    assert.deepEqual(await evaluate(teacherBrowser.cdp, '({ playerId: localStorage.bizArenaPlayerId, sessionToken: localStorage.bizArenaSessionToken })'), teacherSessionBeforeReconnect);

    await evaluate(teacherBrowser.cdp, 'document.querySelector("[data-game-panel=\\"teacher\\"] [data-host-action=\\"resume-game\\"]")?.click()');
    await waitFor(teacherBrowser.cdp, 'document.querySelector("[data-game-panel=\\"teacher\\"] .teacher-control-card")?.dataset.teacherPhase === "running"', 'teacher resume lifecycle');
    const dayBeforeNextTurn = Number(await evaluate(teacherBrowser.cdp, 'document.querySelector("[data-game-panel=\\"teacher\\"] .teacher-control-state span:nth-child(3) b")?.textContent || 0'));
    await evaluate(teacherBrowser.cdp, 'document.querySelector("[data-game-panel=\\"teacher\\"] [data-host-action=\\"next-turn\\"]")?.click()');
    await waitFor(teacherBrowser.cdp, `Number(document.querySelector("[data-game-panel=\\"teacher\\"] .teacher-control-state span:nth-child(3) b")?.textContent || 0) === ${dayBeforeNextTurn + 1}`, 'teacher next turn lifecycle');

    await evaluate(teacherBrowser.cdp, 'document.querySelector("[data-game-panel=\\"teacher\\"] [data-host-action=\\"finish-room\\"]")?.click()');
    await waitFor(teacherBrowser.cdp, 'Boolean(document.querySelector("#results-screen.active #results-overview[data-results-contract=\\"classroom-results-v2\\"]"))', 'teacher debrief');
    assert.equal(await evaluate(teacherBrowser.cdp, 'document.querySelector("#results-overview")?.dataset.resultsRole'), 'teacher');
    assert.equal(await evaluate(teacherBrowser.cdp, 'document.querySelectorAll("#results-overview .classroom-report-pack").length'), 1);
    assert.equal(await evaluate(teacherBrowser.cdp, 'document.querySelectorAll("#results-overview [data-teacher-results-contract=\\"classroom-results-v2\\"]").length'), 1);
    assert.equal(await evaluate(teacherBrowser.cdp, 'document.querySelectorAll("#results-overview [data-teacher-debrief-contract=\\"class-debrief-v1\\"]").length'), 1);
    const teacherExport = await captureResultsExport(teacherBrowser.cdp);
    assert.match(teacherExport.filename, /^biz-arena-results-[a-z0-9-]+\.json$/i);
    assert.match(teacherExport.type, /^application\/json/);
    assert.equal(teacherExport.payload.room.code, teacher.roomCode);
    assert.ok(teacherExport.payload.classDebrief);
    assert.ok(teacherExport.payload.teacherReportPack);

    await navigate(studentBrowser.cdp, `http://127.0.0.1:${PORT}/client?roomCode=${teacher.roomCode}`);
    await waitFor(studentBrowser.cdp, 'Boolean(document.querySelector("#results-screen.active #results-overview[data-results-contract=\\"student-results-v1\\"]"))', 'student finished results');
    assert.equal(await evaluate(studentBrowser.cdp, 'document.querySelector("#results-overview")?.dataset.resultsRole'), 'student');
    assert.equal(await evaluate(studentBrowser.cdp, 'document.querySelectorAll("#results-overview .classroom-report-pack").length'), 0);
    assert.equal(await evaluate(studentBrowser.cdp, 'document.querySelectorAll("#results-overview [data-teacher-debrief-contract]").length'), 0);
    assert.equal(await evaluate(studentBrowser.cdp, 'document.querySelectorAll("#results-overview .player-debrief-card").length'), 1);
    const studentExport = await captureResultsExport(studentBrowser.cdp);
    assert.match(studentExport.filename, /^biz-arena-results-[a-z0-9-]+\.json$/i);
    assert.match(studentExport.type, /^application\/json/);
    assert.equal(studentExport.payload.room.code, teacher.roomCode);
    assert.equal(Object.hasOwn(studentExport.payload, 'classDebrief'), false);
    assert.equal(Object.hasOwn(studentExport.payload, 'teacherReportPack'), false);

    assert.deepEqual(browserErrors(teacherBrowser.cdp), []);
    assert.deepEqual(browserErrors(studentBrowser.cdp), []);
    console.log(JSON.stringify({
      ok: true,
      roomCode: teacher.roomCode,
      teacherLobby: true,
      teacherCockpit: true,
      teacherLifecycle: true,
      teacherReconnectPaused: true,
      teacherDebrief: true,
      teacherResultsExport: true,
      studentLobby: true,
      studentFirstTurn: true,
      studentReconnect: true,
      studentResultsRole: true,
      studentResultsExport: true,
      studentLite: true,
      browserErrors: 0,
    }, null, 2));
  } finally {
    teacherBrowser?.cdp.close(); studentBrowser?.cdp.close();
    stop(teacherBrowser?.process); stop(studentBrowser?.process); stop(server);
    await sleep(250);
    remove(teacherProfile); remove(studentProfile); remove(dataDir);
  }
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
