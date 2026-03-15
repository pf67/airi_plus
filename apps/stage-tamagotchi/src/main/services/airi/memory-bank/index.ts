import type { createContext } from '@moeru/eventa/adapters/electron/main'

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { defineInvokeHandler } from '@moeru/eventa'
import { app } from 'electron'

import { electronMemoryRead, electronMemoryWrite } from '../../../../shared/eventa'

function getMemoryBankPath() {
  // In development, use the project's brain/ directory.
  // In production, fall back to Electron's userData directory.
  if (app.isPackaged) {
    return join(app.getPath('userData'), 'brain', 'memory_bank.json')
  }
  return join('G:', 'AI', 'airi', 'brain', 'memory_bank.json')
}

export function createMemoryBankService(params: { context: ReturnType<typeof createContext>['context'] }) {
  const memoryPath = getMemoryBankPath()

  defineInvokeHandler(params.context, electronMemoryRead, async () => {
    await mkdir(dirname(memoryPath), { recursive: true })
    try {
      return await readFile(memoryPath, 'utf-8')
    }
    catch {
      // File doesn't exist yet — return default structure
      const defaultBank = JSON.stringify({
        task_state: { current_task: '', current_step: '', next_action: '', updated_at: '' },
        core_memory: {},
        metadata: { version: 1, created_at: new Date().toLocaleString('zh-CN'), last_accessed: '' },
      }, null, 2)
      await writeFile(memoryPath, defaultBank, 'utf-8')
      return defaultBank
    }
  })

  defineInvokeHandler(params.context, electronMemoryWrite, async (content) => {
    await mkdir(dirname(memoryPath), { recursive: true })
    await writeFile(memoryPath, content, 'utf-8')
  })
}
