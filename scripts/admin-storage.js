const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function resolveSqlitePath(env = process.env) {
  if (env.BIZ_ARENA_SQLITE_PATH) return path.resolve(env.BIZ_ARENA_SQLITE_PATH);
  const dataDir = env.BIZ_ARENA_DATA_DIR ? path.resolve(env.BIZ_ARENA_DATA_DIR) : path.resolve(__dirname, '..', 'data');
  return path.join(dataDir, 'biz-arena.sqlite');
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function inspectSqlite(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`SQLite file not found: ${filePath}`);
  const sqlite = new Database(filePath, { readonly: true, fileMustExist: true });
  try {
    const integrity = sqlite.pragma('integrity_check', { simple: true });
    if (integrity !== 'ok') throw new Error(`SQLite integrity check failed: ${integrity}`);
    const row = sqlite.prepare('SELECT schema_version, payload, updated_at FROM runtime_state WHERE id = ?').get('main');
    if (!row) throw new Error('SQLite runtime_state/main row is missing.');
    const payload = JSON.parse(row.payload);
    return {
      path: filePath,
      bytes: fs.statSync(filePath).size,
      schemaVersion: Number(row.schema_version || payload.schemaVersion || 0),
      updatedAt: row.updated_at || null,
      teacherAccounts: Object.keys(payload.teacherAccounts || {}).length,
      activeRooms: Object.keys(payload.activeRooms || {}).length,
      savedRooms: Object.keys(payload.savedRooms || {}).length,
      integrity,
    };
  } finally {
    sqlite.close();
  }
}

async function createBackup(sourcePath = resolveSqlitePath(), destinationPath = '') {
  const source = path.resolve(sourcePath);
  inspectSqlite(source);
  const destination = destinationPath
    ? path.resolve(destinationPath)
    : path.join(path.dirname(source), 'backups', `biz-arena-${timestamp()}.sqlite`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (fs.existsSync(destination)) throw new Error(`Backup destination already exists: ${destination}`);
  const sqlite = new Database(source, { readonly: true, fileMustExist: true });
  try {
    await sqlite.backup(destination);
  } finally {
    sqlite.close();
  }
  return inspectSqlite(destination);
}

function restoreBackup(backupPath, targetPath = resolveSqlitePath(), { force = false } = {}) {
  if (!force) throw new Error('Restore requires --force and a stopped Biz Arena service.');
  const backup = path.resolve(backupPath || '');
  const target = path.resolve(targetPath);
  const backupInfo = inspectSqlite(backup);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.restore-${process.pid}.tmp`;
  const previous = fs.existsSync(target) ? `${target}.before-restore-${timestamp()}` : '';
  fs.copyFileSync(backup, temporary);
  inspectSqlite(temporary);
  if (previous) fs.renameSync(target, previous);
  try {
    fs.renameSync(temporary, target);
  } catch (error) {
    if (previous && !fs.existsSync(target)) fs.renameSync(previous, target);
    throw error;
  }
  return { restored: inspectSqlite(target), previous };
}

function parseArgs(argv) {
  const [command = 'status', ...rest] = argv;
  const values = rest.filter(value => !value.startsWith('--'));
  return { command, values, force: rest.includes('--force') };
}

async function main(argv = process.argv.slice(2)) {
  const { command, values, force } = parseArgs(argv);
  const target = resolveSqlitePath();
  let result;
  if (command === 'status') result = inspectSqlite(values[0] ? path.resolve(values[0]) : target);
  else if (command === 'backup') result = await createBackup(target, values[0] || '');
  else if (command === 'restore') result = restoreBackup(values[0], target, { force });
  else throw new Error('Usage: admin-storage.js status [file] | backup [destination] | restore <backup> --force');
  console.log(JSON.stringify({ ok: true, command, result }, null, 2));
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message || error);
    process.exit(1);
  });
}

module.exports = { resolveSqlitePath, inspectSqlite, createBackup, restoreBackup };
