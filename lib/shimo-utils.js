const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');

const DEFAULT_EXPORT_FORMATS = Object.freeze({
  document: 'md',
  sheet: 'xlsx',
  slide: 'pptx',
  mindmap: 'xmind',
});

const BINARY_TYPES = new Set(['docx', 'doc', 'pptx', 'ppt', 'pdf']);
const DOCUMENT_TYPES = new Set(['newdoc', 'document', 'modoc']);
const SHEET_TYPES = new Set(['sheet', 'mosheet', 'spreadsheet', 'table']);
const SLIDE_TYPES = new Set(['slide', 'presentation']);
const MINDMAP_TYPES = new Set(['mindmap']);

function parseArgs(argv = []) {
  let configPath = 'config.json';

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if ((arg === '-c' || arg === '--config') && argv[index + 1]) {
      configPath = argv[index + 1];
      index += 1;
      continue;
    }

    if (!arg.startsWith('-')) {
      configPath = arg;
    }
  }

  return { configPath };
}

function loadConfig(configPath) {
  const raw = fs.readFileSync(configPath, 'utf8');
  const parsed = JSON.parse(raw);
  const envCookie = process.env.SHIMO_COOKIE || '';
  const exportFormats = Object.assign(
    {},
    DEFAULT_EXPORT_FORMATS,
    parsed.ExportFormats || {},
  );

  if (parsed.DocumentFormat) {
    exportFormats.document = parsed.DocumentFormat;
  }

  const normalized = {
    Cookie: envCookie || parsed.Cookie || '',
    Path: parsed.Path || '',
    Folder: parsed.Folder || '',
    Recursive: parsed.Recursive !== false,
    Sleep: Number.isFinite(parsed.Sleep) ? parsed.Sleep : 500,
    Lasttime: Number.isFinite(parsed.Lasttime) ? parsed.Lasttime : 0,
    Retry: Number.isFinite(parsed.Retry) ? parsed.Retry : 3,
    MaxItems: Number.isFinite(parsed.MaxItems) ? parsed.MaxItems : 0,
    ExportFormats: exportFormats,
  };

  if (!normalized.Cookie) {
    throw new Error('Missing Cookie. Set SHIMO_COOKIE or fill config field "Cookie".');
  }

  if (!normalized.Path) {
    throw new Error('Config field "Path" is required.');
  }

  normalized.Path = path.resolve(normalized.Path);

  return normalized;
}

function sanitizeFileName(fileName) {
  const safeName = String(fileName)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();

  return safeName || 'untitled';
}

function getItemCategory(itemType) {
  if (BINARY_TYPES.has(itemType)) {
    return 'binary';
  }

  if (DOCUMENT_TYPES.has(itemType)) {
    return 'document';
  }

  if (SHEET_TYPES.has(itemType)) {
    return 'sheet';
  }

  if (SLIDE_TYPES.has(itemType)) {
    return 'slide';
  }

  if (MINDMAP_TYPES.has(itemType)) {
    return 'mindmap';
  }

  return '';
}

function resolveExportType(item, exportFormats = DEFAULT_EXPORT_FORMATS) {
  const category = getItemCategory(item.type);

  if (!category) {
    return '';
  }

  if (category === 'binary') {
    return item.type;
  }

  return exportFormats[category] || '';
}

function getItemUpdatedAtMs(item) {
  const value = item.updatedAt || item.updated_at || item.modifiedAt || item.modified_at;
  const timestamp = value ? new Date(value).getTime() : 0;

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function buildLocalFileMap(dirPath) {
  const fileMap = new Map();

  const walk = (currentDir) => {
    fse.ensureDirSync(currentDir);
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.')) {
        continue;
      }

      const fullPath = path.resolve(path.join(currentDir, entry.name));

      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      const stat = fs.statSync(fullPath);
      fileMap.set(fullPath, stat.mtimeMs);
    }
  };

  walk(path.resolve(dirPath));

  return fileMap;
}

module.exports = {
  DEFAULT_EXPORT_FORMATS,
  buildLocalFileMap,
  getItemCategory,
  getItemUpdatedAtMs,
  loadConfig,
  parseArgs,
  resolveExportType,
  sanitizeFileName,
};
