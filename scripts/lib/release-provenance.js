const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function gitOutput(rootDir, args) {
  try {
    return execFileSync('git', args, {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch (_error) {
    return '';
  }
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function sourceProvenance(rootDir) {
  const statusLines = gitOutput(rootDir, ['status', '--porcelain=v1', '--untracked-files=normal'])
    .split(/\r?\n/)
    .filter(Boolean);
  return {
    commit: gitOutput(rootDir, ['rev-parse', '--verify', 'HEAD']) || null,
    branch: gitOutput(rootDir, ['branch', '--show-current']) || null,
    dirty: statusLines.length > 0,
    changedEntries: statusLines.length,
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
  };
}

function describeFiles(files, packageDir, rootDir) {
  return files.map(filePath => ({
    name: path.relative(packageDir, filePath).replace(/\\/g, '/'),
    path: path.relative(rootDir, filePath).replace(/\\/g, '/'),
    bytes: fs.statSync(filePath).size,
    sha256: sha256File(filePath),
  }));
}

function describeArtifact(filePath, rootDir) {
  return {
    path: path.relative(rootDir, filePath).replace(/\\/g, '/'),
    bytes: fs.statSync(filePath).size,
    sha256: sha256File(filePath),
  };
}

module.exports = {
  describeArtifact,
  describeFiles,
  sha256File,
  sourceProvenance,
};
