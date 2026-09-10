# Project Instructions

## Startup

开始任务时先读取：

1. `PROJECT_BRIEF.md`
2. `PROJECT_STATUS.md`

任务涉及架构时读取 `DESIGN.md`；涉及使用、构建或项目概览时读取 `README.md`；涉及版本历史时读取 `CHANGELOG.md`；只有项目特殊规则相关时才读取 `CODEX.md`。

需求事实以已确认的 `PROJECT_BRIEF.md` 为准。新要求与其冲突时先询问用户，确认后更新。

## Context

已有项目先检查 `git status`、`git diff`、最近修改和当前任务相关文件，再沿直接调用链扩大范围。遵循 `Search → Read → Modify → Verify`；不要默认扫描整个项目、读取全部 Markdown 或全文读取中央总规范。

## Development

默认使用 STANDARD；小型低风险修改用 FAST；架构、Schema、Migration、核心算法、安全、数据完整性或大规模重构用 DEEP。相关修改组成合理的 Task Batch，无关或高风险修改分开处理。

通用规则按需读取 `D:\AI_Workspace\Projects\AI_Project_Template\rules\` 中对应主题。普通实现选择以简单、稳定、少依赖、符合现有架构为准。

## Verification

运行与风险相称的真实验证。关键验证 FAIL 时先诊断、修复并重试，不进入下一关键阶段；无法执行时说明原因和影响。

## User Confirmation

关键需求不明或冲突、重大架构变化、不可逆或高风险操作、重要数据删除、修改项目外重要文件、凭据或账号、付款或明显新增成本、重大系统修改，必须先询问用户。

## Reporting

普通任务只报告：完成、验证、重要修改、下一步。保持简洁，不输出重复分析和无关日志。
