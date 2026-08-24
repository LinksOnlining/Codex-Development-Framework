# TestProject 设计文档

本文档说明 TestProject 的定位、技术选型、目录结构、分层约束和关键技术决策。
使用方式和脚本清单见 [README.md](./README.md)，本文档只讲**为什么这样设计**。

- 状态：已采纳
- 日期：2026-08-23
- 适用范围：`Projects/TestProject` 全部代码与文档

---

## 1. 项目定位

TestProject 是**工程模板验证项目**，不承载具体业务。

它存在的目的是把一套工程规范真实跑通一遍，验证其可行性，之后沉淀为 `Templates/typescript-cli`，供后续项目复用。

三项验证目标：

### 1.1 验证工程模板

构建、类型检查、代码检查、格式化、测试、发布这条链路是否完整、是否可一条命令执行、是否能在干净环境重现。判定标准：新克隆的仓库执行 `npm ci && npm run verify` 一次通过。

### 1.2 验证分层架构

`core / adapters / cli` 三层划分是否清晰、依赖方向是否能靠工具自动约束、越界 import 是否会被拦下。判定标准：在 `core` 中写一条指向 `adapters` 的 import，`npm run lint` 必须报错。

该边界由 ESLint 白名单规则执行：`src/core/` 只能使用 core 内部相对导入，或仅用于类型契约的 `src/types/` 导入。Node 内置模块、第三方包、config/adapters/cli、上层目录、动态 `import()`、受限全局对象和 `console` 均必须被拦截。

### 1.3 验证测试链路

单元测试与集成测试是否都能跑、CLI 端到端行为是否可断言、覆盖率是否可采集。判定标准：`npm test` 全绿，`npm run test:coverage` 能输出 `src/core/` 的覆盖率数字。

### 1.4 不在范围内

- 具体业务功能。`core` 只包含最小的纯领域执行逻辑；`identity` placeholder 仅作为兼容 API 保留。
- CI 配置。等骨架稳定后单独一轮。
- 任何生产依赖。

---

## 2. 技术选型

生产依赖目标为 **0**，开发依赖控制在 5 个。选型原则遵循工作区 `CLAUDE.md` 的「避免无意义依赖」：Node 内置能解决的，不引入外部包。

| 关注点   | 选择                                     | 理由                                                       |
| -------- | ---------------------------------------- | ---------------------------------------------------------- |
| 运行时   | Node.js >= 24                            | 环境已安装 v24.19.0，原生支持 ESM、`node:test`、内置覆盖率 |
| 语言     | TypeScript 5.x，`strict: true`           | 类型是长期维护的主要抗腐蚀手段；重构时能定位受影响范围     |
| 模块格式 | ESM（`"type": "module"`）                | Node 24 原生支持，不需要 CJS/ESM 双构建                    |
| 包管理   | npm                                      | 环境已安装 v11.17.0，不引入未安装的 pnpm                   |
| 构建     | `tsc` 直出                               | 库 + CLI 两种形态都不需要打包器                            |
| 测试     | `node:test` + 内置覆盖率                 | 零依赖，详见第 7 节决策记录                                |
| 参数解析 | `node:util` 的 `parseArgs`               | 零依赖，满足 CLI 需求                                      |
| 代码检查 | ESLint 9 flat config + typescript-eslint | 事实标准；且承担依赖方向的自动化约束                       |
| 格式化   | Prettier                                 | 消除格式讨论成本                                           |
| 配置校验 | 手写校验函数                             | schema 复杂到手写吃力时再考虑 zod，不提前引入              |

ESLint 在本项目里不只是风格检查工具，它是第 4 节依赖规则的执行点，属于架构基础设施。

版本策略：`.npmrc` 设 `save-exact=true`，所有依赖锁定精确版本，避免自动升级造成不可复现的构建。

---

## 3. 目录结构

```
TestProject/
├── README.md               使用说明、脚本清单
├── DESIGN.md               本文档
├── CHANGELOG.md            版本变更记录
├── LICENSE
├── package.json
├── package-lock.json
├── tsconfig.json           基础配置，供编辑器与其他配置继承
├── tsconfig.build.json     构建专用，排除测试文件
├── eslint.config.js        ESLint flat config，含依赖方向约束
├── .prettierrc.json
├── .editorconfig
├── .gitignore
├── .npmrc                  save-exact=true
│
├── src/
│   ├── index.ts            库入口，唯一的公开 API 出口
│   ├── types/              共享纯类型契约，无运行时依赖
│   ├── core/               纯领域执行逻辑，无 IO，无第三方依赖
│   ├── adapters/           外部输入与输出的边界转换层
│   ├── cli/                命令行入口：参数解析、输出格式化、退出码
│   └── config/             配置类型定义与校验函数
│
├── tests/
│   ├── unit/               镜像 src/core 与 src/config，无 IO
│   ├── integration/        CLI 端到端，含真实 IO
│   └── fixtures/           测试数据
│
├── docs/
│   ├── design/             模块划分、数据流、接口设计
│   ├── decisions/          ADR，一个决策一个文件
│   └── api/                对外接口契约
│
├── scripts/                构建与发布辅助脚本
└── config/                 配置模板，不含任何真实值或密钥
```

### 各层职责

| 目录            | 职责                                                                       | 禁止                                    |
| --------------- | -------------------------------------------------------------------------- | --------------------------------------- |
| `src/types/`    | 共享纯类型契约                                                             | 运行时依赖、IO、业务逻辑                |
| `src/core/`     | 纯领域执行逻辑。接收数据、返回结果                                         | IO；import config/adapters/cli/第三方包 |
| `src/adapters/` | 外部输入输出的边界转换：config source、application input source、ProcessIO | 配置校验、业务判断                      |
| `src/cli/`      | 解析入参 → 编排 adapter/config/core → 格式化输出 → 映射退出码              | 业务判断、直接构造已校验配置            |
| `src/config/`   | 定义配置约束、填充默认值、提供 `validateAppConfig`                         | IO、CLI 逻辑、调用 core                 |
| `src/index.ts`  | re-export 稳定的库公开 API                                                 | 导出 CLI、adapters、validator           |

`src/types/` 只放 `AppConfig` 与 `LogLevel` 等共享纯类型契约。`core` 与 `config` 都可以依赖它，但二者互不依赖。`src/config/` 只负责配置约束、默认值填充和 `validateAppConfig`，采用严格未知字段模式：类型定义之外的键一律失败，并一次聚合全部错误。读取和来源转换由 `adapters` 完成，再把原始对象交给 `config` 校验。

`src/adapters/` 是边界转换层，当前包含 CLI 配置来源、application input 来源和 `ProcessIO`。未来可扩展文件、环境变量或网络来源，但 adapter 不负责配置合法性校验或领域计算。

`tests/unit/` 的目录结构镜像 `src/core/`：`src/core/x.ts` 对应 `tests/unit/core/x.test.ts`。找测试不需要搜索。

`docs/` 只放项目自身的文档，跟代码同一次提交、同一个分支，避免文档与实现漂移。跨项目的规范和调研放工作区级的 `Documents/`。

---

## 4. 模块依赖规则

这是本项目最核心的约束。

### 依赖方向单向朝内

```text
cli
 ├──► adapters ───► unknown external input / ProcessIO
 ├──► config ─────► validated AppConfig
 └──► core ───────► pure ApplicationResult

core   ───► types
config ───► types
```

允许外层依赖内层，禁止内层依赖外层。

### core 的硬性限制

`src/core/` 只允许 import 同一 `core` 层级内的相对模块，或仅用于类型契约的 `src/types/` 模块（例如 `../types/app-config.js`）。以下内容全部禁止：

- `../adapters`、`../cli`、`../config`、`../index` 或其他任何上层路径（`src/types/` 纯类型契约除外）
- `./../` 等等价路径逃逸
- 任何第三方包或 `node:` 内置模块（`node:fs`、`node:http`、`node:process` 等）
- `import type` 形式的越界导入
- 动态 `import()`
- `process`、`fetch`、`globalThis`、`require`、`__dirname`、`__filename`
- `console`

这是默认拒绝的白名单约束，而不是针对已知目录的黑名单；新增外层目录不会绕过规则。`src/types/` 只允许作为纯类型依赖，不能引入运行时模块。规则只应用于 `src/core/**/*.ts`，不会限制 `adapters` 或 `cli` 使用其所需的 IO API。

### 为什么这条规则值得用工具强制

依赖倒置的价值在于**更换外层实现时内层不动**：换 CLI 库、换 HTTP 客户端、换存储方案，`core` 一行不改。但这个约束靠人工评审维持不住 —— 只要有一次图省事在 `core` 里 `import fs`，分层就从架构退化成目录命名习惯。

所以 `eslint.config.js` 中针对 `src/core/**` 配置 `no-restricted-imports`、`no-restricted-syntax`、`no-restricted-globals` 与 `no-console`，把越界 import、动态导入和全局对象访问变成检查失败；共享 `src/types/` 仅作为类型契约例外。规则本身是架构文档的可执行版本，`tests/architecture/core-boundaries.test.ts` 用 ESLint Node API 对这些规则做回归验证。

### 附带收益

`core` 无 IO 意味着单元测试不需要 mock 框架、不需要启动外部服务、不需要临时文件。测试跑得快，也就不会有人因为"测试太慢"而跳过它。

---

## 5. CLI 退出码规范

| 退出码 | 含义     | 典型场景                                     |
| ------ | -------- | -------------------------------------------- |
| `0`    | 成功     | 命令正常完成                                 |
| `1`    | 普通错误 | 运行时失败：文件不存在、网络失败、校验不通过 |
| `2`    | 参数错误 | 未知选项、缺少必填参数、参数值非法、用法错误 |

区分 1 和 2 的意义：调用方（脚本、CI）能判断该重试还是该修命令。退出码 2 表示"这样调用永远不会成功"，重试无意义。

### 输出流约定

| 流     | 内容                         |
| ------ | ---------------------------- |
| stdout | 仅程序结果，保证可被管道消费 |
| stderr | 错误、警告、诊断信息         |

`--help` 和 `--version` 属于正常完成，输出到 stdout，退出码 0。参数错误时的用法提示输出到 stderr，退出码 2。

### 标准选项

所有命令支持 `--help`、`--version`、`--json`。`--json` 输出机器可读格式，便于脚本消费。

错误信息说明发生了什么以及下一步能做什么，不向用户抛堆栈。堆栈只在诊断模式下输出到 stderr。

---

## 6. 测试策略

| 类型     | 位置                 | 特征                                                                  |
| -------- | -------------------- | --------------------------------------------------------------------- |
| 单元测试 | `tests/unit/`        | 无 IO，毫秒级，覆盖 `core` 与 `config` 的边界与异常输入               |
| 集成测试 | `tests/integration/` | 用 `node:child_process` 执行构建后的 CLI，断言 stdout/stderr 与退出码 |

测试文件命名 `*.test.ts`。集成测试产生的临时文件用完即删。

覆盖率参考线：`src/core/` 与 `src/config/` 不低于 90%，整体不低于 80%。这是评审参考值，不作为构建门禁 —— 覆盖率高不代表测试有效，把它变成门禁只会催生断言空洞的测试。

---

## 7. 技术决策记录

### 7.1 为什么选择 node:test

**背景**：项目需要一个测试运行器，同时要满足「生产依赖为 0、开发依赖最小」的约束。

**决定**：使用 Node.js 内置的 `node:test` 配合内置覆盖率（`--experimental-test-coverage`）。

理由：

1. **零依赖**。不增加任何开发依赖，也就不存在版本升级、安全公告、配置文件这三类长期维护成本。
2. **与运行时同生命周期**。测试运行器随 Node 一起升级，不会出现测试框架与运行时版本不匹配的问题。
3. **能力足够**。本项目需要的是 `describe` / `it` / `assert` / 子进程断言，`node:test` 全部覆盖。集成测试用 `node:child_process` 起 CLI，不依赖框架特性。
4. **符合验证目标**。项目本身要验证「模板是否精简可复用」，测试层引入重型依赖与这个目标相悖。

**影响**：没有 watch 模式（需要时用 `node --watch` 或外部工具补），没有内置快照测试，报告格式选项少于第三方框架。这些在当前范围内都不是阻碍。

### 7.2 为什么暂不使用 Vitest

**背景**：Vitest 是 TypeScript 项目的主流选择，开发体验优于 `node:test`。

**决定**：暂不采用。

落选原因：

1. **当前无对应需求**。Vitest 的主要优势是 watch 模式、快照测试、丰富的 mock API、浏览器环境支持。本项目 `core` 层无 IO、不需要 mock；无 UI，不需要快照；测试量小，全量跑比 watch 更省心。为尚不存在的需求付依赖成本，属于过度设计。
2. **依赖体量**。Vitest 会带入 Vite 及其传递依赖，是本项目最重的一项开发依赖，与「模板精简」的定位冲突。
3. **迁移成本低**。`node:test` 与 Vitest 的 API 形态接近（`describe` / `it` / 断言），迁移主要是改 import 和加配置，测试文件的目录结构与命名不需要变动。因此「先用内置、需要时再换」的成本明显低于「先引入重依赖、后来发现用不上」。

**何时应当重新评估**：

- 需要 watch 模式支撑高频 TDD
- 出现 UI 或复杂输出，需要快照测试
- 需要浏览器或多环境测试
- 需要 `node:test` 无法覆盖的 mock 能力

满足任一条即在 `docs/decisions/` 新增一份 ADR 记录变更，不要直接改本节 —— 保留原始决策和当时的理由，比替换它更有价值。

### 7.3 其他已定选项

| 决策     | 选择     | 落选方案及原因                                                          |
| -------- | -------- | ----------------------------------------------------------------------- |
| 包管理   | npm      | pnpm 更快且节省磁盘，但环境未安装，会给模板增加前置条件                 |
| 构建     | `tsc`    | tsdown / esbuild 更快，但库 + CLI 无需打包；将来发浏览器产物时再评估    |
| 配置校验 | 手写函数 | zod 类型推导好，但当前 schema 简单，不值一个生产依赖                    |
| 模块格式 | 纯 ESM   | 双格式构建能兼容旧 CJS 消费者，但增加构建复杂度；Node 24 已原生支持 ESM |

---

## 8. 版本与公开 API

采用语义化版本 `MAJOR.MINOR.PATCH`。

**公开 API 的范围**：`src/index.ts` 的导出内容，以及 CLI 的命令、参数、退出码。

当前 `src/index.ts` 公开：

- `identity`（兼容 API）
- `executeApplication`
- `ApplicationInput`
- `ApplicationResult`
- `AppConfig`
- `LogLevel`

CLI、adapter、`validateAppConfig`、`ValidationResult` 和其他校验实现不属于公开 API。

这两处以外的一切属于内部实现，可随时调整，不触发版本号变更。明确划定这个边界，是为了让重构有安全区 —— 否则每次内部改名都要担心是否算破坏性变更。

`CHANGELOG.md` 按版本分组，从使用者视角描述变化，不粘贴 commit 列表。

---

## 9. 开发流程

遵循工作区 `CLAUDE.md` 规定的流程：

```
需求 → 分析 → 设计方案 → 实现 → 测试 → 优化 → 提交 Git
```

本项目无具体业务需求，因此从「设计方案」起步，本文档即该阶段产出。

实现约定：

1. 新增功能必须带测试；修复缺陷先补能复现的测试。
2. 提交前执行 `npm run verify`（typecheck + lint + format:check + test），全绿才提交。
3. 每个提交保持可构建、可测试。大改动拆成多个小提交 —— 工作区规则禁止未测试的大规模修改。
4. 技术选型或架构调整写入 `docs/decisions/`。
