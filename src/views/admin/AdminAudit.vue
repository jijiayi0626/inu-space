<script setup>
import { computed } from 'vue';
import AppIcon from '../../components/AppIcon.vue';
import { dateTimeLabel } from '../../lib/format';

const props = defineProps({
  data: { type: Object, default: null },
  reload: { type: Function, required: true },
  askConfirm: { type: Function, required: true },
});

const audit = computed(() => props.data?.audit || []);
</script>

<template>
  <section class="admin-section">
    <div class="card">
      <div class="card-head">
        <h2>管理操作审计</h2>
        <span class="head-note">最近 20 条</span>
      </div>
      <div v-if="!audit.length" class="admin-empty compact">
        <span class="admin-empty-icon"><AppIcon name="clock" /></span>
        <h3>还没有管理操作</h3>
        <p>配置登录方式、创建应用或调整管理员后，记录会出现在这里。</p>
      </div>
      <div v-else class="audit-list">
        <div v-for="log in audit" :key="log.id" class="audit-row">
          <span class="audit-dot" />
          <div class="audit-copy">
            <strong>{{ log.action }}</strong>
            <span>{{ log.detail }}</span>
          </div>
          <div class="audit-meta">
            <span>{{ log.adminName }}</span>
            <em>{{ dateTimeLabel(log.createdAt) }}</em>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
