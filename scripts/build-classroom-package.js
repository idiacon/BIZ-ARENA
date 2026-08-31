const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { describeArtifact, describeFiles, sourceProvenance } = require('./lib/release-provenance');

const rootDir = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const version = packageJson.version;
const distDir = path.join(rootDir, 'dist');
const packageDir = path.join(distDir, `BizArena-Classroom-${version}`);
const toolsDir = path.join(packageDir, 'tools');
const beginnerGuideSource = path.join(rootDir, 'docs', 'release-for-beginners.md');
const beginnerGuideTarget = path.join(packageDir, 'release-for-beginners.md');
const pilotRunbookSource = path.join(rootDir, 'docs', 'pilot-gate-runbook.md');
const pilotRunbookTarget = path.join(packageDir, 'PILOT-GATE.md');
const pilotRunbookLinkTarget = path.join(packageDir, 'pilot-gate-runbook.md');
const pilotSchemaSource = path.join(rootDir, 'docs', 'pilot-evidence-schema.md');
const pilotSchemaTarget = path.join(packageDir, 'pilot-evidence-schema.md');
const pilotTemplateSource = path.join(rootDir, 'docs', 'pilot-evidence-template.json');
const pilotTemplateTarget = path.join(packageDir, 'pilot-evidence-template.json');
const zipPath = path.join(distDir, `BizArena-Classroom-${version}.zip`);
const manifestPath = path.join(distDir, `classroom-release-manifest-${version}.json`);

const artifacts = [
  `BizArena-Server-${version}-Setup-x64.exe`,
  `BizArena-Server-${version}-Portable-x64.exe`,
  `BizArena-Client-${version}-Setup-x64.exe`,
  `BizArena-Client-${version}-Portable-x64.exe`,
];

const helperFiles = [
  'Allow-BizArena-Firewall.ps1',
  'Allow-BizArena-Firewall.bat',
  'Check-BizArena-LAN.ps1',
  'Check-BizArena-LAN.bat',
];

function assertFile(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Required artifact is missing: ${filePath}`);
}

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function copyRequired(source, target) {
  assertFile(source);
  fs.copyFileSync(source, target);
}

fs.rmSync(packageDir, { recursive: true, force: true });
fs.mkdirSync(packageDir, { recursive: true });
fs.mkdirSync(toolsDir, { recursive: true });

for (const artifact of artifacts) {
  copyRequired(path.join(distDir, artifact), path.join(packageDir, artifact));
}

for (const helper of helperFiles) {
  copyRequired(path.join(rootDir, 'tools', helper), path.join(toolsDir, helper));
}

copyRequired(pilotRunbookSource, pilotRunbookTarget);
copyRequired(pilotRunbookSource, pilotRunbookLinkTarget);
copyRequired(pilotSchemaSource, pilotSchemaTarget);
copyRequired(pilotTemplateSource, pilotTemplateTarget);
copyRequired(beginnerGuideSource, beginnerGuideTarget);

const readme = `# Biz Arena Classroom ${version}

## Pilot Gate files

- [release-for-beginners.md](release-for-beginners.md) - с чего начать без опыта работы с серверами.
- [PILOT-GATE.md](PILOT-GATE.md) - normative operator runbook.
- [pilot-evidence-schema.md](pilot-evidence-schema.md) - strict manual-evidence allowlist.
- [pilot-evidence-template.json](pilot-evidence-template.json) - device and classroom attestation template.

Before anyone creates or joins a room, assign pseudonyms S1-S7 and neutral
company aliases A-G. Never enter real participant names into the pilot room.

## Что запускать

1. На компьютере преподавателя запустите \`BizArena Server\`.
2. В Server создайте комнату и покажите ученикам:
   - код комнаты;
   - LAN-ссылку вида \`http://192.168.x.x:3000/client\`;
   - QR-код из Network Doctor для страницы \`/client\`.
3. На компьютерах учеников запустите \`BizArena Client\`.
4. В Client введите адрес сервера, код комнаты, псевдоним S1-S7 и нейтральный alias компании A-G.

## Файлы внутри

- \`BizArena-Server-${version}-Setup-x64.exe\` - установщик сервера преподавателя.
- \`BizArena-Server-${version}-Portable-x64.exe\` - portable сервер без установки.
- \`BizArena-Client-${version}-Setup-x64.exe\` - установщик клиента ученика.
- \`BizArena-Client-${version}-Portable-x64.exe\` - portable клиент без установки.
- \`tools/Allow-BizArena-Firewall.bat\` - открыть Windows Firewall для Biz Arena.
- \`tools/Check-BizArena-LAN.bat\` - проверить сервер с ученического компьютера.
- \`PILOT-GATE.md\` - нормативная процедура проверки сборки и наблюдаемого занятия.

## Быстрая проверка перед занятием

На компьютере преподавателя:

\`\`\`powershell
npm run smoke:classroom
\`\`\`

Smoke-проверка подтверждает, что:

- \`/api/health\` возвращает \`{ ok: true }\`;
- \`/server\` и \`/client\` доступны;
- неверный \`sessionToken\` блокируется статусом \`403\`;
- верный \`sessionToken\` принимает действие игрока.

## Если ученики не подключаются по IP

1. Убедитесь, что \`BizArena Server\` запущен.
2. На компьютере преподавателя откройте \`tools/Allow-BizArena-Firewall.bat\` от имени администратора.
3. На компьютере ученика запустите \`tools/Check-BizArena-LAN.bat\` и введите адрес сервера, например \`192.168.0.10:3000\`.
4. В браузере ученика проверьте \`http://IP_ПРЕПОДАВАТЕЛЯ:3000/api/health\`. Должен вернуться JSON с \`ok: true\`.
5. Если health работает на компьютере преподавателя, но не работает у ученика, вероятно Wi-Fi включает client isolation. В таком случае подключите класс к отдельному роутеру/точке доступа или проведите localhost-demo на одном ПК.

## Если пишет, что игрок уже в игре

В \`BizArena Client\` измените псевдоним игрока. Одинаковый псевдоним считается повторным входом того же игрока. Если ученик возвращается в свою старую компанию, он должен использовать тот же псевдоним и тот же нейтральный alias компании.

## LAN-first правила

- LAN быстрее и лучше подходит для одной аудитории, если сеть разрешает подключения между компьютерами.
- Публичный tunnel не считается рабочим вариантом для текущего classroom release.
- Если вузовская сеть блокирует прямые IP-подключения, используйте отдельную сеть для занятия.

## Pilot Gate для ответственного за release

До передачи пакета преподавателю запустите Pilot Gate из исходного репозитория:

\`\`\`powershell
$id = (npm run --silent pilot:create | ConvertFrom-Json).runId
\`\`\`

Дальнейший порядок receipts, device preflight и classroom evidence находится в
\`PILOT-GATE.md\`. Эти npm-команды выполняются из исходного репозитория, а не из
этой папки с готовыми EXE.
`;

fs.writeFileSync(path.join(packageDir, 'README-classroom.md'), readme, 'utf8');

const packagedFiles = [
  ...artifacts.map(name => path.join(packageDir, name)),
  path.join(packageDir, 'README-classroom.md'),
  beginnerGuideTarget,
  pilotRunbookTarget,
  pilotRunbookLinkTarget,
  pilotSchemaTarget,
  pilotTemplateTarget,
  ...helperFiles.map(name => path.join(toolsDir, name)),
];

const manifest = {
  project: 'Biz Arena',
  version,
  generatedAt: new Date().toISOString(),
  packagePath: path.relative(rootDir, zipPath).replace(/\\/g, '/'),
  source: sourceProvenance(rootDir),
  files: describeFiles(packagedFiles, packageDir, rootDir),
  testCommand: 'npm run smoke:classroom',
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
