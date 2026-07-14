const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const MOJIBAKE_MARKERS = [
  'Рџ',
  'РЎ',
  'Рќ',
  'Рґ',
  'Рё',
  'Рѕ',
  'СЃ',
  'С‚',
  'СЊ',
  'С‹',
  'Р Р',
  'вЂ',
  'в‚',
  'Ð',
  'Ñ',
  '????',
];

function assertReadableUtf8(relativePath) {
  const source = fs.readFileSync(relativePath, 'utf8');
  const offenders = MOJIBAKE_MARKERS.filter(marker => source.includes(marker));

  assert.deepEqual(offenders, [], `${relativePath} contains mojibake markers: ${offenders.join(', ')}`);
}

test('core localization and visible UI sources are readable UTF-8', () => {
  assertReadableUtf8('public/translations.js');
  assertReadableUtf8('public/app.js');

  const source = fs.readFileSync('public/translations.js', 'utf8');
  for (const text of ['Играть', 'Маркетинг', 'Обучение', 'Команда', 'Проверяем локальные адреса запуска']) {
    assert.ok(source.includes(text), `expected readable Russian text: ${text}`);
  }
});

test('release-facing teacher handoffs and package README template are readable UTF-8', () => {
  for (const relativePath of [
    'docs/teacher-classroom-handoff.md',
    'docs/teacher-cloud-classroom-handoff.md',
    'docs/kai-server-handoff.md',
    'docs/v0.9-pilot-readiness.md',
    'docs/teacher-demo-checklist.md',
    'docs/teacher-defense-brief.md',
    'docs/pilot-gate-runbook.md',
    'docs/pilot-evidence-schema.md',
    'docs/v1.0-pilot-validation.md',
    'scripts/build-classroom-package.js',
  ]) {
    assertReadableUtf8(relativePath);
  }

  const classroomPackageScript = fs.readFileSync('scripts/build-classroom-package.js', 'utf8');
  assert.match(classroomPackageScript, /Что запускать/);
  assert.match(classroomPackageScript, /README-classroom\.md/);
  assert.match(classroomPackageScript, /Публичный tunnel не считается рабочим вариантом/);
});
