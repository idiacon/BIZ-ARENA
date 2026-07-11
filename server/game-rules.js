const BOARD_POLICIES = {
  balanced: { label: 'Balanced board', demandScore: 1, salaryMultiplier: 1, researchMultiplier: 1, upkeepMultiplier: 1, contractRewardMultiplier: 1 },
  market_blitz: { label: 'Market blitz', demandScore: 1.08, salaryMultiplier: 1.02, researchMultiplier: 0.96, upkeepMultiplier: 1.06, contractRewardMultiplier: 1 },
  talent_push: { label: 'Talent push', demandScore: 1.01, salaryMultiplier: 1.1, researchMultiplier: 1.22, upkeepMultiplier: 1.02, contractRewardMultiplier: 1 },
  cash_guard: { label: 'Cash guard', demandScore: 0.96, salaryMultiplier: 0.98, researchMultiplier: 0.95, upkeepMultiplier: 0.9, contractRewardMultiplier: 0.95 },
  contract_hunter: { label: 'Contract hunter', demandScore: 1.03, salaryMultiplier: 1, researchMultiplier: 1, upkeepMultiplier: 1.02, contractRewardMultiplier: 1.18 },
};

const OPERATING_PLANS = {
  balanced: { label: 'Balanced autopilot', description: 'Keeps enough raw materials on hand and pays debt down when cash allows.' },
  growth: { label: 'Growth autopilot', description: 'Pushes expansion, staffing, and marketing while keeping production supplied.' },
  efficiency: { label: 'Efficiency autopilot', description: 'Cuts operating pressure through debt control, logistics, and salary discipline.' },
  contracts: { label: 'Contract autopilot', description: 'Prioritizes matching contracts and price discipline for reliable deliveries.' },
  innovation: { label: 'Innovation autopilot', description: 'Keeps research moving and invests into automation and quality upgrades.' },
};

const SEASON_GOALS = {
  market_maker: { label: 'Market maker', metric: 'sales', target: 150, reward: 28000 },
  innovation_race: { label: 'Innovation race', metric: 'innovation', target: 2, reward: 32000 },
  contract_ladder: { label: 'Contract ladder', metric: 'contracts', target: 2, reward: 26000 },
  cash_buffer: { label: 'Cash buffer', metric: 'cash', target: 180000, reward: 24000 },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function demandMultiplier(profile) {
  if (profile === 'aggressive') return 1.2;
  if (profile === 'lean') return 0.82;
  return 1;
}

function eventApplies(event, cityKey, productKey) {
  if (!event) return false;
  if (event.cityKey && event.cityKey !== cityKey) return false;
  if (event.productKey && event.productKey !== productKey) return false;
  return true;
}

function researchEffects(player, researchProjects) {
  return (player.research.completed || []).reduce((effects, key) => {
    const project = researchProjects[key];
    if (!project) return effects;
    Object.entries(project.effects).forEach(([effectKey, effectValue]) => {
      effects[effectKey] = (effects[effectKey] || 0) + effectValue;
    });
    return effects;
  }, {});
}

function computeSeasonGoalProgress(player) {
  if (!player.seasonGoal) return 0;
  switch (player.seasonGoal.metric) {
    case 'sales': return player.totalSalesSeason || 0;
    case 'innovation': return player.innovation || 0;
    case 'contracts': return player.completedContracts || 0;
    case 'cash': return Math.round(player.money || 0);
    default: return 0;
  }
}

function pickOperatingPlanAction({ player, availableResearchKeys = [], availableContracts = [] }) {
  const planKey = player.strategyKey || 'balanced';
  const contractMatch = availableContracts.find(contract => (
    !contract.completed &&
    !contract.assignedPlayerId &&
    contract.cityKey === player.cityKey &&
    contract.productKey === player.productKey
  ));

  switch (planKey) {
    case 'growth':
      if (player.rawStock < 14 && player.money >= 12000) return { action: 'buy-raw', value: 20 };
      if (player.factories < 4 && player.money >= 70000) return { action: 'build-factory' };
      if (player.marketing < 4 && player.money >= 24000) return { action: 'marketing' };
      if (player.staff < player.factories * 11 && player.money >= 12000) return { action: 'hire', value: 2 };
      return null;
    case 'efficiency':
      if (player.debt > 15000 && player.money >= 18000) return { action: 'repay-loan', value: 10000 };
      if (player.supplyLevel < 4 && player.money >= 26000) return { action: 'upgrade-supply' };
      if (player.salary > 120) return { action: 'cut-salary' };
      if (player.rawStock < 8 && player.money >= 12000) return { action: 'buy-raw', value: 20 };
      return null;
    case 'contracts':
      if (!player.activeContract && contractMatch) return { action: 'accept-contract', value: contractMatch.id };
      if (player.rawStock < 14 && player.money >= 12000) return { action: 'buy-raw', value: 20 };
      if (player.price > 145) return { action: 'set-price', value: 145 };
      return null;
    case 'innovation':
      if (!player.research?.activeKey && availableResearchKeys.length) return { action: 'start-research', value: availableResearchKeys[0] };
      if (player.automation < 4 && player.money >= 38000) return { action: 'automation' };
      if (player.rawStock < 10 && player.money >= 12000) return { action: 'buy-raw', value: 20 };
      if (player.quality < 4 && player.money >= 26000) return { action: 'upgrade-quality' };
      return null;
    case 'balanced':
    default:
      if (player.rawStock < 10 && player.money >= 12000) return { action: 'buy-raw', value: 20 };
      if (player.debt > 40000 && player.money >= 25000) return { action: 'repay-loan', value: 10000 };
      return null;
  }
}

function buildOperatingPlanPreview({ player, availableResearchKeys = [], availableContracts = [] }) {
  const nextAction = pickOperatingPlanAction({ player, availableResearchKeys, availableContracts });
  if (!nextAction) {
    return {
      status: 'idle',
      action: '',
      value: '',
      actionLabelKey: '',
    };
  }

  const actionLabelKey = {
    'accept-contract': 'accept_contract',
    'automation': 'automation',
    'build-factory': 'build_factory',
    'buy-raw': 'buy_raw',
    'cut-salary': 'cut_salary',
    'hire': 'hire_btn',
    'marketing': 'marketing',
    'repay-loan': 'repay',
    'set-price': 'set_price_to',
    'start-research': 'start_research',
    'upgrade-quality': 'upgrade_quality',
    'upgrade-supply': 'upgrade_supply',
  }[nextAction.action] || nextAction.action;

  return {
    status: 'ready',
    action: nextAction.action,
    value: nextAction.value ?? '',
    actionLabelKey,
  };
}

function buildForecastSegments({ cities, products, scenario, demandProfileKey, activeEvent }) {
  return cities.flatMap(city => products.map(product => {
    const eventMultiplier = eventApplies(activeEvent, city.key, product.key) ? activeEvent.demandMultiplier || 1 : 1;
    const forecastDemand = Math.round(100 * city.demand * product.demand * demandMultiplier(demandProfileKey) * scenario.demand * eventMultiplier);
    const pricePressure = Math.round((product.marginWeight / city.priceSensitivity) * 100 + (eventMultiplier - 1) * 25);
    const competitionScore = Number((city.demand * product.qualityWeight * eventMultiplier).toFixed(2));
    return {
      cityKey: city.key,
      cityLabel: city.label,
      productKey: product.key,
      productLabel: product.label,
      forecastDemand,
      pricePressure,
      competitionScore,
    };
  })).sort((a, b) => b.forecastDemand - a.forecastDemand || b.pricePressure - a.pricePressure).slice(0, 6);
}

function buildPlayerIntel({ player, room, availableResearchCount = 0 }) {
  const signals = [];
  const recommendations = [];
  let riskScore = 0;

  const pushSignal = (signalKey, recommendationKey, risk = 0) => {
    if (!signals.includes(signalKey)) signals.push(signalKey);
    if (recommendationKey && !recommendations.includes(recommendationKey)) recommendations.push(recommendationKey);
    riskScore += risk;
  };

  if (player.rawStock < 12) pushSignal('raw_low', 'buy_raw', 2);
  if (player.debt > 90000) pushSignal('debt_high', 'repay_debt', 2);
  if (player.activeContract && player.activeContract.expiresDay - room.day <= 1) pushSignal('contract_due', 'secure_contract', 1);
  if (!player.activeContract && (room.contractBoard || []).some(contract => !contract.completed && !contract.assignedPlayerId && contract.cityKey === player.cityKey && contract.productKey === player.productKey)) {
    pushSignal('contract_window', 'accept_contract', 0);
  }
  if (!player.research?.activeKey && availableResearchCount > 0) pushSignal('research_idle', 'start_research', 1);
  if (player.marketing < 2) pushSignal('marketing_low', 'boost_marketing', 0);
  if (player.money > 90000 && player.factories < 3) pushSignal('cash_ready', 'expand_capacity', 0);
  if (player.soldLastTick === 0 && player.price >= 180) pushSignal('demand_soft', 'lower_price', 1);
  if (player.seasonGoal?.target) {
    const dayRatio = room.settings.dayLimit ? room.day / room.settings.dayLimit : 0;
    const progressRatio = player.seasonGoal.progress / player.seasonGoal.target;
    if (progressRatio + 0.15 < dayRatio) pushSignal('goal_lagging', 'focus_goal', 1);
  }

  if (!recommendations.length) recommendations.push('hold_course');

  let riskLevel = 'low';
  if (riskScore >= 4) riskLevel = 'high';
  else if (riskScore >= 2) riskLevel = 'medium';

  return {
    riskLevel,
    riskScore,
    primarySignalKey: signals[0] || '',
    primaryRecommendationKey: recommendations[0] || 'hold_course',
    signals: signals.slice(0, 4),
    recommendations: recommendations.slice(0, 4),
  };
}

function buildFocusPlan({ player, focusCityKey, focusProductKey, forecastSegments = [] }) {
  const missingSteps = [];
  let readinessScore = 0;
  const manufacturerMode = Boolean(player.factory);

  const pushStep = (condition, stepKey, score) => {
    if (condition) readinessScore += score;
    else if (!missingSteps.includes(stepKey)) missingSteps.push(stepKey);
  };

  if (manufacturerMode) {
    const componentStock = Object.values(player.factory?.inventory || {}).reduce((sum, amount) => sum + Number(amount || 0), 0);
    const workerCount = (player.factory?.workers || []).length;
    pushStep(player.productKey === focusProductKey, 'switch_product', 20);
    pushStep(componentStock >= 8 || player.factory?.finishedGoods > 0, 'buy_raw', 20);
    pushStep(workerCount > 0, 'upgrade_supply', 15);
    pushStep(player.quality >= 2, 'upgrade_quality', 15);
    pushStep(player.money >= 30000, 'build_cash', 10);
  } else {
    pushStep(player.cityKey === focusCityKey, 'switch_city', 20);
    pushStep(player.productKey === focusProductKey, 'switch_product', 20);
    pushStep(player.rawStock >= 14, 'buy_raw', 15);
    pushStep(player.supplyLevel >= 2, 'upgrade_supply', 10);
    pushStep(player.marketing >= 2, 'boost_marketing', 10);
    pushStep(player.quality >= 2, 'upgrade_quality', 10);
    pushStep(player.stores >= 2, 'expand_retail', 10);
    pushStep(player.money >= 30000, 'build_cash', 5);
  }

  const focusForecast = manufacturerMode
    ? null
    : forecastSegments.find(segment => segment.cityKey === focusCityKey && segment.productKey === focusProductKey) || null;
  if (!manufacturerMode && focusForecast && focusForecast.forecastDemand >= 120) readinessScore += 10;

  let readinessLevel = 'low';
  if (readinessScore >= 75) readinessLevel = 'high';
  else if (readinessScore >= 45) readinessLevel = 'medium';

  return {
    readinessScore,
    readinessLevel,
    forecastDemand: focusForecast?.forecastDemand || 0,
    missingSteps: missingSteps.slice(0, 5),
  };
}

function buildPivotPreview({ player, focusPlan, forecastSegments = [] }) {
  if (player.factory) {
    const sameProduct = player.productKey === (player.focusProductKey || player.productKey);
    return {
      currentDemand: 0,
      targetDemand: focusPlan?.forecastDemand || 0,
      demandDelta: 0,
      timing: sameProduct ? 'hold' : 'prepare_then_pivot',
      reasons: sameProduct ? ['already_aligned'] : ['needs_setup'],
    };
  }

  const currentSegment = forecastSegments.find(segment => segment.cityKey === player.cityKey && segment.productKey === player.productKey) || null;
  const targetSegment = forecastSegments.find(segment => segment.cityKey === (player.focusCityKey || player.cityKey) && segment.productKey === (player.focusProductKey || player.productKey)) || currentSegment;

  const currentDemand = currentSegment?.forecastDemand || 0;
  const targetDemand = targetSegment?.forecastDemand || 0;
  const demandDelta = targetDemand - currentDemand;
  const sameSegment = player.cityKey === (player.focusCityKey || player.cityKey) && player.productKey === (player.focusProductKey || player.productKey);

  let timing = 'hold';
  const reasons = [];

  if (sameSegment) reasons.push('already_aligned');
  if (demandDelta >= 20) reasons.push('higher_demand');
  if (demandDelta <= -15) reasons.push('lower_demand');
  if ((focusPlan?.readinessLevel || 'low') === 'high') reasons.push('ready_now');
  if ((focusPlan?.readinessLevel || 'low') === 'low') reasons.push('needs_setup');

  if (!sameSegment && demandDelta >= 20 && focusPlan?.readinessLevel === 'high') timing = 'pivot_now';
  else if (!sameSegment && demandDelta >= 10 && focusPlan?.readinessLevel !== 'low') timing = 'prepare_then_pivot';
  else if (!sameSegment && demandDelta > 0) timing = 'prepare_then_pivot';

  return {
    currentDemand,
    targetDemand,
    demandDelta,
    timing,
    reasons: reasons.slice(0, 4),
  };
}

function findRecommendedContract(room, player) {
  const contracts = room?.contractBoard || [];
  const openContracts = contracts.filter(contract => !contract.completed && !contract.assignedPlayerId);
  if (!openContracts.length) return null;
  return openContracts.find(contract => (
    contract.cityKey === (player.focusCityKey || player.cityKey)
      && contract.productKey === (player.focusProductKey || player.productKey)
  )) || openContracts.find(contract => (
    contract.cityKey === player.cityKey
      && contract.productKey === player.productKey
  )) || openContracts[0];
}

function actionableExecutionAction(action, value, extra = {}) {
  return {
    mode: 'actionable',
    action,
    value: value ?? '',
    blockedReason: '',
    requiredMoney: 0,
    ...extra,
  };
}

function blockedExecutionAction(blockedReason, extra = {}) {
  return {
    mode: 'blocked',
    action: '',
    value: '',
    blockedReason,
    requiredMoney: 0,
    ...extra,
  };
}

function manualExecutionAction(blockedReason = 'manual_choice', extra = {}) {
  return {
    mode: 'manual',
    action: '',
    value: '',
    blockedReason,
    requiredMoney: 0,
    ...extra,
  };
}

function buildExecutionAction({ key, player, room, availableResearchKeys = [] }) {
  if (player.factory) {
    switch (key) {
      case 'switch_city':
        return blockedExecutionAction('already_aligned');
      case 'switch_product':
        return player.productKey !== (player.focusProductKey || player.productKey)
          ? manualExecutionAction('manual_choice')
          : blockedExecutionAction('already_aligned');
      case 'buy_raw':
      case 'upgrade_supply':
      case 'upgrade_quality':
      case 'build_cash':
        return manualExecutionAction('manual_choice');
      default:
        break;
    }
  }

  switch (key) {
    case 'switch_city':
      return player.cityKey !== (player.focusCityKey || player.cityKey)
        ? actionableExecutionAction('set-city', player.focusCityKey || player.cityKey)
        : blockedExecutionAction('already_aligned');
    case 'switch_product':
      return player.productKey !== (player.focusProductKey || player.productKey)
        ? actionableExecutionAction('set-product', player.focusProductKey || player.productKey)
        : blockedExecutionAction('already_aligned');
    case 'buy_raw':
      return actionableExecutionAction('buy-raw', 20);
    case 'upgrade_supply': {
      if (player.supplyLevel >= 5) return blockedExecutionAction('limit_reached');
      const cost = 14000 + player.supplyLevel * 10000;
      return player.money >= cost
        ? actionableExecutionAction('upgrade-supply')
        : blockedExecutionAction('insufficient_cash', { requiredMoney: cost });
    }
    case 'boost_marketing': {
      if (player.marketing >= 7) return blockedExecutionAction('limit_reached');
      const cost = 12000 + player.marketing * 5000;
      return player.money >= cost
        ? actionableExecutionAction('marketing')
        : blockedExecutionAction('insufficient_cash', { requiredMoney: cost });
    }
    case 'upgrade_quality': {
      if (player.quality >= 6) return blockedExecutionAction('limit_reached');
      const cost = 18000 + player.quality * 12000;
      return player.money >= cost
        ? actionableExecutionAction('upgrade-quality')
        : blockedExecutionAction('insufficient_cash', { requiredMoney: cost });
    }
    case 'expand_retail': {
      const cost = 28000 + player.stores * 6000;
      return player.money >= cost
        ? actionableExecutionAction('build-store')
        : blockedExecutionAction('insufficient_cash', { requiredMoney: cost });
    }
    case 'expand_capacity': {
      const cost = 42000 + player.factories * 7000;
      return player.money >= cost
        ? actionableExecutionAction('build-factory')
        : blockedExecutionAction('insufficient_cash', { requiredMoney: cost });
    }
    case 'repay_debt': {
      if (player.debt < 5000) return blockedExecutionAction('debt_cleared');
      const amount = Math.min(10000, Math.round(player.debt));
      return player.money >= amount
        ? actionableExecutionAction('repay-loan', amount)
        : blockedExecutionAction('insufficient_cash', { requiredMoney: amount });
    }
    case 'accept_contract': {
      const contract = findRecommendedContract(room, player);
      return contract
        ? actionableExecutionAction('accept-contract', contract.id)
        : blockedExecutionAction('no_matching_contract');
    }
    case 'start_research':
      return availableResearchKeys[0]
        ? actionableExecutionAction('start-research', availableResearchKeys[0])
        : blockedExecutionAction('no_research_options');
    case 'lower_price':
      return player.price > 60
        ? actionableExecutionAction('set-price', clamp(player.price - 10, 60, 260))
        : blockedExecutionAction('price_floor');
    default:
      return manualExecutionAction();
  }
}

function expandExecutionRecommendation({ key, player, room, availableResearchKeys = [] }) {
  const contractDeadline = player.activeContract ? player.activeContract.expiresDay - room.day : null;

  switch (key) {
    case 'secure_contract': {
      const steps = [];
      if (player.rawStock < 12) steps.push('buy_raw');
      if (player.soldLastTick === 0 && player.price >= 180) steps.push('lower_price');
      if (player.marketing < 2) steps.push('boost_marketing');
      if ((contractDeadline ?? 99) <= 1 && player.stores < 2) steps.push('expand_retail');
      return steps.length ? steps : ['secure_contract'];
    }
    case 'focus_goal': {
      switch (player.seasonGoal?.metric) {
        case 'sales': {
          const steps = [];
          if (player.soldLastTick === 0 && player.price >= 170) steps.push('lower_price');
          if (player.marketing < 2) steps.push('boost_marketing');
          if (player.stores < 2) steps.push('expand_retail');
          return steps.length ? steps : ['focus_goal'];
        }
        case 'innovation':
          if (availableResearchKeys.length) return ['start_research'];
          if (player.quality < 2) return ['upgrade_quality'];
          return ['focus_goal'];
        case 'contracts':
          return player.activeContract ? expandExecutionRecommendation({ key: 'secure_contract', player, room, availableResearchKeys }) : ['accept_contract'];
        case 'cash':
          if (player.debt > 90000) return ['repay_debt'];
          return expandExecutionRecommendation({ key: 'build_cash', player, room, availableResearchKeys });
        default:
          return ['focus_goal'];
      }
    }
    case 'build_cash':
      if (player.debt > 90000) return ['repay_debt'];
      if (player.activeContract && (contractDeadline ?? 99) <= 1) return expandExecutionRecommendation({ key: 'secure_contract', player, room, availableResearchKeys });
      if (player.soldLastTick === 0 && player.price >= 180) return ['lower_price'];
      if (!player.activeContract && findRecommendedContract(room, player)) return ['accept_contract'];
      return ['build_cash'];
    default:
      return [key];
  }
}

function buildExecutionExplanation({ key, reasonKey }) {
  switch (key) {
    case 'switch_city':
    case 'switch_product':
      return { whyNowKey: 'prep_target_segment', outcomeKey: 'target_alignment' };
    case 'buy_raw':
      return { whyNowKey: reasonKey === 'intel' ? 'supply_risk' : 'prep_target_segment', outcomeKey: 'production_ready' };
    case 'upgrade_supply':
      return { whyNowKey: 'supply_gap', outcomeKey: 'production_ready' };
    case 'boost_marketing':
      return { whyNowKey: 'market_visibility', outcomeKey: 'demand_support' };
    case 'upgrade_quality':
      return { whyNowKey: 'quality_gap', outcomeKey: 'segment_strength' };
    case 'expand_retail':
      return { whyNowKey: 'sales_capacity', outcomeKey: 'retail_capacity' };
    case 'expand_capacity':
      return { whyNowKey: 'capacity_window', outcomeKey: 'capacity_growth' };
    case 'repay_debt':
      return { whyNowKey: 'risk_pressure', outcomeKey: 'lower_risk' };
    case 'accept_contract':
      return { whyNowKey: 'contract_window', outcomeKey: 'contract_reward' };
    case 'start_research':
      return { whyNowKey: 'research_idle', outcomeKey: 'innovation_progress' };
    case 'lower_price':
      return { whyNowKey: 'demand_soft', outcomeKey: 'sales_recovery' };
    case 'build_cash':
      return { whyNowKey: 'cash_buffer', outcomeKey: 'reserve_buffer' };
    default:
      return { whyNowKey: 'generic', outcomeKey: 'generic' };
  }
}

function buildExecutionPlan({ player, room, intel, focusPlan, pivotPreview, availableResearchKeys = [] }) {
  const queue = [];
  const pushItem = (key, priority, reasonKey) => {
    if (queue.some(item => item.key === key)) return;
    const nextAction = buildExecutionAction({ key, player, room, availableResearchKeys });
    const explanation = buildExecutionExplanation({ key, reasonKey });
    queue.push({
      key,
      priority,
      reasonKey,
      mode: nextAction.mode,
      actionable: nextAction.mode === 'actionable',
      action: nextAction.action || '',
      value: nextAction.value ?? '',
      blockedReason: nextAction.blockedReason || '',
      requiredMoney: nextAction.requiredMoney || 0,
      whyNowKey: explanation.whyNowKey,
      outcomeKey: explanation.outcomeKey,
    });
  };

  if (pivotPreview?.timing === 'pivot_now') {
    if (player.cityKey !== (player.focusCityKey || player.cityKey)) pushItem('switch_city', 'high', 'pivot_now');
    if (player.productKey !== (player.focusProductKey || player.productKey)) pushItem('switch_product', 'high', 'pivot_now');
  }

  if (pivotPreview?.timing === 'prepare_then_pivot') {
    (focusPlan?.missingSteps || []).forEach(step => pushItem(step, 'high', 'prepare_then_pivot'));
  }

  (intel?.recommendations || []).forEach(key => {
    const expandedKeys = expandExecutionRecommendation({ key, player, room, availableResearchKeys });
    expandedKeys.forEach((stepKey, index) => {
      const basePriority = queue.length < 2 ? 'high' : 'medium';
      const priority = index === 0 ? basePriority : basePriority === 'high' ? 'medium' : 'low';
      pushItem(stepKey, priority, 'intel');
    });
  });

  if (!queue.length) pushItem('hold_course', 'low', 'intel');

  return queue.slice(0, 5);
}

function buildFinancialBreakdown({
  player,
  city,
  scenario,
  specialization,
  policy,
  research,
  sold,
}) {
  const revenue = sold * player.price;
  const salary = Math.round(player.staff * player.salary * city.salary * scenario.salary * specialization.salaryMultiplier * policy.salaryMultiplier);
  const upkeep = Math.round((player.factories * 5500 + player.stores * 3200 + player.marketing * 1200) * (1 - (research.upkeep || 0)) * policy.upkeepMultiplier);
  const debt = Math.round(player.debt * 0.015 * (1 - (research.debtCost || 0)));
  const technology = player.automation * 1600 + player.quality * 900 + player.supplyLevel * 800 + player.innovation * 700;
  const expenses = salary + upkeep + debt + technology;

  return {
    revenue,
    expenses,
    profit: revenue - expenses,
    sold,
    salary,
    upkeep,
    debt,
    technology,
  };
}

function buildSimulationScore({
  netWorth = 0,
  money = 0,
  debt = 0,
  reputation = 0,
  completedContracts = 0,
  completedResearch = 0,
  innovation = 0,
  soldLastTick = 0,
  seasonGoal = null,
  lastTickBreakdown = null,
} = {}) {
  const safeNetWorth = toNumber(netWorth);
  const safeMoney = toNumber(money);
  const safeDebt = toNumber(debt);
  const safeReputation = clamp(Math.round(toNumber(reputation, 50)), 0, 100);
  const safeContracts = Math.max(0, Math.round(toNumber(completedContracts)));
  const safeResearch = Math.max(0, Math.round(toNumber(completedResearch)));
  const safeInnovation = Math.max(0, Math.round(toNumber(innovation)));
  const safeSold = Math.max(0, Math.round(toNumber(soldLastTick)));
  const profit = toNumber(lastTickBreakdown?.profit, 0);

  const goalTarget = Math.max(0, toNumber(seasonGoal?.target, 0));
  const goalProgress = Math.max(0, toNumber(seasonGoal?.progress, 0));
  const goalRatio = goalTarget > 0 ? clamp(goalProgress / goalTarget, 0, 1.2) : 0;

  const financial = clamp(Math.round(safeNetWorth / 3000), 0, 120);
  const liquidity = clamp(Math.round(safeMoney / 5000), 0, 45);
  const contracts = clamp(safeContracts * 18, 0, 60);
  const innovationScore = clamp(safeInnovation * 14 + safeResearch * 6, 0, 65);
  const execution = clamp(Math.round(goalRatio * 35) + Math.round(safeSold * 1.5), 0, 60);
  const discipline = profit > 0 ? 8 : 0;
  const resilienceBonus = clamp(Math.round(safeReputation / 25), 0, 4);
  const debtPenalty = clamp(Math.round(safeDebt / 20000) - resilienceBonus, 0, 35);

  const total = clamp(
    financial + liquidity + contracts + innovationScore + execution + discipline - debtPenalty,
    0,
    350
  );

  return {
    total,
    components: {
      financial,
      liquidity,
      contracts,
      innovation: innovationScore,
      execution,
      discipline,
      debtPenalty,
    },
  };
}

module.exports = {
  BOARD_POLICIES,
  OPERATING_PLANS,
  SEASON_GOALS,
  clamp,
  demandMultiplier,
  eventApplies,
  researchEffects,
  computeSeasonGoalProgress,
  buildOperatingPlanPreview,
  buildExecutionAction,
  pickOperatingPlanAction,
  buildForecastSegments,
  buildPlayerIntel,
  buildFocusPlan,
  buildPivotPreview,
  buildExecutionPlan,
  buildFinancialBreakdown,
  buildSimulationScore,
};
