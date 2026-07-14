const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const Database = require('better-sqlite3');

const { createRuntimeStorage } = require('../server/storage/runtime-storage');
const { createMigrationRegistry } = require('../server/storage/schema-migrations');

function createHarness(backend = 'json', normalizeOverride = null) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biz-arena-storage-module-'));
  const createEmptyDb = () => ({ schemaVersion: 3, accounts: {}, teacherAccounts: {}, teacherSessions: {}, activeRooms: {}, savedRooms: {} });
  const normalizeDb = normalizeOverride || (raw => ({ ...createEmptyDb(), ...raw, schemaVersion: 3 }));
  const storage = createRuntimeStorage({
    backend,
    deploymentMode: 'cloud',
    dataDir,
    jsonPath: path.join(dataDir, 'runtime.json'),
    sqlitePath: path.join(dataDir, 'runtime.sqlite'),
    durablePathConfigured: true,
    createEmptyDb,
    normalizeDb,
  });
  return { dataDir, storage };
}

test('runtime storage keeps JSON recovery behind one interface', () => {
  const { dataDir, storage } = createHarness('json');
  try {
    storage.persist({ schemaVersion: 3, accounts: { teacher: { gamesPlayed: 1 } } });
    storage.persist({ schemaVersion: 3, accounts: { teacher: { gamesPlayed: 2 } } });
    fs.writeFileSync(storage.info().path, '{broken', 'utf8');

    const recovered = storage.load();
    assert.equal(recovered.accounts.teacher.gamesPlayed, 1);
    assert.equal(storage.info().backend, 'json');
    assert.equal(storage.info().warning, '');
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('runtime storage recovers semantically unsupported JSON main payload from backup', () => {
  const registry = createMigrationRegistry({
    schemaName: 'runtime database',
    currentVersion: 3,
    migrations: {
      1: value => ({ ...value, schemaVersion: 2 }),
      2: value => ({ ...value, schemaVersion: 3 }),
    },
  });
  const normalizeDb = raw => registry.migrate(raw).value;
  const { dataDir, storage } = createHarness('json', normalizeDb);
  try {
    const filePath = storage.info().path;
    fs.writeFileSync(filePath, JSON.stringify({ schemaVersion: 4, accounts: { future: true } }), 'utf8');
    fs.writeFileSync(`${filePath}.bak`, JSON.stringify({ schemaVersion: 3, accounts: { restored: true } }), 'utf8');

    const recovered = storage.load();
    assert.equal(recovered.accounts.restored, true);
    assert.equal(storage.info().recovery.source, 'backup');
    assert.equal(JSON.parse(fs.readFileSync(filePath, 'utf8')).accounts.restored, true);
    assert.equal(JSON.parse(fs.readFileSync(`${filePath}.bak`, 'utf8')).accounts.restored, true);
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('runtime storage persists SQLite through the same interface', () => {
  const { dataDir, storage } = createHarness('sqlite');
  try {
    storage.persist({ schemaVersion: 3, activeRooms: { ABCDE: { code: 'ABCDE' } } });
    assert.equal(storage.load().activeRooms.ABCDE.code, 'ABCDE');
    assert.equal(storage.info().backend, 'sqlite');
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('runtime storage recovers corrupt SQLite main payload from previous state and repairs main', () => {
  const { dataDir, storage } = createHarness('sqlite');
  try {
    storage.persist({ schemaVersion: 3, accounts: { teacher: { gamesPlayed: 1 } } });
    storage.persist({ schemaVersion: 3, accounts: { teacher: { gamesPlayed: 2 } } });

    const sqlite = new Database(storage.info().path);
    try {
      sqlite.prepare('UPDATE runtime_state SET payload = ? WHERE id = ?').run('{broken', 'main');
    } finally {
      sqlite.close();
    }

    const recovered = storage.load();
    assert.equal(recovered.accounts.teacher.gamesPlayed, 1);
    assert.equal(storage.info().recovery.source, 'previous');

    const repaired = storage.load();
    assert.equal(repaired.accounts.teacher.gamesPlayed, 1);
    assert.equal(storage.info().recovery, null);
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('runtime storage recovers unsupported future SQLite main payload from previous state', () => {
  const registry = createMigrationRegistry({
    schemaName: 'runtime database',
    currentVersion: 3,
    migrations: {
      1: value => ({ ...value, schemaVersion: 2 }),
      2: value => ({ ...value, schemaVersion: 3 }),
    },
  });
  const normalizeDb = raw => registry.migrate(raw).value;
  const { dataDir, storage } = createHarness('sqlite', normalizeDb);
  try {
    storage.persist({ schemaVersion: 3, accounts: { teacher: { gamesPlayed: 1 } } });
    storage.persist({ schemaVersion: 3, accounts: { teacher: { gamesPlayed: 2 } } });

    const sqlite = new Database(storage.info().path);
    try {
      sqlite.prepare('UPDATE runtime_state SET payload = ? WHERE id = ?').run(
        JSON.stringify({ schemaVersion: 4, accounts: { teacher: { gamesPlayed: 99 } } }),
        'main'
      );
    } finally {
      sqlite.close();
    }

    const recovered = storage.load();
    assert.equal(recovered.accounts.teacher.gamesPlayed, 1);
    assert.equal(storage.info().recovery.source, 'previous');

    const repaired = storage.load();
    assert.equal(repaired.accounts.teacher.gamesPlayed, 1);
    assert.equal(storage.info().recovery, null);
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('runtime storage fails closed when SQLite has no valid runtime payload', () => {
  const { dataDir, storage } = createHarness('sqlite');
  try {
    storage.persist({ schemaVersion: 3, accounts: { teacher: { gamesPlayed: 1 } } });

    const sqlite = new Database(storage.info().path);
    try {
      sqlite.prepare('UPDATE runtime_state SET payload = ? WHERE id = ?').run('{broken', 'main');
    } finally {
      sqlite.close();
    }

    assert.throws(() => storage.load(), /No valid SQLite runtime state/);
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('server startup fails before listen when SQLite recovery is exhausted', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biz-arena-storage-startup-'));
  const sqlitePath = path.join(dataDir, 'runtime.sqlite');
  try {
    const sqlite = new Database(sqlitePath);
    try {
      sqlite.exec(`
        CREATE TABLE runtime_state (
          id TEXT PRIMARY KEY,
          schema_version INTEGER NOT NULL,
          payload TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
      sqlite.prepare(`
        INSERT INTO runtime_state (id, schema_version, payload, updated_at)
        VALUES (?, ?, ?, ?)
      `).run('main', 3, '{broken', new Date().toISOString());
    } finally {
      sqlite.close();
    }

    const result = spawnSync(process.execPath, ['server.js'], {
      cwd: path.resolve(__dirname, '..'),
      env: {
        ...process.env,
        BIZ_ARENA_DEPLOYMENT: 'cloud',
        BIZ_ARENA_STORAGE: 'sqlite',
        BIZ_ARENA_DATA_DIR: dataDir,
        BIZ_ARENA_SQLITE_PATH: sqlitePath,
        BIZ_ARENA_ALLOW_REGISTRATION: 'false',
        PORT: '0',
      },
      encoding: 'utf8',
      timeout: 5_000,
    });

    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.match(`${result.stdout}\n${result.stderr}`, /storage-load-failed/);

    const preserved = new Database(sqlitePath, { readonly: true });
    try {
      assert.equal(preserved.prepare('SELECT payload FROM runtime_state WHERE id = ?').get('main').payload, '{broken');
    } finally {
      preserved.close();
    }
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('server module restores an existing SQLite state during initialization', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biz-arena-storage-initialization-'));
  const sqlitePath = path.join(dataDir, 'runtime.sqlite');
  try {
    const sqlite = new Database(sqlitePath);
    try {
      sqlite.exec(`
        CREATE TABLE runtime_state (
          id TEXT PRIMARY KEY,
          schema_version INTEGER NOT NULL,
          payload TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
      sqlite.prepare(`
        INSERT INTO runtime_state (id, schema_version, payload, updated_at)
        VALUES (?, ?, ?, ?)
      `).run('main', 3, JSON.stringify({
        schemaVersion: 3,
        accounts: { restored: { userName: 'Restored User' } },
        teacherAccounts: {},
        teacherSessions: {},
        activeRooms: {},
        savedRooms: {},
      }), new Date().toISOString());
    } finally {
      sqlite.close();
    }

    const result = spawnSync(process.execPath, [
      '-e',
      "const app = require('./server'); process.stdout.write(app.state.db.accounts.restored.userName);",
    ], {
      cwd: path.resolve(__dirname, '..'),
      env: {
        ...process.env,
        BIZ_ARENA_DEPLOYMENT: 'cloud',
        BIZ_ARENA_STORAGE: 'sqlite',
        BIZ_ARENA_DATA_DIR: dataDir,
        BIZ_ARENA_SQLITE_PATH: sqlitePath,
        BIZ_ARENA_ALLOW_REGISTRATION: 'false',
      },
      encoding: 'utf8',
      timeout: 5_000,
    });

    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, 'Restored User');
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
