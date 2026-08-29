# BIZ-ARENA Studio V3 — Design QA

Date: 2026-08-29
Review: `bizarena-studio-v3-shiro-fixes-20260829`
Scope: Shiro P1/P2 findings for teacher cockpit, mobile first-turn tutorial, classroom terminology, results semantics, and room identifiers.

## Evidence

- Baseline screenshots: `tmp/studio-v3-qa-final/`
- Reviewed implementation screenshots: `tmp/studio-v3-shiro-fixes/`
- Browser audit: `tmp/studio-v3-shiro-fixes/audit.json`
- Viewports covered: 390x844, 1000x760, 1440x900, 1920, 2560, and 3440 widths where applicable.

## Verdict

PASS for the reviewed browser surfaces.

The teacher cockpit now uses the page as its single vertical scroll surface. The mobile first-turn tutorial keeps the actual route action visible and focused while removing the duplicate tutorial action and topbar action chip. Teacher and student results use role-appropriate Russian labels, and the room header explicitly separates the join code from the room name.

## Issue Resolution

| Finding | Before | After | Status |
| --- | --- | --- | --- |
| Teacher cockpit nested scroll | Right-side teacher workspace had its own capped scroll region inside the page. | Side workspace is static-height and participates in the page scroll. | PASS |
| Mobile tutorial duplicate CTA | The route CTA and tutorial CTA repeated the same navigation action. | The real route CTA remains the highlighted target; the tutorial duplicate and topbar chip are hidden in mobile navigation mode. | PASS |
| Results terminology | Mixed `simulation score`, `Replay`, and ambiguous profit/margin labels. | Russian `балл симуляции`, `Разбор рынка`, `Финансовый результат хода`, and `Расчётная маржа на единицу`. | PASS |
| Classroom language | `LIVE`, `HTTP fallback`, `Crisis Cards`, and `Easy` appeared in Russian classroom UI. | Replaced with Russian classroom terms. | PASS |
| Room identifiers | Code and room name appeared as two unlabeled code-like strings. | The join code stays primary; the secondary value is prefixed with `Название:`. | PASS |

## Automated Visual Evidence

- All layout audit entries report `ok: true` with no horizontal overflow nodes.
- First-turn tutorial desktop and mobile audits report `ok: true`, target inside viewport, focus matching target, and no card/target overlap.
- Browser error list is empty.
- Teacher and student focus-order audits are ordered across navigation, HUD, workspace, and action rail.
- Reduced-motion audit reports zero animation and transition duration under the tested preference.

## Remaining Validation Boundary

- Browser screenshots validate the web renderer, not packaged Electron executables.
- No physical two-device classroom session was run in this QA pass.
- The Impeccable detector reports one advisory false positive caused by numeric `<option>` values, not numbered section decoration.
