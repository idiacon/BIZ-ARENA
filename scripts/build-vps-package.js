const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { describeArtifact, describeFiles, sourceProvenance } = require('./lib/release-provenance');

const rootDir = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const version = packageJson.version;
const distDir = path.join(rootDir, 'dist');
const packageDir = path.join(distDir, `BizArena-VPS-${version}`);
const zipPath = path.join(distDir, `BizArena-VPS-${version}.zip`);
const manifestPath = path.join(distDir, `vps-release-manifest-${version}.json`);

const rootFiles = ['package.json', 'package-lock.json', 'server.js'];
const directories = ['public', 'server', 'deploy/vps'];
const scriptFiles = ['scripts/admin-storage.js', 'scripts/smoke-vps-profile.js', 'scripts/smoke-durable-cloud-profile.js', 'scripts/smoke-cloud-classroom.js'];
const docFiles = [
  'docs/vps-cloud-classroom-runbook.md',
  'docs/cloud-hosting-runbook.md',
  'docs/teacher-cloud-classroom-handoff.md',
];

function assertFile(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Required file is missing: ${filePath}`);
}

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function copyFile(relativePath) {
  const source = path.join(rootDir, relativePath);
  const target = path.join(packageDir, relativePath);
  assertFile(source);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function copyDir(relativePath) {
  const source = path.join(rootDir, relativePath);
  const target = path.join(packageDir, relativePath);
  assertFile(source);
  fs.cpSync(source, target, {
    recursive: true,
    filter: sourcePath => {
      const normalized = sourcePath.replace(/\\/g, '/');
      return !/\/(?:node_modules|data|dist)\//.test(normalized);
    },
  });
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

fs.rmSync(packageDir, { recursive: true, force: true });
fs.mkdirSync(packageDir, { recursive: true });

rootFiles.forEach(copyFile);
directories.forEach(copyDir);
scriptFiles.forEach(copyFile);
docFiles.forEach(copyFile);

const readme = `# Biz Arena VPS ${version}

This package is the generic VPS profile for Biz Arena Cloud Classroom. Use it when Oracle Cloud is unavailable or when a paid VPS is simpler.

## Install

\`\`\`bash
sudo bash deploy/vps/install-vps.sh http://YOUR-PUBLIC-IP
\`\`\`

After DNS is connected:

\`\`\`bash
sudo bash deploy/vps/install-vps.sh https://YOUR-DOMAIN.example
\`\`\`

## Lock Teacher Registration

\`\`\`bash
sudo sed -i 's/^BIZ_ARENA_ALLOW_REGISTRATION=.*/BIZ_ARENA_ALLOW_REGISTRATION=false/' /etc/bizarena/bizarena.env
sudo systemctl restart bizarena
\`\`\`

## Health Checks

\`\`\`bash
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS http://YOUR-PUBLIC-IP/api/health
curl -fsS http://YOUR-PUBLIC-IP/api/meta
\`\`\`

See \`docs/vps-cloud-classroom-runbook.md\` for the full runbook.
`;

fs.writeFileSync(path.join(packageDir, 'README-vps.md'), readme, 'utf8');

const packagedFiles = listFiles(packageDir);
const manifest = {
  project: 'Biz Arena',
  package: 'vps',
  version,
  generatedAt: new Date().toISOString(),
  packagePath: path.relative(rootDir, zipPath).replace(/\\/g, '/'),
  durableTarget: 'Generic VPS',
  source: sourceProvenance(rootDir),
  files: describeFiles(packagedFiles, packageDir, rootDir),
  commands: {
    install: 'sudo bash deploy/vps/install-vps.sh http://YOUR-PUBLIC-IP',
    health: 'curl -fsS http://YOUR-PUBLIC-IP/api/health',
    meta: 'curl -fsS http://YOUR-PUBLIC-IP/api/meta',
  },
  requiredEnv: [
    'BIZ_ARENA_DEPLOYMENT=cloud',
    'BIZ_ARENA_APP_MODE=server',
    'BIZ_ARENA_STORAGE=sqlite',
    'BIZ_ARENA_DATA_DIR=/var/lib/bizarena',
    'BIZ_ARENA_SQLITE_PATH=/var/lib/bizarena/biz-arena.sqlite',
    'BIZ_ARENA_PUBLIC_URL=http://YOUR-PUBLIC-IP',
    'BIZ_ARENA_ALLOW_REGISTRATION=false',
  ],
};

const compressCommand = [
  '$ErrorActionPreference = "Stop";',
  `Compress-Archive -Path ${psQuote(path.join(packageDir, '*'))} -DestinationPath ${psQuote(zipPath)} -Force;`,
].join(' ');

execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', compressCommand], { stdio: 'inherit' });
assertFile(zipPath);
manifest.archive = describeArtifact(zipPath, rootDir);
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`Created ${path.relative(rootDir, zipPath)}`);
console.log(`Wrote ${path.relative(rootDir, manifestPath)}`);
