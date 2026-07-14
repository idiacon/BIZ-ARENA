const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_RUNS = 3;
const MIN_RUNS = 3;
const MAX_RUNS = 10;

function requestedRunCount(value = process.env.BIZ_ARENA_REHEARSAL_RUNS) {
  const parsed = Number(value || DEFAULT_RUNS);
  if (!Number.isInteger(parsed)) return DEFAULT_RUNS;
  return Math.min(MAX_RUNS, Math.max(MIN_RUNS, parsed));
}

function parseRunOutput(stdout, runNumber) {
  const text = String(stdout || '').trim();
  if (!text) throw new Error(`Rehearsal run ${runNumber} returned no JSON output.`);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Rehearsal run ${runNumber} returned invalid JSON: ${error.message}`);
  }
}

function aggregateRuns(runs) {
  const metricNames = ['join', 'state', 'action'];
  const worstP95Ms = Object.fromEntries(metricNames.map(metric => [
    metric,
    Math.max(...runs.map(run => Number(run.latency?.[metric]?.p95Ms || 0))),
  ]));
  const failures = runs.flatMap((run, index) => [
    ...(run.ok ? [] : [`run ${index + 1}: load result was not ok`]),
    ...(run.students === 30 ? [] : [`run ${index + 1}: expected 30 students, got ${run.students}`]),
    ...(run.websocketConnections === 30 ? [] : [`run ${index + 1}: expected 30 websocket connections, got ${run.websocketConnections}`]),
    ...((run.failures || []).map(failure => `run ${index + 1}: ${failure}`)),
  ]);

  return {
    ok: failures.length === 0 && runs.length >= MIN_RUNS,
    contract: 'classroom-rehearsal-v1',
    runsRequired: MIN_RUNS,
    runsCompleted: runs.length,
    studentsPerRun: 30,
    websocketConnectionsPerRun: runs.map(run => run.websocketConnections),
    worstP95Ms,
    limitsMs: runs[0]?.limitsMs || null,
    failures,
    runs,
  };
}

function runLoadTest(runNumber) {
  const child = spawnSync(process.execPath, [path.join('scripts', 'load-classroom.js')], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      BIZ_ARENA_LOAD_STUDENTS: '30',
      BIZ_ARENA_LOAD_PORT: '0',
    },
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
  });

  if (child.error) throw child.error;
  if (child.status !== 0) {
    const detail = [child.stdout, child.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`Rehearsal run ${runNumber} failed with exit code ${child.status}.${detail ? `\n${detail}` : ''}`);
  }
  return parseRunOutput(child.stdout, runNumber);
}

function writeReport(report) {
  const reportDir = path.join(ROOT_DIR, '.runtime', 'rehearsals');
  fs.mkdirSync(reportDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const timestampedPath = path.join(reportDir, `classroom-rehearsal-${timestamp}.json`);
  const latestPath = path.join(reportDir, 'classroom-rehearsal-latest.json');
  const contents = `${JSON.stringify(report, null, 2)}\n`;
  fs.writeFileSync(timestampedPath, contents, 'utf8');
  fs.writeFileSync(latestPath, contents, 'utf8');
  return { timestampedPath, latestPath };
}

function main() {
  const runCount = requestedRunCount();
  const runs = [];
  for (let index = 0; index < runCount; index += 1) {
    console.error(`[classroom-rehearsal] run ${index + 1}/${runCount}`);
    runs.push(runLoadTest(index + 1));
  }

  const report = aggregateRuns(runs);
  report.generatedAt = new Date().toISOString();
  report.artifacts = writeReport(report);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = {
  aggregateRuns,
  parseRunOutput,
  requestedRunCount,
};
