const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const {
  DEFAULT_EXPORT_FORMATS,
  buildLocalFileMap,
  getItemUpdatedAtMs,
  loadConfig,
  parseArgs,
  resolveExportType,
  sanitizeFileName,
} = require('../lib/shimo-utils');

test('parseArgs supports -c and positional config path', () => {
  assert.deepEqual(parseArgs(['-c', 'custom.json']), { configPath: 'custom.json' });
  assert.deepEqual(parseArgs(['custom.json']), { configPath: 'custom.json' });
  assert.deepEqual(parseArgs([]), { configPath: 'config.json' });
});

test('sanitizeFileName removes invalid windows characters', () => {
  assert.equal(sanitizeFileName('a<b>:c?.md'), 'a_b__c_.md');
  assert.equal(sanitizeFileName('   '), 'untitled');
});

test('resolveExportType uses configured document export type', () => {
  assert.equal(
    resolveExportType({ type: 'document' }, { ...DEFAULT_EXPORT_FORMATS, document: 'docx' }),
    'docx',
  );
  assert.equal(resolveExportType({ type: 'sheet' }, DEFAULT_EXPORT_FORMATS), 'xlsx');
  assert.equal(resolveExportType({ type: 'pdf' }, DEFAULT_EXPORT_FORMATS), 'pdf');
  assert.equal(resolveExportType({ type: 'unknown' }, DEFAULT_EXPORT_FORMATS), '');
});

test('getItemUpdatedAtMs supports both updatedAt and updated_at', () => {
  assert.equal(getItemUpdatedAtMs({ updatedAt: '2026-03-08T10:00:00Z' }), 1772964000000);
  assert.equal(getItemUpdatedAtMs({ updated_at: '2026-03-08T10:00:00Z' }), 1772964000000);
});

test('loadConfig normalizes defaults and export formats', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shimo-config-'));
  const configPath = path.join(tempDir, 'config.json');

  fs.writeFileSync(
    configPath,
    JSON.stringify({
      Cookie: 'sid=1',
      Path: './exports',
      DocumentFormat: 'pdf',
    }),
  );

  const config = loadConfig(configPath);
  assert.equal(config.Cookie, 'sid=1');
  assert.equal(config.ExportFormats.document, 'pdf');
  assert.equal(config.ExportFormats.sheet, 'xlsx');
  assert.equal(path.isAbsolute(config.Path), true);
  assert.equal(config.MaxItems, 0);
});

test('loadConfig prefers SHIMO_COOKIE over file config', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shimo-config-env-'));
  const configPath = path.join(tempDir, 'config.json');

  fs.writeFileSync(
    configPath,
    JSON.stringify({
      Cookie: 'sid=file',
      Path: './exports',
    }),
  );

  process.env.SHIMO_COOKIE = 'sid=env';
  const config = loadConfig(configPath);
  assert.equal(config.Cookie, 'sid=env');
  delete process.env.SHIMO_COOKIE;
});

test('buildLocalFileMap returns nested files keyed by absolute path', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shimo-files-'));
  const nestedDir = path.join(tempDir, 'nested');
  fs.mkdirSync(nestedDir);
  const filePath = path.join(nestedDir, 'note.md');
  fs.writeFileSync(filePath, '# note');

  const fileMap = buildLocalFileMap(tempDir);
  assert.equal(fileMap.has(path.resolve(filePath)), true);
});
