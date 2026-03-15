# Dynamic Memory & Context Manager 修改清单

## 模块一：后端记忆存储与状态机工具

- `G:\AI\airi\brain\memory_bank.json` — 新建，记忆持久化存储文件
- `G:\AI\code\test\mcp\airi_mcp_server.py` 第561-675行 — 新增4个MCP工具：
  - `update_task_state` — AI 更新自己的工作状态（任务/步骤/下一步）
  - `memorize_fact` / `recall_fact` — 写入/读取关于主人的长期记忆（K-V）
  - `get_memory_snapshot` — 获取完整记忆快照（供前端自动调用）

## 模块二：前端动态上下文汇编器

- `packages/stage-ui/src/stores/chat/memory-manager.ts` — 新建，包含：
  - `fetchMemorySnapshot()` — 通过 MCP bridge 静默读取后端记忆快照
  - `buildSubconsciousBlock()` — 将快照汇编为 `[System Subconscious]` 文本块

## 模块三：尾部高优注入逻辑

- `packages/stage-ui/src/stores/chat.ts` 第308-341行 — 在 `performSend()` 中，`newMessages` 构建完成后、发送给 LLM 之前，自动注入潜意识模块到最后一条 user 消息的末尾

## UI 安全性

注入只发生在 `newMessages`（发给 LLM 的副本）上，不会回写到 `sessionMessagesForSend`（UI 渲染的消息历史），用户在聊天面板中看不到注入内容。
