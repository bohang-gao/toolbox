<template>
  <ToolPage v-bind="pageProps" @process="noop">
    <template #options>
      <div class="mt-4 option-panel">
        <p style="color:#909399">该工具的功能面板尚未实现（占位页）。</p>
      </div>
    </template>
  </ToolPage>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ToolPage from '../components/ToolPage.vue'
import { ALL_TOOLS } from '../data/tools.js'

const route = useRoute()
const tool = computed(() => ALL_TOOLS.find(t => t.path === route.path))
const pageProps = computed(() => ({
  title: tool.value ? tool.value.name : '工具',
  intro: tool.value ? `${tool.value.name}：${tool.value.desc}。` : '',
  usage: '该工具的功能面板尚未实现。'
}))
const noop = () => {}
</script>
