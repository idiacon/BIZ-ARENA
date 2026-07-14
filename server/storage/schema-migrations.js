const SCHEMA_ERROR_CODES = Object.freeze({
  invalid: 'BIZ_ARENA_INVALID_SCHEMA',
  unsupported: 'BIZ_ARENA_UNSUPPORTED_SCHEMA',
  missingMigration: 'BIZ_ARENA_MISSING_MIGRATION',
});

function schemaError(code, message, details = {}) {
  return Object.assign(new Error(message), { code, ...details });
}

function readSchemaVersion(value, schemaName) {
  if (!Object.hasOwn(value, 'schemaVersion')) return 1;
  const version = value.schemaVersion;
  if (!Number.isInteger(version) || version < 1) {
    throw schemaError(
      SCHEMA_ERROR_CODES.invalid,
      `${schemaName} schemaVersion must be a positive integer`,
      { schemaName, schemaVersion: version }
    );
  }
  return version;
}

function createMigrationRegistry({ schemaName, currentVersion, migrations }) {
  if (!schemaName || !Number.isInteger(currentVersion) || currentVersion < 1) {
    throw new TypeError('Migration registry requires a schema name and positive currentVersion');
  }

  const steps = new Map(
    Object.entries(migrations || {}).map(([version, migrate]) => [Number(version), migrate])
  );

  function migrate(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new TypeError(`${schemaName} migration input must be an object`);
    }

    const fromVersion = readSchemaVersion(input, schemaName);
    if (fromVersion > currentVersion) {
      throw schemaError(
        SCHEMA_ERROR_CODES.unsupported,
        `${schemaName} schema ${fromVersion} is newer than supported schema ${currentVersion}`,
        { schemaName, schemaVersion: fromVersion, currentVersion }
      );
    }

    let value = { ...input, schemaVersion: fromVersion };
    const appliedVersions = [];
    for (let version = fromVersion; version < currentVersion; version += 1) {
      const step = steps.get(version);
      if (typeof step !== 'function') {
        throw schemaError(
          SCHEMA_ERROR_CODES.missingMigration,
          `${schemaName} migration ${version} -> ${version + 1} is missing`,
          { schemaName, schemaVersion: version, currentVersion }
        );
      }

      const next = step(value);
      if (!next || typeof next !== 'object' || Array.isArray(next) || next.schemaVersion !== version + 1) {
        throw schemaError(
          SCHEMA_ERROR_CODES.invalid,
          `${schemaName} migration ${version} -> ${version + 1} returned an invalid schema`,
          { schemaName, schemaVersion: version, currentVersion }
        );
      }
      value = next;
      appliedVersions.push(version + 1);
    }

    return Object.freeze({
      value,
      fromVersion,
      toVersion: currentVersion,
      appliedVersions: Object.freeze(appliedVersions),
    });
  }

  return Object.freeze({ schemaName, currentVersion, migrate });
}

function isSchemaMigrationError(error) {
  return Object.values(SCHEMA_ERROR_CODES).includes(error?.code);
}

module.exports = {
  SCHEMA_ERROR_CODES,
  createMigrationRegistry,
  isSchemaMigrationError,
};
