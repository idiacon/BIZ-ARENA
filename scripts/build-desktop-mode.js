const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');
const path = require('path');
const { npmCommandSpec } = require('./lib/npm-command');

const defaultRootDir = path.join(__dirname, '..');

function spawnChecked(spawn, executable, args, options, label) {
  const result = spawn(executable, args, options);
  if (result.error) {
    result.error.exitCode = 1;
    throw result.error;
  }
  if (typeof result.status !== 'number' || result.status !== 0) {
    const error = new Error(`${label} failed with exit code ${result.status ?? 'unknown'}`);
    error.exitCode = typeof result.status === 'number' ? result.status : 1;
    throw error;
  }
  return result;
}

function runDesktopBuild(mode, options = {}) {
  const normalizedMode = String(mode || '').toLowerCase();
  const logger = options.logger || console;
  if (!['server', 'client'].includes(normalizedMode)) {
    logger.error('Usage: node scripts/build-desktop-mode.js <server|client>');
    return 1;
  }

  const fsApi = options.fsApi || fs;
  const osApi = options.osApi || os;
  const spawn = options.spawn || spawnSync;
  const rootDir = options.rootDir || defaultRootDir;
  const nodeExecutable = options.nodeExecutable || process.execPath;
  const runtimeArch = options.runtimeArch || process.arch;
  const runtimePlatform = options.runtimePlatform || process.platform;
  const runtimeEnv = options.runtimeEnv || process.env;
  const comspec = options.comspec || runtimeEnv.ComSpec;
  const isServer = normalizedMode === 'server';
  const productName = isServer ? 'BizArena Server' : 'BizArena Client';
  const artifactPrefix = isServer ? 'BizArena-Server' : 'BizArena-Client';
  const appId = isServer ? 'com.bizarena.server' : 'com.bizarena.client';
  const distDir = path.join(rootDir, 'dist');

  let exitCode = 1;
  let stagingDir = null;
  let restoreRequired = false;

  try {
    const version = options.packageVersion
      || require(path.join(rootDir, 'package.json')).version;
    const electronVersion = options.electronVersion
      || require(path.join(rootDir, 'node_modules', 'electron', 'package.json')).version;
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

    restoreRequired = true;
    spawnChecked(spawn, nodeExecutable, [
      electronRebuildCli,
      '--version',
      electronVersion,
      '--module-dir',
      rootDir,
      '--which-module',
      'better-sqlite3',
      '--force',
      '--arch',
      runtimeArch,
    ], {
      cwd: rootDir,
      env: runtimeEnv,
      stdio: 'inherit',
      shell: false,
    }, 'Electron native rebuild');

    stagingDir = fsApi.mkdtempSync(path.join(osApi.tmpdir(), `biz-arena-${normalizedMode}-build-`));
    const builderArgs = [
      electronBuilderCli,
      '--win',
      'nsis',
      'portable',
      '--config.npmRebuild=false',
      '--config.win.signExecutable=false',
      `--config.directories.output=${stagingDir}`,
      `--config.productName=${productName}`,
      `--config.appId=${appId}`,
      `--config.extraMetadata.name=${artifactPrefix.toLowerCase()}`,
      `--config.nsis.artifactName=${artifactPrefix}-\${version}-Setup-\${arch}.\${ext}`,
      `--config.nsis.shortcutName=${productName}`,
      `--config.portable.artifactName=${artifactPrefix}-\${version}-Portable-\${arch}.\${ext}`,
    ];

    spawnChecked(spawn, nodeExecutable, builderArgs, {
      cwd: rootDir,
      env: {
        ...runtimeEnv,
        BIZ_ARENA_DESKTOP_MODE: normalizedMode,
      },
      stdio: 'inherit',
      shell: false,
    }, 'Electron packaging');

    fsApi.mkdirSync(distDir, { recursive: true });
    const requiredArtifacts = [
      `${artifactPrefix}-${version}-Setup-${runtimeArch}.exe`,
      `${artifactPrefix}-${version}-Portable-${runtimeArch}.exe`,
    ];
    const releaseFiles = fsApi.readdirSync(stagingDir)
      .filter(name => name.startsWith(`${artifactPrefix}-${version}-`));

    requiredArtifacts.forEach(name => {
      if (!releaseFiles.includes(name)) throw new Error(`Missing desktop artifact: ${name}`);
    });
    releaseFiles.forEach(name => {
      fsApi.copyFileSync(path.join(stagingDir, name), path.join(distDir, name));
    });
    exitCode = 0;
  } catch (error) {
    logger.error(error);
    exitCode = Number.isInteger(error.exitCode) ? error.exitCode : 1;
  } finally {
    if (stagingDir) {
      try {
        fsApi.rmSync(stagingDir, { recursive: true, force: true, maxRetries: 4, retryDelay: 250 });
      } catch (error) {
        logger.error(`Could not remove desktop staging directory ${stagingDir}: ${error.message}`);
        exitCode = 1;
      }
    }

    if (restoreRequired) {
      try {
        const command = npmCommandSpec(['rebuild', 'better-sqlite3'], {
          platform: runtimePlatform,
          comspec,
        });
        spawnChecked(spawn, command.executable, command.args, {
          cwd: rootDir,
          env: runtimeEnv,
          stdio: 'inherit',
          shell: false,
        }, 'Node native rebuild');
      } catch (error) {
        logger.error(error);
        exitCode = 1;
      }
    }
  }

  return exitCode;
}

if (require.main === module) {
  process.exitCode = runDesktopBuild(process.argv[2]);
}

module.exports = { runDesktopBuild };
