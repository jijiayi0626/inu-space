<script setup>
import { computed } from 'vue';
import AppIcon from './AppIcon.vue';
import { dismissToast, toastState } from '../lib/toast';

const icon = computed(() => (toastState.tone === 'error' ? 'x' : 'check'));
</script>

<template>
  <div
    class="toast"
    :class="[toastState.show ? 'show' : '', toastState.tone === 'error' ? 'toast-error' : '']"
    role="status"
    aria-live="polite"
    @click="dismissToast"
  >
    <span class="toast-icon"><AppIcon :name="icon" /></span>
    <span class="toast-text">{{ toastState.message }}</span>
  </div>
</template>
