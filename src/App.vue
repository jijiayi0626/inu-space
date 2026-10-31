<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AppShell from './components/AppShell.vue';
import IconSprite from './components/IconSprite.vue';
import ToastHost from './components/ToastHost.vue';

const route = useRoute();
const isPublic = computed(() => Boolean(route.meta.public));
</script>

<template>
  <IconSprite />

  <template v-if="isPublic">
    <RouterView v-slot="{ Component }">
      <Transition name="page" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
  </template>

  <AppShell v-else>
    <RouterView v-slot="{ Component }">
      <Transition name="page" mode="out-in">
        <component :is="Component" :key="route.path" />
      </Transition>
    </RouterView>
  </AppShell>

  <ToastHost />
</template>
