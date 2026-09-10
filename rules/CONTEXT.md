# Context

本文件是上下文选择、diff-first 与 Token 控制的单一事实来源。

## 默认循环

始终采用 `Search → Read → Modify → Verify`：先精准定位，再读取必要范围；理解真实调用链后修改；用最小有效检查验证。

## 已有项目恢复

依次检查：

1. 项目级 `AGENTS.md`；
2. `PROJECT_BRIEF.md` 与 `PROJECT_STATUS.md`；
3. `git status` 与 `git diff`；
4. 最近修改文件、当前错误和当前任务文件；
5. 当前模块与直接调用链。

只有证据表明需要时才扩大到 `DESIGN.md`、`README.md`、`CHANGELOG.md`、`CODEX.md`、中央主题规则或更大代码范围。

## 最小上下文

- 使用文件名、符号、错误文本和调用点做精准搜索。
- 没有变化的大文件不重复全文读取；回看相关片段即可。
- 局部问题不默认扫描整个代码库或读取所有 Markdown。
- 不读取无关历史日志；变化历史优先交给 Git，当前状态优先交给 `PROJECT_STATUS.md`。
- `CODEX_MASTER_PROMPT.md` 只在其文件顶部列出的情形按需读取。

## Token 与算力

优先复用已确认的 brief、短状态文件、git diff、相关测试和已有实现。相关修改以 Task Batch 一次处理并做针对性验证。输出只保留结论、关键证据、失败原因、重要修改和下一步。

不得以节省 Token 为由跳过必要文件、关键测试、安全检查、错误处理或真实失败报告。优化目标是消除无效工作，不是降低质量。
