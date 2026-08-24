# TestProject 修复计划

本文档把一次代码审查的结论转成可执行的修复项,按优先级排序。
每项独立可提交,含验收标准。设计意图见 [DESIGN.md](./DESIGN.md),使用说明见 [README.md](./README.md)。

- 状态：待实施
- 日期：2026-08-23
- 依据：对 `Projects/TestProject` 的实现审查
- 范围：本文档只描述计划,不包含任何代码修改

## 审查基线

修复前的实际状态,作为对比基准:

| 项目               | 结果                                         |
| ------------------ | -------------------------------------------- |
| `npm run verify`   | 全绿(typecheck + lint + format:check + test) |
| 测试               | 4 个全部通过,耗时约 196ms                    |
| `npm ci` 可复现    | 是,`package-lock.json` 含 123 处 `resolved`  |
| `dist/` 是否入库   | 否,已被 `.gitignore` 排除                    |
| `src/core/` 纯净度 | 干净,无 import、无 IO、无副作用              |
| CLI 分支覆盖率     | `dist/cli/index.js` 仅 33.33%                |

骨架可用。以下 7 项中,P0 两项属于运行时缺陷,P1 第 3 项推翻了 DESIGN.md §1.2 自己设定的验收标准。

## 优先级定义

| 级别 | 含义                                          | 处理时机         |
| ---- | --------------------------------------------- | ---------------- |
| P0   | 运行时行为错误,会让调用方得到错误结论         | 沉淀模板前必须修 |
| P1   | 架构约束不足以兑现文档承诺,长期会导致分层退化 | 沉淀模板前必须修 |
| P2   | 文档与实现不一致、保护性测试缺失              | 沉淀模板前应完成 |

执行顺序即编号顺序。P0 两项都集中在 `src/cli/index.ts`,建议合并为一次改动、两个提交。

---

## P0-1 CLI 入口检测修复

### 当前问题

`src/cli/index.ts:54` 用文件名后缀判断是否被直接执行:

```ts
if (process.argv[1]?.endsWith("/cli/index.js") || process.argv[1]?.endsWith("\\cli\\index.js")) {
  process.exitCode = runCli(process.argv.slice(2));
}
```

`package.json:11` 声明了 `"bin": {"testproject": "./dist/cli/index.js"}`。凡是入口路径不以 `cli/index.js` 结尾的调用方式——包装脚本、重命名、部分打包或链接布局——这个条件都不成立,`runCli` 根本不会被调用。

实测把 `dist/cli/index.js` 复制为 `testproject.js` 后执行:

```
stdout=[]  exit=0
```

不报错、不输出、退出码 0。这比崩溃更危险:CI 会把它判定为成功。

### 修改方案

改用模块自身路径与进程入口路径的比较,不再依赖文件名:

1. 用 `import.meta.filename` 与 `process.argv[1]` 各自 `realpathSync` 后比较,消除符号链接与大小写差异(Windows 下尤其必要)。Node 24 若可直接使用 `import.meta.main`,优先用它,更短且语义明确。
2. `process.argv[1]` 可能为 `undefined`,保持可选链,判断失败时不执行。
3. 该判断属于进程环境交互,按 DESIGN.md §3 的分层归属,考虑下移到 `src/adapters/`,由 `cli` 调用。若为保持入口文件自包含而留在 `cli`,在 ADR 中记录这一让步。

### 涉及文件

- `src/cli/index.ts` — 替换入口判断
- `tests/integration/cli.test.ts` — 新增非标准入口名用例
- `docs/decisions/` — 若入口判断留在 `cli` 层,补一份 ADR

### 验收标准

1. 把构建产物复制或重命名为 `testproject.js` 后执行,`stdout` 输出结果、退出码 0,行为与 `dist/cli/index.js` 一致。
2. 通过符号链接调用时行为一致。
3. 作为库被 `import` 时不触发 CLI 执行(现有行为不得退化)。
4. 集成测试覆盖上述第 1 条,`npm run verify` 全绿。

### 是否需要更新 DESIGN.md

需要。DESIGN.md 未描述入口检测机制。在 §5 补一小节说明「CLI 入口如何判定直接执行」及为何不能按文件名匹配——这是一个会被后人重新踩的坑,值得写进文档。

---

## P0-2 退出码 1/2 错误分类修复

### 当前问题

两个缺陷叠在一起。

**退出码 1 不存在。** 全 `src/` 搜不到任何返回 1 的路径。DESIGN.md §5 定义了三档退出码,实现了两档。

**所有异常被统一映射为 2。** `src/cli/index.ts:47` 的 `catch` 包住了整个函数体:

```ts
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown argument error";
  io.writeStderr(`Argument error: ${message}\nUse --help for usage.\n`);
  return 2;
}
```

`parseArgs` 之后的任何异常——将来接入的业务逻辑、文件读取失败、网络失败——都会被冠以 `Argument error:` 并返回 2。

DESIGN.md §5 明确写了退出码 2 的语义是「这样调用永远不会成功,重试无意义」。所以一次网络抖动会被报成用法错误,而 CI 会据此放弃重试。这是语义反转,不是缺功能,危害随业务代码接入而放大。

### 修改方案

按错误来源分类,而不是按发生位置:

1. 缩小 `try` 范围,只包住 `parseArgs` 调用,其解析失败映射为退出码 2,提示保留 `Use --help for usage.`。
2. `parseArgs` 之后的执行阶段单独 `try`,异常映射为退出码 1,前缀改为 `Error:`,不带用法提示。
3. 定义一个内部错误类型或错误码常量区分两类,避免后续在字符串前缀上做判断。常量建议放 `src/cli/`,因为退出码映射是 `cli` 的职责(DESIGN.md §3)。
4. 按 DESIGN.md §5 末段,错误信息说明发生了什么以及下一步能做什么,不向用户抛堆栈;堆栈仅在诊断模式下输出到 stderr。诊断模式开关本轮不实现,先在 ADR 记录待办。

### 涉及文件

- `src/cli/index.ts` — 拆分 try 范围、新增退出码 1 分支
- `tests/unit/cli/` — 新增 `runCli` 的退出码矩阵单元测试(见下)
- `tests/integration/cli.test.ts` — 补运行时错误的端到端断言

`runCli` 已经支持 `io` 注入(`src/cli/index.ts:16`),但当前只通过子进程测试。用注入的 `ProcessIO` 直接断言退出码和输出流,不需要起进程,是补齐 1/2 两条分支最省力的方式。注意 DESIGN.md §6 把 `tests/unit/` 定义为镜像 `src/core` 与 `src/config`,新增 `tests/unit/cli/` 需要同步调整该节措辞,或改放 `tests/integration/`。

### 验收标准

1. 未知选项、缺少参数值、非法参数值 → 退出码 2,stderr 含用法提示,stdout 为空。
2. 执行阶段抛出的运行时错误 → 退出码 1,stderr 说明错误,不含 `Use --help for usage.`,stdout 为空。
3. 正常执行、`--help`、`--version` → 退出码 0,输出在 stdout,stderr 为空。
4. 单元测试覆盖 0/1/2 三档;`dist/cli/index.js` 分支覆盖率从 33.33% 提升到 80% 以上。
5. `npm run verify` 全绿。

### 是否需要更新 DESIGN.md

需要,但只是补充而非改写。§5 的三档定义本身正确,当前是实现没跟上。建议在 §5 增补一句判定依据:「参数解析阶段的失败为 2,解析成功后执行阶段的失败为 1」,把分类规则写成可检查的形式。诊断模式若确认延后,在 `docs/decisions/` 记一份 ADR。

---

## P1-3 core 边界规则增强（已实施）

### 当前问题

DESIGN.md §1.2 的验收标准是「在 `core` 中写一条指向 `adapters` 的 import,`npm run lint` 必须报错」。实测该标准只在教科书写法下成立。

逐个构造越界文件实测(探测文件已全部删除):

| 写法                                          | 结果     |
| --------------------------------------------- | -------- |
| `import "../adapters/process-io.js"`          | 拦下     |
| `import "node:fs"` / `createRequire`          | 拦下     |
| `import type { ProcessIO }`                   | 拦下     |
| `export { processIO } from "../adapters/..."` | 拦下     |
| 子目录 `../../adapters/...`                   | 拦下     |
| `console.log`                                 | 拦下     |
| `import "./../adapters/process-io.js"`        | **放行** |
| `await import("../adapters/process-io.js")`   | **放行** |
| `process.env.HOME`                            | **放行** |
| `globalThis.process.cwd()`                    | **放行** |

放行的四条都通过 `tsc --noEmit`,是能正常运行的真实越界代码。

成因在 `eslint.config.js:17` 的规则结构:

- `regex: "^(node:|[^./])"` 不匹配以 `.` 开头的路径,而 `group: ["../adapters/**"]` 按字面量匹配,`./../adapters/...` 是等价路径但不落在该 glob 内。
- `no-restricted-imports` 不覆盖动态 `import()` 表达式。
- `process` 是全局对象,无需 import,基于 import 的规则结构上就看不见它。而 DESIGN.md §4 明确禁止 `core` 碰 `node:process` 和读环境变量。

DESIGN.md §4 判断「只要有一次图省事在 core 里 import fs,分层就从架构退化成目录命名习惯」是对的,但当前规则强度不足以兑现它。

### 修改方案

按「默认拒绝」重写,而不是继续枚举要拦的写法:

1. 把 core 的 import 限制从黑名单改为白名单——只允许同层相对路径。用 `regex` 表达「不以 `./` 紧跟非 `.` 字符开头即拒绝」,`./../` 这类等价绕行自然落入拒绝区。
2. 增加 `no-restricted-syntax` 拦 `ImportExpression`,覆盖动态 `import()`。
3. 增加 `no-restricted-globals` 拦 `process`,并考虑一并拦 `globalThis`、`require`、`__dirname`、`fetch`。
4. 保留现有 `no-console`。
5. 规则只作用于 `src/core/**`,不影响其他层。

### 涉及文件

- `eslint.config.js` — 重写 `src/core/**` 规则块
- `tests/` — 新增 lint 回归测试(见 P1-4)

### 验收标准

上表 10 种写法全部被 `npm run lint` 拦下,且:

1. 现有 `src/core/placeholder.ts` 仍然通过 lint(规则不产生误报)。
2. `src/adapters/`、`src/cli/` 不受新规则影响,`process.stdout.write` 等正常用法不报错。
3. `npm run verify` 全绿。

### 是否需要更新 DESIGN.md

需要。§4 现在只列了「不得 import」的清单,应改为说明约束方式是「白名单:core 只能 import core 内部模块」,并补上全局对象与动态 import 也在管控范围内。同时 §1.2 的验收标准建议从单条 import 扩展为「上表全部变体」,让标准本身可被测试固化。

实施记录：已在 `eslint.config.js` 使用白名单式 `no-restricted-imports`，并增加动态导入、受限全局和 `console` 规则；具体回归用例在 P1-4 的架构测试中完成。

---

## P1-4 ESLint 架构测试增加

### 当前问题

DESIGN.md §2 末段把 ESLint 定位为「第 4 节依赖规则的执行点,属于架构基础设施」。但这项基础设施本身没有任何测试。

后果已经在 P1-3 中显现:规则看起来合理、实际存在四个缺口,而且是在人工逐条构造反例时才发现的。没有回归测试意味着:

- 规则失效不会被察觉,`npm run verify` 依旧全绿。
- 后续升级 ESLint 或 typescript-eslint 时,规则行为变化无人知晓。
- P1-3 修完后,缺口可能在下一次配置调整中重新出现。

对一个准备沉淀为 `Templates/typescript-cli` 的项目,这套规则是模板最核心的资产,却是唯一没被测试保护的部分。

### 修改方案

把 P1-3 的越界写法表固化为自动化测试:

1. 新增测试文件,对每种越界写法调用 ESLint 并断言产生 error。
2. 越界代码片段放 `tests/fixtures/`(该目录已存在但为空),不放 `src/`,避免污染源码树和构建产物。用 ESLint 的 API 或 `spawnSync` 执行 `npx eslint` 传入临时文件,后者更贴近真实执行路径。
3. 每条用例断言的是「有 error」而非具体错误文案,避免规则措辞调整导致测试脆断。
4. 补一条反向用例:合法的同层 import 不报错,防止规则收紧后产生误报。
5. 集成测试若生成临时文件,按 DESIGN.md §6「集成测试产生的临时文件用完即删」清理。

考虑用 `node:test` 的 `describe` + 数据驱动写法,一张表驱动全部用例,新增一种越界写法只需加一行。

### 涉及文件

- `tests/integration/eslint-boundaries.test.ts` — 新建(含真实 IO 与子进程,归属 integration)
- `tests/fixtures/` — 存放越界代码片段
- `package.json` — 若 lint 测试较慢,考虑是否单列脚本;默认仍并入 `npm test`

### 验收标准

1. P1-3 表中 10 种越界写法各有一条用例,全部断言 lint 报错。
2. 合法写法的反向用例通过。
3. 故意把 `eslint.config.js` 的 core 规则块删除后,该测试文件失败——证明测试真的在守规则,而不是恒真。
4. 测试结束后无临时文件残留。
5. `npm run verify` 全绿。

### 是否需要更新 DESIGN.md

需要。§6 的测试策略表只列了单元测试与集成测试两类,应补充第三类「架构约束测试」,说明其作用是保护依赖规则本身。这也让 §1.2 的验收标准有了对应的自动化归属。

---

## P2-5 config 层补最小实现（已完成）

### 当前问题

`src/config/` 只有一个 `.gitkeep`,没有任何实现。而它在文档和工具链中都被当作真实存在的一层:

- DESIGN.md §3 给它分配了实职:定义配置类型、提供校验函数,并禁止它自己读环境变量。
- DESIGN.md §4 把它画进依赖图 `cli ──► adapters ──► core / config`。
- `eslint.config.js:26` 专门配置了 `core` 不得 import `../config/**`。
- DESIGN.md §1.3 的验收目标提到覆盖「`core` 与 `config` 的边界与异常输入」。
- DESIGN.md §2 选型表列了「配置校验:手写校验函数」。

配套的 `config/app.example.json` 内容是 `{}`。

空目录 + 有约束 + 无实现,是模板里最容易被误读的状态:后人无法判断这是「还没写」还是「故意留空」。

### 修改方案

**已定:采用方案 A,保留 `src/config/` 并补最小实现。** 移除该层的方案不再考虑。

实现严格遵循 DESIGN.md §3 对该层的定义:只定义类型、只做纯校验。读取动作(读文件、读环境变量)归 `adapters`,由它把原始对象交给 `config` 校验。

#### 1. 模块职责

| 该做                                | 不该做                          |
| ----------------------------------- | ------------------------------- |
| 定义配置的 TypeScript 类型          | 读取文件、环境变量、命令行参数  |
| 校验 `unknown` 输入并收窄为配置类型 | 决定配置来源、优先级、合并顺序  |
| 填充可选字段的默认值                | 任何业务判断                    |
| 返回结构化的校验错误                | 抛裸异常、写 stderr、决定退出码 |

`config` 与 `core` 同属内层,但定位不同:`core` 是领域逻辑,`config` 是输入契约。所以 `config` 可被 `adapters` 与 `cli` 引用,而 `core` 不得引用它——`eslint.config.js:26` 已经在约束这一条。

校验函数的形态:输入 `unknown`,返回「成功带值 / 失败带错误列表」的可辨识联合,不抛异常。三条理由:

1. 类型系统强制调用方处理失败分支,不会漏。
2. 错误一次返回全部。配置文件写错三个字段时,用户应该一次看到三条,而不是修一条重跑一次。
3. 退出码映射是 `cli` 的职责(DESIGN.md §3)。按 DESIGN.md §5,「校验不通过」属于运行时失败,映射为退出码 1,与 P0-2 的分类规则一致。

#### 2. 文件结构

沿用现有的单文件平铺风格——`src/core/placeholder.ts`、`src/adapters/process-io.ts` 都是一个 kebab-case 文件、无层内 index:

```
src/config/
└── app-config.ts        配置类型 + 默认值 + 校验函数

config/
└── app.example.json     可直接复制的样例,不含真实值

tests/unit/config/
└── app-config.test.ts   镜像 src/config/app-config.ts
```

三点取舍:

- **不加 `src/config/index.ts`。** 层内 barrel 在只有一个文件时是纯开销,且 DESIGN.md §3 已规定 `src/index.ts` 是唯一公开出口。
- **类型与校验同文件。** 拆成 `types.ts` + `validate.ts` 在当前规模下只增加跳转成本;文件超过约 150 行再拆。
- **测试路径对应 DESIGN.md §3 的镜像规则**(`src/config/x.ts` → `tests/unit/config/x.test.ts`),找测试不需要搜索。

`src/config/app-config.ts` 不出现在 `src/index.ts` 的导出中。配置类型是否属于公开 API 取决于将来是否让库使用者传配置;当前 CLI 尚未接入配置,保持不导出,避免过早固定 DESIGN.md §8 定义的 API 边界。

#### 3. 最小实现范围

目标是让分层与测试链路真实可跑,不是做一个通用配置框架。按 DESIGN.md §1.4,`core` 只放占位实现;`config` 同理——字段少但校验路径完整。

**在范围内:**

1. **配置类型。** 2 至 3 个字段,覆盖三种校验形态:一个必填字符串、一个带默认值的可选枚举、一个带范围约束的可选数字。三种形态足以让校验代码有真实分支,再多是重复。
2. **默认值常量。** 显式导出,便于测试直接引用而不是硬编码字面量。
3. **校验函数。** 单个导出函数,输入 `unknown`,逐字段检查:顶层是否为对象(排除 `null`、数组、原始值)、必填字段是否存在且类型正确、可选字段若存在是否合法、枚举值是否在允许集合内、数字是否在范围内且为整数。

   **未知字段:采用严格模式——出现类型定义之外的字段即判定校验失败,不忽略、不透传。** 三条理由:模板项目应优先暴露错误而非容错;拼错字段名(如 `logLevel` 写成 `loglevel`)在宽松模式下会静默退回默认值,用户以为配置生效了,实际没有,而这类问题只在出问题时才被发现;配置契约保持明确——「类型里有什么,配置文件就只能有什么」是一条能写进文档、也能被测试固定的规则。

   实现要点:字段比对以类型定义派生的允许键集合为唯一依据,避免在校验函数里重复维护一份键名清单。错误信息需给出具体的未知字段名,并按 DESIGN.md §5 末段的要求说明下一步能做什么(如提示查看 `config/app.example.json`)。严格模式与「一次返回全部错误」并行:多个未知字段应一次全部列出,不在第一个处返回。

   这条规则应写进代码注释——严格模式是有意取舍而非疏漏,后人看到「多一个字段就报错」时容易误判为过度严格,注释在此处是有价值的(符合 CLAUDE.md 对注释的要求)。

   一个已知代价:严格模式让配置文件无法向前兼容——旧版本程序读到新版本增加了字段的配置文件会直接失败。当前项目未接入配置、无外部使用者,该代价为零。将来若需要兼容多版本配置,再按 DESIGN.md §7.2 的做法新增 ADR 重新评估,不直接放宽规则。

4. **结构化错误。** 每条错误含字段路径与原因,可一次返回多条。
5. **样例文件。** `config/app.example.json` 填入全部字段的占位值,与类型定义严格对应,不含任何真实值或密钥(README:155 已有此要求)。

**不在范围内:**

- 读取文件或环境变量——属 `adapters`,本轮不实现。
- 配置来源合并、优先级、层叠覆盖。
- 嵌套对象与数组字段的递归校验。
- 把配置接入 CLI 运行路径。CLI 当前不需要配置,接入应等到有真实配置需求,并单独一轮。
- 引入 zod。DESIGN.md §7.3 已记录落选理由,本轮正是为该决策提供实测依据:若手写校验在 3 个字段规模下已显吃力,则按 §7.2 的做法在 `docs/decisions/` 新增 ADR 重新评估,而不是直接改选型表。

**约束:** 零依赖;不引入 `node:` 内置模块(纯校验不需要);不使用 `any`,类型收窄通过 `unknown` + 类型守卫完成;`tsconfig.json` 已开 `noUncheckedIndexedAccess` 与 `exactOptionalPropertyTypes`,可选字段的处理需符合后者的严格语义。

#### 4. 测试要求

按 DESIGN.md §6,该层测试属 `tests/unit/`:无 IO、毫秒级、覆盖边界与异常输入。DESIGN.md §1.3 的验证目标之一正是「覆盖 `core` 与 `config` 的边界与异常输入」,本项负责兑现 `config` 那一半。

必须覆盖的用例:

| 类别     | 用例                                                                                                                                   |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 合法输入 | 全字段给出;仅给必填字段(断言可选字段被填为默认值)                                                                                      |
| 顶层非法 | `null`、`undefined`、数组、字符串、数字 — 均返回失败,不抛异常                                                                          |
| 必填缺失 | 缺必填字段;必填字段为 `null` 或空字符串                                                                                                |
| 类型错误 | 必填字符串传数字;可选数字传字符串;枚举传布尔                                                                                           |
| 值域错误 | 枚举值不在允许集合;数字越界(上下界各一条);数字为小数或 `NaN`                                                                           |
| 未知字段 | 合法字段外多一个未知字段 → 失败,错误含该字段名;两个未知字段 → 一次列出两条;字段名大小写或拼写错误(如 `loglevel`)→ 失败而非静默取默认值 |
| 多错聚合 | 一次输入含两处以上错误,断言错误条数与全部字段路径                                                                                      |
| 默认值   | 断言导出的默认值常量与「仅必填字段」路径的结果一致                                                                                     |

要求:

1. **断言错误的字段路径与条数,不断言错误文案。** 文案调整不应导致测试脆断——与 P1-4 的同一原则。
2. **成功路径断言返回值全等**,而非仅检查字段存在,以捕获默认值填充错误和字段被意外丢弃。
3. **不使用 mock**。该层无 IO,需要 mock 说明实现越界了——这正是 DESIGN.md §4「附带收益」所描述的检验方式。
4. **样例文件一致性测试。** 读取 `config/app.example.json` 并断言其通过校验。注意这引入了真实文件读取,严格说属集成测试;建议放 `tests/integration/`,或在单元测试中内联该 JSON 的字面量副本并额外加一条断言两者一致。前者更简单,推荐前者。此项防止样例文件与类型定义漂移——模板使用者第一个动作就是复制这个文件。
5. **覆盖率**:`src/config/` 行覆盖不低于 90%(DESIGN.md §6 对内层的参考线)。校验函数的每条分支都应有对应用例。

### 涉及文件

- `src/config/app-config.ts` — 新建:配置类型、默认值常量、校验函数
- `config/app.example.json` — 填入全字段占位值,替换当前的 `{}`
- `tests/unit/config/app-config.test.ts` — 新建:上表全部用例
- `tests/integration/config-example.test.ts` — 新建:样例文件一致性测试(采用推荐做法时)
- `DESIGN.md` — §1.3 的验收标准细化为具体校验用例(见下)

不改动:`eslint.config.js`(§26 对 `core → config` 的限制已正确)、`src/index.ts`(配置类型本轮不进公开 API)、`src/cli/index.ts`(不接入配置)。

### 验收标准

1. 校验函数对合法输入返回带类型的配置对象;对第 4 节全部非法类别返回结构化错误,任何输入都不抛裸异常。
2. 一次输入含多处错误时,错误列表包含全部字段路径,不在第一条处提前返回。
3. 严格模式生效:输入含任何类型定义之外的字段即失败,错误信息给出该字段名;字段名拼写错误不会静默退回默认值。允许键集合由类型定义派生,校验函数内无第二份手写键名清单。
4. 仅给必填字段时,可选字段被填为导出的默认值常量;返回值与预期对象全等。
5. `config/app.example.json` 含全部字段的占位值并通过校验,不含任何真实值或密钥;且在严格模式下不含任何多余字段。
6. `src/config/` 不读取文件、不读环境变量、不 import 任何 `node:` 内置模块与第三方包。
7. 测试不使用 mock,全部用例在毫秒级完成(DESIGN.md §6 对单元测试的要求)。
8. `src/config/` 行覆盖率不低于 90%,校验函数每条分支有对应用例。
9. `src/index.ts` 的导出集合不变——与 P2-7 的公开 API 测试不冲突。
10. `npm run verify` 全绿。

### 是否需要更新 DESIGN.md

需要,但仅是小幅细化,设计意图不变——§3 对该层的定义(只定义类型、只做纯校验、不自己读环境变量)本轮完整落实。

1. §1.3 的验收标准「覆盖 `core` 与 `config` 的边界与异常输入」补上具体判定:非法类型、值域越界、未知字段、多错聚合四类各有用例。
2. §3 对 `config` 层的描述补一句校验契约:**未知字段一律判定为失败(严格模式)**,与「只定义类型、只做纯校验」并列为该层的对外承诺。这是配置契约的一部分,属于设计决策而非实现细节,应写在 DESIGN.md 而不只是代码注释里。
3. §2 选型表「配置校验:手写校验函数」补一句说明本轮已用 3 字段规模实测,以及按 §7.2 的做法何时重新评估 zod。
4. §5 可补一句:配置校验失败映射为退出码 1(与 P0-2 的分类规则一致),供将来接入 CLI 时有据可依。

严格模式建议在 `docs/decisions/` 单独记一份 ADR,而不只是 DESIGN.md 里的一句话——它有明确的取舍(牺牲配置文件的向前兼容,换取拼写错误立即暴露),也有明确的重新评估触发条件(出现需要兼容多版本配置的外部使用者)。这正是 DESIGN.md §7 所定义的 ADR 适用场景。第 3 项的手写校验实测结论同样按 §7.2 的规矩新增 ADR,不直接改原决策段落。

实施记录：已完成 `src/config/app-config.ts`、样例配置、单元测试、样例集成测试、设计文档和严格未知字段 ADR。typecheck、lint、格式检查与完整测试均通过。

---

## P2-6 README 与 DESIGN 同步

### 当前问题

README.md 保留了旧版结构描述,与实际实现和 DESIGN.md 都不一致:

| 位置       | README 写的                        | 实际情况                              |
| ---------- | ---------------------------------- | ------------------------------------- |
| README:114 | `src/interfaces/cli/`              | 实际是 `src/cli/`,无 `interfaces` 层  |
| README:105 | `docs/requirements/`               | 实际只有 `api`、`decisions`、`design` |
| README:136 | `interfaces ──► adapters ──► core` | DESIGN.md §4 是 `cli ──► adapters`    |
| README:148 | 「interfaces 层只做翻译」          | 层名不存在                            |
| README:183 | 需求写入 `docs/requirements/`      | 该目录不存在                          |

另有两处独立问题:

- README:59 的库用法示例是 `import {} from /* 公开 API */ "testproject";`,是占位语法噪音,无法复制运行。模板的 README 是新人第一份读物,示例应可直接使用。
- README:144 写「调用 `console` 属于 `adapters`」,但 `eslint.config.js:9` 的 `no-console: "error"` 作用于 `**/*.ts` 全部文件,adapters 也被禁。实际实现走的是 `src/adapters/process-io.ts` 的 `process.stdout.write`,即统一通过 `ProcessIO` 抽象。README 的表述与实现和规则都不符。

DESIGN.md 是正确的一方,以它为准对齐。

### 修改方案

1. 修正 README 目录树:`src/interfaces/cli/` → `src/cli/`;`docs/` 下改为实际的 `api`、`decisions`、`design` 三项。
2. 修正依赖图为 `cli ──► adapters ──► core / config`,与 DESIGN.md §4 一致。
3. 「interfaces 层只做翻译」改为「cli 层只做翻译」。
4. 需求文档去向:若确认需要 `docs/requirements/`,创建该目录并保留 README 的流程描述;否则把需求内容归入 `docs/design/`,同步改 README:183 和 DESIGN.md §9。
5. 替换 README:59 为可运行示例,导入 `src/index.ts` 实际导出的符号。
6. 统一 console 口径:推荐把 README:144 改为「输出统一通过 `ProcessIO`,不直接调用 `console`」,与现有 `no-console` 全局生效的实现保持一致。若反之决定给 adapters 开例外,则改 `eslint.config.js` 而非 README。
7. 顺带核对 README 脚本清单与 `package.json:19-32` 的一致性。
8. config 层保留(P2-5 已定为方案 A),README 中的 config 描述按 P2-5 的最终字段与文件结构核对一次,不需要删除该层的相关段落。

### 涉及文件

- `README.md` — 上述 1-7 项
- `eslint.config.js` — 仅当第 6 项选择给 adapters 开例外
- `DESIGN.md` — 仅当第 4 项调整需求文档去向
- `docs/requirements/` — 仅当第 4 项决定创建

### 验收标准

1. README 中出现的每个目录路径都在仓库中真实存在。
2. README 与 DESIGN.md 的依赖图、层名、职责描述逐条一致。
3. README 的库用法示例可直接复制运行。
4. console 相关表述与 `eslint.config.js` 的实际规则一致。
5. 脚本清单与 `package.json` 一致。
6. `npm run format:check` 通过(README 也在 Prettier 覆盖范围内)。

### 是否需要更新 DESIGN.md

原则上不需要——DESIGN.md 是基准。仅在第 4 项决定需求文档归入 `docs/design/` 时,同步微调 §9。

---

## P2-7 index.ts 公开 API 测试

### 当前问题

`src/index.ts` 只导出 `identity`,符合 DESIGN.md §3「只 re-export core 的公开 API,禁止导出 adapters 或 cli」。当前状态正确,但正确的原因是 core 目前只有一个符号,而不是有机制保证。

DESIGN.md §8 把 `src/index.ts` 的导出内容定义为公开 API 边界和版本语义的判定依据。这个边界没有任何测试守着:

- 新增 core 函数时漏加导出,不会有人发现。
- 误把 `adapters` 或 `cli` 的符号导出去,不会有人发现——而这是 DESIGN.md §3 明令禁止的。
- 删除或改名一个已导出符号属于 MAJOR 变更,但目前没有任何信号提示这件事发生了。

`package.json:13` 的 `exports` 只暴露 `.` 一个入口,方向是对的,同样没有测试确认。

### 修改方案

1. 新增单元测试,断言 `src/index.ts` 的导出符号集合等于一个显式清单。用 `Object.keys` 排序后与预期数组做全等比较,而非逐个检查存在性——只有全等才能同时抓住漏导出和多导出。
2. 断言导出集合中不含任何来自 `adapters` 或 `cli` 的符号,把 DESIGN.md §3 的禁令变成可执行检查。
3. 在测试文件头部注释说明:该清单变更即公开 API 变更,需按 DESIGN.md §8 评估版本号并更新 `CHANGELOG.md`。这条注释是给未来改动者的提示,属于 CLAUDE.md 允许的「复杂度值得注释」的情形。
4. 该测试无 IO,归 `tests/unit/`。

### 涉及文件

- `tests/unit/index.test.ts` — 新建
- `CHANGELOG.md` — 后续公开 API 变更时同步维护(本项不产生变更)

### 验收标准

1. 测试断言导出集合与显式清单全等。
2. 手动在 `src/index.ts` 增加一个额外导出后测试失败;删除 `identity` 导出后测试失败。
3. 导出集合中不含 adapters 或 cli 的符号。
4. `npm run verify` 全绿。

### 是否需要更新 DESIGN.md

不需要。§8 已经把公开 API 的范围定义清楚,本项只是给这个定义补上执行机制。可选:在 §8 末尾加一句指明该约束由 `tests/unit/index.test.ts` 守护,方便后人找到执行点。

---

## 附:未列入本轮的观察项

审查中发现但不构成缺陷的两点,按 DESIGN.md §1.4 的范围划分,建议留到下一轮:

1. **覆盖率报告同时统计 `dist/` 和 `src/`**,同一份 core 在报告中出现两次,`all files` 的数字因此偏移。给 `test:coverage` 加 `--test-coverage-exclude="dist/**"` 可让 DESIGN.md §6 的参考线读起来更准。
2. **`--help` 与 `--json` 同时给出时 help 优先**,行为合理但无测试覆盖。可在 P0-2 补退出码矩阵时一并加上。

CI 配置仍按 DESIGN.md §1.4 保持在范围外,等骨架稳定后单独一轮。

---

## DESIGN.md 更新汇总

| 修复项 | 是否需改 DESIGN.md | 涉及章节     | 性质               |
| ------ | ------------------ | ------------ | ------------------ |
| P0-1   | 需要               | §5           | 补充入口判定说明   |
| P0-2   | 需要               | §5           | 补充分类规则       |
| P1-3   | 需要               | §1.2、§4     | 改为白名单表述     |
| P1-4   | 需要               | §6           | 新增测试类别       |
| P2-5   | 需要               | §1.3、§2、§5 | 细化验收与选型说明 |
| P2-6   | 一般不需要         | §9(条件性)   | 基准方向相反       |
| P2-7   | 不需要             | §8(可选一句) | 仅补执行点         |

建议 DESIGN.md 的改动随对应代码提交一并进行,不单独攒成一次文档提交——DESIGN.md §3 已说明「文档跟代码同一次提交、同一个分支,避免文档与实现漂移」。

## 实施与验证

按 CLAUDE.md 的分工,本文档属「设计方案」阶段产出,实现与测试由 Codex 执行。

每项遵循 DESIGN.md §9 的实现约定:

1. 修复缺陷先补能复现的测试(P0-1、P0-2、P1-3 都已有明确的复现方式)。
2. 提交前执行 `npm run verify`,全绿才提交。
3. 每个提交保持可构建、可测试;7 项拆成独立提交,不合并为一次大改动。
4. 技术选型与架构调整写入 `docs/decisions/`。

全部完成后重跑基线对比:`npm run verify` 全绿、CLI 分支覆盖率达标、P1-4 的架构测试在规则被删时失败。三项都满足,再沉淀为 `Templates/typescript-cli`。
