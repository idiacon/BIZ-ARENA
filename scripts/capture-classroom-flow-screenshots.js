const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

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
const MOBILE = { width: 390, height: 844, mobile: true, deviceScaleFactor: 1 };
const ULTRAWIDE = { width: 3440, height: 1440, mobile: false, deviceScaleFactor: 1 };
const QA_VIEWPORTS = [
  MIN_DESKTOP,
  DESKTOP,
  { width: 1920, height: 1080, mobile: false, deviceScaleFactor: 1 },
  { width: 2560, height: 1440, mobile: false, deviceScaleFactor: 1 },
  ULTRAWIDE,
];
const STUDENT_QA_VIEWPORTS = [
  { width: 375, height: 812, mobile: true, deviceScaleFactor: 1 },
  { width: 768, height: 1024, mobile: true, deviceScaleFactor: 1 },
  { width: 1024, height: 768, mobile: false, deviceScaleFactor: 1 },
  ...QA_VIEWPORTS,
];
const STUDENT_QUALITY_PROFILES = ['full', 'standard', 'lite'];

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
    events,
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
    '--disable-extensions',
    '--disable-component-extensions-with-background-pages',
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
  await cdp.send('Log.enable');
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

function browserErrors(cdp) {
  return cdp.events.filter(event => event.method === 'Runtime.exceptionThrown'
    || (event.method === 'Log.entryAdded' && ['error', 'warning'].includes(event.params?.entry?.level)));
}

async function setPerformanceMode(cdp, mode) {
  if (!STUDENT_QUALITY_PROFILES.includes(mode)) throw new Error(`Unsupported performance mode: ${mode}`);
  await evaluate(cdp, `(() => {
    localStorage.setItem('bizArenaPerformanceMode', ${JSON.stringify(mode)});
    const url = new URL(window.location.href);
    url.searchParams.set('quality', ${JSON.stringify(mode)});
    window.history.replaceState({}, '', url);
    document.documentElement.dataset.performanceMode = ${JSON.stringify(mode)};
    document.body.dataset.performanceMode = ${JSON.stringify(mode)};
    if (typeof applyAppMode === 'function') applyAppMode();
    return document.documentElement.dataset.performanceMode;
  })()`);
  await waitFor(cdp, `document.documentElement.dataset.performanceMode === ${JSON.stringify(mode)}`, `${mode} performance mode`);
}

async function verifyStableRoleDom(cdp, selector, label) {
  const seeded = await evaluate(cdp, `(() => {
    const root = document.querySelector(${JSON.stringify(selector)});
    if (!root) return false;
    window.__bizArenaStableRoleRoot = root;
    window.__bizArenaStableTimerText = document.querySelector('#game-turn-timer')?.textContent || '';
    return true;
  })()`);
  if (!seeded) throw new Error(`${label} root was not found: ${selector}`);

  await evaluate(cdp, '(async () => { await refreshState(); return true; })()');
  const sameAfterUnchangedRefresh = await evaluate(cdp, `document.querySelector(${JSON.stringify(selector)}) === window.__bizArenaStableRoleRoot`);
  await sleep(1150);
  const timerResult = await evaluate(cdp, `(() => ({
    sameAfterTimerTick: document.querySelector(${JSON.stringify(selector)}) === window.__bizArenaStableRoleRoot,
    timerBefore: window.__bizArenaStableTimerText,
    timerAfter: document.querySelector('#game-turn-timer')?.textContent || '',
  }))()`);
  const result = {
    label,
    selector,
    sameAfterUnchangedRefresh,
    ...timerResult,
  };
  if (!result.sameAfterUnchangedRefresh || !result.sameAfterTimerTick) {
    throw new Error(`${label} replaced its role-owned DOM root: ${JSON.stringify(result)}`);
  }
  await evaluate(cdp, 'delete window.__bizArenaStableRoleRoot; delete window.__bizArenaStableTimerText; true');
  return result;
}

async function verifyPartialFactoryNavigation(cdp) {
  const seeded = await evaluate(cdp, `(() => {
    const root = document.querySelector('.student-tycoon-console');
    const detail = document.querySelector('[data-factory-department-detail]');
    if (!root || !detail) return false;
    window.__bizArenaFactoryRoot = root;
    return true;
  })()`);
  if (!seeded) throw new Error('Student factory root was not available for partial navigation QA.');

  const activateStation = async station => evaluate(cdp, `(async () => {
    const button = document.querySelector('[data-scene-station="${station}"]');
    if (!button) return { found: false };
    button.click();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return {
      found: true,
      sameRoot: document.querySelector('.student-tycoon-console') === window.__bizArenaFactoryRoot,
      department: document.querySelector('[data-factory-department-detail]')?.dataset.factoryDepartmentDetail || '',
    };
  })()`);

  const workforce = await activateStation('workforce');
  const assembly = await activateStation('assembly');
  const result = {
    sameRootAfterWorkforce: Boolean(workforce.found && workforce.sameRoot),
    workforceDepartment: workforce.department || '',
    sameRootAfterAssembly: Boolean(assembly.found && assembly.sameRoot),
    assemblyDepartment: assembly.department || '',
  };
  if (!result.sameRootAfterWorkforce
    || result.workforceDepartment !== 'workforce'
    || !result.sameRootAfterAssembly
    || result.assemblyDepartment !== 'assembly') {
    throw new Error(`Student factory navigation replaced too much DOM: ${JSON.stringify(result)}`);
  }
  await evaluate(cdp, `(() => {
    dismissStudentWorkspace({ fromHistory: true });
    delete window.__bizArenaFactoryRoot;
    return true;
  })()`);
  return result;
}

async function collectFocusOrderAudit(cdp, label) {
  const result = await evaluate(cdp, `(() => {
    const slotNames = ['role-navigation', 'classroom-hud', 'primary-workspace', 'role-action-rail'];
    const focusableSelector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
    const focusables = [...document.querySelectorAll(focusableSelector)].filter(node => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    });
    const slots = slotNames.map(slot => {
      const root = document.querySelector('[data-ui-slot="' + slot + '"]');
      const first = root ? focusables.find(node => root === node || root.contains(node)) : null;
      return {
        slot,
        found: Boolean(root),
        firstFocusableIndex: first ? focusables.indexOf(first) : -1,
        firstFocusableText: String(first?.innerText || first?.getAttribute('aria-label') || '').trim().slice(0, 80),
      };
    });
    const indices = slots.map(slot => slot.firstFocusableIndex);
    const ordered = indices.every(index => index >= 0) && indices.every((index, position) => position === 0 || index > indices[position - 1]);
    return { label: ${JSON.stringify(label)}, ordered, slots };
  })()`);
  if (!result.ordered) throw new Error(`${label} has an invalid keyboard focus order: ${JSON.stringify(result)}`);
  return result;
}

async function verifyReducedMotion(cdp) {
  const result = await evaluate(cdp, `(async () => {
    const previous = state.settings.animationMode;
    state.settings.animationMode = 'off';
    localStorage.setItem('bizArenaAnimationMode', 'off');
    applyAppMode();
    await new Promise(resolve => requestAnimationFrame(resolve));
    const parseDuration = value => String(value || '0s').split(',').reduce((maximum, part) => {
      const entry = part.trim();
      const numeric = Number.parseFloat(entry) || 0;
      return Math.max(maximum, entry.endsWith('ms') ? numeric : numeric * 1000);
    }, 0);
    const samples = [...document.querySelectorAll('.student-factory-node, .live-meter, .game-next-action-chip')]
      .slice(0, 12)
      .map(node => {
        const style = getComputedStyle(node);
        return {
          selector: node.className,
          animationMs: parseDuration(style.animationDuration),
          transitionMs: parseDuration(style.transitionDuration),
        };
      });
    const animationMode = document.documentElement.dataset.animationMode || '';
    state.settings.animationMode = previous;
    localStorage.setItem('bizArenaAnimationMode', previous);
    applyAppMode();
    return {
      animationMode,
      samples,
      maximumAnimationMs: Math.max(0, ...samples.map(sample => sample.animationMs)),
      maximumTransitionMs: Math.max(0, ...samples.map(sample => sample.transitionMs)),
    };
  })()`);
  if (result.animationMode !== 'off' || result.maximumAnimationMs > 1 || result.maximumTransitionMs > 1) {
    throw new Error(`Reduced motion contract failed: ${JSON.stringify(result)}`);
  }
  return result;
}

async function collectStudentSceneAudit(cdp) {
  const result = await evaluate(cdp, `(async () => {
    const workspace = document.querySelector('.student-tycoon-console');
    const scene = document.querySelector('.student-factory-scene');
    const hotspots = [...document.querySelectorAll('[data-scene-station]')];
    if (!workspace || !scene || hotspots.length < 4) return { ok: false, reason: 'missing-scene' };
    const workspaceRect = workspace.getBoundingClientRect();
    const sceneRect = scene.getBoundingClientRect();
    const sceneHeadRect = scene.querySelector('.student-factory-scene-head')?.getBoundingClientRect();
    const hotspotRects = hotspots.map(node => {
      const rect = node.getBoundingClientRect();
      return {
        station: node.dataset.sceneStation,
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    });
    const hotspotOverlaps = [];
    for (let leftIndex = 0; leftIndex < hotspotRects.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < hotspotRects.length; rightIndex += 1) {
        const left = hotspotRects[leftIndex];
        const right = hotspotRects[rightIndex];
        const overlapWidth = Math.min(left.right, right.right) - Math.max(left.left, right.left);
        const overlapHeight = Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top);
        if (overlapWidth > 2 && overlapHeight > 2) hotspotOverlaps.push([left.station, right.station]);
      }
    }
    const minimumHotspotSize = Math.min(...hotspotRects.flatMap(rect => [rect.width, rect.height]));
    const buildingRects = hotspots.map(node => {
      const rect = node.querySelector('.student-factory-map-building')?.getBoundingClientRect();
      return rect ? {
        station: node.dataset.sceneStation,
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      } : null;
    }).filter(Boolean);
    const buildingHeaderGaps = buildingRects.map(rect => ({
      station: rect.station,
      gap: Math.round(rect.top - (sceneHeadRect?.bottom || sceneRect.top)),
    }));
    const minimumBuildingHeaderGap = Math.min(...buildingHeaderGaps.map(entry => entry.gap));
    const buildingSceneOverflows = buildingRects.filter(rect => (
      rect.left < sceneRect.left - 2
      || rect.right > sceneRect.right + 2
      || rect.top < sceneRect.top - 2
      || rect.bottom > sceneRect.bottom + 2
    )).map(rect => rect.station);
    const presentation = scene.dataset.scenePresentation;
    const sceneVersion = scene.dataset.sceneVersion;
    const routeSegments = document.querySelectorAll('.student-factory-map .student-factory-map-route-segment').length;
    const routeFocusStates = [...document.querySelectorAll('.student-factory-map .student-factory-map-route-segment')]
      .map(route => route.dataset.mapRouteState || '');
    const markerCount = document.querySelectorAll('.student-factory-map [data-factory-map-marker]').length;
    const roadSegments = document.querySelectorAll('.student-factory-map [data-factory-road]').length;
    const buildingTypes = [...document.querySelectorAll('.student-factory-map [data-factory-building]')]
      .map(node => node.dataset.factoryBuilding);
    const inspector = document.querySelector('[data-factory-map-inspector]');
    const inspectorCount = document.querySelectorAll('[data-factory-map-inspector]').length;
    const persistentLabelCount = document.querySelectorAll('.student-factory-map-label').length;
    const guidanceStates = hotspots.map(node => ({
      station: node.dataset.sceneStation,
      state: node.dataset.factoryGuidanceState || '',
    }));
    const activityStates = hotspots.map(node => ({
      station: node.dataset.sceneStation,
      state: node.dataset.factoryActivity || '',
    }));
    const environmentTypes = [...document.querySelectorAll('.student-factory-map [data-factory-environment]')]
      .map(node => node.dataset.factoryEnvironment);
    const motionArtifacts = [...document.querySelectorAll('.student-factory-map [data-factory-motion]')]
      .map(node => ({
        motion: node.dataset.factoryMotion,
        animationName: getComputedStyle(node).animationName,
      }));
    const zoneAlignment = hotspots.map(node => {
      const station = node.dataset.sceneStation;
      const shadow = node.querySelector('.student-factory-building-shadow');
      const zone = document.querySelector('.student-factory-map-zone.zone-' + station);
      const shadowRect = shadow?.getBoundingClientRect();
      const zoneRect = zone?.getBoundingClientRect();
      if (!shadowRect?.width || !zoneRect?.width) return null;
      const shadowCenterX = shadowRect.left + shadowRect.width / 2;
      const shadowCenterY = shadowRect.top + shadowRect.height / 2;
      const zoneCenterX = zoneRect.left + zoneRect.width / 2;
      const zoneCenterY = zoneRect.top + zoneRect.height / 2;
      return {
        station,
        error: Math.round(Math.hypot(shadowCenterX - zoneCenterX, shadowCenterY - zoneCenterY)),
      };
    }).filter(Boolean);
    const maximumZoneAnchorError = Math.max(0, ...zoneAlignment.map(entry => entry.error));
    const mapAnchors = hotspots.map(node => ({
      station: node.dataset.sceneStation,
      x: Number(node.dataset.mapX),
      y: Number(node.dataset.mapY),
    }));
    const anchorByStation = new Map(mapAnchors.map(anchor => [anchor.station, anchor]));
    const purchaseAnchor = anchorByStation.get('purchase');
    const workforceAnchor = anchorByStation.get('workforce');
    const assemblyAnchor = anchorByStation.get('assembly');
    const marketAnchor = anchorByStation.get('market');
    const sequenceLayoutOk = Boolean(
      purchaseAnchor
      && workforceAnchor
      && assemblyAnchor
      && marketAnchor
      && purchaseAnchor.x < workforceAnchor.x
      && purchaseAnchor.y > workforceAnchor.y
      && assemblyAnchor.x > workforceAnchor.x
      && assemblyAnchor.y < marketAnchor.y
      && marketAnchor.x > workforceAnchor.x
      && marketAnchor.y > purchaseAnchor.y
    );
    const sceneWidthRatio = sceneRect.width / Math.max(1, workspaceRect.width);
    const ok = sceneWidthRatio >= 0.55
      && minimumHotspotSize >= 44
      && hotspotOverlaps.length === 0
      && presentation === 'isometric-map'
      && sceneVersion === 'v9-industrial-district'
      && routeSegments === hotspots.length - 1
      && routeFocusStates.filter(state => state === 'current').length <= 1
      && routeFocusStates.filter(state => state === 'next').length <= 1
      && markerCount === hotspots.length
      && roadSegments === 6
      && buildingTypes.length === hotspots.length
      && new Set(buildingTypes).size === hotspots.length
      && inspectorCount === 1
      && Boolean(inspector?.dataset.factoryMapInspector)
      && persistentLabelCount === 0
      && guidanceStates.length === hotspots.length
      && guidanceStates.every(entry => ['complete', 'current', 'attention', 'waiting'].includes(entry.state))
      && activityStates.length === hotspots.length
      && activityStates.every(entry => Boolean(entry.state))
      && environmentTypes.join('|') === 'city-backdrop|parking|utilities|safety-markings|loading-yard|service-vehicle'
      && motionArtifacts.length <= 2
      && new Set(motionArtifacts.map(entry => entry.motion)).size === motionArtifacts.length
      && zoneAlignment.length === hotspots.length
      && maximumZoneAnchorError <= 28
      && buildingRects.length === hotspots.length
      && minimumBuildingHeaderGap >= 8
      && buildingSceneOverflows.length === 0
      && sequenceLayoutOk;
    return {
      ok,
      sceneWidthRatio,
      minimumHotspotSize,
      hotspotOverlaps,
      presentation,
      sceneVersion,
      routeSegments,
      routeFocusStates,
      markerCount,
      roadSegments,
      buildingTypes,
      inspectorStation: inspector?.dataset.factoryMapInspector || '',
      inspectorCount,
      persistentLabelCount,
      guidanceStates,
      activityStates,
      environmentTypes,
      motionArtifacts,
      zoneAlignment,
      maximumZoneAnchorError,
      buildingHeaderGaps,
      minimumBuildingHeaderGap,
      buildingSceneOverflows,
      mapAnchors,
      sequenceLayoutOk,
      hotspotCount: hotspots.length,
    };
  })()`);
  if (!result.ok) throw new Error(`Student scene audit failed: ${JSON.stringify(result)}`);
  return result;
}

async function collectTeacherWorkspaceAudit(cdp) {
  const result = await evaluate(cdp, `(() => {
    const workspace = document.querySelector('.teacher-operations-center');
    const actionRail = document.querySelector('.teacher-workspace-side[data-ui-slot="role-action-rail"]');
    const primary = document.querySelector('.teacher-workspace-main[data-ui-slot="primary-workspace"]');
    if (!workspace || !actionRail || !primary) return { ok: false, reason: 'missing-workspace' };
    const workspaceRect = workspace.getBoundingClientRect();
    const actionRailRect = actionRail.getBoundingClientRect();
    const primaryRect = primary.getBoundingClientRect();
    const dataAreaRatio = (workspaceRect.width - actionRailRect.width) / Math.max(1, workspaceRect.width);
    const primaryActionVisible = Boolean(document.querySelector('.teacher-workspace-side .primary-teacher-action:not([disabled])'));
    const classStatusVisible = Boolean(document.querySelector('.teacher-class-cockpit'));
    const ok = dataAreaRatio >= 0.7 && primaryRect.width > actionRailRect.width && primaryActionVisible && classStatusVisible;
    return { ok, dataAreaRatio, primaryActionVisible, classStatusVisible };
  })()`);
  if (!result.ok) throw new Error(`Teacher workspace audit failed: ${JSON.stringify(result)}`);
  return result;
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
        if (node.closest('[aria-hidden="true"]')) return false;
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

async function collectFirstTurnTutorialAudit(cdp, label, { expectArrow }) {
  const result = await evaluate(cdp, `(() => {
    const overlay = document.querySelector('[data-first-turn-tutorial]:not(.hidden)');
    const card = overlay?.querySelector('[data-first-turn-card]');
    const focus = overlay?.querySelector('[data-first-turn-focus]:not(.hidden)');
    const target = document.querySelector('[data-first-turn-target]');
    const arrow = overlay?.querySelector('[data-first-turn-arrow]');
    const arrowPath = overlay?.querySelector('[data-first-turn-arrow-path]');
    const route = overlay?.querySelector('.tutorial-route');
    const routeSteps = [...(route?.querySelectorAll('[data-first-turn-progress-step]') || [])];
    const rect = node => node ? node.getBoundingClientRect() : null;
    const cardRect = rect(card);
    const focusRect = rect(focus);
    const targetRect = rect(target);
    const overlaps = (first, second) => Boolean(first && second
      && first.left < second.right
      && first.right > second.left
      && first.top < second.bottom
      && first.bottom > second.top);
    const insideViewport = value => Boolean(value
      && value.left >= 7
      && value.top >= 7
      && value.right <= window.innerWidth - 7
      && value.bottom <= window.innerHeight - 7);
    const focusMatchesTarget = Boolean(focusRect && targetRect
      && focusRect.left <= targetRect.left + 1
      && focusRect.top <= targetRect.top + 1
      && focusRect.right >= targetRect.right - 1
      && focusRect.bottom >= targetRect.bottom - 1
      && targetRect.left - focusRect.left <= 20
      && targetRect.top - focusRect.top <= 20
      && focusRect.right - targetRect.right <= 20
      && focusRect.bottom - targetRect.bottom <= 20);
    const arrowStyle = arrow ? getComputedStyle(arrow) : null;
    const arrowVisible = Boolean(arrow
      && arrowPath?.getAttribute('d')
      && !arrow.classList.contains('hidden')
      && arrowStyle?.display !== 'none'
      && arrowStyle?.visibility !== 'hidden');
    const routeFits = Boolean(route && route.scrollWidth <= route.clientWidth + 1);
    const pageOverflow = Math.max(
      document.documentElement.scrollWidth - window.innerWidth,
      document.body.scrollWidth - window.innerWidth,
    );
    const step = overlay?.dataset.firstTurnStep || '';
    const result = {
      label: ${JSON.stringify(label)},
      viewport: { width: window.innerWidth, height: window.innerHeight },
      step,
      stage: Number(overlay?.dataset.firstTurnStage || 0),
      targetMode: overlay?.dataset.firstTurnTargetMode || '',
      routeSteps: routeSteps.length,
      routeFits,
      cardInsideViewport: insideViewport(cardRect),
      targetInsideViewport: insideViewport(targetRect),
      cardTargetOverlap: overlaps(cardRect, targetRect),
      focusMatchesTarget,
      arrowVisible,
      arrowExpected: ${Boolean(expectArrow)},
      pageOverflow,
      cardRect: cardRect && { left: Math.round(cardRect.left), top: Math.round(cardRect.top), right: Math.round(cardRect.right), bottom: Math.round(cardRect.bottom) },
      targetRect: targetRect && { left: Math.round(targetRect.left), top: Math.round(targetRect.top), right: Math.round(targetRect.right), bottom: Math.round(targetRect.bottom) },
    };
    result.ok = Boolean(overlay && card && focus && target)
      && ['purchase', 'workforce', 'assembly', 'market', 'finish'].includes(step)
      && result.stage >= 1
      && result.stage <= 5
      && result.routeSteps === 5
      && result.routeFits
      && result.cardInsideViewport
      && result.targetInsideViewport
      && !result.cardTargetOverlap
      && result.focusMatchesTarget
      && result.arrowVisible === result.arrowExpected
      && result.pageOverflow <= 4;
    return result;
  })()`);
  if (!result.ok) {
    throw new Error(`${label} failed first-turn tutorial audit: ${JSON.stringify(result)}`);
  }
  return result;
}

async function collectStudentMarketStatAudit(cdp, label) {
  const result = await evaluate(cdp, `(() => {
    const cards = [...document.querySelectorAll('.student-market-stat')].map(card => {
      const value = card.querySelector('b');
      const cardRect = card.getBoundingClientRect();
      const valueRect = value?.getBoundingClientRect();
      const outside = valueRect
        ? Math.max(0, cardRect.left - valueRect.left, valueRect.right - cardRect.right)
        : Infinity;
      const clipped = value ? value.scrollWidth > value.clientWidth + 1 : true;
      return {
        label: String(card.querySelector('small')?.textContent || '').trim(),
        value: String(value?.textContent || '').trim(),
        cardWidth: Math.round(cardRect.width),
        valueWidth: Math.round(valueRect?.width || 0),
        valueScrollWidth: value?.scrollWidth || 0,
        valueClientWidth: value?.clientWidth || 0,
        outside: Math.round(outside * 10) / 10,
        clipped,
        ok: Boolean(valueRect) && outside <= 1 && !clipped,
      };
    });
    return {
      label: ${JSON.stringify(label)},
      ok: cards.length === 3 && cards.every(card => card.ok),
      cards,
    };
  })()`);
  if (!result.ok) {
    throw new Error(`${label} failed market stat audit: ${JSON.stringify(result)}`);
  }
  return result;
}

async function collectStudentMarketDisclosureAudit(cdp, label) {
  const result = await evaluate(cdp, `(() => {
    const disclosure = document.querySelector('.student-market-disclosure');
    const summary = disclosure?.querySelector(':scope > summary');
    if (!disclosure || !summary) {
      return { label: ${JSON.stringify(label)}, ok: false, reason: 'missing disclosure or summary' };
    }
    const initiallyOpen = disclosure.open;
    const summaryRect = summary.getBoundingClientRect();
    const summaryStyle = getComputedStyle(summary);
    disclosure.open = true;
    const hints = disclosure.querySelector('.student-market-quick-hints');
    const hintsStyle = hints ? getComputedStyle(hints) : null;
    const hintsOverflowY = hintsStyle?.overflowY || 'none';
    const hintsNoNestedScroll = !hints || (
      !['auto', 'scroll'].includes(hintsOverflowY)
      && hints.scrollHeight <= hints.clientHeight + 1
    );
    disclosure.open = initiallyOpen;
    const result = {
      label: ${JSON.stringify(label)},
      initiallyOpen,
      context: disclosure.dataset.marketContext || '',
      summaryText: String(summary.innerText || summary.textContent || '').trim(),
      summaryVisible: summaryStyle.display !== 'none'
        && summaryStyle.visibility !== 'hidden'
        && summaryRect.width >= 120
        && summaryRect.height >= 44,
      hintsOverflowY,
      hintsNoNestedScroll,
    };
    result.ok = !result.initiallyOpen
      && result.summaryVisible
      && result.summaryText.includes('Рынок и рекомендации')
      && result.hintsNoNestedScroll;
    return result;
  })()`);
  if (!result.ok) {
    throw new Error(`${label} failed market disclosure audit: ${JSON.stringify(result)}`);
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

const STOP_EDGE_PROFILE_PROCESSES = `& {
  param([string]$profilePath)
  for ($attempt = 0; $attempt -lt 6; $attempt += 1) {
    $targets = @(Get-CimInstance Win32_Process | Where-Object {
      $_.Name -eq 'msedge.exe' -and $_.CommandLine -and $_.CommandLine.Contains($profilePath)
    })
    if ($targets.Count -eq 0) { break }
    $targets | ForEach-Object {
      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Milliseconds 250
  }
}`;

function safeKill(child, profileDir = '') {
  try {
    if (child?.pid && process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    } else if (child?.pid) {
      child.kill();
    }
  } catch {
    // ignore process cleanup races on Windows
  }

  if (process.platform === 'win32' && profileDir) {
    try {
      spawnSync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', STOP_EDGE_PROFILE_PROCESSES, profileDir],
        { stdio: 'ignore', windowsHide: true },
      );
    } catch {
      // ignore process cleanup races on Windows
    }
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
    const teacherStableRoleDom = await verifyStableRoleDom(teacherBrowser.cdp, '.teacher-operations-center', 'teacher operations center');
    const teacherWorkspaceAudit = await collectTeacherWorkspaceAudit(teacherBrowser.cdp);
    const teacherFocusOrderAudit = await collectFocusOrderAudit(teacherBrowser.cdp, 'teacher desktop focus order');
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
    await waitFor(
      studentBrowser.cdp,
      'Boolean(document.querySelector("[data-first-turn-tutorial]:not(.hidden) [data-first-turn-card]") && document.querySelector("[data-first-turn-target]"))',
      'student first-turn tutorial',
    );
    await studentBrowser.cdp.send('Emulation.setDeviceMetricsOverride', DESKTOP);
    await evaluate(studentBrowser.cdp, 'renderTutorialOverlay()');
    await sleep(450);
    const firstTurnTutorialDesktopAudit = await collectFirstTurnTutorialAudit(
      studentBrowser.cdp,
      'student first-turn tutorial desktop',
      { expectArrow: true },
    );
    await capture(studentBrowser.cdp, '06b-student-first-turn-tutorial-1440x900.png');
    await studentBrowser.cdp.send('Emulation.setDeviceMetricsOverride', MOBILE);
    await evaluate(studentBrowser.cdp, 'renderTutorialOverlay()');
    await sleep(450);
    const firstTurnTutorialMobileAudit = await collectFirstTurnTutorialAudit(
      studentBrowser.cdp,
      'student first-turn tutorial mobile',
      { expectArrow: false },
    );
    await capture(studentBrowser.cdp, '06c-student-first-turn-tutorial-390x844.png');
    await evaluate(studentBrowser.cdp, 'stopTutorial({ dismissed: true })');
    await waitFor(
      studentBrowser.cdp,
      'document.querySelector("[data-first-turn-tutorial]")?.classList.contains("hidden")',
      'student tutorial dismissed after dedicated captures',
    );
    await studentBrowser.cdp.send('Emulation.setDeviceMetricsOverride', DESKTOP);
    await sleep(350);
    const studentStableRoleDom = await verifyStableRoleDom(studentBrowser.cdp, '.student-tycoon-console', 'student tycoon console');
    const partialFactoryNavigation = await verifyPartialFactoryNavigation(studentBrowser.cdp);
    let studentSceneAudit = null;
    let studentFocusOrderAudit = null;
    let reducedMotionAudit = null;
    let studentMarketStatAudit = null;
    let studentMarketDisclosureAudit = null;
    for (const mode of STUDENT_QUALITY_PROFILES) {
      await setPerformanceMode(studentBrowser.cdp, mode);
      for (const viewport of STUDENT_QA_VIEWPORTS) {
        await studentBrowser.cdp.send('Emulation.setDeviceMetricsOverride', viewport);
        await sleep(250);
        layoutAudits.push(await collectViewportAudit(studentBrowser.cdp, `student game ${mode} ${viewport.width}px`));
      }
      if (mode === 'full') {
        await studentBrowser.cdp.send('Emulation.setDeviceMetricsOverride', DESKTOP);
        await sleep(350);
        studentSceneAudit = await collectStudentSceneAudit(studentBrowser.cdp);
        studentFocusOrderAudit = await collectFocusOrderAudit(studentBrowser.cdp, 'student desktop focus order');
        reducedMotionAudit = await verifyReducedMotion(studentBrowser.cdp);
        studentMarketStatAudit = await collectStudentMarketStatAudit(studentBrowser.cdp, 'student market stats full 1440px');
        studentMarketDisclosureAudit = await collectStudentMarketDisclosureAudit(studentBrowser.cdp, 'student market disclosure full 1440px');
        await capture(studentBrowser.cdp, '06-student-game-full-1440x900.png', 'window.scrollTo(0, 0)');
        await capture(studentBrowser.cdp, '06a-student-factory-map-v9-1440x900.png', scrollBelowSticky('.student-factory-scene'));
        await studentBrowser.cdp.send('Emulation.setDeviceMetricsOverride', ULTRAWIDE);
        await sleep(350);
        await capture(studentBrowser.cdp, '07-student-game-full-3440x1440.png', 'window.scrollTo(0, 0)');
      } else if (mode === 'standard') {
        await studentBrowser.cdp.send('Emulation.setDeviceMetricsOverride', DESKTOP);
        await sleep(350);
        await capture(studentBrowser.cdp, '08-student-game-standard-1440x900.png', 'window.scrollTo(0, 0)');
      } else {
        await studentBrowser.cdp.send('Emulation.setDeviceMetricsOverride', MIN_DESKTOP);
        await sleep(350);
        await capture(studentBrowser.cdp, '09-student-game-lite-1000x760.png', 'window.scrollTo(0, 0)');
      }
    }
    await studentBrowser.cdp.send('Emulation.setDeviceMetricsOverride', MIN_DESKTOP);
    await setPerformanceMode(studentBrowser.cdp, 'lite');
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

    await postJson(`http://127.0.0.1:${PORT}/api/server/action`, {
      roomCode,
      action: 'next-turn',
    });
    await sleep(900);
    await navigateApp(studentBrowser.cdp, `/client?roomCode=${encodeURIComponent(roomCode)}`);
    await openScreen(studentBrowser.cdp, 'game-screen');
    await waitFor(
      studentBrowser.cdp,
      `document.querySelector('.turn-review-card')?.dataset.turnReviewContract === 'cause-effect-v1'
        && document.querySelectorAll('[data-turn-review-section]').length >= 3
        && document.querySelector('.decision-round-card')?.dataset.decisionRoundContract === 'decision-round-v2'
        && document.querySelectorAll('.decision-option-item').length >= 3`,
      'student cause-effect turn review and strategic decision',
    );
    await studentBrowser.cdp.send('Emulation.setDeviceMetricsOverride', DESKTOP);
    await evaluate(studentBrowser.cdp, `document.querySelector('.app-sidebar-nav [data-role-tab="student"][data-game-tab="operations"]')?.click()`);
    await sleep(350);
    layoutAudits.push(await collectViewportAudit(studentBrowser.cdp, 'student turn review desktop'));
    await capture(studentBrowser.cdp, '10-student-turn-review-1440x900.png', scrollBelowSticky('.turn-review-card'));
    for (const viewport of STUDENT_QA_VIEWPORTS) {
      await studentBrowser.cdp.send('Emulation.setDeviceMetricsOverride', viewport);
      await sleep(250);
      layoutAudits.push(await collectViewportAudit(studentBrowser.cdp, `student turn review ${viewport.width}px`));
    }
    await studentBrowser.cdp.send('Emulation.setDeviceMetricsOverride', MIN_DESKTOP);
    await sleep(350);
    await capture(studentBrowser.cdp, '11-student-turn-review-1000x760.png', scrollBelowSticky('.turn-review-card'));
    await studentBrowser.cdp.send('Emulation.setDeviceMetricsOverride', ULTRAWIDE);
    await sleep(350);
    await capture(studentBrowser.cdp, '12-student-turn-review-3440x1440.png', scrollBelowSticky('.turn-review-card'));
    const studentDecisionTextAudit = await collectTextVisibilityAudit(studentBrowser.cdp, 'student strategic decision text', [
      '.decision-round-card .factory-node-label',
      '.decision-round-card h3',
      '.decision-round-status',
      '.decision-option-item:first-child strong',
      '.decision-option-item:first-child .decision-option-effect',
      '.decision-option-item:first-child .decision-option-action',
    ]);
    for (const viewport of STUDENT_QA_VIEWPORTS) {
      await studentBrowser.cdp.send('Emulation.setDeviceMetricsOverride', viewport);
      await sleep(250);
      await evaluate(studentBrowser.cdp, scrollBelowSticky('.decision-round-card'));
      layoutAudits.push(await collectViewportAudit(studentBrowser.cdp, `student strategic decision ${viewport.width}px`));
    }
    await studentBrowser.cdp.send('Emulation.setDeviceMetricsOverride', MIN_DESKTOP);
    await sleep(350);
    await capture(studentBrowser.cdp, '13-student-strategic-decision-1000x760.png', scrollBelowSticky('.decision-round-card'));
    await studentBrowser.cdp.send('Emulation.setDeviceMetricsOverride', ULTRAWIDE);
    await sleep(350);
    await capture(studentBrowser.cdp, '14-student-strategic-decision-3440x1440.png', scrollBelowSticky('.decision-round-card'));

    await postJson(`http://127.0.0.1:${PORT}/api/action`, {
      playerId: student.playerId,
      sessionToken: student.sessionToken,
      action: 'request-teacher-help',
      value: {
        category: 'assembly',
        message: 'Не понимаю, почему не хватает ресурсов',
      },
    });
    await teacherBrowser.cdp.send('Emulation.setDeviceMetricsOverride', DESKTOP);
    await studentBrowser.cdp.send('Emulation.setDeviceMetricsOverride', DESKTOP);
    await setPerformanceMode(studentBrowser.cdp, 'standard');
    await evaluate(teacherBrowser.cdp, '(async () => { await refreshState(); setGameTab("teacher"); return true; })()');
    await evaluate(studentBrowser.cdp, '(async () => { await refreshState(); setGameTab("operations"); return true; })()');
    await waitFor(teacherBrowser.cdp, 'Boolean(document.querySelector("[data-help-action=\\"acknowledge-help-request\\"]"))', 'teacher help queue');
    await waitFor(studentBrowser.cdp, 'Boolean(document.querySelector(".student-help-card.open"))', 'student active help request');
    layoutAudits.push(await collectViewportAudit(teacherBrowser.cdp, 'teacher help request desktop'));
    layoutAudits.push(await collectViewportAudit(studentBrowser.cdp, 'student help request desktop'));
    await capture(teacherBrowser.cdp, '15-teacher-help-request-1440x900.png', 'window.scrollTo(0, 0)');
    await capture(studentBrowser.cdp, '16-student-help-request-1440x900.png', 'window.scrollTo(0, 0)');
    const helpState = {
      teacherQueueVisible: await evaluate(teacherBrowser.cdp, 'Boolean(document.querySelector("[data-help-action=\\"acknowledge-help-request\\"]"))'),
      studentRequestVisible: await evaluate(studentBrowser.cdp, 'Boolean(document.querySelector(".student-help-card.open"))'),
    };

    await postJson(`http://127.0.0.1:${PORT}/api/server/action`, {
      roomCode,
      action: 'pause-game',
    });
    await evaluate(teacherBrowser.cdp, '(async () => { await refreshState(); setGameTab("teacher"); return true; })()');
    await evaluate(studentBrowser.cdp, '(async () => { await refreshState(); setGameTab("operations"); return true; })()');
    await waitFor(teacherBrowser.cdp, 'state.room?.status === "paused" && Boolean(document.querySelector("[data-teacher-phase=\\"paused\\"]"))', 'teacher paused state');
    await waitFor(studentBrowser.cdp, 'state.room?.status === "paused" && Boolean(document.querySelector("#game-screen.active"))', 'student paused state');
    layoutAudits.push(await collectViewportAudit(teacherBrowser.cdp, 'teacher paused desktop'));
    layoutAudits.push(await collectViewportAudit(studentBrowser.cdp, 'student paused desktop'));
    await capture(teacherBrowser.cdp, '17-teacher-paused-1440x900.png', 'window.scrollTo(0, 0)');
    await capture(studentBrowser.cdp, '18-student-paused-1440x900.png', 'window.scrollTo(0, 0)');
    const pausedState = {
      teacherStatus: await evaluate(teacherBrowser.cdp, 'state.room?.status || ""'),
      studentStatus: await evaluate(studentBrowser.cdp, 'state.room?.status || ""'),
      resumeActionVisible: await evaluate(teacherBrowser.cdp, 'Boolean(document.querySelector("[data-teacher-primary-action=\\"resume-game\\"]"))'),
    };

    await postJson(`http://127.0.0.1:${PORT}/api/server/action`, {
      roomCode,
      action: 'resume-game',
    });
    await postJson(`http://127.0.0.1:${PORT}/api/server/action`, {
      roomCode,
      action: 'finish-room',
    });
    await evaluate(teacherBrowser.cdp, '(async () => { await refreshState(); return true; })()');
    await evaluate(studentBrowser.cdp, '(async () => { await refreshState(); return true; })()');
    await openScreen(teacherBrowser.cdp, 'results-screen');
    await openScreen(studentBrowser.cdp, 'results-screen');
    await waitFor(teacherBrowser.cdp, 'state.room?.status === "finished" && Boolean(document.querySelector("#results-screen.active"))', 'teacher results');
    await waitFor(studentBrowser.cdp, 'state.room?.status === "finished" && Boolean(document.querySelector("#results-screen.active"))', 'student results');
    layoutAudits.push(await collectViewportAudit(teacherBrowser.cdp, 'teacher results desktop'));
    layoutAudits.push(await collectViewportAudit(studentBrowser.cdp, 'student results desktop'));
    await capture(teacherBrowser.cdp, '19-teacher-results-1440x900.png', 'window.scrollTo(0, 0)');
    await capture(studentBrowser.cdp, '20-student-results-1440x900.png', 'window.scrollTo(0, 0)');
    const finishedState = {
      teacherStatus: await evaluate(teacherBrowser.cdp, 'state.room?.status || ""'),
      studentStatus: await evaluate(studentBrowser.cdp, 'state.room?.status || ""'),
      teacherResultsVisible: await evaluate(teacherBrowser.cdp, 'Boolean(document.querySelector("#results-screen.active"))'),
      studentResultsVisible: await evaluate(studentBrowser.cdp, 'Boolean(document.querySelector("#results-screen.active"))'),
    };
    const stateMatrix = { help: helpState, paused: pausedState, finished: finishedState };
    if (!helpState.teacherQueueVisible
      || !helpState.studentRequestVisible
      || pausedState.teacherStatus !== 'paused'
      || pausedState.studentStatus !== 'paused'
      || !pausedState.resumeActionVisible
      || finishedState.teacherStatus !== 'finished'
      || finishedState.studentStatus !== 'finished'
      || !finishedState.teacherResultsVisible
      || !finishedState.studentResultsVisible) {
      throw new Error(`Role state matrix failed: ${JSON.stringify(stateMatrix)}`);
    }

    const errorAudit = {
      browserErrors: [
        ...browserErrors(teacherBrowser.cdp).map(event => ({ browser: 'teacher', event })),
        ...browserErrors(studentBrowser.cdp).map(event => ({ browser: 'student', event })),
      ],
    };
    if (!(errorAudit.browserErrors.length === 0)) {
      throw new Error(`Browser errors detected: ${JSON.stringify(errorAudit.browserErrors.slice(0, 8))}`);
    }

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
        '06-student-game-full-1440x900.png',
        '06a-student-factory-map-v9-1440x900.png',
        '06b-student-first-turn-tutorial-1440x900.png',
        '06c-student-first-turn-tutorial-390x844.png',
        '07-student-game-full-3440x1440.png',
        '08-student-game-standard-1440x900.png',
        '09-student-game-lite-1000x760.png',
        '10-student-turn-review-1440x900.png',
        '11-student-turn-review-1000x760.png',
        '12-student-turn-review-3440x1440.png',
        '13-student-strategic-decision-1000x760.png',
        '14-student-strategic-decision-3440x1440.png',
        '15-teacher-help-request-1440x900.png',
        '16-student-help-request-1440x900.png',
        '17-teacher-paused-1440x900.png',
        '18-student-paused-1440x900.png',
        '19-teacher-results-1440x900.png',
        '20-student-results-1440x900.png',
      ],
      checks: {
        teacherGameVisible: await evaluate(teacherBrowser.cdp, 'Boolean(document.querySelector("#game-screen.active"))'),
        studentLiteMode: await evaluate(studentBrowser.cdp, 'document.body.dataset.performanceMode || document.documentElement.dataset.performanceMode || ""'),
        studentLobbyTextAudit,
        studentDesktopTopbarTextAudit,
        studentDesktopNavigationTextAudit,
        studentDecisionTextAudit,
        studentTurnReviewContract: await evaluate(studentBrowser.cdp, `({
          contract: document.querySelector('.turn-review-card')?.dataset.turnReviewContract || '',
          sections: [...document.querySelectorAll('[data-turn-review-section]')].map(node => node.dataset.turnReviewSection),
        })`),
        studentDecisionContract: await evaluate(studentBrowser.cdp, `({
          contract: document.querySelector('.decision-round-card')?.dataset.decisionRoundContract || '',
          status: document.querySelector('.decision-round-card')?.dataset.decisionRoundStatus || '',
          options: document.querySelectorAll('.decision-option-item').length,
          labels: [...document.querySelectorAll('.decision-option-item strong')].map(node => node.textContent.trim()),
        })`),
        browserErrors: errorAudit.browserErrors,
        stableRoleDom: {
          teacher: teacherStableRoleDom,
          student: studentStableRoleDom,
        },
        partialFactoryNavigation,
        firstTurnTutorial: {
          desktop: firstTurnTutorialDesktopAudit,
          mobile: firstTurnTutorialMobileAudit,
        },
        studentMarketStatAudit,
        studentMarketDisclosureAudit,
        stateMatrix,
        accessibility: {
          teacherWorkspace: teacherWorkspaceAudit,
          teacherFocusOrder: teacherFocusOrderAudit,
          studentScene: studentSceneAudit,
          studentFocusOrder: studentFocusOrderAudit,
          reducedMotion: reducedMotionAudit,
        },
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
    safeKill(teacherBrowser?.edge, teacherProfileDir);
    safeKill(studentBrowser?.edge, studentProfileDir);
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
