(function exposeBizArenaRuntime(global) {
  const deploymentConfig = global.BizArenaDeploymentConfig || {};

  function configuredBackendOrigin() {
    const value = String(deploymentConfig.backendUrl || '').trim();
    if (!value) return '';
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) return '';
      return url.origin;
    } catch (_error) {
      return '';
    }
  }

  function resolveHttpUrl(url) {
    const backendOrigin = configuredBackendOrigin();
    if (!backendOrigin || !String(url).startsWith('/')) return url;
    return new URL(String(url), backendOrigin).toString();
  }

  function isExternalBackend() {
    const backendOrigin = configuredBackendOrigin();
    return Boolean(backendOrigin && backendOrigin !== String(global.location?.origin || ''));
  }

  function publicAppBaseUrl(meta = {}) {
    const value = isExternalBackend()
      ? global.location?.origin
      : (meta.publicUrl || meta.localUrls?.[0] || global.location?.origin);
    return String(value || '').replace(/\/+$/, '');
  }

  function request(url, options = {}, hooks = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    return fetch(resolveHttpUrl(url), { ...options, headers }).then(async response => {
      const raw = await response.json();
      const data = hooks.normalize ? hooks.normalize(raw) : raw;
      if (!response.ok) {
        const requestError = new Error(data.error || 'Request failed');
        requestError.status = response.status;
        throw requestError;
      }
      return data;
    }).catch(error => {
      if (error instanceof TypeError) {
        const networkError = new Error(hooks.networkErrorMessage || 'Network request failed');
        networkError.status = 0;
        networkError.transient = true;
        throw networkError;
      }
      throw error;
    });
  }

  function websocketUrl(location, params) {
    const backendOrigin = configuredBackendOrigin();
    const target = backendOrigin ? new URL(backendOrigin) : location;
    const protocol = target.protocol === 'https:' ? 'wss:' : 'ws:';
    const query = new URLSearchParams(params);
    return `${protocol}//${target.host}/ws?${query.toString()}`;
  }

  function createRealtimeController(options = {}) {
    let socket = null;
    let connectionKey = '';

    function setConnected(connected) {
      if (options.onConnectionChange) options.onConnectionChange(Boolean(connected));
    }

    function close() {
      if (socket) {
        try { socket.close(); } catch (_error) {}
      }
      socket = null;
      connectionKey = '';
      setConnected(false);
    }

    function connect(params) {
      if (!global.WebSocket || !params) {
        close();
        return null;
      }
      const key = JSON.stringify(params);
      if (socket && connectionKey === key) return socket;
      close();
      try {
        socket = new global.WebSocket(websocketUrl(global.location, params));
        connectionKey = key;
        socket.addEventListener('open', () => setConnected(true));
        socket.addEventListener('close', () => setConnected(false));
        socket.addEventListener('message', event => {
          let payload = null;
          try { payload = JSON.parse(event.data); } catch (_error) { return; }
          if (payload.type === 'room-updated' && options.onRoomUpdated) options.onRoomUpdated(payload);
          if (payload.type === 'teacher-overview-updated' && options.onTeacherOverviewUpdated) {
            options.onTeacherOverviewUpdated(payload);
          }
        });
        return socket;
      } catch (_error) {
        close();
        return null;
      }
    }

    return { connect, close };
  }

  global.BizArenaRuntime = {
    request,
    websocketUrl,
    createRealtimeController,
    resolveHttpUrl,
    isExternalBackend,
    publicAppBaseUrl,
  };
})(window);
