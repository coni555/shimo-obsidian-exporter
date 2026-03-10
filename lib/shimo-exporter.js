const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');
const axios = require('axios');
const fse = require('fs-extra');
const {
  buildLocalFileMap,
  getItemUpdatedAtMs,
  loadConfig,
  parseArgs,
  resolveExportType,
  sanitizeFileName,
} = require('./shimo-utils');

const SHIMO_API_BASE = 'https://shimo.im/lizard-api/files';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const execFileAsync = promisify(execFile);

async function runCli(argv = process.argv.slice(2)) {
  const { configPath } = parseArgs(argv);
  const config = loadConfig(configPath);

  console.log(`Using config: ${configPath}`);

  const localFileMap = buildLocalFileMap(config.Path);
  await exportFolder({
    folderId: config.Folder,
    outputDir: config.Path,
    config,
    localFileMap,
    state: { exportedCount: 0 },
  });
}

async function exportFolder({ folderId = '', outputDir, config, localFileMap, state }) {
  const response = await axios.get(SHIMO_API_BASE, {
    params: folderId ? { collaboratorCount: 'true', folder: folderId } : { collaboratorCount: 'true' },
    headers: createListHeaders(config.Cookie, folderId),
    timeout: 30000,
  });

  for (const item of response.data) {
    if (config.MaxItems > 0 && state.exportedCount >= config.MaxItems) {
      return;
    }

    const updatedAtMs = getItemUpdatedAtMs(item);

    if (updatedAtMs <= config.Lasttime) {
      continue;
    }

    if (isFolder(item)) {
      if (config.Recursive) {
        await exportFolder({
          folderId: item.guid,
          outputDir: path.join(outputDir, sanitizeFileName(item.name)),
          config,
          localFileMap,
          state,
        });
      }
      continue;
    }

    const exportType = resolveExportType(item, config.ExportFormats);
    if (!exportType) {
      console.error(`[Skip] Unsupported type: ${item.type} (${item.name})`);
      continue;
    }

    const fileName = `${sanitizeFileName(item.name)}.${exportType}`;
    const localFilePath = path.resolve(path.join(outputDir, fileName));
    const localModifiedAt = localFileMap.get(localFilePath) || 0;

    if (localModifiedAt >= updatedAtMs) {
      console.log(`[Skip] ${localFilePath}`);
      continue;
    }

    await sleep(config.Sleep);

    let succeeded = false;
    for (let attempt = 0; attempt <= config.Retry; attempt += 1) {
      if (attempt > 0) {
        console.error(`[Retry ${attempt}] ${item.name}`);
        await sleep(config.Sleep * 2);
      }

      const result = await exportItem({
        item,
        outputDir,
        exportType,
        cookie: config.Cookie,
      });

      if (result === 0) {
        localFileMap.set(localFilePath, updatedAtMs);
        succeeded = true;
        state.exportedCount += 1;
        console.log(`[Done] ${localFilePath}`);
        break;
      }
    }

    if (!succeeded) {
      console.error(`[Error] Failed to export: ${item.name}`);
    }
  }
}

async function exportItem({ item, outputDir, exportType, cookie }) {
  try {
    const fileName = `${sanitizeFileName(item.name)}.${exportType}`;
    const downloadUrl = await getDownloadUrl({ item, exportType, cookie });

    if (!downloadUrl) {
      return 2;
    }

    await fse.ensureDir(outputDir);
    await downloadToFile({
      url: downloadUrl,
      outputPath: path.join(outputDir, fileName),
      headers: createFileHeaders(cookie),
    });
    return 0;
  } catch (error) {
    console.error(`[Error] ${item.name} failed: ${error.message}`);
    return 3;
  }
}

async function getDownloadUrl({ item, exportType, cookie }) {
  if (item.type === exportType) {
    return `${SHIMO_API_BASE}/${item.guid}/download`;
  }

  const response = await axios.get(`${SHIMO_API_BASE}/${item.guid}/export`, {
    params: {
      type: exportType,
      file: item.guid,
      returnJson: '1',
      name: sanitizeFileName(item.name),
      isAsync: '0',
    },
    headers: createFileHeaders(cookie),
    timeout: 30000,
  });

  return response.data.redirectUrl || response.data?.data?.downloadUrl || '';
}

function createListHeaders(cookie, folderId) {
  return {
    Cookie: cookie,
    Referer: folderId ? `https://shimo.im/folder/${folderId}` : 'https://shimo.im/desktop',
  };
}

function createFileHeaders(cookie) {
  return {
    Cookie: cookie,
    Referer: 'https://shimo.im/desktop',
  };
}

function isFolder(item) {
  return item.is_folder === 1 || item.is_folder === true;
}

async function downloadToFile({ url, outputPath, headers }) {
  try {
    const response = await axios.get(url, {
      headers,
      responseType: 'stream',
      timeout: 120000,
      maxRedirects: 5,
    });

    await fse.ensureDir(path.dirname(outputPath));

    await new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(outputPath);
      response.data.pipe(writer);

      writer.on('finish', resolve);
      writer.on('error', reject);
      response.data.on('error', reject);
    });
  } catch (error) {
    if (process.platform !== 'win32') {
      throw error;
    }

    console.warn(`[Warn] Axios download failed, falling back to PowerShell: ${error.message}`);
    await downloadToFileWithPowerShell({ url, outputPath });
  }
}

async function downloadToFileWithPowerShell({ url, outputPath }) {
  await fse.ensureDir(path.dirname(outputPath));

  const escapedUrl = url.replace(/'/g, "''");
  const escapedOutputPath = outputPath.replace(/'/g, "''");
  const script = [
    `$url = '${escapedUrl}'`,
    `$output = '${escapedOutputPath}'`,
    "Invoke-WebRequest -Uri $url -OutFile $output",
  ].join('; ');

  await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], {
    windowsHide: true,
  });
}

module.exports = {
  downloadToFile,
  exportFolder,
  exportItem,
  getDownloadUrl,
  runCli,
};
