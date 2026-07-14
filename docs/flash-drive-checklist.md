# Flash Drive Checklist

Copy these files to the flash drive before the defense.

## Required

- Unified transfer archive from `dist/Biz-Arena-v0.3.0-defense-bundle.zip`
- Portable Windows build from `dist/`
- Installer build from `dist/`
- Fallback unpacked ZIP from `dist/Biz-Arena-0.3.0-win-unpacked.zip` if the final single-file `.exe` is blocked by local Windows symlink permissions
- Release manifest from `dist/release-manifest-0.3.0.json`
- `README.md`
- `docs/teacher-demo-checklist.md`
- `docs/demo-script.md`
- `docs/report-draft.md`
- `docs/final-report-checklist.md`
- `docs/championship-requirements-map.md`
- `docs/presentation-outline.md`
- `docs/presentation-asset-map.md`
- `docs/presentation-slide-text.md`
- `docs/screenshot-shotlist.md`
- `docs/defense-qa.md`
- `docs/v0.3-sprint-5-report-presentation.md`
- `docs/v0.3-sprint-7-report-docx.md`
- `docs/v0.3-sprint-8-release-build.md`
- `docs/v0.3-sprint-9-defense-bundle.md`
- `docs/v0.3-sprint-10-readiness.md`
- `docs/v0.3-sprint-11-simformer-core.md`
- `docs/simformer-parity-matrix.md`
- `docs/v0.3-sprint-4-defense-package.md`
- `docs/v0.3-sprint-3-results.md`
- Final presentation file
- Final report or explanatory note as `.docx` and `.pdf`

## Recommended

- `docs/v0.3-roadmap.md`
- `docs/report-outline.md`
- Project archive without `node_modules/`, `dist/`, and temporary files
- GitHub repository link if publication is approved
- A few screenshots of the main menu, demo match, factory screen, contracts, leaderboard, and results
- Optional exported `biz-arena-results-*.json` from a completed demo run
- `defense-assets/screenshots/` if final screenshots are prepared outside the repository
- `defense-assets/results/biz-arena-results-demo.json` if the generated demo export is used in the appendix
- `defense-assets/report/Biz-Arena-report-draft.docx` as the generated report starting point

## What To Open First

1. Portable Biz Arena `.exe` for the fastest live demo.
2. If the portable `.exe` is not available, extract `dist/Biz-Arena-0.3.0-win-unpacked.zip` and run `win-unpacked/Biz Arena.exe`.
3. `docs/demo-script.md` if you need the spoken defense flow.
4. Presentation file for the formal explanation.
5. `docs/presentation-asset-map.md` if screenshots need to be matched with slides.
6. `docs/final-report-checklist.md` if the report needs final formatting.
7. `docs/defense-qa.md` if the professor asks conceptual questions.
8. `README.md` if the professor asks for project structure or implemented features.

## Final Local Verification

```powershell
npm run check
npm test
npm run dist:win
npm run release:zip-unpacked
npm run release:defense-bundle
npm run predefense:readiness
```

Then run the portable `.exe` and start `Демо-матч для показа`.

## Build Troubleshooting

If `npm run dist:win` fails while extracting `winCodeSign` with `Cannot create symbolic link`, enable Windows Developer Mode or run the build in a Windows account/session that is allowed to create symbolic links. This is an environment permission issue, not a Biz Arena source-code failure.

Until that permission is fixed, use `npm run release:zip-unpacked` and copy the generated ZIP as the desktop fallback package.
