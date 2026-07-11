const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { describeArtifact, sourceProvenance } = require('./lib/release-provenance');

const rootDir = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const version = packageJson.version;
const distDir = path.join(rootDir, 'dist');
const unpackedDir = path.join(distDir, 'win-unpacked');
const exePath = path.join(unpackedDir, 'Biz Arena.exe');
const zipPath = path.join(distDir, `Biz-Arena-${version}-win-unpacked.zip`);
const manifestPath = path.join(distDir, `release-manifest-${version}.json`);
const setupPath = path.join(distDir, `Biz-Arena-${version}-Setup-x64.exe`);
const portablePath = path.join(distDir, `Biz-Arena-${version}-Portable-x64.exe`);

function assertFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} was not found: ${filePath}`);
  }
}

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

assertFile(unpackedDir, 'Windows unpacked build directory');
assertFile(exePath, 'Windows unpacked executable');

const compressCommand = [
  '$ErrorActionPreference = "Stop";',
  `Compress-Archive -Path ${psQuote(unpackedDir)} -DestinationPath ${psQuote(zipPath)} -Force;`,
].join(' ');

execFileSync(
  'powershell.exe',
  ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', compressCommand],
  { stdio: 'inherit' }
);

assertFile(zipPath, 'Windows unpacked ZIP');

const manifest = {
  project: 'Biz Arena',
  version,
  generatedAt: new Date().toISOString(),
  releaseMode: fs.existsSync(setupPath) && fs.existsSync(portablePath)
    ? 'windows-installer-portable-and-unpacked-zip'
    : 'unpacked-zip',
  setupPath: fs.existsSync(setupPath) ? path.relative(rootDir, setupPath).replace(/\\/g, '/') : null,
  portablePath: fs.existsSync(portablePath) ? path.relative(rootDir, portablePath).replace(/\\/g, '/') : null,
  zipPath: path.relative(rootDir, zipPath).replace(/\\/g, '/'),
  unpackedPath: path.relative(rootDir, unpackedDir).replace(/\\/g, '/'),
  executablePath: path.relative(rootDir, exePath).replace(/\\/g, '/'),
  source: sourceProvenance(rootDir),
  archive: describeArtifact(zipPath, rootDir),
  buildCommand: 'npm run dist:win',
  packagingNote: fs.existsSync(setupPath) && fs.existsSync(portablePath)
    ? 'Installer and portable Windows builds are available. The ZIP is included as an additional unpacked fallback.'
    : 'Installer or portable build is absent. Use the ZIP as a fallback unpacked build.',
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`Created ${path.relative(rootDir, zipPath)}`);
console.log(`Wrote ${path.relative(rootDir, manifestPath)}`);
