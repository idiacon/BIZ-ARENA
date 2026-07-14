(function exposeBizArenaRuntime(global) {
  function request(url, options = {}, hooks = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    return fetch(url, { ...options, headers }).then(async response => {
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
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const query = new URLSearchParams(params);
    return `${protocol}//${location.host}/ws?${query.toString()}`;
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

  global.BizArenaRuntime = { request, websocketUrl, createRealtimeController };
})(window);
