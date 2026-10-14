\# 系统架构



\## 概览



Codex Development Framework 是一个面向 AI Agent 的软件工程框架。



它通过：



\- 中央规则系统

\- 项目上下文管理

\- 文档模板体系



帮助 AI Agent 更好地参与软件开发流程。



\---



\# 核心架构



```text

&#x20;                   AI Agent

&#x20;                      |

&#x20;                      |

&#x20;                      ↓



&#x20;         CODEX\_MASTER\_PROMPT.md



&#x20;                      |

&#x20;                      |

&#x20;                      ↓



&#x20;                   rules/



&#x20;                      |

&#x20;                      |

&#x20;                      ↓



&#x20;                templates/



&#x20;                      |

&#x20;                      |

&#x20;                      ↓



&#x20;             Software Projects

组件说明
CODEX_MASTER_PROMPT.md
中央入口文件。
负责：
- 定义 AI Agent 工作方式
- 指导规则读取
- 管理开发流程
rules/
工程规则系统。
包含：
- 需求分析规范
- 开发流程规范
- 测试规范
- 调试规范
- Git 工作流
- 安全规范
规则文件作为对应领域的单一事实来源。
templates/
项目模板系统。
提供：
- 项目说明模板
- 状态管理模板
- AI Agent 指令模板
- 设计文档模板
帮助快速建立标准化项目结构。
Software Projects
实际开发项目。
每个项目保持：
- 独立代码
- 独立文档
- 独立上下文
中央框架只提供方法和规范。
设计原则
Context First
AI Agent 首先理解项目上下文。
Rules Driven
开发过程遵循明确规则。
Verification Required
所有重要修改需要验证。
核心流程
Context

↓

Rules

↓

Planning

↓

Implementation

↓

Verification