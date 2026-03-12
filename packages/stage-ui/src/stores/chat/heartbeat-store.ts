import type { ChatProvider } from '@xsai-ext/providers/utils'

import { defineStore } from 'pinia'
import { ref } from 'vue'

import { useChatOrchestratorStore } from '../chat'

export interface HeartbeatOptions {
  model: string
  chatProvider: ChatProvider
  providerConfig?: Record<string, unknown>
}

export interface HeartbeatConfig {
  current_interval: number
  prompt: string
}

// 用于检测 silence 回复的正则
export const SILENCE_PATTERN = /^<silence>\s*$/

// 默认心跳配置
const DEFAULT_HEARTBEAT_CONFIG: HeartbeatConfig = {
  current_interval: 60,
  prompt: '【系统心跳事件】距离上次对话已经过去了一段时间。请回顾上下文，如果你有话想主动对主人说，或者想汇报某些后台进度，请直接输出纯正日语回复。如果你觉得现在不需要打扰主人，请极其严格地仅输出一个单词：<silence>',
}

// 配置提供者类型 - 可以被 Electron 等平台注入
export type HeartbeatConfigProvider = () => Promise<HeartbeatConfig>

// 全局配置提供者（默认返回默认配置，可被覆盖）
let globalConfigProvider: HeartbeatConfigProvider = async () => DEFAULT_HEARTBEAT_CONFIG

/**
 * 设置全局心跳配置提供者
 * 用于 Electron 等平台注入 IPC 调用
 */
export function setHeartbeatConfigProvider(provider: HeartbeatConfigProvider) {
  globalConfigProvider = provider
}

/**
 * 获取当前配置提供者
 */
export function getHeartbeatConfigProvider(): HeartbeatConfigProvider {
  return globalConfigProvider
}

export const useChatHeartbeatStore = defineStore('chat-heartbeat', () => {
  const heartbeatTimer = ref<ReturnType<typeof setTimeout> | null>(null)
  const heartbeatInterval = ref(DEFAULT_HEARTBEAT_CONFIG.current_interval * 1000)
  const heartbeatPrompt = ref(DEFAULT_HEARTBEAT_CONFIG.prompt)
  const isHeartbeatActive = ref(false)
  const lastHeartbeatTime = ref<number | null>(null)
  const pendingHeartbeatOptions = ref<HeartbeatOptions | null>(null)

  /**
   * 从配置源读取最新配置
   */
  async function loadConfig(): Promise<HeartbeatConfig> {
    try {
      const config = await globalConfigProvider()
      return config
    }
    catch (error) {
      console.error('[Heartbeat] Failed to load config:', error)
      return DEFAULT_HEARTBEAT_CONFIG
    }
  }

  /**
   * 应用新配置并重启定时器
   */
  async function applyConfigAndRestart() {
    const config = await loadConfig()

    // 更新间隔（秒 -> 毫秒）
    heartbeatInterval.value = config.current_interval * 1000
    heartbeatPrompt.value = config.prompt

    console.log(`[Heartbeat] Config updated: interval=${config.current_interval}s`)

    // 如果心跳激活中，销毁旧定时器并启动新的
    if (isHeartbeatActive.value) {
      clearHeartbeatTimer()
      startHeartbeatTimer()
    }
  }

  /**
   * 清除心跳定时器
   */
  function clearHeartbeatTimer() {
    if (heartbeatTimer.value) {
      clearTimeout(heartbeatTimer.value)
      heartbeatTimer.value = null
    }
  }

  /**
   * 启动心跳定时器
   */
  function startHeartbeatTimer() {
    if (heartbeatTimer.value) {
      clearHeartbeatTimer()
    }

    heartbeatTimer.value = setTimeout(async () => {
      await triggerHeartbeat()
    }, heartbeatInterval.value)
  }

  /**
   * 重置心跳定时器
   * 在用户发送消息时调用
   */
  function resetHeartbeatTimer() {
    clearHeartbeatTimer()
    if (isHeartbeatActive.value && pendingHeartbeatOptions.value) {
      startHeartbeatTimer()
    }
  }

  /**
   * 触发心跳消息
   */
  async function triggerHeartbeat() {
    if (!pendingHeartbeatOptions.value) {
      return
    }

    const chatOrchestrator = useChatOrchestratorStore()
    const { model, chatProvider, providerConfig } = pendingHeartbeatOptions.value

    lastHeartbeatTime.value = Date.now()

    try {
      // 使用当前配置的 prompt
      await chatOrchestrator.ingestHeartbeat(heartbeatPrompt.value, {
        model,
        chatProvider,
        providerConfig,
      })
    }
    catch (error) {
      console.error('[Heartbeat] Failed to send heartbeat:', error)
    }

    // 心跳完成后，重新读取配置并启动下一轮
    if (isHeartbeatActive.value) {
      await applyConfigAndRestart()
    }
  }

  /**
   * 启用心跳机制
   */
  async function enableHeartbeat(options: HeartbeatOptions) {
    pendingHeartbeatOptions.value = options
    isHeartbeatActive.value = true

    // 首次加载配置
    await applyConfigAndRestart()
  }

  /**
   * 禁用心跳机制
   */
  function disableHeartbeat() {
    isHeartbeatActive.value = false
    clearHeartbeatTimer()
    pendingHeartbeatOptions.value = null
  }

  /**
   * 更新心跳配置
   */
  function updateHeartbeatOptions(options: HeartbeatOptions) {
    pendingHeartbeatOptions.value = options
  }

  /**
   * 手动刷新配置并重启定时器
   */
  async function refreshConfig() {
    await applyConfigAndRestart()
  }

  /**
   * 用户活动时调用（发送消息等）
   * 重置定时器以延迟心跳
   */
  function onUserActivity() {
    if (isHeartbeatActive.value) {
      resetHeartbeatTimer()
    }
  }

  return {
    // 状态
    heartbeatInterval,
    heartbeatPrompt,
    isHeartbeatActive,
    lastHeartbeatTime,

    // 方法
    enableHeartbeat,
    disableHeartbeat,
    resetHeartbeatTimer,
    updateHeartbeatOptions,
    refreshConfig,
    onUserActivity,
  }
})
