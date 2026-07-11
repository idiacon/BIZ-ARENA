const GAME_TAB_ROLE_CONTRACT = Object.freeze({
  student: Object.freeze(['overview', 'purchase', 'operations', 'market', 'competitors', 'events']),
  teacher: Object.freeze(['teacher', 'overview', 'competitors', 'market', 'events', 'statistics']),
});

const SCREEN_PHASE_CONTRACT = Object.freeze(['entry', 'lobby', 'active', 'finished']);

const ROLE_NAVIGATION_CONTRACT = Object.freeze({
  teacher: Object.freeze(['cabinet', 'room', 'teams', 'market', 'events', 'results', 'settings']),
  student: Object.freeze(['overview', 'purchase', 'production', 'market', 'team', 'report']),
});

const VISUAL_QUALITY_CONTRACT = Object.freeze({
  full: Object.freeze({
    label: 'Full',
    teacherExperience: 'operations-center',
    studentExperience: 'isometric-tycoon-2.5d',
    sceneDetail: 'high',
    motion: 'rich',
    recommendedHardware: '16 ГБ ОЗУ и дискретная графика',
    description: 'Все 2.5D-слои, тени и быстрые обновления.',
    fallbackPollingMs: 5000,
    realtimeDebounceMs: 180,
    preserveInformation: true,
    preserveControlPlacement: true,
  }),
  standard: Object.freeze({
    label: 'Standard',
    teacherExperience: 'operations-center',
    studentExperience: 'isometric-tycoon-2.5d',
    sceneDetail: 'medium',
    motion: 'reduced',
    recommendedHardware: '8 ГБ ОЗУ или современная встроенная графика',
    description: 'Та же сцена без дорогих свечений и лишних визуальных слоев.',
    fallbackPollingMs: 8000,
    realtimeDebounceMs: 280,
    preserveInformation: true,
    preserveControlPlacement: true,
  }),
  lite: Object.freeze({
    label: 'Lite',
    teacherExperience: 'operations-center',
    studentExperience: 'isometric-tycoon-2.5d',
    sceneDetail: 'schematic',
    motion: 'off',
    recommendedHardware: '6 ГБ ОЗУ, встроенная графика и Windows 10',
    description: 'Схематичная сцена без движения, теней и тяжелых эффектов.',
    fallbackPollingMs: 12000,
    realtimeDebounceMs: 450,
    preserveInformation: true,
    preserveControlPlacement: true,
  }),
});

const CRISIS_CARDS = {
  factory_demand_surge: {
    title: 'Резкий всплеск спроса',
    scenario: 'Дилеры внезапно готовы забрать больше товара, но выигрывают команды с готовым складом.',
    effect: 'Спрос временно растет. Сильнее всего выигрывают команды, которые уже закупили, собрали и выставили заявку.',
    question: 'Кто подготовился заранее, а кто пытается догнать рынок после сигнала?',
    timing: 'Запускать после первого хода или перед обсуждением склада и заявок.',
  },
  factory_supplier_delay: {
    title: 'Срыв поставок',
    scenario: 'Поставщики поднимают цену комплектующих, и поздняя закупка резко съедает маржу.',
    effect: 'Комплектующие дорожают. Команды без ранней закупки получают давление на cash flow.',
    question: 'Что дешевле: держать запас или рисковать остановкой сборки?',
    timing: 'Запускать, когда часть команд еще не закупилась.',
  },
  factory_payroll_pressure: {
    title: 'Давление зарплат',
    scenario: 'Рынок труда перегрет: работники и содержание линии временно становятся дороже.',
    effect: 'Фонд оплаты и расходы линии растут. Слабая загрузка персонала быстрее бьет по прибыли.',
    question: 'Какая команда наняла людей под реальный план производства, а не “на всякий случай”?',
    timing: 'Запускать перед сравнением найма, сборки и прибыли.',
  },
};

window.BizArenaUiContracts = Object.freeze({
  gameTabs: GAME_TAB_ROLE_CONTRACT,
  screenPhases: SCREEN_PHASE_CONTRACT,
  navigation: ROLE_NAVIGATION_CONTRACT,
  visualQuality: VISUAL_QUALITY_CONTRACT,
  crisisCards: CRISIS_CARDS,
});
