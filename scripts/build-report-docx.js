const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'docs', 'report-draft.md');
const OUTPUT_DIR = path.join(ROOT, 'defense-assets', 'report');
const OUTPUT_DOCX = path.join(OUTPUT_DIR, 'Biz-Arena-report-draft.docx');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripInlineMarkdown(value) {
  return String(value)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1 ($2)')
    .replace(/ {2,}$/g, '');
}

function paragraph(text, style = 'Normal') {
  const styleTag = style === 'Normal' ? '' : `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>`;
  return `<w:p>${styleTag}<w:r><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`;
}

function codeParagraph(text) {
  return `<w:p><w:pPr><w:pStyle w:val="Code"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`;
}

function parseMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const nodes = [];
  let inCode = false;
  let paragraphBuffer = [];

  function flushParagraph() {
    if (!paragraphBuffer.length) return;
    nodes.push(paragraph(stripInlineMarkdown(paragraphBuffer.join(' '))));
    paragraphBuffer = [];
  }

  lines.forEach(line => {
    if (line.startsWith('```')) {
      flushParagraph();
      inCode = !inCode;
      return;
    }

    if (inCode) {
      nodes.push(codeParagraph(line));
      return;
    }

    if (!line.trim()) {
      flushParagraph();
      return;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      const style = level === 1 ? 'Title' : level === 2 ? 'Heading1' : 'Heading2';
      nodes.push(paragraph(stripInlineMarkdown(heading[2]), style));
      return;
    }

    const bullet = line.match(/^\s*-\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      nodes.push(paragraph(`• ${stripInlineMarkdown(bullet[1])}`, 'ListParagraph'));
      return;
    }

    const numbered = line.match(/^\s*(\d+)\.\s+(.+)$/);
    if (numbered) {
      flushParagraph();
      nodes.push(paragraph(`${numbered[1]}. ${stripInlineMarkdown(numbered[2])}`, 'ListParagraph'));
      return;
    }

    paragraphBuffer.push(line.trim());
  });

  flushParagraph();
  return nodes.join('\n');
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;
}

function packageRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function documentRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="28"/><w:lang w:val="ru-RU"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/><w:spacing w:after="320"/></w:pPr><w:rPr><w:b/><w:sz w:val="36"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="Heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="280" w:after="160"/><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="Heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="200" w:after="120"/><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph">
    <w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Code">
    <w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="80"/><w:ind w:left="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="20"/></w:rPr>
  </w:style>
</w:styles>`;
}

function documentXml(bodyXml) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
${bodyXml}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

function coreXml() {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Разработка учебного бизнес-симулятора Biz Arena</dc:title>
  <dc:creator>Надров Дамир Ильнурович</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;
}

function appXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Biz Arena report builder</Application>
</Properties>`;
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}

function buildDocx() {
  ensureDir(OUTPUT_DIR);
  const markdown = fs.readFileSync(SOURCE, 'utf8');
  const staging = fs.mkdtempSync(path.join(fs.realpathSync(osTmpDir()), 'biz-arena-docx-'));
  const zipPath = `${OUTPUT_DOCX}.zip`;

  try {
    writeFile(path.join(staging, '[Content_Types].xml'), contentTypesXml());
    writeFile(path.join(staging, '_rels', '.rels'), packageRelsXml());
    writeFile(path.join(staging, 'word', '_rels', 'document.xml.rels'), documentRelsXml());
    writeFile(path.join(staging, 'word', 'styles.xml'), stylesXml());
    writeFile(path.join(staging, 'word', 'document.xml'), documentXml(parseMarkdown(markdown)));
    writeFile(path.join(staging, 'docProps', 'core.xml'), coreXml());
    writeFile(path.join(staging, 'docProps', 'app.xml'), appXml());

    fs.rmSync(zipPath, { force: true });
    fs.rmSync(OUTPUT_DOCX, { force: true });
    execFileSync('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      `Compress-Archive -Path '${staging}\\*' -DestinationPath '${zipPath}' -Force`,
    ], { stdio: 'inherit' });
    fs.renameSync(zipPath, OUTPUT_DOCX);
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }

  console.log(`built ${OUTPUT_DOCX}`);
}

function osTmpDir() {
  return process.env.TEMP || process.env.TMP || ROOT;
}

buildDocx();
