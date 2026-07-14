const test = require('node:test');
const assert = require('node:assert/strict');

const { npmSpawnSpec } = require('../scripts/pilot-gate/receipt-capture');

test('uses ComSpec to launch npm scripts on Windows', () => {
  assert.deepEqual(
    npmSpawnSpec('release:verify', {
      platform: 'win32',
      comspec: 'C:\\Windows\\System32\\cmd.exe',
    }),
    {
      executable: 'C:\\Windows\\System32\\cmd.exe',
      args: ['/d', '/s', '/c', 'npm.cmd', 'run', 'release:verify'],
    },
  );
});

test('launches npm directly outside Windows', () => {
  assert.deepEqual(
    npmSpawnSpec('release:verify', { platform: 'linux' }),
    {
      executable: 'npm',
      args: ['run', 'release:verify'],
    },
  );
});
