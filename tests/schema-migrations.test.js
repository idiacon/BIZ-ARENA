const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createMigrationRegistry,
  isSchemaMigrationError,
} = require('../server/storage/schema-migrations');

test('migration registry applies every version exactly once without mutating input', () => {
  const input = { marker: 'legacy' };
  const registry = createMigrationRegistry({
    schemaName: 'test payload',
    currentVersion: 3,
    migrations: {
      1: value => ({ ...value, schemaVersion: 2, second: true }),
      2: value => ({ ...value, schemaVersion: 3, third: true }),
    },
  });

  const result = registry.migrate(input);

  assert.deepEqual(result.value, {
    marker: 'legacy',
    schemaVersion: 3,
    second: true,
    third: true,
  });
  assert.equal(result.fromVersion, 1);
  assert.equal(result.toVersion, 3);
  assert.deepEqual(result.appliedVersions, [2, 3]);
  assert.deepEqual(input, { marker: 'legacy' });
});

test('migration registry rejects future and malformed explicit versions', () => {
  const registry = createMigrationRegistry({
    schemaName: 'test payload',
    currentVersion: 3,
    migrations: {},
  });

  assert.throws(
    () => registry.migrate({ schemaVersion: 4 }),
    error => error.code === 'BIZ_ARENA_UNSUPPORTED_SCHEMA' && isSchemaMigrationError(error)
  );
  assert.throws(
    () => registry.migrate({ schemaVersion: '3' }),
    error => error.code === 'BIZ_ARENA_INVALID_SCHEMA' && isSchemaMigrationError(error)
  );
});

test('migration registry rejects missing or invalid migration steps', () => {
  const missing = createMigrationRegistry({
    schemaName: 'missing test',
    currentVersion: 2,
    migrations: {},
  });
  const invalid = createMigrationRegistry({
    schemaName: 'invalid test',
    currentVersion: 2,
    migrations: { 1: value => ({ ...value, schemaVersion: 1 }) },
  });

  assert.throws(
    () => missing.migrate({}),
    error => error.code === 'BIZ_ARENA_MISSING_MIGRATION'
  );
  assert.throws(
    () => invalid.migrate({}),
    error => error.code === 'BIZ_ARENA_INVALID_SCHEMA'
  );
});
