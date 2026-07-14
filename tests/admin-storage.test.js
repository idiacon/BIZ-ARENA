const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createRuntimeStorage } = require('../server/storage/runtime-storage');
const { createBackup, inspectSqlite, restoreBackup } = require('../scripts/admin-storage');

function emptyDb(marker = '') {
  return {
    schemaVersion: 3,
    accounts: {},
    teacherAccounts: marker ? { teacher: { id: marker } } : {},
    teacherSessions: {},
    activeRooms: marker ? { ABCDE: { code: 'ABCDE', marker } } : {},
    savedRooms: {},
  };
}

test('admin storage creates a valid SQLite backup and restores it atomically', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'biz-arena-admin-storage-'));
  const sqlitePath = path.join(dir, 'runtime.sqlite');
  const backupPath = path.join(dir, 'backup.sqlite');
  const storage = createRuntimeStorage({
    backend: 'sqlite',
    deploymentMode: 'cloud',
    dataDir: dir,
    sqlitePath,
    durablePathConfigured: true,
    createEmptyDb: emptyDb,
    normalizeDb: value => value,
  });

  try {
    storage.persist(emptyDb('before'));
    const backup = await createBackup(sqlitePath, backupPath);
    assert.equal(backup.activeRooms, 1);
    assert.equal(backup.teacherAccounts, 1);

    storage.persist(emptyDb('after'));
    assert.equal(storage.load().activeRooms.ABCDE.marker, 'after');

    const restored = restoreBackup(backupPath, sqlitePath, { force: true });
    assert.ok(restored.previous);
    assert.equal(inspectSqlite(sqlitePath).integrity, 'ok');
    const restoredStorage = createRuntimeStorage({
      backend: 'sqlite', deploymentMode: 'cloud', dataDir: dir, sqlitePath,
      durablePathConfigured: true, createEmptyDb: emptyDb, normalizeDb: value => value,
    });
    assert.equal(restoredStorage.load().activeRooms.ABCDE.marker, 'before');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
