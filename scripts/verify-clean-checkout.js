const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const status = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=normal'], {
  cwd: rootDir,
  encoding: 'utf8',
}).trim();

if (status) {
  throw new Error('Clean-checkout verification requires a committed, clean working tree.');
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'biz-arena-clean-checkout-'));
const archivePath = path.join(tempRoot, 'source.zip');
const checkoutDir = path.join(tempRoot, 'source');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: options.cwd || rootDir,
    env: { ...process.env, CI: 'true' },
    stdio: 'inherit',
  });
}

try {
  run('git', ['archive', '--format=zip', '--output', archivePath, 'HEAD']);
  fs.mkdirSync(checkoutDir, { recursive: true });
  if (process.platform === 'win32') {
    run('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${checkoutDir.replace(/'/g, "''")}' -Force`,
    ]);
  } else {
    run('unzip', ['-q', archivePath, '-d', checkoutDir]);
  }
  run(npmCommand, ['ci'], { cwd: checkoutDir });
  run(npmCommand, ['run', 'check'], { cwd: checkoutDir });
  run(npmCommand, ['test'], { cwd: checkoutDir });
  console.log(JSON.stringify({ ok: true, commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: rootDir, encoding: 'utf8' }).trim() }));
} finally {
  const resolvedTemp = path.resolve(tempRoot);
  if (resolvedTemp.startsWith(path.resolve(os.tmpdir()) + path.sep)) {
    fs.rmSync(resolvedTemp, { recursive: true, force: true });
  }
}
