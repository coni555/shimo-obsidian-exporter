const fs = require('fs');
const path = require('path');

const OBSIDIAN_ROOT = process.env.OBSIDIAN_ROOT || 'D:/Obsidian';
const OBSIDIAN_NAV_ROOT = process.env.OBSIDIAN_NAV_ROOT || '';
const ROOT_DIR_PATTERN = new RegExp(
  process.env.OBSIDIAN_NAV_PATTERN || '6-.*\\u5fc3\\u6d41',
);
const FILE_YEAR_OVERVIEW = '\u603b\u89c8';
const FILE_MONTH_INDEX = '\u76ee\u5f55';
const FILE_ROOT_OVERVIEW = `00-${FILE_YEAR_OVERVIEW}.md`;
const FILE_TIMELINE = '00-\u65f6\u95f4\u7d22\u5f15.md';
const FILE_OLD_YEAR = '00-\u5e74\u4efd\u603b\u89c8.md';
const FILE_OLD_MONTH = '00-\u6708\u4efd\u76ee\u5f55.md';

function findNavigationRoot() {
  if (OBSIDIAN_NAV_ROOT) {
    if (!fs.existsSync(OBSIDIAN_NAV_ROOT)) {
      throw new Error(`Configured OBSIDIAN_NAV_ROOT does not exist: ${OBSIDIAN_NAV_ROOT}`);
    }

    return OBSIDIAN_NAV_ROOT;
  }

  const queue = [OBSIDIAN_ROOT];

  while (queue.length > 0) {
    const current = queue.shift();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const fullPath = path.join(current, entry.name);
      if (ROOT_DIR_PATTERN.test(entry.name)) {
        return fullPath;
      }

      queue.push(fullPath);
    }
  }

  throw new Error(
    'Could not find the target note directory in Obsidian. Set OBSIDIAN_NAV_ROOT or adjust OBSIDIAN_NAV_PATTERN.',
  );
}

function getDayNumber(fileName) {
  const match = path.basename(fileName, '.md').match(/^\d{1,2}\.(\d{1,2})/);
  return match ? Number(match[1]) : 999;
}

function getDateLabel(yearName, displayName) {
  const match = displayName.match(/^(\d{1,2})\.(\d{1,2})/);
  if (!match) {
    return displayName;
  }

  return `${yearName}-${String(Number(match[1])).padStart(2, '0')}-${String(
    Number(match[2]),
  ).padStart(2, '0')}`;
}

function listDirectories(dirPath) {
  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(dirPath, entry.name))
    .sort();
}

function listNoteFiles(monthDir, monthOverviewName) {
  return fs
    .readdirSync(monthDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.endsWith('.md'))
    .filter((name) => name !== monthOverviewName)
    .filter((name) => name !== FILE_ROOT_OVERVIEW)
    .filter((name) => name !== FILE_TIMELINE)
    .filter((name) => !name.startsWith('00-'))
    .filter((name) => !name.endsWith(`-${FILE_MONTH_INDEX}.md`))
    .sort((left, right) => {
      const dayDiff = getDayNumber(left) - getDayNumber(right);
      return dayDiff !== 0 ? dayDiff : left.localeCompare(right, 'zh-CN');
    });
}

function writeUtf8(filePath, lines) {
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function removeIfExists(filePath) {
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { force: true });
  }
}

function generateNavigation() {
  const root = findNavigationRoot();
  const rootName = path.basename(root);
  const yearDirs = listDirectories(root);
  let totalNoteCount = 0;

  const rootOverview = [
    `# ${rootName} ${FILE_YEAR_OVERVIEW}`,
    '',
    `> \u66f4\u65b0\u65f6\u95f4\uff1a${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    '',
    '## \u5feb\u901f\u5165\u53e3',
    '',
    `- [[${path.basename(FILE_TIMELINE, '.md')}|\u6309\u65f6\u95f4\u987a\u5e8f\u7d22\u5f15]]`,
    '',
  ];

  const timeline = [
    '# \u65f6\u95f4\u7d22\u5f15',
    '',
    '\u6309\u65f6\u95f4\u6b63\u5e8f\u6392\u5217\uff0c\u65b9\u4fbf\u987a\u7740\u65f6\u95f4\u7ebf\u56de\u770b\u6574\u4e2a\u76ee\u5f55\u4e0b\u7684\u7b14\u8bb0\u3002',
    '',
  ];

  for (const yearDir of yearDirs) {
    const yearName = path.basename(yearDir);
    const yearOverviewStem = `${yearName}-${FILE_YEAR_OVERVIEW}`;
    const yearOverviewPath = path.join(yearDir, `${yearOverviewStem}.md`);
    removeIfExists(path.join(yearDir, FILE_OLD_YEAR));

    const monthDirs = listDirectories(yearDir);
    let yearNoteCount = 0;
    const yearOverview = [
      `# ${yearName} \u5e74\u5ea6\u603b\u89c8`,
      '',
      `[[../${path.basename(FILE_ROOT_OVERVIEW, '.md')}|\u8fd4\u56de\u603b\u89c8]]`,
      '',
      '## \u6708\u4efd\u5bfc\u822a',
      '',
    ];

    timeline.push(`## ${yearName}`, '');

    for (const monthDir of monthDirs) {
      const monthName = path.basename(monthDir);
      const monthOverviewStem = `${monthName}-${FILE_MONTH_INDEX}`;
      const monthOverviewPath = path.join(monthDir, `${monthOverviewStem}.md`);
      removeIfExists(path.join(monthDir, FILE_OLD_MONTH));

      const noteFiles = listNoteFiles(monthDir, `${monthOverviewStem}.md`);
      const monthCount = noteFiles.length;
      yearNoteCount += monthCount;
      totalNoteCount += monthCount;

      const monthOverview = [
        `# ${yearName}\u5e74 ${monthName} \u76ee\u5f55`,
        '',
        `[[../${yearOverviewStem}|\u8fd4\u56de ${yearName} \u5e74\u603b\u89c8]]`,
        '',
        `\u672c\u6587\u6863\u5171 ${monthCount} \u7bc7\u3002`,
        '',
        '## \u6309\u65e5\u671f\u6d4f\u89c8',
        '',
      ];

      timeline.push(`### ${monthName}`, '');

      for (const fileName of noteFiles) {
        const displayName = path.basename(fileName, '.md');
        const dateLabel = getDateLabel(yearName, displayName);
        const linkPath = `${yearName}/${monthName}/${displayName}`;

        monthOverview.push(`- [[${displayName}|${dateLabel}]]`);
        timeline.push(`- ${dateLabel} [[${linkPath}|${displayName}]]`);
      }

      monthOverview.push(
        '',
        '## \u8fd4\u56de\u5bfc\u822a',
        '',
        `- [[../${yearOverviewStem}|\u8fd4\u56de\u5e74\u4efd\u603b\u89c8]]`,
        `- [[../../${path.basename(FILE_ROOT_OVERVIEW, '.md')}|\u8fd4\u56de\u603b\u89c8]]`,
      );

      writeUtf8(monthOverviewPath, monthOverview);
      yearOverview.push(`- [[./${monthName}/${monthOverviewStem}|${monthName}]] (${monthCount} \u7bc7)`);
    }

    timeline.push('');
    yearOverview.push(
      '',
      '## \u7edf\u8ba1',
      '',
      `- \u5e74\u4efd\uff1a${yearName}`,
      `- \u6708\u4efd\u6570\uff1a${monthDirs.length}`,
      `- \u6587\u6863\u6570\uff1a${yearNoteCount}`,
    );

    writeUtf8(yearOverviewPath, yearOverview);
    rootOverview.push(`- [[./${yearName}/${yearOverviewStem}|${yearName} \u5e74]] (${yearNoteCount} \u7bc7)`);
  }

  rootOverview.push(
    '',
    '## \u7edf\u8ba1',
    '',
    `- \u5e74\u4efd\u6570\uff1a${yearDirs.length}`,
    `- \u603b\u6587\u6863\u6570\uff1a${totalNoteCount}`,
  );

  writeUtf8(path.join(root, FILE_ROOT_OVERVIEW), rootOverview);
  writeUtf8(path.join(root, FILE_TIMELINE), timeline);
}

generateNavigation();
