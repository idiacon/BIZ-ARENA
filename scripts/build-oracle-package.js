const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { describeArtifact, describeFiles, sourceProvenance } = require('./lib/release-provenance');

const rootDir = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const version = packageJson.version;
const distDir = path.join(rootDir, 'dist');
const packageDir = path.join(distDir, `BizArena-Oracle-${version}`);
const zipPath = path.join(distDir, `BizArena-Oracle-${version}.zip`);
const manifestPath = path.join(distDir, `oracle-release-manifest-${version}.json`);

const rootFiles = [
  'package.json',
  'package-lock.json',
  'server.js',
  'render.yaml',
];

const directories = [
  'public',
  'server',
  'deploy/oracle',
];

const scriptFiles = [
  'scripts/smoke-oracle-profile.js',
  'scripts/smoke-cloud-classroom.js',
];

const docFiles = [
  'docs/cloud-hosting-runbook.md',
  'docs/oracle-cloud-classroom-handoff.md',
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

const readme = `# Biz Arena Oracle ${version}

## What This Package Is

This package is the durable Oracle VM profile for Biz Arena Cloud Classroom. It runs the same Node.js server as Local Classroom, but uses cloud mode, WebSocket invalidation, and SQLite persistence on a durable VM filesystem.

Render files are included only as a demo reference. Oracle VM is the primary restart-safe target for this package.

## Required Environment

\`\`\`bash
NODE_ENV=production
PORT=3000
BIZ_ARENA_DEPLOYMENT=cloud
BIZ_ARENA_APP_MODE=server
BIZ_ARENA_STORAGE=sqlite
BIZ_ARENA_DATA_DIR=/var/lib/bizarena
BIZ_ARENA_SQLITE_PATH=/var/lib/bizarena/biz-arena.sqlite
BIZ_ARENA_PUBLIC_URL=https://YOUR-DOMAIN.example
BIZ_ARENA_ALLOW_REGISTRATION=true
\`\`\`

After the first teacher account is created, set:

\`\`\`bash
BIZ_ARENA_ALLOW_REGISTRATION=false
\`\`\`

## Included Deployment Templates

- \`deploy/oracle/.env.oracle.example\`
- \`deploy/oracle/bizarena.service\`
- \`deploy/oracle/nginx-bizarena.conf\`
- \`deploy/oracle/install-oracle-vm.sh\`
- \`deploy/oracle/README.md\`

## Oracle VM Setup Sketch

\`\`\`bash
sudo bash deploy/oracle/install-oracle-vm.sh https://YOUR-DOMAIN.example
\`\`\`

For an IP-only trial before DNS is connected:

\`\`\`bash
sudo bash deploy/oracle/install-oracle-vm.sh http://YOUR-PUBLIC-IP
\`\`\`

## Health Checks

\`\`\`bash
curl -fsS https://YOUR-DOMAIN.example/api/health
curl -fsS https://YOUR-DOMAIN.example/api/meta
\`\`\`

\`/api/meta\` must show \`deployment: "cloud"\`, \`storage.backend: "sqlite"\`, and no storage warning.

## Local Verification

\`\`\`powershell
npm ci
npm run check
npm test
set BIZ_ARENA_SMOKE_PROFILE=Oracle&& node scripts/smoke-oracle-profile.js
\`\`\`

## Fallback

If the public URL is down during class, run Local Classroom on the teacher PC and share the LAN \`/client\` link or QR from \`/server\`.
`;

fs.writeFileSync(path.join(packageDir, 'README-oracle.md'), readme, 'utf8');

const packagedFiles = listFiles(packageDir);
const manifest = {
  project: 'Biz Arena',
  package: 'oracle',
  version,
  generatedAt: new Date().toISOString(),
  packagePath: path.relative(rootDir, zipPath).replace(/\\/g, '/'),
  durableTarget: 'Oracle Always Free VM',
  source: sourceProvenance(rootDir),
  files: describeFiles(packagedFiles, packageDir, rootDir),
  commands: {
    start: 'BIZ_ARENA_DEPLOYMENT=cloud BIZ_ARENA_STORAGE=sqlite node server.js',
    smoke: 'BIZ_ARENA_SMOKE_PROFILE=Oracle node scripts/smoke-oracle-profile.js',
    health: 'curl -fsS https://YOUR-DOMAIN.example/api/health',
    meta: 'curl -fsS https://YOUR-DOMAIN.example/api/meta',
  },
  requiredEnv: [
    'BIZ_ARENA_DEPLOYMENT=cloud',
    'BIZ_ARENA_APP_MODE=server',
    'BIZ_ARENA_STORAGE=sqlite',
    'BIZ_ARENA_DATA_DIR=/var/lib/bizarena',
    'BIZ_ARENA_SQLITE_PATH=/var/lib/bizarena/biz-arena.sqlite',
    'BIZ_ARENA_PUBLIC_URL=https://YOUR-DOMAIN.example',
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
