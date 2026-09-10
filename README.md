# Codex 中央开发规范库

本目录是所有软件项目共用的只读规范库与文档模板库，不是可直接开发或整目录复制的项目骨架。

## 使用方式

新项目由工作区规则触发需求访谈。需求达到约 95% 理解把握并经用户确认后，Codex 才能：

1. 从 `templates/` 读取所需模板；
2. 在 `D:\AI_Workspace\Projects` 下创建与本目录同级的项目；
3. 为新项目生成自己的文档和代码；
4. 仅在需要具体规则时读取 `rules/` 中对应主题。

已有项目优先读取项目自己的 `AGENTS.md`、`PROJECT_BRIEF.md`、`PROJECT_STATUS.md`，再检查 `git status`、`git diff` 和当前任务相关文件。普通任务不得默认全文读取 `CODEX_MASTER_PROMPT.md` 或本库全部文件。

## 目录

```text
AI_Project_Template/
├─ CODEX_MASTER_PROMPT.md   总控、入口与规则索引
├─ templates/               新项目文档模板
├─ rules/                   按主题拆分的详细规则
├─ archive/                 已淘汰内容；不参与当前流程
└─ README.md                本说明
```

## 自动与按需读取

- 项目根目录的 `AGENTS.md` 由 Codex 自动发现；`templates/AGENTS.template.md` 用于生成它。
- `PROJECT_BRIEF.md` 与 `PROJECT_STATUS.md` 是项目启动时的首要上下文。
- `DESIGN.md`、`README.md`、`CHANGELOG.md`、项目级 `CODEX.md` 和中央 `rules/` 均按任务需要读取。
- `CODEX_MASTER_PROMPT.md` 仅用于规则不明确、新的大阶段、复杂决策、重大架构变化、高风险修改或全面审查。

## 维护

普通项目不得修改本库。只有用户明确要求维护中央规范时才可变更；先合并到对应的单一事实来源，再归档被替代内容。新增规则前先搜索重复项。`archive/` 仅供追溯，不作为有效规则来源。
