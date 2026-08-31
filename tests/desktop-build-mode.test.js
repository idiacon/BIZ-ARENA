const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { runDesktopBuild } = require('../scripts/build-desktop-mode');

function buildHarness(overrides = {}) {
  const calls = [];
  const copied = [];
  const errors = [];
  let spawnIndex = 0;
  const statuses = overrides.statuses || [0, 0, 0];
  const stagingDir = 'C:\\temp\\biz-arena-server-build-test';
  const requiredFiles = [
    'BizArena-Server-1.0.0-beta.1-Setup-x64.exe',
    'BizArena-Server-1.0.0-beta.1-Setup-x64.exe.blockmap',
    'BizArena-Server-1.0.0-beta.1-Portable-x64.exe',
  ];
  const fsApi = {
    mkdtempSync(prefix) {
      calls.push(['mkdtemp', prefix]);
      if (overrides.stagingError) throw overrides.stagingError;
      return stagingDir;
    },
    mkdirSync(target) {
      calls.push(['mkdir', target]);
    },
    readdirSync(target) {
      calls.push(['readdir', target]);
      return overrides.releaseFiles || requiredFiles;
    },
    copyFileSync(source, target) {
      calls.push(['copy', source, target]);
      if (overrides.copyError) throw overrides.copyError;
      copied.push(path.basename(target));
    },
    rmSync(target) {
      calls.push(['cleanup', target]);
      if (overrides.cleanupError) throw overrides.cleanupError;
    },
  };
  const spawn = (executable, args) => {
    calls.push(['spawn', executable, args]);
    const index = spawnIndex++;
    if (overrides.spawnErrors?.[index]) return { status: null, error: overrides.spawnErrors[index] };
    return { status: statuses[index] ?? 0 };
  };

  const exitCode = runDesktopBuild('server', {
    fsApi,
    osApi: { tmpdir: () => 'C:\\temp' },
    spawn,
    rootDir: 'D:\\repo',
    nodeExecutable: 'node.exe',
    runtimeArch: 'x64',
    runtimePlatform: 'win32',
    runtimeEnv: { ComSpec: 'cmd.exe' },
    comspec: 'cmd.exe',
    packageVersion: '1.0.0-beta.1',
    electronVersion: '42.5.2',
    logger: { error: value => errors.push(String(value)) },
  });

  return { calls, copied, errors, exitCode };
}

function spawnCalls(harness) {
  return harness.calls.filter(([type]) => type === 'spawn');
}

test('desktop build stages artifacts, copies both executables, cleans up, and restores Node ABI', () => {
  const harness = buildHarness();

  assert.equal(harness.exitCode, 0);
  assert.deepEqual(harness.copied.sort(), [
    'BizArena-Server-1.0.0-beta.1-Portable-x64.exe',
    'BizArena-Server-1.0.0-beta.1-Setup-x64.exe',
    'BizArena-Server-1.0.0-beta.1-Setup-x64.exe.blockmap',
  ]);
  assert.equal(harness.calls.some(([type]) => type === 'cleanup'), true);
  assert.equal(spawnCalls(harness).length, 3);
  assert.match(spawnCalls(harness)[2][2].join(' '), /rebuild better-sqlite3/);
});

test('desktop build restores Node ABI after staging creation fails', () => {
  const harness = buildHarness({ stagingError: new Error('staging failed') });

  assert.equal(harness.exitCode, 1);
  assert.equal(spawnCalls(harness).length, 2);
  assert.match(spawnCalls(harness)[1][2].join(' '), /rebuild better-sqlite3/);
});

test('desktop build restores Node ABI after Electron rebuild fails', () => {
  const harness = buildHarness({ statuses: [6, 0] });

  assert.equal(harness.exitCode, 6);
  assert.equal(spawnCalls(harness).length, 2);
  assert.match(spawnCalls(harness)[1][2].join(' '), /rebuild better-sqlite3/);
});

test('desktop build restores Node ABI after packaging fails', () => {
  const harness = buildHarness({ statuses: [0, 7, 0] });

  assert.equal(harness.exitCode, 7);
  assert.equal(harness.calls.some(([type]) => type === 'cleanup'), true);
  assert.match(spawnCalls(harness)[2][2].join(' '), /rebuild better-sqlite3/);
});

test('desktop build fails closed when an expected executable is missing', () => {
  const harness = buildHarness({
    releaseFiles: ['BizArena-Server-1.0.0-beta.1-Setup-x64.exe'],
  });

  assert.equal(harness.exitCode, 1);
  assert.match(harness.errors.join('\n'), /Missing desktop artifact/);
  assert.equal(spawnCalls(harness).length, 3);
});

test('desktop build fails closed after an artifact copy error', () => {
  const harness = buildHarness({ copyError: new Error('copy failed') });

  assert.equal(harness.exitCode, 1);
  assert.equal(spawnCalls(harness).length, 3);
  assert.equal(harness.calls.some(([type]) => type === 'cleanup'), true);
});

test('desktop build reports cleanup failure even when packaging succeeded', () => {
  const harness = buildHarness({ cleanupError: new Error('cleanup locked') });

  assert.equal(harness.exitCode, 1);
  assert.match(harness.errors.join('\n'), /Could not remove desktop staging directory/);
  assert.equal(spawnCalls(harness).length, 3);
});

test('desktop build reports Node ABI restoration failure', () => {
  const harness = buildHarness({ statuses: [0, 0, 9] });

  assert.equal(harness.exitCode, 1);
  assert.match(harness.errors.join('\n'), /Node native rebuild failed/);
});
