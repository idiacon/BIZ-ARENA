const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { cloneCleanCheckout } = require('../scripts/lib/clean-checkout');
const { sourceProvenance } = require('../scripts/lib/release-provenance');

test('project install-script policy allows only the reviewed native dependency', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const npmrc = fs.readFileSync(path.join(__dirname, '..', '.npmrc'), 'utf8');

  assert.deepEqual(packageJson.allowScripts, {
    'better-sqlite3@12.11.1': true,
    'electron-winstaller': false,
  });
  assert.match(npmrc, /^strict-allow-scripts=true\s*$/);
});

test('clones the exact HEAD without carrying untracked files', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'biz-arena-clean-checkout-test-'));
  const sourceDir = path.join(tempRoot, 'source');
  const checkoutDir = path.join(tempRoot, 'checkout');
  try {
    fs.mkdirSync(sourceDir, { recursive: true });
    execFileSync('git', ['init', '--quiet'], { cwd: sourceDir });
    execFileSync('git', ['config', 'user.email', 'clean-checkout@example.test'], { cwd: sourceDir });
    execFileSync('git', ['config', 'user.name', 'Clean Checkout Test'], { cwd: sourceDir });
    fs.writeFileSync(path.join(sourceDir, 'tracked.txt'), 'tracked', 'utf8');
    execFileSync('git', ['add', 'tracked.txt'], { cwd: sourceDir });
    execFileSync('git', ['commit', '--quiet', '-m', 'fixture'], { cwd: sourceDir });
    fs.writeFileSync(path.join(sourceDir, 'untracked.txt'), 'untracked', 'utf8');

    const expectedCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: sourceDir, encoding: 'utf8' }).trim();
    const result = cloneCleanCheckout({ sourceDir, checkoutDir });
    const provenance = sourceProvenance(checkoutDir);

    assert.equal(result.commit, expectedCommit);
    assert.equal(provenance.commit, expectedCommit);
    assert.equal(provenance.dirty, false);
    assert.equal(fs.readFileSync(path.join(checkoutDir, 'tracked.txt'), 'utf8'), 'tracked');
    assert.equal(fs.existsSync(path.join(checkoutDir, 'untracked.txt')), false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
