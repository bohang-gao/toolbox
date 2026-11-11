<template>
  <ToolShell
    path="/coord/degree-convert"
    title="经纬度和度分秒转换"
    intro="十进制度与度分秒（DMS）双向换算。度分秒按 1° = 60′ = 3600″ 计算，秒支持小数；另提供宽松文本识别，可直接粘贴 116°24′26.64″、116 24 26.64、N39°54′15″ 等写法。"
    :usage="[
      '选择方向：十进制度 → 度分秒，或度分秒 → 十进制度。',
      '度分秒输入时用「南 / 西」选择负号，度、分、秒都填正数即可。',
      '粘贴文本自动识别支持 N/S/E/W 前后缀、负号与空格分隔，解析结果同时给出两种表示。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 输入</div>
      <div class="option-panel">
        <div class="flex flex-wrap items-center" style="gap:12px 20px">
          <span class="form-label">模式</span>
          <label class="el-radio">
            <input v-model="mode" type="radio" value="dd2dms" />十进制度 → 度分秒
          </label>
          <label class="el-radio">
            <input v-model="mode" type="radio" value="dms2dd" />度分秒 → 十进制度
          </label>
        </div>

        <div v-if="mode === 'dd2dms'" class="mt-4">
          <label>
            <span class="form-label">十进制度（°）</span>
            <input
              v-model="ddInput"
              class="el-input__inner mt-2"
              type="text"
              spellcheck="false"
              placeholder="116.4074，南纬 / 西经用负数"
            />
          </label>
        </div>

        <div v-else class="coord-grid mt-4">
          <label>
            <span class="form-label">度（°）</span>
            <input v-model="degInput" class="el-input__inner mt-2" type="text" spellcheck="false" placeholder="116" />
          </label>
          <label>
            <span class="form-label">分（′）</span>
            <input v-model="minInput" class="el-input__inner mt-2" type="text" spellcheck="false" placeholder="24" />
          </label>
          <label>
            <span class="form-label">秒（″）</span>
            <input v-model="secInput" class="el-input__inner mt-2" type="text" spellcheck="false" placeholder="26.64" />
          </label>
          <label>
            <span class="form-label">半球 / 方向</span>
            <select v-model="hemi" class="el-input__inner mt-2">
              <option v-for="h in HEMIS" :key="h.value" :value="h.value">{{ h.label }}</option>
            </select>
          </label>
        </div>
        <p class="tool-note mt-2">度分秒按正数填写，负号由「南 / 西」决定；分、秒留空按 0 处理。</p>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>2</b> 结果</div>
      <div class="option-panel">
        <table v-if="mode === 'dd2dms' && ddResult" class="data-table">
          <tbody>
            <tr><td>十进制度（°）</td><td>{{ fmt(ddResult.dd, 8) }}</td></tr>
            <tr><td>度</td><td>{{ ddResult.dms.d }}</td></tr>
            <tr><td>分</td><td>{{ ddResult.dms.m }}</td></tr>
            <tr><td>秒</td><td>{{ fmt(ddResult.dms.s, SEC_DIGITS) }}</td></tr>
            <tr><td>度分秒文本</td><td>{{ ddResult.dms.text }}</td></tr>
          </tbody>
        </table>

        <table v-else-if="mode === 'dms2dd' && dmsResult" class="data-table">
          <tbody>
            <tr><td>十进制度（°）</td><td>{{ fmt(dmsResult.dd, 8) }}</td></tr>
            <tr><td>符号</td><td>{{ dmsResult.sign < 0 ? '负（南纬 / 西经）' : '正（北纬 / 东经）' }}</td></tr>
            <tr><td>规范化度分秒</td><td>{{ dmsResult.dms.text }}</td></tr>
          </tbody>
        </table>

        <p v-else class="tool-note">请输入有效的度分秒或十进制度。</p>

        <div class="flex flex-wrap mt-4" style="gap:10px">
          <button type="button" class="el-button" @click="copyResult">复制结果</button>
        </div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>3</b> 粘贴文本自动识别</div>
      <div class="option-panel">
        <textarea
          v-model="pasteInput"
          class="el-textarea__inner"
          style="min-height:90px"
          spellcheck="false"
          placeholder="例如：116°24′26.64″ 或 N39°54′15″ 或 116 24 26.64"
        ></textarea>
        <div v-if="parsed" class="result-box mt-4">{{ parsedText }}</div>
        <p v-else-if="pasteInput.trim()" class="tool-note mt-2">无法识别输入，请检查数字与方向后缀。</p>
        <div v-if="parsed" class="flex flex-wrap mt-4" style="gap:10px">
          <button type="button" class="el-button" @click="copyText(parsedText, '识别结果已复制')">复制识别结果</button>
        </div>
      </div>
    </div>
  </ToolShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import ToolShell from '../../../components/ToolShell.vue'
import { msgError } from '../../../lib/ui.js'
import { copyText } from '../textkit.js'
import { ddToDms, dmsToDd, parseDms } from '../coordkit.js'

const SEC_DIGITS = 3
const HEMIS = [
  { value: 'N', label: '北 N（+）' },
  { value: 'S', label: '南 S（−）' },
  { value: 'E', label: '东 E（+）' },
  { value: 'W', label: '西 W（−）' }
]

const mode = ref('dd2dms')
const ddInput = ref('116.4074')
const degInput = ref('116')
const minInput = ref('24')
const secInput = ref('26.64')
const hemi = ref('N')
const pasteInput = ref('')

const fmt = (v, d = 8) => Number(v).toFixed(d)

function parseNum(raw) {
  const t = String(raw ?? '').trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function parseComponent(raw) {
  const t = String(raw ?? '').trim()
  if (!t) return 0
  const n = Number(t)
  return Number.isFinite(n) ? n : NaN
}

const ddResult = computed(() => {
  if (mode.value !== 'dd2dms') return null
  const dd = parseNum(ddInput.value)
  if (dd === null) return null
  return { dd, dms: ddToDms(dd, SEC_DIGITS) }
})

const dmsResult = computed(() => {
  if (mode.value !== 'dms2dd') return null
  const d = parseNum(degInput.value)
  if (d === null) return null
  const m = parseComponent(minInput.value)
  const s = parseComponent(secInput.value)
  if (!Number.isFinite(m) || !Number.isFinite(s)) return null
  const sign = hemi.value === 'S' || hemi.value === 'W' ? -1 : 1
  const dd = dmsToDd(d, m, s, sign)
  return { dd, sign, dms: ddToDms(dd, SEC_DIGITS) }
})

function copyResult() {
  let text = ''
  if (mode.value === 'dd2dms' && ddResult.value) {
    text = [
      `十进制度：${fmt(ddResult.value.dd, 8)}`,
      `度分秒：${ddResult.value.dms.text}`,
      `度：${ddResult.value.dms.d}  分：${ddResult.value.dms.m}  秒：${fmt(ddResult.value.dms.s, SEC_DIGITS)}`
    ].join('\n')
  } else if (mode.value === 'dms2dd' && dmsResult.value) {
    text = [
      `度分秒：${dmsResult.value.dms.text}`,
      `十进制度：${fmt(dmsResult.value.dd, 8)}`
    ].join('\n')
  } else {
    msgError('当前没有可复制的结果')
    return
  }
  copyText(text, '结果已复制')
}

const parsed = computed(() => {
  const t = pasteInput.value.trim()
  if (!t) return null
  const dd = parseDms(t)
  if (dd === null || !Number.isFinite(dd)) return null
  return { dd, dms: ddToDms(dd, SEC_DIGITS) }
})

const parsedText = computed(() => {
  const p = parsed.value
  if (!p) return ''
  return [`十进制度：${fmt(p.dd, 8)}`, `度分秒：${p.dms.text}`].join('\n')
})
</script>

<style scoped>
.coord-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.data-table th,
.data-table td {
  border-bottom: 1px solid var(--border);
  padding: 10px 12px;
  text-align: left;
}
.data-table td:first-child {
  color: #64748b;
  width: 40%;
}
.data-table td {
  font-variant-numeric: tabular-nums;
}
@media (max-width: 640px) {
  .coord-grid {
    grid-template-columns: 1fr;
  }
}
</style>
