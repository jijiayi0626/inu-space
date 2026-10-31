<script setup>
import { onBeforeUnmount, watch } from 'vue';
import AppIcon from './AppIcon.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  width: { type: String, default: '460px' },
});

const emit = defineEmits(['update:modelValue']);

function close() {
  emit('update:modelValue', false);
}

function onKeydown(event) {
  if (event.key === 'Escape') close();
}

watch(
  () => props.modelValue,
  (open) => {
    document.body.classList.toggle('modal-open', open);
    if (open) document.addEventListener('keydown', onKeydown);
    else document.removeEventListener('keydown', onKeydown);
  },
);

onBeforeUnmount(() => {
  document.body.classList.remove('modal-open');
  document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="modal-mask show" @click.self="close">
        <div class="modal" role="dialog" aria-modal="true" :aria-label="title" :style="{ maxWidth: width }">
          <div class="modal-head">
            <h3>{{ title }}</h3>
            <button class="icon-btn" type="button" aria-label="关闭弹窗" @click="close">
              <AppIcon name="x" />
            </button>
          </div>
          <div class="modal-body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="modal-foot">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
