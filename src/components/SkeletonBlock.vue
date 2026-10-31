<script setup>
const props = defineProps({
  rows: { type: Number, default: 4 },
  rowHeight: { type: String, default: '14px' },
});

const widths = ['100%', '92%', '78%', '86%', '64%'];
</script>

<template>
  <div class="skeleton-stack" aria-hidden="true">
    <span
      v-for="index in props.rows"
      :key="index"
      class="skeleton"
      :style="{ height: props.rowHeight, width: widths[(index - 1) % widths.length] }"
    />
  </div>
</template>
