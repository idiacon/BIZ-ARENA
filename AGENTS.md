## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Biz Arena

- Preserve the server/admin, teacher in-game, and student role boundaries. For role or state changes, consult `docs/ui-role-contract-v1.md` and the relevant section of `docs/architecture-map.md` before editing.
- Student API and UI paths must stay on `student-state-v2`; never expose teacher-only controls, state, lesson guidance, QR URLs, or lifecycle mutations to students.
- Keep role rendering in the existing role modules: `public/ui/student-ui.js`, `public/ui/teacher-ui.js`, and `public/ui/server-admin-ui.js`. Keep shared role navigation and metadata in `public/ui/role-contracts.js`.
- Preserve classroom reconnect, paused-session, first-turn, history/export, and debrief behavior. Do not fabricate or silently alter pilot evidence.
- Do not add dependencies, external services, or authentication flows without an explicit user request.
- After source changes run `npm run check`; after behavior changes run `npm test` plus the smallest relevant smoke or E2E command. For classroom UI or role-flow changes, run `npm run e2e:classroom`.
- Use `npm run release:verify` for a release candidate. Run `npm run release:full` only for an explicitly requested full release artifact.
