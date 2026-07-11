# Presentation Outline

Topic:

```text
Разработка учебного бизнес-симулятора Biz Arena
```

Use the KAI presentation template as the visual base. Keep the slide text short and use screenshots from the current app.

Ready-to-transfer slide copy is in `docs/presentation-slide-text.md`.
Screenshot requirements are in `docs/screenshot-shotlist.md`.
Generated screenshot-to-slide mapping is in `docs/presentation-asset-map.md`.

## Slide Plan

| Slide | Title | Content |
|---|---|---|
| 1 | Title | Project topic, author, organization: Almetyevsk branch of KNRTU-KAI. |
| 2 | Problem | Business-training games are useful, but a local demo needs to be simple to launch, explain, and show without external services. |
| 3 | Goal And Tasks | Goal: create an educational business simulator. Tasks: production loop, contracts, rating, LAN/browser mode, desktop build, tests, documentation. |
| 4 | Championship Basis | Mention the KAI participant memo: company names like `AFKAIstudent1`, period recalculation, contract purchases, ranking, top-3 winners. |
| 5 | Architecture | Browser UI, Node.js server, room state, game rules, Electron shell, tests. Use a simple block diagram. |
| 6 | Game Mechanics | Components, workers, assembly, sale order, contracts, debt, research, market turns, leaderboard. |
| 7 | Demo Flow | `Демо-матч для показа`: `KAI Demo Championship`, `AFKAIstudent1`, motorcycles, easy mode, 10 turns, 2 bots. |
| 8 | Results And Export | Show winner, player rank, top-3, debt risk, contracts, research, and exported JSON as proof of a completed run. |
| 9 | Testing And Reliability | `npm run check`, `npm test`, save/load recovery, room lifecycle tests, factory scenario tests. |
| 10 | Result | Working browser app, Electron desktop build target, three languages, defense docs, report outline, release checklist. |

## Screenshot Checklist

- Main menu with `v0.3.0 Demo Release`.
- Play menu with `Демо-матч для показа`.
- Operations/production tab after demo start.
- Contracts panel.
- Leaderboard.
- Results screen.
- Exported JSON file opened in an editor.

## Speaker Notes

- Do not spend time explaining every button.
- Start with the educational problem, then show the live business loop.
- Use the championship memo to justify company naming, contracts, periods, and rating.
- End with the results screen because it turns the demo into a clear assessment story.

## Backup Slide

If the desktop build does not open on the defense computer, show that the same app runs in a browser at:

```text
http://127.0.0.1:3000
```
