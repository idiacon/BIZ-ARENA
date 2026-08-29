function createFactorySummaryHelpers({
  isFactoryScenario,
  factoryScenarioConfig,
  availableAssemblyCount,
  factoryEventMultiplier,
  clamp,
  buildFactoryStats,
  buildSimulationScore,
  playerAssets,
}) {
  function formatRub(value) {
    return `${Math.round(Number(value || 0)).toLocaleString('ru-RU')} ₽`;
  }

  function buildTurnChecklist(room, player) {
    if (!isFactoryScenario(room.settings.scenarioKey) || !player.factory) return [];
    const config = factoryScenarioConfig(room.settings.scenarioKey);
    const factory = player.factory;
    const capacity = availableAssemblyCount(factory, config);
    const hasWorkers = (factory.workers || []).length > 0;
    const componentTotal = Object.values(factory.inventory || {}).reduce((sum, value) => sum + Number(value || 0), 0);
    const saleQuantity = Number(factory.saleOffer?.quantity || 0);
    const hasStock = Number(factory.finishedGoods || 0) > 0;
    const contracts = room.contractBoard || [];
    const openContract = contracts.find(contract => !contract.completed && !contract.assignedPlayerId);

    return [
      {
        key: 'warehouse',
        label: 'Закупка',
        status: capacity > 0 || componentTotal >= Object.keys(config.components).length ? 'ready' : componentTotal > 0 ? 'attention' : 'blocked',
        summary: capacity > 0
          ? `Деталей хватит минимум на ${capacity} ед.`
          : componentTotal > 0
            ? 'Детали есть, но набор для сборки ещё неполный.'
            : 'Купите комплектующие у поставщиков.',
        action: 'Открыть закупку',
        tab: 'purchase',
        department: 'warehouse',
      },
      {
        key: 'workforce',
        label: 'Персонал',
        status: hasWorkers ? 'ready' : 'attention',
        summary: hasWorkers
          ? `${factory.workers.length} сотрудников на линии.`
          : 'Без сотрудников сборка будет заблокирована.',
        action: 'Нанять сотрудника',
        tab: 'operations',
        department: 'workforce',
      },
      {
        key: 'assembly',
        label: 'Сборка',
        status: (factory.assembledThisTurn || 0) > 0 || hasStock ? 'ready' : capacity > 0 ? 'attention' : 'blocked',
        summary: hasStock
          ? `На складе ${factory.finishedGoods} ${config.productUnit}.`
          : capacity > 0
            ? `Можно собрать ${capacity} ${config.productUnit}.`
            : 'Сборка ждёт людей и детали.',
        action: 'Собрать товар',
        tab: 'operations',
        department: 'assembly',
      },
      {
        key: 'sale',
        label: 'Продажа',
        status: saleQuantity > 0 ? 'ready' : hasStock ? 'attention' : 'blocked',
        summary: saleQuantity > 0
          ? `${saleQuantity} ед. выставлено по ${formatRub(factory.saleOffer.price || config.basePrice)}.`
          : hasStock
            ? 'Готовый товар ещё не выставлен в книгу заявок.'
            : 'Сначала нужен готовый товар.',
        action: 'Выставить заявку',
        tab: 'market',
        department: 'sales',
      },
      {
        key: 'contract',
        label: 'Событие/контракт',
        status: player.decisionRound?.status === 'pending' ? 'attention' : player.activeContract || openContract || room.activeEvent ? 'ready' : 'attention',
        summary: player.decisionRound?.status === 'pending'
          ? 'Есть стратегическая дилемма для решения.'
          : player.activeContract
            ? `Активен контракт: ${player.activeContract.title}.`
            : room.activeEvent
              ? `Идёт событие: ${room.activeEvent.label}.`
              : openContract
                ? `Доступен контракт: ${openContract.title}.`
                : 'Проверьте условия перед завершением хода.',
        action: player.decisionRound?.status === 'pending' ? 'Выбрать вариант' : 'Проверить',
        tab: player.decisionRound?.status === 'pending' ? 'operations' : 'market',
        department: 'command',
      },
    ];
  }

  function buildMarketHints(room, player) {
    if (!isFactoryScenario(room.settings.scenarioKey) || !player.factory) return [];
    const config = factoryScenarioConfig(room.settings.scenarioKey);
    const factory = player.factory;
    const saleOffer = factory.saleOffer || {};
    const price = Number(saleOffer.price || config.basePrice);
    const quantity = Number(saleOffer.quantity || 0);
    const stock = Number(factory.finishedGoods || 0);
    const latest = room.marketHistory?.[room.marketHistory.length - 1] || null;
    const book = room.factoryScenario?.marketBook || [];
    const bestClearedPrice = [...book]
      .filter(entry => Number(entry.sold || 0) > 0)
      .sort((left, right) => Number(left.price || 0) - Number(right.price || 0))[0]?.price
      || latest?.avgPrice
      || config.basePrice;
    const priceRange = config.priceRange || { min: config.basePrice * 0.75, max: config.basePrice * 1.3 };
    const recommendedPrice = Math.round(clamp(bestClearedPrice * 0.99, priceRange.min, priceRange.max));
    const normalizedPrice = clamp((price - priceRange.min) / Math.max(priceRange.max - priceRange.min, 1), 0, 1);
    const baseDemand = latest?.demand || room.factoryScenario?.baseDemandMax || config.baseDemandMax || 0;
    const forecastDemand = Math.max(0, Math.round(baseDemand * (1.08 - normalizedPrice * 0.42) * factoryEventMultiplier(room, 'demandMultiplier')));
    const expectedUnits = quantity > 0 ? Math.max(0, Math.min(quantity, stock, forecastDemand)) : 0;
    const priceGapPct = Math.round(((price / Math.max(bestClearedPrice, 1)) - 1) * 100);
    const saleRisk = quantity === 0 || stock <= 0 || expectedUnits <= 0 || priceGapPct >= 35
      ? 'high'
      : priceGapPct > 12 || expectedUnits < quantity
        ? 'medium'
        : 'low';
    const reasonKey = quantity === 0
      ? 'no_offer'
      : stock <= 0
        ? 'no_stock'
        : priceGapPct > 12
          ? 'price_above_market'
          : expectedUnits < quantity
            ? 'demand_limit'
            : 'competitive';
    const decisionCopy = {
      no_offer: {
        title: 'Выставьте заявку',
        message: 'Сейчас компания не участвует в продаже.',
        studentText: 'Укажите объём и цену, чтобы товар появился на рынке.',
        metric: 'Нет заявки',
      },
      no_stock: {
        title: 'Сначала соберите товар',
        message: 'В заявке есть объём, но на складе нет готовой продукции.',
        studentText: 'Перейдите к сборке, затем вернитесь к продаже.',
        metric: 'Нет товара',
      },
      price_above_market: {
        title: 'Снизьте цену',
        message: `Ваша цена выше рынка на ${Math.max(priceGapPct, 0)}%.`,
        studentText: `Ориентир — около ${formatRub(recommendedPrice)} за единицу.`,
        metric: `${expectedUnits} из ${quantity} ед.`,
      },
      demand_limit: {
        title: 'Скорректируйте объём',
        message: `Спрос может принять ${expectedUnits} из ${quantity} ед.`,
        studentText: 'Уменьшите объём заявки или пересмотрите цену.',
        metric: `${expectedUnits} из ${quantity} ед.`,
      },
      competitive: {
        title: 'Заявка готова',
        message: 'Цена близка к рынку, а объём покрывается спросом.',
        studentText: 'Можно завершать ход или ещё раз проверить запас.',
        metric: `${expectedUnits} из ${quantity} ед.`,
      },
    }[reasonKey];
    const hints = [];

    hints.push({
      kind: 'decision',
      tone: ['no_offer', 'no_stock'].includes(reasonKey)
        ? 'warn'
        : saleRisk === 'high' ? 'danger' : saleRisk === 'medium' ? 'warn' : 'ok',
      title: decisionCopy.title,
      message: decisionCopy.message,
      studentText: decisionCopy.studentText,
      metric: decisionCopy.metric,
      bestPrice: Math.round(bestClearedPrice),
      recommendedPrice,
      currentPrice: Math.round(price),
      expectedUnits,
      saleRisk,
      reasonKey,
    });

    if (stock > 0 && quantity === 0) {
      hints.push({
        tone: 'warn',
        title: 'Товар ждёт заявки',
        message: `На складе готово ${stock} ед., но они не выставлены на продажу.`,
        studentText: 'Укажите объём и цену до завершения хода.',
        metric: `${stock} ед. на складе`,
      });
    }
    if (quantity > stock) {
      hints.push({
        tone: 'danger',
        title: 'Объём выше склада',
        message: 'Сервер ограничит заявку текущим складом. Выставьте реальный объём.',
        studentText: 'Нельзя продать больше, чем лежит на складе.',
        metric: `${quantity}/${stock}`,
      });
    }
    if (quantity > 0 && price > Math.round(bestClearedPrice * 1.12)) {
      hints.push({
        tone: 'warn',
        title: 'Цена выше рынка',
        message: `Лучшая недавняя цена около ${formatRub(bestClearedPrice)}. Текущая заявка заметно выше рынка.`,
        studentText: 'Дорогая заявка стоит позже дешёвых и может не попасть в спрос.',
        metric: `${priceGapPct}%`,
      });
    }
    if (quantity > 0 && price <= Math.round(bestClearedPrice * 1.03)) {
      hints.push({
        tone: 'ok',
        title: 'Конкурентная цена',
        message: 'Заявка рядом с лучшей рыночной ценой и должна пройти раньше дорогих предложений.',
        studentText: 'Цена близка к рынку. Теперь важно иметь достаточно товара на складе.',
        metric: 'Готово',
      });
    }
    hints.push({
      tone: forecastDemand >= quantity && quantity > 0 ? 'ok' : 'warn',
      title: 'Прогноз спроса',
      message: quantity > 0
        ? `При текущей цене рынок может принять примерно ${forecastDemand} ед.`
        : `Оценочный спрос следующего хода: ${forecastDemand} ед. без вашей заявки.`,
      studentText: quantity > 0
        ? `Ожидаемый спрос: ${forecastDemand} ед. Сравните его с объёмом заявки.`
        : 'Рынок готов покупать, но без заявки ваша компания не участвует в продаже.',
      metric: `${forecastDemand} ед.`,
    });
    return hints.slice(0, 5);
  }

  function buildTurnReview(room, player) {
    if (!isFactoryScenario(room.settings.scenarioKey) || !player.factory) return null;
    const breakdown = player.lastTickBreakdown || null;
    const latest = room.marketHistory?.[room.marketHistory.length - 1] || null;
    const topSeller = buildFactoryStats(room, player.id)?.topSeller || null;
    const sold = Number(player.factory.soldThisTurn || 0);
    const profit = Math.round(breakdown?.profit || 0);
    const highlights = [];
    const reasons = [];
    const checks = [];

    if (!latest) {
      const planningChecks = [
        'Наймите хотя бы одного сотрудника.',
        'Купите полный набор комплектующих.',
        'Выставьте товар в книгу заявок.',
      ];
      return {
        state: 'planning',
        title: 'До первого хода',
        summary: 'Соберите линию: закупите детали, наймите людей, соберите товар и выставьте продажу.',
        highlights: planningChecks,
        outcomes: [],
        reasons: ['Рынок ещё не рассчитывался, поэтому причинный разбор появится после общего хода.'],
        checks: planningChecks,
        nextBestAction: 'Начните с закупки и персонала.',
      };
    }

    const ownOffer = (room.factoryScenario?.marketBook || []).find(item => item.playerId === player.id) || null;
    const offered = Math.max(0, Number(ownOffer?.quantity || 0));
    const remaining = Math.max(0, Number(ownOffer?.remaining || offered - sold));
    const offerPrice = Math.max(0, Number(ownOffer?.price || 0));
    const averagePrice = Math.max(0, Number(latest.avgPrice || 0));
    const revenue = Math.round(Number(breakdown?.revenue || 0));
    const expenses = Math.round(Number(breakdown?.expenses || 0));
    const finishedGoods = Math.max(0, Math.round(Number(player.factory.finishedGoods || 0)));

    highlights.push(sold > 0
      ? `Продано ${sold} ед., выручка ${formatRub(revenue)}.`
      : 'Продаж не было: заявка не попала в спрос или товар не был выставлен.');
    highlights.push(profit >= 0
      ? `Денежный результат хода: +${formatRub(profit)}.`
      : `Денежный результат хода: ${formatRub(profit)}; расходы оказались выше выручки.`);
    if (topSeller) highlights.push(`Лучший продавец: ${topSeller.playerName}, ${topSeller.sold} ед. по ${formatRub(topSeller.price)}.`);
    if (latest.unmatchedDemand > 0) highlights.push(`На рынке осталось ${Math.round(latest.unmatchedDemand)} ед. неудовлетворённого спроса.`);

    if (!ownOffer || offered <= 0) {
      reasons.push('Компания не выставила доступный товар в книгу заявок, поэтому рынок не мог совершить покупку.');
    } else if (remaining <= 0) {
      reasons.push(`Заявка исполнена полностью: рынок купил все ${offered} ед. по цене ${formatRub(offerPrice)}.`);
    } else {
      reasons.push(`Рынок купил ${sold} из ${offered} ед.; оставшиеся ${remaining} ед. не попали в доступный спрос.`);
    }

    if (ownOffer && averagePrice > 0) {
      const priceGap = Math.round(((offerPrice / averagePrice) - 1) * 100);
      if (Math.abs(priceGap) <= 3) {
        reasons.push(`Цена ${formatRub(offerPrice)} была близка к средней рыночной ${formatRub(averagePrice)}.`);
      } else {
        reasons.push(`Цена была на ${Math.abs(priceGap)}% ${priceGap > 0 ? 'выше' : 'ниже'} средней рыночной (${formatRub(averagePrice)}).`);
      }
    }

    reasons.push(revenue >= expenses
      ? `Выручка ${formatRub(revenue)} покрыла расходы хода ${formatRub(expenses)}.`
      : `Расходы хода ${formatRub(expenses)} превысили выручку ${formatRub(revenue)}.`);

    if (finishedGoods > 0) checks.push(`На складе осталось ${finishedGoods} ед. готового товара — решите, продавать остаток или менять выпуск.`);
    if (profit < 0) checks.push('Проверьте цену, зарплаты и объём выпуска: текущая выручка не покрыла расходы хода.');
    if (remaining > 0 || sold === 0) checks.push('Перед завершением следующего хода сравните цену и объём заявки со спросом рынка.');
    if (latest.unmatchedDemand > 0) checks.push(`Рынок не закрыл ${Math.round(latest.unmatchedDemand)} ед. спроса — проверьте, можете ли увеличить выпуск без потери маржи.`);
    if (!checks.length) checks.push('Сверьте запас комплектующих и расходы перед повторением производственного цикла.');

    let nextBestAction = 'Пополните комплектующие и повторите сборку.';
    if (!ownOffer || offered <= 0) nextBestAction = 'Соберите товар и выставьте заявку до следующего общего хода.';
    else if (sold === 0 && averagePrice > 0 && offerPrice > averagePrice) nextBestAction = 'Сравните цену со средней рыночной и скорректируйте заявку.';
    else if (profit < 0) nextBestAction = 'Проверьте, какая цена и объём продаж покроют расходы следующего хода.';
    else if (latest.unmatchedDemand > 0) nextBestAction = 'Оцените, можно ли увеличить выпуск, сохранив положительную маржу.';
    else if (finishedGoods > 0) nextBestAction = 'Решите, как продать остаток склада без лишнего перепроизводства.';

    return {
      state: 'resolved',
      title: `Разбор хода ${latest.day}`,
      summary: sold > 0
        ? 'Продажа прошла. Теперь снова закройте склад и подготовьте следующий выпуск.'
        : 'Ход не дал продаж. Проверьте цену, объём заявки и готовый склад перед продолжением.',
      highlights,
      outcomes: highlights,
      reasons: reasons.slice(0, 3),
      checks: checks.slice(0, 3),
      nextBestAction,
    };
  }

  function buildComparisonToLeader(room, player) {
    const rows = [...room.players.values()]
      .filter(item => !item.bankrupt)
      .map(item => {
        const netWorth = Math.round(item.money + playerAssets(item) - item.debt);
        const simulationScore = buildSimulationScore({
          netWorth,
          money: item.money,
          debt: item.debt,
          reputation: item.reputation,
          completedContracts: item.completedContracts || 0,
          completedResearch: Array.isArray(item.research?.completed) ? item.research.completed.length : 0,
          innovation: item.innovation || 0,
          soldLastTick: item.factory?.soldThisTurn || item.soldLastTick || 0,
          seasonGoal: item.seasonGoal || null,
          lastTickBreakdown: item.lastTickBreakdown,
        });
        return { player: item, netWorth, simulationScore };
      })
      .sort((left, right) => (right.simulationScore.total || 0) - (left.simulationScore.total || 0) || right.netWorth - left.netWorth);
    const ownIndex = rows.findIndex(row => row.player.id === player.id);
    const own = rows[ownIndex] || null;
    const leader = rows[0] || own;
    if (!own || !leader) return null;
    return {
      rank: ownIndex + 1,
      leaderPlayerId: leader.player.id,
      leaderName: leader.player.name,
      leaderUserName: leader.player.userName,
      scoreGap: Math.max(0, Math.round((leader.simulationScore.total || 0) - (own.simulationScore.total || 0))),
      netWorthGap: Math.max(0, Math.round(leader.netWorth - own.netWorth)),
      salesGap: Math.max(0, Math.round((leader.player.totalSalesSeason || 0) - (player.totalSalesSeason || 0))),
      takeaway: ownIndex === 0
        ? 'Вы лидер: удерживайте маржу и не оставляйте товар без заявки.'
        : 'Догонять лидера проще через регулярные продажи, низкий долг и стабильный выпуск.',
    };
  }

  function buildLearningHints(room, player, { turnChecklist = [], marketHints = [], turnReview = null } = {}) {
    if (!isFactoryScenario(room.settings.scenarioKey) || !player.factory) return [];
    const hints = [];
    const nextIssue = turnChecklist.find(item => item.status !== 'ready') || turnChecklist[0] || null;
    if (nextIssue) {
      hints.push({
        kind: 'next_step',
        tone: nextIssue.status === 'blocked' ? 'danger' : nextIssue.status === 'ready' ? 'ok' : 'warn',
        title: 'Следующий шаг',
        text: `${nextIssue.action}: ${nextIssue.summary}`,
        actionLabel: nextIssue.action,
        tab: nextIssue.tab,
        department: nextIssue.department,
      });
    }
    const decisionHint = marketHints.find(hint => hint.kind === 'decision') || null;
    if (decisionHint) {
      hints.push({
        kind: 'market',
        tone: decisionHint.tone || 'warn',
        title: 'Цена и спрос',
        text: decisionHint.studentText || decisionHint.message || 'Проверьте цену, объём и прогноз спроса.',
        actionLabel: 'Открыть маркетинг',
        tab: 'market',
        department: 'sales',
      });
    }
    if (turnReview?.state === 'resolved') {
      hints.push({
        kind: 'review',
        tone: 'ok',
        title: 'Разбор прошлого хода',
        text: turnReview.nextBestAction || turnReview.summary || 'Посмотрите, что изменилось после пересчёта.',
        actionLabel: 'Открыть отчёты',
        tab: 'overview',
        department: 'command',
      });
    }
    return hints.slice(0, 3);
  }

  function buildNextAction(room, player, { turnChecklist = [], marketHints = [], turnReview = null } = {}) {
    if (!isFactoryScenario(room.settings.scenarioKey) || !player.factory) return null;
    const issue = turnChecklist.find(item => (
      item.status !== 'ready'
      && (item.key !== 'contract' || player.decisionRound?.status === 'pending' || item.status === 'blocked')
    )) || null;
    const readyCount = turnChecklist.filter(item => item.status === 'ready').length;
    const totalCount = turnChecklist.length;
    const decisionHint = marketHints.find(hint => hint.kind === 'decision') || null;

    if (issue) {
      return {
        key: issue.key,
        status: issue.status,
        tone: issue.status === 'blocked' ? 'danger' : 'warn',
        title: issue.action || issue.label || 'Следующий шаг',
        body: issue.summary || 'Откройте шаг и выполните действие.',
        actionLabel: issue.action || 'Открыть шаг',
        tab: issue.tab || 'operations',
        department: issue.department || '',
        action: '',
        progress: { ready: readyCount, total: totalCount },
      };
    }

    if (decisionHint?.saleRisk === 'high' || decisionHint?.saleRisk === 'medium') {
      return {
        key: 'market_review',
        status: 'attention',
        tone: decisionHint.saleRisk === 'high' ? 'danger' : 'warn',
        title: 'Проверить цену',
        body: decisionHint.studentText || decisionHint.message || 'Проверьте цену и ожидаемые продажи.',
        actionLabel: 'Открыть маркетинг',
        tab: 'market',
        department: 'sales',
        action: '',
        progress: { ready: readyCount, total: totalCount },
      };
    }

    if (turnReview?.state === 'resolved') {
      return {
        key: 'turn_review',
        status: 'ready',
        tone: 'ok',
        title: 'Разобрать прошлый ход',
        body: turnReview.nextBestAction || turnReview.summary || 'Посмотрите, что изменилось после пересчета.',
        actionLabel: 'Открыть отчеты',
        tab: 'events',
        department: 'command',
        action: '',
        progress: { ready: readyCount, total: totalCount },
      };
    }

    return {
      key: 'next_turn',
      status: 'ready',
      tone: 'ok',
      title: 'Завершить ход',
      body: 'Основные решения готовы. Преподаватель или хост может пересчитать ход.',
      actionLabel: 'Принять решения',
      tab: '',
      department: '',
      action: 'next-turn',
      progress: { ready: readyCount, total: totalCount },
    };
  }

  return {
    buildTurnChecklist,
    buildMarketHints,
    buildTurnReview,
    buildComparisonToLeader,
    buildLearningHints,
    buildNextAction,
  };
}

module.exports = {
  createFactorySummaryHelpers,
};
