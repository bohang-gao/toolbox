<template>
  <ToolShell
    path="/coord/map-convert"
    title="在线地图坐标系转换"
    intro="在 WGS84（GPS 原始）、GCJ02（火星坐标 / 高德腾讯）与 BD09（百度）之间互转。单点转换会给出经纬度偏移量，另支持每行一条的批量转换。算法采用国内通用的 GCJ02 加偏与 BD09 极坐标变换。"
    :usage="[
      '输入经度、纬度，选择源坐标系与目标坐标系，点击「转换」。',
      '偏移量用球面距离估算：Δ经度沿同一纬线量算，Δ纬度沿同一经线量算，单位米。',
      '批量转换每行格式为「经度,纬度」，最多逐行输出；无法解析的行会以 # 开头标注。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 单个坐标转换</div>
      <div class="option-panel">
        <div class="coord-grid">
          <label>
            <span class="form-label">经度</span>
            <input
              v-model="lonInput"
              class="el-input__inner mt-2"
              type="text"
              spellcheck="false"
              placeholder="116.4074"
              @keyup.enter="calc"
            />
          </label>
          <label>
            <span class="form-label">纬度</span>
            <input
              v-model="latInput"
              class="el-input__inner mt-2"
              type="text"
              spellcheck="false"
              placeholder="39.9042"
              @keyup.enter="calc"
            />
          </label>
          <label>
            <span class="form-label">源坐标系</span>
            <select v-model="from" class="el-input__inner mt-2">
              <option v-for="d in DATUMS" :key="d" :value="d">{{ DATUM_LABELS[d] }}</option>
            </select>
          </label>
          <label>
            <span class="form-label">目标坐标系</span>
            <select v-model="to" class="el-input__inner mt-2">
              <option v-for="d in DATUMS" :key="d" :value="d">{{ DATUM_LABELS[d] }}</option>
            </select>
          </label>
        </div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>2</b> 转换结果</div>
      <div class="option-panel">
        <template v-if="result">
        <table class="data-table">
          <thead>
            <tr>
              <th>项目</th>
              <th>数值</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>目标经度（°）</td>
              <td>{{ fmt(result.out.lon, 8) }}</td>
            </tr>
            <tr>
              <td>目标纬度（°）</td>
              <td>{{ fmt(result.out.lat, 8) }}</td>
            </tr>
            <tr>
              <td>Δ经度偏移（m）</td>
              <td>{{ fmt(result.dLonM, 3) }}</td>
            </tr>
            <tr>
              <td>Δ纬度偏移（m）</td>
              <td>{{ fmt(result.dLatM, 3) }}</td>
            </tr>
            <tr>
              <td>总偏移（m）</td>
              <td>{{ fmt(result.totalM, 3) }}</td>
            </tr>
          </tbody>
        </table>
        <p class="tool-note mt-2">偏移量正值表示目标坐标相对源坐标向东 / 向北移动。</p>
        <div class="result-box mt-4">{{ resultText }}</div>
        <div class="flex flex-wrap mt-4" style="gap:10px">
          <button type="button" class="el-button" @click="copyText(resultText, '结果已复制')">复制结果</button>
        </div>
        </template>
        <div v-else class="tool-note">输入经纬度并选择源 / 目标坐标系后点击「转换」，结果会显示在这里。</div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>3</b> 批量转换</div>
      <div class="option-panel">
        <div class="flex justify-between items-center">
          <span class="form-label">每行一条：经度,纬度</span>
          <span class="tool-note">{{ batchInput.split(/\r?\n/).filter(Boolean).length }} 行</span>
        </div>
        <textarea
          v-model="batchInput"
          class="el-textarea__inner mt-2"
          style="min-height:120px"
          spellcheck="false"
          placeholder="116.4074,39.9042&#10;121.4737,31.2304"
        ></textarea>
        <div class="flex flex-wrap mt-4" style="gap:10px">
          <button type="button" class="el-button el-button--primary" @click="calcBatch">批量转换</button>
          <button type="button" class="el-button" @click="copyText(batchOutput, '批量结果已复制')">复制结果</button>
        </div>
        <textarea
          v-if="batchOutput"
          v-model="batchOutput"
          class="el-textarea__inner mt-4"
          style="min-height:120px;background:#f8f8f8"
          readonly
        ></textarea>
      </div>
    </div>

    <div class="step-actions">
      <button type="button" class="el-button el-button--primary" @click="calc">转换</button>
      <button type="button" class="el-button el-button--info" @click="clearAll">清空</button>
    </div>
  </ToolShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import ToolShell from '../../../components/ToolShell.vue'
import { msgError, msgSuccess } from '../../../lib/ui.js'
import { copyText } from '../textkit.js'
import { convertChinaDatum, haversine } from '../coordkit.js'

const DATUMS = ['WGS84', 'GCJ02', 'BD09']
const DATUM_LABELS = {
  WGS84: 'WGS84（GPS 原始）',
  GCJ02: 'GCJ02（高德 / 腾讯）',
  BD09: 'BD09（百度）'
}

const lonInput = ref('116.4074')
const latInput = ref('39.9042')
const from = ref('WGS84')
const to = ref('GCJ02')
const result = ref(null)
const batchInput = ref('')
const batchOutput = ref('')

const fmt = (v, d = 8) => Number(v).toFixed(d)

function parseNum(raw) {
  const t = String(raw ?? '').trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function validate(lat, lon) {
  if (lat < -90 || lat > 90) return '纬度必须在 -90 ~ 90 之间'
  if (lon < -180 || lon > 180) return '经度必须在 -180 ~ 180 之间'
  return null
}

function calc() {
  const lat = parseNum(latInput.value)
  const lon = parseNum(lonInput.value)
  if (lat === null || lon === null) {
    result.value = null
    msgError('经度或纬度不是有效数字')
    return
  }
  const err = validate(lat, lon)
  if (err) {
    result.value = null
    msgError(err)
    return
  }
  const out = convertChinaDatum(lat, lon, from.value, to.value)
  const dLonM = Math.sign(out.lon - lon) * haversine(lat, lon, lat, out.lon)
  const dLatM = Math.sign(out.lat - lat) * haversine(lat, lon, out.lat, lon)
  result.value = {
    lat,
    lon,
    out,
    from: from.value,
    to: to.value,
    dLonM,
    dLatM,
    totalM: Math.hypot(dLonM, dLatM)
  }
}

const resultText = computed(() => {
  const r = result.value
  if (!r) return ''
  return [
    `${r.from} → ${r.to}`,
    `源坐标：${fmt(r.lon, 8)}, ${fmt(r.lat, 8)}`,
    `目标坐标：${fmt(r.out.lon, 8)}, ${fmt(r.out.lat, 8)}`,
    `Δ经度：${fmt(r.dLonM, 3)} m`,
    `Δ纬度：${fmt(r.dLatM, 3)} m`,
    `总偏移：${fmt(r.totalM, 3)} m`
  ].join('\n')
})

function calcBatch() {
  const lines = batchInput.value.split(/\r?\n/)
  const outLines = []
  let okCount = 0
  let badCount = 0
  lines.forEach((line, idx) => {
    const raw = line.trim()
    if (!raw) return
    if (raw.startsWith('#')) {
      outLines.push(raw)
      return
    }
    const tokens = raw.split(/[,\s，]+/).filter(Boolean)
    const lon = tokens.length >= 2 ? parseNum(tokens[0]) : null
    const lat = tokens.length >= 2 ? parseNum(tokens[1]) : null
    if (lon === null || lat === null) {
      outLines.push(`# 第${idx + 1}行无法解析：${raw}`)
      badCount++
      return
    }
    const err = validate(lat, lon)
    if (err) {
      outLines.push(`# 第${idx + 1}行超出范围：${raw}`)
      badCount++
      return
    }
    const out = convertChinaDatum(lat, lon, from.value, to.value)
    outLines.push(`${fmt(out.lon, 8)}, ${fmt(out.lat, 8)}`)
    okCount++
  })
  batchOutput.value = outLines.join('\n')
  if (!okCount && !badCount) {
    msgError('没有可转换的内容')
    return
  }
  msgSuccess(`批量完成：成功 ${okCount} 行${badCount ? `，失败 ${badCount} 行` : ''}`)
}

function clearAll() {
  lonInput.value = ''
  latInput.value = ''
  result.value = null
  batchInput.value = ''
  batchOutput.value = ''
}
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
.data-table th {
  color: #64748b;
  font-weight: 600;
  background: #f8fafc;
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
