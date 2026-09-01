window.BizArenaFrontendModules = Object.assign(window.BizArenaFrontendModules || {}, {
  student: Object.freeze({ contract: 'student-ui-v1' }),
});

function studentDirectoryRoom(room = {}) {
  return {
    directoryId: String(room.directoryId || ''),
    name: String(room.name || 'Занятие преподавателя'),
    scenarioLabel: String(room.scenarioLabel || 'Учебный сценарий'),
    playerCount: Math.max(0, Number(room.playerCount) || 0),
    maxPlayers: Math.max(0, Number(room.maxPlayers) || 0),
  };
}

function setStudentDirectoryStatus(message = '', tone = '') {
  if (!elements.studentDirectoryStatus) return;
  elements.studentDirectoryStatus.textContent = message;
  elements.studentDirectoryStatus.dataset.tone = tone;
}

function renderStudentDirectory() {
  if (!isClientMode() || !elements.studentDirectoryPanel || !elements.joinForm) return;
  const directory = state.studentDirectory;
  const selected = directory.selectedRoom;
  const isDirectory = directory.view === 'directory';
  elements.studentDirectoryPanel.hidden = !isDirectory;
  elements.joinForm.hidden = isDirectory;
  elements.studentDirectoryTab.setAttribute('aria-selected', String(isDirectory));
  elements.studentCodeTab.setAttribute('aria-selected', String(!isDirectory));
  elements.studentDirectoryTab.tabIndex = isDirectory ? 0 : -1;
  elements.studentCodeTab.tabIndex = isDirectory ? -1 : 0;
  elements.studentEntryHeading.textContent = isDirectory
    ? 'Подключиться к занятию'
    : selected ? 'Подтвердите вход в занятие' : 'Ввести код комнаты';
  const note = document.querySelector('[data-client-entry-note] span');
  if (note) note.textContent = isDirectory
    ? 'Выберите занятие преподавателя или введите код комнаты вручную.'
    : selected ? 'Проверьте выбранное занятие, затем введите код преподавателя.' : 'Введите пятисимвольный код, который показал преподаватель.';
  elements.studentDirectoryBack.hidden = !selected || directory.view === 'manual';
  elements.studentDirectorySelection.hidden = !selected;
  elements.studentDirectorySelection.innerHTML = selected
    ? `<strong>${escapeHtml(selected.name)}</strong><span>${escapeHtml(selected.scenarioLabel)} · ${selected.playerCount} из ${selected.maxPlayers} мест занято</span>`
    : '';
  elements.studentDirectoryRetry.hidden = !directory.error;
  if (isDirectory && elements.studentDirectoryList) {
    if (directory.loading) elements.studentDirectoryList.innerHTML = '<p class="muted">Ищем доступные занятия…</p>';
    else if (directory.error) elements.studentDirectoryList.innerHTML = '';
    else if (!directory.rooms.length) {
      elements.studentDirectoryList.innerHTML = '<div class="student-directory-empty"><strong>Сейчас нет открытых занятий</strong><span>Попросите преподавателя открыть лобби или используйте вкладку «Ввести код».</span></div>';
    } else {
      elements.studentDirectoryList.innerHTML = directory.rooms.map(room => `
        <button type="button" class="student-directory-card" data-directory-select="${escapeHtml(room.directoryId)}">
          <strong>${escapeHtml(room.name)}</strong><span>${escapeHtml(room.scenarioLabel)}</span>
          <small>${room.playerCount} из ${room.maxPlayers} мест занято</small><b>Выбрать занятие →</b>
        </button>`).join('');
    }
    if (directory.focusDirectoryId && !directory.loading && !directory.error) {
      const focusDirectoryId = directory.focusDirectoryId;
      window.requestAnimationFrame(() => {
        const target = [...elements.studentDirectoryList.querySelectorAll('[data-directory-select]')]
          .find(button => button.dataset.directorySelect === focusDirectoryId);
        (target || elements.studentDirectoryTab)?.focus();
        directory.focusDirectoryId = '';
      });
    }
  }
  if (!directory.loading && !directory.error && isDirectory) setStudentDirectoryStatus('');
}

function showStudentDirectoryView(view, { focus = 'content' } = {}) {
  if (!isClientMode()) return;
  const directory = state.studentDirectory;
  if (view === 'directory' || view === 'manual') directory.selectedRoom = null;
  directory.view = view;
  renderStudentDirectory();
  if (view === 'directory') {
    loadStudentRoomDirectory();
    if (focus !== 'return') window.requestAnimationFrame(() => elements.studentDirectoryTab?.focus());
  } else window.requestAnimationFrame(() => (focus === 'tab' ? elements.studentCodeTab : elements.roomCodeInput)?.focus());
}

function selectStudentDirectoryRoom(directoryId) {
  const selectedRoom = state.studentDirectory.rooms.find(room => room.directoryId === directoryId);
  if (!selectedRoom) return;
  state.studentDirectory.selectedRoom = selectedRoom;
  state.studentDirectory.view = 'confirmation';
  if (elements.roomCodeInput) elements.roomCodeInput.value = '';
  setJoinFormStatus();
  renderStudentDirectory();
  window.requestAnimationFrame(() => elements.roomCodeInput?.focus());
}

async function loadStudentRoomDirectory({ force = false } = {}) {
  if (!isClientMode()) return;
  const directory = state.studentDirectory;
  if (directory.loading || (!force && directory.loadedAt && Date.now() - directory.loadedAt < 10_000)) return;
  directory.loading = true;
  directory.error = '';
  renderStudentDirectory();
  try {
    const data = await request('/api/rooms/directory');
    if (data?.contract !== 'public-room-directory-v1') throw new Error('Сервер вернул несовместимый список занятий.');
    directory.rooms = Array.isArray(data?.rooms) ? data.rooms.map(studentDirectoryRoom).filter(room => room.directoryId) : [];
    directory.loadedAt = Date.now();
    setStudentDirectoryStatus(directory.rooms.length ? `${directory.rooms.length} ${directory.rooms.length === 1 ? 'занятие доступно' : 'занятий доступно'}.` : '');
  } catch (error) {
    directory.rooms = [];
    directory.error = friendlyConnectionError(error.message);
    setStudentDirectoryStatus(directory.error, 'error');
  } finally {
    directory.loading = false;
    renderStudentDirectory();
  }
}

function studentRuCount(value, one, few, many) {
  const count = Math.abs(Math.trunc(Number(value) || 0));
  const lastTwo = count % 100;
  const last = count % 10;
  const form = lastTwo >= 11 && lastTwo <= 14
    ? many
    : last === 1
      ? one
      : last >= 2 && last <= 4
        ? few
        : many;
  return `${count} ${form}`;
}

function factoryScenarioLead(scenario) {
  if (!scenario) return '';
  const demandBand = Number.isFinite(scenario.baseDemandMin) && Number.isFinite(scenario.baseDemandMax)
    ? `${scenario.baseDemandMin}-${scenario.baseDemandMax} ${t('factory_orders_day')}`
    : t('factory_variable_demand');
  const priceBand = scenario.priceRange
    ? `${rub(scenario.priceRange.min)}-${rub(scenario.priceRange.max)} RUB`
    : t('factory_dynamic_price_band');
  return `${scenario.description || `${scenario.productLabel} ${t('factory_portfolio_line')}.`} ${t('factory_lead_demand')}: ${demandBand}. ${t('factory_lead_price_band')}: ${priceBand}.`;
}

function factoryScenarioChecklist(scenario) {
  if (!scenario) return t('factory_checklist_default');
  return `1. ${t('factory_checklist_stock')}: ${scenario.components.length}. 2. ${t('factory_checklist_hire')}. 3. ${t('factory_checklist_assemble')}: ${scenario.productLabel}. 4. ${t('factory_checklist_sell')}. 5. ${t('factory_checklist_next')}.`;
}

function nextGuidedFactoryStep() {
  if (!isFactoryRoom()) return null;
  const factory = state.player.factory;
  const components = factory.components || [];
  const missingRecipePart = components.find(component => component.quantity < component.recipe);
  if (missingRecipePart) {
    return {
      department: 'warehouse',
      label: t('guided_buy_parts'),
      title: t('guided_open_warehouse'),
      why: `${missingRecipePart.label} ${t('guided_missing_part')}`,
      outcome: t('guided_missing_part_outcome'),
    };
  }
  if ((factory.workers || []).length === 0) {
    return {
      department: 'workforce',
      label: t('guided_hire_worker'),
      title: t('guided_open_people'),
      why: t('guided_no_workers'),
      outcome: t('guided_no_workers_outcome'),
    };
  }
  if ((factory.assemblyCapacity || 0) > 0 && (factory.finishedGoods || 0) === 0) {
    return {
      department: 'assembly',
      label: t('guided_assemble_units'),
      title: t('guided_open_assembly'),
      why: t('guided_ready_to_assemble'),
      outcome: t('guided_ready_to_assemble_outcome'),
    };
  }
  if ((factory.finishedGoods || 0) > 0 && !(factory.saleOffer?.quantity || 0)) {
    return {
      tab: 'market',
      label: t('guided_submit_order'),
      title: t('guided_open_sales'),
      why: t('guided_stock_no_offer'),
      outcome: t('guided_stock_no_offer_outcome'),
    };
  }
  if ((factory.saleOffer?.quantity || 0) > 0) {
    return {
      action: 'next-turn',
      label: t('guided_resolve_turn'),
      title: t('guided_press_next_turn'),
      why: t('guided_order_ready'),
      outcome: t('guided_order_ready_outcome'),
    };
  }
  return {
    department: 'warehouse',
    label: t('guided_start_cycle'),
    title: t('guided_open_warehouse'),
    why: t('guided_start_with_parts'),
    outcome: t('guided_start_with_parts_outcome'),
  };
}

function marketRailSparkline(history) {
  const source = (history || []).slice(-10);
  const fallback = '0,42 16,34 32,39 48,28 64,30 80,20 96,25 112,12 128,18 144,10 160,14';
  if (source.length < 2) return fallback;
  const values = source.map(item => Number(item.avgPrice || item.demand || item.totalSales || 0));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  return values.map((value, index) => {
    const x = Math.round((index / Math.max(values.length - 1, 1)) * 160);
    const y = Math.round(46 - ((value - min) / range) * 36);
    return `${x},${y}`;
  }).join(' ');
}

function studentMarketRailRenderSignature() {
  const room = state.room;
  const player = state.player;
  return {
    teacherHost: Boolean(player?.isTeacherHost),
    room: {
      code: room?.code || '',
      status: room?.status || '',
      day: room?.day || 0,
      tick: room?.tick || 0,
      factoryScenario: room?.factoryScenario || null,
      contractBoard: room?.contractBoard || null,
    },
    market: room?.market || null,
    factoryStats: room?.factoryStats || null,
    player: {
      price: player?.price || 0,
      factory: player?.factory || null,
      turnGuide: player?.turnGuide || null,
    },
    viewer: isTeacherViewer() ? 'teacher' : 'student',
    language: state.settings.language,
  };
}

function renderGameMarketRail() {
  if (!elements.gameMarketRail) return;
  if (!hasRenderSignatureChanged('studentMarketRail', studentMarketRailRenderSignature())) return;
  if (state.player?.isTeacherHost) {
    elements.gameMarketRail.innerHTML = '';
    return;
  }
  if (!state.room) {
    elements.gameMarketRail.innerHTML = `
      <section class="side-rail-card">
        <h3>Рынок</h3>
        <p class="muted">Данные появятся после входа в комнату.</p>
      </section>`;
    return;
  }

  const room = state.room;
  const player = state.player || {};
  const scenario = room.factoryScenario || {};
  const latest = (room.market || []).at(-1) || null;
  const demand = latest?.demand ?? scenario.baseDemandMax ?? 0;
  const avgPrice = latest?.avgPrice ?? player.factory?.saleOffer?.price ?? scenario.priceRange?.max ?? player.price ?? 0;
  const totalSales = latest?.totalSales ?? 0;
  const offer = player.factory?.saleOffer || null;
  const stock = player.factory?.finishedGoods ?? player.productStock ?? 0;
  const factoryMode = isFactoryRoom();
  const factoryStats = room.factoryStats || {};
  const orderBook = scenario.marketBook || [];
  const contracts = factoryMode ? [] : (room.contractBoard || []).slice(0, 2);
  const step = factoryMode ? nextGuidedFactoryStep() : null;
  const teacherView = isTeacherViewer();
  const stepTab = step?.action === 'next-turn' ? 'events' : (step?.tab || 'operations');
  const teacherCopy = teacherView
    ? `<button type="button" class="ghost" data-rail-game-tab="teacher">Открыть пульт</button>
       <button type="button" class="ghost" data-rail-game-tab="intel">Подсказка класса</button>`
    : `<div class="rail-next-step">
        <span>Что делать сейчас</span>
        <strong>${escapeHtml(step?.title || 'Следите за маршрутом команды')}</strong>
        <small>${escapeHtml(step?.why || 'Следующее действие показано в верхней панели.')}</small>
      </div>
      <button type="button" class="ghost" data-rail-game-tab="${escapeHtml(stepTab)}">${escapeHtml(step?.action === 'next-turn' ? 'Открыть отчёт хода' : (step?.label || 'Перейти к действию'))}</button>`;
  const contractMarkup = contracts.length
    ? contracts.map(contract => {
      const progress = Number(contract.progress || 0);
      const target = Number(contract.targetSales || contract.quantity || 1);
      const pct = Math.max(0, Math.min(100, Math.round((progress / Math.max(target, 1)) * 100)));
      const dueSoon = Number(contract.expiresDay || 0) <= Number(room.day || 1) + 2;
      const statusClass = contract.completed ? 'open' : dueSoon ? 'waiting' : 'open';
      const statusLabel = contract.completed ? 'Выполнен' : dueSoon ? 'Риск срыва' : 'В процессе';
      return `
        <article class="contract-mini-card">
          <strong>${escapeHtml(contract.title || contract.name || 'Контракт')}</strong>
          <span>${progress}/${target} шт. / ${money(contract.reward || contract.price || 0)}</span>
          <small class="room-state ${statusClass}">${statusLabel}</small>
          <span class="live-meter" style="--live-meter: ${pct}%"></span>
        </article>`;
    }).join('')
    : '<p class="muted">Активных контрактов пока нет.</p>';
  const contractSectionMarkup = `
    <section class="side-rail-card">
      <div class="rail-card-head">
        <h3>Контракты (${(room.contractBoard || []).length})</h3>
        <span class="mini-badge ${contracts.length ? 'ok' : 'warn'}">${contracts.length ? 'есть' : 'нет'}</span>
      </div>
      ${contractMarkup}
      <button type="button" class="ghost" data-rail-game-tab="market">Все контракты →</button>
    </section>`;
  const factoryHasData = Boolean(factoryStats.hasData && factoryStats.latest);
  const topSeller = factoryStats.topSeller || null;
  const topSellerText = topSeller
    ? `${topSeller.playerName}: ${topSeller.sold} шт. по ${money(topSeller.price)}`
    : 'Появится после первого расчёта рынка';
  const factoryMarketSignalMarkup = `
    <section class="side-rail-card" data-factory-market-signal="factory-order-book-v1">
      <div class="rail-card-head">
        <h3>Книга заявок</h3>
        <span class="mini-badge ${orderBook.length ? 'ok' : 'warn'}">${orderBook.length ? `${orderBook.length} заявок` : 'нет заявок'}</span>
      </div>
      <div class="factory-market-signal-grid">
        <span><small>Исполнено спроса</small><strong>${factoryHasData ? `${factoryStats.totalSales}/${factoryStats.latest.demand}` : 'Ждёт расчёта'}</strong></span>
        <span><small>Незакрытый спрос</small><strong>${factoryHasData ? `${factoryStats.unmatchedDemand} шт.` : '—'}</strong></span>
        <span><small>Исполнение</small><strong>${factoryHasData ? `${factoryStats.sellThroughPct}%` : '—'}</strong></span>
      </div>
      <div class="factory-market-leader">
        <span>Лидер хода</span>
        <strong>${escapeHtml(topSellerText)}</strong>
      </div>
      <button type="button" class="ghost" data-rail-game-tab="market">Открыть рынок →</button>
    </section>`;

  elements.gameMarketRail.innerHTML = `
    <section class="side-rail-card rail-live-market-card">
      <div class="rail-card-head">
        <h3>Рынок</h3>
        <span class="mini-badge ok">АКТИВНО</span>
      </div>
      <div class="market-rail-stats">
        <article><span>Общий спрос</span><strong>${compactMarketNumber(demand)} шт.</strong></article>
        <article><span>Цена рынка</span><strong>${money(avgPrice)}</strong></article>
        <article><span>Продано</span><strong>${compactMarketNumber(totalSales)} шт.</strong></article>
        <article><span>Ваш запас</span><strong>${compactMarketNumber(stock)} шт.</strong></article>
      </div>
      <svg class="rail-chart" viewBox="0 0 160 52" aria-hidden="true">
        <polyline points="${marketRailSparkline(room.market || [])}" />
      </svg>
      <div class="rail-offer-row">
        <span>Ваша заявка</span>
        <strong>${offer ? `${offer.quantity || 0} @ ${money(offer.price || 0)}` : 'Нет заявки'}</strong>
      </div>
      <button type="button" class="ghost" data-rail-game-tab="market">Подробнее →</button>
    </section>
    ${factoryMode ? factoryMarketSignalMarkup : contractSectionMarkup}
    <section class="side-rail-card">
      <h3>${teacherView ? 'Преподаватель' : 'Помощь'}</h3>
      ${teacherCopy}
    </section>`;

  elements.gameMarketRail.querySelectorAll('[data-rail-game-tab]').forEach(button => {
    button.addEventListener('click', () => setGameTab(button.dataset.railGameTab, {
      opener: button,
      pushWorkspaceHistory: true,
      focusDialog: true,
    }));
  });
}

function renderGuidedAction() {
  const config = currentDifficultyConfig();
  if (config.uiMode !== 'guided' || !isFactoryRoom()) return '';
  const step = nextGuidedFactoryStep();
  if (!step) return '';
  const guidedTab = step.action === 'next-turn' ? 'events' : step.tab;
  const control = step.action && step.action !== 'next-turn'
    ? `<button type="button" data-guided-action="${step.action}">${step.label}</button>`
    : guidedTab
      ? `<button type="button" data-guided-game-tab="${guidedTab}">${step.action === 'next-turn' ? 'Открыть отчёт хода' : step.label}</button>`
      : `<button type="button" data-guided-factory-node="${step.department}">${step.label}</button>`;
  return `
    <section class="guided-action-panel">
      <div>
        <div class="factory-node-label">${t('guided_flow')}</div>
        <strong>${step.title}</strong>
        <p>${step.why}</p>
        <small>${step.outcome}</small>
      </div>
      ${control}
    </section>
  `;
}

function studentRouteStatusLabel(status, active) {
  if (active) return 'сейчас';
  if (status === 'ready') return 'готово';
  if (status === 'blocked') return 'ждет';
  if (status === 'attention') return 'проверить';
  return 'дальше';
}

function studentRouteDisplayLabel(step) {
  const labels = {
    purchase: 'Купить',
    workforce: 'Нанять',
    personnel: 'Нанять',
    assembly: 'Собрать',
    market: 'Продать',
    finish: 'Завершить ход',
  };
  if (labels[step?.key]) return labels[step.key];
  const rawLabel = String(step?.label || '');
  if (/закуп|склад|детал/i.test(rawLabel)) return 'Купить';
  if (/персонал|люд|работ|найм/i.test(rawLabel)) return 'Нанять';
  if (/сбор|производ/i.test(rawLabel)) return 'Собрать';
  if (/продаж|рынок|заявк|маркет/i.test(rawLabel)) return 'Продать';
  if (/заверш|ход|итог/i.test(rawLabel)) return 'Завершить ход';
  return rawLabel || 'Шаг';
}

function studentRouteDisplayHint(step) {
  const hints = {
    purchase: 'детали',
    workforce: 'люди',
    personnel: 'люди',
    assembly: 'товар',
    market: 'заявка',
    finish: 'итог',
  };
  return hints[step?.key] || step?.shortLabel || step?.summary || '';
}

function studentRoutePrimaryActionLabel(stepKey, fallback = 'Открыть шаг') {
  const labels = {
    purchase: 'Открыть Склад — купить детали',
    workforce: 'Открыть Команду — нанять сотрудника',
    personnel: 'Открыть Команду — нанять сотрудника',
    assembly: 'Открыть Сборочную линию — собрать товар',
    sale: 'Открыть Отгрузку — выставить заявку',
    market: 'Открыть Отгрузку — выставить заявку',
    reports: 'Перейти к завершению хода',
    finish: 'Перейти к завершению хода',
  };
  return labels[stepKey] || fallback;
}

function renderStudentRouteFlowline(routeItems = null) {
  const flow = routeItems || [
    { label: 'Купить', hint: 'детали', status: 'pending' },
    { label: 'Нанять', hint: 'люди', status: 'pending' },
    { label: 'Собрать', hint: 'товар', status: 'pending' },
    { label: 'Продать', hint: 'заявка', status: 'pending' },
    { label: 'Завершить ход', hint: 'итог', status: 'pending' },
  ];
  return `
    <div class="student-route-flowline student-route-track" aria-label="Купить → Нанять → Собрать → Продать → Завершить ход">
      ${flow.map((step, index) => {
        const active = Boolean(step.active);
        const status = step.status || (active ? 'attention' : 'pending');
        const className = active ? 'active' : status === 'ready' ? 'done' : status === 'blocked' ? 'locked' : status === 'attention' ? 'attention' : '';
        return `
        <span class="${className}" data-student-route-step="${escapeHtml(step.key || step.label || `step-${index + 1}`)}" data-status="${escapeHtml(status)}" aria-label="${index + 1}. ${escapeHtml(step.label)}: ${escapeHtml(studentRouteStatusLabel(status, active))}, ${escapeHtml(step.hint || '')}" ${active ? 'aria-current="step"' : ''}>
          <b>${index + 1}</b>
          <strong>${escapeHtml(step.label)}</strong>
          <small>${escapeHtml(studentRouteStatusLabel(status, active))}: ${escapeHtml(step.hint || '')}</small>
        </span>`;
      }).join('')}
    </div>`;
}

function renderStudentStatusMetric({ icon, value, label, tone = '' }) {
  return `
    <article class="student-route-status-card ${escapeHtml(tone)}">
      <span class="student-status-icon">${gameIcon(icon)}</span>
      <div>
        <b>${escapeHtml(String(value))}</b>
        <small>${escapeHtml(label)}</small>
      </div>
    </article>`;
}

function renderStudentCommandKpis({ collapsible = false } = {}) {
  const factory = state.player?.factory || {};
  const workers = factory.workers || [];
  const inventoryStock = Object.values(factory.inventory || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  const componentStock = (factory.components || []).reduce((sum, component) => sum + Number(component.quantity || 0), 0);
  const rawStock = inventoryStock || componentStock;
  const saleQuantity = Number(factory.saleOffer?.quantity || 0);
  const profit = Number(state.player?.lastTickBreakdown?.profit || 0);
  const metrics = `
    <div class="student-command-kpis" aria-label="Ключевые показатели команды">
      ${renderLiveMetricCard({ label: 'Деньги', value: money(state.player?.money || 0), hint: `${profit >= 0 ? '+' : ''}${money(profit)} за ход`, percent: uiPercent(Math.max(0, state.player?.money || 0), Math.max(1, state.player?.netWorth || state.player?.money || 1)), tone: profit >= 0 ? 'ok' : 'danger', icon: 'cash' })}
      ${renderLiveMetricCard({ label: 'Склад', value: `${Number(factory.finishedGoods || 0)} ед.`, hint: `${rawStock} деталей`, percent: uiPercent(Number(factory.finishedGoods || 0) + rawStock, Math.max(1, Number(factory.finishedGoods || 0) + rawStock + saleQuantity)), tone: factory.finishedGoods ? 'ok' : 'warn', icon: 'warehouse' })}
      ${renderLiveMetricCard({ label: 'Сотрудники', value: `${workers.length}`, hint: `мощность ${Number(factory.assemblyCapacity || 0)}`, percent: uiPercent(workers.length, Math.max(1, workers.length + 1)), tone: workers.length ? 'ok' : 'warn', icon: 'teams' })}
      ${renderLiveMetricCard({ label: 'Заявка', value: `${saleQuantity}`, hint: saleQuantity ? `${money(factory.saleOffer?.price || 0)} за ед.` : 'не выставлена', percent: uiPercent(saleQuantity, Math.max(1, saleQuantity + Number(factory.finishedGoods || 0))), tone: saleQuantity ? 'ok' : 'warn', icon: 'market' })}
    </div>`;
  if (!collapsible) return metrics;
  return `
    <details class="student-command-kpis-disclosure">
      <summary><span>Показатели предприятия</span><small>деньги, склад, команда и заявка</small></summary>
      ${metrics}
    </details>`;
}

function renderStudentFactoryBuilding(stationKey, scene = {}) {
  const stockLevel = scene.stockLevel || 'empty';
  const teamCount = Math.max(0, Math.min(4, Number(scene.workerCount) || 0));
  const runState = scene.runState || 'idle';
  const goodsLevel = scene.goodsLevel || 'empty';
  const truckState = scene.truckState || 'hidden';
  const buildings = {
    purchase: `
      <svg class="student-factory-building student-factory-building-warehouse" data-factory-building="purchase" data-stock="${stockLevel}" viewBox="0 0 180 138" aria-hidden="true" focusable="false">
        <ellipse class="student-factory-building-shadow" cx="92" cy="122" rx="72" ry="11"></ellipse>
        <polygon class="student-factory-building-face face-top" points="24,52 82,21 151,54 91,88"></polygon>
        <polygon class="student-factory-building-face face-left" points="24,52 91,88 91,119 24,82"></polygon>
        <polygon class="student-factory-building-face face-right" points="91,88 151,54 151,86 91,119"></polygon>
        <polyline class="student-factory-building-ridge" points="24,52 82,21 151,54"></polyline>
        <g class="factory-prop skylights">
          <polygon points="46,47 72,33 86,40 60,55"></polygon>
          <polygon points="68,58 94,44 108,51 82,65"></polygon>
        </g>
        <path class="factory-prop wall-seams" d="M105 80 L105 111 M119 72 L119 103 M133 64 L133,95"></path>
        <polygon class="student-factory-building-door" points="108,86 137,70 137,94 108,110"></polygon>
        <g class="factory-prop awning">
          <polygon points="106,82 137,65 142,68 111,85"></polygon>
          <path d="M111,86 L111,92 M139,68 L139,74"></path>
        </g>
        <polygon class="factory-prop door-step" points="108,112 137,96 143,99 114,115"></polygon>
        <path class="student-factory-building-detail" d="M39 62 L39 83 M53 69 L53 91 M67 77 L67 98"></path>
        <g class="student-factory-building-cargo cargo-l1">
          <polygon points="14,91 28,84 41,91 27,99"></polygon>
          <polygon points="14,91 27,99 27,111 14,103"></polygon>
          <polygon points="27,99 41,91 41,103 27,111"></polygon>
        </g>
        <g class="student-factory-building-cargo cargo-l2">
          <polygon points="43,101 55,95 67,101 55,108"></polygon>
          <polygon points="43,101 55,108 55,119 43,112"></polygon>
          <polygon points="55,108 67,101 67,112 55,119"></polygon>
          <polygon points="70,93 81,87 92,93 81,99"></polygon>
          <polygon points="70,93 81,99 81,110 70,104"></polygon>
          <polygon points="81,99 92,93 92,104 81,110"></polygon>
        </g>
        <g class="student-factory-building-cargo cargo-l3">
          <polygon points="8,76 20,69 32,76 20,83"></polygon>
          <polygon points="8,76 20,83 20,101 8,94"></polygon>
          <polygon points="20,83 32,76 32,94 20,101"></polygon>
        </g>
      </svg>`,
    workforce: `
      <svg class="student-factory-building student-factory-building-office" data-factory-building="workforce" data-team="${teamCount}" viewBox="0 0 180 150" aria-hidden="true" focusable="false">
        <ellipse class="student-factory-building-shadow" cx="91" cy="134" rx="61" ry="10"></ellipse>
        <polygon class="student-factory-building-face face-top" points="48,35 91,12 139,36 95,61"></polygon>
        <polygon class="student-factory-building-face face-left" points="48,35 95,61 95,126 48,99"></polygon>
        <polygon class="student-factory-building-face face-right" points="95,61 139,36 139,101 95,126"></polygon>
        <polyline class="student-factory-building-ridge" points="48,35 91,12 139,36"></polyline>
        <g class="factory-prop roof-unit">
          <polygon points="96,26 106,21 114,25 104,30"></polygon>
          <polygon points="96,26 104,30 104,38 96,34"></polygon>
          <polygon points="104,30 114,25 114,32 104,38"></polygon>
          <path d="M106,28 L110,26"></path>
        </g>
        <path class="factory-prop antenna" d="M124,20 L124,6"></path>
        <circle class="factory-prop antenna-dot" cx="124" cy="5" r="1.8"></circle>
        <g class="student-factory-building-windows">
          <path d="M59 51 L71 58 L71 69 L59 62 Z M78 61 L89 67 L89 78 L78 72 Z M59 73 L71 80 L71 91 L59 84 Z M78 83 L89 89 L89 100 L78 94 Z"></path>
          <path d="M104 68 L116 61 L116 73 L104 80 Z M121 58 L132 52 L132 64 L121 70 Z M104 89 L116 82 L116 94 L104 101 Z M121 79 L132 73 L132 85 L121 91 Z"></path>
        </g>
        <polygon class="student-factory-building-door" points="78,101 91,108 91,124 78,116"></polygon>
        <g class="factory-prop entry-canopy">
          <polygon points="73,98 95,88 100,91 78,101"></polygon>
          <path d="M80,102 L80,108 M96,93 L96,99"></path>
        </g>
        <path class="student-factory-building-detail" d="M42 105 L95 136 L146 107"></path>
        <g class="worker-figure w1">
          <circle class="wf-head" cx="56" cy="104" r="2.6"></circle>
          <path class="wf-body" d="M53 107 L59 107 L57.4 115 L54.6 115 Z"></path>
        </g>
        <g class="worker-figure w2">
          <circle class="wf-head" cx="74" cy="114" r="2.6"></circle>
          <path class="wf-body" d="M71 117 L77 117 L75.4 125 L72.6 125 Z"></path>
        </g>
        <g class="worker-figure w3">
          <circle class="wf-head" cx="98" cy="126" r="2.6"></circle>
          <path class="wf-body" d="M95 129 L101 129 L99.4 137 L96.6 137 Z"></path>
        </g>
        <g class="worker-figure w4">
          <circle class="wf-head" cx="122" cy="118" r="2.6"></circle>
          <path class="wf-body" d="M119 121 L125 121 L123.4 129 L120.6 129 Z"></path>
        </g>
      </svg>`,
    assembly: `
      <svg class="student-factory-building student-factory-building-assembly" data-factory-building="assembly" data-run="${runState}" viewBox="0 0 200 145" aria-hidden="true" focusable="false">
        <ellipse class="student-factory-building-shadow" cx="101" cy="129" rx="84" ry="11"></ellipse>
        <polygon class="student-factory-building-face face-left" points="20,65 104,108 104,128 20,84"></polygon>
        <polygon class="student-factory-building-face face-right" points="104,108 177,69 177,89 104,128"></polygon>
        <polygon class="student-factory-building-face face-top" points="20,65 47,50 67,60 88,39 109,50 130,29 177,54 104,108"></polygon>
        <polyline class="student-factory-building-ridge" points="47,50 67,60 88,39 109,50 130,29 177,54"></polyline>
        <g class="factory-prop roof-vents">
          <polygon points="52,52 60,48 66,51 58,55"></polygon>
          <polygon points="52,52 58,55 58,61 52,58"></polygon>
          <polygon points="58,55 66,51 66,57 58,61"></polygon>
          <polygon points="86,42 94,38 100,41 92,45"></polygon>
          <polygon points="86,42 92,45 92,51 86,48"></polygon>
          <polygon points="92,45 100,41 100,47 92,51"></polygon>
        </g>
        <g class="factory-prop smoke-plume">
          <ellipse class="smoke s1" cx="147" cy="6" rx="4" ry="3"></ellipse>
          <ellipse class="smoke s2" cx="153" cy="-2" rx="5.5" ry="4"></ellipse>
          <ellipse class="smoke s3" cx="161" cy="-10" rx="7" ry="5"></ellipse>
        </g>
        <polygon class="student-factory-building-chimney face-right" points="139,19 153,12 153,47 139,54"></polygon>
        <polygon class="student-factory-building-chimney face-top" points="139,19 146,15 160,21 153,25"></polygon>
        <polygon class="factory-prop chimney-cap" points="137,22 154,13 158,15 141,24"></polygon>
        <polygon class="student-factory-building-door" points="119,101 150,84 150,101 119,118"></polygon>
        <polygon class="factory-prop door-pulse" points="116,98 152,79 152,105 116,122"></polygon>
        <g class="student-factory-building-conveyor">
          <path d="M9 100 L58 126 L71 119 L22 93 Z"></path>
          <circle cx="27" cy="107" r="4"></circle>
          <circle cx="47" cy="118" r="4"></circle>
        </g>
        <g class="conveyor-flow">
          <g class="conveyor-box b1"><polygon points="52,115 59,111 64,114 57,118"></polygon><polygon points="52,115 57,118 57,123 52,120"></polygon><polygon points="57,118 64,114 64,119 57,123"></polygon></g>
          <g class="conveyor-box b2"><polygon points="38,107 45,103 50,106 43,110"></polygon><polygon points="38,107 43,110 43,115 38,112"></polygon><polygon points="43,110 50,106 50,111 43,115"></polygon></g>
          <g class="conveyor-box b3"><polygon points="24,99 31,95 36,98 29,102"></polygon><polygon points="24,99 29,102 29,107 24,104"></polygon><polygon points="29,102 36,98 36,103 29,107"></polygon></g>
        </g>
      </svg>`,
    market: `
      <svg class="student-factory-building student-factory-building-loading" data-factory-building="market" data-goods="${goodsLevel}" data-truck="${truckState}" viewBox="0 0 195 145" aria-hidden="true" focusable="false">
        <ellipse class="student-factory-building-shadow" cx="102" cy="130" rx="79" ry="10"></ellipse>
        <polygon class="student-factory-building-face face-top" points="31,55 89,24 160,58 101,91"></polygon>
        <polygon class="student-factory-building-face face-left" points="31,55 101,91 101,119 31,81"></polygon>
        <polygon class="student-factory-building-face face-right" points="101,91 160,58 160,87 101,119"></polygon>
        <polyline class="student-factory-building-ridge" points="31,55 89,24 160,58"></polyline>
        <path class="factory-prop dock-bumpers" d="M112,117 L119,113 M127,113 L134,109 M142,109 L149,105"></path>
        <g class="goods-stack g1">
          <polygon points="48,98 59,92 69,97 58,103"></polygon>
          <polygon points="48,98 58,103 58,113 48,108"></polygon>
          <polygon points="58,103 69,97 69,107 58,113"></polygon>
        </g>
        <g class="goods-stack g2">
          <polygon points="34,104 43,99 51,103 42,108"></polygon>
          <polygon points="34,104 42,108 42,117 34,113"></polygon>
          <polygon points="42,108 51,103 51,112 42,117"></polygon>
        </g>
        <g class="goods-stack g3">
          <polygon points="66,88 77,82 87,87 76,93"></polygon>
          <polygon points="66,88 76,93 76,109 66,104"></polygon>
          <polygon points="76,93 87,87 87,103 76,109"></polygon>
        </g>
        <polygon class="student-factory-building-door" points="112,89 147,70 147,94 112,113"></polygon>
        <path class="student-factory-building-detail" d="M41 67 L88 92 M55 60 L102 85"></path>
        <ellipse class="truck-exhaust" cx="99" cy="117" rx="5" ry="3.4"></ellipse>
        <g class="student-factory-building-truck truck-wrap">
          <polygon class="truck-top" points="105,112 137,95 166,109 133,127"></polygon>
          <polygon class="truck-side" points="105,112 133,127 133,137 105,122"></polygon>
          <polygon class="truck-front" points="133,127 166,109 166,120 133,137"></polygon>
          <circle cx="119" cy="127" r="5"></circle>
          <circle cx="151" cy="126" r="5"></circle>
        </g>
      </svg>`,
  };
  return buildings[stationKey] || '';
}

function renderStudentFactoryScene(routeItems = []) {
  const factory = state.player?.factory || {};
  const components = factory.components || [];
  const workers = factory.workers || [];
  const componentStock = components.reduce((sum, component) => sum + Number(component.quantity || 0), 0);
  const recipeTarget = components.reduce((sum, component) => sum + Number(component.recipe || 0), 0);
  const finishedGoods = Number(factory.finishedGoods || 0);
  const saleQuantity = Number(factory.saleOffer?.quantity || 0);
  const assemblyCapacity = Number(factory.assemblyCapacity || 0);
  const producedLastTick = Number(state.player?.producedLastTick || 0);
  const soldLastTick = Number(state.player?.soldLastTick || 0);
  const recipeSteps = Math.max(1, recipeTarget);
  const sceneState = {
    stockLevel: componentStock <= 0
      ? 'empty'
      : componentStock < recipeSteps * 2
        ? 'low'
        : componentStock < recipeSteps * 4
          ? 'mid'
          : 'full',
    workerCount: workers.length,
    runState: producedLastTick > 0 ? 'running' : assemblyCapacity > 0 ? 'ready' : 'idle',
    goodsLevel: finishedGoods <= 0 ? 'empty' : finishedGoods <= 2 ? 'low' : finishedGoods <= 5 ? 'mid' : 'full',
    truckState: saleQuantity > 0 ? 'parked' : soldLastTick > 0 ? 'sent' : 'hidden',
  };
  const routeByKey = new Map();
  routeItems.forEach(step => {
    routeByKey.set(step.key, step);
    if (step.key === 'personnel') routeByKey.set('workforce', step);
  });
  const scenario = state.room?.factoryScenario || {};
  const stations = [
    {
      key: 'purchase',
      label: 'Склад',
      value: `${componentStock} деталей`,
      hint: recipeTarget ? `Комплект на ${Math.floor(componentStock / Math.max(1, recipeTarget))} ед.` : 'Проверьте поставщиков',
      icon: 'warehouse',
      progress: uiPercent(componentStock, Math.max(recipeTarget * 4, 1)),
      activityState: componentStock > 0 ? 'stocked' : 'empty',
      activityLabel: componentStock > 0 ? 'Есть комплектующие' : 'Склад пуст',
      mapX: 24.3,
      mapY: 49.8,
      attrs: 'data-student-route-tab="purchase"',
    },
    {
      key: 'workforce',
      label: 'Команда',
      value: studentRuCount(workers.length, 'сотрудник', 'сотрудника', 'сотрудников'),
      hint: `Мощность ${assemblyCapacity} ед.`,
      icon: 'teams',
      progress: uiPercent(workers.length, Math.max(4, workers.length)),
      activityState: workers.length > 0 ? 'staffed' : 'empty',
      activityLabel: workers.length > 0 ? 'Команда укомплектована' : 'Нет сотрудников',
      mapX: 40.7,
      mapY: 27.6,
      attrs: 'data-student-route-tab="operations" data-student-route-department="workforce"',
    },
    {
      key: 'assembly',
      label: 'Сборочная линия',
      value: `${finishedGoods} готово`,
      hint: `${producedLastTick} собрано за ход`,
      icon: 'assembly',
      progress: uiPercent(finishedGoods, Math.max(1, assemblyCapacity + finishedGoods)),
      activityState: producedLastTick > 0
        ? 'running'
        : finishedGoods > 0
          ? 'stocked'
          : assemblyCapacity > 0
            ? 'ready'
            : 'idle',
      activityLabel: producedLastTick > 0
        ? 'Линия работает'
        : finishedGoods > 0
          ? 'Продукция собрана'
          : assemblyCapacity > 0
            ? 'Линия готова'
            : 'Линия простаивает',
      mapX: 76.7,
      mapY: 28.4,
      attrs: 'data-student-route-tab="operations" data-student-route-department="assembly"',
    },
    {
      key: 'market',
      label: 'Отгрузка',
      value: `${saleQuantity} в заявке`,
      hint: saleQuantity ? `${money(factory.saleOffer?.price || 0)} за ед.` : 'Заявка не выставлена',
      icon: 'market',
      progress: uiPercent(saleQuantity, Math.max(1, saleQuantity + finishedGoods)),
      activityState: saleQuantity > 0 ? 'listed' : finishedGoods > 0 ? 'waiting' : 'empty',
      activityLabel: saleQuantity > 0 ? 'Заявка выставлена' : finishedGoods > 0 ? 'Товар ждёт отгрузки' : 'Нет товара для отгрузки',
      mapX: 57.3,
      mapY: 57.7,
      attrs: 'data-student-route-tab="market"',
    },
  ];
  const stationState = station => {
    const routeStep = routeByKey.get(station.key) || {};
    const status = routeStep.active ? 'active' : routeStep.status === 'ready' ? 'ready' : routeStep.status || 'pending';
    const guidanceState = routeStep.active
      ? 'current'
      : status === 'ready'
        ? 'complete'
        : status === 'attention'
          ? 'attention'
          : 'waiting';
    const guidanceIcon = ({
      current: 'flash',
      complete: 'check',
      attention: 'alert',
      waiting: 'pause',
    })[guidanceState];
    const rawStatusLabel = studentRouteStatusLabel(status, Boolean(routeStep.active));
    return {
      routeStep,
      status,
      guidanceState,
      guidanceIcon,
      statusLabel: `${rawStatusLabel.charAt(0).toUpperCase()}${rawStatusLabel.slice(1)}`,
    };
  };
  const explicitActiveStationIndex = stations.findIndex(station => routeByKey.get(station.key)?.active);
  const unresolvedStationIndex = stations.findIndex(station => ['attention', 'blocked', 'pending'].includes(routeByKey.get(station.key)?.status));
  const activeStation = stations[explicitActiveStationIndex]
    || stations[unresolvedStationIndex]
    || stations[0];
  const activeStationState = stationState(activeStation);
  const activeStationIndex = stations.findIndex(station => station.key === activeStation.key);
  const routeCursorIndex = explicitActiveStationIndex >= 0
    ? explicitActiveStationIndex
    : unresolvedStationIndex >= 0
      ? unresolvedStationIndex
      : stations.length;
  const routeSegmentState = segmentIndex => {
    if (segmentIndex < routeCursorIndex) return 'complete';
    if (segmentIndex === routeCursorIndex) return 'current';
    if (segmentIndex === routeCursorIndex + 1) return 'next';
    return 'future';
  };
  const routeSegmentStates = [0, 1, 2].map(routeSegmentState);
  const routeMotionAttribute = routeState => routeState === 'current'
    ? 'data-factory-motion="route-flow"'
    : '';
  const cityMarketState = (state.room?.market || []).length ? 'active' : 'waiting';
  const cityCapitalState = Number(state.player?.money || 0) < 0
    ? 'risk'
    : Number(state.player?.money || 0) > Number(state.room?.factoryScenario?.startingMoney || 0)
      ? 'growth'
      : 'stable';

  return `
    <section class="student-factory-scene" data-student-factory-scene="live" data-scene-presentation="isometric-map" data-scene-version="v9-industrial-district" data-scene-active="${escapeHtml(activeStation.key)}" data-city-market-state="${cityMarketState}" data-city-capital-state="${cityCapitalState}" aria-label="Интерактивная карта предприятия">
      <div class="student-factory-scene-head">
        <div>
          <span class="factory-node-label">Ваше предприятие · текущий ход</span>
          <strong>${escapeHtml(scenario.label || 'Производственный комплекс')}</strong>
          <small>${escapeHtml(scenario.productLabel || factory.productUnit || 'Продукция')} · выберите здание на территории, чтобы открыть управление</small>
        </div>
        <span class="student-factory-live"><i></i> В РАБОТЕ</span>
      </div>
      <div class="student-factory-map" data-active-station="${escapeHtml(activeStation.key)}" aria-label="Производственные зоны предприятия">
        <svg class="student-factory-map-floor" viewBox="0 0 1000 520" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="student-factory-platform" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#25394a"></stop>
              <stop offset="50%" stop-color="#152737"></stop>
              <stop offset="100%" stop-color="#0a1622"></stop>
            </linearGradient>
            <radialGradient id="student-factory-campus-light" cx="50%" cy="42%" r="62%">
              <stop offset="0%" stop-color="rgba(146, 215, 225, 0.16)"></stop>
              <stop offset="100%" stop-color="rgba(5, 12, 20, 0)"></stop>
            </radialGradient>
            <pattern id="student-factory-grid" width="80" height="40" patternUnits="userSpaceOnUse">
              <path d="M0 20 L40 0 L80 20 L40 40 Z" fill="none" stroke="rgba(154, 190, 202, 0.08)" stroke-width="1"></path>
            </pattern>
            <marker id="student-factory-route-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto" markerUnits="strokeWidth">
              <path d="M0 0 L9 4.5 L0 9 Z" fill="#4ee7dc"></path>
            </marker>
          </defs>
          <ellipse class="student-factory-map-campus-glow" cx="500" cy="250" rx="430" ry="218" fill="url(#student-factory-campus-light)"></ellipse>
          <g class="student-factory-city-backdrop" data-factory-environment="city-backdrop" aria-hidden="true">
            <path class="student-factory-city-arterial" d="M-20 207 L128 130 L230 183 M770 177 L875 123 L1020 198"></path>
            <g class="student-factory-city-block city-block-west">
              <polygon class="city-building-top" points="18,136 60,114 98,133 56,156"></polygon>
              <polygon class="city-building-side" points="18,136 56,156 56,207 18,186"></polygon>
              <polygon class="city-building-front" points="56,156 98,133 98,184 56,207"></polygon>
              <path class="city-building-windows" d="M29 151 L45 159 M29 166 L45 174 M68 156 L87 146 M68 171 L87 161"></path>
              <polygon class="city-building-top" points="104,109 141,90 174,107 137,127"></polygon>
              <polygon class="city-building-side" points="104,109 137,127 137,171 104,153"></polygon>
              <polygon class="city-building-front" points="137,127 174,107 174,151 137,171"></polygon>
            </g>
            <g class="student-factory-city-block city-bank" data-city-landmark="bank">
              <polygon class="city-building-top" points="835,98 882,74 925,96 878,121"></polygon>
              <polygon class="city-building-side" points="835,98 878,121 878,185 835,162"></polygon>
              <polygon class="city-building-front" points="878,121 925,96 925,160 878,185"></polygon>
              <path class="city-bank-columns" d="M888 124 L888 169 M901 117 L901 162 M914 110 L914 155"></path>
              <path class="city-bank-signal" d="M880 82 L880 55 M870 62 L880 54 L890 62"></path>
            </g>
            <g class="student-factory-city-block city-market-district" data-city-landmark="market-district">
              <polygon class="city-building-top" points="928,157 957,142 985,156 956,172"></polygon>
              <polygon class="city-building-side" points="928,157 956,172 956,204 928,189"></polygon>
              <polygon class="city-building-front" points="956,172 985,156 985,188 956,204"></polygon>
              <path class="city-market-pulse" d="M938 151 L946 143 L954 148 L964 132 L976 138"></path>
            </g>
          </g>
          <polygon class="student-factory-map-platform-side" points="54,258 500,25 946,258 500,514"></polygon>
          <polygon class="student-factory-map-platform" points="54,232 500,0 946,232 500,488" fill="url(#student-factory-platform)"></polygon>
          <polygon class="student-factory-map-grid" points="54,232 500,0 946,232 500,488" fill="url(#student-factory-grid)"></polygon>
          <polygon class="student-factory-map-zone zone-purchase" points="92,269 264,179 394,246 220,341"></polygon>
          <polygon class="student-factory-map-zone zone-workforce" points="254,151 425,63 559,131 386,224"></polygon>
          <polygon class="student-factory-map-zone zone-assembly" points="623,160 797,71 911,130 734,224"></polygon>
          <polygon class="student-factory-map-zone zone-market" points="385,300 582,199 760,291 560,401"></polygon>
          <g class="student-factory-road-network">
            <g data-factory-road="campus-ring">
              <path class="student-factory-road-shadow" d="M500 62 L870 253 L500 450 L130 253 Z"></path>
              <path class="student-factory-road-shoulder" d="M500 62 L870 253 L500 450 L130 253 Z"></path>
              <path class="student-factory-road-surface" d="M500 62 L870 253 L500 450 L130 253 Z"></path>
              <path class="student-factory-road-centerline" d="M500 62 L870 253 L500 450 L130 253 Z"></path>
            </g>
            <g data-factory-road="purchase-access">
              <path class="student-factory-road-shadow" d="M210 296 Q229 287 243 268"></path>
              <path class="student-factory-road-shoulder" d="M210 296 Q229 287 243 268"></path>
              <path class="student-factory-road-surface" d="M210 296 Q229 287 243 268"></path>
              <path class="student-factory-road-centerline" d="M210 296 Q229 287 243 268"></path>
            </g>
            <g data-factory-road="workforce-access">
              <path class="student-factory-road-shadow" d="M350 139 Q381 130 406 154"></path>
              <path class="student-factory-road-shoulder" d="M350 139 Q381 130 406 154"></path>
              <path class="student-factory-road-surface" d="M350 139 Q381 130 406 154"></path>
              <path class="student-factory-road-centerline" d="M350 139 Q381 130 406 154"></path>
            </g>
            <g data-factory-road="assembly-access">
              <path class="student-factory-road-shadow" d="M800 193 Q785 177 766 162"></path>
              <path class="student-factory-road-shoulder" d="M800 193 Q785 177 766 162"></path>
              <path class="student-factory-road-surface" d="M800 193 Q785 177 766 162"></path>
              <path class="student-factory-road-centerline" d="M800 193 Q785 177 766 162"></path>
            </g>
            <g data-factory-road="market-access">
              <path class="student-factory-road-shadow" d="M650 371 Q612 351 575 318"></path>
              <path class="student-factory-road-shoulder" d="M650 371 Q612 351 575 318"></path>
              <path class="student-factory-road-surface" d="M650 371 Q612 351 575 318"></path>
              <path class="student-factory-road-centerline" d="M650 371 Q612 351 575 318"></path>
            </g>
            <g data-factory-road="main-gate">
              <path class="student-factory-road-shadow" d="M500 488 L500 450"></path>
              <path class="student-factory-road-shoulder" d="M500 488 L500 450"></path>
              <path class="student-factory-road-surface" d="M500 488 L500 450"></path>
              <path class="student-factory-road-centerline" d="M500 488 L500 450"></path>
            </g>
            <g class="student-factory-road-junctions">
              <circle cx="500" cy="62" r="15"></circle>
              <circle cx="870" cy="253" r="15"></circle>
              <circle cx="500" cy="450" r="15"></circle>
              <circle cx="130" cy="253" r="15"></circle>
              <circle cx="210" cy="296" r="12"></circle>
              <circle cx="350" cy="139" r="12"></circle>
              <circle cx="650" cy="371" r="12"></circle>
              <circle cx="800" cy="193" r="12"></circle>
            </g>
            <g class="student-factory-road-markings">
              <path d="M472 465 L528 465 M472 474 L528 474"></path>
              <path d="M183 281 L204 292 M191 272 L212 283 M798 211 L819 200 M806 220 L827 209"></path>
            </g>
          </g>
          <g class="student-factory-map-site-details">
            <path class="student-factory-map-perimeter" d="M87 229 L500 16 L914 229 L500 468 Z"></path>
            <g class="student-factory-map-gate">
              <path d="M462 454 L499 475 L537 453"></path>
              <path d="M473 447 L473 463 M526 446 L526 462"></path>
            </g>
            <g class="student-factory-map-lamps">
              <path d="M178 232 L178 211 M344 146 L344 124 M650 229 L650 207 M814 141 L814 120 M454 373 L454 350 M705 300 L705 278"></path>
              <circle cx="178" cy="210" r="4"></circle>
              <circle cx="344" cy="123" r="4"></circle>
              <circle cx="650" cy="206" r="4"></circle>
              <circle cx="814" cy="119" r="4"></circle>
              <circle cx="454" cy="349" r="4"></circle>
              <circle cx="705" cy="277" r="4"></circle>
            </g>
            <g class="student-factory-map-environment student-factory-map-parking" data-factory-environment="parking">
              <path d="M424 193 L458 175 L481 187 L447 206 Z M458 210 L492 192 L515 204 L481 223 Z M492 227 L526 209 L549 221 L515 240 Z"></path>
              <g class="student-factory-map-parked-car car-one">
                <polygon points="452,183 465,176 480,183 467,191"></polygon>
                <polygon points="452,183 467,191 467,198 452,190"></polygon>
                <polygon points="467,191 480,183 480,190 467,198"></polygon>
              </g>
              <g class="student-factory-map-parked-car car-two">
                <polygon points="519,216 531,210 545,217 533,224"></polygon>
                <polygon points="519,216 533,224 533,231 519,223"></polygon>
                <polygon points="533,224 545,217 545,224 533,231"></polygon>
              </g>
            </g>
            <g class="student-factory-map-environment student-factory-map-utilities" data-factory-environment="utilities">
              <path class="utility-pipe-shadow" d="M690 236 L720 251 L720 279 L752 296"></path>
              <path class="utility-pipe" d="M690 231 L720 246 L720 274 L752 291"></path>
              <circle cx="690" cy="231" r="6"></circle>
              <circle cx="720" cy="246" r="6"></circle>
              <circle cx="720" cy="274" r="6"></circle>
              <circle cx="752" cy="291" r="6"></circle>
            </g>
            <g class="student-factory-map-environment student-factory-map-safety" data-factory-environment="safety-markings">
              <path d="M330 143 L343 150 M338 137 L351 144 M346 132 L359 139 M632 359 L646 366 M640 353 L654 360 M648 347 L662 354"></path>
              <path class="student-factory-map-direction-arrows" d="M585 98 L606 109 L594 112 M833 267 L812 278 L824 281 M477 424 L456 413 L468 410"></path>
            </g>
            <g class="student-factory-map-environment student-factory-map-loading-yard" data-factory-environment="loading-yard">
              <path d="M542 352 L593 325 L639 349 L587 378 Z"></path>
              <path d="M559 348 L585 362 M580 337 L607 351 M601 326 L628 340"></path>
              <g class="student-factory-map-finished-pallets">
                <polygon points="624,319 639,311 655,319 640,328"></polygon>
                <polygon points="624,319 640,328 640,338 624,329"></polygon>
                <polygon points="640,328 655,319 655,329 640,338"></polygon>
              </g>
            </g>
            <g class="student-factory-map-environment student-factory-map-service-vehicle" data-factory-environment="service-vehicle" data-factory-motion="service-vehicle">
              <polygon class="service-vehicle-top" points="266,312 282,304 300,313 283,322"></polygon>
              <polygon class="service-vehicle-side" points="266,312 283,322 283,332 266,322"></polygon>
              <polygon class="service-vehicle-front" points="283,322 300,313 300,323 283,332"></polygon>
              <path class="service-vehicle-forks" d="M300 319 L316 327 M300 324 L313 331"></path>
              <circle cx="275" cy="325" r="4"></circle>
              <circle cx="291" cy="326" r="4"></circle>
            </g>
            <g class="student-factory-map-yard yard-purchase">
              <polygon points="122,286 143,275 164,286 143,297"></polygon>
              <polygon points="122,286 143,297 143,312 122,301"></polygon>
              <polygon points="143,297 164,286 164,301 143,312"></polygon>
              <polygon points="168,260 187,250 206,260 187,270"></polygon>
              <polygon points="168,260 187,270 187,283 168,273"></polygon>
              <polygon points="187,270 206,260 206,273 187,283"></polygon>
            </g>
            <g class="student-factory-map-yard yard-workforce">
              <path d="M304 151 L352 126 M320 167 L368 142 M336 183 L384 158 M352 199 L400 174"></path>
            </g>
            <g class="student-factory-map-yard yard-market">
              <path d="M493 337 L608 278 L654 302 L537 366 Z"></path>
              <path d="M515 335 L542 349 M545 319 L572 333 M576 303 L603 317"></path>
              <ellipse cx="688" cy="270" rx="18" ry="9"></ellipse>
              <path d="M670 270 L670 309 M706 270 L706 309 M670 309 Q688 327 706 309"></path>
            </g>
            <g class="student-factory-map-yard yard-assembly">
              <path d="M744 159 L812 124 M761 177 L829 142 M778 195 L846 160"></path>
              <polygon points="814,185 844,170 870,183 839,199"></polygon>
            </g>
            <g class="student-factory-map-greenery">
              <circle cx="242" cy="158" r="10"></circle>
              <circle cx="271" cy="143" r="8"></circle>
              <circle cx="754" cy="92" r="9"></circle>
              <circle cx="891" cy="209" r="8"></circle>
            </g>
          </g>
          <path class="student-factory-map-route-base" d="M243 268 L210 296 L130 253 L350 139 L406 154 M406 154 L350 139 L500 62 L800 193 L766 162 M766 162 L800 193 L870 253 L650 371 L575 318"></path>
          <path class="student-factory-map-route-segment" data-map-route="purchase-workforce" data-map-route-state="${routeSegmentStates[0]}" ${routeMotionAttribute(routeSegmentStates[0])} d="M243 268 L210 296 L130 253 L350 139 L406 154" marker-end="url(#student-factory-route-arrow)"></path>
          <path class="student-factory-map-route-segment" data-map-route="workforce-assembly" data-map-route-state="${routeSegmentStates[1]}" ${routeMotionAttribute(routeSegmentStates[1])} d="M406 154 L350 139 L500 62 L800 193 L766 162" marker-end="url(#student-factory-route-arrow)"></path>
          <path class="student-factory-map-route-segment" data-map-route="assembly-market" data-map-route-state="${routeSegmentStates[2]}" ${routeMotionAttribute(routeSegmentStates[2])} d="M766 162 L800 193 L870 253 L650 371 L575 318" marker-end="url(#student-factory-route-arrow)"></path>
          <g class="student-factory-map-route-stops">
            <circle cx="243" cy="268" r="7"></circle>
            <circle cx="406" cy="154" r="7"></circle>
            <circle cx="766" cy="162" r="7"></circle>
            <circle cx="575" cy="318" r="7"></circle>
          </g>
        </svg>
        ${stations.map((station, index) => {
          const { routeStep, status, guidanceState, guidanceIcon, statusLabel } = stationState(station);
          return `
            <button type="button" class="student-factory-node student-factory-map-node ${escapeHtml(status)}" data-scene-station="${escapeHtml(station.key)}" data-scene-status="${escapeHtml(status)}" data-factory-guidance-state="${escapeHtml(guidanceState)}" data-factory-activity="${escapeHtml(station.activityState)}" data-map-anchor="zone-center" data-map-x="${station.mapX}" data-map-y="${station.mapY}" ${station.attrs} ${routeStep.active ? 'aria-current="step"' : ''} style="--map-x:${station.mapX}%;--map-y:${station.mapY}%;--scene-progress:${station.progress}%" aria-label="${escapeHtml(`${station.label}: ${station.value}. ${station.hint}. ${station.activityLabel}. ${statusLabel}.`)}">
              <span class="student-factory-map-building">
                ${renderStudentFactoryBuilding(station.key, sceneState)}
                <span class="student-factory-map-node-index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
              </span>
              <span class="student-factory-map-marker" data-factory-map-marker="${escapeHtml(station.key)}" aria-hidden="true">
                <span>${String(index + 1).padStart(2, '0')}</span>
                <strong>${escapeHtml(station.label)}</strong>
                <i class="student-factory-map-state-icon">${gameIcon(guidanceIcon)}</i>
              </span>
              <span class="student-factory-map-tooltip" aria-hidden="true">
                <strong>${escapeHtml(station.value)}</strong>
                <small>${escapeHtml(station.hint)}</small>
                <small class="student-factory-map-activity-copy">${escapeHtml(station.activityLabel)}</small>
                <i class="student-factory-node-meter"><b></b></i>
              </span>
            </button>`;
        }).join('')}
      </div>
      <div class="student-factory-map-inspector" data-factory-map-inspector="${escapeHtml(activeStation.key)}">
        <span class="student-factory-map-inspector-icon">${gameIcon(activeStation.icon)}</span>
        <span class="student-factory-map-inspector-copy">
          <small>Сейчас в фокусе · ${String(activeStationIndex + 1).padStart(2, '0')}</small>
          <strong>${escapeHtml(activeStation.label)}</strong>
          <span>${escapeHtml(activeStation.hint)}</span>
        </span>
        <span class="student-factory-map-inspector-value">
          <small>${escapeHtml(activeStationState.statusLabel)}</small>
          <strong>${escapeHtml(activeStation.value)}</strong>
        </span>
        <span class="student-factory-map-inspector-action">Нажмите на здание, чтобы открыть участок</span>
        <i class="student-factory-node-meter" style="--scene-progress:${activeStation.progress}%"><b></b></i>
      </div>
    </section>`;
}

function renderStudentMarketPulse() {
  const factory = state.player?.factory || {};
  const latestMarket = (state.room?.market || []).slice(-1)[0] || {};
  const activeEvent = state.room?.activeEvent || null;
  const saleQuantity = Number(factory.saleOffer?.quantity || 0);
  const fallbackDemand = latestMarket.demand || state.room?.factoryScenario?.baseDemandMax || 1200;
  const history = marketChartHistory();
  const latest = history[history.length - 1] || latestMarket;
  const previous = history[history.length - 2] || latest;
  const demandValues = history.map(entry => Number(entry.demand || 0));
  const demandDelta = history.length >= 2 ? Number(latest.demand || 0) - Number(previous.demand || 0) : null;
  const offerPrice = Number(factory.saleOffer?.price || 0);
  return `
    <section class="student-market-mini" aria-label="Рынок команды">
      <div class="student-support-head">
        <strong>Спрос на рынке</strong>
        <span class="${demandDelta === null ? '' : demandDelta >= 0 ? 'positive' : 'negative'}">${demandDelta === null ? 'нет тренда' : `${demandDelta >= 0 ? '+' : ''}${compactMarketNumber(demandDelta)}`}</span>
      </div>
      <div class="student-market-chart">
        ${history.length ? miniChart(demandValues, 'positive') : '<div class="exchange-mini-placeholder">После первого расчёта появятся фактические данные</div>'}
        <div>
          <b>${compactMarketNumber(latest.demand || fallbackDemand)}</b>
          <small>ед. на этот ход</small>
        </div>
      </div>
      <div class="student-mini-stats">
        ${renderStudentMarketStat({ icon: 'goal', label: 'Заявка', ariaLabel: 'Объём заявки', value: `${saleQuantity || 0} ед.` })}
        ${renderStudentMarketStat({ icon: 'cash', label: 'Цена', ariaLabel: 'Ваша цена', value: offerPrice ? money(offerPrice) : 'нет' })}
        ${renderStudentMarketStat({ icon: 'market', label: 'Рынок', ariaLabel: 'Цена рынка', value: money(latest.avgPrice || 0) })}
      </div>
      ${activeEvent ? `
        <div class="student-market-event">
          <strong>${escapeHtml(activeEvent.title || activeEvent.label || 'Кризисная карта')}</strong>
          <small>${escapeHtml(activeEvent.description || 'Условия рынка изменились на этот ход.')}</small>
        </div>
      ` : ''}
    </section>`;
}

function renderStudentTaskStack(routeItems = []) {
  const items = routeItems.length ? routeItems : [
    { label: 'Купить', hint: 'детали', status: 'attention', active: true },
    { label: 'Нанять', hint: 'люди', status: 'pending' },
    { label: 'Собрать', hint: 'товар', status: 'pending' },
    { label: 'Продать', hint: 'заявка', status: 'pending' },
    { label: 'Завершить ход', hint: 'итог', status: 'pending' },
  ];
  const readyCount = items.filter(item => item.status === 'ready').length;
  const activeItem = items.find(item => item.active) || items.find(item => item.status !== 'ready') || items[items.length - 1];
  return `
    <details class="student-task-stack" data-student-plan-disclosure>
      <summary>
        <span>
          <strong>План хода</strong>
          <small>Текущий шаг: ${escapeHtml(activeItem?.label || 'завершить ход')}</small>
        </span>
        <b>${readyCount}/${items.length}</b>
      </summary>
      <div class="student-task-list">
        ${items.slice(0, 5).map((item, index) => {
          const status = item.status || 'pending';
          const className = item.active ? 'active' : status === 'ready' ? 'done' : status === 'blocked' ? 'locked' : status === 'attention' ? 'attention' : '';
          return `
            <article class="${className}">
              <b>${index + 1}</b>
              <div>
                <strong>${escapeHtml(item.label || 'Шаг')}</strong>
                <small>${escapeHtml(studentRouteStatusLabel(status, item.active))}: ${escapeHtml(item.hint || '')}</small>
              </div>
            </article>`;
        }).join('')}
      </div>
    </details>`;
}

function renderStudentCommandSupport(routeItems = [], primaryStepKey = '') {
  const marketHintsMarkup = renderMarketHints((state.player?.marketHints || []).slice(0, 2), { compact: true });
  const activeRoute = routeItems.find(item => item.active) || null;
  const activeKey = primaryStepKey || activeRoute?.key || state.player?.turnGuide?.primaryKey || 'purchase';
  const marketOpen = ['market', 'sale'].includes(activeKey);
  const marketContext = marketOpen
    ? 'Сейчас: выставьте заявку'
    : ['finish', 'reports'].includes(activeKey)
      ? 'Проверьте заявку перед итогом'
      : 'Понадобятся на шаге 4';
  const helpRequest = state.room?.helpRequest || null;
  const helpIsActive = helpRequest && ['open', 'acknowledged'].includes(helpRequest.status);
  const helpMarkup = helpIsActive ? `
    <section class="student-help-card ${escapeHtml(helpRequest.status)}" aria-live="polite">
      <div>
        <strong>${helpRequest.status === 'acknowledged' ? 'Преподаватель увидел запрос' : 'Преподаватель вызван'}</strong>
        <small>${escapeHtml(helpRequest.message || 'Ожидайте, преподаватель подойдет к вашей команде.')}</small>
      </div>
      <button type="button" class="ghost" data-cancel-teacher-help>Отменить</button>
    </section>` : `
    <details class="student-help-card">
      <summary>Позвать преподавателя</summary>
      <div class="student-help-form">
        <label><span>Где возник вопрос</span><select data-help-category>
          <option value="purchase">Закупка</option>
          <option value="staff">Сотрудники</option>
          <option value="assembly">Сборка</option>
          <option value="sale">Продажа</option>
          <option value="turn">Завершение хода</option>
          <option value="other">Другое</option>
        </select></label>
        <label><span>Коротко опишите проблему</span><textarea data-help-message maxlength="160" rows="2" placeholder="Необязательно"></textarea></label>
        <button type="button" data-request-teacher-help>Отправить запрос</button>
      </div>
    </details>`;
  return `
    <div class="student-command-support" data-ui-slot="role-action-rail">
      ${renderStudentTaskStack(routeItems)}
      <details class="student-market-disclosure" data-market-context="${escapeHtml(activeKey)}" ${marketOpen ? 'open' : ''}>
        <summary>
          <span class="student-market-disclosure-icon" aria-hidden="true">${gameIcon('market')}</span>
          <span>
            <strong>Рынок и рекомендации</strong>
            <small>${escapeHtml(marketContext)}</small>
          </span>
        </summary>
        <div class="student-market-disclosure-body">
          ${renderStudentMarketPulse()}
          ${marketHintsMarkup ? `<section class="student-market-quick-hints">${marketHintsMarkup}</section>` : ''}
        </div>
      </details>
      ${helpMarkup}
    </div>`;
}

function renderStudentCommandPanel({
  title,
  summary,
  currentLabel,
  routeItems,
  readyCount,
  totalCount,
  problemCount,
  currentText,
  buttonLabel,
  buttonAttrs,
  hintsMarkup = '',
  isGuidedFirstTurn = false,
}) {
  const safeReady = Math.max(0, Number(readyCount || 0));
  const safeTotal = Math.max(1, Number(totalCount || routeItems?.length || 1));
  const safeProblems = Math.max(0, Number(problemCount || 0));
  const activeRouteIndex = Array.isArray(routeItems) ? routeItems.findIndex(step => step.active) : -1;
  const activeRoute = activeRouteIndex >= 0 ? routeItems[activeRouteIndex] : null;
  const primaryStepKey = activeRoute?.key || activeRoute?.label || 'next';
  const stepCounter = activeRouteIndex >= 0 ? `Шаг ${activeRouteIndex + 1} из ${safeTotal}` : 'Следующий шаг';
  const mainStepTitle = currentLabel ? `${stepCounter}: ${currentLabel}` : (title || 'Следующий шаг');
  const detailTitle = title && currentLabel && title !== currentLabel && !String(title).includes(currentLabel) ? title : '';
  const summaryText = summary || currentText || '';
  const primaryButtonText = buttonLabel || (currentLabel ? `Перейти: ${currentLabel}` : 'Открыть шаг');
  const focusCards = [
    { label: 'Сейчас', value: currentLabel || 'следующий шаг', hint: currentText || 'выполните действие по маршруту', tone: 'active' },
    { label: 'Готовность', value: `${safeReady}/${safeTotal}`, hint: safeReady >= safeTotal ? 'можно завершать ход' : 'закройте оставшиеся шаги', tone: safeReady >= safeTotal ? 'ok' : 'warn' },
    { label: 'Проверить', value: String(safeProblems), hint: safeProblems ? 'есть блокер первого хода' : 'критичных блокеров нет', tone: safeProblems ? 'warn' : 'ok' },
  ];
  return `
    <section class="student-route-panel student-route-panel-v2 student-tycoon-console turn-guide-panel" data-ui-slot="primary-workspace" data-uiux-slice="student-first-turn-2" data-student-layout="map-first" data-student-flow-contract="first-turn-v2" data-student-guided-focus="${isGuidedFirstTurn ? 'first-turn' : 'standard'}" data-student-primary-step="${escapeHtml(primaryStepKey)}" data-student-route-ready="${safeReady >= safeTotal ? 'true' : 'false'}" data-student-problems="${safeProblems}" aria-label="Маршрут хода">
      <div class="student-command-head">
        <div class="student-route-main">
          <span class="factory-node-label">Маршрут хода</span>
          <h3>${escapeHtml(mainStepTitle)}</h3>
          ${detailTitle ? `<strong class="student-route-detail-title">${escapeHtml(detailTitle)}</strong>` : ''}
          <p>${escapeHtml(summaryText)}</p>
          <small>Купить → Нанять → Собрать → Продать → Завершить ход</small>
          <button type="button" class="student-primary-next-action" ${buttonAttrs}>${escapeHtml(primaryButtonText)}</button>
        </div>
        <div class="student-route-status-strip" aria-label="Статус хода">
          ${renderStudentStatusMetric({ icon: 'check', value: `${safeReady}/${safeTotal}`, label: 'готово', tone: 'ok' })}
          ${renderStudentStatusMetric({ icon: 'flash', value: currentLabel || 'шаг', label: 'текущий шаг', tone: 'active' })}
          ${renderStudentStatusMetric({ icon: safeProblems ? 'alert' : 'check', value: safeProblems, label: 'нужно проверить', tone: safeProblems ? 'warn' : 'ok' })}
        </div>
      </div>
      <i class="student-route-live-meter live-meter" style="--live-meter:${uiPercent(safeReady, safeTotal)}%"></i>
      ${renderStudentRouteFlowline(routeItems)}
      <div class="student-focus-strip" aria-label="Короткий статус первого хода">
        ${focusCards.map(card => `
          <article class="${card.tone}">
            <small>${escapeHtml(card.label)}</small>
            <strong>${escapeHtml(card.value)}</strong>
            <span>${escapeHtml(card.hint)}</span>
          </article>
        `).join('')}
      </div>
      <div class="student-command-stage">
        ${renderStudentFactoryScene(routeItems)}
        ${renderStudentCommandSupport(routeItems, primaryStepKey)}
      </div>
      ${renderStudentCommandKpis({ collapsible: isGuidedFirstTurn })}
      ${hintsMarkup}
    </section>`;
}

function renderStudentRoutePanel() {
  if (!isFactoryRoom()) return '';
  const guide = state.player?.turnGuide || null;
  if (guide?.steps?.length) {
    const target = guide.target || {};
    const primaryStep = guide.steps.find(step => step.key === guide.primaryKey) || guide.steps.find(step => step.status !== 'ready') || guide.steps[0];
    const readyCount = guide.progress?.ready || guide.steps.filter(step => step.status === 'ready').length;
    const totalCount = guide.progress?.total || guide.steps.length;
    const problemCount = guide.steps.filter(step => ['blocked', 'attention'].includes(step.status)).length;
    const routeItems = guide.steps.map(step => ({
      key: step.key,
      label: studentRouteDisplayLabel(step),
      hint: studentRouteDisplayHint(step),
      status: step.status || 'pending',
      active: step.key === guide.primaryKey,
    }));
    let targetTab = target.tab || 'operations';
    if (target.action === 'next-turn') targetTab = 'events';
    const buttonAttrs = `data-student-route-tab="${escapeHtml(targetTab)}" data-student-route-department="${escapeHtml(target.action === 'next-turn' ? '' : (target.department || ''))}" data-student-route-component="${escapeHtml(target.componentKey || '')}"`;
    return renderStudentCommandPanel({
      title: guide.title || 'Следующий шаг',
      summary: guide.summary || '',
      currentLabel: studentRouteDisplayLabel(primaryStep),
      routeItems,
      readyCount,
      totalCount,
      problemCount,
      currentText: primaryStep?.summary || guide.summary || 'Выполните текущий шаг, затем переходите дальше по маршруту.',
      buttonLabel: studentRoutePrimaryActionLabel(primaryStep?.key, target.action === 'next-turn' ? 'Открыть отчёт хода' : (guide.buttonLabel || 'Открыть шаг')),
      buttonAttrs,
      isGuidedFirstTurn: Number(state.room?.day || 0) === 1 && readyCount < totalCount,
    });
  }
  const factory = state.player.factory || {};
  const checklist = state.player.turnChecklist || [];
  const learningHints = state.player.learningHints || [];
  const issue = checklist.find(item => item.status !== 'ready') || null;
  const guidedStep = nextGuidedFactoryStep();
  const currentStep = issue || guidedStep || null;
  const route = [
    { key: 'purchase', label: 'Купить', hint: 'детали', tab: 'purchase', match: item => item.tab === 'purchase' || item.department === 'warehouse' || /склад|детал|закуп/i.test(item.label || '') },
    { key: 'workforce', label: 'Нанять', hint: 'люди', tab: 'operations', department: 'workforce', match: item => item.department === 'workforce' || /персонал|люд|работ/i.test(item.label || '') },
    { key: 'assembly', label: 'Собрать', hint: 'товар', tab: 'operations', department: 'assembly', match: item => item.department === 'assembly' || /сбор|производ/i.test(item.label || '') },
    { key: 'market', label: 'Продать', hint: 'заявка', tab: 'market', match: item => item.tab === 'market' || item.department === 'sales' || /продаж|заявк|маркет/i.test(item.label || '') },
    { key: 'reports', label: 'Завершить ход', hint: 'итог', tab: 'events', match: item => item.tab === 'events' || /отчет|результ|разбор/i.test(item.label || '') },
  ];
  const firstIssueIndex = route.findIndex(step => {
    const matched = checklist.find(item => step.match(item));
    return matched ? matched.status !== 'ready' : false;
  });
  const activeIndex = firstIssueIndex >= 0 ? firstIssueIndex : route.length - 1;
  const routeItems = route.map((step, index) => {
    const matched = checklist.find(item => step.match(item));
    const status = matched?.status || (index < activeIndex ? 'ready' : index === activeIndex ? 'attention' : 'blocked');
    return {
      key: step.key,
      label: step.label,
      hint: step.hint,
      status,
      active: index === activeIndex && status !== 'ready',
    };
  });
  const normalizeTarget = step => {
    if (!step) return { tab: 'operations', department: 'command', action: '' };
    if (step.action) return { action: step.action, tab: '', department: '' };
    if (step.tab) return { tab: step.tab, department: step.department || '' };
    if (step.department === 'warehouse') return { tab: 'purchase', department: '' };
    if (step.department === 'sales') return { tab: 'market', department: '' };
    if (step.department) return { tab: 'operations', department: step.department };
    return { tab: 'operations', department: 'command', action: '' };
  };
  const target = normalizeTarget(currentStep);
  let targetTab = target.tab || 'operations';
  if (target.action === 'next-turn') targetTab = 'events';
  const issueCount = checklist.filter(item => item.status !== 'ready').length;
  const isReady = issueCount === 0 && checklist.length > 0;
  const title = isReady ? 'Ход почти готов' : (currentStep?.title || currentStep?.label || 'Следующий шаг');
  const reason = isReady
    ? 'Все основные решения сделаны. Теперь можно завершать ход и смотреть результат.'
    : (currentStep?.summary || currentStep?.why || 'Открой шаг и выполни действие в подсвеченном блоке.');
  const outcome = isReady
    ? 'После завершения игра посчитает продажи, расходы и прибыль за ход.'
    : (currentStep?.outcome || currentStep?.action || 'Игра сразу обновит карточки и чеклист.');
  const buttonLabel = studentRoutePrimaryActionLabel(
    target.action === 'next-turn' ? 'finish' : route[activeIndex]?.key,
    isReady ? 'Перейти к отчётам' : `Перейти: ${route[activeIndex]?.label || 'шаг'}`
  );
  const buttonAttrs = `data-student-route-tab="${escapeHtml(targetTab)}" data-student-route-department="${escapeHtml(target.action === 'next-turn' ? '' : (target.department || ''))}"`;
  const compactHints = learningHints.slice(0, 2);
  const hintsMarkup = compactHints.length ? `
    <div class="student-route-hints" aria-label="Короткие подсказки">
      ${compactHints.map(hint => `
        <span class="${escapeHtml(hint.tone || 'info')}">
          <strong>${escapeHtml(hint.title || 'Подсказка')}</strong>
          <small>${escapeHtml(hint.text || '')}</small>
        </span>
      `).join('')}
    </div>
  ` : '';

  return renderStudentCommandPanel({
    title,
    summary: reason,
    currentLabel: route[activeIndex]?.label || 'следующий шаг',
    routeItems,
    readyCount: routeItems.filter(step => step.status === 'ready').length,
    totalCount: routeItems.length,
    problemCount: issueCount,
    currentText: outcome,
    buttonLabel,
    buttonAttrs,
    hintsMarkup,
    isGuidedFirstTurn: Number(state.room?.day || 0) === 1 && !isReady,
  });
}

function renderStudentLobbyCard(hostPlayer, turnMinutes, difficultyLabel) {
  if (!state.room || !state.player) return '';
  const room = state.room;
  const player = state.player;
  const joined = Number(room.humanCount || 0);
  const ready = Number(room.readyCount || 0);
  const studentName = player.userName || player.name || 'Ученик';
  const companyName = player.companyName || player.name || 'Моя команда';
  const hostName = hostPlayer?.userName || hostPlayer?.name || 'Преподаватель';
  const classmates = (room.players || [])
    .filter(item => !item.isBot && item.id !== player.id);
  const classmatesMarkup = classmates.length
    ? classmates.map(item => `
        <span class="${item.ready ? 'ok' : 'warn'}">
          <b>${escapeHtml(item.userName || item.name || 'Команда')}</b>
          <small>${item.isHost ? 'преподаватель' : item.ready ? 'готов' : 'ожидает'}</small>
        </span>`).join('')
    : '<span class="warn"><b>Пока никого</b><small>Дождитесь остальных участников.</small></span>';
  const readyButton = room.status === 'lobby'
    ? `<button type="button" class="command-action-primary" data-lobby-ready data-lobby-ready-state="${player.ready ? 'ready' : 'idle'}" ${player.ready ? 'disabled' : ''}>${player.ready ? 'Участие принято' : 'Принять участие'}</button>`
    : '<button type="button" class="command-action-primary" data-open-game>Перейти к игре</button>';
  const readinessClass = player.ready ? 'ok' : 'warn';
  const readinessTitle = player.ready ? 'Вы готовы к старту' : 'Подтвердите участие';
  const readinessText = player.ready
    ? 'Оставайтесь на этом экране: преподаватель запустит матч, когда класс будет готов.'
    : 'Проверьте имя команды, параметры занятия и нажмите кнопку готовности.';
  const routeSteps = [
    { icon: 'check', title: 'Принять', text: player.ready ? 'готовность отмечена' : 'нажмите кнопку готовности', done: player.ready },
    { icon: 'join', title: 'Дождаться', text: 'преподаватель запускает матч', done: room.status !== 'lobby' },
  ];
  const routeMarkup = routeSteps.map((step, index) => `
    <span class="${step.done ? 'done' : index === 0 && !player.ready ? 'active' : ''}">
      <i>${gameIcon(step.icon)}</i>
      <b>${index + 1}. ${escapeHtml(step.title)}</b>
      <small>${escapeHtml(step.text)}</small>
    </span>
  `).join('');
  const parameterCards = [
    { icon: 'overview', label: 'Сценарий', value: room.scenarioLabel || 'Сценарий' },
    { icon: 'goal', label: 'Сложность', value: difficultyLabel },
    { icon: 'next', label: 'Время хода', value: `${turnMinutes} мин` },
    { icon: 'reports', label: 'Сезон', value: `${room.settings?.dayLimit || 30} ходов` },
  ].map(item => `
    <span>
      <i>${gameIcon(item.icon)}</i>
      <b>${escapeHtml(item.value)}</b>
      <small>${escapeHtml(item.label)}</small>
    </span>
  `).join('');
  return `
    <section class="student-lobby-card" aria-label="Статус ученика в лобби">
      <div class="student-lobby-main">
        <span class="factory-node-label">Вы в комнате</span>
        <h3>${escapeHtml(companyName)}</h3>
        <p>${escapeHtml(studentName)} подключился к занятию. ${escapeHtml(readinessText)}</p>
        <div class="student-lobby-status-strip" aria-label="Статус входа ученика">
          <span><b>${escapeHtml(room.code || '')}</b><small>код комнаты</small></span>
          <span><b>${escapeHtml(hostName)}</b><small>преподаватель</small></span>
          <span class="${readinessClass}">
            <b>${ready}/${joined}</b>
            <small>готовность класса</small>
            <i class="live-meter" style="--live-meter:${uiPercent(ready, joined || 1)}%"></i>
          </span>
        </div>
        <div class="student-lobby-actions">
          ${readyButton}
        </div>
      </div>
      <div class="student-lobby-ready-card ${readinessClass}">
        <span class="factory-node-label">Статус ученика</span>
        <b>${escapeHtml(readinessTitle)}</b>
        <small>${player.ready ? 'Следующий шаг появится после старта матча.' : 'Главная кнопка слева отправит готовность преподавателю.'}</small>
      </div>
      <div class="student-lobby-route" aria-label="Маршрут ученика">
        <strong>До старта матча</strong>
        <div>${routeMarkup}</div>
        <p class="muted">После старта: Купить → Нанять → Собрать → Продать → Завершить ход</p>
      </div>
      <div class="student-lobby-params" aria-label="Параметры занятия">
        <strong>Параметры занятия</strong>
        <div>${parameterCards}</div>
      </div>
      <div class="student-lobby-roster">
        <strong>Кто уже в комнате</strong>
        <div>${classmatesMarkup}</div>
      </div>
    </section>`;
}
