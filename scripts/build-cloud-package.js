const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { describeArtifact, describeFiles, sourceProvenance } = require('./lib/release-provenance');

const rootDir = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const version = packageJson.version;
const distDir = path.join(rootDir, 'dist');
const packageDir = path.join(distDir, `BizArena-Cloud-${version}`);
const zipPath = path.join(distDir, `BizArena-Cloud-${version}.zip`);
const manifestPath = path.join(distDir, `cloud-release-manifest-${version}.json`);

const rootFiles = [
  'package.json',
  'package-lock.json',
  'server.js',
  'render.yaml',
];

const directories = [
  'public',
  'server',
];

const scriptFiles = [
  'scripts/smoke-cloud-classroom.js',
];

const docFiles = [
  'docs/cloud-hosting-runbook.md',
  'docs/teacher-cloud-classroom-handoff.md',
  'docs/demo-script.md',
  'docs/teacher-classroom-handoff.md',
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
  return target;
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

const readme = `# Biz Arena Cloud ${version}

## What This Package Is

This is the web/cloud deployment package for Biz Arena ${version}. It runs the same Node.js server as Local Classroom, but with:

- teacher account registration/login;
- teacher-owned cloud rooms;
- public student links and room codes;
- WebSocket invalidation with HTTP fallback;
- JSON persistence by default, or SQLite with \`BIZ_ARENA_STORAGE=sqlite\`.

## Render Demo

1. Push this package to a Git repository or upload the project folder to Render.
2. Create a Web Service from \`render.yaml\`.
3. Keep these env vars:
   - \`BIZ_ARENA_DEPLOYMENT=cloud\`
   - \`BIZ_ARENA_APP_MODE=server\`
   - \`BIZ_ARENA_ALLOW_REGISTRATION=true\`
4. Set \`BIZ_ARENA_PUBLIC_URL\` to the public Render URL, for example \`https://biz-arena-cloud.onrender.com\`.
5. Open \`/server\`, register a teacher account, create a room, and share the generated student link or QR.
6. After the first teacher account exists, set \`BIZ_ARENA_ALLOW_REGISTRATION=false\` and redeploy/restart the service.

Render Free is for demo only. Free web services spin down when idle, and local filesystem changes can be lost on restart/redeploy/spin-down. Use \`BIZ_ARENA_DATA_DIR\` on a durable disk for restart-safe rooms.

## VPS/KAI Durable Mode

For a restart-safe classroom server, use a Linux VM and set:

\`\`\`bash
export BIZ_ARENA_DEPLOYMENT=cloud
export BIZ_ARENA_APP_MODE=server
export BIZ_ARENA_STORAGE=sqlite
export BIZ_ARENA_DATA_DIR=/var/lib/bizarena
export BIZ_ARENA_SQLITE_PATH=/var/lib/bizarena/biz-arena.sqlite
export BIZ_ARENA_PUBLIC_URL=https://your-domain.example
node server.js
\`\`\`

See \`docs/cloud-hosting-runbook.md\` for systemd, firewall, reverse proxy, and health checks.

## Verification

\`\`\`powershell
npm ci
npm run check
npm test
npm run smoke:cloud
npm run smoke:cloud:sqlite
\`\`\`
`;

fs.writeFileSync(path.join(packageDir, 'README-cloud.md'), readme, 'utf8');

const packagedFiles = listFiles(packageDir);
const manifest = {
  project: 'Biz Arena',
  package: 'cloud',
  version,
  generatedAt: new Date().toISOString(),
  packagePath: path.relative(rootDir, zipPath).replace(/\\/g, '/'),
  source: sourceProvenance(rootDir),
  files: describeFiles(packagedFiles, packageDir, rootDir),
  commands: {
    start: 'BIZ_ARENA_DEPLOYMENT=cloud node server.js',
    smoke: 'npm run smoke:cloud',
  },
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
