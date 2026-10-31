<script setup>
defineProps({
  title: { type: String, required: true },
  sub: { type: String, default: '' },
});
</script>

<template>
  <div class="page-head">
    <div>
      <h1>{{ title }}</h1>
      <p v-if="sub" class="page-sub">{{ sub }}</p>
    </div>
    <div v-if="$slots.meta" class="head-meta">
      <slot name="meta" />
    </div>
  </div>
</template>
