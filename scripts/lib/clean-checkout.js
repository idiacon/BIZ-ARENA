const { execFileSync } = require('node:child_process');

function gitOutput(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function cloneCleanCheckout({ sourceDir, checkoutDir, stdio = 'ignore' }) {
  const commit = gitOutput(sourceDir, ['rev-parse', '--verify', 'HEAD']);
  execFileSync('git', ['clone', '--quiet', '--no-hardlinks', '--no-checkout', sourceDir, checkoutDir], { stdio });
  execFileSync('git', ['checkout', '--quiet', '--detach', commit], { cwd: checkoutDir, stdio });
  return { commit };
}

module.exports = { cloneCleanCheckout };
