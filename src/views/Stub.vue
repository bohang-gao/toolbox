<template>
  <ToolShell
    :path="route.path"
    :title="title"
    intro="该工具需要服务端算力或重型编辑器支持，本复刻演示版未实现其处理功能，页面结构与视觉与原站保持一致。"
    :usage="['请在原站使用该工具，或使用本站其他纯前端实现的工具。']"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 添加文件</div>
      <div class="upload-zone is-disabled">
        <i class="fa fa-cloud-upload uz-icon"></i>
        <div class="uz-main">该工具需要服务端处理，演示版暂不支持上传</div>
        <div class="uz-sub">页面结构与视觉与原站保持一致</div>
        <button type="button" class="uz-btn" disabled>选择文件</button>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>2</b> 工具说明</div>
      <div class="option-panel">
        <div class="stub-notice">
          <i class="fa fa-info-circle"></i>
          <span>该工具需要服务端处理，演示版未实现。</span>
        </div>
      </div>
    </div>
  </ToolShell>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { ALL_TOOLS } from '../data/tools.js'
import ToolShell from '../components/ToolShell.vue'

const route = useRoute()
const title = computed(() => {
  const t = ALL_TOOLS.find(x => x.path === route.path)
  return t ? t.name : '工具'
})
</script>

<style scoped>
.stub-notice{display:flex;align-items:center;gap:12px;background:#f8fafc;border:1px solid var(--border);border-radius:12px;padding:18px 20px;color:var(--text-2);font-size:14px}
.stub-notice i{font-size:20px;color:var(--primary)}
</style>
