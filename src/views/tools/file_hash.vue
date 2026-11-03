<template>
  <ToolShell
    path="/file_hash"
    title="文件Hash计算"
    intro="计算本地文件的 SHA-256 / SHA-512 等摘要值，文件全程留在浏览器内存中，不会上传服务器，可用于校验下载文件的完整性。"
    :usage="[
      '点击上传区选择文件，或直接把文件拖入。',
      '勾选需要的算法后点击「计算 Hash」，进度条显示读取进度。',
      '复制结果与官方发布的校验值比对即可确认文件是否一致。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 添加文件</div>
      <div class="upload-zone" :class="{ 'is-drag': dragOver }"
           @click="pick"
           @dragover.prevent="dragOver=true"
           @dragleave="dragOver=false"
           @drop.prevent="onDrop">
        <i class="fa fa-cloud-upload uz-icon"></i>
        <div class="uz-main">{{ file ? file.name : '点击或拖拽文件到此处' }}</div>
        <div class="uz-sub">{{ file ? formatSize(file.size) : '支持任意文件，单文件 ≤50MB' }}</div>
        <button type="button" class="uz-btn" :disabled="busy" @click.stop="pick">选择文件</button>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>2</b> 设置</div>
      <div class="option-panel">
        <div class="flex flex-wrap items-center" style="gap:12px 20px">
          <span class="form-label">算法</span>
          <label v-for="a in ALGORITHMS" :key="a.value" class="el-radio">
            <input v-model="selected" type="checkbox" :value="a.value" :disabled="busy" />{{ a.label }}
          </label>
          <label class="el-radio"><input v-model="upper" type="checkbox" :disabled="busy" />大写输出</label>
        </div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>3</b> 结果</div>
      <div class="option-panel">
        <div v-if="busy || progress > 0" class="mt-4">
          <div class="flex justify-between items-center" style="font-size:13px;color:#606266">
            <span>{{ busy ? '正在计算…' : '完成' }}</span>
            <span>{{ progress }}%</span>
          </div>
          <div class="progress-track mt-2">
            <div class="progress-bar" :style="{ width: progress + '%' }"></div>
          </div>
        </div>

        <div v-if="results.length" class="mt-4">
          <div v-for="row in results" :key="row.value" class="hash-row">
            <span class="hash-row-label">{{ row.label }}</span>
            <span class="hash-row-value">{{ row.hash }}</span>
            <button type="button" class="el-button copy-btn" style="padding:6px 12px" @click="copyText(row.hash, row.label + ' 已复制')">复制</button>
          </div>
        </div>

        <div class="mt-2" style="font-size:12px;color:#909399">
          大文件会分块读取（每块 4MB）以显示进度；最终摘要由 crypto.subtle.digest 计算。
        </div>
      </div>
    </div>

    <div class="step-actions">
      <span v-if="!cryptoOk" style="color:#f56c6c;font-size:14px">当前环境不支持 Web Crypto（需要 HTTPS 或 localhost 访问）</span>
      <button type="button" class="el-button el-button--primary" :disabled="busy || !file" @click="run">
        <span><i class="fa fa-calculator mr-1"></i> 计算 Hash</span>
      </button>
      <button type="button" class="el-button el-button--info" :disabled="busy" @click="clearAll">清空</button>
    </div>
  </ToolShell>
</template>

<script setup>
import { ref } from 'vue'
import ToolShell from '../../components/ToolShell.vue'
import { pickFiles, msgError, msgSuccess, formatSize } from '../../lib/ui.js'
import { copyText } from './textkit.js'

const ALGORITHMS = [
  { value: 'SHA-1', label: 'SHA-1' },
  { value: 'SHA-256', label: 'SHA-256' },
  { value: 'SHA-384', label: 'SHA-384' },
  { value: 'SHA-512', label: 'SHA-512' }
]

const cryptoOk = typeof crypto !== 'undefined' && !!crypto.subtle

const file = ref(null)
const selected = ref(['SHA-256'])
const upper = ref(false)
const busy = ref(false)
const progress = ref(0)
const results = ref([])
const dragOver = ref(false)

async function pick() {
  if (busy.value) return
  const files = await pickFiles({ multiple: false })
  if (files.length) {
    file.value = files[0]
    results.value = []
    progress.value = 0
  }
}
function onDrop(e) {
  dragOver.value = false
  if (busy.value) return
  const files = Array.from(e.dataTransfer.files || [])
  if (files.length) {
    file.value = files[0]
    results.value = []
    progress.value = 0
  }
}

async function readWithProgress(f) {
  // 分块读取以便更新进度（crypto.subtle 需要完整 ArrayBuffer）
  const total = f.size
  if (!total) {
    progress.value = 100
    return new Uint8Array(0)
  }
  const CHUNK = 4 * 1024 * 1024
  const chunks = []
  let offset = 0
  while (offset < total) {
    const end = Math.min(offset + CHUNK, total)
    const part = await f.slice(offset, end).arrayBuffer()
    chunks.push(new Uint8Array(part))
    offset = end
    progress.value = Math.min(99, Math.round((offset / total) * 100))
    // 让出主线程，保证进度条可绘制
    await new Promise((r) => setTimeout(r, 0))
  }
  const out = new Uint8Array(total)
  let pos = 0
  for (const c of chunks) {
    out.set(c, pos)
    pos += c.length
  }
  return out
}

async function run() {
  if (!cryptoOk) {
    msgError('当前环境不支持 Web Crypto，请通过 HTTPS 或 localhost 访问')
    return
  }
  if (!file.value) {
    msgError('请先选择文件')
    return
  }
  if (!selected.value.length) {
    msgError('请至少选择一种算法')
    return
  }
  busy.value = true
  progress.value = 0
  results.value = []
  try {
    const bytes = await readWithProgress(file.value)
    const enabled = ALGORITHMS.filter((a) => selected.value.includes(a.value))
    const out = []
    for (const a of enabled) {
      const buf = await crypto.subtle.digest(a.value, bytes)
      const arr = new Uint8Array(buf)
      let hex = ''
      for (const b of arr) hex += b.toString(16).padStart(2, '0')
      out.push({ ...a, hash: upper.value ? hex.toUpperCase() : hex })
    }
    results.value = out
    progress.value = 100
    msgSuccess('Hash 计算完成')
  } catch (e) {
    msgError(`计算失败：${e.message || e}`)
  } finally {
    busy.value = false
  }
}

function clearAll() {
  file.value = null
  results.value = []
  progress.value = 0
}
</script>

<style scoped>
.progress-track{height:10px;background:#ebeef5;border-radius:5px;overflow:hidden}
.progress-bar{height:100%;background:#409eff;transition:width .2s ease}
.hash-row{display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px dashed #ebeef5}
.hash-row-label{width:76px;flex-shrink:0;font-size:13px;color:#909399}
.hash-row-value{flex:1;font-family:Consolas,Menlo,monospace;font-size:13px;color:#303133;word-break:break-all}
</style>
