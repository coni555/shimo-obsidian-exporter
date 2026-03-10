# 石墨文档批量导出

这个工具通过石墨网页接口批量导出你有权限访问的文件，适合做一次性迁移或备份。

支持的默认导出格式：

- 文档：`md`
- 表格：`xlsx`
- 幻灯片：`pptx`
- 思维导图：`xmind`
- 原生二进制文件：`doc` `docx` `ppt` `pptx` `pdf`

## 改进点

- 文档导出格式不再写死在代码里，可在 `config.json` 里配置。
- 支持 `-c` / `--config` 指定配置文件，也兼容直接传入配置文件路径。
- 本地文件比较改为基于 `mtime`，避免已有文件被重复下载。
- 跳过旧文件时不再提前退出，避免接口返回顺序变化时漏导。
- 增加了基础测试，方便快速验证参数解析和格式映射。

## 使用方式

1. 复制示例配置：

```powershell
Copy-Item config.example.json config.json
```

2. 登录石墨网页版，打开开发者工具，复制请求里的 `Cookie`。

3. 编辑 `config.json`，至少填这几个字段：

- `Path`
- `Folder`（可选）
- `MaxItems`（建议第一次先设成 `1` 或 `3` 做小范围验证）
- `ExportFormats.document`（如果你想导出 `docx` 或 `pdf`，这里改掉）

`Cookie` 推荐不要写进文件。这个项目现在会优先读取环境变量 `SHIMO_COOKIE`，只有环境变量不存在时才回退到 `config.json` 里的 `Cookie`。

4. 安装依赖：

```powershell
npm install
```

5. 运行导出：

```powershell
node index.js
```

更安全的 Windows PowerShell 用法：

```powershell
$env:SHIMO_COOKIE='这里填你的石墨 Cookie'
node index.js
```

导出完成后可清掉当前终端里的环境变量：

```powershell
Remove-Item Env:SHIMO_COOKIE
```

指定其他配置文件：

```powershell
node index.js -c config-work.json
```

或：

```powershell
node index.js config-work.json
```

## 配置示例

```json
{
  "Cookie": "xxx",
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

## 说明

- 这个项目依赖石墨当前网页接口，接口或鉴权变化后可能需要重新适配。
- `Cookie` 请只保存在本地，不要提交到仓库；优先使用环境变量 `SHIMO_COOKIE`。
