window.BizArenaFrontendModules = Object.assign(window.BizArenaFrontendModules || {}, {
  student: Object.freeze({ contract: 'student-ui-v1' }),
});

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

function renderGameMarketRail() {
  if (!elements.gameMarketRail) return;
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
  const canHostControl = Boolean(player.isHost && !gameIsFinished());
  const pauseEnabled = canHostControl && room.status === 'running';
  const resumeEnabled = canHostControl && room.status === 'paused';
  const nextEnabled = canHostControl && room.status === 'running';
  const finishEnabled = canHostControl && ['running', 'paused', 'lobby'].includes(room.status);
  const teacherCopy = teacherView
    ? `<button type="button" class="ghost" data-rail-game-tab="teacher">Открыть пульт</button>
       <button type="button" class="ghost" data-rail-game-tab="intel">Подсказка класса</button>`
    : `<div class="rail-next-step">
        <span>Что делать сейчас</span>
        <strong>${escapeHtml(step?.title || 'Следите за маршрутом команды')}</strong>
        <small>${escapeHtml(step?.why || 'Следующее действие показано в верхней панели.')}</small>
      </div>
      <button type="button" class="ghost" data-rail-game-tab="${escapeHtml(step?.tab || 'operations')}">${escapeHtml(step?.label || 'Перейти к действию')}</button>`;
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
        <span class="mini-badge ok">LIVE</span>
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
    </section>
    <section class="side-rail-card">
      <h3>Управление матчем</h3>
      <div class="rail-control-grid">
        <button type="button" class="ghost" data-rail-action="pause-game" ${pauseEnabled ? '' : 'disabled'}>Пауза</button>
        <button type="button" class="ghost" data-rail-action="resume-game" ${resumeEnabled ? '' : 'disabled'}>Продолжить</button>
        <button type="button" class="ghost" data-rail-action="next-turn" ${nextEnabled ? '' : 'disabled'}>Следующий ход</button>
        <button type="button" class="ghost danger-button" data-rail-action="finish-game" ${finishEnabled ? '' : 'disabled'}>Завершить</button>
      </div>
      <small>${player.isHost ? 'Кнопки активны только для хоста комнаты.' : 'Управление доступно преподавателю.'}</small>
    </section>`;

  elements.gameMarketRail.querySelectorAll('[data-rail-game-tab]').forEach(button => {
    button.addEventListener('click', () => setGameTab(button.dataset.railGameTab));
  });
  elements.gameMarketRail.querySelectorAll('[data-rail-action]').forEach(button => {
    button.addEventListener('click', () => sendAction(button.dataset.railAction));
  });
}

function renderGuidedAction() {
  const config = currentDifficultyConfig();
  if (config.uiMode !== 'guided' || !isFactoryRoom()) return '';
  const step = nextGuidedFactoryStep();
  if (!step) return '';
  const control = step.action
    ? `<button type="button" data-guided-action="${step.action}">${step.label}</button>`
    : step.tab
      ? `<button type="button" data-guided-game-tab="${step.tab}">${step.label}</button>`
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

function renderStudentCommandKpis() {
  const factory = state.player?.factory || {};
  const workers = factory.workers || [];
  const inventoryStock = Object.values(factory.inventory || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  const componentStock = (factory.components || []).reduce((sum, component) => sum + Number(component.quantity || 0), 0);
  const rawStock = inventoryStock || componentStock;
  const saleQuantity = Number(factory.saleOffer?.quantity || 0);
  const profit = Number(state.player?.lastTickBreakdown?.profit || 0);
  return `
    <div class="student-command-kpis" aria-label="Ключевые показатели команды">
      ${renderLiveMetricCard({ label: 'Деньги', value: money(state.player?.money || 0), hint: `${profit >= 0 ? '+' : ''}${money(profit)} за ход`, percent: uiPercent(Math.max(0, state.player?.money || 0), Math.max(1, state.player?.netWorth || state.player?.money || 1)), tone: profit >= 0 ? 'ok' : 'danger', icon: 'cash' })}
      ${renderLiveMetricCard({ label: 'Склад', value: `${Number(factory.finishedGoods || 0)} ед.`, hint: `${rawStock} деталей`, percent: uiPercent(Number(factory.finishedGoods || 0) + rawStock, Math.max(1, Number(factory.finishedGoods || 0) + rawStock + saleQuantity)), tone: factory.finishedGoods ? 'ok' : 'warn', icon: 'warehouse' })}
      ${renderLiveMetricCard({ label: 'Сотрудники', value: `${workers.length}`, hint: `мощность ${Number(factory.assemblyCapacity || 0)}`, percent: uiPercent(workers.length, Math.max(1, workers.length + 1)), tone: workers.length ? 'ok' : 'warn', icon: 'teams' })}
      ${renderLiveMetricCard({ label: 'Заявка', value: `${saleQuantity}`, hint: saleQuantity ? `${money(factory.saleOffer?.price || 0)} за ед.` : 'не выставлена', percent: uiPercent(saleQuantity, Math.max(1, saleQuantity + Number(factory.finishedGoods || 0))), tone: saleQuantity ? 'ok' : 'warn', icon: 'market' })}
    </div>`;
}

function renderStudentFactoryScene(routeItems = []) {
  const factory = state.player?.factory || {};
  const components = factory.components || [];
  const workers = factory.workers || [];
  const componentStock = components.reduce((sum, component) => sum + Number(component.quantity || 0), 0);
  const recipeTarget = components.reduce((sum, component) => sum + Number(component.recipe || 0), 0);
  const finishedGoods = Number(factory.finishedGoods || 0);
  const saleQuantity = Number(factory.saleOffer?.quantity || 0);
  const routeByKey = new Map(routeItems.map(step => [step.key, step]));
  const scenario = state.room?.factoryScenario || {};
  const stations = [
    {
      key: 'purchase',
      label: 'Склад',
      value: `${componentStock} деталей`,
      hint: recipeTarget ? `Комплект на ${Math.floor(componentStock / Math.max(1, recipeTarget))} ед.` : 'Проверьте поставщиков',
      icon: 'warehouse',
      progress: uiPercent(componentStock, Math.max(recipeTarget * 4, 1)),
      attrs: 'data-student-route-tab="purchase"',
    },
    {
      key: 'workforce',
      label: 'Команда',
      value: `${workers.length} сотрудников`,
      hint: `Мощность ${Number(factory.assemblyCapacity || 0)} ед.`,
      icon: 'teams',
      progress: uiPercent(workers.length, Math.max(4, workers.length)),
      attrs: 'data-student-route-tab="operations" data-student-route-department="workforce"',
    },
    {
      key: 'assembly',
      label: 'Сборочная линия',
      value: `${finishedGoods} готово`,
      hint: `${Number(state.player?.producedLastTick || 0)} собрано за ход`,
      icon: 'assembly',
      progress: uiPercent(finishedGoods, Math.max(1, Number(factory.assemblyCapacity || 0) + finishedGoods)),
      attrs: 'data-student-route-tab="operations" data-student-route-department="assembly"',
    },
    {
      key: 'market',
      label: 'Отгрузка',
      value: `${saleQuantity} в заявке`,
      hint: saleQuantity ? `${money(factory.saleOffer?.price || 0)} за ед.` : 'Заявка не выставлена',
      icon: 'market',
      progress: uiPercent(saleQuantity, Math.max(1, saleQuantity + finishedGoods)),
      attrs: 'data-student-route-tab="market"',
    },
  ];

  return `
    <section class="student-factory-scene" data-student-factory-scene="live" aria-label="Живая схема предприятия">
      <div class="student-factory-scene-head">
        <div>
          <span class="factory-node-label">Предприятие в этом ходу</span>
          <strong>${escapeHtml(scenario.label || 'Производственный комплекс')}</strong>
          <small>${escapeHtml(scenario.productLabel || factory.productUnit || 'Продукция')} · показатели обновляются из состояния комнаты</small>
        </div>
        <span class="student-factory-live"><i></i> LIVE</span>
      </div>
      <div class="student-factory-scene-floor" aria-hidden="true">
        <span class="student-scene-lane lane-a"></span>
        <span class="student-scene-lane lane-b"></span>
        <span class="student-scene-lane lane-c"></span>
      </div>
      <div class="student-factory-scene-grid">
        ${stations.map((station, index) => {
          const routeStep = routeByKey.get(station.key) || {};
          const status = routeStep.active ? 'active' : routeStep.status === 'ready' ? 'ready' : routeStep.status || 'pending';
          return `
            <button type="button" class="student-factory-node ${escapeHtml(status)}" data-scene-station="${escapeHtml(station.key)}" ${station.attrs} style="--scene-progress:${station.progress}%; --scene-order:${index}">
              <span class="student-factory-node-icon">${gameIcon(station.icon)}</span>
              <span class="student-factory-node-copy">
                <small>${index + 1}. ${escapeHtml(station.label)}</small>
                <strong>${escapeHtml(station.value)}</strong>
                <span>${escapeHtml(station.hint)}</span>
              </span>
              <i class="student-factory-node-meter"><b></b></i>
            </button>`;
        }).join('')}
      </div>
      <div class="student-factory-scene-foot">
        <span>${componentStock} деталей на складе</span>
        <span>${workers.length} сотрудников</span>
        <span>${finishedGoods} готовых единиц</span>
        <span>${saleQuantity} в продаже</span>
      </div>
    </section>`;
}

function renderStudentMarketPulse() {
  const factory = state.player?.factory || {};
  const latestMarket = (state.room?.market || []).slice(-1)[0] || {};
  const activeEvent = state.room?.activeEvent || null;
  const saleQuantity = Number(factory.saleOffer?.quantity || 0);
  const fallbackDemand = latestMarket.demand || state.room?.factoryScenario?.baseDemandMax || 1200;
  const history = marketChartHistory({
    demand: fallbackDemand,
    totalSales: latestMarket.totalSales || saleQuantity,
    avgPrice: latestMarket.avgPrice || factory.saleOffer?.price || state.room?.factoryScenario?.priceRange?.max || 18000,
  });
  const latest = history[history.length - 1] || {};
  const previous = history[history.length - 2] || latest;
  const demandValues = history.map(entry => Number(entry.demand || 0));
  const demandDelta = Number(latest.demand || 0) - Number(previous.demand || 0);
  const offerPrice = Number(factory.saleOffer?.price || 0);
  return `
    <section class="student-market-mini" aria-label="Рынок команды">
      <div class="student-support-head">
        <strong>Спрос на рынке</strong>
        <span class="${demandDelta >= 0 ? 'positive' : 'negative'}">${demandDelta >= 0 ? '+' : ''}${compactMarketNumber(demandDelta)}</span>
      </div>
      <div class="student-market-chart">
        ${miniChart(demandValues, 'positive')}
        <div>
          <b>${compactMarketNumber(latest.demand || fallbackDemand)}</b>
          <small>прогноз спроса</small>
        </div>
      </div>
      <div class="student-mini-stats">
        ${renderStudentMarketStat({ icon: 'goal', label: 'Ваша заявка', value: `${saleQuantity || 0} ед.` })}
        ${renderStudentMarketStat({ icon: 'cash', label: 'Цена', value: offerPrice ? money(offerPrice) : 'нет' })}
        ${renderStudentMarketStat({ icon: 'market', label: 'Средняя цена', value: money(latest.avgPrice || 0) })}
      </div>
      ${activeEvent ? `
        <div class="student-market-event">
          <strong>${escapeHtml(activeEvent.title || activeEvent.label || 'Crisis Card')}</strong>
          <small>${escapeHtml(activeEvent.description || 'Market conditions changed for this turn.')}</small>
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
  return `
    <section class="student-task-stack" aria-label="План хода команды">
      <div class="student-support-head">
        <strong>План хода</strong>
        <span>${items.filter(item => item.status === 'ready').length}/${items.length}</span>
      </div>
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
    </section>`;
}

function renderStudentCommandSupport(routeItems = []) {
  const marketHintsMarkup = renderMarketHints((state.player?.marketHints || []).slice(0, 2), { compact: true });
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
    <div class="student-command-support">
      ${renderStudentTaskStack(routeItems)}
      ${renderStudentMarketPulse()}
      ${marketHintsMarkup ? `<section class="student-market-quick-hints">${marketHintsMarkup}</section>` : ''}
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
    <section class="student-route-panel student-route-panel-v2 turn-guide-panel" data-uiux-slice="student-first-turn-2" data-student-flow-contract="first-turn-v2" data-student-primary-step="${escapeHtml(primaryStepKey)}" data-student-route-ready="${safeReady >= safeTotal ? 'true' : 'false'}" data-student-problems="${safeProblems}" aria-label="Маршрут хода">
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
      ${renderStudentCommandKpis()}
      <div class="student-command-stage">
        ${renderStudentFactoryScene(routeItems)}
        ${renderStudentCommandSupport(routeItems)}
      </div>
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
    const buttonAttrs = target.action
      ? `data-student-route-action="${escapeHtml(target.action)}" data-student-route-value="${escapeHtml(target.value || '')}"`
      : `data-student-route-tab="${escapeHtml(target.tab || 'operations')}" data-student-route-department="${escapeHtml(target.department || '')}" data-student-route-component="${escapeHtml(target.componentKey || '')}"`;
    return renderStudentCommandPanel({
      title: guide.title || 'Следующий шаг',
      summary: guide.summary || '',
      currentLabel: studentRouteDisplayLabel(primaryStep),
      routeItems,
      readyCount,
      totalCount,
      problemCount,
      currentText: primaryStep?.summary || guide.summary || 'Выполните текущий шаг, затем переходите дальше по маршруту.',
      buttonLabel: guide.buttonLabel || 'Открыть шаг',
      buttonAttrs,
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
  const issueCount = checklist.filter(item => item.status !== 'ready').length;
  const isReady = issueCount === 0 && checklist.length > 0;
  const title = isReady ? 'Ход почти готов' : (currentStep?.title || currentStep?.label || 'Следующий шаг');
  const reason = isReady
    ? 'Все основные решения сделаны. Теперь можно завершать ход и смотреть результат.'
    : (currentStep?.summary || currentStep?.why || 'Открой шаг и выполни действие в подсвеченном блоке.');
  const outcome = isReady
    ? 'После завершения игра посчитает продажи, расходы и прибыль за ход.'
    : (currentStep?.outcome || currentStep?.action || 'Игра сразу обновит карточки и чеклист.');
  const buttonLabel = target.action === 'next-turn'
    ? 'Завершить ход'
    : isReady
      ? 'Перейти к отчетам'
      : `Перейти: ${route[activeIndex]?.label || 'шаг'}`;
  const buttonAttrs = target.action
    ? `data-student-route-action="${escapeHtml(target.action)}"`
    : `data-student-route-tab="${escapeHtml(target.tab || 'operations')}" data-student-route-department="${escapeHtml(target.department || '')}"`;
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
