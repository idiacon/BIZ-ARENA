# Biz Arena vs Simformer Parity Matrix

## Goal

Track how close Biz Arena is to a classroom-ready Simformer-like simulator and define implementation priorities.

## Parity Scale

- `A` - implemented and stable in daily demo flow
- `B` - implemented but needs balancing/polish
- `C` - partial prototype
- `D` - missing

## Core Mechanics

| Simformer-like capability | Biz Arena status | Grade | Notes |
| --- | --- | --- | --- |
| Turn-based management cycle | Implemented | A | Manual turn mode, host controls, pause/resume, speed presets. |
| Market demand recalculation | Implemented | A | Demand profile, scenario modifiers, random events, market history. |
| Production and resource chain | Implemented | A | Factory scenarios with components, workers, assembly, and order-book sales. |
| Strategic decisions with trade-offs | Implemented (expanded in Sprint 13-14) | A | Motorcycles and drones now include strategic decision rounds with timed choices, visible consequences, and auto-safe fallback. |
| Contract system and deadlines | Implemented | A | Contract board, assignment, expiry, progress, completion reward. |
| R&D progression and permanent effects | Implemented | A | Research queue, completion effects, innovation growth. |
| Leaderboard and winner logic | Implemented (expanded in Sprint 11) | B | Ranked by simulation score first, net worth as tie-breaker. |
| Explaining why one company won | Implemented (expanded in Sprint 12) | A | Score breakdown is visible in Statistics and Results, plus exported in JSON payload. |
| Multi-user classroom play | Implemented | A | LAN room flow, host/player roles, reconnect safety. |
| Teacher defense package | Implemented | A | Demo script, screenshots, report draft, readiness report, defense bundle ZIP. |

## Gap Backlog (Priority Order)

1. `P1` Add scenario presets for classroom modes:
   short sprint, standard season, stress-test season.
2. `P1` Add teacher-side controls:
   force event, lock phase, and show class-wide KPI snapshot.
   Current progress: host can already force strategic decision rounds for demo flow.
3. `P2` Add after-action analytics:
   compare player path against top-1 path by score components.

## Sprint 11-14 Outcome

Sprint 11-14 deliver the first product-level step toward Simformer parity:

- introduces a transparent simulation score model on the server;
- switches leaderboard ranking to simulation score with net-worth tie-break;
- exports score and score breakdown into defense JSON results;
- renders score breakdown directly in Statistics and Results for live explainability;
- adds strategic decision rounds for motorcycles and drones with manual choice and auto-safe resolution.

This shifts Biz Arena from a cash-only ranking perception toward a structured management-performance rating.
