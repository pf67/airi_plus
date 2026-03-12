<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ControlButtonTooltip from './control-button-tooltip.vue'
import ControlButton from './control-button.vue'

import { useControlsIslandStore } from '../../../stores/controls-island'

interface Props {
  iconClass?: string
  buttonStyle?: string
}

const props = withDefaults(defineProps<Props>(), {
  iconClass: 'size-5',
})

const uiStore = useControlsIslandStore()
const hidden = computed(() => uiStore.manuallyHidden)
const { t } = useI18n()

function handleToggle() {
  uiStore.toggleManualHide()
}
</script>

<template>
  <ControlButtonTooltip>
    <ControlButton
      :button-style="props.buttonStyle"
      :class="{ 'border-primary-300/70 shadow-[0_10px_24px_rgba(0,0,0,0.22)]': hidden }"
      @click="handleToggle"
    >
      <Transition name="fade" mode="out-in">
        <div v-if="hidden" i-ph:user-circle-minus :class="props.iconClass" text="primary-700 dark:primary-300" />
        <div v-else i-ph:user-circle :class="props.iconClass" text="neutral-800 dark:neutral-300" />
      </Transition>
    </ControlButton>

    <template #tooltip>
      {{ hidden ? t('tamagotchi.stage.controls-island.show-character') : t('tamagotchi.stage.controls-island.hide-character') }}
    </template>
  </ControlButtonTooltip>
</template>
