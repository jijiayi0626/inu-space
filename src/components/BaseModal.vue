<script setup>
import { computed } from 'vue';
import { Dialog } from 'fuxsto-design-pro';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  width: { type: String, default: '460px' },
});

const emit = defineEmits(['update:modelValue']);

const dialogSize = computed(() => {
  const px = Number.parseInt(props.width, 10) || 448;
  if (px <= 480) return 'md';
  if (px <= 580) return 'lg';
  return 'xl';
});

function onOpenChange(open) {
  emit('update:modelValue', open);
}
</script>

<template>
  <Dialog
    :open="modelValue"
    :title="title"
    :size="dialogSize"
    :show-confirm="false"
    :show-cancel="false"
    :mask-closable="true"
    :esc-closable="true"
    :close-on-back="true"
    @update:open="onOpenChange"
  >
    <div class="modal-body">
      <slot />
    </div>
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </Dialog>
</template>
