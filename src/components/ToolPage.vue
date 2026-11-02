// 通用文件处理任务页组件：上传区 + 任务列表 + 开始处理
<template>
  <div>
    <h1 class="text-4xl">{{ title }}</h1>
    <div class="mt-4 flex flex-col">
      <div class="file-upload flex flex-col justify-center"
           :style="dragOver ? 'outline:3px dashed #fff' : ''"
           @click="addFiles" @dragover.prevent="dragOver=true" @dragleave="dragOver=false"
           @drop.prevent="onDrop">
        <div class="el-upload-dragger">
          <i class="fa fa-cloud-upload cloud-upload-item"></i>
          <div>{{ hint }}</div>
        </div>
      </div>
      <div class="mt-4 flex justify-between">
        <div>
          <button type="button" class="el-button el-button--primary" :disabled="busy" @click="addFiles">
            <span><i class="fa fa-plus mr-1"></i> 添加文件</span>
          </button>
        </div>
        <div class="flex items-center">
          <div class="el-button-group">
            <button type="button" class="el-button el-button--info" :disabled="busy || !tasks.length" @click="clearAll">
              <span><i class="fa fa-trash-o mr-1"></i> 清空任务</span>
            </button>
            <button type="button" class="el-button el-button--primary" :disabled="busy || !tasks.length" @click="process">
              <span><i class="fa fa-arrow-right mr-1"></i> 开始处理</span>
            </button>
          </div>
        </div>
      </div>

      <slot name="options"></slot>

      <div v-if="tasks.length" class="task-list">
        <div v-for="(t, i) in tasks" :key="t.id" class="task-item">
          <img v-if="t.thumb" :src="t.thumb" class="task-thumb" alt="" />
          <span class="t-name">{{ t.file.name }}</span>
          <span class="t-size">{{ formatSize(t.file.size) }}<template v-if="t.outSize"> → {{ formatSize(t.outSize) }}</template></span>
          <span class="t-status" :class="t.status">{{ statusText(t) }}</span>
          <span class="t-del" title="删除" @click="remove(i)">✕</span>
        </div>
      </div>

      <slot name="result"></slot>
    </div>
    <div class="mt-4 rounded-sm p-4" style="background-color:#dfd">
      <h2 class="text-xl">工具介绍：</h2>
      <p>{{ intro }}</p>
      <h2 class="mt-4 text-xl">使用说明：</h2>
      <p style="white-space:pre-line">{{ usage }}</p>
    </div>
    <RelatedTools :current="route.path" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { pickFiles, msgError, formatSize } from '../lib/ui.js'
import RelatedTools from './RelatedTools.vue'

const props = defineProps({
  title: String,
  hint: { type: String, default: '点击添加文件，或将文件拖到此处' },
  accept: { type: String, default: '' },
  multiple: { type: Boolean, default: true },
  validator: Function,
  intro: String,
  usage: String,
  makeThumb: { type: Boolean, default: false },
  processHandler: { type: Function, default: null }
})
const emit = defineEmits(['process'])

import { reactive } from 'vue'
const route = useRoute()
const tasks = reactive([])
const busy = ref(false)
const dragOver = ref(false)
let seq = 0

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
