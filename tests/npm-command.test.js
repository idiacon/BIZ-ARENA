const test = require('node:test');
const assert = require('node:assert/strict');

const { npmCommandSpec } = require('../scripts/lib/npm-command');

test('routes npm through ComSpec on Windows', () => {
  assert.deepEqual(
    npmCommandSpec(['ci'], {
      platform: 'win32',
      comspec: 'C:\\Windows\\System32\\cmd.exe',
    }),
    {
      executable: 'C:\\Windows\\System32\\cmd.exe',
      args: ['/d', '/s', '/c', 'npm.cmd', 'ci'],
    },
  );
});

test('runs npm directly outside Windows', () => {
  assert.deepEqual(
    npmCommandSpec(['run', 'check'], { platform: 'linux' }),
    {
      executable: 'npm',
      args: ['run', 'check'],
    },
  );
});
