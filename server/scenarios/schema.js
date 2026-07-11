function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validatePositiveNumber(errors, path, value, { allowZero = false } = {}) {
  const number = numberOrNull(value);
  if (number === null || (allowZero ? number < 0 : number <= 0)) {
    errors.push(`${path} must be ${allowZero ? 'non-negative' : 'positive'} number`);
  }
  return number;
}

function validateScenarioDefinition(definition) {
  const errors = [];
  if (!definition || typeof definition !== 'object') {
    return { valid: false, errors: ['scenario must be an object'] };
  }

  ['key', 'label', 'productLabel'].forEach(field => {
    if (!definition[field] || typeof definition[field] !== 'string') {
      errors.push(`${field} is required`);
    }
  });

  const demandMin = validatePositiveNumber(errors, 'demand.min', definition.demand?.min);
  const demandMax = validatePositiveNumber(errors, 'demand.max', definition.demand?.max);
  if (demandMin !== null && demandMax !== null && demandMin > demandMax) {
    errors.push('demand.min must be less than or equal to demand.max');
  }

  const priceMin = validatePositiveNumber(errors, 'priceRange.min', definition.priceRange?.min);
  const priceMax = validatePositiveNumber(errors, 'priceRange.max', definition.priceRange?.max);
  if (priceMin !== null && priceMax !== null && priceMin >= priceMax) {
    errors.push('priceRange.min must be less than priceRange.max');
  }

  validatePositiveNumber(errors, 'economics.upkeep', definition.economics?.upkeep, { allowZero: true });
  validatePositiveNumber(errors, 'economics.starterCash', definition.economics?.starterCash);

  const components = definition.components || {};
  if (!components || typeof components !== 'object' || Array.isArray(components) || !Object.keys(components).length) {
    errors.push('components must contain at least one component');
  } else {
    Object.entries(components).forEach(([key, component]) => {
      if (!component?.label || typeof component.label !== 'string') errors.push(`components.${key}.label is required`);
      validatePositiveNumber(errors, `components.${key}.unitCost`, component?.unitCost);
      validatePositiveNumber(errors, `components.${key}.lotSize`, component?.lotSize);
      validatePositiveNumber(errors, `components.${key}.recipe`, component?.recipe);
    });
  }

  return { valid: errors.length === 0, errors };
}

function buildScenarioDefinitionFromFactoryConfig(config, {
  difficultyLabel = '',
  dayLimit = 30,
  turnMinutes = 30,
} = {}) {
  if (!config) return null;
  const definition = {
    key: config.key,
    label: config.label || config.productLabel,
    productKey: config.productKey,
    productLabel: config.productLabel,
    productUnit: config.productUnit || 'ед.',
    demand: {
      min: Number(config.baseDemandMin || 0),
      max: Number(config.baseDemandMax || 0),
    },
    priceRange: {
      min: Number(config.priceRange?.min || 0),
      max: Number(config.priceRange?.max || 0),
      base: Number(config.basePrice || 0),
    },
    economics: {
      upkeep: Number(config.upkeep || 0),
      starterCash: Number(config.starterCash || 0),
      difficultyLabel,
      dayLimit,
      turnMinutes,
    },
    components: { ...(config.components || {}) },
    roles: [...(config.roles || [])],
  };
  const validation = validateScenarioDefinition(definition);
  return { ...definition, validation };
}

function buildScenarioLabSummary(definition) {
  if (!definition) return null;
  const componentEntries = Object.entries(definition.components || {});
  const recipeCost = componentEntries.reduce((sum, [, component]) => (
    sum + Number(component.unitCost || 0) * Number(component.recipe || 0)
  ), 0);
  const demandText = `${definition.demand.min}-${definition.demand.max} ${definition.productUnit}`;
  const priceText = `${definition.priceRange.min}-${definition.priceRange.max} ₽`;
  const componentText = componentEntries
    .slice(0, 4)
    .map(([, component]) => component.label)
    .join(', ');

  return {
    key: definition.key,
    title: `Лаборатория сценария: ${definition.productLabel}`,
    validation: definition.validation,
    parameters: [
      { key: 'demand', label: 'Спрос за ход', value: demandText, hint: 'Сколько единиц рынок готов купить после пересчета.' },
      { key: 'price', label: 'Диапазон цены', value: priceText, hint: 'Границы заявок, внутри которых ученики конкурируют.' },
      { key: 'recipe_cost', label: 'Себестоимость рецепта', value: `${Math.round(recipeCost)} ₽`, hint: `Комплектующие: ${componentText}.` },
      { key: 'upkeep', label: 'Расходы завода', value: `${Math.round(definition.economics.upkeep)} ₽/ход`, hint: 'Постоянный расход, который давит на прибыль.' },
      { key: 'turns', label: 'Длина занятия', value: `${definition.economics.dayLimit} ходов`, hint: `${definition.economics.turnMinutes} минут на ход.` },
    ],
    experimentAxes: [
      {
        key: 'price_strategy',
        label: 'Цена',
        question: 'Что произойдет, если команда продает дешевле рынка или держит высокую маржу?',
      },
      {
        key: 'supplier_scarcity',
        label: 'Дефицит поставщиков',
        question: 'Как меняется результат, если дешевые лоты быстро выкупают конкуренты?',
      },
      {
        key: 'staffing',
        label: 'Персонал',
        question: 'Когда новый работник ускоряет прибыль, а когда только увеличивает расходы?',
      },
      {
        key: 'demand_shock',
        label: 'Событие спроса',
        question: 'Кто выигрывает при резком росте или падении спроса?',
      },
    ],
  };
}

module.exports = {
  validateScenarioDefinition,
  buildScenarioDefinitionFromFactoryConfig,
  buildScenarioLabSummary,
};
