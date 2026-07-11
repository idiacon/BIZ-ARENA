# Biz Arena Hybrid Interface Plan

Status: approved direction, implementation started.

## Product Thesis

Biz Arena uses one design system with two role-specific experiences:

- Teacher: an operations center for managing the room, turn, readiness, blockers, help requests, market events, and results.
- Student Full: a premium 2.5D isometric tycoon where the factory, suppliers, production, warehouse, and market are visible as one operating system.
- Shared surfaces: role selection, room entry, lobby, pause state, reconnect state, and results use the same navigation, typography, status language, and control positions.

The UI must feel like a game, not a decorated admin panel. Visual richness must explain the economy and the consequences of decisions.

## Quality Profiles

| Profile | Scene | Motion and effects | Data and controls |
| --- | --- | --- | --- |
| Full | Detailed 2.5D factory scene and rich market feedback | Focused 160-220 ms transitions and limited scene motion | Complete |
| Standard | Same scene composition with fewer layers and reduced motion | Reduced effects and update cost | Identical to Full |
| Lite | Schematic factory map, no nonessential motion or heavy effects | Motion disabled, slower fallback polling | Identical to Full |

All profiles preserve information, action order, navigation, and control placement. They differ only in rendering cost and visual detail.

## Screen Architecture

1. Entry: choose Teacher or Student, then show only the relevant next action.
2. Teacher setup: create room, configure supported scenario settings, verify LAN, share link and QR.
3. Lobby: teacher sees readiness and start gate; students see participants, lesson settings, and one Ready action.
4. Student game: stable left navigation, turn header, central 2.5D factory, next-action rail, and contextual detail panel.
5. Teacher game: class readiness, blockers, help queue, turn controls, market pulse, crisis cards, and current teaching recommendation.
6. Results: winner and learning summary first, detailed market replay and history second.

## Implementation Sequence

1. Design tokens and Full/Standard/Lite runtime contract.
2. Shared shell, role entry, and navigation.
3. Teacher create-room and lobby.
4. Student join and lobby.
5. Full student 2.5D game dashboard.
6. Full teacher operations center.
7. Results and completed-session history.
8. Standard/Lite derivation, performance profiling, responsive and Electron QA.

## Acceptance Rules

- No mock metrics in production screens.
- One primary next action per role and phase.
- Color is never the only status indicator.
- Keyboard focus is visible and reduced motion is respected.
- No horizontal page scroll at 375, 768, 1024, or 1440 px.
- Full, Standard, and Lite expose the same gameplay information and commands.
- Full visual work cannot weaken LAN, reconnect, polling fallback, or student-state-v2 isolation.
