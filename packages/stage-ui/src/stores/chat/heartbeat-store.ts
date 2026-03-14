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
  // 防止 triggerHeartbeat 重入（上一轮还没结束就被调度）
  let heartbeatInFlight = false

  /**
   * 从配置源读取最新配置（带超时保护，防止 IPC 挂死）
   */
  async function loadConfig(): Promise<HeartbeatConfig> {
    try {
      const config = await Promise.race([
        globalConfigProvider(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('loadConfig IPC timeout (3s)')), 3000),
        ),
      ])
      return config
    }
    catch (error) {
      console.error('[💓Heartbeat] loadConfig failed:', error)
      return DEFAULT_HEARTBEAT_CONFIG
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
   * 调度下一轮心跳（核心：保证定时器链永远不断）
   */
  function scheduleNextHeartbeat() {
    clearHeartbeatTimer()
    if (!isHeartbeatActive.value) {
      console.log('[💓Heartbeat] scheduleNext: inactive, skip')
      return
    }
    const ms = heartbeatInterval.value
    console.log(`[💓Heartbeat] ⏰ scheduleNext: next fire in ${ms / 1000}s (at ${new Date(Date.now() + ms).toLocaleTimeString()})`)
    heartbeatTimer.value = setTimeout(() => {
      // 非 async — 用 .catch 兜底，绝不产生 unhandled rejection
      triggerHeartbeat().catch((err) => {
        console.error('[💓Heartbeat] triggerHeartbeat crashed:', err)
        // 即使整个 trigger 炸了，也要保证链不断
        scheduleNextHeartbeat()
      })
    }, ms)
  }

  /**
   * 触发心跳消息（完整生命周期）
   */
  async function triggerHeartbeat() {
    // 重入保护：如果上一轮还没结束，跳过本轮，直接调度下一轮
    if (heartbeatInFlight) {
      console.warn('[💓Heartbeat] ⚠️ previous heartbeat still in-flight, skipping this round')
      scheduleNextHeartbeat()
      return
    }

    if (!pendingHeartbeatOptions.value) {
      console.warn('[💓Heartbeat] ⚠️ no pendingHeartbeatOptions, skipping')
      scheduleNextHeartbeat()
      return
    }

    heartbeatInFlight = true
    console.log(`[💓Heartbeat] 🔥 FIRING heartbeat at ${new Date().toLocaleTimeString()}`)

    const chatOrchestrator = useChatOrchestratorStore()
    const { model, chatProvider, providerConfig } = pendingHeartbeatOptions.value

    lastHeartbeatTime.value = Date.now()

    try {
      console.log('[💓Heartbeat] → calling ingestHeartbeat...')
      await chatOrchestrator.ingestHeartbeat(heartbeatPrompt.value, {
        model,
        chatProvider,
        providerConfig,
      })
      console.log('[💓Heartbeat] ✅ ingestHeartbeat resolved (AI reply done)')
    }
    catch (error) {
      console.error('[💓Heartbeat] ❌ ingestHeartbeat rejected:', error)
    }

    heartbeatInFlight = false

    // 无论成功失败，都重新读取配置并调度下一轮
    try {
      const config = await loadConfig()
      heartbeatInterval.value = config.current_interval * 1000
      heartbeatPrompt.value = config.prompt
      console.log(`[💓Heartbeat] config reloaded: interval=${config.current_interval}s`)
    }
    catch (error) {
      console.error('[💓Heartbeat] config reload failed, keeping current interval:', error)
    }

    scheduleNextHeartbeat()
  }

  /**
   * 启用心跳机制
   */
  async function enableHeartbeat(options: HeartbeatOptions) {
    pendingHeartbeatOptions.value = options

    // 重入保护：已经激活就只更新 options，不动定时器
    if (isHeartbeatActive.value) {
      console.log('[💓Heartbeat] already active, updated options only')
      return
    }

    isHeartbeatActive.value = true
    console.log('[💓Heartbeat] 🟢 ENABLED')

    // 首次加载配置并启动
    try {
      const config = await loadConfig()
      heartbeatInterval.value = config.current_interval * 1000
      heartbeatPrompt.value = config.prompt
    }
    catch (error) {
      console.error('[💓Heartbeat] initial config load failed:', error)
    }

    scheduleNextHeartbeat()
  }

  /**
   * 禁用心跳机制
   */
  function disableHeartbeat() {
    console.log('[💓Heartbeat] 🔴 DISABLED')
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
    try {
      const config = await loadConfig()
      heartbeatInterval.value = config.current_interval * 1000
      heartbeatPrompt.value = config.prompt
    }
    catch (error) {
      console.error('[💓Heartbeat] refreshConfig failed:', error)
    }
    scheduleNextHeartbeat()
  }

  /**
   * 用户活动时调用（发送消息等）
   * 重置定时器以延迟心跳
   */
  function onUserActivity() {
    if (isHeartbeatActive.value) {
      console.log('[💓Heartbeat] user activity, resetting timer')
      scheduleNextHeartbeat()
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
    resetHeartbeatTimer: scheduleNextHeartbeat,
    updateHeartbeatOptions,
    refreshConfig,
    onUserActivity,
  }
})
