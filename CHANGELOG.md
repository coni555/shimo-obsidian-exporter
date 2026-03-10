# Changelog

## v1.0.0 - 2026-03-10

Initial release of the optimized Shimo exporter toolkit.

### Added

- Batch export from Shimo folders to Markdown with configurable export formats
- `SHIMO_COOKIE` environment-variable based authentication flow
- Incremental export controls such as retry, sleep, and `MaxItems`
- Import script for syncing a Shimo folder into Obsidian with title/content deduplication
- Navigation generator for Obsidian year/month directory structures
- Basic test coverage for config parsing, filename sanitization, and export type resolution

### Improved

- Safer Windows download fallback using PowerShell when Node TLS download fails
- More robust local file comparison based on `mtime`
- Clearer README and reusable scripts for repeated workflows

### Notes

- The tool depends on current Shimo web APIs and may need updates if Shimo changes authentication or export endpoints.
