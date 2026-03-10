# shimo-obsidian-exporter

把石墨文档批量导出为 Markdown，并按需导入 Obsidian。

> 把这个 GitHub 项目接入小龙虾、Codex 或 Claude Code，跟着流程一步步走，就能实现自动化执行。

## 致谢与来源

这个仓库基于原项目 [yangkghjh/shimo](https://github.com/yangkghjh/shimo) 的思路继续改编和优化，不是对原仓库的原样搬运。

当前仓库额外补充了这些偏本地工作流的能力：

- 更安全的本地登录态使用方式
- 更稳的 Windows 下载兜底
- 导入 Obsidian 时的标题/内容去重
- 面向归档型目录结构的导航页生成
- 更适合重复使用的脚本、README、CHANGELOG 和 release 结构

更完整的出处说明见：

- [ATTRIBUTION.md](./ATTRIBUTION.md)

这个仓库目前包含三类能力：

- 批量导出石墨文件夹内容
- 把石墨文件夹导入到指定 Obsidian 目录，并做基础去重
- 为按年份 / 月份归档的 Obsidian Markdown 目录生成导航页和时间索引页

## 适用场景

- 想把石墨文档迁移到 Obsidian
- 想把日记、反思、输出类文档批量导出为 Markdown
- 已经有一部分内容在 Obsidian，想继续增量导入并去重

## 环境要求

- Windows
- Node.js 18+
- 已登录石墨网页版，并能获取当前登录态 `Cookie`

## 安装

```powershell
npm install
```

## 获取石墨 Cookie

推荐在浏览器里登录石墨网页版后，再从开发者工具里复制当前请求的 `Cookie`。

步骤：

1. 打开 [https://shimo.im](https://shimo.im) 并确认你已经登录
2. 按 `F12` 打开开发者工具
3. 切到 `Network` / `网络`
4. 点击 `Fetch/XHR`
5. 刷新页面
6. 点开任意一个发往 `shimo.im` 的请求
7. 在 `Headers` / `标头` 中找到 `Cookie`
8. 复制整串 `Cookie` 值

示例：

```text
shimo_sid=xxx; deviceId=xxx; ...
```

推荐只在当前终端里临时设置：

```powershell
$env:SHIMO_COOKIE='这里填整串 Cookie'
```

用完后清掉：

```powershell
Remove-Item Env:SHIMO_COOKIE
```

## 1. 批量导出石墨文件夹

先复制配置文件：

```powershell
Copy-Item config.example.json config.json
```

推荐用环境变量传 `Cookie`，不要把登录态写进文件：

```powershell
$env:SHIMO_COOKIE='这里填石墨 Cookie'
```

然后编辑 `config.json`，至少配置这些字段：

- `Path`：导出目录
- `Folder`：石墨文件夹 ID
- `Recursive`：是否递归导出子文件夹
- `MaxItems`：首次验证建议先设成 `1` 或 `3`
- `ExportFormats.document`：文档导出格式，默认 `md`

运行：

```powershell
node index.js
```

指定其他配置文件：

```powershell
node index.js -c config.local.json
```

## 2. 导入到 Obsidian 并去重

脚本：

- `scripts/import-shimo-folder-to-obsidian.js`

这个脚本会：

- 读取指定石墨文件夹
- 导出为 Markdown
- 扫描目标 Obsidian 目录现有 Markdown
- 先按标题归一化去重
- 再按正文内容哈希去重
- 只导入新增文件

所需环境变量：

- `SHIMO_COOKIE`
- `SHIMO_FOLDER_ID`
- `OBSIDIAN_TARGET_DIR`
- `SHIMO_TEMP_DIR` 可选

示例：

```powershell
$env:SHIMO_COOKIE='这里填石墨 Cookie'
$env:SHIMO_FOLDER_ID='这里填石墨文件夹 ID'
$env:OBSIDIAN_TARGET_DIR='D:\Obsidian\YourVault\Reflections'
npm run obsidian:import
```

## 3. 生成 Obsidian 导航页

脚本：

- `scripts/generate-obsidian-nav.js`

这个脚本会在类似这样的目录结构上生成导航页：

- 一级目录：某个笔记归档根目录
- 二级目录：年份
- 三级目录：月份
- 四级目录：具体 Markdown

会生成：

- 根目录总览页
- 根目录时间索引页
- 每个年份的总览页
- 每个月份的目录页

可选环境变量：

- `OBSIDIAN_NAV_ROOT`：直接指定要生成导航页的目标目录，最推荐
- `OBSIDIAN_ROOT`：默认是 `D:/Obsidian`
- `OBSIDIAN_NAV_PATTERN`：当你不想手动指定目标目录时，用目录名正则参与自动匹配

运行：

```powershell
npm run nav:generate
```

或者：

```powershell
$env:OBSIDIAN_NAV_ROOT='D:\Obsidian\YourVault\Journal'
node scripts/generate-obsidian-nav.js
```

## 配置示例

```json
{
  "Cookie": "",
  "Path": "F:/shimoExport/Export",
  "Folder": "",
  "Recursive": true,
  "Sleep": 500,
  "Lasttime": 0,
  "Retry": 3,
  "MaxItems": 0,
  "ExportFormats": {
    "document": "md",
    "sheet": "xlsx",
    "slide": "pptx",
    "mindmap": "xmind"
  }
}
```

## 测试

```powershell
npm test
```

## 注意事项

- 这个工具依赖石墨当前网页接口，石墨接口或鉴权变化后可能需要重新适配。
- 请只在本地保存 `Cookie`，不要提交到仓库。
- 仓库默认忽略了 `output`、`temp-import`、`node_modules` 等本地临时文件。

## 当前包含的核心文件

- `index.js`：导出入口
- `lib/shimo-exporter.js`：导出核心逻辑
- `lib/shimo-utils.js`：配置解析、文件名处理、类型映射
- `scripts/import-shimo-folder-to-obsidian.js`：导入 Obsidian 并去重
- `scripts/generate-obsidian-nav.js`：生成导航页
- `test/shimo-utils.test.js`：基础测试
