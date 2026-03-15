import { getMcpToolBridge } from '../mcp-tool-bridge'

export interface MemorySnapshot {
  task_state: {
    current_task: string
    current_step: string
    next_action: string
    updated_at: string
  }
  core_memory: Record<string, { value: string, memorized_at: string }>
  metadata: {
    version: number
    created_at: string
    last_accessed: string
  }
}

const EMPTY_SNAPSHOT: MemorySnapshot = {
  task_state: { current_task: '', current_step: '', next_action: '', updated_at: '' },
  core_memory: {},
  metadata: { version: 1, created_at: '', last_accessed: '' },
}

/**
 * Fetch the current memory snapshot from the MCP backend.
 * Falls back to an empty snapshot on any error so the chat pipeline is never blocked.
 */
export async function fetchMemorySnapshot(): Promise<MemorySnapshot> {
  try {
    const bridge = getMcpToolBridge()
    const result = await bridge.callTool({
      name: 'Airi_Universal_Core::get_memory_snapshot',
      arguments: {},
    })

    if (result.isError || !result.content?.length) {
      return EMPTY_SNAPSHOT
    }

    const textContent = result.content.find((c: Record<string, unknown>) => c.type === 'text')
    if (!textContent || typeof (textContent as any).text !== 'string') {
      return EMPTY_SNAPSHOT
    }

    return JSON.parse((textContent as any).text) as MemorySnapshot
  }
  catch {
    // MCP bridge not available or tool call failed — silently degrade
    return EMPTY_SNAPSHOT
  }
}

/**
 * Build the subconscious injection block from a memory snapshot.
 * This text is appended to the last user message so the LLM always has
 * up-to-date task state and core directives, without the user seeing it.
 */
export function buildSubconsciousBlock(snapshot: MemorySnapshot): string {
  const { task_state, core_memory } = snapshot

  const hasTask = task_state.current_task.trim() !== ''
  const hasMemory = Object.keys(core_memory).length > 0

  // If there's nothing to inject, return empty string
  if (!hasTask && !hasMemory) {
    return ''
  }

  const taskStateStr = hasTask
    ? `任务: ${task_state.current_task} | 步骤: ${task_state.current_step} | 下一步: ${task_state.next_action}`
    : '无活跃任务'

  const sopReminder = hasTask
    ? `你正在执行「${task_state.current_task}」，当前处于「${task_state.current_step}」。你的下一步行动是：${task_state.next_action}。请严格按照SOP继续执行，不要遗忘！`
    : ''

  const memoryLines = hasMemory
    ? Object.entries(core_memory).map(([k, v]) => `  ${k}: ${v.value}`).join('\n')
    : ''

  let block = '\n\n=== [System Subconscious] ==='
  block += `\n[Current Task State]: ${taskStateStr}`

  if (sopReminder) {
    block += `\n[Active SOP Reminder]: ${sopReminder}`
  }

  if (memoryLines) {
    block += `\n[Core Memory]:\n${memoryLines}`
  }

  block += '\n[Core Directives]: 绝对红线！无论你在聊天里答应了什么，如果需要调用工具，你的回复末尾必须包含 ```mcp_call_tool ``` 的 JSON 代码块，严禁光说不练！'
  block += '\n==========================='

  return block
}
