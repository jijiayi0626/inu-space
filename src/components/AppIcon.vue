<script setup>
import { computed } from 'vue';

const props = defineProps({
  name: { type: String, required: true },
});

const id = computed(() => `#i-${props.name.replace(/^i-/, '')}`);
</script>

<template>
  <svg class="icon" aria-hidden="true" focusable="false"><use :href="id" /></svg>
</template>
