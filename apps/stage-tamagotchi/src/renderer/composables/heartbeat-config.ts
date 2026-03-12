import type { HeartbeatConfig } from '@proj-airi/stage-ui/stores/chat/heartbeat-store'

import { defineInvoke } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/renderer'

import { electronGetHeartbeatConfig } from '../../shared/eventa'

let cachedInvoker: ReturnType<typeof createInvoker> | undefined

interface HeartbeatConfigInvoker {
  getConfig: () => Promise<HeartbeatConfig>
}

function createInvoker(): HeartbeatConfigInvoker {
  const { context } = createContext(window.electron.ipcRenderer)

  return {
    getConfig: defineInvoke(context, electronGetHeartbeatConfig),
  }
}

function resolveInvoker(): HeartbeatConfigInvoker {
  if (!cachedInvoker) {
    cachedInvoker = createInvoker()
  }
  return cachedInvoker
}

/**
 * 创建 Electron 平台的心跳配置提供者
 * 通过 IPC 读取配置文件
 */
export function createElectronHeartbeatConfigProvider(): () => Promise<HeartbeatConfig> {
  return async (): Promise<HeartbeatConfig> => {
    try {
      const invoker = resolveInvoker()
      const config = await invoker.getConfig()
      return config
    }
    catch (error) {
      console.error('[Heartbeat] Failed to get config via IPC:', error)
      // 返回默认配置
      return {
        current_interval: 60,
        prompt: '【系统心跳事件】距离上次对话已经过去了一段时间。请回顾上下文，如果你有话想主动对主人说，或者想汇报某些后台进度，请直接输出纯正日语回复。如果你觉得现在不需要打扰主人，请极其严格地仅输出一个单词：<silence>',
      }
    }
  }
}
