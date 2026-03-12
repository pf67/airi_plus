import type { createContext } from '@moeru/eventa/adapters/electron/main'
import type { BrowserWindow } from 'electron'

import type { HeartbeatConfig } from '../../../shared/eventa'

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { defineInvokeHandler } from '@moeru/eventa'

import { electronGetHeartbeatConfig } from '../../../shared/eventa'

// 默认配置
const DEFAULT_HEARTBEAT_CONFIG: HeartbeatConfig = {
  current_interval: 60,
  prompt: '【系统心跳事件】距离上次对话已经过去了一段时间。请回顾上下文，如果你有话想主动对主人说，或者想汇报某些后台进度，请直接输出纯正日语回复。如果你觉得现在不需要打扰主人，请极其严格地仅输出一个单词：<silence>',
}

// 配置文件路径 - 项目根目录
function getHeartbeatConfigPath(): string {
  // 在开发环境中，使用项目根目录
  // 在生产环境中，可能需要调整路径
  return join(process.cwd(), 'heartbeat_config.json')
}

export function createHeartbeatService(params: {
  context: ReturnType<typeof createContext>['context']
  window: BrowserWindow
}) {
  defineInvokeHandler(
    params.context,
    electronGetHeartbeatConfig,
    async (): Promise<HeartbeatConfig> => {
      const configPath = getHeartbeatConfigPath()

      try {
        const content = await readFile(configPath, 'utf-8')
        const config = JSON.parse(content) as HeartbeatConfig

        // 验证配置字段
        if (typeof config.current_interval !== 'number' || config.current_interval < 0) {
          console.warn('[Heartbeat] Invalid current_interval in config, using default')
          config.current_interval = DEFAULT_HEARTBEAT_CONFIG.current_interval
        }

        if (typeof config.prompt !== 'string' || !config.prompt.trim()) {
          console.warn('[Heartbeat] Invalid prompt in config, using default')
          config.prompt = DEFAULT_HEARTBEAT_CONFIG.prompt
        }

        return config
      }
      catch (error) {
        // 文件不存在或解析失败时返回默认配置
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          console.error('[Heartbeat] Failed to read config file:', error)
        }
        else {
          console.log('[Heartbeat] Config file not found, using default config')
        }
        return DEFAULT_HEARTBEAT_CONFIG
      }
    },
  )
}
