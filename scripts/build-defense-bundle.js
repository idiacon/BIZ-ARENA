const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const version = packageJson.version;
const bundleName = `Biz-Arena-v${version}-defense-bundle`;
const stagingRoot = path.join(distDir, 'defense-bundle');
const bundleRoot = path.join(stagingRoot, `Biz-Arena-v${version}`);
const zipPath = path.join(distDir, `${bundleName}.zip`);

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function resetDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyFileToBundle(relativePath, missingOptional = false) {
  const sourcePath = path.join(rootDir, relativePath);
  const targetPath = path.join(bundleRoot, relativePath);
  if (!fs.existsSync(sourcePath)) {
    if (missingOptional) {
      return false;
    }
    throw new Error(`Required file is missing: ${relativePath}`);
  }
  ensureDir(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
  return true;
}

function copyDirToBundle(relativePath, missingOptional = false) {
  const sourcePath = path.join(rootDir, relativePath);
  const targetPath = path.join(bundleRoot, relativePath);
  if (!fs.existsSync(sourcePath)) {
    if (missingOptional) {
      return false;
    }
    throw new Error(`Required directory is missing: ${relativePath}`);
  }
  ensureDir(path.dirname(targetPath));
  fs.cpSync(sourcePath, targetPath, { recursive: true });
  return true;
}

function listReleaseExeFiles() {
  if (!fs.existsSync(distDir)) {
    return [];
  }
  const allVersionExes = fs
    .readdirSync(distDir)
    .filter((name) => {
      const lower = name.toLowerCase();
      if (!lower.endsWith('.exe')) {
        return false;
      }
      return lower.includes(version);
    });
  const preferredExes = allVersionExes.filter((name) => /setup|portable/i.test(name));
  return (preferredExes.length ? preferredExes : allVersionExes)
    .map((name) => path.join('dist', name).replace(/\\/g, '/'));
}

resetDir(bundleRoot);

const requiredFiles = [
  'README.md',
  'docs/demo-script.md',
  'docs/teacher-defense-brief.md',
  'docs/teacher-demo-checklist.md',
  'docs/flash-drive-checklist.md',
  'docs/report-draft.md',
  'docs/final-report-checklist.md',
  'docs/championship-requirements-map.md',
  'docs/presentation-outline.md',
  'docs/presentation-asset-map.md',
  'docs/presentation-slide-text.md',
  'docs/screenshot-shotlist.md',
  'docs/defense-qa.md',
  'docs/v0.3-roadmap.md',
  'docs/v0.3-sprint-3-results.md',
  'docs/v0.3-sprint-4-defense-package.md',
  'docs/v0.3-sprint-5-report-presentation.md',
  'docs/v0.3-sprint-6-screenshots.md',
  'docs/v0.3-sprint-7-report-docx.md',
  'docs/v0.3-sprint-8-release-build.md',
  'docs/v0.3-sprint-9-defense-bundle.md',
  'docs/v0.3-sprint-10-readiness.md',
  'docs/logo-concepts.md',
  'docs/upgrade-backend-map.md',
  'docs/v0.4-transition-plan.md',
  'docs/superpowers/plans/2026-05-13-game-upgrade-pack.md',
];

for (const file of requiredFiles) {
  copyFileToBundle(file);
}

copyDirToBundle('defense-assets/screenshots');
copyFileToBundle('defense-assets/results/biz-arena-results-demo.json');
copyFileToBundle('defense-assets/report/Biz-Arena-report-draft.docx');

const optionalArtifacts = [
  `dist/Biz-Arena-${version}-win-unpacked.zip`,
  `dist/release-manifest-${version}.json`,
  `dist/pre-defense-readiness-v${version}.json`,
  `dist/pre-defense-readiness-v${version}.md`,
  'public/assets/logo-concepts.png',
  'public/assets/biz-arena-icon.png',
  'public/assets/biz-arena-favicon.png',
];
const presentOptionalArtifacts = [];
for (const artifact of optionalArtifacts) {
  if (copyFileToBundle(artifact, true)) {
    presentOptionalArtifacts.push(artifact.replace(/\\/g, '/'));
  }
}

const releaseExes = listReleaseExeFiles();
for (const artifact of releaseExes) {
  copyFileToBundle(artifact, true);
}

const bundleManifest = {
  project: 'Biz Arena',
  version,
  generatedAt: new Date().toISOString(),
  bundleName,
  zipPath: path.relative(rootDir, zipPath).replace(/\\/g, '/'),
  requiredFiles,
  includedReleaseExeArtifacts: releaseExes,
  includedOptionalArtifacts: presentOptionalArtifacts,
  notes: [
    'This bundle is intended for defense transfer to a flash drive.',
    'Use the Setup executable for installation and the Portable executable for a no-install demo.',
    'The win-unpacked ZIP is included as an additional fallback artifact.',
  ],
};

const manifestPath = path.join(bundleRoot, 'bundle-manifest.json');
fs.writeFileSync(manifestPath, `${JSON.stringify(bundleManifest, null, 2)}\n`, 'utf8');

const compressCommand = [
  '$ErrorActionPreference = "Stop";',
  `Compress-Archive -Path ${psQuote(bundleRoot)} -DestinationPath ${psQuote(zipPath)} -Force;`,
].join(' ');

execFileSync(
  'powershell.exe',
  ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', compressCommand],
  { stdio: 'inherit' }
);

console.log(`Created ${path.relative(rootDir, zipPath)}`);
console.log(`Staging root ${path.relative(rootDir, bundleRoot)}`);
