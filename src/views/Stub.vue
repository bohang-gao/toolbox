<template>
  <div>
    <h1 class="text-4xl">{{ title }}</h1>
    <div class="mt-4 tool-panel">
      <div class="flex items-center" style="gap:12px;color:#909399">
        <i class="fa fa-info-circle" style="font-size:20px;color:#409eff"></i>
        <span style="font-size:14px">该工具需要服务端处理，演示版未实现。</span>
      </div>
    </div>
    <div class="mt-4 rounded-sm p-4" style="background-color:#dfd">
      <h2 class="text-xl">工具介绍：</h2>
      <p>该工具需要服务端算力或重型编辑器支持，本复刻演示版未实现其处理功能，页面结构与视觉与原站保持一致。</p>
      <h2 class="mt-4 text-xl">使用说明：</h2>
      <p>请在原站使用该工具，或使用本站其他纯前端实现的工具。</p>
    </div>
    <RelatedTools :current="route.path" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { ALL_TOOLS } from '../data/tools.js'
import RelatedTools from '../components/RelatedTools.vue'

const route = useRoute()
const title = computed(() => {
  const t = ALL_TOOLS.find(x => x.path === route.path)
  return t ? t.name : '工具'
})
</script>
