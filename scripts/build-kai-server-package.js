const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { describeArtifact, describeFiles, sourceProvenance } = require('./lib/release-provenance');

const rootDir = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const version = packageJson.version;
const distDir = path.join(rootDir, 'dist');
const packageDir = path.join(distDir, `BizArena-KAI-Server-${version}`);
const zipPath = path.join(distDir, `BizArena-KAI-Server-${version}.zip`);
const manifestPath = path.join(distDir, `kai-server-release-manifest-${version}.json`);

const requiredFiles = [
  `dist/BizArena-VPS-${version}.zip`,
  `dist/vps-release-manifest-${version}.json`,
  'docs/kai-server-handoff.md',
  'docs/release-for-beginners.md',
  'docs/vps-cloud-classroom-runbook.md',
  'docs/teacher-cloud-classroom-handoff.md',
  'docs/teacher-classroom-handoff.md',
];

function assertFile(relativePath) {
  const filePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(filePath)) throw new Error(`Required file is missing: ${relativePath}`);
  return filePath;
}

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function copy(relativePath, targetName = relativePath) {
  const source = assertFile(relativePath);
  const target = path.join(packageDir, targetName);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function listFiles(dir) {
  const files = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(fullPath));
    else files.push(fullPath);
  });
  return files;
}

requiredFiles.forEach(assertFile);

fs.rmSync(packageDir, { recursive: true, force: true });
fs.mkdirSync(packageDir, { recursive: true });

copy(`dist/BizArena-VPS-${version}.zip`, `BizArena-VPS-${version}.zip`);
copy(`dist/vps-release-manifest-${version}.json`, `vps-release-manifest-${version}.json`);
copy('docs/kai-server-handoff.md', 'docs/kai-server-handoff.md');
copy('docs/release-for-beginners.md', 'docs/release-for-beginners.md');
copy('docs/vps-cloud-classroom-runbook.md', 'docs/vps-cloud-classroom-runbook.md');
copy('docs/teacher-cloud-classroom-handoff.md', 'docs/teacher-cloud-classroom-handoff.md');
copy('docs/teacher-classroom-handoff.md', 'docs/teacher-classroom-handoff.md');

const readme = `# Biz Arena KAI Server Package ${version}

This package is for deploying Biz Arena on a KAI server or ordinary VPS.

## Contents

- BizArena-VPS-${version}.zip - server deployment archive
- docs/release-for-beginners.md - beginner release and hosting guide
- docs/kai-server-handoff.md - admin handoff
- docs/vps-cloud-classroom-runbook.md - full VPS runbook
- docs/teacher-cloud-classroom-handoff.md - teacher instructions for cloud classroom
- docs/teacher-classroom-handoff.md - local classroom fallback

## Server Install

\`\`\`bash
unzip BizArena-VPS-${version}.zip
cd BizArena-VPS-${version}
sudo bash deploy/vps/install-vps.sh http://SERVER-IP
\`\`\`

## Health Checks

\`\`\`bash
curl -fsS http://SERVER-IP/api/health
curl -fsS http://SERVER-IP/api/meta
\`\`\`

## Backup and Logs

\`\`\`bash
sudo systemctl start bizarena-backup.service
sudo journalctl -u bizarena-backup -n 20 --no-pager
sudo journalctl -u bizarena -n 80 --no-pager
\`\`\`

After the first teacher account is created, lock registration:

\`\`\`bash
sudo sed -i 's/^BIZ_ARENA_ALLOW_REGISTRATION=.*/BIZ_ARENA_ALLOW_REGISTRATION=false/' /etc/bizarena/bizarena.env
sudo systemctl restart bizarena
\`\`\`
`;

fs.writeFileSync(path.join(packageDir, 'README-KAI-server.md'), readme, 'utf8');

const files = listFiles(packageDir);
const manifest = {
  project: 'Biz Arena',
  package: 'kai-server',
  version,
  generatedAt: new Date().toISOString(),
  packagePath: path.relative(rootDir, zipPath).replace(/\\/g, '/'),
  source: sourceProvenance(rootDir),
  files: describeFiles(files, packageDir, rootDir),
};

const compressCommand = [
  '$ErrorActionPreference = "Stop";',
  `Compress-Archive -Path ${psQuote(path.join(packageDir, '*'))} -DestinationPath ${psQuote(zipPath)} -Force;`,
].join(' ');

execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', compressCommand], { stdio: 'inherit' });
manifest.archive = describeArtifact(zipPath, rootDir);
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`Created ${path.relative(rootDir, zipPath)}`);
console.log(`Wrote ${path.relative(rootDir, manifestPath)}`);
