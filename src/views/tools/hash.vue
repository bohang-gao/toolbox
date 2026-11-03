<template>
  <ToolShell
    path="/hash"
    title="Hash计算"
    intro="使用浏览器 Web Crypto API 计算文本的 SHA-1 / SHA-256 / SHA-384 / SHA-512 摘要，全部在本地完成，文本不会上传服务器。"
    :usage="[
      '勾选需要计算的算法（默认 SHA-256），输入文本后自动计算。',
      '结果默认小写十六进制，可切换为大写；点击「复制」取用。',
      'SHA-1 已不再安全，仅建议用于校验历史数据，不要用于签名或密码场景。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 输入与设置</div>
      <div class="option-panel">
      <div class="flex flex-wrap items-center" style="gap:12px 20px">
        <span class="form-label">算法</span>
        <label v-for="a in ALGORITHMS" :key="a.value" class="el-radio">
          <input v-model="selected" type="checkbox" :value="a.value" @change="compute" />{{ a.label }}
        </label>
        <label class="el-radio"><input v-model="upper" type="checkbox" @change="compute" />大写输出</label>
      </div>

      <div class="mt-4">
        <div class="flex justify-between items-center">
          <span class="form-label">输入文本</span>
          <span style="font-size:12px;color:#909399">{{ text.length }} 字符</span>
        </div>
        <textarea
          v-model="text"
          class="el-textarea__inner mt-2"
          style="min-height:150px"
          placeholder="输入需要计算哈希的文本（UTF-8）"
          @input="scheduleCompute"
        ></textarea>
      </div>

      <div v-if="!cryptoOk" class="mt-2" style="color:#f56c6c;font-size:14px">
        当前环境不支持 Web Crypto（需要 HTTPS 或 localhost 访问）
      </div>

      <div v-if="selected.length === 0" class="mt-2" style="color:#e6a23c;font-size:14px">请至少选择一种算法</div>

      <div class="mt-4">
        <div v-for="row in results" :key="row.value" class="hash-row">
          <span class="hash-row-label">{{ row.label }}</span>
          <span class="hash-row-value">{{ row.hash || '—' }}</span>
          <button
            type="button"
            class="el-button copy-btn"
            style="padding:6px 12px"
            :disabled="!row.hash"
            @click="copyText(row.hash, row.label + ' 已复制')"
          >复制</button>
        </div>
      </div>

      <div class="step-actions">
        <button type="button" class="el-button el-button--info" @click="clearAll">清空</button>
      </div>
      </div>
    </div>
  </ToolShell>
</template>

<script setup>
import { ref } from 'vue'
import ToolShell from '../../components/ToolShell.vue'
import { msgError } from '../../lib/ui.js'
import { copyText } from './textkit.js'

const ALGORITHMS = [
  { value: 'SHA-1', label: 'SHA-1' },
  { value: 'SHA-256', label: 'SHA-256' },
  { value: 'SHA-384', label: 'SHA-384' },
  { value: 'SHA-512', label: 'SHA-512' }
]

const cryptoOk = typeof crypto !== 'undefined' && !!crypto.subtle

const text = ref('')
const selected = ref(['SHA-256'])
const upper = ref(false)
const results = ref(ALGORITHMS.map((a) => ({ ...a, hash: '' })))

let timer = null
let seq = 0

function scheduleCompute() {
  clearTimeout(timer)
  timer = setTimeout(compute, 180)
}

async function digest(algo, buf) {
  const hashBuf = await crypto.subtle.digest(algo, buf)
  const bytes = new Uint8Array(hashBuf)
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return upper.value ? out.toUpperCase() : out
}

async function compute() {
  const mySeq = ++seq
  if (!cryptoOk) return
  const content = text.value
  if (!content) {
    results.value = ALGORITHMS.map((a) => ({ ...a, hash: '' }))
    return
  }
  const enabled = ALGORITHMS.filter((a) => selected.value.includes(a.value))
  const buf = new TextEncoder().encode(content)
  const next = ALGORITHMS.map((a) => ({ ...a, hash: '' }))
  try {
    const computed = await Promise.all(
      enabled.map(async (a) => ({ value: a.value, hash: await digest(a.value, buf) }))
    )
    if (mySeq !== seq) return // 已被更新的输入覆盖
    for (const c of computed) {
      const row = next.find((r) => r.value === c.value)
      if (row) row.hash = c.hash
    }
    results.value = next
  } catch (e) {
    msgError(`计算失败：${e.message || e}`)
  }
}

function clearAll() {
  text.value = ''
  results.value = ALGORITHMS.map((a) => ({ ...a, hash: '' }))
}
</script>

<style scoped>
.hash-row{display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px dashed #ebeef5}
.hash-row-label{width:76px;flex-shrink:0;font-size:13px;color:#909399}
.hash-row-value{flex:1;font-family:Consolas,Menlo,monospace;font-size:13px;color:#303133;word-break:break-all;min-height:20px}
</style>
