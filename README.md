# Biz Arena

Biz Arena is an educational business strategy game inspired by Simformer and Virtonomics.  
The project was created for demonstration and learning purposes at the Almetyevsk branch of KNRTU-KAI.

## Project Info

- Author: Damir Ilnurovich Nadrov
- GitHub: `idiacon`
- Format: browser game with Electron desktop build
- Status: `v0.1.0`

## What Is Already Implemented

- LAN room flow: create room, join by code, host controls
- Match lifecycle: start, pause, resume, reset
- Economy loop with products, cities, prices, stock, raw materials, staff, debt, and market ticks
- Scenarios, live events, contracts, research, board policies, and seasonal goals
- Career profile with statistics and achievements
- Intel panel with focus plan, pivot preview, and execution queue
- Save/load for room state
- Electron desktop shell
- Windows installer and portable `.exe`

## Quick Start

Install dependencies:

```bash
npm install
```

Run the local server:

```bash
npm start
```

Open in browser:

```text
http://127.0.0.1:3000
```

## Desktop Run

```bash
npm run desktop
```

This starts the Electron wrapper and opens Biz Arena in a separate desktop window.

## Windows Build

Build the installer and portable version:

```bash
npm run dist:win
```

Artifacts are created in `dist/`:

- `Biz Arena Setup 0.1.0.exe` — Windows installer
- `Biz Arena 0.1.0.exe` — portable executable

## Verification

```bash
npm run check
npm test
```

## Repository Structure

- `desktop/` — Electron shell
- `public/` — client UI
- `server/` — game logic modules
- `test/` — automated tests
- `docs/` — phase checklists and stabilization notes
- `build/` — installer resources

## Current Focus

- Phase 1: manual UI bug bash and consistency pass
- Phase 2: integration and regression coverage
- Phase 3: persistence and runtime hardening
- Phase 4: release readiness and playtest polish

Detailed plans are stored in:

- `docs/v0.1-phase-1-kickoff.md`
- `docs/v0.1-phase-2-kickoff.md`
- `docs/v0.1-phase-3-kickoff.md`

## License

This repository is published for educational demonstration purposes.
