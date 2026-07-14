const { spawnSync } = require('child_process');
const path = require('path');

const rootDir = path.join(__dirname, '..');

const mode = String(process.argv[2] || '').toLowerCase();
if (!['server', 'client'].includes(mode)) {
  console.error('Usage: node scripts/build-desktop-mode.js <server|client>');
  process.exit(1);
}

const isServer = mode === 'server';
const productName = isServer ? 'BizArena Server' : 'BizArena Client';
const artifactPrefix = isServer ? 'BizArena-Server' : 'BizArena-Client';
const appId = isServer ? 'com.bizarena.server' : 'com.bizarena.client';
const electronVersion = require(path.join(rootDir, 'node_modules', 'electron', 'package.json')).version;

const electronBuilderCli = path.join(
  rootDir,
  'node_modules',
  'electron-builder',
  'out',
  'cli',
  'cli.js'
);

const electronRebuildCli = path.join(
  rootDir,
  'node_modules',
  '@electron',
  'rebuild',
  'lib',
  'cli.js'
);

const rebuildResult = spawnSync(process.execPath, [
  electronRebuildCli,
  '--version',
  electronVersion,
  '--module-dir',
  rootDir,
  '--which-module',
  'better-sqlite3',
  '--force',
  '--arch',
  process.arch,
], {
  cwd: rootDir,
  env: process.env,
  stdio: 'inherit',
  shell: false,
});

if (rebuildResult.error) {
  console.error(rebuildResult.error);
  process.exit(1);
}

if (typeof rebuildResult.status !== 'number' || rebuildResult.status !== 0) {
  process.exit(typeof rebuildResult.status === 'number' ? rebuildResult.status : 1);
}

const args = [
  electronBuilderCli,
  '--win',
  'nsis',
  'portable',
  '--config.npmRebuild=false',
  '--config.win.signExecutable=false',
  `--config.productName=${productName}`,
  `--config.appId=${appId}`,
  `--config.extraMetadata.name=${artifactPrefix.toLowerCase()}`,
  `--config.nsis.artifactName=${artifactPrefix}-\${version}-Setup-\${arch}.\${ext}`,
  `--config.nsis.shortcutName=${productName}`,
  `--config.portable.artifactName=${artifactPrefix}-\${version}-Portable-\${arch}.\${ext}`,
];

const result = spawnSync(process.execPath, args, {
  cwd: rootDir,
  env: {
    ...process.env,
    BIZ_ARENA_DESKTOP_MODE: mode,
  },
  stdio: 'inherit',
  shell: false,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(typeof result.status === 'number' ? result.status : 1);
