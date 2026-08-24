# TestProject

TypeScript 项目骨架，同时提供**库**和**命令行**两种入口。

本项目有两个目标：

1. 承载实际业务逻辑，长期维护。
2. 固化一套可复用的工程规范（构建、检查、测试、发布），后续沉淀为 `Templates/typescript-cli`。

生产依赖数量目标为 **0**，开发依赖保持在最小集合。

---

## 技术栈

| 关注点   | 选择                                       |
| -------- | ------------------------------------------ |
| 语言     | TypeScript 5.x（`strict: true`）           |
| 运行时   | Node.js >= 24                              |
| 模块格式 | ESM（`"type": "module"`）                  |
| 包管理   | npm                                        |
| 构建     | `tsc`                                      |
| 测试     | `node:test` + 内置覆盖率                   |
| 参数解析 | `node:util` 的 `parseArgs`                 |
| 代码检查 | ESLint 9（flat config）+ typescript-eslint |
| 格式化   | Prettier                                   |

---

## 快速开始

环境要求：Node.js >= 24，npm >= 11。

```bash
# 安装依赖
npm ci

# 构建
npm run build

# 运行测试
npm test

# 类型检查 + 代码检查 + 测试（提交前必跑）
npm run verify
```

### 作为命令行使用

```bash
# 本地链接后使用
npm link
testproject --help
```

### 作为库使用

```ts
import { executeApplication, type AppConfig, type ApplicationInput } from "testproject";

const config: AppConfig = {
  name: "demo",
  logLevel: "info",
  maxRetries: 3,
};
const input: ApplicationInput = { value: "hello" };
const result = executeApplication(config, input);
```

当前公开 API 包括 `identity`、`executeApplication`、`ApplicationInput`、`ApplicationResult`、`AppConfig` 和 `LogLevel`。CLI、adapters 和 `validateAppConfig` 不属于公开库 API。

---

## 可用脚本

| 命令                       | 作用                                   |
| -------------------------- | -------------------------------------- |
| `npm run build`            | 编译 TypeScript 到 `dist/`             |
| `npm run typecheck`        | 只做类型检查，不产出文件               |
| `npm run lint`             | ESLint 检查                            |
| `npm run lint:fix`         | ESLint 自动修复                        |
| `npm run format`           | Prettier 格式化                        |
| `npm run format:check`     | 检查格式，不修改文件                   |
| `npm test`                 | 运行全部测试                           |
| `npm run test:unit`        | 只跑单元测试                           |
| `npm run test:integration` | 只跑集成测试                           |
| `npm run test:coverage`    | 带覆盖率运行测试                       |
| `npm run verify`           | typecheck + lint + format:check + test |
| `npm run clean`            | 删除 `dist/` 和覆盖率产物              |

`npm run verify` 是提交前的唯一入口，CI 也只跑这一条。

---

## 目录结构

```
TestProject/
├── README.md               本文件
├── CHANGELOG.md            版本变更记录，人工维护
├── LICENSE
├── package.json
├── package-lock.json
├── tsconfig.json           基础配置，供编辑器和其他配置继承
├── tsconfig.build.json     构建专用，排除测试文件
├── eslint.config.js        ESLint flat config
├── .prettierrc.json
├── .editorconfig
├── .gitignore
├── .npmrc                  锁定精确版本（save-exact=true）
│
├── docs/
│   ├── requirements/       需求：问题、边界、验收标准
│   ├── design/             方案：模块划分、数据流、接口
│   ├── decisions/          ADR，一个决策一个文件
│   └── api/                对外接口契约
│
├── src/
│   ├── index.ts            库入口，唯一的公开 API 出口
│   ├── core/               纯领域逻辑，不含 IO
│   ├── config/             配置类型、默认值与纯校验
│   ├── types/              共享纯类型契约
│   ├── adapters/           外部输入输出的边界转换与 ProcessIO
│   └── cli/                参数解析与调用编排
│
├── tests/
│   ├── unit/               对应 src/core、src/config、src/adapters，无 IO，快
│   ├── integration/        跨模块、含真实 IO
│   └── fixtures/           测试数据
│
├── scripts/                构建与发布辅助脚本
└── config/                 环境配置模板，不含任何密钥
```

---

## 架构约束

以下四条是本项目的硬性规则，代码审查时逐条检查。

### 依赖方向单向朝内

```
cli
 ├──► adapters ───► 外部输入 / ProcessIO
 ├──► config ─────► validateAppConfig
 └──► core ───────► executeApplication

core   ───► types
config ───► types
```

`core` 不得 import `adapters`、`cli`、`config` 或第三方框架；仅允许依赖共享纯类型。`config` 不调用 core，adapters 不负责配置校验或业务计算。
目的：更换 CLI 库、HTTP 客户端或存储方案时，`core` 不需要改动。

### core 层无 IO

读写文件、发起网络请求、访问数据库、读取环境变量和进程输出，全部属于 `adapters`。当前 adapters 包含 Config Source、Application Input Source 和 `ProcessIO`，未来可扩展文件、环境变量或网络来源。
`core` 只接收数据、返回数据。
好处：单元测试不需要 mock 框架，也不需要启动外部服务。

### config 层只做校验

职责限于：定义配置契约、填充默认值、执行 `validateAppConfig`。不读取 IO、不解析 CLI、不调用 core。

### cli 层只做编排

职责限于：解析参数 → 调用 Config Source 和 Application Input Source → 调用 `validateAppConfig` → 调用 `executeApplication` → 格式化输出 → 映射退出码。
不直接构造已校验的 AppConfig，不承担领域计算。

### 密钥不进仓库

`config/` 只存放模板文件（如 `app.example.json`）；`src/config/` 负责纯配置校验。实际来源可由 adapters 在未来通过环境变量、文件或网络注入。
`.env`、`*.local.*`、凭证文件由 `.gitignore` 排除。

---

## 测试策略

| 类型     | 位置                 | 要求                                                |
| -------- | -------------------- | --------------------------------------------------- |
| 单元测试 | `tests/unit/`        | 目录结构镜像 `src/core/`，无 IO，单个文件毫秒级完成 |
| 集成测试 | `tests/integration/` | 覆盖 CLI 端到端行为和真实 IO；临时文件用完即删      |

测试文件命名为 `*.test.ts`。

覆盖率参考线：`src/core/` 不低于 90%，整体不低于 80%。这是审查时的参考值，不作为构建门禁 —— 覆盖率高不等于测试有效。

---

## 开发流程

遵循工作区 `CLAUDE.md` 规定的流程：

```
需求 → 分析 → 设计方案 → 实现 → 测试 → 优化 → 提交 Git
```

对应到本项目：

1. **需求**：在 `docs/requirements/` 写明要解决什么、不解决什么、验收标准。
2. **分析 / 设计**：在 `docs/design/` 写明模块划分、数据流、接口签名。涉及技术选型的决定写入 `docs/decisions/`。
3. **实现**：按分层写代码，遵守上述架构约束。
4. **测试**：新增功能必须带测试；修复缺陷先补上能复现的测试。
5. **优化**：在测试通过的前提下重构。
6. **提交**：`npm run verify` 全绿后提交。

每个提交都保持可构建、可测试。大改动拆成多个小提交。

---

## 决策记录（ADR）

技术选型和架构决定记录在 `docs/decisions/`，文件名格式：

```
NNNN-短标题.md
```

每份包含：日期、状态（提议 / 采纳 / 废弃）、背景、决定、备选方案及其落选原因、影响。

这一项容易被省略，但半年后没人记得当初为什么不用某个库，就会有人重新踩一遍同样的坑。

---

## 版本与变更记录

采用语义化版本 `MAJOR.MINOR.PATCH`：

- **MAJOR**：公开 API 出现破坏性变更
- **MINOR**：向后兼容的新功能
- **PATCH**：向后兼容的缺陷修复

公开 API 的定义范围是 `src/index.ts` 的导出内容和 CLI 的命令、参数、退出码。

`CHANGELOG.md` 按版本分组，每条从使用者视角描述变化，不要粘贴 commit 列表。

---

## CLI 约定

| 约定                   | 说明                         |
| ---------------------- | ---------------------------- |
| 退出码 0               | 成功                         |
| 退出码 1               | 运行时错误                   |
| 退出码 2               | 参数用法错误                 |
| stdout                 | 仅输出程序结果，便于管道处理 |
| stderr                 | 错误、警告、诊断信息         |
| `--json`               | 输出机器可读格式             |
| `--help` / `--version` | 所有命令均支持               |

错误信息说明发生了什么以及下一步可以做什么，不直接抛出堆栈。

---

## 许可

见 `LICENSE`。
