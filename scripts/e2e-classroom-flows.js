const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { browserErrors, evaluate, installPlayerSession, launchBrowser, navigate, sleep, waitFor, waitForHttp } = require('./lib/cdp-browser');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.BIZ_ARENA_E2E_PORT || 3420);
const DESKTOP_VIEWPORTS = [
  { width: 1000, height: 760 },
  { width: 1180, height: 800 },
  { width: 1181, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
  { width: 3440, height: 1440 },
];
const MAP_FIRST_VIEWPORTS = [
  { width: 375, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
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

function stop(child, profileDir = '') {
  try {
    if (child?.pid && process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    } else if (child?.pid) {
      child.kill();
    }
  } catch {}

  if (process.platform === 'win32' && profileDir) {
    try {
      spawnSync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', STOP_EDGE_PROFILE_PROCESSES, profileDir],
        { stdio: 'ignore', windowsHide: true },
      );
    } catch {}
  }
}
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

async function assertTextContrast(cdp, selector, label, minimum = 4.5) {
  const result = await evaluate(cdp, `(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) return { ok: false, reason: 'missing-node' };
    const parseColor = value => {
      const parts = String(value || '').match(/[\\d.]+/g)?.map(Number) || [];
      return {
        r: parts[0] || 0,
        g: parts[1] || 0,
        b: parts[2] || 0,
        a: parts.length > 3 ? parts[3] : 1,
      };
    };
    const composite = (front, back) => {
      const alpha = front.a + back.a * (1 - front.a);
      if (!alpha) return { r: 0, g: 0, b: 0, a: 0 };
      return {
        r: (front.r * front.a + back.r * back.a * (1 - front.a)) / alpha,
        g: (front.g * front.a + back.g * back.a * (1 - front.a)) / alpha,
        b: (front.b * front.a + back.b * back.a * (1 - front.a)) / alpha,
        a: alpha,
      };
    };
    let background = { r: 0, g: 0, b: 0, a: 0 };
    for (let current = node; current; current = current.parentElement) {
      background = composite(background, parseColor(getComputedStyle(current).backgroundColor));
      if (background.a >= 0.999) break;
    }
    if (background.a < 0.999) background = composite(background, { r: 255, g: 255, b: 255, a: 1 });
    const foreground = composite(parseColor(getComputedStyle(node).color), background);
    const luminance = color => {
      const channels = [color.r, color.g, color.b].map(channel => {
        const normalized = channel / 255;
        return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const brighter = Math.max(luminance(foreground), luminance(background));
    const darker = Math.min(luminance(foreground), luminance(background));
    const ratio = (brighter + 0.05) / (darker + 0.05);
    return {
      ok: ratio >= ${Number(minimum)},
      ratio,
      text: (node.textContent || '').trim(),
      color: getComputedStyle(node).color,
      background,
    };
  })()`);
  assert.equal(result.ok, true, `${label} contrast is below ${minimum}: ${JSON.stringify(result)}`);
}

async function assertVisibleSidebarLabelsFit(cdp, label) {
  const result = await evaluate(cdp, `(() => {
    const sidebar = document.querySelector('.app-sidebar');
    if (!sidebar) return { ok: false, reason: 'missing-sidebar', offenders: [] };
    const offenders = [...sidebar.querySelectorAll('.app-sidebar-link > strong')]
      .filter(node => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== 'none'
          && style.visibility !== 'hidden'
          && Number(style.opacity || 1) > 0.05
          && rect.width > 0
          && rect.height > 0;
      })
      .map(node => {
        const link = node.closest('.app-sidebar-link');
        const nodeRect = node.getBoundingClientRect();
        const linkRect = link.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(node);
        const textRect = range.getBoundingClientRect();
        const leftLimit = linkRect.left + 1;
        const rightLimit = linkRect.right - 1;
        const clipped = node.scrollWidth > node.clientWidth + 1
          || textRect.left < leftLimit - 1
          || textRect.right > rightLimit + 1;
        return {
          text: String(node.textContent || '').trim(),
          clipped,
          nodeWidth: Math.round(nodeRect.width),
          scrollWidth: node.scrollWidth,
          textLeft: Math.round(textRect.left),
          textRight: Math.round(textRect.right),
          linkLeft: Math.round(linkRect.left),
          linkRight: Math.round(linkRect.right),
        };
      })
      .filter(entry => entry.clipped);
    return { ok: offenders.length === 0, offenders };
  })()`);
  assert.equal(result.ok, true, `${label} clips sidebar labels: ${JSON.stringify(result)}`);
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
    await assertVisibleSidebarLabelsFit(cdp, `${label} ${viewport.width}x${viewport.height}`);
  }
}

async function assertStudentMapFirstLayout(cdp, url) {
  await navigate(cdp, `${url}&quality=full`);
  await openScreen(cdp, 'game-screen');
  await evaluate(cdp, 'document.querySelector("[data-game-tab=operations]")?.click()');
  await waitFor(cdp, 'Boolean(document.querySelector(".student-factory-scene .student-factory-node"))', 'student map-first workspace');
  const snapshots = [];
  for (const viewport of MAP_FIRST_VIEWPORTS) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      ...viewport,
      mobile: false,
      deviceScaleFactor: 1,
    });
    await sleep(250);
    const snapshot = await evaluate(cdp, `(() => {
      const isVisible = node => {
        if (!node) return false;
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      };
      const rectOf = node => {
        const rect = node?.getBoundingClientRect();
        return rect ? {
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        } : null;
      };
      const primary = document.querySelector('.student-primary-next-action');
      const activeNavigation = document.querySelector('[data-role-navigation="student"] .app-sidebar-link.active');
      const scene = document.querySelector('.student-factory-scene');
      const secondaryKpis = document.querySelector('.student-command-kpis-disclosure');
      const sceneRect = scene?.getBoundingClientRect();
      const visibleSceneHeight = sceneRect
        ? Math.max(0, Math.min(innerHeight, sceneRect.bottom) - Math.max(0, sceneRect.top))
        : 0;
      const stationTargets = [...document.querySelectorAll('.student-factory-map-node')]
        .map(node => node.getBoundingClientRect())
        .filter(rect => rect.width > 0 && rect.height > 0)
        .map(rect => Math.min(rect.width, rect.height));
      const stationLabels = [...document.querySelectorAll('.student-factory-map-marker')]
        .filter(isVisible)
        .map(node => {
          const rect = node.getBoundingClientRect();
          const parent = node.closest('.student-factory-map-node');
          const parentRect = parent?.getBoundingClientRect();
          const style = getComputedStyle(node);
          return {
            station: parent?.dataset.sceneStation || '',
            rect,
            parentRect,
            transform: style.transform,
            left: style.left,
            width: style.width,
          };
        });
      const flatPresentation = getComputedStyle(document.querySelector('.student-factory-map-floor')).display === 'none';
      const flatLabelOverflows = flatPresentation
        ? stationLabels.filter(({ rect, parentRect }) => !parentRect
          || rect.left < parentRect.left - 1
          || rect.right > parentRect.right + 1)
        : [];
      const flatLabelOverlaps = flatPresentation
        ? stationLabels.flatMap(({ rect }, index) => stationLabels.slice(index + 1)
          .filter(({ rect: other }) => rect.left < other.right
            && rect.right > other.left
            && rect.top < other.bottom
            && rect.bottom > other.top))
        : [];
      return {
        viewport: { width: innerWidth, height: innerHeight },
        primaryCount: [...document.querySelectorAll('.student-primary-next-action')].filter(isVisible).length,
        primary: rectOf(primary),
        activeNavigation: rectOf(activeNavigation),
        scene: rectOf(scene),
        visibleSceneHeight: Math.round(visibleSceneHeight),
        visibleSceneRatio: Number((visibleSceneHeight / innerHeight).toFixed(3)),
        nextActionVisible: isVisible(document.querySelector('#game-next-action-chip')),
        operationsHeaderVisible: isVisible(document.querySelector('[data-game-panel="operations"] > .panel-header')),
        secondaryKpisAfterScene: Boolean(scene && secondaryKpis && (scene.compareDocumentPosition(secondaryKpis) & Node.DOCUMENT_POSITION_FOLLOWING)),
        stationCount: stationTargets.length,
        minimumStationTarget: Math.round(Math.min(...stationTargets)),
        flatPresentation,
        flatLabelOverflowCount: flatLabelOverflows.length,
        flatLabelOverflowDeltas: flatLabelOverflows.map(({ station, rect, parentRect, transform, left, width }) => ({
          station,
          left: Math.round(rect.left - parentRect.left),
          right: Math.round(rect.right - parentRect.right),
          transform,
          computedLeft: left,
          width,
        })),
        flatLabelOverlapCount: flatLabelOverlaps.length,
        bodyOverflow: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0) - innerWidth,
      };
    })()`);
    snapshots.push(snapshot);
    assert.equal(snapshot.primaryCount, 1, JSON.stringify(snapshot));
    assert.ok(snapshot.primary?.height >= 48, JSON.stringify(snapshot));
    assert.equal(snapshot.nextActionVisible, false, JSON.stringify(snapshot));
    assert.equal(snapshot.operationsHeaderVisible, false, JSON.stringify(snapshot));
    assert.equal(snapshot.secondaryKpisAfterScene, true, JSON.stringify(snapshot));
    assert.equal(snapshot.stationCount, 4, JSON.stringify(snapshot));
    assert.ok(snapshot.minimumStationTarget >= 42, JSON.stringify(snapshot));
    assert.equal(snapshot.flatLabelOverflowCount, 0, JSON.stringify(snapshot));
    assert.equal(snapshot.flatLabelOverlapCount, 0, JSON.stringify(snapshot));
    assert.ok(snapshot.bodyOverflow <= 1, JSON.stringify(snapshot));
    assert.ok(snapshot.primary.bottom <= viewport.height, JSON.stringify(snapshot));
    assert.ok(snapshot.activeNavigation && snapshot.activeNavigation.width >= 42, JSON.stringify(snapshot));
    if (viewport.width === 375) {
      assert.ok(snapshot.activeNavigation.left >= 0 && snapshot.activeNavigation.right <= viewport.width, JSON.stringify(snapshot));
    }
    if (viewport.width === 1024) assert.ok(snapshot.scene.top <= 365, JSON.stringify(snapshot));
    if (viewport.width === 1440) {
      assert.ok(snapshot.scene.top <= 340, JSON.stringify(snapshot));
      assert.ok(snapshot.visibleSceneRatio >= 0.48, JSON.stringify(snapshot));
    }
  }
  return snapshots;
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
    const map = document.querySelector('.student-factory-map');
    const node = document.querySelector('.student-factory-node');
    const sceneRect = scene.getBoundingClientRect();
    const sceneHeadRect = scene.querySelector('.student-factory-scene-head')?.getBoundingClientRect();
    const sceneStyle = getComputedStyle(scene);
    const nodeStyle = getComputedStyle(node);
    const zoneAlignment = [...document.querySelectorAll('.student-factory-map-node')].map(mapNode => {
      const station = mapNode.dataset.sceneStation;
      const shadow = mapNode.querySelector('.student-factory-building-shadow');
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
    const mapAnchors = [...document.querySelectorAll('.student-factory-map-node')].map(mapNode => ({
      station: mapNode.dataset.sceneStation,
      x: Number(mapNode.dataset.mapX),
      y: Number(mapNode.dataset.mapY),
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
    const buildingBounds = [...document.querySelectorAll('.student-factory-map-node')].map(mapNode => {
      const rect = mapNode.querySelector('.student-factory-map-building')?.getBoundingClientRect();
      return rect ? {
        station: mapNode.dataset.sceneStation,
        headerGap: Math.round(rect.top - (sceneHeadRect?.bottom || sceneRect.top)),
        insideScene: rect.left >= sceneRect.left - 2
          && rect.right <= sceneRect.right + 2
          && rect.top >= sceneRect.top - 2
          && rect.bottom <= sceneRect.bottom + 2,
      } : null;
    }).filter(Boolean);
    return {
      mode: document.documentElement.dataset.performanceMode,
      animationMode: document.documentElement.dataset.animationMode,
      controls: {
        allButtons: document.querySelectorAll('#game-screen button').length,
        visibleButtons: [...document.querySelectorAll('#game-screen.active button')].filter(isVisible).length,
        routeSteps: document.querySelectorAll('.student-route-panel [data-student-route-step]').length,
        sceneNodes: document.querySelectorAll('.student-factory-scene .student-factory-node').length,
        mapRoutes: document.querySelectorAll('.student-factory-map .student-factory-map-route-segment').length,
        mapMarkers: document.querySelectorAll('.student-factory-map [data-factory-map-marker]').length,
        roadSegments: document.querySelectorAll('.student-factory-map [data-factory-road]').length,
        buildingTypes: [...document.querySelectorAll('.student-factory-map [data-factory-building]')]
          .map(node => node.dataset.factoryBuilding),
      },
      scene: {
        presentation: scene.dataset.scenePresentation,
        version: scene.dataset.sceneVersion,
        activeStation: document.querySelector('.student-factory-map-node.active')?.dataset.sceneStation || '',
        guidanceStates: [...document.querySelectorAll('.student-factory-map-node')]
          .map(mapNode => ({
            station: mapNode.dataset.sceneStation,
            guidanceState: mapNode.dataset.factoryGuidanceState || '',
          })),
        activityStates: [...document.querySelectorAll('.student-factory-map-node')]
          .map(mapNode => ({
            station: mapNode.dataset.sceneStation,
            activityState: mapNode.dataset.factoryActivity || '',
          })),
        environmentTypes: [...document.querySelectorAll('.student-factory-map [data-factory-environment]')]
          .map(node => node.dataset.factoryEnvironment),
        motionArtifacts: [...document.querySelectorAll('.student-factory-map [data-factory-motion]')]
          .map(node => ({
            motion: node.dataset.factoryMotion,
            animationName: getComputedStyle(node).animationName,
          })),
        routeFocusStates: [...document.querySelectorAll('.student-factory-map-route-segment')]
          .map(route => route.dataset.mapRouteState || ''),
        inspectorStation: document.querySelector('[data-factory-map-inspector]')?.dataset.factoryMapInspector || '',
        inspectorCount: document.querySelectorAll('[data-factory-map-inspector]').length,
        persistentLabelCount: document.querySelectorAll('.student-factory-map-label').length,
        zoneAlignment,
        maximumZoneAnchorError: Math.max(0, ...zoneAlignment.map(entry => entry.error)),
        buildingBounds,
        minimumBuildingHeaderGap: Math.min(...buildingBounds.map(entry => entry.headerGap)),
        mapAnchors,
        sequenceLayoutOk,
        backgroundImage: sceneStyle.backgroundImage,
        afterDisplay: getComputedStyle(scene, '::after').display,
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
  const directoryProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'biz-arena-e2e-directory-'));
  const server = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), BIZ_ARENA_APP_MODE: 'server', BIZ_ARENA_DATA_DIR: dataDir }, stdio: 'ignore', windowsHide: true });
  let teacherBrowser;
  let studentBrowser;
  let directoryBrowser;
  try {
    await waitForHttp(`http://127.0.0.1:${PORT}/api/health`);
    const teacher = await postJson(`http://127.0.0.1:${PORT}/api/rooms/create`, { roomName: 'E2E Classroom', companyName: 'Teacher Console', userName: 'Teacher E2E', teacherHost: true, scenarioKey: 'motorcycles', difficulty: 'easy', maxPlayers: 30, dayLimit: 15, turnDurationMs: 300000, lobbyVisibility: 'listed' });
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

    directoryBrowser = await launchBrowser({ cdpPort: 9442, profileDir: directoryProfile });
    await navigate(directoryBrowser.cdp, `http://127.0.0.1:${PORT}/client`);
    await waitFor(directoryBrowser.cdp, 'document.querySelectorAll("#student-directory-list [data-directory-select]").length === 1', 'public student lobby directory');
    assert.equal(await evaluate(directoryBrowser.cdp, 'document.querySelector("#student-directory-tab")?.getAttribute("aria-selected")'), 'true');
    assert.equal(await evaluate(directoryBrowser.cdp, `document.querySelector("#student-directory-list")?.textContent.includes(${JSON.stringify(teacher.roomCode)})`), false);
    await evaluate(directoryBrowser.cdp, 'document.querySelector("#student-directory-tab")?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))');
    await waitFor(directoryBrowser.cdp, 'document.querySelector("#student-code-tab")?.getAttribute("aria-selected") === "true" && document.activeElement?.id === "student-code-tab"', 'student directory keyboard tab switch');
    await evaluate(directoryBrowser.cdp, 'document.querySelector("#student-code-tab")?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }))');
    await waitFor(directoryBrowser.cdp, 'document.querySelector("#student-directory-tab")?.getAttribute("aria-selected") === "true" && document.activeElement?.id === "student-directory-tab"', 'student directory keyboard tab return');
    await evaluate(directoryBrowser.cdp, 'document.querySelector("#student-directory-list [data-directory-select]")?.click()');
    await waitFor(directoryBrowser.cdp, 'document.querySelector("#join-form")?.hidden === false && document.activeElement?.id === "room-code"', 'directory join confirmation');
    assert.equal(await evaluate(directoryBrowser.cdp, 'document.querySelector("#student-directory-selection")?.textContent.includes("E2E Classroom")'), true);
    assert.equal(await evaluate(directoryBrowser.cdp, 'document.querySelector("#room-code")?.getAttribute("pattern")'), '[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}');
    await evaluate(directoryBrowser.cdp, 'document.querySelector("#student-directory-back")?.click()');
    await waitFor(directoryBrowser.cdp, 'document.activeElement?.matches("[data-directory-select]")', 'student directory focus return');
    await evaluate(directoryBrowser.cdp, 'document.activeElement?.click()');
    await waitFor(directoryBrowser.cdp, 'document.querySelector("#join-form")?.hidden === false && document.activeElement?.id === "room-code"', 'directory join confirmation after focus return');
    await directoryBrowser.cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
    await assertNoHorizontalOverflow(directoryBrowser.cdp, 'student lobby directory mobile');
    await directoryBrowser.cdp.send('Emulation.clearDeviceMetricsOverride');
    await navigate(directoryBrowser.cdp, `http://127.0.0.1:${PORT}/client?roomCode=${teacher.roomCode}`);
    await waitFor(directoryBrowser.cdp, `document.querySelector("#join-form")?.hidden === false && document.querySelector("#room-code")?.value === ${JSON.stringify(teacher.roomCode)}`, 'student QR/manual code fallback');
    assert.equal(await evaluate(directoryBrowser.cdp, 'document.querySelector("#student-code-tab")?.getAttribute("aria-selected")'), 'true');

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
    await waitFor(studentBrowser.cdp, 'document.querySelector("#tutorial-overlay")?.dataset.firstTurnActive === "true"', 'student interactive tutorial auto-start');
    assert.equal(await evaluate(studentBrowser.cdp, 'document.querySelector("#tutorial-overlay")?.dataset.firstTurnStep'), 'workforce');
    assert.equal(await evaluate(studentBrowser.cdp, 'document.querySelector("#tutorial-overlay")?.dataset.firstTurnStage'), '2');
    assert.equal(await evaluate(studentBrowser.cdp, 'document.querySelectorAll("#tutorial-route [data-first-turn-progress-step]").length'), 5);
    assert.equal(await evaluate(studentBrowser.cdp, 'Boolean(document.querySelector("[data-first-turn-target=workforce]"))'), true);
    await waitFor(studentBrowser.cdp, 'Boolean(document.querySelector("#tutorial-arrow-path")?.getAttribute("d"))', 'student tutorial arrow');
    const tutorialManualScroll = await evaluate(studentBrowser.cdp, `(async () => {
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const current = window.scrollY;
      const requested = current > 120 ? current - 120 : Math.min(maxScroll, current + 120);
      window.scrollTo({ top: requested, behavior: 'auto' });
      await new Promise(resolve => window.setTimeout(resolve, 200));
      return {
        ok: Math.abs(window.scrollY - requested) <= 2,
        requested: Math.round(requested),
        actual: Math.round(window.scrollY),
      };
    })()`);
    assert.equal(tutorialManualScroll.ok, true, `Tutorial fought manual scrolling: ${JSON.stringify(tutorialManualScroll)}`);
    await studentBrowser.cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      mobile: true,
      deviceScaleFactor: 1,
    });
    await evaluate(studentBrowser.cdp, 'renderTutorialOverlay()');
    await sleep(300);
    const mobileTutorialLayout = await evaluate(studentBrowser.cdp, `(() => {
      const card = document.querySelector('[data-first-turn-card]');
      const target = document.querySelector('[data-first-turn-target]');
      const route = document.querySelector('#tutorial-route');
      const arrow = document.querySelector('[data-first-turn-arrow]');
      const cardRect = card?.getBoundingClientRect();
      const targetRect = target?.getBoundingClientRect();
      return {
        ok: Boolean(cardRect && targetRect)
          && targetRect.bottom <= cardRect.top - 8
          && cardRect.left >= 8
          && cardRect.right <= window.innerWidth - 8
          && cardRect.bottom <= window.innerHeight - 8
          && route.scrollWidth <= route.clientWidth + 1
          && getComputedStyle(arrow).display === 'none',
        cardTop: Math.round(cardRect?.top || 0),
        targetBottom: Math.round(targetRect?.bottom || 0),
        routeClientWidth: route?.clientWidth || 0,
        routeScrollWidth: route?.scrollWidth || 0,
      };
    })()`);
    assert.equal(mobileTutorialLayout.ok, true, `Mobile tutorial obscures its target: ${JSON.stringify(mobileTutorialLayout)}`);
    await studentBrowser.cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      mobile: false,
      deviceScaleFactor: 1,
    });
    await evaluate(studentBrowser.cdp, 'renderTutorialOverlay()');
    await sleep(250);
    assert.equal(await evaluate(studentBrowser.cdp, 'document.querySelectorAll(".student-route-panel .student-primary-next-action").length'), 1);
    assert.equal(await evaluate(studentBrowser.cdp, 'document.querySelector(".student-route-panel")?.dataset.studentFlowContract'), 'first-turn-v2');
    assert.equal(await evaluate(studentBrowser.cdp, 'Boolean(document.querySelector(".student-route-panel")?.dataset.studentPrimaryStep)'), true);
    assert.equal(await evaluate(studentBrowser.cdp, 'document.querySelector(".student-route-panel")?.dataset.studentGuidedFocus'), 'first-turn');
    assert.equal(await evaluate(studentBrowser.cdp, 'document.querySelector(".student-route-panel .student-primary-next-action")?.textContent.trim()'), 'Открыть Команду — нанять сотрудника');
    assert.equal(await evaluate(studentBrowser.cdp, 'document.querySelector(".student-route-panel .student-primary-next-action")?.dataset.studentRouteTab'), 'operations');
    assert.equal(await evaluate(studentBrowser.cdp, 'document.querySelector(".student-route-panel .student-primary-next-action")?.dataset.studentRouteDepartment'), 'workforce');
    assert.equal(await evaluate(studentBrowser.cdp, 'document.querySelectorAll(".student-route-panel .student-command-kpis-disclosure:not([open])").length'), 1);
    assert.equal(await evaluate(studentBrowser.cdp, 'document.querySelector(".student-route-panel .student-command-kpis-disclosure summary > span")?.textContent.trim()'), 'Показатели предприятия');
    assert.equal(await evaluate(studentBrowser.cdp, 'document.querySelectorAll(".student-route-panel [data-student-route-step]").length'), 5);
    assert.equal(await evaluate(studentBrowser.cdp, 'document.querySelectorAll(".student-route-panel .student-market-disclosure").length'), 1);
    assert.equal(await evaluate(studentBrowser.cdp, 'document.querySelector(".student-route-panel .student-market-disclosure")?.open'), false);
    assert.equal(await evaluate(studentBrowser.cdp, 'document.querySelector(".student-route-panel .student-market-disclosure > summary strong")?.textContent.trim()'), 'Рынок и рекомендации');
    assert.equal(await evaluate(studentBrowser.cdp, 'document.querySelector("[data-game-tab=teacher]") === null || getComputedStyle(document.querySelector("[data-game-tab=teacher]")).display === "none"'), true);
    assert.deepEqual(await visibleSidebarGameTabs(studentBrowser.cdp), ['overview', 'purchase', 'operations', 'market', 'competitors', 'events']);
    assert.equal(await legacyGameTabStripAbsent(studentBrowser.cdp), true);
    await evaluate(studentBrowser.cdp, 'document.querySelector(".student-route-panel .student-primary-next-action")?.click()');
    await waitFor(studentBrowser.cdp, 'document.querySelector("[data-factory-department-detail]")?.dataset.factoryDepartmentDetail === "workforce"', 'student workforce CTA');
    await waitFor(studentBrowser.cdp, 'document.querySelector("#tutorial-overlay")?.dataset.firstTurnTargetMode === "action"', 'student tutorial workforce action');
    assert.equal(await evaluate(studentBrowser.cdp, 'document.querySelector("[data-first-turn-target=workforce]")?.matches("[data-factory-action=hire-worker]")'), true);
    await evaluate(studentBrowser.cdp, 'document.querySelector("#tutorial-skip-button")?.click()');
    await waitFor(studentBrowser.cdp, 'document.querySelector("#tutorial-overlay")?.classList.contains("hidden")', 'student tutorial skip');
    assert.equal(await evaluate(studentBrowser.cdp, 'Object.entries(localStorage).some(([key, value]) => key.startsWith("bizArenaFirstTurnTutorial:") && value === "skipped")'), true);
    assert.equal(await evaluate(studentBrowser.cdp, 'document.body.dataset.studentWorkspace'), 'dialog');
    assert.equal(await evaluate(studentBrowser.cdp, 'Boolean(document.querySelector("[data-factory-department-detail].student-workspace-dialog"))'), true);
    assert.equal(await evaluate(studentBrowser.cdp, '!document.querySelector("[data-game-panel=operations]").classList.contains("hidden")'), true);
    await evaluate(studentBrowser.cdp, 'document.querySelector("[data-student-workspace-close]")?.click()');
    await waitFor(studentBrowser.cdp, 'document.body.dataset.studentWorkspace === "map"', 'student workspace close button');
    await evaluate(studentBrowser.cdp, 'document.querySelector("[data-role-navigation=student] [data-game-tab=purchase]")?.click()');
    await waitFor(studentBrowser.cdp, 'Boolean(document.querySelector("[data-game-panel=purchase].student-workspace-dialog"))', 'student purchase dialog');
    const purchaseDialogChrome = await evaluate(studentBrowser.cdp, `(() => {
      const dialog = document.querySelector('[data-game-panel=purchase].student-workspace-dialog');
      const close = dialog?.querySelector('[data-student-workspace-close]');
      const tabs = [...(dialog?.querySelectorAll('[data-purchase-component]') || [])];
      const closeRect = close?.getBoundingClientRect();
      const dialogRect = dialog?.getBoundingClientRect();
      return {
        closeLabel: close?.getAttribute('aria-label') || '',
        closeTitle: close?.getAttribute('title') || '',
        closeWidth: closeRect?.width || 0,
        closeHeight: closeRect?.height || 0,
        closeRightGap: dialogRect && closeRect ? dialogRect.right - closeRect.right : -1,
        tabRoles: tabs.map(tab => tab.getAttribute('role') || ''),
        selectedTabs: tabs.filter(tab => tab.getAttribute('aria-selected') === 'true').length,
      };
    })()`);
    assert.match(purchaseDialogChrome.closeLabel, /^Закрыть /);
    assert.equal(purchaseDialogChrome.closeTitle, 'Закрыть окно');
    assert.ok(purchaseDialogChrome.closeWidth >= 44 && purchaseDialogChrome.closeHeight >= 44, JSON.stringify(purchaseDialogChrome));
    assert.ok(purchaseDialogChrome.closeRightGap >= 8, JSON.stringify(purchaseDialogChrome));
    assert.equal(purchaseDialogChrome.tabRoles.every(role => role === 'tab'), true);
    assert.equal(purchaseDialogChrome.selectedTabs, 1);
    await assertTextContrast(studentBrowser.cdp, '[data-purchase-component="engines"] strong', 'purchase engine title');
    await assertTextContrast(studentBrowser.cdp, '[data-purchase-component="engines"] small', 'purchase engine details');
    await evaluate(studentBrowser.cdp, `(() => {
      const selected = document.querySelector('[data-purchase-component][aria-selected="true"]');
      selected?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    })()`);
    await waitFor(studentBrowser.cdp, 'document.querySelector("[data-purchase-component=engines]")?.getAttribute("aria-selected") === "true"', 'purchase keyboard tab selection');
    await waitFor(studentBrowser.cdp, 'document.activeElement?.dataset.purchaseComponent === "engines"', 'purchase keyboard tab focus');
    for (const viewport of [{ width: 768, height: 900 }, { width: 375, height: 812 }]) {
      await studentBrowser.cdp.send('Emulation.setDeviceMetricsOverride', {
        ...viewport,
        mobile: viewport.width < 600,
        deviceScaleFactor: 1,
      });
      await sleep(150);
      const dialogBounds = await evaluate(studentBrowser.cdp, `(() => {
        const dialog = document.querySelector('[data-game-panel=purchase].student-workspace-dialog');
        const close = dialog?.querySelector('[data-student-workspace-close]');
        const workspace = dialog?.querySelector('.purchase-workspace');
        const header = dialog?.querySelector(':scope > .panel-header');
        const heading = header?.querySelector('h2');
        const description = header?.querySelector('.muted');
        const coach = workspace?.querySelector('.purchase-coach');
        const dialogRect = dialog?.getBoundingClientRect();
        const closeRect = close?.getBoundingClientRect();
        const headerRect = header?.getBoundingClientRect();
        const headingRect = heading?.getBoundingClientRect();
        const descriptionRect = description?.getBoundingClientRect();
        const coachRect = coach?.getBoundingClientRect();
        const headerContentBottom = Math.max(headingRect?.bottom || 0, descriptionRect?.bottom || 0);
        return {
          dialogInside: Boolean(dialogRect) && dialogRect.left >= -1 && dialogRect.right <= innerWidth + 1,
          closeInside: Boolean(closeRect) && closeRect.left >= 0 && closeRect.right <= innerWidth && closeRect.top >= 0 && closeRect.bottom <= innerHeight,
          headerClearsContent: Boolean(headerRect && coachRect)
            && headerRect.bottom <= coachRect.top
            && headerContentBottom <= coachRect.top,
          headerBottom: headerRect?.bottom || 0,
          headerContentBottom,
          coachTop: coachRect?.top || 0,
          dialogOverflow: dialog ? dialog.scrollWidth - dialog.clientWidth : -1,
          workspaceOverflow: workspace ? workspace.scrollWidth - workspace.clientWidth : -1,
        };
      })()`);
      assert.equal(dialogBounds.dialogInside, true, JSON.stringify({ viewport, dialogBounds }));
      assert.equal(dialogBounds.closeInside, true, JSON.stringify({ viewport, dialogBounds }));
      assert.equal(dialogBounds.headerClearsContent, true, JSON.stringify({ viewport, dialogBounds }));
      assert.ok(dialogBounds.dialogOverflow <= 4 && dialogBounds.workspaceOverflow <= 4, JSON.stringify({ viewport, dialogBounds }));
    }
    await studentBrowser.cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      mobile: false,
      deviceScaleFactor: 1,
    });
    await sleep(150);
    await evaluate(studentBrowser.cdp, 'document.querySelector("[data-student-workspace-backdrop]")?.click()');
    await waitFor(studentBrowser.cdp, 'document.body.dataset.studentWorkspace === "map"', 'student workspace backdrop close');
    await evaluate(studentBrowser.cdp, 'document.querySelector("[data-role-navigation=student] [data-game-tab=market]")?.click()');
    await waitFor(studentBrowser.cdp, 'Boolean(document.querySelector("[data-game-panel=market].student-workspace-dialog"))', 'student market dialog');
    await evaluate(studentBrowser.cdp, 'history.back()');
    await waitFor(studentBrowser.cdp, 'document.body.dataset.studentWorkspace === "map"', 'student workspace browser back');
    await evaluate(studentBrowser.cdp, 'document.querySelector("[data-role-navigation=student] [data-game-tab=events]")?.click()');
    await waitFor(studentBrowser.cdp, 'Boolean(document.querySelector("[data-game-panel=events].student-workspace-dialog"))', 'student report dialog');
    await evaluate(studentBrowser.cdp, 'document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))');
    await waitFor(studentBrowser.cdp, 'document.body.dataset.studentWorkspace === "map"', 'student workspace Escape close');
    await evaluate(studentBrowser.cdp, 'document.querySelector("[data-scene-station=market]")?.click()');
    await waitFor(studentBrowser.cdp, 'Boolean(document.querySelector("#market-sale-price"))', 'student sale draft dialog');
    await evaluate(studentBrowser.cdp, `(() => {
      const input = document.querySelector('#market-sale-price');
      input.value = '6417';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return input.value;
    })()`);
    await evaluate(studentBrowser.cdp, 'document.querySelector("[data-student-workspace-close]")?.click()');
    await waitFor(studentBrowser.cdp, 'document.body.dataset.studentWorkspace === "map"', 'student sale draft close');
    await evaluate(studentBrowser.cdp, 'document.querySelector("[data-scene-station=market]")?.click()');
    await waitFor(studentBrowser.cdp, 'document.querySelector("#market-sale-price")?.value === "6417"', 'student sale draft restore');
    assert.equal(await evaluate(studentBrowser.cdp, 'state.factorySaleDraft?.price'), '6417');
    await evaluate(studentBrowser.cdp, 'document.querySelector("[data-student-workspace-close]")?.click()');
    await waitFor(studentBrowser.cdp, 'document.body.dataset.studentWorkspace === "map"', 'student sale draft final close');
    assert.equal(await evaluate(studentBrowser.cdp, 'getComputedStyle(document.querySelector("#game-next-action-chip")).display'), 'none');
    assert.equal(await evaluate(studentBrowser.cdp, '[...document.querySelectorAll(".student-primary-next-action")].filter(node => node.getBoundingClientRect().height > 0).length'), 1);
    const toastAudit = await evaluate(studentBrowser.cdp, `(() => {
      showToast('Тестовое предупреждение', 'error');
      const toast = document.querySelector('.toast-error');
      const style = getComputedStyle(toast);
      return {
        role: toast.getAttribute('role') || '',
        atomic: toast.getAttribute('aria-atomic') || '',
        backgroundColor: style.backgroundColor,
        color: style.color,
      };
    })()`);
    assert.equal(toastAudit.role, 'alert');
    assert.equal(toastAudit.atomic, 'true');
    assert.notEqual(toastAudit.backgroundColor, 'rgb(255, 255, 255)');
    assert.notEqual(toastAudit.backgroundColor, toastAudit.color);
    await assertTextContrast(studentBrowser.cdp, '.toast-error strong', 'error toast title');
    await assertTextContrast(studentBrowser.cdp, '.toast-error span', 'error toast message');
    await evaluate(studentBrowser.cdp, 'document.querySelectorAll(".toast").forEach(node => node.remove())');
    await assertReadableVisibleText(studentBrowser.cdp, 'student first turn desktop');
    await assertNoHorizontalOverflow(studentBrowser.cdp, 'student first turn desktop');

    const studentProfileUrl = `http://127.0.0.1:${PORT}/client?roomCode=${teacher.roomCode}`;
    const fullProfile = await studentPerformanceSnapshot(studentBrowser.cdp, studentProfileUrl, 'full');
    const mapFirstLayouts = await assertStudentMapFirstLayout(studentBrowser.cdp, studentProfileUrl);
    const standardProfile = await studentPerformanceSnapshot(studentBrowser.cdp, studentProfileUrl, 'standard');
    const liteProfile = await studentPerformanceSnapshot(studentBrowser.cdp, studentProfileUrl, 'lite');
    assert.deepEqual(standardProfile.controls, fullProfile.controls);
    assert.deepEqual(liteProfile.controls, fullProfile.controls);
    assert.equal(fullProfile.mode, 'full');
    assert.equal(fullProfile.scene.presentation, 'isometric-map');
    assert.equal(fullProfile.scene.version, 'v9-industrial-district');
    assert.ok(fullProfile.scene.environmentTypes.includes('city-backdrop'));
    assert.equal(fullProfile.scene.activeStation, 'workforce');
    assert.deepEqual(fullProfile.scene.guidanceStates, [
      { station: 'purchase', guidanceState: 'complete' },
      { station: 'workforce', guidanceState: 'current' },
      { station: 'assembly', guidanceState: 'waiting' },
      { station: 'market', guidanceState: 'waiting' },
    ]);
    assert.deepEqual(fullProfile.scene.activityStates, [
      { station: 'purchase', activityState: 'stocked' },
      { station: 'workforce', activityState: 'empty' },
      { station: 'assembly', activityState: 'idle' },
      { station: 'market', activityState: 'empty' },
    ]);
    assert.deepEqual(fullProfile.scene.environmentTypes, [
      'city-backdrop',
      'parking',
      'utilities',
      'safety-markings',
      'loading-yard',
      'service-vehicle',
    ]);
    assert.deepEqual(fullProfile.scene.motionArtifacts, [
      { motion: 'service-vehicle', animationName: 'studentFactoryServiceShuttle' },
      { motion: 'route-flow', animationName: 'studentFactoryRouteFlow' },
    ]);
    assert.deepEqual(fullProfile.scene.routeFocusStates, ['complete', 'current', 'next']);
    assert.equal(fullProfile.scene.inspectorStation, 'workforce');
    assert.equal(fullProfile.scene.inspectorCount, 1);
    assert.equal(fullProfile.scene.persistentLabelCount, 0);
    assert.equal(fullProfile.controls.mapRoutes, 3);
    assert.equal(fullProfile.controls.mapMarkers, 4);
    assert.equal(fullProfile.controls.roadSegments, 6);
    assert.equal(fullProfile.scene.zoneAlignment.length, 4);
    assert.ok(fullProfile.scene.maximumZoneAnchorError <= 28, JSON.stringify(fullProfile.scene.zoneAlignment));
    assert.equal(fullProfile.scene.buildingBounds.length, 4);
    assert.ok(fullProfile.scene.minimumBuildingHeaderGap >= 8, JSON.stringify(fullProfile.scene.buildingBounds));
    assert.equal(fullProfile.scene.buildingBounds.every(entry => entry.insideScene), true, JSON.stringify(fullProfile.scene.buildingBounds));
    assert.deepEqual(fullProfile.scene.mapAnchors.map(anchor => anchor.station), ['purchase', 'workforce', 'assembly', 'market']);
    assert.equal(fullProfile.scene.sequenceLayoutOk, true);
    assert.equal(mapFirstLayouts.length, MAP_FIRST_VIEWPORTS.length);
    assert.deepEqual(fullProfile.controls.buildingTypes, ['purchase', 'workforce', 'assembly', 'market']);
    assert.notEqual(fullProfile.scene.backgroundImage, 'none');
    assert.equal(standardProfile.mode, 'standard');
    assert.equal(standardProfile.scene.presentation, 'isometric-map');
    assert.notEqual(standardProfile.scene.backgroundImage, 'none');
    assert.equal(liteProfile.mode, 'lite');
    assert.equal(liteProfile.animationMode, 'off');
    assert.equal(liteProfile.scene.presentation, 'isometric-map');
    assert.equal(liteProfile.scene.backgroundImage, 'none');
    assert.deepEqual(liteProfile.scene.motionArtifacts.map(artifact => artifact.animationName), ['none', 'none']);
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
    assert.equal(await evaluate(studentBrowser.cdp, 'document.querySelector("#tutorial-overlay")?.classList.contains("hidden")'), true);
    assert.equal(await evaluate(studentBrowser.cdp, 'Object.entries(localStorage).some(([key, value]) => key.startsWith("bizArenaFirstTurnTutorial:") && value === "skipped")'), true);
    await evaluate(studentBrowser.cdp, 'startTutorial()');
    await waitFor(studentBrowser.cdp, 'document.querySelector("#tutorial-overlay")?.dataset.firstTurnStep === "workforce"', 'student tutorial manual replay');
    if (await evaluate(studentBrowser.cdp, 'document.querySelector("#tutorial-overlay")?.dataset.firstTurnTargetMode === "navigation"')) {
      await evaluate(studentBrowser.cdp, 'document.querySelector("#tutorial-next-button")?.click()');
    }
    await waitFor(studentBrowser.cdp, 'document.querySelector("#tutorial-overlay")?.dataset.firstTurnTargetMode === "action"', 'student tutorial real action target');
    await evaluate(studentBrowser.cdp, 'document.querySelector("[data-first-turn-target=workforce]")?.click()');
    await waitFor(studentBrowser.cdp, 'document.querySelector("#tutorial-overlay")?.dataset.firstTurnStep === "assembly"', 'student tutorial follows server progress');
    assert.equal(await evaluate(studentBrowser.cdp, 'state.player?.turnGuide?.primaryKey'), 'assembly');
    const workforceStationCopy = await evaluate(studentBrowser.cdp, 'document.querySelector("[data-scene-station=workforce]")?.getAttribute("aria-label") || ""');
    assert.match(workforceStationCopy, /1 сотрудник\./);
    assert.doesNotMatch(workforceStationCopy, /1 сотрудников/);
    await evaluate(studentBrowser.cdp, 'document.querySelector("#tutorial-skip-button")?.click()');
    assert.equal(
      await evaluate(studentBrowser.cdp, 'localizedWorkerHint("Stable hire with manageable salary expectations.")'),
      'Надёжный кандидат с умеренными ожиданиями по зарплате.',
    );
    await evaluate(studentBrowser.cdp, 'document.querySelector("[data-scene-station=workforce]")?.click()');
    await waitFor(studentBrowser.cdp, 'document.querySelector("[data-factory-department-detail]")?.dataset.factoryDepartmentDetail === "workforce"', 'student workforce pluralization dialog');
    assert.equal(await evaluate(studentBrowser.cdp, 'document.querySelector(".factory-detail-badge")?.textContent.trim()'), '1 активный работник');
    await evaluate(studentBrowser.cdp, 'dismissStudentWorkspace({ fromHistory: true })');
    await evaluate(studentBrowser.cdp, 'document.querySelector("[data-scene-station=assembly]")?.click()');
    await waitFor(studentBrowser.cdp, 'document.querySelector("[data-factory-department-detail]")?.dataset.factoryDepartmentDetail === "assembly"', 'student assembly pluralization dialog');
    assert.equal(await evaluate(studentBrowser.cdp, 'document.querySelector(".factory-detail-badge")?.textContent.trim()'), '2 единицы мощности');
    await evaluate(studentBrowser.cdp, 'dismissStudentWorkspace({ fromHistory: true })');
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
    await evaluate(studentBrowser.cdp, '(async () => { await refreshState(); return state.room?.status || ""; })()');
    await waitFor(studentBrowser.cdp, 'state.room?.status === "paused"', 'student paused timer state');
    assert.equal(await evaluate(studentBrowser.cdp, 'document.querySelector("#game-turn-timer")?.textContent.trim()'), 'Пауза');
    assert.equal(await evaluate(studentBrowser.cdp, 'document.querySelector("#game-turn-limit")?.textContent.trim()'), 'Ход на паузе');

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
    assert.deepEqual(browserErrors(directoryBrowser.cdp), []);
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
      studentInteractiveTutorial: true,
      studentReconnect: true,
      studentResultsRole: true,
      studentResultsExport: true,
      studentLite: true,
      studentDirectory: true,
      browserErrors: 0,
    }, null, 2));
  } finally {
    teacherBrowser?.cdp.close(); studentBrowser?.cdp.close(); directoryBrowser?.cdp.close();
    stop(teacherBrowser?.process, teacherProfile);
    stop(studentBrowser?.process, studentProfile);
    stop(directoryBrowser?.process, directoryProfile);
    stop(server);
    await sleep(250);
    remove(teacherProfile); remove(studentProfile); remove(directoryProfile); remove(dataDir);
  }
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
