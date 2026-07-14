const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { cloneCleanCheckout } = require('./lib/clean-checkout');
const { npmCommandSpec } = require('./lib/npm-command');

const rootDir = path.resolve(__dirname, '..');
const status = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=normal'], {
  cwd: rootDir,
  encoding: 'utf8',
}).trim();

if (status) {
  throw new Error('Clean-checkout verification requires a committed, clean working tree.');
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'biz-arena-clean-checkout-'));
const checkoutDir = path.join(tempRoot, 'source');
function run(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: options.cwd || rootDir,
    env: { ...process.env, CI: 'true' },
    stdio: 'inherit',
  });
}

function runNpm(args, options = {}) {
  const command = npmCommandSpec(args);
  run(command.executable, command.args, options);
}

try {
  const { commit } = cloneCleanCheckout({ sourceDir: rootDir, checkoutDir, stdio: 'inherit' });
  runNpm(['ci'], { cwd: checkoutDir });
  runNpm(['run', 'check'], { cwd: checkoutDir });
  runNpm(['test'], { cwd: checkoutDir });
  console.log(JSON.stringify({ ok: true, commit }));
} finally {
  const resolvedTemp = path.resolve(tempRoot);
  if (resolvedTemp.startsWith(path.resolve(os.tmpdir()) + path.sep)) {
    fs.rmSync(resolvedTemp, { recursive: true, force: true });
  }
}
