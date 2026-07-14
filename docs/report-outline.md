# Report Outline

Default topic:

```text
Разработка учебного бизнес-симулятора Biz Arena
```

## Suggested Structure

1. Титульный лист
2. Содержание
3. Введение
4. Актуальность проекта
5. Цель и задачи разработки
6. Анализ предметной области
7. Обзор аналогов: Simformer, Virtonomics, учебные бизнес-чемпионаты
8. Функциональные требования
9. Нефункциональные требования
10. Архитектура приложения
11. Серверная часть и игровые правила
12. Клиентская часть и интерфейс
13. Desktop-сборка на Electron
14. Игровая экономика: производство, компоненты, контракты, рейтинг
15. Поддержка языков: русский, английский, татарский
16. Тестирование и проверка надежности
17. Руководство пользователя
18. Демонстрационный сценарий
19. Заключение
20. Список источников
21. Приложения

## Implementation Notes For The Report

- Use `docs/report-draft.md` as the first full-text draft.
- Use `npm run report:docx` to generate `defense-assets/report/Biz-Arena-report-draft.docx`.
- Use `docs/final-report-checklist.md` for final Word/PDF formatting.
- Mention that the main defense scenario is `KAI Demo Championship`.
- Mention that the default company name is `AFKAIstudent1`, matching the championship memo format.
- Explain the factory flow through the motorcycle scenario.
- Use `docs/championship-requirements-map.md` to connect the participant memo to the implemented demo flow.
- Use `docs/presentation-outline.md` when preparing screenshots and slide order.
- Use `docs/screenshot-shotlist.md` to capture the final screenshots consistently.
- Include screenshots of the main menu, demo match, factory operations, contracts, leaderboard, and results.
- Add one exported `biz-arena-results-*.json` from a completed demo run as an appendix artifact.
- In the testing section, describe how the final results screen connects leaderboard score with contracts, research, liquidity, and debt risk.
- Include test commands: `npm run check`, `npm test`.
- Include build command: `npm run dist:win`.

## What To Prepare Later

- Final screenshots after UI polish.
- Presentation screenshots from the KAI template.
- Exact defense date and professor requirements if they become available.
