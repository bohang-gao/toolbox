<template>
  <div class="recent-tools">
    <div v-if="items.length" class="recent-row">
      <router-link
        v-for="t in items"
        :key="t.path"
        :to="t.path"
        class="tool recent-card"
      >
        <div class="flex items-center" style="width:100%">
          <div class="tool-icon" :style="{ color: t.color }">
            <i :class="['fa', t.icon]"></i>
          </div>
          <div class="ml-2" style="min-width:0">
            <div class="tool-header">{{ t.name }}</div>
          </div>
        </div>
      </router-link>
    </div>

    <div v-else class="recent-empty">
      <i class="fa fa-clock-o"></i>
      <p>你使用过的工具会出现在这里，先去逛逛吧 <span class="recent-arrow">→</span></p>
      <router-link to="/" class="el-button el-button--primary">全部工具</router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { getRecentTools, onRecentChange } from '../lib/recent.js'

const LIMIT = 8

const items = ref(getRecentTools(LIMIT))
let unsubscribe = null

onMounted(() => {
  items.value = getRecentTools(LIMIT)
  unsubscribe = onRecentChange(() => {
    items.value = getRecentTools(LIMIT)
  })
})

onUnmounted(() => {
  if (unsubscribe) unsubscribe()
})
</script>
