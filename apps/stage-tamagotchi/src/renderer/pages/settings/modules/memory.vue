<script setup lang="ts">
import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { Button } from '@proj-airi/ui'
import { computed, onMounted, ref } from 'vue'

import { electronMemoryRead, electronMemoryWrite } from '../../../../shared/eventa'

interface MemoryEntry {
  value: string
  memorized_at: string
}

interface MemoryBank {
  task_state: {
    current_task: string
    current_step: string
    next_action: string
    updated_at: string
  }
  core_memory: Record<string, MemoryEntry>
  metadata: {
    version: number
    created_at: string
    last_accessed: string
  }
}

const readMemoryBank = useElectronEventaInvoke(electronMemoryRead)
const writeMemoryBank = useElectronEventaInvoke(electronMemoryWrite)

const memoryBank = ref<MemoryBank | null>(null)
const isBusy = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// New fact form
const newKey = ref('')
const newValue = ref('')

// Task state form
const editTask = ref('')
const editStep = ref('')
const editNext = ref('')

const memoryEntries = computed(() => {
  if (!memoryBank.value)
    return []
  return Object.entries(memoryBank.value.core_memory).map(([key, entry]) => ({
    key,
    ...entry,
  }))
})

const hasTask = computed(() => {
  return memoryBank.value?.task_state?.current_task?.trim() !== ''
})

async function loadMemory() {
  isBusy.value = true
  errorMessage.value = ''
  try {
    const raw = await readMemoryBank()
    memoryBank.value = JSON.parse(raw)
    if (memoryBank.value) {
      editTask.value = memoryBank.value.task_state.current_task
      editStep.value = memoryBank.value.task_state.current_step
      editNext.value = memoryBank.value.task_state.next_action
    }
  }
  catch (e) {
    errorMessage.value = `读取失败: ${e instanceof Error ? e.message : String(e)}`
  }
  finally {
    isBusy.value = false
  }
}

async function saveMemory() {
  if (!memoryBank.value)
    return
  isBusy.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const json = JSON.stringify(memoryBank.value, null, 2)
    await writeMemoryBank(json)
    successMessage.value = '保存成功'
    setTimeout(() => successMessage.value = '', 2000)
  }
  catch (e) {
    errorMessage.value = `保存失败: ${e instanceof Error ? e.message : String(e)}`
  }
  finally {
    isBusy.value = false
  }
}

function addFact() {
  if (!memoryBank.value || !newKey.value.trim())
    return
  memoryBank.value.core_memory[newKey.value.trim()] = {
    value: newValue.value,
    memorized_at: new Date().toLocaleString('zh-CN'),
  }
  newKey.value = ''
  newValue.value = ''
  saveMemory()
}

function deleteFact(key: string) {
  if (!memoryBank.value)
    return
  delete memoryBank.value.core_memory[key]
  saveMemory()
}

function updateFactValue(key: string, value: string) {
  if (!memoryBank.value)
    return
  memoryBank.value.core_memory[key].value = value
}

function saveTaskState() {
  if (!memoryBank.value)
    return
  memoryBank.value.task_state = {
    current_task: editTask.value,
    current_step: editStep.value,
    next_action: editNext.value,
    updated_at: new Date().toLocaleString('zh-CN'),
  }
  saveMemory()
}

function clearTaskState() {
  editTask.value = ''
  editStep.value = ''
  editNext.value = ''
  saveTaskState()
}

onMounted(() => loadMemory())
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Header -->
    <div
      :class="[
        'rounded-xl p-4 md:p-6',
        'border border-neutral-200/70 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900/40',
        'flex flex-col gap-4',
      ]"
    >
      <div class="flex flex-col gap-1">
        <h2 class="text-lg font-semibold md:text-xl">
          记忆中枢
        </h2>
        <p class="text-sm text-neutral-500">
          管理 Airi 的长期记忆与任务状态，数据持久化在 brain/memory_bank.json
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <Button :disabled="isBusy" variant="secondary" @click="loadMemory">
          刷新
        </Button>
      </div>

      <!-- Messages -->
      <div
        v-if="successMessage"
        class="border border-emerald-200 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300"
      >
        {{ successMessage }}
      </div>
      <div
        v-if="errorMessage"
        class="border border-red-200 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
      >
        {{ errorMessage }}
      </div>
    </div>

    <!-- Task State Section -->
    <div
      :class="[
        'rounded-xl p-4 md:p-6',
        'border border-neutral-200/70 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900/40',
        'flex flex-col gap-3',
      ]"
    >
      <div class="flex items-center justify-between">
        <h3 class="text-base font-semibold">
          当前任务状态
        </h3>
        <span
          v-if="hasTask"
          class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
        >
          进行中
        </span>
        <span
          v-else
          class="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
        >
          空闲
        </span>
      </div>

      <div class="flex flex-col gap-2">
        <label class="flex flex-col gap-1">
          <span class="text-xs text-neutral-500">当前任务</span>
          <input
            v-model="editTask"
            class="border border-neutral-200 rounded-md bg-white px-3 py-1.5 text-sm outline-none transition-colors dark:border-neutral-700 focus:border-blue-400 dark:bg-neutral-800 dark:focus:border-blue-500"
            placeholder="例如：帮主人启动绘画服务"
          >
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-neutral-500">当前步骤</span>
          <input
            v-model="editStep"
            class="border border-neutral-200 rounded-md bg-white px-3 py-1.5 text-sm outline-none transition-colors dark:border-neutral-700 focus:border-blue-400 dark:bg-neutral-800 dark:focus:border-blue-500"
            placeholder="例如：第3步 - 等待服务启动"
          >
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-neutral-500">下一步计划</span>
          <input
            v-model="editNext"
            class="border border-neutral-200 rounded-md bg-white px-3 py-1.5 text-sm outline-none transition-colors dark:border-neutral-700 focus:border-blue-400 dark:bg-neutral-800 dark:focus:border-blue-500"
            placeholder="例如：检查服务是否启动成功"
          >
        </label>
      </div>

      <div class="flex gap-2">
        <Button :disabled="isBusy" @click="saveTaskState">
          保存状态
        </Button>
        <Button :disabled="isBusy" variant="secondary" @click="clearTaskState">
          清空状态
        </Button>
      </div>

      <div v-if="memoryBank?.task_state?.updated_at" class="text-xs text-neutral-400">
        上次更新: {{ memoryBank.task_state.updated_at }}
      </div>
    </div>

    <!-- Core Memory Section -->
    <div
      :class="[
        'rounded-xl p-4 md:p-6',
        'border border-neutral-200/70 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900/40',
        'flex flex-col gap-3',
      ]"
    >
      <div class="flex items-center justify-between">
        <h3 class="text-base font-semibold">
          核心记忆 ({{ memoryEntries.length }})
        </h3>
      </div>

      <!-- Add new fact -->
      <div class="flex gap-2">
        <input
          v-model="newKey"
          class="min-w-0 flex-1 border border-neutral-200 rounded-md bg-white px-3 py-1.5 text-sm outline-none transition-colors dark:border-neutral-700 focus:border-blue-400 dark:bg-neutral-800 dark:focus:border-blue-500"
          placeholder="键名，如：主人的名字"
          @keydown.enter="addFact"
        >
        <input
          v-model="newValue"
          class="flex-2 min-w-0 border border-neutral-200 rounded-md bg-white px-3 py-1.5 text-sm outline-none transition-colors dark:border-neutral-700 focus:border-blue-400 dark:bg-neutral-800 dark:focus:border-blue-500"
          placeholder="值，如：小明"
          @keydown.enter="addFact"
        >
        <Button :disabled="!newKey.trim() || isBusy" @click="addFact">
          添加
        </Button>
      </div>

      <!-- Memory list -->
      <div v-if="memoryEntries.length === 0" class="py-4 text-center text-sm text-neutral-400">
        还没有任何记忆
      </div>
      <ul v-else class="flex flex-col gap-2">
        <li
          v-for="entry in memoryEntries"
          :key="entry.key"
          class="flex items-center gap-2 border border-neutral-200/80 rounded-md bg-white/80 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-950/50"
        >
          <span class="shrink-0 text-sm text-neutral-700 font-medium dark:text-neutral-300">
            {{ entry.key }}
          </span>
          <span class="text-neutral-300 dark:text-neutral-600">=</span>
          <input
            :value="entry.value"
            class="min-w-0 flex-1 border border-transparent rounded bg-transparent px-1 py-0.5 text-sm outline-none transition-colors focus:border-blue-400 hover:border-neutral-200 dark:focus:border-blue-500 dark:hover:border-neutral-700"
            @change="(e) => { updateFactValue(entry.key, (e.target as HTMLInputElement).value); saveMemory() }"
          >
          <span class="shrink-0 text-xs text-neutral-400">
            {{ entry.memorized_at }}
          </span>
          <button
            class="shrink-0 rounded p-1 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
            @click="deleteFact(entry.key)"
          >
            <div class="i-solar:trash-bin-2-bold-duotone h-4 w-4" />
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.modules.memory.title
  subtitleKey: settings.title
  stageTransition:
    name: slide
</route>
