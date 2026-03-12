import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

export const useControlsIslandStore = defineStore('controls-island', () => {
  // Persist fade-on-hover preference per user
  const fadeOnHoverEnabled = useLocalStorage<boolean>('controls-island/fade-on-hover-enabled', false)
  const dontShowItAgainNoticeFadeOnHover = useLocalStorage<boolean>('preferences/dont-show-it-again/notice/fade-on-hover', false)

  // Manual hide state - hides the character but keeps controls visible
  const manuallyHidden = useLocalStorage<boolean>('controls-island/manually-hidden', false)

  function enableFadeOnHover() {
    fadeOnHoverEnabled.value = true
  }

  function disableFadeOnHover() {
    fadeOnHoverEnabled.value = false
  }

  function toggleManualHide() {
    manuallyHidden.value = !manuallyHidden.value
  }

  function showCharacter() {
    manuallyHidden.value = false
  }

  function hideCharacter() {
    manuallyHidden.value = true
  }

  return {
    fadeOnHoverEnabled,
    dontShowItAgainNoticeFadeOnHover,
    manuallyHidden,
    enableFadeOnHover,
    disableFadeOnHover,
    toggleManualHide,
    showCharacter,
    hideCharacter,
  }
})
