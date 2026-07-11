const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const version = packageJson.version;
const stamp = new Date().toISOString();

function exists(relativePath) {
  return fs.existsSync(path.join(rootDir, relativePath));
}

function stat(relativePath) {
  return fs.statSync(path.join(rootDir, relativePath));
}

function pushCheck(checks, relativePath, required = true, note = '') {
  const found = exists(relativePath);
  const item = {
    path: relativePath,
    required,
    found,
    note,
  };
  if (found) {
    const info = stat(relativePath);
    item.size = info.size;
    item.updatedAt = info.mtime.toISOString();
  }
  checks.push(item);
}

function listReleaseExeArtifacts() {
  if (!fs.existsSync(distDir)) {
    return [];
  }
  const lowerVersion = version.toLowerCase();
  return fs
    .readdirSync(distDir)
    .filter((name) => name.toLowerCase().endsWith('.exe'))
    .filter((name) => name.toLowerCase().includes(lowerVersion))
    .map((name) => `dist/${name}`.replace(/\\/g, '/'))
    .sort();
}

const checks = [];
pushCheck(checks, 'README.md');
pushCheck(checks, 'docs/demo-script.md');
pushCheck(checks, 'docs/teacher-defense-brief.md');
pushCheck(checks, 'docs/teacher-demo-checklist.md');
pushCheck(checks, 'docs/flash-drive-checklist.md');
pushCheck(checks, 'docs/report-draft.md');
pushCheck(checks, 'docs/final-report-checklist.md');
pushCheck(checks, 'docs/championship-requirements-map.md');
pushCheck(checks, 'docs/presentation-outline.md');
pushCheck(checks, 'docs/presentation-asset-map.md');
pushCheck(checks, 'docs/presentation-slide-text.md');
pushCheck(checks, 'docs/screenshot-shotlist.md');
pushCheck(checks, 'docs/defense-qa.md');
pushCheck(checks, 'docs/v0.3-roadmap.md');
pushCheck(checks, 'docs/v0.3-sprint-9-defense-bundle.md');
pushCheck(checks, 'docs/v0.3-sprint-10-readiness.md', false, 'Generated after readiness run');
pushCheck(checks, 'defense-assets/screenshots');
pushCheck(checks, 'defense-assets/results/biz-arena-results-demo.json');
pushCheck(checks, 'defense-assets/report/Biz-Arena-report-draft.docx');
pushCheck(checks, `dist/Biz-Arena-v${version}-defense-bundle.zip`);
pushCheck(checks, `dist/Biz-Arena-${version}-win-unpacked.zip`);
pushCheck(checks, `dist/release-manifest-${version}.json`);
pushCheck(checks, `dist/defense-bundle/Biz-Arena-v${version}/bundle-manifest.json`);

const screenshotFiles = [
  'defense-assets/screenshots/01-main-menu.png',
  'defense-assets/screenshots/02-play-menu.png',
  'defense-assets/screenshots/03-demo-started.png',
  'defense-assets/screenshots/04-production.png',
  'defense-assets/screenshots/05-contracts.png',
  'defense-assets/screenshots/06-leaderboard.png',
  'defense-assets/screenshots/07-results.png',
  'defense-assets/screenshots/08-export-json.png',
];
for (const file of screenshotFiles) {
  pushCheck(checks, file);
}

const requiredFailures = checks.filter((item) => item.required && !item.found);
const releaseExeArtifacts = listReleaseExeArtifacts();
const readyWithFullExe = requiredFailures.length === 0 && releaseExeArtifacts.length > 0;
const readyWithFallback =
  requiredFailures.length === 0 &&
  exists(`dist/Biz-Arena-${version}-win-unpacked.zip`) &&
  exists(`dist/Biz-Arena-v${version}-defense-bundle.zip`);

let overallStatus = 'NOT_READY';
if (readyWithFullExe) {
  overallStatus = 'READY_FULL_EXE';
} else if (readyWithFallback) {
  overallStatus = 'READY_WITH_FALLBACK';
}

const report = {
  project: 'Biz Arena',
  version,
  generatedAt: stamp,
  overallStatus,
  releaseExeArtifacts,
  requiredFailures: requiredFailures.map((item) => item.path),
  checks,
};

const jsonReportPath = path.join(distDir, `pre-defense-readiness-v${version}.json`);
const mdReportPath = path.join(distDir, `pre-defense-readiness-v${version}.md`);
fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

const lines = [];
lines.push(`# Pre-Defense Readiness v${version}`);
lines.push('');
lines.push(`- Generated at: ${stamp}`);
lines.push(`- Overall status: \`${overallStatus}\``);
lines.push(`- Versioned EXE artifacts: ${releaseExeArtifacts.length}`);
lines.push('');
if (releaseExeArtifacts.length > 0) {
  lines.push('## EXE Artifacts');
  lines.push('');
  for (const exe of releaseExeArtifacts) {
    lines.push(`- \`${exe}\``);
  }
  lines.push('');
}
lines.push('## Missing Required Items');
lines.push('');
if (requiredFailures.length === 0) {
  lines.push('- none');
} else {
  for (const miss of requiredFailures) {
    lines.push(`- \`${miss.path}\``);
  }
}
lines.push('');
lines.push('## Required Checks');
lines.push('');
for (const item of checks.filter((entry) => entry.required)) {
  const status = item.found ? 'OK' : 'MISSING';
  lines.push(`- [${status}] \`${item.path}\``);
}
lines.push('');
lines.push('## Optional Checks');
lines.push('');
for (const item of checks.filter((entry) => !entry.required)) {
  const status = item.found ? 'OK' : 'NOT_PRESENT';
  lines.push(`- [${status}] \`${item.path}\``);
}
lines.push('');
lines.push('## Recommendation');
lines.push('');
if (overallStatus === 'READY_FULL_EXE') {
  lines.push('- The package is ready with versioned EXE artifacts.');
} else if (overallStatus === 'READY_WITH_FALLBACK') {
  lines.push('- The package is ready for defense using fallback desktop delivery (`win-unpacked` ZIP).');
  lines.push('- Re-run `npm run dist:win` after fixing Windows symlink permissions to add full EXE artifacts.');
} else {
  lines.push('- The package is not ready. Resolve missing required items first.');
}
lines.push('');
fs.writeFileSync(mdReportPath, `${lines.join('\n')}\n`, 'utf8');

console.log(`Readiness status: ${overallStatus}`);
console.log(`Wrote ${path.relative(rootDir, jsonReportPath)}`);
console.log(`Wrote ${path.relative(rootDir, mdReportPath)}`);
