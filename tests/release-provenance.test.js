const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  describeArtifact,
  describeFiles,
  sourceProvenance,
} = require('../scripts/lib/release-provenance');

test('release provenance records source revision and SHA-256 file identities', () => {
  const rootDir = path.resolve(__dirname, '..');
  const packageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bizarena-release-provenance-'));
  const artifactPath = path.join(packageDir, 'artifact.txt');
  try {
    fs.writeFileSync(artifactPath, 'Biz Arena release artifact', 'utf8');

    const source = sourceProvenance(rootDir);
    const [file] = describeFiles([artifactPath], packageDir, rootDir);
    const artifact = describeArtifact(artifactPath, rootDir);

    assert.match(source.commit, /^[a-f0-9]{40}$/);
    assert.equal(typeof source.dirty, 'boolean');
    assert.equal(file.name, 'artifact.txt');
    assert.match(file.sha256, /^[a-f0-9]{64}$/);
    assert.equal(artifact.sha256, file.sha256);
    assert.equal(artifact.bytes, Buffer.byteLength('Biz Arena release artifact'));
  } finally {
    fs.rmSync(packageDir, { recursive: true, force: true });
  }
});
