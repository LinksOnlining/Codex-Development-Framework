# Changelog

## 0.2.0

### Added

- Added `executeApplication` as the primary domain execution API.
- Added the public types `ApplicationInput`, `ApplicationResult`, `AppConfig`, and `LogLevel`.

### Changed

- Connected the CLI runtime chain: `argv -> adapter -> config validation -> core -> ProcessIO`.
- Unified configuration types under `src/types`.
- Kept the core layer within a pure-function boundary.

### Deprecated

- Retained `identity` for compatibility, but marked it as deprecated.
- Consider removing `identity` in a future version.

### Not Public

The following implementation details are not part of the public API:

- `runCli`
- `ProcessIO`
- adapter sources
- `validateAppConfig`
- `ValidationResult`
- `ValidationError`

## 0.1.0

- Initial TypeScript library and CLI project skeleton.
