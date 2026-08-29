const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const runtimeSource = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'app-runtime.js'),
  'utf8',
);

function loadRuntime({ deploymentConfig = {}, location = null } = {}) {
  const requests = [];
  class FakeWebSocket {
    constructor(url) {
      this.url = url;
    }

    addEventListener() {}

    close() {}
  }

  const window = {
    BizArenaDeploymentConfig: deploymentConfig,
    WebSocket: FakeWebSocket,
    location: location || {
      protocol: 'https:',
      host: 'frontend.example',
      origin: 'https://frontend.example',
    },
  };
  const context = {
    window,
    URL,
    URLSearchParams,
    fetch: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      };
    },
  };

  vm.runInNewContext(runtimeSource, context, { filename: 'public/app-runtime.js' });
  return { runtime: window.BizArenaRuntime, requests, window };
}

test('external frontend routes HTTP and WebSocket traffic to the configured backend origin', async () => {
  const { runtime, requests, window } = loadRuntime({
    deploymentConfig: {
      backendUrl: 'https://api.example.com/',
    },
  });

  await runtime.request('/api/meta', { method: 'GET' });

  assert.equal(requests[0].url, 'https://api.example.com/api/meta');
  assert.equal(
    runtime.websocketUrl(window.location, { ticket: 'ticket value' }),
    'wss://api.example.com/ws?ticket=ticket+value',
  );
  assert.equal(runtime.isExternalBackend(), true);
});

test('same-origin classroom keeps relative HTTP URLs and the current WebSocket host', async () => {
  const { runtime, requests, window } = loadRuntime();

  await runtime.request('/api/health', { method: 'GET' });

  assert.equal(requests[0].url, '/api/health');
  assert.equal(
    runtime.websocketUrl(window.location, { ticket: 'local' }),
    'wss://frontend.example/ws?ticket=local',
  );
  assert.equal(runtime.resolveHttpUrl('/api/qr?data=x'), '/api/qr?data=x');
  assert.equal(
    runtime.publicAppBaseUrl({ publicUrl: 'https://api.example.com' }),
    'https://api.example.com',
  );
  assert.equal(runtime.isExternalBackend(), false);
});

test('external frontend keeps generated student links on the frontend origin', () => {
  const { runtime } = loadRuntime({
    deploymentConfig: {
      backendUrl: 'https://api.example.com',
    },
  });

  assert.equal(
    runtime.publicAppBaseUrl({ publicUrl: 'https://api.example.com' }),
    'https://frontend.example',
  );
});
