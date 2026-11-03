// 通用文件处理任务页组件：上传区 + 任务列表 + 开始处理
<template>
  <ToolShell :path="route.path" :title="title" :intro="intro" :usage="usage">
    <div class="step-block">
      <div class="step"><b>1</b> 添加文件</div>
      <div class="upload-zone" :class="{ 'is-drag': dragOver }"
           @click="addFiles" @dragover.prevent="dragOver = true" @dragleave="dragOver = false"
           @drop.prevent="onDrop">
        <i class="fa fa-cloud-upload uz-icon"></i>
        <div class="uz-main">{{ hint }}</div>
        <div class="uz-sub">支持 {{ acceptLabel }}，单文件 ≤50MB</div>
        <button type="button" class="uz-btn" :disabled="busy" @click.stop="addFiles">选择文件</button>
      </div>

      <div v-if="tasks.length" class="task-list">
        <div v-for="(t, i) in tasks" :key="t.id" class="task-item">
          <span class="t-dot" :class="t.status"></span>
          <img v-if="t.thumb" :src="t.thumb" class="task-thumb" alt="" />
          <span class="t-name">{{ t.file.name }}</span>
          <span class="t-size">{{ formatSize(t.file.size) }}<template v-if="t.outSize"> → {{ formatSize(t.outSize) }}</template></span>
          <span v-if="t.note" class="t-note">{{ t.note }}</span>
          <span class="t-status" :class="t.status">{{ statusText(t) }}</span>
          <span class="t-del" title="删除" @click="remove(i)">✕</span>
        </div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>2</b> 设置</div>
      <slot name="options"></slot>
    </div>

    <slot name="result"></slot>

    <div class="step-actions">
      <button type="button" class="el-button el-button--primary" :disabled="busy || !tasks.length" @click="process">
        <span><i class="fa fa-play mr-1"></i> 开始处理</span>
      </button>
      <button type="button" class="el-button el-button--info" :disabled="busy || !tasks.length" @click="clearAll">
        <span><i class="fa fa-trash-o mr-1"></i> 清空任务</span>
      </button>
    </div>
  </ToolShell>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { pickFiles, msgError, formatSize } from '../lib/ui.js'
import ToolShell from './ToolShell.vue'

const props = defineProps({
  title: String,
  hint: { type: String, default: '点击或拖拽文件到此处' },
  accept: { type: String, default: '' },
  multiple: { type: Boolean, default: true },
  validator: Function,
  intro: String,
  usage: [String, Array],
  makeThumb: { type: Boolean, default: false },
  processHandler: { type: Function, default: null }
})
const emit = defineEmits(['process'])

import { reactive, computed } from 'vue'
const route = useRoute()
const tasks = reactive([])
const busy = ref(false)
const dragOver = ref(false)
let seq = 0

const acceptLabel = computed(() => {
  const a = String(props.accept || '')
  const img = a.includes('image/') || a.includes('image/*')
  const pdf = a.includes('pdf')
  if (img && pdf) return 'PDF 与图片'
  if (pdf) return 'PDF'
  if (img) return 'JPG、PNG、WEBP、GIF 等图片'
  return '常见文件'
})

const statusText = (t) => ({ waiting: '等待中', processing: '处理中', done: '完成', failed: '失败' }[t.status] || t.status)

function pushFiles(files) {
  for (const f of files) {
    const item = reactive({ id: ++seq, file: f, status: 'waiting', error: '', outSize: 0, thumb: '' })
    tasks.push(item)
    if (props.makeThumb && /^image\//.test(f.type)) {
      const url = URL.createObjectURL(f)
      item.thumb = url
    }
  }
}
async function addFiles() {
  if (busy.value) return
  const files = await pickFiles({ accept: props.accept, multiple: props.multiple, validator: props.validator })
  if (!files.length) return
  pushFiles(files)
}
function onDrop(e) {
  dragOver.value = false
  const files = Array.from(e.dataTransfer.files || [])
  import('../lib/ui.js').then(m => {
    const ok = m.validate(files, props.validator)
    if (files.length && !ok.length) return
    pushFiles(ok)
  })
}
function remove(i) { tasks.splice(i, 1) }
function clearAll() { tasks.splice(0) }

async function process() {
  if (!tasks.length) { msgError('请先添加文件'); return }
  busy.value = true
  try {
    if (props.processHandler) await props.processHandler(tasks)
    else emit('process', tasks)
  } catch (e) {
    console.error(e)
    msgError(`处理失败：${e.message || e}`)
  } finally {
    busy.value = false
  }
}
defineExpose({ tasks, busy, msgError })
</script>
