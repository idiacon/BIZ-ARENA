window.BizArenaFrontendModules = Object.assign(window.BizArenaFrontendModules || {}, {
  serverAdmin: Object.freeze({ contract: 'server-admin-ui-v1' }),
});

function networkDoctorUrlInfo(rawUrl) {
  const raw = String(rawUrl || '');
  let host = raw;
  try {
    host = new URL(raw).hostname;
  } catch (_error) {
    host = raw.replace(/^https?:\/\//, '').split(/[/:]/)[0];
  }
  const octets = host.split('.').map(part => Number(part));
  const isIpv4 = octets.length === 4 && octets.every(part => Number.isInteger(part) && part >= 0 && part <= 255);
  const healthUrl = `${raw.replace(/\/+$/, '')}/api/health`;
  const clientUrl = `${raw.replace(/\/+$/, '')}/client`;
  const base = raw.replace(/\/+$/, '');
  if (host === '127.0.0.1' || host === 'localhost') {
    return { rawUrl: base, host, healthUrl, clientUrl, tone: 'warn', label: 'Только этот ПК', hint: 'Не давайте ученикам: 127.0.0.1 открывает их собственный компьютер.' };
  }
  if (!isIpv4) return { rawUrl: base, host, healthUrl, clientUrl, tone: 'warn', label: 'Проверьте адрес', hint: 'Не удалось распознать IPv4. Для classroom режима используйте LAN IPv4 или localhost-demo.' };
  if (octets[0] === 192 && octets[1] === 168) return { rawUrl: base, host, healthUrl, clientUrl, tone: 'ok', label: 'Обычный LAN', hint: 'Хороший кандидат, если ученики в той же подсети 192.168.x.x.' };
  if (octets[0] === 10) return { rawUrl: base, host, healthUrl, clientUrl, tone: 'ok', label: 'Обычный LAN', hint: 'Хороший кандидат, если ученики тоже в сети 10.x.x.x.' };
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return { rawUrl: base, host, healthUrl, clientUrl, tone: 'ok', label: 'Обычный LAN', hint: 'Хороший кандидат, если ученики в той же подсети 172.16-31.x.x.' };
  if (octets[0] === 26 || octets[0] === 25 || octets[0] === 100 || octets[0] === 169) {
    return { rawUrl: base, host, healthUrl, clientUrl, tone: 'warn', label: 'Похоже на VPN/служебный', hint: 'Может не открыться в аудитории. Проверьте health или используйте одну общую сеть.' };
  }
  return { rawUrl: base, host, healthUrl, clientUrl, tone: 'warn', label: 'Необычная сеть', hint: 'Проверьте с ученического ПК. Возможно, это другой маршрутизатор или изолированная подсеть.' };
}

function networkCheckLabel(result) {
  if (!result) return 'Не проверяли';
  if (result.pending) return 'Проверяем...';
  if (result.ok) return `Сервер ответил за ${rub(result.elapsedMs || 0)} мс`;
  return result.error ? `Не отвечает: ${result.error}` : 'Не отвечает';
}

function renderConnectionModeCards(rows, best) {
  const local = rows.find(row => row.host === '127.0.0.1' || row.host === 'localhost');
  return `
    <div class="connection-mode-grid">
      <article class="${best?.tone === 'ok' ? 'ok' : 'warn'}">
        <span>1. LAN</span>
        <strong>${best?.tone === 'ok' ? 'Основной режим' : 'Проверить перед занятием'}</strong>
        <small>Работает, только если ученические ПК видят IP преподавателя.</small>
        <code>${escapeHtml(best?.clientUrl || 'LAN адрес не найден')}</code>
      </article>
      <article class="warn">
        <span>2. Отдельная сеть</span>
        <strong>Роутер или точка доступа</strong>
        <small>Если вуз режет LAN между аудиториями, подключите класс к одной простой сети преподавателя.</small>
        <code>Сервер и ученики должны быть в одной подсети</code>
      </article>
      <article class="warn">
        <span>3. Localhost/demo</span>
        <strong>Один компьютер</strong>
        <small>Для подготовки, показа и проверки без сети аудитории.</small>
        <code>${escapeHtml(local?.clientUrl || 'http://127.0.0.1:3000/client')}</code>
      </article>
    </div>`;
}

function renderNetworkDoctor(meta) {
  const urls = [
    ...(Array.isArray(meta.lanUrls) ? meta.lanUrls : []),
    ...(Array.isArray(meta.localUrls) ? meta.localUrls : []),
  ];
  const unique = [...new Set(urls)];
  const rows = unique.map(networkDoctorUrlInfo);
  const best = rows.find(row => row.tone === 'ok') || rows[0] || null;
  const studentUrl = best?.clientUrl || '';
  const qrSrc = studentUrl ? `/api/qr?data=${encodeURIComponent(studentUrl)}` : '';
  return `
    <section class="network-doctor-panel top-gap" data-network-doctor>
      <div class="network-doctor-head">
        <div>
          <span class="factory-node-label">Network Doctor</span>
          <strong>${best ? `Проверяйте: ${escapeHtml(best.healthUrl)}` : 'Сетевые адреса не найдены'}</strong>
          <small>Откройте health-ссылку или QR с ученического ПК/телефона. Если не открывается, LAN заблокирован или устройства в разных подсетях: нужна одна общая сеть.</small>
        </div>
        <div class="network-doctor-actions">
          <button type="button" class="ghost" data-network-check="${escapeHtml(best?.healthUrl || '')}" ${best ? '' : 'disabled'}>Проверить</button>
          <button type="button" class="ghost" data-copy-url="${escapeHtml(best?.healthUrl || '')}" ${best ? '' : 'disabled'}>Скопировать health</button>
        </div>
      </div>
      ${renderConnectionModeCards(rows, best)}
      <div class="network-doctor-share">
        <div>
          <span>QR для телефона / ученика</span>
          <strong>${studentUrl ? escapeHtml(studentUrl) : 'LAN ссылка недоступна'}</strong>
          <small>QR ведёт в лёгкий браузерный client. На слабых ПК можно открыть эту ссылку в обычном браузере без Electron.</small>
        </div>
        ${qrSrc ? `<img src="${escapeHtml(qrSrc)}" alt="QR-код ссылки для ученика" loading="lazy" />` : '<div class="qr-placeholder">QR</div>'}
      </div>
      <div class="network-doctor-grid">
        ${rows.map(row => `
          <article class="${escapeHtml(row.tone)}">
            <span>${escapeHtml(row.label)}</span>
            <strong>${escapeHtml(row.host)}</strong>
            <small>${escapeHtml(row.hint)}</small>
            <code>${escapeHtml(row.healthUrl)}</code>
            <button type="button" class="ghost" data-network-check="${escapeHtml(row.healthUrl)}">Проверить адрес</button>
            <small class="network-check-result">${escapeHtml(networkCheckLabel(state.networkChecks[row.healthUrl]))}</small>
          </article>
        `).join('')}
      </div>
      <div class="network-doctor-advice">
        <span>Если компьютеры в разных подсетях или за разными маршрутизаторами, LAN может не работать даже при одном интернете.</span>
        <span>Для аудиторий с NAT/client isolation используйте отдельный роутер/точку доступа или локальный demo-сценарий на одном ПК.</span>
      </div>
    </section>`;
}

async function runNetworkHealthCheck(healthUrl) {
  const url = String(healthUrl || '');
  if (!url) return;
  state.networkChecks[url] = { pending: true };
  renderServerHome();
  try {
    const response = await fetch(`/api/network/check?url=${encodeURIComponent(url)}`, { method: 'GET' });
    const data = normalizeObjectEncoding(await response.json());
    state.networkChecks[url] = data.result || { ok: false, error: 'Пустой ответ диагностики' };
    if (state.networkChecks[url].ok) {
      showToast(`Сервер отвечает: ${url}`, 'success');
    } else {
      showToast(`Адрес не ответил: ${state.networkChecks[url].error || url}`, 'error');
    }
  } catch (error) {
    state.networkChecks[url] = { ok: false, error: error.message };
    showToast(error.message, 'error');
  }
  renderServerHome();
}

function renderServerHome() {
  if (!elements.serverHomeScreen) return;
  const meta = state.runtimeMeta || {};
  const canResumeRoom = Boolean(state.room && isTeacherViewer());
  if (elements.teacherResumeRoom) {
    const targetScreen = gameIsFinished() ? 'results-screen' : gameIsActive() ? 'game-screen' : 'lobby-screen';
    elements.teacherResumeRoom.hidden = !canResumeRoom;
    elements.teacherResumeRoom.dataset.openScreen = targetScreen;
    elements.teacherResumeRoom.textContent = gameIsFinished()
      ? 'Открыть итоги занятия'
      : gameIsActive()
        ? 'Продолжить занятие'
        : 'Вернуться в лобби';
  }
  if (isCloudDeployment()) {
    const base = cloudPublicBase();
    const clientUrl = `${base}/client`;
    if (elements.serverLocalUrl) elements.serverLocalUrl.textContent = base;
    if (elements.serverLanUrl) elements.serverLanUrl.textContent = 'Cloud Classroom: LAN/IP не нужен';
    if (elements.serverClientUrl) elements.serverClientUrl.textContent = clientUrl;
    if (elements.serverPort) elements.serverPort.textContent = String(meta.port || 3000);
    if (elements.serverModeStatus) elements.serverModeStatus.textContent = 'Cloud mode';
    if (elements.serverClientLinks) {
      const warning = meta.storage?.warning || '';
      elements.serverClientLinks.innerHTML = `
        <strong>Cloud Classroom</strong>
        <small>Ученики заходят по обычной ссылке из браузера. LAN, IP преподавателя и firewall не нужны.</small>
        <div>
          <button type="button" class="ghost server-link-chip" data-copy-url="${escapeHtml(clientUrl)}">Скопировать ссылку ученика</button>
          <button type="button" class="ghost server-link-chip" data-copy-url="${escapeHtml(`${base}/api/health`)}">Скопировать health</button>
        </div>
        ${warning ? `<article class="network-doctor-panel warn top-gap"><strong>Render demo warning</strong><small>${escapeHtml(warning)}</small></article>` : ''}
        <div class="network-doctor-share top-gap">
          <span>QR для входа ученика</span>
          <strong>${escapeHtml(clientUrl)}</strong>
          <img src="/api/qr?data=${encodeURIComponent(clientUrl)}" alt="QR Cloud Classroom" />
        </div>`;
      elements.serverClientLinks.querySelectorAll('[data-copy-url]').forEach(button => {
        button.addEventListener('click', () => copyTextToClipboard(button.dataset.copyUrl).then(
          () => showToast(`Скопировано: ${button.dataset.copyUrl}`, 'success'),
          error => showToast(error.message, 'error')
        ));
      });
    }
    renderServerAdminOverview();
    return;
  }
  const local = Array.isArray(meta.localUrls) && meta.localUrls.length ? meta.localUrls[0] : 'http://127.0.0.1:3000';
  const lanAvailable = Array.isArray(meta.lanUrls) && meta.lanUrls.length;
  const lan = lanAvailable ? meta.lanUrls[0] : 'LAN адрес не найден. Проверьте, что компьютер подключен к сети.';
  const clientUrl = lanAvailable ? `${String(meta.lanUrls[0]).replace(/\/+$/, '')}/client` : `${local.replace(/\/+$/, '')}/client`;
  if (elements.serverLocalUrl) elements.serverLocalUrl.textContent = local;
  if (elements.serverLanUrl) elements.serverLanUrl.textContent = lan;
  if (elements.serverClientUrl) elements.serverClientUrl.textContent = clientUrl;
  if (elements.serverPort) elements.serverPort.textContent = String(meta.port || 3000);
  if (elements.serverModeStatus) elements.serverModeStatus.textContent = isServerMode() ? 'Server mode' : 'LAN server';
  if (elements.serverClientLinks) {
    const urls = [
      ...(Array.isArray(meta.lanUrls) ? meta.lanUrls : []),
      ...(Array.isArray(meta.localUrls) ? meta.localUrls : []),
    ].map(url => `${String(url).replace(/\/+$/, '')}/client`);
    elements.serverClientLinks.innerHTML = `
      <strong>Ссылки для учеников</strong>
      <small>Давайте ученикам LAN-адрес. 127.0.0.1 работает только на компьютере преподавателя.</small>
      <div>
        ${urls.map((url, index) => `<button type="button" class="ghost server-link-chip" data-copy-url="${escapeHtml(url)}">${index + 1}. ${escapeHtml(url)}</button>`).join('')}
      </div>
      ${renderNetworkDoctor(meta)}`;
    elements.serverClientLinks.querySelectorAll('[data-copy-url]').forEach(button => {
      button.addEventListener('click', () => copyTextToClipboard(button.dataset.copyUrl).then(
        () => showToast(`Скопировано: ${button.dataset.copyUrl}`, 'success'),
        error => showToast(error.message, 'error')
      ));
    });
    elements.serverClientLinks.querySelectorAll('[data-network-check]').forEach(button => {
      button.addEventListener('click', () => runNetworkHealthCheck(button.dataset.networkCheck));
    });
  }
  renderServerAdminOverview();
}

function serverAdminMetricOptions() {
  return [
    ['capital', 'Капитал'],
    ['money', 'Деньги'],
    ['profitLastTurn', 'Прибыль за ход'],
    ['revenueLastTurn', 'Выручка за ход'],
    ['soldLastTurn', 'Продано за ход'],
    ['marketOfferValue', 'Заявка в рынок'],
    ['payroll', 'Фонд оплаты'],
    ['capacity', 'Мощность линии'],
    ['finishedGoods', 'Готовый склад'],
    ['rawStock', 'Компоненты'],
  ];
}

function serverAdminMetricValue(player, metric) {
  const value = Number(player?.[metric] || 0);
  if (['money', 'capital', 'profitLastTurn', 'revenueLastTurn', 'marketOfferValue', 'payroll'].includes(metric)) return money(value);
  if (metric === 'soldLastTurn' || metric === 'finishedGoods' || metric === 'capacity') return `${rub(value)} ед.`;
  return rub(value);
}

function serverAdminDaySeries(room, reducer) {
  const days = Array.isArray(room?.adminDays) ? room.adminDays : [];
  const series = days.map(day => reducer(day.players || [], day)).filter(value => Number.isFinite(value));
  if (!series.length && room?.players) series.push(reducer(room.players || [], room));
  return series.slice(-8);
}

function renderAdminKpi(title, value, hint, tone = '', meta = {}) {
  const hasMeter = Number.isFinite(Number(meta.percent));
  const spark = Array.isArray(meta.spark) ? meta.spark : [];
  return `
    <article class="server-admin-kpi ${tone}">
      <span>${escapeHtml(title)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(hint)}</small>
      ${hasMeter ? `<i class="live-meter" style="--live-meter:${Math.max(0, Math.min(100, Math.round(Number(meta.percent))))}%"></i>` : ''}
      ${spark.length ? renderMetricSparkline(spark, tone) : ''}
    </article>`;
}

function serverAdminHelpQueue(room) {
  if (!room) return [];
  return (room.players || [])
    .filter(player => !player.isBot)
    .map(player => {
      const issues = [];
      if (!player.ready && room.status === 'lobby') issues.push('не готов к старту');
      if (!player.ready && room.status !== 'lobby') issues.push('не готов к ходу');
      if (player.workerCount <= 0) issues.push('нет работников');
      if (player.rawStock <= 0) issues.push('нет компонентов');
      if (player.capacity <= 0) issues.push('нет мощности сборки');
      if (player.finishedGoods > 0 && player.marketOfferValue <= 0) issues.push('товар не выставлен на рынок');
      if (player.debt > 0) issues.push('есть долг');
      return { player, issues };
    })
    .filter(item => item.issues.length)
    .sort((left, right) => right.issues.length - left.issues.length);
}

function serverAdminSecurityQueue(room) {
  if (!room) return [];
  return (room.players || [])
    .filter(player => !player.isBot && Number(player.rejectedActionCount || 0) > 0)
    .map(player => ({
      player,
      count: Number(player.rejectedActionCount || 0),
      reason: player.lastRejectReason || 'отклоненное действие',
      address: player.lastRemoteAddress || 'адрес не записан',
    }))
    .sort((left, right) => right.count - left.count);
}

function serverAdminClassSummary(room) {
  const players = (room?.players || []).filter(player => !player.isBot);
  const helpQueue = serverAdminHelpQueue(room);
  const securityQueue = serverAdminSecurityQueue(room);
  const issueCounts = {
    notReady: players.filter(player => !player.ready).length,
    noWorkers: players.filter(player => player.workerCount <= 0).length,
    noComponents: players.filter(player => player.rawStock <= 0).length,
    noCapacity: players.filter(player => player.capacity <= 0).length,
    noMarketOffer: players.filter(player => player.finishedGoods > 0 && player.marketOfferValue <= 0).length,
    debtRisk: players.filter(player => player.debt > 0).length,
    securityAlerts: securityQueue.length,
  };
  const readyCount = players.filter(player => player.ready).length;
  return {
    playerCount: players.length,
    readyCount,
    helpCount: helpQueue.length,
    securityAlertCount: securityQueue.length,
    rejectedActionCount: players.reduce((sum, player) => sum + Number(player.rejectedActionCount || 0), 0),
    issueCounts,
    readyPercent: players.length ? Math.round((readyCount / players.length) * 100) : 0,
  };
}

function renderServerAdminClassSummary(room) {
  const summary = serverAdminClassSummary(room);
  const players = (room?.players || []).filter(player => !player.isBot);
  const maxPlayers = Math.max(1, room?.maxPlayers || room?.settings?.maxPlayers || players.length || 1);
  const issueTotal = Math.max(1, players.length || 1);
  const readySpark = serverAdminDaySeries(room, rows => rows.length ? Math.round((rows.filter(row => row.ready).length / rows.length) * 100) : 0);
  const helpSpark = serverAdminDaySeries(room, rows => rows.filter(row => !row.ready || row.workerCount <= 0 || row.rawStock <= 0 || row.capacity <= 0).length);
  const offerSpark = serverAdminDaySeries(room, rows => rows.filter(row => row.finishedGoods > 0 && row.marketOfferValue <= 0).length);
  const debtSpark = serverAdminDaySeries(room, rows => rows.filter(row => Number(row.debt || 0) > 0).length);
  const gaugeTone = summary.readyPercent >= 80 ? 'ok' : summary.helpCount > 0 ? 'warn' : '';
  return `
    <section class="server-admin-class-summary live-classroom-strip top-gap" data-uiux-slice="live-class-metrics">
      ${renderReadinessGauge(summary.readyPercent, 'готовность класса', `${summary.readyCount}/${summary.playerCount}`, gaugeTone)}
      <div class="live-metric-grid">
        ${renderLiveMetricCard({
          label: 'Вошли',
          value: `${summary.playerCount}/${maxPlayers}`,
          hint: 'команд в комнате',
          percent: uiPercent(summary.playerCount, maxPlayers),
          tone: 'ok',
          spark: serverAdminDaySeries(room, rows => rows.length),
        })}
        ${renderLiveMetricCard({
          label: 'Нужна помощь',
          value: String(summary.helpCount),
          hint: 'застряли на ходе',
          percent: uiPercent(summary.helpCount, issueTotal),
          tone: summary.helpCount ? 'warn' : 'ok',
          spark: helpSpark,
        })}
        ${renderLiveMetricCard({
          label: 'Без закупки',
          value: String(summary.issueCounts.noComponents),
          hint: 'нет компонентов',
          percent: uiPercent(summary.issueCounts.noComponents, issueTotal),
          tone: summary.issueCounts.noComponents ? 'warn' : 'ok',
          spark: serverAdminDaySeries(room, rows => rows.filter(row => row.rawStock <= 0).length),
        })}
        ${renderLiveMetricCard({
          label: 'Без работников',
          value: String(summary.issueCounts.noWorkers),
          hint: 'не наняли линию',
          percent: uiPercent(summary.issueCounts.noWorkers, issueTotal),
          tone: summary.issueCounts.noWorkers ? 'warn' : 'ok',
          spark: serverAdminDaySeries(room, rows => rows.filter(row => row.workerCount <= 0).length),
        })}
        ${renderLiveMetricCard({
          label: 'Без сборки',
          value: String(summary.issueCounts.noCapacity),
          hint: 'нет мощности',
          percent: uiPercent(summary.issueCounts.noCapacity, issueTotal),
          tone: summary.issueCounts.noCapacity ? 'warn' : 'ok',
          spark: serverAdminDaySeries(room, rows => rows.filter(row => row.capacity <= 0).length),
        })}
        ${renderLiveMetricCard({
          label: 'Без заявки',
          value: String(summary.issueCounts.noMarketOffer),
          hint: 'товар не продается',
          percent: uiPercent(summary.issueCounts.noMarketOffer, issueTotal),
          tone: summary.issueCounts.noMarketOffer ? 'warn' : 'ok',
          spark: offerSpark,
        })}
        ${renderLiveMetricCard({
          label: 'Риск долга',
          value: String(summary.issueCounts.debtRisk),
          hint: 'команд с долгом',
          percent: uiPercent(summary.issueCounts.debtRisk, issueTotal),
          tone: summary.issueCounts.debtRisk ? 'danger' : 'ok',
          spark: debtSpark,
        })}
        ${renderLiveMetricCard({
          label: 'Security',
          value: String(summary.rejectedActionCount),
          hint: 'отклоненных действий',
          percent: uiPercent(summary.rejectedActionCount, Math.max(5, summary.rejectedActionCount)),
          tone: summary.rejectedActionCount ? 'danger' : 'ok',
          spark: serverAdminDaySeries(room, rows => rows.reduce((sum, row) => sum + Number(row.rejectedActionCount || 0), 0)),
        })}
      </div>
      <div class="live-classroom-ticker" aria-label="Живая лента класса">
        <span>Готовность ${summary.readyCount}/${summary.playerCount}</span>
        <span>Помощь ${summary.helpCount}</span>
        <span>Закупка ${summary.issueCounts.noComponents}</span>
        <span>Персонал ${summary.issueCounts.noWorkers}</span>
        <span>Сборка ${summary.issueCounts.noCapacity}</span>
        <span>Заявки ${summary.issueCounts.noMarketOffer}</span>
      </div>
    </section>`;
}

function serverAdminLaunchGate(room) {
  if (!room) return { tone: 'warn', label: 'Комната не выбрана', hint: 'Создайте или выберите комнату.' };
  if (room.status === 'lobby') {
    if (!room.humanCount) return { tone: 'warn', label: 'Ждем вход учеников', hint: 'Покажите QR, LAN-ссылку и код комнаты.' };
    if (room.allReady || room.readyCount === room.humanCount) return { tone: 'ok', label: 'Можно запускать матч', hint: 'Все вошедшие команды готовы.' };
    return { tone: 'warn', label: 'Старт пока рано', hint: `Готово ${room.readyCount}/${room.humanCount}. Попросите учеников нажать “Готов”.` };
  }
  if (room.status === 'running') return { tone: 'ok', label: 'Матч идет', hint: 'Следите за блокерами первого хода и считайте следующий ход.' };
  if (room.status === 'paused') return { tone: 'warn', label: 'Пауза / разбор', hint: 'Обсудите решения или продолжите матч.' };
  if (room.status === 'finished') return { tone: 'ok', label: 'Матч завершен', hint: 'Откройте итоги и разберите топ решений.' };
  return { tone: 'warn', label: 'Статус неизвестен', hint: 'Проверьте комнату перед занятием.' };
}

function serverAdminCurrentInstruction(room) {
  if (!room) return 'Создайте комнату, затем покажите ученикам ссылку или QR.';
  const summary = serverAdminClassSummary(room);
  const firstBlocker = serverAdminHelpQueue(room)[0] || null;
  if (room.status === 'lobby') {
    if (!summary.playerCount) return 'Покажите QR/LAN-ссылку и код комнаты. Ученики входят без аккаунта.';
    if (summary.readyCount === summary.playerCount) return 'Все вошедшие готовы. Запускайте матч.';
    return `Дождитесь готовности: ${summary.readyCount}/${summary.playerCount}.`;
  }
  if (room.status === 'running' && firstBlocker) {
    return `Сначала помогите ${firstBlocker.player.companyName}: ${firstBlocker.issues.slice(0, 2).join(', ')}.`;
  }
  if (room.status === 'running') return 'Класс работает стабильно. Можно считать следующий ход или запустить учебную ситуацию.';
  if (room.status === 'paused') return 'Пауза активна: проведите короткий разбор и нажмите “Продолжить”.';
  if (room.status === 'finished') return 'Матч завершен: сравните рейтинг, прибыль, долги и решения лидеров.';
  return 'Проверьте статус комнаты.';
}

function renderServerAdminPriorityStrip(room) {
  const summary = serverAdminClassSummary(room);
  const gate = serverAdminLaunchGate(room);
  const readyPercent = summary.readyPercent || 0;
  const helpPercent = uiPercent(summary.helpCount, Math.max(1, summary.playerCount));
  return `
    <section class="server-admin-priority-strip ${escapeHtml(gate.tone)}" data-uiux-slice="classroom-cockpit">
      <article>
        <span>Что сделать преподавателю сейчас</span>
        <strong>${escapeHtml(serverAdminCurrentInstruction(room))}</strong>
        <small>${escapeHtml(gate.hint)}</small>
      </article>
      <div>
        <span class="${escapeHtml(gate.tone)}"><b>${escapeHtml(gate.label)}</b><small>статус запуска</small><i class="live-meter" style="--live-meter:${readyPercent}%"></i></span>
        <span><b>${summary.readyCount}/${summary.playerCount}</b><small>готовность</small><i class="live-meter" style="--live-meter:${readyPercent}%"></i></span>
        <span class="${summary.helpCount ? 'warn' : 'ok'}"><b>${summary.helpCount}</b><small>застряли</small><i class="live-meter" style="--live-meter:${helpPercent}%"></i></span>
        <span class="${summary.issueCounts.noMarketOffer ? 'warn' : 'ok'}"><b>${summary.issueCounts.noMarketOffer}</b><small>без заявки</small><i class="live-meter" style="--live-meter:${uiPercent(summary.issueCounts.noMarketOffer, Math.max(1, summary.playerCount))}%"></i></span>
      </div>
    </section>`;
}

function renderServerAdminLessonPlan(room) {
  if (!room) return '';
  const summary = serverAdminClassSummary(room);
  const firstBlocker = serverAdminHelpQueue(room)[0] || null;
  const readyEnough = summary.playerCount > 0 && summary.readyPercent >= 80;
  const phase = room.status === 'lobby'
    ? 'Подготовка'
    : room.status === 'finished'
      ? 'Итоги'
      : readyEnough
        ? 'Можно считать ход'
        : 'Помощь командам';
  const teacherAction = room.status === 'lobby'
    ? 'Попросите учеников ввести код, название компании и нажать “Готов”.'
    : room.status === 'finished'
      ? 'Откройте результаты, сравните топ-3 и объясните, почему победил лидер.'
      : firstBlocker
        ? `Подойдите к ${firstBlocker.player.companyName}: ${firstBlocker.issues.slice(0, 2).join(', ')}.`
        : 'Все основные блокеры закрыты. Можно запускать следующий ход и разобрать прибыль.';
  const steps = [
    ['1', 'Старт', room.status === 'lobby' ? 'active' : 'done', 'Все вошли по коду и нажали готовность.'],
    ['2', 'Первый цикл', ['running', 'paused'].includes(room.status) && room.day <= 2 ? 'active' : room.day > 2 || room.status === 'finished' ? 'done' : 'locked', 'Закупка → персонал → сборка → продажа.'],
    ['3', 'Разбор', ['running', 'paused'].includes(room.status) && room.day > 2 ? 'active' : room.status === 'finished' ? 'done' : 'locked', 'Сравните прибыль, склад и цену заявок.'],
    ['4', 'Финал', room.status === 'finished' ? 'active' : 'locked', 'Победитель, выводы и следующий матч.'],
  ];
  return `
    <div class="server-admin-lesson-plan top-gap" data-server-admin-lesson-plan>
      <div>
        <span class="factory-node-label">Сценарий занятия</span>
        <strong>${escapeHtml(phase)}</strong>
        <small>${escapeHtml(teacherAction)}</small>
      </div>
      <div class="server-admin-lesson-steps" aria-label="План урока">
        ${steps.map(([number, label, status, hint]) => `
          <span class="${escapeHtml(status)}">
            <b>${escapeHtml(number)}</b>
            <strong>${escapeHtml(label)}</strong>
            <small>${escapeHtml(hint)}</small>
          </span>
        `).join('')}
      </div>
    </div>`;
}

function serverAdminQuickLinks(meta) {
  const local = Array.isArray(meta?.localUrls) && meta.localUrls.length ? meta.localUrls[0] : 'http://127.0.0.1:3000';
  const lan = Array.isArray(meta?.lanUrls) && meta.lanUrls.length ? meta.lanUrls[0] : local;
  const base = String(lan || local).replace(/\/+$/, '');
  return {
    clientUrl: `${base}/client`,
    healthUrl: `${base}/api/health`,
  };
}

function serverAdminControlButtons(room) {
  if (!room) return '';
  const actions = room.teacherControls?.actions || {};
  const lifecycle = room.teacherControls?.lifecycle || {};
  const controls = [
    ['start-game', 'Старт', actions.startGame ?? room.status === 'lobby'],
    ['pause-game', 'Пауза', actions.pause ?? room.status === 'running'],
    ['resume-game', 'Продолжить', actions.resume ?? room.status === 'paused'],
    ['next-turn', 'Следующий ход', actions.nextTurn ?? room.status === 'running'],
    ['save-room', 'Сохранить', ['lobby', 'running', 'paused', 'finished'].includes(room.status)],
    ['add-bot', 'Добавить бота', room.status === 'lobby' && room.playerCount < room.maxPlayers],
    ['finish-room', 'Завершить матч', actions.finish ?? ['running', 'paused'].includes(room.status)],
    ['reset-room', 'Сброс', ['paused', 'finished', 'lobby'].includes(room.status)],
  ];
  return controls.map(([action, label, enabled]) => `
    <button type="button" class="${['finish-room', 'reset-room'].includes(action) ? 'danger ghost' : 'ghost'} ${lifecycle.primaryAction === action ? 'primary-teacher-action' : ''}" data-server-admin-action="${escapeHtml(action)}" ${enabled ? '' : 'disabled'}>
      ${escapeHtml(label)}
    </button>`).join('');
}

function renderServerAdminSelects({ rooms, selectedRoom, selectablePlayers, selectedPlayer, metricOptions, metricKey, adminDays }) {
  return `
    <div class="server-admin-controls">
      <label>
        <span>Комната</span>
        <select id="server-admin-room-select">
          ${rooms.map(room => `<option value="${escapeHtml(room.code)}" ${selectedRoom?.code === room.code ? 'selected' : ''}>${escapeHtml(room.name)} • ${escapeHtml(room.code)}</option>`).join('')}
        </select>
      </label>
      <label>
        <span>Компания</span>
        <select id="server-admin-player-select" ${selectedRoom ? '' : 'disabled'}>
          ${selectablePlayers.map(player => `<option value="${escapeHtml(player.id)}" ${selectedPlayer?.id === player.id ? 'selected' : ''}>${player.isHost ? '★ ' : ''}${escapeHtml(player.companyName)} (${escapeHtml(player.userName)})</option>`).join('')}
        </select>
      </label>
      <label>
        <span>Статистика</span>
        <select id="server-admin-metric-select" ${selectedRoom ? '' : 'disabled'}>
          ${metricOptions.map(([key, label]) => `<option value="${escapeHtml(key)}" ${metricKey === key ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}
        </select>
      </label>
      <label>
        <span>День</span>
        <select id="server-admin-day-select" ${selectedRoom ? '' : 'disabled'}>
          ${adminDays.map(day => `<option value="${escapeHtml(day.day)}" ${String(day.day) === state.serverAdminSelection.day ? 'selected' : ''}>День ${escapeHtml(day.day)}${Number(day.day) === selectedRoom?.day ? ' • текущий' : ''}</option>`).join('')}
        </select>
      </label>
    </div>`;
}

function renderCloudTeacherCrisisCards(selectedRoom) {
  if (!selectedRoom) return '';
  const activeEvent = selectedRoom.activeEvent || null;
  const canForceEvent = Boolean(selectedRoom.teacherControls?.actions?.forceEvent);
  return `
    <div class="crisis-card-panel top-gap">
      <div class="crisis-card-head">
        <span class="crisis-card-head-icon">${gameIcon('crisis')}</span>
        <div>
          <strong>Учебные ситуации</strong>
          <small>${activeEvent ? escapeHtml(activeEvent.title || activeEvent.label || activeEvent.key) : escapeHtml(t('teacher_force_event_hint'))}</small>
        </div>
      </div>
      <div class="crisis-card-grid">
        ${Object.entries(CRISIS_CARDS).slice(0, 3).map(([key, card]) => `
          <section class="crisis-card ${activeEvent?.key === key ? 'selected' : ''}">
            <div class="crisis-card-title">
              <span class="crisis-card-icon">${gameIcon(crisisCardIcon(key))}</span>
              <strong>${escapeHtml(card.title)}</strong>
              <small class="crisis-card-badge">${escapeHtml(card.effect)}</small>
            </div>
            <button type="button" data-cloud-teacher-action="force-event" data-cloud-teacher-value="${escapeHtml(key)}" ${canForceEvent ? '' : 'disabled'}>${iconButtonLabel('crisis', t('teacher_force_event_button'))}</button>
          </section>
        `).join('')}
      </div>
    </div>`;
}

function renderCompletedSessions() {
  const sessions = state.completedSessions || [];
  return `
    <section class="completed-sessions-panel top-gap" aria-labelledby="completed-sessions-title">
      <div class="completed-sessions-head">
        <div>
          <strong id="completed-sessions-title">История занятий</strong>
          <small>Последние завершённые комнаты и безопасные отчёты для разбора.</small>
        </div>
        <span>${sessions.length}/100</span>
      </div>
      <div class="completed-sessions-list">
        ${sessions.length ? sessions.map(session => `
          <article>
            <div>
              <strong>${escapeHtml(session.roomName || session.roomCode)}</strong>
              <small>${escapeHtml(session.scenarioLabel || session.scenarioKey)} · ${escapeHtml(new Date(session.finishedAt).toLocaleString('ru-RU'))}</small>
            </div>
            <span><b>${escapeHtml(session.standings?.[0]?.companyName || 'Без победителя')}</b><small>ход ${escapeHtml(String(session.day || 0))}</small></span>
            <div class="completed-session-actions">
              <button type="button" class="ghost" data-session-export="json" data-session-id="${escapeHtml(session.id)}">JSON</button>
              <button type="button" class="ghost" data-session-export="csv" data-session-id="${escapeHtml(session.id)}">CSV</button>
            </div>
          </article>`).join('') : '<p class="muted">Завершённых занятий пока нет.</p>'}
      </div>
    </section>`;
}

async function exportCompletedSession(sessionId, format) {
  const base = isCloudDeployment() ? '/api/teacher/sessions' : '/api/server/sessions';
  const response = await fetch(`${base}/${encodeURIComponent(sessionId)}/export?format=${encodeURIComponent(format)}`, {
    method: 'GET',
    headers: isCloudDeployment() ? teacherAuthHeaders() : {},
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Экспорт недоступен (${response.status})`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `biz-arena-session-${sessionId}.${format}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function bindCompletedSessionActions() {
  elements.serverAdminOverview?.querySelectorAll('[data-session-export]').forEach(button => {
    button.addEventListener('click', async () => {
      try {
        await exportCompletedSession(button.dataset.sessionId, button.dataset.sessionExport);
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  });
}

function renderCloudTeacherOverview() {
  if (!elements.serverAdminOverview) return;
  const overview = state.teacherOverview || {};
  const rooms = overview.rooms || [];
  const selectedRoom = rooms.find(room => room.code === state.serverAdminSelection.roomCode) || rooms[0] || null;
  if (selectedRoom && state.serverAdminSelection.roomCode !== selectedRoom.code) state.serverAdminSelection.roomCode = selectedRoom.code;

  if (!hasRenderSignatureChanged('cloudTeacherOverview', {
    hasTeacherSession: Boolean(state.teacherSessionToken),
    teacherAccountId: state.teacherAccount?.id || '',
    teacherAccountEmail: state.teacherAccount?.email || '',
    teacherAccountName: state.teacherAccount?.displayName || '',
    overviewVersion: overview.version || 0,
    generatedAt: overview.generatedAt || '',
    roomCount: overview.roomCount || 0,
    humanPlayers: overview.humanPlayers || 0,
    runningRooms: overview.runningRooms || 0,
    storage: overview.storage || null,
    selectedRoomCode: state.serverAdminSelection.roomCode || '',
    selectedRoomVersion: selectedRoom?.version || 0,
    selectedRoomStatus: selectedRoom?.status || '',
    selectedRoomDay: selectedRoom?.day || 0,
    selectedRoomTick: selectedRoom?.tick || 0,
    selectedReadyCount: selectedRoom?.readyCount || 0,
    selectedHumanCount: selectedRoom?.humanCount || 0,
    selectedActiveEventKey: selectedRoom?.activeEvent?.key || '',
    selectedCanForceEvent: Boolean(selectedRoom?.teacherControls?.actions?.forceEvent),
    completedSessions: (state.completedSessions || []).map(session => [session.id, session.finishedAt]),
  })) return;

  if (!state.teacherSessionToken || !state.teacherAccount) {
    elements.serverAdminOverview.innerHTML = `
      <div class="server-admin-toolbar">
        <div>
          <strong>Cloud Classroom: вход преподавателя</strong>
          <small>Войдите, чтобы создавать комнаты и управлять классом без LAN.</small>
        </div>
        <span class="server-day-pill">Cloud</span>
      </div>
      <form id="cloud-teacher-auth-form" class="stack-form top-gap">
        <label><span>Email преподавателя</span><input id="cloud-teacher-email" type="email" autocomplete="username" required /></label>
        <label><span>Имя на занятии</span><input id="cloud-teacher-name" type="text" maxlength="24" placeholder="Преподаватель" /></label>
        <label><span>Пароль</span><input id="cloud-teacher-password" type="password" autocomplete="current-password" minlength="8" required /></label>
        <div class="button-pair">
          <button type="submit" data-cloud-auth="login">Войти</button>
          <button type="submit" class="ghost" data-cloud-auth="register">Зарегистрироваться</button>
        </div>
      </form>`;
    elements.serverAdminOverview.querySelector('#cloud-teacher-auth-form')?.addEventListener('submit', submitCloudTeacherAuth);
    return;
  }

  const selectedUrl = selectedRoom?.studentUrl || cloudStudentUrl(selectedRoom?.code || '');
  elements.serverAdminOverview.innerHTML = `
    <div class="server-admin-toolbar">
      <div>
        <strong>Cloud Classroom: панель преподавателя</strong>
        <small>${escapeHtml(state.teacherAccount.displayName || state.teacherAccount.email)} • комнаты живут на внешнем сервере, ученикам нужна только ссылка.</small>
      </div>
      <button type="button" class="ghost" data-cloud-logout>Выйти</button>
    </div>
    <form id="cloud-create-room-form" class="server-admin-controls top-gap">
      <label><span>Комната</span><input id="cloud-room-name" type="text" maxlength="24" value="Cloud Classroom" required /></label>
      <label><span>Компания хоста</span><input id="cloud-host-company" type="text" maxlength="24" value="Teacher Host" required /></label>
      <label><span>Сценарий</span><select id="cloud-scenario"><option value="motorcycles">Завод мотоциклов</option><option value="drones">Фабрика дронов</option><option value="smartphones">Сборка смартфонов</option></select></label>
      <label><span>Сложность</span><select id="cloud-difficulty"><option value="easy">Легкая</option><option value="normal">Нормальная</option><option value="hard">Сложная</option></select></label>
      <button type="submit">Создать комнату</button>
    </form>
    <div class="server-health-grid top-gap">
      <span><b>${overview.roomCount || 0}</b><small>комнат</small></span>
      <span><b>${overview.humanPlayers || 0}</b><small>учеников</small></span>
      <span><b>${overview.runningRooms || 0}</b><small>матчей идет</small></span>
      <span><b>${overview.storage?.durable ? 'да' : 'demo'}</b><small>хранилище</small></span>
    </div>
    ${selectedRoom ? `
      ${renderServerAdminPriorityStrip(selectedRoom)}
      ${renderServerAdminClassSummary(selectedRoom)}
      ${renderServerAdminLessonPlan(selectedRoom)}
      <div class="server-admin-command-panel top-gap">
        <div>
          <strong>${escapeHtml(selectedRoom.name)} • ${escapeHtml(selectedRoom.code)}</strong>
          <small>${escapeHtml(selectedRoom.status)} • готово ${selectedRoom.readyCount}/${selectedRoom.humanCount}</small>
        </div>
        <div class="server-admin-quick-links">
          <span><b>Ссылка ученика</b><code>${escapeHtml(selectedUrl)}</code><button type="button" class="ghost" data-copy-url="${escapeHtml(selectedUrl)}">Скопировать</button></span>
          <span><b>Код комнаты</b><code>${escapeHtml(selectedRoom.code)}</code><button type="button" class="ghost" data-copy-url="${escapeHtml(selectedRoom.code)}">Скопировать</button></span>
        </div>
        <div class="network-doctor-share top-gap">
          <span>QR для этой комнаты</span>
          <strong>${escapeHtml(selectedUrl)}</strong>
          <img src="/api/qr?data=${encodeURIComponent(selectedUrl)}" alt="QR cloud room" />
        </div>
        <div class="server-admin-action-row">
          ${serverAdminControlButtons(selectedRoom).replaceAll('data-server-admin-action', 'data-cloud-teacher-action')}
        </div>
      </div>
      ${renderCloudTeacherCrisisCards(selectedRoom)}
      <div class="server-admin-help-panel top-gap">
        <strong>Кому нужна помощь</strong>
        <div>
          ${serverAdminHelpQueue(selectedRoom).length ? serverAdminHelpQueue(selectedRoom).map(item => `
            <span>
              <b>${escapeHtml(item.player.companyName)}</b>
              <small>${escapeHtml(item.issues.join(' • '))}</small>
            </span>`).join('') : '<span><b>Все в порядке</b><small>Критичных блокеров у команд не видно.</small></span>'}
        </div>
      </div>
    ` : `
      <div class="server-room-list top-gap">
        <article><div><strong>Комнат пока нет</strong><small>Создайте комнату, затем отправьте ученикам ссылку или QR.</small></div></article>
      </div>
    `}
    ${overview.storage?.warning ? `<div class="server-troubleshooting top-gap"><strong>Предупреждение хранилища</strong><ol><li>${escapeHtml(overview.storage.warning)}</li><li>Для restart-safe режима используйте VPS КАИ с постоянным BIZ_ARENA_DATA_DIR.</li></ol></div>` : ''}
    ${renderCompletedSessions()}`;

  elements.serverAdminOverview.querySelector('#cloud-create-room-form')?.addEventListener('submit', submitCloudCreateRoom);
  elements.serverAdminOverview.querySelector('[data-cloud-logout]')?.addEventListener('click', () => {
    persistTeacherSession('');
    state.teacherAccount = null;
    state.teacherOverview = null;
    renderServerAdminOverview();
  });
  elements.serverAdminOverview.querySelectorAll('[data-cloud-teacher-action]').forEach(button => {
    button.addEventListener('click', () => runCloudTeacherAction(button.dataset.cloudTeacherAction, {
      roomCode: selectedRoom?.code || '',
      value: button.dataset.cloudTeacherValue || '',
    }));
  });
  elements.serverAdminOverview.querySelectorAll('[data-copy-url]').forEach(button => {
    button.addEventListener('click', () => copyTextToClipboard(button.dataset.copyUrl).then(
      () => showToast(`Скопировано: ${button.dataset.copyUrl}`, 'success'),
      error => showToast(error.message, 'error')
    ));
  });
  bindCompletedSessionActions();
}

function renderServerAdminOverview() {
  if (!elements.serverAdminOverview) return;
  if (isCloudDeployment()) {
    renderCloudTeacherOverview();
    return;
  }
  const overview = state.serverOverview || {};
  const rooms = overview.rooms || [];
  const meta = state.runtimeMeta || {};
  const healthUrl = `${((Array.isArray(meta.lanUrls) && meta.lanUrls[0]) || (Array.isArray(meta.localUrls) && meta.localUrls[0]) || 'http://127.0.0.1:3000').replace(/\/+$/, '')}/api/health`;
  const selectedRoom = rooms.find(room => room.code === state.serverAdminSelection.roomCode) || rooms[0] || null;
  if (selectedRoom && state.serverAdminSelection.roomCode !== selectedRoom.code) state.serverAdminSelection.roomCode = selectedRoom.code;
  const adminDays = Array.isArray(selectedRoom?.adminDays) ? selectedRoom.adminDays : [];
  const currentDayValue = selectedRoom ? String(selectedRoom.day) : '';
  if (!state.serverAdminSelection.day || !adminDays.some(day => String(day.day) === state.serverAdminSelection.day)) {
    state.serverAdminSelection.day = currentDayValue;
  }
  const selectedDaySnapshot = adminDays.find(day => String(day.day) === state.serverAdminSelection.day) || null;
  const analysisRoom = selectedDaySnapshot
    ? { ...selectedRoom, ...selectedDaySnapshot, players: selectedDaySnapshot.players || [] }
    : selectedRoom;
  const selectablePlayers = analysisRoom?.players || [];
  const selectedPlayer = selectablePlayers.find(player => player.id === state.serverAdminSelection.playerId)
    || selectablePlayers.find(player => !player.isBot)
    || selectablePlayers[0]
    || null;
  if (selectedPlayer && state.serverAdminSelection.playerId !== selectedPlayer.id) state.serverAdminSelection.playerId = selectedPlayer.id;
  const metricOptions = serverAdminMetricOptions();
  const metricKey = metricOptions.some(([key]) => key === state.serverAdminSelection.metric)
    ? state.serverAdminSelection.metric
    : 'capital';
  state.serverAdminSelection.metric = metricKey;
  const metricLabel = metricOptions.find(([key]) => key === metricKey)?.[1] || 'Капитал';
  const metricRows = selectablePlayers
    .map(player => ({ player, value: Number(player[metricKey] || 0) }))
    .sort((left, right) => right.value - left.value);
  const metricMax = Math.max(1, ...metricRows.map(row => Math.abs(row.value)));
  const dayLabel = analysisRoom ? `День ${analysisRoom.day}` : 'День -';
  const quickLinks = serverAdminQuickLinks(meta);

  if (!hasRenderSignatureChanged('serverAdminOverview', {
    deployment: meta.deployment || '',
    appMode: meta.appMode || '',
    publicUrl: meta.publicUrl || '',
    lanUrls: meta.lanUrls || [],
    localUrls: meta.localUrls || [],
    storage: meta.storage || null,
    overviewVersion: overview.version || 0,
    generatedAt: overview.generatedAt || '',
    roomCount: overview.roomCount || 0,
    humanPlayers: overview.humanPlayers || 0,
    runningRooms: overview.runningRooms || 0,
    lanUrlCount: overview.lanUrlCount || 0,
    selectedRoomCode: selectedRoom?.code || '',
    selectedRoomVersion: selectedRoom?.version || 0,
    selectedRoomStatus: selectedRoom?.status || '',
    selectedRoomDay: selectedRoom?.day || 0,
    selectedRoomTick: selectedRoom?.tick || 0,
    selectedReadyCount: selectedRoom?.readyCount || 0,
    selectedHumanCount: selectedRoom?.humanCount || 0,
    selectedAdminDay: state.serverAdminSelection.day || '',
    selectedPlayerId: selectedPlayer?.id || '',
    selectedPlayerVersion: selectedPlayer?.version || 0,
    metricKey,
    metricRows: metricRows.map(row => [row.player.id, row.value]),
    quickLinks,
    completedSessions: (state.completedSessions || []).map(session => [session.id, session.finishedAt]),
  })) return;

  elements.serverAdminOverview.innerHTML = `
    <div class="server-admin-toolbar">
      <div>
        <strong>Панель преподавателя</strong>
        <small>${escapeHtml(dayLabel)} • ${escapeHtml(metricLabel)} • ${escapeHtml(meta.appMode || 'server')}</small>
      </div>
      <div class="server-admin-quick-links">
        <span><b>Ученики</b><code>${escapeHtml(quickLinks.clientUrl)}</code><button type="button" class="ghost" data-copy-url="${escapeHtml(quickLinks.clientUrl)}">Скопировать</button></span>
        <span><b>Health</b><code>${escapeHtml(quickLinks.healthUrl)}</code><button type="button" class="ghost" data-copy-url="${escapeHtml(quickLinks.healthUrl)}">Скопировать</button></span>
      </div>
    </div>
    ${renderServerAdminSelects({ rooms, selectedRoom, selectablePlayers, selectedPlayer, metricOptions, metricKey, adminDays })}
    ${selectedRoom ? `
      ${renderServerAdminPriorityStrip(selectedRoom)}
      ${renderServerAdminClassSummary(selectedRoom)}
      ${renderServerAdminLessonPlan(selectedRoom)}
      <section class="server-admin-cockpit top-gap">
        <div class="server-admin-cockpit-main">
          <div class="server-admin-command-panel">
            <div>
              <strong>${escapeHtml(selectedRoom.name)} • ${escapeHtml(selectedRoom.code)}</strong>
              <small>${escapeHtml(selectedRoom.status)} • готово ${selectedRoom.readyCount}/${selectedRoom.humanCount}</small>
            </div>
            <p class="muted">${escapeHtml(serverAdminCurrentInstruction(selectedRoom))}</p>
            <div class="server-admin-action-row">
              ${serverAdminControlButtons(selectedRoom)}
            </div>
          </div>
          <div class="server-admin-kpi-grid">
            ${renderAdminKpi('Комнаты', String(overview.roomCount || 0), 'активно на сервере')}
            ${renderAdminKpi('Ученики', String(overview.humanPlayers || 0), 'живых игроков')}
            ${renderAdminKpi('Готовность', `${selectedRoom.readyCount}/${selectedRoom.humanCount}`, 'к старту или ходу', selectedRoom.readyCount === selectedRoom.humanCount ? 'positive' : 'warn', { percent: uiPercent(selectedRoom.readyCount, selectedRoom.humanCount || 1) })}
            ${selectedPlayer ? renderAdminKpi('Выбранная команда', serverAdminMetricValue(selectedPlayer, metricKey), selectedPlayer.companyName, Number(selectedPlayer[metricKey] || 0) >= 0 ? 'positive' : 'danger', { percent: uiPercent(Math.abs(Number(selectedPlayer[metricKey] || 0)), metricMax) }) : renderAdminKpi('Выбранная команда', '—', 'команда не выбрана')}
          </div>
          <div class="server-admin-ranking">
            <strong>Рейтинг по метрике</strong>
            <div>
              ${metricRows.slice(0, 8).map((row, index) => `
                <span class="${row.player.id === selectedPlayer?.id ? 'active' : ''}">
                  <b>${index + 1}</b>
                  <strong>${escapeHtml(row.player.companyName)}</strong>
                  <small>${escapeHtml(serverAdminMetricValue(row.player, metricKey))}</small>
                  <i class="live-meter" style="--live-meter:${uiPercent(Math.abs(row.value), metricMax)}%"></i>
                </span>
              `).join('') || '<small class="muted">Нет данных для рейтинга.</small>'}
            </div>
          </div>
        </div>
        <aside class="server-admin-cockpit-side">
          <div class="server-admin-help-panel">
            <strong>Кому нужна помощь</strong>
            <div>
              ${serverAdminHelpQueue(selectedRoom).length ? serverAdminHelpQueue(selectedRoom).slice(0, 8).map(item => `
                <span>
                  <b>${escapeHtml(item.player.companyName)}</b>
                  <small>${escapeHtml(item.issues.join(' • '))}</small>
                </span>
              `).join('') : '<span><b>Все в порядке</b><small>Критичных блокеров у команд не видно.</small></span>'}
            </div>
          </div>
          <div class="server-admin-security-panel">
            <strong>Подозрительные действия</strong>
            <div>
              ${serverAdminSecurityQueue(selectedRoom).length ? serverAdminSecurityQueue(selectedRoom).slice(0, 6).map(item => `
                <span>
                  <b>${escapeHtml(item.player.companyName)} • ${escapeHtml(String(item.count))}</b>
                  <small>${escapeHtml(item.reason)} • ${escapeHtml(item.address)}</small>
                </span>
              `).join('') : '<span><b>Чисто</b><small>Отклоненных действий нет.</small></span>'}
            </div>
          </div>
          <div class="crisis-card-panel">
            <div class="crisis-card-head">
              <span class="crisis-card-head-icon">${gameIcon('crisis')}</span>
              <div>
                <strong>Учебные ситуации</strong>
                <small>${selectedRoom.activeEvent ? `Активно: ${escapeHtml(selectedRoom.activeEvent.title || selectedRoom.activeEvent.key)}` : 'Запуск через force-event'}</small>
              </div>
            </div>
            <div class="crisis-card-grid">
              ${Object.entries(CRISIS_CARDS).slice(0, 3).map(([key, card]) => `
                <section class="crisis-card ${selectedRoom.activeEvent?.key === key ? 'selected' : ''}">
                  <div class="crisis-card-title">
                    <span class="crisis-card-icon">${gameIcon(crisisCardIcon(key))}</span>
                    <strong>${escapeHtml(card.title)}</strong>
                    <small class="crisis-card-badge">${escapeHtml(card.effect)}</small>
                  </div>
                  <button type="button" data-server-admin-action="force-event" data-server-admin-value="${escapeHtml(key)}" ${['running', 'paused'].includes(selectedRoom.status) ? '' : 'disabled'}>${iconButtonLabel('crisis', 'Запустить')}</button>
                </section>
              `).join('')}
            </div>
          </div>
        </aside>
      </section>
    ` : `
      <div class="server-room-list top-gap">
        <article><div><strong>Комнат пока нет</strong><small>Создайте комнату, затем отправьте ученикам ссылку или QR.</small></div></article>
      </div>
    `}
    ${renderCompletedSessions()}
  `;
  elements.serverAdminOverview.querySelector('#server-admin-room-select')?.addEventListener('change', event => {
    state.serverAdminSelection.roomCode = event.target.value;
    state.serverAdminSelection.playerId = '';
    state.serverAdminSelection.day = '';
    renderServerAdminOverview();
  });
  elements.serverAdminOverview.querySelector('#server-admin-player-select')?.addEventListener('change', event => {
    state.serverAdminSelection.playerId = event.target.value;
    renderServerAdminOverview();
  });
  elements.serverAdminOverview.querySelector('#server-admin-metric-select')?.addEventListener('change', event => {
    state.serverAdminSelection.metric = event.target.value;
    renderServerAdminOverview();
  });
  elements.serverAdminOverview.querySelector('#server-admin-day-select')?.addEventListener('change', event => {
    state.serverAdminSelection.day = event.target.value;
    state.serverAdminSelection.playerId = '';
    renderServerAdminOverview();
  });
  elements.serverAdminOverview.querySelectorAll('[data-server-admin-action]').forEach(button => {
    button.addEventListener('click', () => runServerAdminAction(button.dataset.serverAdminAction, button.dataset.serverAdminValue));
  });
  elements.serverAdminOverview.querySelectorAll('[data-copy-url]').forEach(button => {
    button.addEventListener('click', () => copyTextToClipboard(button.dataset.copyUrl).then(
      () => showToast(`Скопировано: ${button.dataset.copyUrl}`, 'success'),
      error => showToast(error.message, 'error')
    ));
  });
  elements.serverAdminOverview.querySelector('[data-server-admin-export]')?.addEventListener('click', exportServerAdminSnapshot);
  bindCompletedSessionActions();
}

async function runServerAdminAction(action, value = '') {
  const roomCode = state.serverAdminSelection.roomCode;
  if (!roomCode) {
    showToast('Сначала выберите комнату.', 'error');
    return;
  }
  try {
    await request('/api/server/action', {
      method: 'POST',
      body: JSON.stringify({ roomCode, action, value }),
    });
    await fetchRuntimeMeta();
    showToast('Команда панели преподавателя выполнена.', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function submitCloudTeacherAuth(event) {
  event.preventDefault();
  const mode = event.submitter?.dataset?.cloudAuth || 'login';
  const email = document.querySelector('#cloud-teacher-email')?.value || '';
  const password = document.querySelector('#cloud-teacher-password')?.value || '';
  const displayName = document.querySelector('#cloud-teacher-name')?.value || '';
  try {
    const data = await request(`/api/teacher/${mode}`, {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    });
    persistTeacherSession(data.teacherSessionToken || '');
    state.teacherAccount = data.teacher || null;
    await fetchRuntimeMeta();
    setupRealtimeChannel();
    showToast(mode === 'register' ? 'Аккаунт преподавателя создан.' : 'Вход выполнен.', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function submitCloudCreateRoom(event) {
  event.preventDefault();
  try {
    const data = await request('/api/teacher/action', {
      method: 'POST',
      headers: teacherAuthHeaders(),
      body: JSON.stringify({
        action: 'create-room',
        roomName: document.querySelector('#cloud-room-name')?.value || 'Cloud Classroom',
        companyName: document.querySelector('#cloud-host-company')?.value || 'Teacher Host',
        scenarioKey: document.querySelector('#cloud-scenario')?.value || 'motorcycles',
        difficulty: document.querySelector('#cloud-difficulty')?.value || 'easy',
      }),
    });
    state.serverAdminSelection.roomCode = data.result?.roomCode || '';
    await fetchRuntimeMeta();
    showToast('Cloud room создана. Скопируйте ссылку ученикам.', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function runCloudTeacherAction(action, { roomCode, value = '' } = {}) {
  if (!roomCode) {
    showToast('Сначала создайте или выберите cloud room.', 'error');
    return;
  }
  try {
    await request('/api/teacher/action', {
      method: 'POST',
      headers: teacherAuthHeaders(),
      body: JSON.stringify({ roomCode, action, value }),
    });
    await fetchRuntimeMeta();
    showToast('Cloud команда выполнена.', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function exportServerAdminSnapshot() {
  const overview = state.serverOverview || {};
  const rooms = overview.rooms || [];
  const room = rooms.find(item => item.code === state.serverAdminSelection.roomCode) || rooms[0] || null;
  if (!room) {
    showToast('Нет комнаты для экспорта.', 'error');
    return;
  }
  const adminDays = Array.isArray(room.adminDays) ? room.adminDays : [];
  const selectedDay = adminDays.find(day => String(day.day) === state.serverAdminSelection.day)
    || adminDays.find(day => Number(day.day) === Number(room.day))
    || null;
  const analysisRoom = selectedDay ? { ...room, ...selectedDay, players: selectedDay.players || [] } : room;
  const metricKey = state.serverAdminSelection.metric || 'capital';
  const metricLabel = serverAdminMetricOptions().find(([key]) => key === metricKey)?.[1] || 'Капитал';
  const players = analysisRoom.players || [];
  const selectedPlayer = players.find(player => player.id === state.serverAdminSelection.playerId)
    || players.find(player => !player.isBot)
    || players[0]
    || null;
  const ranking = players
    .map(player => ({
      companyName: player.companyName,
      userName: player.userName,
      value: Number(player[metricKey] || 0),
      displayValue: serverAdminMetricValue(player, metricKey),
    }))
    .sort((left, right) => right.value - left.value);
  const quickLinks = serverAdminQuickLinks(state.runtimeMeta || {});
  const payload = {
    exportedAt: new Date().toISOString(),
    room: {
      code: room.code,
      name: room.name,
      status: room.status,
      day: analysisRoom.day,
      currentDay: room.day,
      scenarioLabel: room.scenarioLabel,
      humanCount: room.humanCount,
      readyCount: room.readyCount,
    },
    selectedMetric: { key: metricKey, label: metricLabel },
    selectedCompany: selectedPlayer,
    classSummary: serverAdminClassSummary(room),
    classStats: analysisRoom.classStats,
    helpQueue: serverAdminHelpQueue(room).map(item => ({
      companyName: item.player.companyName,
      userName: item.player.userName,
      issues: item.issues,
    })),
    securityQueue: serverAdminSecurityQueue(room).map(item => ({
      companyName: item.player.companyName,
      userName: item.player.userName,
      rejectedActionCount: item.count,
      reason: item.reason,
      address: item.address,
    })),
    ranking,
    links: quickLinks,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `biz-arena-teacher-${safeFilePart(room.code, 'room')}-day-${safeFilePart(analysisRoom.day, 'day')}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showToast('Снимок преподавателя экспортирован.', 'success');
}

function serverCopyValue(kind) {
  const meta = state.runtimeMeta || {};
  const local = Array.isArray(meta.localUrls) && meta.localUrls.length ? meta.localUrls[0] : 'http://127.0.0.1:3000';
  const lan = Array.isArray(meta.lanUrls) && meta.lanUrls.length ? meta.lanUrls[0] : '';
  if (kind === 'local') return local;
  if (kind === 'lan') return lan || local;
  return `${(lan || local).replace(/\/+$/, '')}/client`;
}

async function copyServerAddress(kind) {
  try {
    const value = serverCopyValue(kind);
    await copyTextToClipboard(value);
    showToast(`Скопировано: ${value}`, 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
}
