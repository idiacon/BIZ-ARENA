function tutorialUiCopy() {
  const copy = {
    ru: {
      activeHint: 'Нажмите подсвеченный элемент. Остальной интерфейс остаётся доступным.',
      navigationHint: 'Откройте выделенный раздел. Затем подсказка укажет на настоящее игровое действие.',
      actionHint: 'Выполните выделенное действие. Следующий этап откроется только после обновления состояния игры.',
      marketPrepareHint: 'Сначала нажмите «Продать всё», затем подтвердите заявку кнопкой «Выставить».',
      confirmHint: 'Основные решения готовы. Дождитесь пересчёта хода преподавателем или хостом.',
      reviewHint: 'Это уже пройденный этап. Кнопка ниже вернёт к текущей задаче.',
      postTitle: 'Базовый цикл уже пройден',
      postBody: 'На этой карте вы повторяете тот же ритм: Склад -> Персонал -> Сборка -> Маркетинг -> Завершить ход.',
      postMeta: 'Если нужно, обучение можно запустить заново прямо из заводского экрана.',
      postReplay: 'Повторить обучение',
    },
    en: {
      activeHint: 'Click the highlighted element. The rest of the interface remains available.',
      navigationHint: 'Open the highlighted section. The coach will then point to the real game action.',
      actionHint: 'Complete the highlighted action. The next stage opens only after game state updates.',
      marketPrepareHint: 'First press Sell all, then submit the offer.',
      confirmHint: 'Your decisions are ready. Wait for the teacher or host to resolve the turn.',
      reviewHint: 'This stage is already complete. Use the button below to return to the current task.',
      postTitle: 'The base cycle is already complete',
      postBody: 'Use the same rhythm on this map: Warehouse -> People -> Assembly -> Marketing -> Finish turn.',
      postMeta: 'If needed, you can launch the tutorial again directly from the plant screen.',
      postReplay: 'Replay tutorial',
    },
    tt: {
      activeHint: 'Яктыртылган элементка басыгыз. Калган интерфейс ачык кала.',
      navigationHint: 'Яктыртылган бүлекне ачыгыз. Аннары чын уен гамәле күрсәтеләчәк.',
      actionHint: 'Яктыртылган гамәлне үтәгез. Киләсе этап уен хәле яңаргач ачыла.',
      marketPrepareHint: 'Башта «Продать всё», аннары «Выставить» басыгыз.',
      confirmHint: 'Карарлар әзер. Йөрешне укытучы яки хост тәмамлый.',
      reviewHint: 'Бу этап инде үтәлгән. Төймә хәзерге бурычка кире кайтара.',
      postTitle: 'Төп цикл инде узылды',
      postBody: 'Бу картада шул ук тәртип кабатлана: Warehouse -> People -> Assembly -> Marketing -> Finish turn.',
      postMeta: 'Кирәк булса, tutorial-ны завод экраныннан яңадан башлап була.',
      postReplay: 'Tutorial-ны кабатлау',
    },
  };
  return copy[state.settings.language] || copy.ru;
}

function setTutorialCompleted(completed) {
  state.tutorial.completed = Boolean(completed);
  if (state.tutorial.completed) localStorage.setItem(TUTORIAL_COMPLETED_KEY, '1');
  else localStorage.removeItem(TUTORIAL_COMPLETED_KEY);
}

function normalizeFirstTurnTutorialKey(value) {
  const key = String(value || '').trim().toLowerCase();
  if (['personnel', 'people', 'workers', 'workforce'].includes(key)) return 'workforce';
  if (['sale', 'sales', 'shipping', 'market'].includes(key)) return 'market';
  if (['report', 'reports', 'result', 'results', 'finish'].includes(key)) return 'finish';
  return ['purchase', 'assembly'].includes(key) ? key : 'purchase';
}

function firstTurnTutorialStorageKey() {
  const roomCode = String(state.room?.code || state.roomCode || '').trim().toUpperCase();
  const playerId = String(state.player?.id || state.playerId || '').trim();
  if (!roomCode || !playerId) return '';
  return `${FIRST_TURN_TUTORIAL_STORAGE_PREFIX}:${roomCode}:${playerId}`;
}

function firstTurnTutorialDisposition() {
  const key = firstTurnTutorialStorageKey();
  return key ? localStorage.getItem(key) || '' : '';
}

function persistFirstTurnTutorialDisposition(value = '') {
  const key = firstTurnTutorialStorageKey();
  if (!key) return;
  if (value) localStorage.setItem(key, value);
  else localStorage.removeItem(key);
}

function tutorialIsActive() {
  return Boolean(state.tutorial.active);
}

function tutorialShouldRender() {
  return tutorialIsActive() && state.currentScreen === 'game-screen';
}

function currentTutorialStep() {
  if (!tutorialIsActive()) return null;
  const reviewIndex = Number.isInteger(state.tutorial.reviewIndex) ? state.tutorial.reviewIndex : null;
  return state.tutorial.steps[reviewIndex ?? state.tutorial.stepIndex] || null;
}

function buildTutorialSteps() {
  const localized = {
    ru: [
      ['Склад', 'Купите комплект деталей', 'Откройте Склад и купите детали хотя бы для одной сборки.', 'Открыть Склад'],
      ['Команда', 'Наймите сотрудника', 'Без сотрудника сборочная линия не запустится. Выберите доступного кандидата.', 'Открыть Команду'],
      ['Сборочная линия', 'Соберите первый товар', 'Используйте купленные детали и соберите минимум одну единицу товара.', 'Открыть линию'],
      ['Отгрузка', 'Выставьте заявку', 'Укажите цену и объём, затем отправьте готовый товар на рынок.', 'Открыть Отгрузку'],
      ['Завершение', 'Завершите первый ход', 'Проверьте, что все четыре решения готовы. Пересчёт запускает преподаватель или хост.', 'Открыть итог'],
    ],
    en: [
      ['Warehouse', 'Buy a complete parts set', 'Open Warehouse and buy enough parts for at least one assembly.', 'Open Warehouse'],
      ['Team', 'Hire one employee', 'The assembly line needs a worker. Choose an available candidate.', 'Open Team'],
      ['Assembly line', 'Build the first product', 'Use the purchased parts to assemble at least one product.', 'Open assembly'],
      ['Shipping', 'Submit a market offer', 'Set a price and quantity, then send the finished goods to market.', 'Open Shipping'],
      ['Finish', 'Finish the first turn', 'Check that all four decisions are ready. The teacher or host resolves the turn.', 'Open results'],
    ],
    tt: [
      ['Склад', 'Детальләр комплектын сатып алыгыз', 'Складны ачып, бер җыю өчен җитәрлек деталь алыгыз.', 'Складны ачу'],
      ['Команда', 'Бер хезмәткәр яллагыз', 'Җыю линиясе өчен хезмәткәр кирәк. Уңай кандидатны сайлагыз.', 'Команданы ачу'],
      ['Җыю линиясе', 'Беренче товарны җыегыз', 'Алынган детальләрдән кимендә бер товар җыегыз.', 'Линияне ачу'],
      ['Отгрузка', 'Сату заявкасын куегыз', 'Бәя һәм күләмне билгеләп, товарны базарга чыгарыгыз.', 'Отгрузканы ачу'],
      ['Тәмамлау', 'Беренче йөрешне тәмамлагыз', 'Дүрт карар әзерме икәнен тикшерегез. Йөрешне укытучы яки хост исәпли.', 'Нәтиҗәне ачу'],
    ],
  };
  const copy = localized[state.settings.language] || localized.ru;
  const definitions = [
    {
      key: 'purchase',
      phase: 'warehouse',
      actionSelectors: ['[data-supplier-offer]:not([disabled])'],
      navigationSelectors: [
        '.student-primary-next-action[data-student-route-tab="purchase"]',
        '[data-scene-station="purchase"]',
        '[data-game-tab="purchase"]',
      ],
    },
    {
      key: 'workforce',
      phase: 'workers',
      actionSelectors: ['[data-factory-department-detail="workforce"] [data-factory-action="hire-worker"]:not([disabled])'],
      navigationSelectors: [
        '.student-primary-next-action[data-student-route-department="workforce"]',
        '[data-scene-station="workforce"]',
        '[data-game-tab="operations"]',
      ],
    },
    {
      key: 'assembly',
      phase: 'assembly',
      actionSelectors: ['[data-factory-department-detail="assembly"] [data-factory-action="assemble-product"][data-assemble-value="1"]:not([disabled])'],
      navigationSelectors: [
        '.student-primary-next-action[data-student-route-department="assembly"]',
        '[data-scene-station="assembly"]',
        '[data-game-tab="operations"]',
      ],
    },
    {
      key: 'market',
      phase: 'market',
      actionSelectors: [
        '[data-market-sale-action="submit"]:not([disabled])',
        '[data-factory-department-detail="sales"] [data-factory-action="set-sale-offer"]:not([disabled])',
      ],
      navigationSelectors: [
        '.student-primary-next-action[data-student-route-tab="market"]',
        '[data-scene-station="market"]',
        '[data-game-tab="market"]',
      ],
    },
    {
      key: 'finish',
      phase: 'turn',
      actionSelectors: [
        '[data-market-turn-action="next-turn"]:not([disabled])',
        '[data-turn-action="next-turn"]:not([disabled])',
      ],
      navigationSelectors: [
        '.student-primary-next-action[data-student-route-tab="events"]',
        '[data-game-tab="events"]',
      ],
    },
  ];
  return definitions.map((definition, index) => ({
    ...definition,
    chip: 'Шаг ' + (index + 1) + ' из ' + definitions.length,
    routeLabel: copy[index][0],
    title: copy[index][1],
    text: copy[index][2],
    navigationLabel: copy[index][3],
  }));
}

function tutorialGuideStepIndex() {
  const guideKey = normalizeFirstTurnTutorialKey(state.player?.turnGuide?.primaryKey);
  const index = state.tutorial.steps.findIndex(step => step.key === guideKey);
  return Math.max(0, index);
}

function syncTutorialStepFromGuide() {
  if (!tutorialIsActive() || Number.isInteger(state.tutorial.reviewIndex)) return;
  state.tutorial.stepIndex = tutorialGuideStepIndex();
}

function tutorialTurnResolved() {
  const startedDay = Number(state.tutorial.startedDay || 0);
  return startedDay > 0 && Number(state.room?.day || 0) > startedDay;
}

function tutorialElementIsVisible(node) {
  if (!node || !node.isConnected || node.hidden || node.closest('.hidden')) return false;
  const style = window.getComputedStyle(node);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const rect = node.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function firstVisibleTutorialTarget(selectors = []) {
  for (const selector of selectors) {
    const target = [...document.querySelectorAll(selector)].find(tutorialElementIsVisible);
    if (target) return target;
  }
  return null;
}

function tutorialRouteSelectors(stepKey) {
  if (stepKey === 'workforce') {
    return ['[data-student-route-step="personnel"]', '[data-student-route-step="workforce"]'];
  }
  return [`[data-student-route-step="${stepKey}"]`];
}

function resolveTutorialTarget(step) {
  if (!step) return { target: null, mode: 'confirm' };
  if (Number.isInteger(state.tutorial.reviewIndex)) {
    return { target: firstVisibleTutorialTarget(tutorialRouteSelectors(step.key)), mode: 'review' };
  }

  if (step.key === 'market') {
    const quantityInput = firstVisibleTutorialTarget(['#market-sale-quantity', '#factory-sale-quantity']);
    if (quantityInput && Number(quantityInput.value || 0) < 1) {
      const prepareTarget = firstVisibleTutorialTarget([
        '[data-market-sale-action="sell-all"]:not([disabled])',
        '[data-market-sale-action="recommend"]:not([disabled])',
      ]);
      if (prepareTarget) return { target: prepareTarget, mode: 'prepare' };
    }
  }

  const actionTarget = firstVisibleTutorialTarget(step.actionSelectors);
  if (actionTarget) return { target: actionTarget, mode: step.key === 'finish' ? 'confirm' : 'action' };

  const navigationTarget = firstVisibleTutorialTarget(step.navigationSelectors);
  if (navigationTarget) return { target: navigationTarget, mode: step.key === 'finish' ? 'confirm' : 'navigation' };

  const routeTarget = firstVisibleTutorialTarget(tutorialRouteSelectors(step.key));
  return { target: routeTarget, mode: step.key === 'finish' ? 'confirm' : 'status' };
}

function renderTutorialRoute(displayIndex, guideIndex) {
  if (!elements.tutorialRoute) return;
  elements.tutorialRoute.innerHTML = state.tutorial.steps.map((step, index) => {
    const stateClass = index === displayIndex ? 'active' : index < guideIndex ? 'done' : '';
    const current = index === displayIndex ? ' aria-current="step"' : '';
    const accessibleLabel = `${index + 1}. ${step.routeLabel}`;
    return `<span class="${stateClass}" data-first-turn-progress-step="${escapeHtml(step.key)}" aria-label="${escapeHtml(accessibleLabel)}" title="${escapeHtml(step.routeLabel)}"${current}><i>${index + 1}</i><b>${escapeHtml(step.routeLabel)}</b></span>`;
  }).join('');
}

function isTutorialTurnTarget(target) {
  return Boolean(target?.matches?.('[data-turn-action], [data-market-turn-action]'));
}

function clearTutorialTarget() {
  document.querySelectorAll('.tutorial-target').forEach(node => {
    node.classList.remove('tutorial-target', 'tutorial-target-final');
    node.removeAttribute('data-first-turn-target');
    const describedBy = String(node.getAttribute('aria-describedby') || '')
      .split(/\s+/)
      .filter(value => value && value !== 'tutorial-text');
    if (describedBy.length) node.setAttribute('aria-describedby', describedBy.join(' '));
    else node.removeAttribute('aria-describedby');
  });
  document.querySelectorAll('.tutorial-target-dock').forEach(node => node.classList.remove('tutorial-target-dock'));
  elements.tutorialFocusRing?.classList.add('hidden');
  elements.tutorialFocusRing?.removeAttribute('style');
  elements.tutorialArrow?.classList.add('hidden');
  elements.tutorialArrowPath?.removeAttribute('d');
}

function setTutorialArrow(target) {
  if (!elements.tutorialArrow || !elements.tutorialArrowPath || !elements.tutorialCard || !target || window.innerWidth <= 720) {
    elements.tutorialArrow?.classList.add('hidden');
    return;
  }
  const targetRect = target.getBoundingClientRect();
  const cardRect = elements.tutorialCard.getBoundingClientRect();
  if (!targetRect.width || !targetRect.height || !cardRect.width || !cardRect.height) {
    elements.tutorialArrow.classList.add('hidden');
    return;
  }

  const targetX = targetRect.left + targetRect.width / 2;
  const targetY = targetRect.top + targetRect.height / 2;
  const cardCenterX = cardRect.left + cardRect.width / 2;
  const cardCenterY = cardRect.top + cardRect.height / 2;
  const horizontalExit = Math.abs(targetX - cardCenterX) > Math.abs(targetY - cardCenterY);
  const startX = horizontalExit ? (targetX < cardCenterX ? cardRect.left : cardRect.right) : cardCenterX;
  const startY = horizontalExit ? cardCenterY : (targetY < cardCenterY ? cardRect.top : cardRect.bottom);
  const controlX = horizontalExit ? (startX + targetX) / 2 : startX;
  const controlY = horizontalExit ? startY : (startY + targetY) / 2;
  elements.tutorialArrow.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
  elements.tutorialArrowPath.setAttribute('d', `M ${startX.toFixed(1)} ${startY.toFixed(1)} Q ${controlX.toFixed(1)} ${controlY.toFixed(1)} ${targetX.toFixed(1)} ${targetY.toFixed(1)}`);
  elements.tutorialArrow.classList.remove('hidden');
}

function setTutorialFocus(target, stepKey = '') {
  clearTutorialTarget();
  if (!elements.tutorialFocusRing || !target) return;

  target.classList.add('tutorial-target');
  target.setAttribute('data-first-turn-target', stepKey || 'current');
  const describedBy = new Set(String(target.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
  describedBy.add('tutorial-text');
  target.setAttribute('aria-describedby', [...describedBy].join(' '));
  if (isTutorialTurnTarget(target)) {
    target.classList.add('tutorial-target-final');
    target.closest('.turn-control-dock, .market-trade-desk')?.classList.add('tutorial-target-dock');
  }

  let rect = target.getBoundingClientRect();
  const mobileCardRect = window.innerWidth <= 720 ? elements.tutorialCard?.getBoundingClientRect() : null;
  const visibleBottom = mobileCardRect?.height
    ? Math.max(72, mobileCardRect.top - 12)
    : window.innerHeight - 8;
  const outsideVisibleArea = rect.top < 8
    || rect.left < 8
    || rect.bottom > visibleBottom
    || rect.right > window.innerWidth - 8;
  if (outsideVisibleArea) {
    target.scrollIntoView({
      block: mobileCardRect?.height ? 'center' : 'nearest',
      inline: 'nearest',
      behavior: mobileCardRect?.height || animationsDisabled() || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
    rect = target.getBoundingClientRect();
    if (mobileCardRect?.height && rect.bottom > visibleBottom) {
      window.scrollBy({ top: rect.bottom - visibleBottom, behavior: 'auto' });
      rect = target.getBoundingClientRect();
    }
  }
  const padding = isTutorialTurnTarget(target) ? 14 : 10;
  const left = Math.max(rect.left - padding, 8);
  const top = Math.max(rect.top - padding, 8);
  const right = Math.min(rect.right + padding, window.innerWidth - 8);
  const bottom = Math.min(rect.bottom + padding, window.innerHeight - 8);

  elements.tutorialFocusRing.classList.remove('hidden');
  elements.tutorialFocusRing.style.left = `${left}px`;
  elements.tutorialFocusRing.style.top = `${top}px`;
  elements.tutorialFocusRing.style.width = `${Math.max(right - left, 48)}px`;
  elements.tutorialFocusRing.style.height = `${Math.max(bottom - top, 48)}px`;
  window.requestAnimationFrame(() => setTutorialArrow(target));
}

function getTutorialCardPlacement(target) {
  if (!target || window.innerWidth <= 720) return 'bottom-left';
  if (isTutorialTurnTarget(target)) return 'dock-top';
  const rect = target.getBoundingClientRect();
  const inBottomHalf = rect.top > window.innerHeight * 0.5;
  const inLeftHalf = rect.left < window.innerWidth * 0.5;
  if (inBottomHalf && inLeftHalf) return 'top-right';
  if (inBottomHalf) return 'top-left';
  if (inLeftHalf) return 'bottom-right';
  return 'bottom-left';
}

function announceTutorialStep(step, mode, displayIndex, target = null) {
  const announcementKey = `${step?.key || 'done'}:${mode}:${displayIndex}`;
  if (state.tutorial.lastAnnouncedStep === announcementKey) return;
  state.tutorial.lastAnnouncedStep = announcementKey;
  const activeElement = document.activeElement;
  if (activeElement?.matches?.('input, textarea, select, [contenteditable="true"]')) return;
  if (['action', 'prepare'].includes(mode) && target?.matches?.('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')) {
    target.focus({ preventScroll: true });
    return;
  }
  elements.tutorialTitle?.setAttribute('tabindex', '-1');
  elements.tutorialTitle?.focus({ preventScroll: true });
}

function renderTutorialOverlay() {
  if (!elements.tutorialOverlay) return;
  const tutorialCopy = tutorialUiCopy();
  if (!tutorialShouldRender()) {
    elements.tutorialOverlay.classList.add('hidden');
    delete document.body.dataset.firstTurnTutorialMode;
    delete elements.tutorialOverlay.dataset.cardPlacement;
    delete elements.tutorialOverlay.dataset.stepMode;
    delete elements.tutorialOverlay.dataset.firstTurnActive;
    delete elements.tutorialOverlay.dataset.firstTurnStep;
    delete elements.tutorialOverlay.dataset.firstTurnStage;
    delete elements.tutorialOverlay.dataset.firstTurnTargetMode;
    clearTutorialTarget();
    return;
  }

  syncTutorialStepFromGuide();
  const resolved = tutorialTurnResolved();
  const step = currentTutorialStep();
  if (!step) {
    stopTutorial({ completed: true });
    return;
  }
  const guideIndex = tutorialGuideStepIndex();
  const displayIndex = Number.isInteger(state.tutorial.reviewIndex) ? state.tutorial.reviewIndex : state.tutorial.stepIndex;
  const resolution = resolved ? { target: null, mode: 'confirm' } : resolveTutorialTarget(step);

  elements.tutorialOverlay.classList.remove('hidden');
  elements.tutorialOverlay.dataset.firstTurnActive = 'true';
  elements.tutorialOverlay.dataset.firstTurnStep = resolved ? 'completed' : step.key;
  elements.tutorialOverlay.dataset.firstTurnStage = String(resolved ? state.tutorial.steps.length : displayIndex + 1);
  elements.tutorialOverlay.dataset.firstTurnTargetMode = resolution.mode;
  elements.tutorialOverlay.dataset.stepMode = resolution.mode;
  document.body.dataset.firstTurnTutorialMode = resolution.mode;
  elements.tutorialOverlay.dataset.cardPlacement = getTutorialCardPlacement(resolution.target);
  if (elements.tutorialProgressBar) {
    const totalSteps = Math.max(state.tutorial.steps.length, 1);
    const progress = ((resolved ? totalSteps : displayIndex + 1) / totalSteps) * 100;
    elements.tutorialProgressBar.style.width = `${Math.max(8, Math.min(progress, 100))}%`;
  }

  elements.tutorialStepChip.textContent = resolved ? '5 из 5' : step.chip;
  elements.tutorialTitle.textContent = resolved ? 'Первый ход завершён' : step.title;
  elements.tutorialText.textContent = resolved
    ? 'Отлично: вы прошли полный производственный цикл и увидели результат решений.'
    : step.text;
  renderTutorialRoute(resolved ? state.tutorial.steps.length - 1 : displayIndex, resolved ? state.tutorial.steps.length : guideIndex);

  if (elements.tutorialHint) {
    const hintByMode = {
      navigation: tutorialCopy.navigationHint,
      action: tutorialCopy.actionHint,
      prepare: tutorialCopy.marketPrepareHint,
      confirm: tutorialCopy.confirmHint,
      review: tutorialCopy.reviewHint,
      status: tutorialCopy.activeHint,
    };
    elements.tutorialHint.textContent = resolved ? tutorialCopy.postMeta : (hintByMode[resolution.mode] || tutorialCopy.activeHint);
  }

  const showBack = !resolved && displayIndex > 0;
  elements.tutorialBackButton?.classList.toggle('hidden', !showBack);
  if (resolved) {
    elements.tutorialNextButton.textContent = 'Закрыть обучение';
    elements.tutorialNextButton.classList.remove('hidden');
  } else if (Number.isInteger(state.tutorial.reviewIndex)) {
    elements.tutorialNextButton.textContent = 'Вернуться к текущему шагу';
    elements.tutorialNextButton.classList.remove('hidden');
  } else if (step.key === 'finish') {
    elements.tutorialNextButton.classList.add('hidden');
  } else if (resolution.mode === 'navigation') {
    elements.tutorialNextButton.textContent = step.navigationLabel;
    elements.tutorialNextButton.classList.remove('hidden');
  } else {
    elements.tutorialNextButton.classList.add('hidden');
  }

  setTutorialFocus(resolution.target, step.key);
  announceTutorialStep(step, resolved ? 'completed' : resolution.mode, displayIndex, resolution.target);
}

function startTutorial({ auto = false } = {}) {
  if (!isFactoryRoom() || isTeacherViewer()) {
    setStatus('Интерактивное обучение доступно участнику в заводском матче.', false);
    return;
  }
  if (!auto) {
    persistFirstTurnTutorialDisposition('');
    setTutorialCompleted(false);
  }
  const steps = buildTutorialSteps();
  state.tutorial = {
    active: true,
    stepIndex: 0,
    reviewIndex: null,
    steps,
    completed: false,
    autoStarted: Boolean(auto),
    lastAnnouncedStep: '',
    startedDay: Number(state.room?.day || 1),
  };
  state.tutorial.stepIndex = tutorialGuideStepIndex();
  setGameTab('operations');
  renderTutorialOverlay();
}

function maybeStartFirstTurnTutorial() {
  if (tutorialIsActive() || isTeacherViewer() || !isConnected() || !isFactoryRoom()) return;
  if (state.currentScreen !== 'game-screen' || !gameIsActive() || Number(state.room?.day || 0) !== 1) return;
  if (!state.player?.turnGuide?.steps?.length || firstTurnTutorialDisposition()) return;
  startTutorial({ auto: true });
}

function stopTutorial({ completed = false, dismissed = false } = {}) {
  const keepCompleted = Boolean(completed || state.tutorial.completed);
  if (completed) {
    persistFirstTurnTutorialDisposition('completed');
    localStorage.setItem(TUTORIAL_COMPLETED_KEY, '1');
  } else if (dismissed) {
    persistFirstTurnTutorialDisposition('skipped');
  }
  state.tutorial = {
    active: false,
    stepIndex: 0,
    reviewIndex: null,
    steps: [],
    completed: keepCompleted,
    autoStarted: false,
    lastAnnouncedStep: '',
    startedDay: 0,
  };
  if (completed && state.room) {
    setIntelFeedback('success', 'Обучение завершено. Теперь можно играть самостоятельно.');
    renderIntel();
  }
  clearTutorialTarget();
  if (elements.tutorialOverlay) {
    elements.tutorialOverlay.classList.add('hidden');
    delete document.body.dataset.firstTurnTutorialMode;
    delete elements.tutorialOverlay.dataset.cardPlacement;
    delete elements.tutorialOverlay.dataset.stepMode;
    delete elements.tutorialOverlay.dataset.firstTurnActive;
    delete elements.tutorialOverlay.dataset.firstTurnStep;
    delete elements.tutorialOverlay.dataset.firstTurnStage;
    delete elements.tutorialOverlay.dataset.firstTurnTargetMode;
  }
}

function showPreviousTutorialStep() {
  if (!tutorialIsActive()) return;
  const currentIndex = Number.isInteger(state.tutorial.reviewIndex) ? state.tutorial.reviewIndex : tutorialGuideStepIndex();
  state.tutorial.reviewIndex = Math.max(0, currentIndex - 1);
  renderTutorialOverlay();
}

function advanceTutorialStep() {
  if (!tutorialIsActive()) return;
  if (tutorialTurnResolved()) {
    stopTutorial({ completed: true });
    return;
  }
  if (Number.isInteger(state.tutorial.reviewIndex)) {
    state.tutorial.reviewIndex = null;
    state.tutorial.stepIndex = tutorialGuideStepIndex();
    renderTutorialOverlay();
    return;
  }
  const step = currentTutorialStep();
  if (!step || step.key === 'finish') return;
  const resolution = resolveTutorialTarget(step);
  if (resolution.mode === 'navigation' && resolution.target) {
    resolution.target.click();
    window.setTimeout(renderTutorialOverlay, 0);
  }
}

function handleTutorialClick(event) {
  if (!tutorialShouldRender() || event.target.closest('[data-tutorial-control]')) return;
  const step = currentTutorialStep();
  const resolution = resolveTutorialTarget(step);
  if (!resolution.target || !(resolution.target === event.target || resolution.target.contains(event.target))) return;
  window.setTimeout(renderTutorialOverlay, 0);
}

function handleTutorialKeydown(event) {
  if (!tutorialShouldRender()) return;
  if (event.key === 'Escape') stopTutorial({ dismissed: true });
}
