window.BizArenaFrontendModules = Object.assign(window.BizArenaFrontendModules || {}, {
  teacher: Object.freeze({ contract: 'teacher-ui-v1' }),
});

function teacherStartGateInfo(room) {
  const gate = room?.teacherControls?.startGate || {};
  const practiceMode = gate.practiceMode || room?.settings?.practiceMode || '';
  const teacherOnlyHost = Boolean(gate.teacherOnlyHost || room?.teacherAccountId);
  const fallbackMinimum = practiceMode || teacherOnlyHost ? 1 : 2;
  const minimumClassPlayers = Number(gate.minimumClassPlayers || fallbackMinimum);
  const classPlayerCount = Number(gate.classPlayerCount ?? room?.humanCount ?? 0);
  const readyCount = Number(gate.readyCount ?? room?.readyCount ?? 0);
  const studentCount = teacherOnlyHost ? classPlayerCount : Math.max(0, classPlayerCount - 1);
  const hasMinimumPlayers = gate.hasMinimumPlayers ?? classPlayerCount >= minimumClassPlayers;
  const allReady = gate.allReady ?? (classPlayerCount > 0 && readyCount >= classPlayerCount);
  const canStart = gate.canStart ?? (hasMinimumPlayers && allReady);

  if (canStart) {
    return {
      canStart,
      reasonKey: 'ready',
      tone: 'ok',
      title: 'Можно запускать матч',
      body: `Server gate пройден: готово ${readyCount}/${classPlayerCount}.`,
      minimumClassPlayers,
      classPlayerCount,
      readyCount,
      studentCount,
      missingPlayers: 0,
      practiceMode,
      teacherOnlyHost,
      hasMinimumPlayers,
      allReady,
    };
  }

  if (!hasMinimumPlayers) {
    const missingPlayers = Math.max(0, minimumClassPlayers - classPlayerCount);
    const body = practiceMode
      ? 'Практический режим можно запускать одному, но сначала подтвердите готовность.'
      : teacherOnlyHost
        ? 'Нужна хотя бы одна ученическая команда в комнате.'
        : 'Нужен преподаватель и минимум один ученик в комнате.';
    return {
      canStart,
      reasonKey: 'students',
      tone: 'warn',
      title: 'Нужен ученик',
      body,
      minimumClassPlayers,
      classPlayerCount,
      readyCount,
      studentCount,
      missingPlayers,
      practiceMode,
      teacherOnlyHost,
      hasMinimumPlayers,
      allReady,
    };
  }

  if (!allReady) {
    return {
      canStart,
      reasonKey: 'readiness',
      tone: 'warn',
      title: 'Класс еще не готов',
      body: `Готово ${readyCount}/${classPlayerCount}. Попросите оставшиеся команды нажать “Готов”.`,
      minimumClassPlayers,
      classPlayerCount,
      readyCount,
      studentCount,
      missingPlayers: 0,
      practiceMode,
      teacherOnlyHost,
      hasMinimumPlayers,
      allReady,
    };
  }

  return {
    canStart,
    reasonKey: 'blocked',
    tone: 'danger',
    title: 'Старт заблокирован',
    body: 'Проверьте состав класса, готовность и параметры комнаты.',
    minimumClassPlayers,
    classPlayerCount,
    readyCount,
    studentCount,
    missingPlayers: 0,
    practiceMode,
    teacherOnlyHost,
    hasMinimumPlayers,
    allReady,
  };
}

function renderTeacherLobbyCommandCard(studentLink, studentQrSrc, turnMinutes, difficultyLabel) {
  if (!state.room || !state.player?.isHost || isClientMode()) return '';
  const room = state.room;
  const startGateInfo = teacherStartGateInfo(room);
  const waitingPlayers = (room.players || [])
    .filter(player => !player.isBot && !player.ready)
    .slice(0, 5);
  const waitingMarkup = waitingPlayers.length
    ? waitingPlayers.map(player => `
        <span class="warn">
          <b>${escapeHtml(player.isHost ? 'Преподаватель' : player.name || player.userName || 'Команда')}</b>
          <small>${player.isHost ? 'подтвердите готовность ведущего' : 'ждет кнопку “Принять участие”'}</small>
        </span>`).join('')
    : '<span class="ok"><b>Все вошедшие готовы</b><small>Можно запускать матч, если состав класса полный.</small></span>';
  const classRosterMarkup = (room.players || [])
    .filter(player => !player.isBot)
    .map(player => `
      <span class="${player.ready ? 'ok' : 'warn'}">
        <b>${escapeHtml(player.isHost ? 'Преподаватель' : player.name || player.userName || 'Команда')}</b>
        <small>${escapeHtml(player.isHost ? (player.userName || 'Ведущий') : (player.userName || player.name || 'Ученик'))}</small>
        <i>${player.ready ? 'готов' : 'ждет'}</i>
      </span>
    `).join('') || '<span class="warn"><b>Класс еще не вошел</b><small>Покажите QR или ссылку.</small><i>ожидание</i></span>';
  const launchSteps = [
    { key: 'session', label: 'Сессия', text: room.code ? `комната ${room.code} доступна` : 'нет активной комнаты', done: Boolean(room.code && state.sessionToken) },
    { key: 'student-link', label: 'Ссылка', text: studentLink ? 'ссылка и QR готовы' : 'ссылка еще не готова', done: Boolean(studentLink) },
    { key: 'students', label: 'Ученики', text: startGateInfo.hasMinimumPlayers ? `${startGateInfo.studentCount} учеников в комнате` : startGateInfo.body, done: startGateInfo.hasMinimumPlayers },
    { key: 'readiness', label: 'Готовность', text: `${startGateInfo.readyCount}/${startGateInfo.classPlayerCount} подтвердили участие`, done: startGateInfo.hasMinimumPlayers && startGateInfo.allReady },
    { key: 'settings', label: 'Параметры', text: `${room.scenarioLabel || 'сценарий'} / ${turnMinutes} мин / ${room.settings?.dayLimit || 30} ходов`, done: Boolean(room.scenarioLabel && turnMinutes > 0 && Number(room.settings?.dayLimit || 0) > 0) },
  ];
  const preflightReady = launchSteps.every(step => step.done) && startGateInfo.canStart;
  const completedPreflightSteps = launchSteps.filter(step => step.done).length;
  const firstBlockedStep = launchSteps.find(step => !step.done) || (startGateInfo.canStart ? null : {
    key: startGateInfo.reasonKey,
    label: startGateInfo.title,
    text: startGateInfo.body,
  });
  const primaryAction = room.status === 'lobby'
    ? `<button type="button" class="command-action-primary teacher-lobby-start-button" data-host-action="start-game" data-preflight-action="start-match" ${preflightReady ? '' : 'disabled'}>Запустить матч</button>`
    : '<button type="button" class="command-action-primary teacher-lobby-start-button" data-open-game>Открыть игровой дашборд</button>';
  const hostReadyAction = room.status === 'lobby' && !state.player.ready
    ? '<button type="button" class="ghost" data-lobby-ready>Готовность преподавателя</button>'
    : '';
  const nextText = room.status !== 'lobby'
    ? 'Матч уже запущен. Откройте дашборд преподавателя и следите за первым ходом.'
    : preflightReady
      ? 'Проверка пройдена. Запускайте матч и переходите к контролю первого хода.'
      : `Следующий пункт проверки: ${firstBlockedStep?.label || 'готовность класса'}. ${firstBlockedStep?.text || ''}`;
  const activePreflightIndex = launchSteps.findIndex(step => !step.done);
  const stepperMarkup = launchSteps.map((step, index) => `
    <span class="${step.done ? 'done' : index === activePreflightIndex ? 'active' : ''}" data-preflight-step="${escapeHtml(step.key)}" data-preflight-done="${step.done ? 'true' : 'false'}">
      <b>${index + 1}</b>
      <strong>${escapeHtml(step.label)}</strong>
      <small>${escapeHtml(step.text)}</small>
    </span>
  `).join('');
  const studentQrMarkup = studentQrSrc
    ? `<img src="${escapeHtml(studentQrSrc)}" alt="QR-код для входа учеников" loading="lazy">`
    : `${gameIcon('join')}<span>QR появится после создания ссылки</span>`;
  return `
    <section class="teacher-lobby-command-card" data-uiux-slice="teacher-lobby-command" aria-label="Что сделать преподавателю сейчас">
      <div class="teacher-lobby-command-main">
        <span class="factory-node-label">Командный центр запуска</span>
        <h3>Что сделать сейчас</h3>
        <p>${escapeHtml(nextText)}</p>
        <div class="teacher-lobby-preflight" data-preflight-ready="${preflightReady ? 'true' : 'false'}" data-preflight-next="${escapeHtml(firstBlockedStep?.key || 'ready')}" aria-label="Проверка перед занятием">
          <div class="teacher-lobby-preflight-head">
            <strong>Проверка перед занятием</strong>
            <span class="${preflightReady ? 'ok' : 'warn'}">${completedPreflightSteps}/${launchSteps.length}</span>
          </div>
          <div class="teacher-lobby-start-gate ${escapeHtml(startGateInfo.tone)}" data-start-gate-reason="${escapeHtml(startGateInfo.reasonKey)}" data-start-gate-can-start="${startGateInfo.canStart ? 'true' : 'false'}">
            <strong>${escapeHtml(startGateInfo.title)}</strong>
            <small>${escapeHtml(startGateInfo.body)}</small>
          </div>
          <div class="teacher-lobby-stepper">
            ${stepperMarkup}
          </div>
        </div>
        <div class="teacher-lobby-command-actions">
          ${primaryAction}
          ${hostReadyAction}
          <button type="button" class="ghost" data-copy-student-link="${escapeHtml(studentLink)}">Скопировать ссылку</button>
        </div>
      </div>
      <div class="teacher-lobby-launch-strip">
        <span>${gameIcon('join')}<b>${escapeHtml(room.code || '')}</b><small>код комнаты</small></span>
        <span>${gameIcon('check')}<b>${room.readyCount}/${room.humanCount}</b><small>готовность</small></span>
        <span>${gameIcon('goal')}<b>${escapeHtml(difficultyLabel)}</b><small>${turnMinutes} мин на ход</small></span>
      </div>
      <div class="teacher-lobby-share-panel" aria-label="Ссылка и QR для учеников">
        <div class="teacher-lobby-qr">
          ${studentQrMarkup}
        </div>
        <div class="teacher-lobby-share-copy">
          <span class="factory-node-label">Ссылка для студентов</span>
          <b>${escapeHtml(room.code || '')}</b>
          <strong class="teacher-lobby-student-link">${escapeHtml(studentLink)}</strong>
          <button type="button" class="ghost" data-copy-student-link="${escapeHtml(studentLink)}">Скопировать вход</button>
        </div>
      </div>
      <div class="teacher-lobby-command-metrics">
        <span class="${startGateInfo.canStart ? 'ok' : 'warn'}">
          <b>${room.readyCount}/${room.humanCount}</b>
          <small>готовность класса</small>
          <i class="live-meter" style="--live-meter:${uiPercent(room.readyCount, room.humanCount || 1)}%"></i>
        </span>
        <span>
          <b>${escapeHtml(room.scenarioLabel || 'Сценарий')}</b>
          <small>${escapeHtml(difficultyLabel)} / ${turnMinutes} мин на ход</small>
        </span>
        <span>
          <b>${escapeHtml(String(room.settings?.dayLimit || 30))}</b>
          <small>ходов в занятии</small>
        </span>
      </div>
      <div class="teacher-lobby-roster-board" aria-label="Кто вошел и кто готов">
        <strong>Кто вошел / кто готов</strong>
        <div>${classRosterMarkup}</div>
      </div>
      <div class="teacher-lobby-waiting-list">
        <strong>Кого ждем</strong>
        <div>${waitingMarkup}</div>
      </div>
    </section>`;
}

function teacherPhaseLabel(phaseLock) {
  return phaseLock === 'review' ? t('teacher_phase_review') : t('teacher_phase_open');
}

function teacherEventLabel(event) {
  if (!event?.key) return event?.label || '—';
  const translated = t(`teacher_event_${event.key}`);
  return translated === `teacher_event_${event.key}` ? (event.label || event.key) : translated;
}

function crisisCardForEventKey(eventKey) {
  return CRISIS_CARDS[eventKey] || null;
}

function crisisCardsForCatalog(eventCatalog) {
  return (eventCatalog || [])
    .filter(item => crisisCardForEventKey(item.key))
    .map(item => ({ ...crisisCardForEventKey(item.key), event: item, key: item.key }));
}

function renderCrisisCards(eventCatalog, selectedEventKey, controls) {
  const cards = crisisCardsForCatalog(eventCatalog);
  if (!cards.length) return '';
  return `
    <article class="market-item results-wide crisis-card-panel">
      <div class="crisis-card-head">
        <span class="crisis-card-head-icon">${gameIcon('crisis')}</span>
        <div>
          <span class="factory-node-label">Crisis Cards</span>
          <strong>Учебный кризис для обсуждения</strong>
          <small>Карточка запускает существующее событие игры и дает преподавателю готовый вопрос для класса.</small>
        </div>
        <span class="mini-badge">${cards.length} сценария</span>
      </div>
      <div class="crisis-card-grid">
        ${cards.map(card => `
          <section class="crisis-card ${card.key === selectedEventKey ? 'selected' : ''}" data-crisis-card-key="${escapeHtml(card.key)}" title="${escapeHtml(`${card.scenario} ${card.question} ${card.timing}`)}">
            <div class="crisis-card-title">
              <span class="crisis-card-icon">${gameIcon(crisisCardIcon(card.key))}</span>
              <strong>${escapeHtml(card.title)}</strong>
              <span class="crisis-card-badge">${card.key === selectedEventKey ? 'Выбрано' : escapeHtml(teacherEventLabel(card.event))}</span>
            </div>
            <p>${escapeHtml(card.effect)}</p>
            <small><b>Обсудить:</b> ${escapeHtml(card.question)}</small>
            <button type="button" data-crisis-card-event="${escapeHtml(card.key)}" ${controls.actions?.forceEvent ? '' : 'disabled'}>${iconButtonLabel('crisis', 'Запустить карточку')}</button>
          </section>
        `).join('')}
      </div>
    </article>`;
}

function teacherExperimentParameterLabel(parameter) {
  const labels = {
    basePrice: 'Базовая цена',
    demandMultiplier: 'Спрос',
    supplyCoverage: 'Доступность поставщиков',
    salaryMultiplier: 'Зарплаты',
    upkeep: 'Расходы завода',
    starterCash: 'Стартовый капитал',
  };
  return labels[parameter] || parameter;
}

function teacherExperimentDefaultValues(parameter) {
  const values = {
    basePrice: '5600, 6400, 7200',
    demandMultiplier: '0.8, 1, 1.2',
    supplyCoverage: '0.5, 0.75, 1',
    salaryMultiplier: '0.8, 1, 1.2',
    upkeep: '5000, 7000, 9000',
    starterCash: '120000, 180000, 240000',
  };
  return values[parameter] || values.basePrice;
}

function renderTeacherExperimentPanel({ controls, experiment, preservedParameter, preservedValues, preservedTurns, preservedSeed }) {
  const parameter = preservedParameter || experiment?.parameter || 'basePrice';
  const valueText = preservedValues || (experiment?.values || []).join(', ') || teacherExperimentDefaultValues(parameter);
  const turns = preservedTurns || experiment?.turns || 8;
  const seed = preservedSeed || experiment?.seed || 42;
  const rows = experiment?.rows || [];
  const bestValue = experiment?.best?.value;
  const maxScore = Math.max(1, ...rows.map(row => Number(row.finalScore || 0)));
  const options = ['basePrice', 'demandMultiplier', 'supplyCoverage', 'salaryMultiplier', 'upkeep', 'starterCash']
    .map(key => `<option value="${key}" ${key === parameter ? 'selected' : ''}>${teacherExperimentParameterLabel(key)}</option>`)
    .join('');
  const resultMarkup = rows.length ? `
    <div class="experiment-results">
      ${rows.map(row => {
        const score = Number(row.finalScore || 0);
        const width = Math.max(6, Math.round((score / maxScore) * 100));
        const isBest = String(row.value) === String(bestValue);
        return `
          <article class="${isBest ? 'best' : ''}">
            <div>
              <strong>${escapeHtml(String(row.value))}</strong>
              <small>${isBest ? 'Лучший вариант' : teacherExperimentParameterLabel(row.parameter)}</small>
            </div>
            <div class="experiment-bar"><i style="width: ${width}%"></i></div>
            <span>${row.finalScore} очк.</span>
            <small>${row.totalSales} продаж • ${money(row.finalNetWorth)} • риск ${row.bankruptcyCount || 0}</small>
          </article>
        `;
      }).join('')}
    </div>
  ` : '<p class="muted">Запустите сравнение, чтобы увидеть, какая цена, доступность поставщиков или нагрузка расходов дает лучший результат.</p>';

  return `
    <article class="market-item results-wide teacher-experiment-card">
      <div>
        <span class="factory-node-label">Эксперименты</span>
        <strong>Сравнение параметров сценария</strong>
        <small>Быстрый прогон без влияния на текущий матч: помогает преподавателю объяснить, почему цена, спрос и дефицит меняют результат.</small>
      </div>
      <div class="teacher-experiment-form">
        <label><span>Параметр</span><select id="teacher-experiment-parameter">${options}</select></label>
        <label><span>Значения</span><input id="teacher-experiment-values" type="text" value="${escapeHtml(valueText)}" /></label>
        <label><span>Ходы</span><input id="teacher-experiment-turns" type="number" min="1" max="30" value="${escapeHtml(String(turns))}" /></label>
        <label><span>Seed</span><input id="teacher-experiment-seed" type="number" min="1" value="${escapeHtml(String(seed))}" /></label>
        <button type="button" data-teacher-action="run-experiment" ${controls.actions?.runExperiment ? '' : 'disabled'}>Запустить сравнение</button>
      </div>
      ${resultMarkup}
    </article>
  `;
}

function teacherDashboardSortLabel(key, dashboard) {
  return (dashboard?.sortOptions || []).find(option => option.key === key)?.label || 'Общий балл';
}

function sortTeacherDashboardRows(rows, key) {
  const normalizedKey = key || 'rankScore';
  const direction = normalizedKey === 'debt' ? 1 : -1;
  return [...rows].sort((left, right) => {
    if (normalizedKey === 'readyForTurn') {
      return Number(left.readyForTurn) - Number(right.readyForTurn)
        || (right.rankScore || 0) - (left.rankScore || 0)
        || String(left.userName || '').localeCompare(String(right.userName || ''), 'ru');
    }
    const leftValue = Number(left[normalizedKey] || 0);
    const rightValue = Number(right[normalizedKey] || 0);
    return (leftValue - rightValue) * direction
      || (right.rankScore || 0) - (left.rankScore || 0)
      || String(left.userName || '').localeCompare(String(right.userName || ''), 'ru');
  });
}

function renderTeacherDashboard(dashboard, preservedSortKey) {
  const rows = dashboard?.rows || [];
  const sortOptions = dashboard?.sortOptions || [];
  const sortKey = sortOptions.some(option => option.key === preservedSortKey)
    ? preservedSortKey
    : sortOptions[0]?.key || 'rankScore';
  const sortedRows = sortTeacherDashboardRows(rows, sortKey);
  const optionsMarkup = sortOptions.map(option => (
    `<option value="${escapeHtml(option.key)}" ${option.key === sortKey ? 'selected' : ''}>${escapeHtml(option.label)}</option>`
  )).join('');
  const metricMarkup = (dashboard?.metrics || []).map(metric => `
    <span>
      <b>${escapeHtml(metric.value)}</b>
      <small>${escapeHtml(metric.label)} • ${escapeHtml(metric.hint || '')}</small>
    </span>
  `).join('');
  const leader = dashboard?.leader || null;
  const topProfit = dashboard?.topProfit || null;
  const rowsMarkup = sortedRows.length
    ? sortedRows.map((row, index) => {
        const statusClass = checklistStatusClass(row.status);
        const profitClass = row.lastProfit >= 0 ? 'positive' : 'negative';
        return `
          <article class="teacher-dashboard-row ${statusClass}">
            <div class="teacher-dashboard-rank">#${index + 1}</div>
            <div class="teacher-dashboard-team">
              <strong>${escapeHtml(row.companyName)}</strong>
              <small>${escapeHtml(row.userName)}${row.isHost ? ' • хост' : ''}${row.isBot ? ' • бот' : ''}</small>
            </div>
            <div>
              <b>${row.rankScore}</b>
              <small>балл</small>
            </div>
            <div>
              <b>${money(row.netWorth)}</b>
              <small>капитал</small>
            </div>
            <div>
              <b class="${profitClass}">${money(row.lastProfit)}</b>
              <small>прибыль хода</small>
            </div>
            <div>
              <b>${money(row.lastRevenue)}</b>
              <small>выручка</small>
            </div>
            <div>
              <b>${row.totalSalesSeason}</b>
              <small>продано</small>
            </div>
            <div class="teacher-dashboard-action">
              <span>${checklistStatusLabel(row.status)}</span>
              <small>${escapeHtml(row.issue)} • ${escapeHtml(row.nextAction)}</small>
            </div>
          </article>`;
      }).join('')
    : '<div class="market-item">Команды появятся после создания комнаты.</div>';
  return `
    <article class="market-item results-wide teacher-dashboard-card">
      <div class="teacher-dashboard-head">
        <div>
          <strong>Dashboard класса</strong>
          <small>Сортировка команд по ключевым показателям сервера. Сейчас: ${escapeHtml(teacherDashboardSortLabel(sortKey, dashboard))}.</small>
        </div>
        <label>
          <span>Сортировать</span>
          <select id="teacher-dashboard-sort">${optionsMarkup}</select>
        </label>
      </div>
      <div class="teacher-dashboard-metrics top-gap">${metricMarkup}</div>
      <div class="teacher-dashboard-summary top-gap">
        <span>Лидер: <b>${leader ? escapeHtml(leader.companyName) : '—'}</b></span>
        <span>Лучший ход: <b>${topProfit ? `${escapeHtml(topProfit.companyName)} • ${money(topProfit.lastProfit)}` : '—'}</b></span>
        <span>Нужна помощь: <b>${dashboard?.needsHelp || 0}</b></span>
      </div>
      <div class="teacher-dashboard-table top-gap">${rowsMarkup}</div>
    </article>`;
}

function teacherRoomStatusLabel(status) {
  if (status === 'lobby') return 'Лобби';
  if (status === 'running') return 'Матч идет';
  if (status === 'paused') return 'Пауза / разбор';
  if (status === 'finished') return 'Итоги';
  return 'Статус неизвестен';
}

function teacherCockpitTone(room, readiness, helpQueue) {
  if (!room) return 'warn';
  if (room.status === 'finished') return 'ok';
  if (room.status === 'lobby') return teacherStartGateInfo(room).canStart ? 'ok' : 'warn';
  if ((readiness?.blocked || 0) > 0 || helpQueue.length > 0) return 'warn';
  return 'ok';
}

function teacherNextAction(room, readiness, helpQueue) {
  if (!room) return 'Откройте комнату преподавателя.';
  if (room.status === 'lobby') {
    const startGateInfo = teacherStartGateInfo(room);
    if (startGateInfo.canStart) return 'Все готово. Можно запускать матч.';
    if (startGateInfo.reasonKey === 'students') return `${startGateInfo.body} Покажите ученикам QR/LAN-ссылку и код комнаты.`;
    if (startGateInfo.reasonKey === 'readiness') return startGateInfo.body;
    return startGateInfo.body;
  }
  if (room.status === 'paused') return 'Идет пауза. Проведите короткий разбор или продолжите матч.';
  if (room.status === 'finished') return 'Матч завершен. Откройте итоги и обсудите топ-3 решения.';
  const firstBlocker = helpQueue[0];
  if (firstBlocker) {
    return `Подойдите к ${firstBlocker.userName}: ${firstBlocker.actionHint || firstBlocker.reason || 'проверьте первый ход'}.`;
  }
  if ((readiness?.total || 0) > 0 && (readiness?.ready || 0) === (readiness?.total || 0)) {
    return 'Команды готовы. Можно считать следующий ход.';
  }
  return 'Проверьте первый ход: закупка, персонал, сборка и заявка на рынок.';
}

function teacherRosterMarkup(room) {
  const humanRows = (room?.players || []).filter(player => !player.isBot);
  if (!humanRows.length) {
    return '<div class="teacher-cockpit-empty">Ученики еще не вошли в комнату.</div>';
  }
  return humanRows.map(player => `
    <article class="${player.ready ? 'ok' : 'warn'}">
      <div>
        <strong>${escapeHtml(player.userName)}</strong>
        <small>${escapeHtml(player.name || player.companyName || 'Компания не указана')}</small>
      </div>
      <span>${player.ready ? 'готов' : 'ждет'}</span>
    </article>
  `).join('');
}

function teacherPriorityHelpMarkup(helpQueue) {
  if (!helpQueue.length) {
    return `
      <article class="ok">
        <b>OK</b>
        <div>
          <strong>Критичных блокеров нет</strong>
          <small>Можно ждать готовность, разбирать решения или считать следующий ход.</small>
        </div>
      </article>`;
  }
  return helpQueue.slice(0, 4).map((row, index) => `
    <article class="warn">
      <b>${index + 1}</b>
      <div>
        <strong>${escapeHtml(row.userName || row.companyName || 'Команда')}</strong>
        <small>${escapeHtml(row.companyName || '')}${row.companyName ? ' • ' : ''}${escapeHtml(row.message || row.actionHint || row.reason || 'проверить первый ход')}</small>
        ${row.id ? `<div class="teacher-help-actions">
          ${row.status === 'open' ? `<button type="button" class="ghost" data-help-action="acknowledge-help-request" data-help-request-id="${escapeHtml(row.id)}">Принять</button>` : ''}
          <button type="button" data-help-action="resolve-help-request" data-help-request-id="${escapeHtml(row.id)}">Закрыть</button>
        </div>` : ''}
      </div>
    </article>
  `).join('');
}

function renderTeacherClassReadiness(room, readiness = {}, helpQueue = []) {
  const joined = Number(room?.humanCount || 0);
  const maxPlayers = Number(room?.settings?.maxPlayers || room?.maxPlayers || joined || 1);
  const ready = Number(readiness.ready ?? room?.readyCount ?? 0);
  const total = Math.max(1, Number(readiness.total ?? joined ?? 0));
  const rows = readiness.rows || [];
  const issues = [
    { label: 'Застрявшие команды', value: helpQueue.length || readiness.blocked || 0, tone: 'warn' },
    { label: 'Нет закупок', value: rows.filter(row => row.noPurchase).length, tone: 'warn' },
    { label: 'Нет сотрудников', value: rows.filter(row => row.noWorkers).length, tone: 'warn' },
    { label: 'Не собрали продукт', value: rows.filter(row => row.noProduction).length, tone: 'warn' },
    { label: 'Нет запроса на продажу', value: rows.filter(row => row.noSaleOffer).length, tone: 'warn' },
    { label: 'Риск банкротства', value: rows.filter(row => row.debtRisk).length, tone: 'danger' },
  ];
  const startGateInfo = teacherStartGateInfo(room);
  const statusTone = room?.status === 'running' && helpQueue.length ? 'warn'
    : room?.status === 'lobby' && !startGateInfo.canStart ? startGateInfo.tone
    : 'ok';
  const statusTitle = room?.status === 'lobby'
    ? startGateInfo.title
    : room?.status === 'running' && helpQueue.length ? 'Нужна помощь командам' : 'Матч идет штатно';
  const statusHint = room?.status === 'lobby'
    ? startGateInfo.body
    : helpQueue.length ? `Первый блокер: ${helpQueue[0]?.userName || 'команда'}` : 'Следите за первым ходом и готовностью.';
  return `
    <div class="teacher-class-cockpit" data-uiux-slice="teacher-class-readiness">
      <div class="teacher-readiness-mini">
        <span>
          <small>Присоединились</small>
          <b>${joined} / ${maxPlayers}</b>
          <i class="live-meter" style="--live-meter:${uiPercent(joined, maxPlayers)}%"></i>
        </span>
        <span class="${ready >= total && total > 0 ? 'ok' : 'warn'}">
          <small>Готовы</small>
          <b>${ready} / ${total}</b>
          <i class="live-meter" style="--live-meter:${uiPercent(ready, total)}%"></i>
        </span>
      </div>
      <div class="teacher-launch-status ${statusTone}">
        <b>${escapeHtml(statusTitle)}</b>
        <small>${escapeHtml(statusHint)}</small>
      </div>
      <div class="teacher-issue-list">
        ${issues.map(item => `
          <article class="${Number(item.value || 0) ? item.tone : 'ok'}">
            <span></span>
            <strong>${escapeHtml(item.label)}</strong>
            <b>${escapeHtml(String(item.value || 0))}</b>
          </article>
        `).join('')}
      </div>
      <details class="teacher-roster-compact">
        <summary>
          <span>Кто вошел / кто готов</span>
          <b>${ready}/${joined}</b>
        </summary>
        <div class="teacher-cockpit-roster">${teacherRosterMarkup(room)}</div>
      </details>
      ${helpQueue.length ? `
        <details class="teacher-roster-compact teacher-help-compact">
          <summary>
            <span>К кому подойти</span>
            <b>${Math.min(helpQueue.length, 4)}</b>
          </summary>
          <div class="teacher-cockpit-priority-list">${teacherPriorityHelpMarkup(helpQueue)}</div>
        </details>
      ` : ''}
    </div>`;
}

function teacherPrimaryHostAction(room, readiness, controls = room?.teacherControls || {}) {
  if (!room) return '';
  if (controls.lifecycle?.contract === 'teacher-lifecycle-v1') {
    return controls.lifecycle.primaryAction || '';
  }
  if (room.status === 'lobby' && teacherStartGateInfo(room).canStart) return 'start-game';
  if (room.status === 'paused') return 'resume-game';
  if (room.status === 'running' && (readiness?.total || 0) > 0 && (readiness?.ready || 0) === (readiness?.total || 0)) return 'next-turn';
  if (room.status === 'running') return 'pause-game';
  return '';
}

function renderTeacherHostControls({ controls, readiness }) {
  const room = state.room || {};
  const lifecycle = controls.lifecycle || {};
  const primaryHostAction = teacherPrimaryHostAction(room, readiness, controls);
  const ready = Number(readiness?.ready ?? room.readyCount ?? 0);
  const total = Number(readiness?.total ?? room.humanCount ?? 0);
  const blocked = Number(readiness?.blocked || 0);
  const statusTone = room.status === 'running' ? 'ok' : room.status === 'paused' ? 'warn' : room.status === 'finished' ? 'danger' : 'neutral';
  const startButtonMarkup = controls.actions?.startGame || room.status === 'lobby'
    ? `<button type="button" class="${primaryHostAction === 'start-game' ? 'primary-teacher-action' : ''}" data-host-action="start-game" ${controls.actions?.startGame ? '' : 'disabled'}>${iconButtonLabel(teacherHostActionIcon('start-game'), 'Запустить матч')}</button>`
    : '';
  return `
    <article class="market-item teacher-compact-card teacher-control-card"
      data-teacher-lifecycle-contract="${escapeHtml(lifecycle.contract || 'teacher-lifecycle-legacy')}"
      data-teacher-phase="${escapeHtml(lifecycle.phase || room.status || 'unknown')}"
      data-teacher-primary-action="${escapeHtml(primaryHostAction)}"
      data-teacher-next-phase="${escapeHtml(lifecycle.nextExpectedPhase || room.status || 'unknown')}">
      <div class="teacher-control-head">
        <span class="teacher-panel-icon">${gameIcon('cabinet')}</span>
        <div>
          <span class="factory-node-label">Управление игрой</span>
          <strong>Пульт матча</strong>
          <small>Пауза, продолжение, следующий ход и завершение прямо из игры.</small>
        </div>
        <span class="mini-badge ${statusTone}">${escapeHtml(teacherRoomStatusLabel(room.status))}</span>
      </div>
      <div class="teacher-control-state">
        <span><b>${ready}/${Math.max(total, 1)}</b><small>готовы</small></span>
        <span><b>${blocked}</b><small>застряли</small></span>
        <span><b>${escapeHtml(String(room.day || 1))}</b><small>ход</small></span>
      </div>
      <div class="teacher-cockpit-actions" aria-label="Управление матчем">
        <button type="button" class="ghost ${primaryHostAction === 'pause-game' ? 'primary-teacher-action' : ''}" data-host-action="pause-game" ${controls.actions?.pause ? '' : 'disabled'}>${iconButtonLabel(teacherHostActionIcon('pause-game'), 'Пауза')}</button>
        <button type="button" class="ghost ${primaryHostAction === 'resume-game' ? 'primary-teacher-action' : ''}" data-host-action="resume-game" ${controls.actions?.resume ? '' : 'disabled'}>${iconButtonLabel(teacherHostActionIcon('resume-game'), 'Продолжить')}</button>
        <button type="button" class="${primaryHostAction === 'next-turn' ? 'primary-teacher-action' : ''}" data-host-action="next-turn" ${controls.actions?.nextTurn ? '' : 'disabled'}>${iconButtonLabel(teacherHostActionIcon('next-turn'), 'Следующий ход')}</button>
        <button type="button" class="ghost danger-button" data-host-action="finish-room" ${controls.actions?.finish ? '' : 'disabled'}>${iconButtonLabel(teacherHostActionIcon('finish-room'), 'Завершить игру')}</button>
        ${startButtonMarkup}
      </div>
    </article>`;
}

function renderTeacherNowCard(readiness = {}, helpQueue = []) {
  const rows = readiness.rows || [];
  const checklist = [
    { label: 'Команды без закупок', value: rows.filter(row => row.noPurchase).length, tone: 'warn', icon: 'purchase', hint: 'сырье не куплено' },
    { label: 'Команды без сотрудников', value: rows.filter(row => row.noWorkers).length, tone: 'warn', icon: 'teams', hint: 'сборка будет заблокирована' },
    { label: 'Застрявшие команды', value: helpQueue.length || readiness.blocked || 0, tone: 'warn', icon: 'alert', hint: 'нужна подсказка' },
    { label: 'Риск банкротства', value: rows.filter(row => row.debtRisk).length, tone: 'danger', icon: 'alert', hint: 'долг или кассовый разрыв' },
    { label: 'Следующая Crisis Card', value: state.room?.activeEvent ? 0 : 1, tone: 'ok', icon: 'crisis', hint: state.room?.activeEvent ? 'событие уже активно' : 'готова к запуску' },
  ];
  return `
    <article class="market-item teacher-compact-card teacher-now-card">
      <div class="teacher-now-head">
        <span class="teacher-panel-icon">${gameIcon('check')}</span>
        <div>
          <span class="factory-node-label">Что сделать сейчас</span>
          <strong>${escapeHtml(teacherNextAction(state.room || {}, readiness, helpQueue))}</strong>
        </div>
      </div>
      <div class="teacher-now-list">
        ${checklist.map(item => `
          <button type="button" class="${item.value ? item.tone : 'ok'}" data-game-tab="${item.value ? 'teacher' : 'events'}">
            <span class="teacher-now-icon">${gameIcon(item.value ? item.icon : 'check')}</span>
            <span class="teacher-now-copy">
              <strong>${escapeHtml(item.label)}</strong>
              <small>${escapeHtml(item.hint)}</small>
            </span>
            <b class="teacher-now-count">${escapeHtml(String(item.value))}</b>
          </button>
        `).join('')}
      </div>
    </article>`;
}

function renderTeacherMarketPulse(dataRows = []) {
  const market = Array.isArray(state.room?.market) ? state.room.market : [];
  const latestMarket = market[market.length - 1] || {};
  const fallbackDemand = dataRows.reduce((sum, row) => sum + Number(row.saleQuantity || 0), 0) || state.room?.factoryScenario?.baseDemandMax || 1200;
  const fallbackSales = dataRows.reduce((sum, row) => sum + Number(row.sales || row.soldUnits || 0), 0);
  const fallbackPrice = state.room?.factoryScenario?.priceRange?.max || state.room?.factoryScenario?.basePrice || 18000;
  const history = marketChartHistory({
    demand: latestMarket.demand || fallbackDemand,
    totalSales: latestMarket.totalSales || fallbackSales,
    avgPrice: latestMarket.avgPrice || fallbackPrice,
  });
  const latest = history[history.length - 1] || {};
  const previous = history[history.length - 2] || latest;
  const demandValues = history.map(entry => Number(entry.demand || 0));
  const salesValues = history.map(entry => Number(entry.totalSales || 0));
  const priceValues = history.map(entry => Number(entry.avgPrice || 0));
  const demandDelta = Number(latest.demand || 0) - Number(previous.demand || 0);
  const demandTone = demandDelta >= 0 ? 'positive' : 'negative';
  const demandDeltaLabel = `${demandDelta >= 0 ? '+' : ''}${compactMarketNumber(demandDelta)}`;
  const fillRate = uiPercent(Number(latest.totalSales || 0), Math.max(Number(latest.demand || 0), 1));
  const avgPrice = Number(latest.avgPrice || fallbackPrice);
  return `
    <section class="teacher-market-pulse">
      <div class="teacher-cockpit-section-head">
        <strong>Спрос на рынке</strong>
        <span>прогноз</span>
      </div>
      <div class="teacher-market-chart">
        ${miniChart(demandValues, 'positive')}
        <div>
          <strong>${compactMarketNumber(latest.demand || fallbackDemand)}</strong>
          <small class="${demandTone}">${demandDeltaLabel} к прошлому ходу</small>
        </div>
      </div>
      <div class="teacher-market-stats">
        <span>
          <small>Продано</small>
          <b>${compactMarketNumber(latest.totalSales || 0)}</b>
        </span>
        <span>
          <small>Покрытие</small>
          <b>${fillRate}%</b>
        </span>
        <span>
          <small>Средняя цена</small>
          <b>${money(avgPrice)}</b>
        </span>
        <span>
          <small>Цена тренд</small>
          <b>${compactMarketNumber(priceValues[priceValues.length - 1] || avgPrice)}</b>
        </span>
      </div>
      <div class="teacher-market-bars" aria-label="Мини-гистограмма спроса и продаж">
        ${history.slice(-6).map((entry, index) => {
          const maxValue = Math.max(...demandValues, ...salesValues, 1);
          return `
            <i>
              <b style="height:${barHeight(entry.demand, maxValue, 38)}px"></b>
              <em style="height:${barHeight(entry.totalSales, maxValue, 38)}px"></em>
              <small>${escapeHtml(String(entry.day || index + 1))}</small>
            </i>`;
        }).join('')}
      </div>
    </section>`;
}

function renderTeacherGameDashboard(dashboard, readiness) {
  const rows = dashboard?.rows || [];
  const activeRows = rows.filter(row => !row.isBot);
  const dataRows = activeRows.length ? activeRows : rows;
  const totalMoney = dataRows.reduce((sum, row) => sum + Number(row.money || 0), 0);
  const totalStock = dataRows.reduce((sum, row) => sum + Number(row.finishedGoods || 0), 0);
  const totalWorkers = dataRows.reduce((sum, row) => sum + Number(row.workerCount || 0), 0);
  const totalOrders = dataRows.reduce((sum, row) => sum + Number(row.saleQuantity || 0), 0);
  const routeSteps = readiness?.stepMap?.length ? readiness.stepMap : [
    { key: 'warehouse', label: 'Купить', ready: 0, stuck: 0 },
    { key: 'workforce', label: 'Нанять', ready: 0, stuck: 0 },
    { key: 'assembly', label: 'Собрать', ready: 0, stuck: 0 },
    { key: 'sale', label: 'Продать', ready: 0, stuck: 0 },
    { key: 'finish', label: 'Завершить ход', ready: 0, stuck: 0 },
  ];
  const primaryStep = readiness?.routeSummary?.primaryStep || routeSteps.find(step => step.stuck > 0) || routeSteps[0];
  const nextTitle = primaryStep?.label ? `${primaryStep.label}` : 'Проверить команды';
  const topRows = [...dataRows]
    .sort((left, right) => Number(right.rankScore || 0) - Number(left.rankScore || 0))
    .slice(0, 5);
  return `
    <article class="market-item results-wide teacher-game-dashboard-card">
      <div class="teacher-dashboard-head">
        <div>
          <strong>Игровой дашборд</strong>
          <small>Ход ${escapeHtml(String(state.room?.day || 1))} из ${escapeHtml(String(state.room?.settings?.dayLimit || 30))}</small>
        </div>
        <span class="mini-badge ${Number(readiness?.blocked || 0) ? 'warn' : 'ok'}">${Number(readiness?.ready || 0)}/${Number(readiness?.total || 0)} готовы</span>
      </div>
      <div class="teacher-turn-route">
        <span>Маршрут команды на ход</span>
        <div>
          ${routeSteps.slice(0, 5).map((step, index) => {
            const active = step.key === primaryStep?.key;
            const tone = step.stuck > 0 ? 'warn' : step.ready > 0 ? 'ok' : '';
            return `
              <article class="${tone} ${active ? 'active' : ''}">
                <b>${index + 1}</b>
                <strong>${escapeHtml(step.label)}</strong>
                <small>${step.stuck ? `${step.stuck} ждут` : step.ready ? `${step.ready} готовы` : 'нет команд'}</small>
              </article>`;
          }).join('')}
        </div>
      </div>
      <div class="teacher-next-action-band">
        <div>
          <span>Следующее действие команды</span>
          <strong>${escapeHtml(nextTitle)}</strong>
          <small>${escapeHtml(readiness?.routeSummary?.primaryStep ? `Главный узкий шаг: ${readiness.routeSummary.primaryStep.stuck} команд` : 'Команды идут по учебному циклу')}</small>
        </div>
        <button type="button" data-game-tab="operations">Перейти к действию</button>
      </div>
      <div class="teacher-game-kpis">
        ${renderLiveMetricCard({ label: 'Деньги', value: money(totalMoney), hint: 'суммарный кэш класса', percent: uiPercent(totalMoney, Math.max(totalMoney, 1)), tone: 'ok' })}
        ${renderLiveMetricCard({ label: 'Готовый склад', value: `${totalStock} ед.`, hint: 'товар на складах', percent: uiPercent(totalStock, Math.max(totalStock + totalOrders, 1)), tone: totalStock ? 'ok' : 'warn' })}
        ${renderLiveMetricCard({ label: 'Сотрудники', value: String(totalWorkers), hint: 'нанятые работники', percent: uiPercent(totalWorkers, Math.max(dataRows.length, 1)), tone: totalWorkers ? 'ok' : 'warn' })}
        ${renderLiveMetricCard({ label: 'Заявки', value: String(totalOrders), hint: 'единиц выставлено', percent: uiPercent(totalOrders, Math.max(totalOrders + totalStock, 1)), tone: totalOrders ? 'ok' : 'warn' })}
      </div>
      <div class="teacher-game-bottom">
        ${renderTeacherMarketPulse(dataRows)}
        <section>
          <div class="teacher-cockpit-section-head">
            <strong>Прогресс команд</strong>
            <span>по готовности</span>
          </div>
          <div class="teacher-progress-list">
            ${topRows.map((row, index) => {
              const progress = row.readyForTurn ? 100 : Math.max(12, 100 - Number(row.priority || 0) * 18);
              return `
                <article>
                  <span>${index + 1}</span>
                  <strong>${escapeHtml(row.companyName)}</strong>
                  <i><b style="width:${uiPercent(progress, 100)}%"></b></i>
                  <small>${escapeHtml(row.nextAction || row.issue || 'проверить')}</small>
                </article>`;
            }).join('') || '<p class="muted">Команды появятся после входа учеников.</p>'}
          </div>
        </section>
        <section>
          <div class="teacher-cockpit-section-head">
            <strong>Таблица лидеров</strong>
            <span>score</span>
          </div>
          <div class="teacher-mini-leaderboard">
            ${topRows.map((row, index) => `
              <article>
                <span>${index + 1}</span>
                <strong>${escapeHtml(row.companyName)}</strong>
                <b>${money(row.netWorth)}</b>
                <small class="${row.lastProfit >= 0 ? 'positive' : 'negative'}">${money(row.lastProfit)}</small>
              </article>
            `).join('') || '<p class="muted">Лидерборд появится после входа команд.</p>'}
          </div>
        </section>
      </div>
    </article>`;
}

function renderTeacherCockpit({ readiness, helpQueue }) {
  const room = state.room || {};
  const lifecycle = room.teacherControls?.lifecycle || {};
  const tone = teacherCockpitTone(room, readiness, helpQueue);
  const dayLimit = room.settings?.dayLimit || 30;
  const maxPlayers = room.settings?.maxPlayers || room.maxPlayers || 30;
  const inMatch = ['running', 'paused'].includes(room.status);
  const joined = Number(readiness?.total ?? room.humanCount ?? 0);
  const ready = inMatch
    ? Number(readiness?.ready ?? 0)
    : Number(room.readyCount ?? 0);
  const readyLabel = inMatch ? 'готовы к ходу' : 'готовы к старту';
  const statusLabel = teacherRoomStatusLabel(room.status);
  const activeCrisisCard = crisisCardForEventKey(room.activeEvent?.key);
  const activeCrisisMarkup = activeCrisisCard ? `
    <div class="teacher-cockpit-crisis">
      <span class="factory-node-label">Активная Crisis Card</span>
      <strong>${escapeHtml(activeCrisisCard.title)}</strong>
      <small>${escapeHtml(activeCrisisCard.question)}</small>
    </div>
  ` : '';

  return `
    <article class="teacher-cockpit-card ${tone}"
      data-teacher-lifecycle-contract="${escapeHtml(lifecycle.contract || 'teacher-lifecycle-legacy')}"
      data-teacher-phase="${escapeHtml(lifecycle.phase || room.status || 'unknown')}">
      <div class="teacher-cockpit-head">
        <div>
          <span class="factory-node-label">Преподаватель</span>
          <strong>Состояние класса</strong>
          <p>Готовность, блокеры первого хода и команды, которым нужна помощь.</p>
        </div>
        <div class="teacher-cockpit-status">
          <span>${escapeHtml(statusLabel)}</span>
          <b>${escapeHtml(String(ready))}/${escapeHtml(String(joined))} ${escapeHtml(readyLabel)}</b>
          <small>${escapeHtml(String(joined))}/${escapeHtml(String(maxPlayers))} вошли • ход ${escapeHtml(String(room.day || 1))}/${escapeHtml(String(dayLimit))}</small>
        </div>
      </div>
      ${renderTeacherClassReadiness(room, readiness, helpQueue)}
      ${activeCrisisMarkup}
    </article>`;
}

function renderTeacherPanel() {
  if (!elements.teacherPanel) return;

  const preservedEventKey = document.querySelector('#teacher-event-select')?.value || '';
  const preservedTargetPlayerId = document.querySelector('#teacher-target-player-select')?.value || '';
  const preservedExperimentParameter = document.querySelector('#teacher-experiment-parameter')?.value || '';
  const preservedExperimentValues = document.querySelector('#teacher-experiment-values')?.value || '';
  const preservedExperimentTurns = document.querySelector('#teacher-experiment-turns')?.value || '';
  const preservedExperimentSeed = document.querySelector('#teacher-experiment-seed')?.value || '';
  const preservedDashboardSort = document.querySelector('#teacher-dashboard-sort')?.value || '';

  if (!hasRenderSignatureChanged('teacherPanel', {
    roomCode: state.room?.code || '',
    roomVersion: state.room?.version || 0,
    roomStatus: state.room?.status || '',
    roomDay: state.room?.day || 0,
    roomTick: state.room?.tick || 0,
    playerId: state.player?.id || '',
    playerVersion: state.player?.version || 0,
    isHost: Boolean(state.player?.isHost),
    language: state.settings.language,
    currentGameTab: state.currentGameTab,
    preservedEventKey,
    preservedTargetPlayerId,
    preservedExperimentParameter,
    preservedExperimentValues,
    preservedExperimentTurns,
    preservedExperimentSeed,
    preservedDashboardSort,
  })) return;

  elements.teacherPanel.innerHTML = '';
  elements.teacherPanel.classList.remove('placeholder');

  if (!state.room || !state.player) {
    elements.teacherPanel.classList.add('placeholder');
    elements.teacherPanel.innerHTML = `<div>${t('teacher_panel_empty')}</div>`;
    return;
  }

  if (!state.player.isHost) {
    elements.teacherPanel.classList.add('placeholder');
    elements.teacherPanel.innerHTML = `<div>${t('teacher_host_only')}</div>`;
    return;
  }

  const controls = state.room.teacherControls || {};
  const snapshot = state.room.classSnapshot || { rows: [] };
  const dashboard = state.room.classDashboard || { rows: [] };
  const readiness = state.room.classReadiness || { rows: [] };
  const briefing = readiness.briefing || null;
  const routeSummary = readiness.routeSummary || null;
  const stepMap = readiness.stepMap || [];
  const lessonPlan = state.room.lessonPlan || null;
  const experiment = state.room.scenarioExperiment || null;
  const phaseLock = controls.phaseLock || 'open';
  const eventCatalog = controls.eventCatalog || [];
  const snapshotRows = snapshot.rows || [];
  const explicitHelpRequests = state.room.helpRequests || [];
  const explicitPlayerIds = new Set(explicitHelpRequests.map(request => request.playerId));
  const helpQueue = [
    ...explicitHelpRequests,
    ...(readiness.helpQueue || []).filter(request => !explicitPlayerIds.has(request.playerId)),
  ];
  const selectedEventKey = eventCatalog.find(item => item.key === preservedEventKey)?.key || eventCatalog[0]?.key || '';
  const selectedTargetPlayerId = snapshotRows.find(item => item.playerId === preservedTargetPlayerId)?.playerId
    || snapshotRows.find(item => !item.isBot)?.playerId
    || '';

  const eventOptions = eventCatalog.length
    ? eventCatalog.map(item => `<option value="${escapeHtml(item.key)}" ${item.key === selectedEventKey ? 'selected' : ''}>${escapeHtml(teacherEventLabel(item))}</option>`).join('')
    : '<option value="">—</option>';
  const targetOptions = snapshotRows.length
    ? snapshotRows
        .filter(item => !item.isBot)
        .map(item => `<option value="${escapeHtml(item.playerId)}" ${item.playerId === selectedTargetPlayerId ? 'selected' : ''}>#${item.rank} ${escapeHtml(item.userName)} — ${escapeHtml(item.companyName)}</option>`)
        .join('')
    : '<option value="">—</option>';

  const snapshotMarkup = snapshotRows.length
    ? snapshotRows.map(row => `
        <article class="leader">
          <div class="player-line">
            <div>
              <strong>#${row.rank} ${escapeHtml(row.userName)}</strong>
              <small>${escapeHtml(row.companyName)}</small>
              <div class="badge-inline-row">
                <span class="mini-badge">${t('teacher_snapshot_contracts')}: ${row.completedContracts}</span>
                <span class="mini-badge">${t(`risk_${row.riskLevel || 'low'}`)}</span>
                ${row.bankrupt ? `<span class="mini-badge warn">${t('bankrupt')}</span>` : ''}
              </div>
            </div>
          </div>
          <div>
            <strong>${row.simulationScore}</strong>
            <small>${money(row.netWorth)}</small>
          </div>
          <small>${t('teacher_snapshot_cash')}: ${money(row.money)} • ${t('teacher_snapshot_debt')}: ${money(row.debt)} • ${t('teacher_snapshot_last_action')}: ${escapeHtml(row.lastAction || '—')}</small>
        </article>
      `).join('')
    : `<div class="market-item">${t('teacher_snapshot_empty')}</div>`;
  const readinessRows = (readiness.rows || []).length
    ? readiness.rows.map(row => `
        <article class="readiness-row ${checklistStatusClass(row.status)}">
          <div>
            <strong>${escapeHtml(row.userName)}</strong>
            <small>${escapeHtml(row.companyName)} • склад ${row.finishedGoods || 0} • заявка ${row.saleQuantity || 0}</small>
          </div>
          <span>${checklistStatusLabel(row.status)}</span>
          <b>${escapeHtml(row.actionHint || (row.noSaleOffer ? 'без заявки' : row.noProduction ? 'без выпуска' : row.debtRisk ? 'риск долга' : 'цикл ок'))}</b>
        </article>
      `).join('')
    : `<div class="market-item">${t('teacher_snapshot_empty')}</div>`;
  const helpQueueMarkup = helpQueue.length
    ? helpQueue.map((row, index) => `
        <article class="readiness-row ${checklistStatusClass(row.status)}">
          <div>
            <strong>${index + 1}. ${escapeHtml(row.userName)}</strong>
            <small>${escapeHtml(row.companyName)} • ${escapeHtml(row.reason || 'требует внимания')}</small>
          </div>
          <span>${escapeHtml(row.actionHint || 'Проверить')}</span>
          <b>${money(row.money)} • долг ${money(row.debt)}</b>
        </article>
      `).join('')
    : '<div class="market-item">Критических блокеров нет. Можно разбирать решения или завершать ход.</div>';
  const briefingMarkup = briefing ? `
    <div class="teacher-briefing ${checklistStatusClass(briefing.status)}">
      <div>
        <span class="factory-node-label">Брифинг занятия</span>
        <strong>${escapeHtml(briefing.title || 'Статус класса')}</strong>
        <p>${escapeHtml(briefing.summary || '')}</p>
        <small>${escapeHtml(briefing.recommendedAction || '')}</small>
      </div>
      <div class="teacher-prompts">
        ${(briefing.discussionPrompts || []).slice(0, 3).map(prompt => `<span>${escapeHtml(prompt)}</span>`).join('')}
      </div>
    </div>
  ` : '';
  const routeMapMarkup = stepMap.length ? `
    <div class="teacher-route-map top-gap">
      <div class="teacher-route-head">
        <div>
          <span class="factory-node-label">Карта хода класса</span>
          <strong>${escapeHtml(routeSummary?.title || 'Где застряли команды')}</strong>
          <small>${routeSummary?.primaryStep ? `Главный узкий шаг: ${escapeHtml(routeSummary.primaryStep.label)} (${routeSummary.primaryStep.stuck})` : 'Критических узких шагов нет.'}</small>
        </div>
      </div>
      <div class="teacher-route-steps">
        ${stepMap.map((step, index) => {
          const tone = step.stuck > 0 ? 'warn' : step.ready > 0 ? 'ok' : '';
          const names = (step.students || []).map(item => item.userName).join(', ');
          return `
            <article class="${tone}">
              <b>${index + 1}</b>
              <strong>${escapeHtml(step.label)}</strong>
              <span>${step.stuck || 0} ждут</span>
              <small>${names ? escapeHtml(names) : step.ready ? 'готовы к пересчету' : 'нет команд'}</small>
            </article>`;
        }).join('')}
      </div>
    </div>
  ` : '';
  const lessonPlanMarkup = lessonPlan ? `
    <article class="market-item results-wide lesson-plan-card teacher-lesson-card">
      <div>
        <span class="factory-node-label">Сценарий занятия</span>
        <strong>${escapeHtml(lessonPlan.title || state.room.scenarioLabel)}</strong>
        <p>${escapeHtml(lessonPlan.audience || '')} • ${escapeHtml(lessonPlan.duration || '')}</p>
      </div>
      <div class="lesson-plan-grid">
        ${(lessonPlan.objectives || []).slice(0, 3).map(item => `<span>${escapeHtml(item)}</span>`).join('')}
      </div>
      <div class="teacher-prompts top-gap">
        ${(lessonPlan.discussionPrompts || []).slice(0, 3).map(prompt => `<span>${escapeHtml(prompt)}</span>`).join('')}
      </div>
      ${(lessonPlan.parameters || []).length ? `
        <div class="scenario-lab-preview compact top-gap">
          <strong>Параметры сценария</strong>
          <div>
            ${(lessonPlan.parameters || []).slice(0, 5).map(item => `<span><b>${escapeHtml(item.value || '')}</b><small>${escapeHtml(item.label || '')}</small></span>`).join('')}
          </div>
        </div>
      ` : ''}
      ${(lessonPlan.experimentAxes || []).length ? `
        <div class="teacher-prompts top-gap">
          ${(lessonPlan.experimentAxes || []).slice(0, 4).map(axis => `<span>${escapeHtml(axis.label || '')}: ${escapeHtml(axis.question || '')}</span>`).join('')}
        </div>
      ` : ''}
    </article>
  ` : '';
  const experimentMarkup = renderTeacherExperimentPanel({
    controls,
    experiment,
    preservedParameter: preservedExperimentParameter,
    preservedValues: preservedExperimentValues,
    preservedTurns: preservedExperimentTurns,
    preservedSeed: preservedExperimentSeed,
  });
  const teacherControlMarkup = renderTeacherHostControls({ controls, readiness });
  const teacherNowMarkup = renderTeacherNowCard(readiness, helpQueue);
  const gameDashboardMarkup = renderTeacherGameDashboard(dashboard, readiness);
  const dashboardMarkup = renderTeacherDashboard(dashboard, preservedDashboardSort);
  const cockpitMarkup = renderTeacherCockpit({ readiness, helpQueue });
  const crisisCardsMarkup = renderCrisisCards(eventCatalog, selectedEventKey, controls);
  const teacherPhaseMarkup = `
    <article class="market-item teacher-compact-card teacher-phase-card">
      <div>
        <span class="factory-node-label">Темп занятия</span>
        <strong>${t('teacher_controls_title')}</strong>
        <small>${t('teacher_controls_hint')}</small>
      </div>
      <div class="teacher-phase-metrics">
        <span><b>${teacherPhaseLabel(phaseLock)}</b><small>${t('teacher_phase_badge')}</small></span>
        <span><b>${state.room.day}</b><small>${t('day')}</small></span>
        <span><b>${state.room.tick}</b><small>${t('ticks_label')}</small></span>
      </div>
      <div class="button-pair host-controls teacher-phase-actions top-gap">
        <button type="button" data-teacher-action="set-phase-lock" data-phase-lock="open" ${controls.actions?.setPhaseLock ? '' : 'disabled'}>${t('teacher_phase_open')}</button>
        <button type="button" class="ghost" data-teacher-action="set-phase-lock" data-phase-lock="review" ${controls.actions?.setPhaseLock ? '' : 'disabled'}>${t('teacher_phase_review')}</button>
      </div>
    </article>`;
  const teacherEventMarkup = `
    <article class="market-item teacher-compact-card teacher-event-card">
      <strong>Другие учебные события</strong>
      <small>${t('teacher_force_event_hint')}</small>
      <label class="top-gap">
        <span>${t('event_title')}</span>
        <select id="teacher-event-select">${eventOptions}</select>
      </label>
      <div class="top-gap">
        <button type="button" data-teacher-action="force-event" ${controls.actions?.forceEvent && selectedEventKey ? '' : 'disabled'}>${t('teacher_force_event_button')}</button>
      </div>
    </article>`;
  const teacherDecisionMarkup = `
    <article class="market-item teacher-compact-card teacher-decision-card">
      <strong>${t('teacher_force_round_title')}</strong>
      <small>${t('teacher_force_round_hint')}</small>
      <label class="top-gap">
        <span>${t('teacher_target_company')}</span>
        <select id="teacher-target-player-select">${targetOptions}</select>
      </label>
      <div class="top-gap">
        <button type="button" class="ghost" data-teacher-action="force-decision-round" ${controls.actions?.forceDecisionRound && selectedTargetPlayerId ? '' : 'disabled'}>${t('teacher_force_round_button')}</button>
      </div>
    </article>`;
  const readinessMarkup = `
    <article class="market-item results-wide class-readiness-card teacher-readiness-compact">
      <strong>Готовность класса</strong>
      <small>Кто готов к ходу, кто без заявки, без выпуска или близко к долговому риску.</small>
      <div class="readiness-stats top-gap">
        <span><b>${readiness.ready || 0}</b> готовы</span>
        <span><b>${readiness.attention || 0}</b> внимание</span>
        <span><b>${readiness.blocked || 0}</b> блокер</span>
        <span><b>${readiness.noPurchase || 0}</b> без закупки</span>
        <span><b>${readiness.noWorkers || 0}</b> без людей</span>
        <span><b>${readiness.noSaleOffer || 0}</b> без заявки</span>
        <span><b>${readiness.noProduction || 0}</b> без выпуска</span>
        <span><b>${readiness.debtRisk || 0}</b> долг</span>
        <span><b>${readiness.needsDecision || 0}</b> дилемма</span>
      </div>
      <div class="teacher-alert-strip top-gap">
        <span>Без закупки: ${(readiness.rows || []).filter(row => row.noPurchase).map(row => row.userName).join(', ') || 'нет'}</span>
        <span>Без работников: ${(readiness.rows || []).filter(row => row.noWorkers).map(row => row.userName).join(', ') || 'нет'}</span>
        <span>Без заявки: ${(readiness.rows || []).filter(row => row.noSaleOffer).map(row => row.userName).join(', ') || 'нет'}</span>
        <span>Без производства: ${(readiness.rows || []).filter(row => row.noProduction).map(row => row.userName).join(', ') || 'нет'}</span>
        <span>Долговой риск: ${(readiness.rows || []).filter(row => row.debtRisk).map(row => row.userName).join(', ') || 'нет'}</span>
      </div>
      <div class="teacher-help-queue top-gap">
        <strong>Кому нужна помощь</strong>
        <small>Список отсортирован по срочности: сначала блокеры, потом риск заявки и долга.</small>
        <div class="readiness-list top-gap">${helpQueueMarkup}</div>
      </div>
      <div class="readiness-list top-gap">${readinessRows}</div>
    </article>`;
  const snapshotPanelMarkup = `
    <article class="market-item results-wide teacher-snapshot-card">
      <strong>${t('teacher_snapshot_title')}</strong>
      <small>${t('teacher_snapshot_hint')}</small>
      <div class="leaderboard top-gap">${snapshotMarkup}</div>
    </article>`;

  elements.teacherPanel.innerHTML = `
    <div class="teacher-workspace-grid" data-uiux-slice="teacher-cockpit-2">
      ${cockpitMarkup}
      <div class="teacher-workspace-main">
        ${gameDashboardMarkup}
        <details class="teacher-secondary-drawer">
          <summary>
            <span>Отчеты и расширенная диагностика</span>
            <small>таблица лидеров, готовность, снимок класса и карта хода</small>
          </summary>
          <div class="teacher-secondary-drawer-body">
            ${dashboardMarkup}
            ${readinessMarkup}
            ${snapshotPanelMarkup}
            ${briefingMarkup}
            ${routeMapMarkup}
          </div>
        </details>
      </div>
      <aside class="teacher-workspace-side" aria-label="Инструменты преподавателя">
        ${teacherControlMarkup}
        ${teacherNowMarkup}
        <details class="teacher-crisis-drawer" open>
          <summary>
            <span>Crisis Cards</span>
            <small>учебные сценарии для обсуждения</small>
          </summary>
          <div class="teacher-crisis-drawer-body">
            ${crisisCardsMarkup}
          </div>
        </details>
        <details class="teacher-advanced-tools">
          <summary>
            <span>Дополнительные инструменты</span>
            <small>темп, события, раунды, эксперимент</small>
          </summary>
          <div class="teacher-advanced-tools-body">
            ${teacherPhaseMarkup}
            ${teacherEventMarkup}
            ${teacherDecisionMarkup}
            ${experimentMarkup}
            ${lessonPlanMarkup}
          </div>
        </details>
      </aside>
    </div>`;

  elements.teacherPanel.querySelectorAll('[data-host-action]').forEach(button => {
    button.addEventListener('click', () => sendAction(button.dataset.hostAction));
  });
  elements.teacherPanel.querySelectorAll('[data-help-action]').forEach(button => {
    button.addEventListener('click', () => sendAction(button.dataset.helpAction, {
      requestId: button.dataset.helpRequestId || '',
    }));
  });
  elements.teacherPanel.querySelectorAll('[data-game-tab]').forEach(button => {
    button.addEventListener('click', () => setGameTab(button.dataset.gameTab));
  });
  elements.teacherPanel.querySelectorAll('[data-teacher-action="set-phase-lock"]').forEach(button => {
    button.addEventListener('click', () => sendAction('set-phase-lock', button.dataset.phaseLock));
  });
  elements.teacherPanel.querySelector('[data-teacher-action="force-event"]')?.addEventListener('click', () => {
    const select = document.querySelector('#teacher-event-select');
    sendAction('force-event', select?.value || '');
  });
  elements.teacherPanel.querySelectorAll('[data-crisis-card-event]').forEach(button => {
    button.addEventListener('click', () => sendAction('force-event', button.dataset.crisisCardEvent || ''));
  });
  elements.teacherPanel.querySelector('[data-teacher-action="force-decision-round"]')?.addEventListener('click', () => {
    const select = document.querySelector('#teacher-target-player-select');
    sendAction('force-decision-round', { targetPlayerId: select?.value || '' });
  });
  elements.teacherPanel.querySelector('#teacher-experiment-parameter')?.addEventListener('change', event => {
    const valuesInput = document.querySelector('#teacher-experiment-values');
    if (valuesInput) valuesInput.value = teacherExperimentDefaultValues(event.currentTarget.value);
  });
  elements.teacherPanel.querySelector('[data-teacher-action="run-experiment"]')?.addEventListener('click', () => {
    sendAction('run-experiment', {
      parameter: document.querySelector('#teacher-experiment-parameter')?.value || 'basePrice',
      values: document.querySelector('#teacher-experiment-values')?.value || '',
      turns: Number(document.querySelector('#teacher-experiment-turns')?.value || 8),
      seed: Number(document.querySelector('#teacher-experiment-seed')?.value || 42),
    });
  });
  elements.teacherPanel.querySelector('#teacher-dashboard-sort')?.addEventListener('change', () => {
    renderTeacherPanel();
  });
}
