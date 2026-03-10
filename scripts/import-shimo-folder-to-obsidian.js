const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

const SHIMO_API_BASE = 'https://shimo.im/lizard-api/files';
const SHIMO_COOKIE = process.env.SHIMO_COOKIE || '';
const TARGET_FOLDER_ID = process.env.SHIMO_FOLDER_ID || '';
const TARGET_DIR = process.env.OBSIDIAN_TARGET_DIR || '';
const TEMP_DIR = process.env.SHIMO_TEMP_DIR || path.resolve('temp-import');

if (!SHIMO_COOKIE) {
  throw new Error('Missing SHIMO_COOKIE.');
}

if (!TARGET_FOLDER_ID) {
  throw new Error('Missing SHIMO_FOLDER_ID.');
}

if (!TARGET_DIR) {
  throw new Error('Missing OBSIDIAN_TARGET_DIR.');
}

function sanitizeFileName(fileName) {
  const safeName = String(fileName)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();

  return safeName || 'untitled';
}

function normalizeTitle(title) {
  return String(title)
    .replace(/\.md$/i, '')
    .replace(/\u672a\u547d\u540d/g, '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .toLowerCase();
}

function normalizeContent(content) {
  return String(content)
    .normalize('NFKC')
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
}

function hashContent(content) {
  return crypto.createHash('sha256').update(normalizeContent(content), 'utf8').digest('hex');
}

function createHeaders(folderId = '') {
  return {
    Cookie: SHIMO_COOKIE,
    Referer: folderId ? `https://shimo.im/folder/${folderId}` : 'https://shimo.im/desktop',
  };
}

async function getFolderItems(folderId) {
  const response = await axios.get(SHIMO_API_BASE, {
    params: { collaboratorCount: 'true', folder: folderId },
    headers: createHeaders(folderId),
    timeout: 30000,
  });

  return response.data || [];
}

async function getDownloadUrl(item) {
  const response = await axios.get(`${SHIMO_API_BASE}/${item.guid}/export`, {
    params: {
      type: 'md',
      file: item.guid,
      returnJson: '1',
      name: sanitizeFileName(item.name),
      isAsync: '0',
    },
    headers: createHeaders(),
    timeout: 30000,
  });

  return response.data.redirectUrl || response.data?.data?.downloadUrl || '';
}

async function downloadMarkdown(item) {
  const downloadUrl = await getDownloadUrl(item);
  if (!downloadUrl) {
    throw new Error(`No download URL for ${item.name}`);
  }

  try {
    const response = await axios.get(downloadUrl, {
      headers: createHeaders(),
      responseType: 'arraybuffer',
      timeout: 120000,
      maxRedirects: 5,
    });

    return Buffer.from(response.data).toString('utf8');
  } catch (error) {
    const tempFilePath = path.join(TEMP_DIR, `${sanitizeFileName(item.name)}.md`);
    fs.mkdirSync(TEMP_DIR, { recursive: true });

    const escapedUrl = downloadUrl.replace(/'/g, "''");
    const escapedPath = tempFilePath.replace(/'/g, "''");
    const { execFileSync } = require('child_process');

    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `$url = '${escapedUrl}'; $output = '${escapedPath}'; Invoke-WebRequest -Uri $url -OutFile $output`,
      ],
      { stdio: 'ignore', windowsHide: true },
    );

    return fs.readFileSync(tempFilePath, 'utf8');
  }
}

function buildExistingIndexes(targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });

  const entries = fs
    .readdirSync(targetDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'));

  const titleMap = new Map();
  const contentMap = new Map();

  for (const entry of entries) {
    const fullPath = path.join(targetDir, entry.name);
    const content = fs.readFileSync(fullPath, 'utf8');
    titleMap.set(normalizeTitle(entry.name), entry.name);
    contentMap.set(hashContent(content), entry.name);
  }

  return { titleMap, contentMap };
}

async function main() {
  const items = (await getFolderItems(TARGET_FOLDER_ID)).filter(
    (item) => item.is_folder !== 1 && item.is_folder !== true,
  );
  const { titleMap, contentMap } = buildExistingIndexes(TARGET_DIR);
  const results = {
    total: items.length,
    imported: [],
    skippedByTitle: [],
    skippedByContent: [],
  };

  for (const item of items) {
    const safeName = `${sanitizeFileName(item.name)}.md`;
    const normalizedTitle = normalizeTitle(item.name);

    if (titleMap.has(normalizedTitle)) {
      results.skippedByTitle.push({ shimo: item.name, existing: titleMap.get(normalizedTitle) });
      continue;
    }

    const markdown = await downloadMarkdown(item);
    const contentHash = hashContent(markdown);

    if (contentMap.has(contentHash)) {
      results.skippedByContent.push({ shimo: item.name, existing: contentMap.get(contentHash) });
      continue;
    }

    const destination = path.join(TARGET_DIR, safeName);
    fs.writeFileSync(destination, markdown, 'utf8');
    titleMap.set(normalizedTitle, safeName);
    contentMap.set(contentHash, safeName);
    results.imported.push(safeName);
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
