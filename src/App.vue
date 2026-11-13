<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { FxConfigProvider } from 'fuxsto-design-pro';
import AppShell from './components/AppShell.vue';
import { theme } from './lib/theme';

const route = useRoute();
const isPublic = computed(() => Boolean(route.meta.public));
</script>

<template>
 <FxConfigProvider
 :theme="theme"
 :motion="true"
 :enter-on-mount="true"
 :duration-scale="1"
 :stagger="{ step: 40, max: 320, window: 48 }"
 :respect-reduced-motion="true"
 >
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
 </FxConfigProvider>
</template>
