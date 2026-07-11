const fs = require('fs');
const path = require('path');

function createRuntimeStorage({
  backend = 'json',
  deploymentMode = 'local',
  dataDir,
  jsonPath,
  sqlitePath,
  durablePathConfigured = false,
  createEmptyDb,
  normalizeDb,
  loadSqliteDriver = () => require('better-sqlite3'),
}) {
  if (typeof createEmptyDb !== 'function' || typeof normalizeDb !== 'function') {
    throw new TypeError('Runtime storage requires createEmptyDb and normalizeDb functions');
  }

  let lastRecovery = null;

  function atomicWriteJson(filePath, payload, { backupPath = `${filePath}.bak`, tempPath = `${filePath}.tmp` } = {}) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), 'utf8');
    if (fs.existsSync(filePath)) {
      if (backupPath) fs.copyFileSync(filePath, backupPath);
      fs.unlinkSync(filePath);
    }
    fs.renameSync(tempPath, filePath);
  }

  function readJsonWithRecovery(filePath, {
    backupPath = `${filePath}.bak`,
    transform = value => value,
  } = {}) {
    const candidates = [
      { path: filePath, recoveredFromBackup: false },
      { path: backupPath, recoveredFromBackup: true },
    ];
    let lastError = null;
    for (const candidate of candidates) {
      if (!fs.existsSync(candidate.path)) continue;
      try {
        const raw = JSON.parse(fs.readFileSync(candidate.path, 'utf8'));
        return {
          raw,
          value: transform(raw),
          recoveredFromBackup: candidate.recoveredFromBackup,
        };
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError) throw lastError;
    return null;
  }

  function loadDbFromDisk(filePath = jsonPath) {
    lastRecovery = null;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const loaded = readJsonWithRecovery(filePath, {
      backupPath: `${filePath}.bak`,
      transform: normalizeDb,
    });
    if (!loaded) {
      const initial = createEmptyDb();
      atomicWriteJson(filePath, initial);
      return initial;
    }
    const normalized = loaded.value;
    if (loaded.recoveredFromBackup) {
      atomicWriteJson(filePath, normalized, { backupPath: null });
      lastRecovery = {
        source: 'backup',
        recoveredAt: new Date().toISOString(),
      };
    }
    return normalized;
  }

  function persistDbToDisk(db, filePath = jsonPath) {
    const normalized = normalizeDb(db);
    atomicWriteJson(filePath, normalized);
    return normalized;
  }

  function openRuntimeSqlite(filePath = sqlitePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const Database = loadSqliteDriver();
    const db = new Database(filePath);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS runtime_state (
        id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    return db;
  }

  function upsertSqliteState(sqlite, id, db, updatedAt = new Date().toISOString()) {
    sqlite.prepare(`
      INSERT INTO runtime_state (id, schema_version, payload, updated_at)
      VALUES (@id, @schemaVersion, @payload, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        schema_version = excluded.schema_version,
        payload = excluded.payload,
        updated_at = excluded.updated_at
    `).run({
      id,
      schemaVersion: db.schemaVersion,
      payload: JSON.stringify(db),
      updatedAt,
    });
  }

  function parseSqliteStateRow(row) {
    if (!row) return null;
    return normalizeDb(JSON.parse(row.payload));
  }

  function loadDbFromSqlite(filePath = sqlitePath) {
    lastRecovery = null;
    let sqlite = null;
    try {
      sqlite = openRuntimeSqlite(filePath);
      const selectState = sqlite.prepare('SELECT schema_version, payload, updated_at FROM runtime_state WHERE id = ?');
      const failures = [];

      for (const id of ['main', 'previous']) {
        const row = selectState.get(id);
        if (!row) continue;
        try {
          const normalized = parseSqliteStateRow(row);
          if (id === 'previous') {
            upsertSqliteState(sqlite, 'main', normalized);
            lastRecovery = {
              source: 'previous',
              recoveredAt: new Date().toISOString(),
              previousUpdatedAt: row.updated_at || null,
            };
          }
          return normalized;
        } catch (error) {
          failures.push(`${id}: ${error.message}`);
        }
      }

      if (failures.length > 0) {
        const error = new Error(`No valid SQLite runtime state. ${failures.join('; ')}`);
        error.code = 'BIZ_ARENA_STORAGE_RECOVERY_FAILED';
        throw error;
      }

      const initial = createEmptyDb();
      upsertSqliteState(sqlite, 'main', initial);
      return initial;
    } finally {
      if (sqlite) sqlite.close();
    }
  }

  function persistDbToSqlite(db, filePath = sqlitePath) {
    const normalized = normalizeDb(db);
    let sqlite = null;
    try {
      sqlite = openRuntimeSqlite(filePath);
      const currentRow = sqlite.prepare('SELECT schema_version, payload, updated_at FROM runtime_state WHERE id = ?').get('main');
      let validCurrent = null;
      if (currentRow) {
        try {
          validCurrent = parseSqliteStateRow(currentRow);
        } catch (_error) {
          validCurrent = null;
        }
      }

      const persistTransaction = sqlite.transaction(() => {
        if (validCurrent) {
          upsertSqliteState(sqlite, 'previous', validCurrent, currentRow.updated_at || new Date().toISOString());
        }
        upsertSqliteState(sqlite, 'main', normalized);
      });
      persistTransaction();
      return normalized;
    } finally {
      if (sqlite) sqlite.close();
    }
  }

  function info() {
    const activePath = backend === 'sqlite' ? sqlitePath : jsonPath;
    return {
      backend,
      dataDir,
      path: activePath,
      durable: Boolean(durablePathConfigured),
      recovery: lastRecovery ? { ...lastRecovery } : null,
      warning: deploymentMode === 'cloud' && !durablePathConfigured
        ? 'Cloud demo is using local filesystem storage. Render Free can lose local files on restart, redeploy, or spin-down.'
        : '',
    };
  }

  return {
    load: () => (backend === 'sqlite' ? loadDbFromSqlite(sqlitePath) : loadDbFromDisk(jsonPath)),
    persist: db => (backend === 'sqlite' ? persistDbToSqlite(db, sqlitePath) : persistDbToDisk(db, jsonPath)),
    info,
    atomicWriteJson,
    readJsonWithRecovery,
    loadDbFromDisk,
    persistDbToDisk,
    loadDbFromSqlite,
    persistDbToSqlite,
  };
}

module.exports = { createRuntimeStorage };
