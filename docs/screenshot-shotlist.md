# Screenshot Shotlist

Use this checklist when preparing the final presentation and report. Save screenshots into a separate folder, for example:

```text
defense-assets/screenshots/
```

Recommended file names are stable so they can be referenced from the report draft.

Current screenshots can be regenerated with:

```powershell
npm run screenshots:defense
```

## Required Screenshots

| File name | Screen | What must be visible | Used in |
|---|---|---|---|
| `01-main-menu.png` | Main menu | `Biz Arena`, `v0.3.0 Demo Release`, language/profile buttons | Presentation slide 1 or 10, report UI section |
| `02-role-entry.png` | Role entry | Выбор `Преподаватель` / `Ученик`, состояние сервера, версия | Slide 7, user guide |
| `03-demo-started.png` | Game screen | Room `KAI Demo Championship`, company `AFKAIstudent1`, running status | Slide 7, demo scenario |
| `04-production.png` | Operations/production tab | Components, workers, assembly, sale order | Slide 6, game economy |
| `05-contracts.png` | Contracts panel | Contract title, reward, progress, deadline | Slide 6, report mechanics |
| `06-leaderboard.png` | Leaderboard | Player and two bots ranked by net worth | Slide 8, championship basis |
| `07-results.png` | Results screen | Winner, player rank, debt risk, top-3, defense takeaway | Slide 8, testing/result section |
| `08-export-json.png` | Exported JSON | `room`, `summary`, `winner`, `leaderboard`, `contracts` sections | Report appendix |

## Optional Screenshots

| File name | Screen | What must be visible | Used in |
|---|---|---|---|
| `09-about.png` | About screen | Project, learning focus, delivery package | Presentation backup |
| `10-settings-language.png` | Settings | Russian, English, Tatar language support | Report localization section |
| `11-tests.png` | Terminal | `npm run check` and `npm test` passing | Report testing section |
| `12-dist-folder.png` | Dist folder | Portable/installer build artifacts | Release package section |

## Capture Rules

- Use the Russian interface for final defense screenshots.
- Keep browser zoom at 100%.
- Prefer one clear screenshot over several cropped fragments.
- Hide unrelated desktop windows and private paths where possible.
- Capture the results screen after a completed demo run.
- Capture the exported JSON after pressing `Export results`.

## Minimum Presentation Set

If time is short, prepare only these five screenshots:

1. `02-role-entry.png`
2. `03-demo-started.png`
3. `04-production.png`
4. `06-leaderboard.png`
5. `07-results.png`
