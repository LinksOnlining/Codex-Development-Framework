# ADR 0003: Core 层采用白名单边界约束

- 日期：2026-08-23
- 状态：已采纳

## 背景

原有 `no-restricted-imports` 只列举部分越界路径，无法拦截 `./../` 等价路径；同时它不覆盖动态 `import()` 或未导入的全局对象。这样会让 `src/core/` 通过 ESLint 检查却访问外层模块、Node API 或运行时全局，不能兑现分层设计。

## 决定

对 `src/core/**/*.ts` 使用基于解析路径的白名单规则：模块引用解析后必须位于 `src/core` 根目录内，因此 `./sibling`、`./nested/helper` 以及子目录中的 `../sibling` 都允许，而任何越出 `src/core` 的路径都拒绝。裸包名和 `node:` 内置模块仍被拒绝，并额外拒绝动态 `import()`、TypeScript `TSImportType`、`process`、`fetch`、`globalThis`、`require`、`__dirname`、`__filename` 和 `console`。

架构回归测试通过 ESLint Node API 的 `lintText` 执行，验证违规写法被拒绝、core 同层及父目录 sibling 导入被允许、`TSImportType` 不得绕过边界、adapters 的进程 IO 不受影响。

## 备选方案

- 继续扩充目录黑名单：无法可靠覆盖路径等价写法和未来新增外层目录。
- 引入 import 依赖图插件：增加依赖与配置复杂度，当前规则只需保护静态边界和明确的全局 API。

## 影响

core 内部只能通过相对导入组合；若未来需要依赖外部能力，必须把接口放在内层并由 adapters 在外层实现，而不能直接绕过边界。该规则只作用于 `src/core/**/*.ts`，不会限制 adapters 或 cli。
