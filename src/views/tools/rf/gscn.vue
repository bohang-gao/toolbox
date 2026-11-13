<template>
  <ToolShell
    path="/rf/gscn"
    title="SSB GSCN 换算"
    desc="GSCN ↔ 同步栅格频点 SS_REF ↔ NR-ARFCN 三角互转（TS 38.104 表 5.4.3.1-1）"
    intro="按 TS 38.104 表 5.4.3.1-1 的三段同步栅格，在 GSCN、SS_REF 与 NR-ARFCN 之间互转，并给出 N/M 反解、最近 NR-ARFCN 与栅格偏差。"
    :usage="[
      '选择换算模式（GSCN → 频率 / 频率 → GSCN / ARFCN → GSCN），填写数值后点「计算」或按回车。',
      'GSCN 模式的结果包含 SS_REF、N、M、所属段与最近 NR-ARFCN；频率模式可按 MHz 或 GHz 输入。',
      '第一段（<3 GHz）同步栅格是每 1.2 MHz 一组、组内 3 个 100 kHz 点，组间有空洞；频率落在空洞时会列出附近候选 GSCN。',
      '最近 NR-ARFCN 按 NR-ARFCN 全局栅格折算，SS_REF 未必正好落在 ARFCN 栅格上，页面会显式标注。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 输入与参数</div>
      <div class="option-panel">
        <div class="field-grid">
          <label class="field">
            <span class="form-label">换算模式</span>
            <select v-model="mode" class="el-input__inner">
              <option value="gscn">GSCN → 频率</option>
              <option value="freq">频率 → GSCN</option>
              <option value="arfcn">ARFCN → GSCN</option>
            </select>
          </label>
          <label class="field">
            <span class="form-label">{{ inputLabel }}</span>
            <input
              v-model="valueInput"
              class="el-input__inner"
              type="text"
              :inputmode="mode === 'freq' ? 'decimal' : 'numeric'"
              spellcheck="false"
              :placeholder="placeholder"
              @keyup.enter="calc"
            />
          </label>
          <label v-if="mode === 'freq'" class="field">
            <span class="form-label">频率单位</span>
            <select v-model="unit" class="el-input__inner">
              <option value="MHz">MHz</option>
              <option value="GHz">GHz</option>
            </select>
          </label>
        </div>

        <div class="flex flex-wrap mt-4" style="gap:10px;align-items:center">
          <button type="button" class="el-button" @click="fillExample">填入示例</button>
          <span class="tool-note" style="margin:0">示例：GSCN 5400 / 频率 2160.15 MHz / ARFCN 432030</span>
        </div>

        <div class="tool-note">
          <template v-if="mode === 'gscn'">输入整数 GSCN（{{ groupNumber(GSCN_MIN) }} – {{ groupNumber(GSCN_MAX) }}），按同步栅格公式折算 SS_REF 与 N/M，并追加最近 NR-ARFCN。</template>
          <template v-else-if="mode === 'freq'">输入同步栅格频点 SS_REF（0 – 100000 MHz），返回最近 GSCN；不在栅格上时给出偏差与附近候选。</template>
          <template v-else>输入 NR-ARFCN（{{ groupNumber(ARFCN_MIN) }} – {{ groupNumber(ARFCN_MAX) }}），先折算为频率，再求最近 GSCN。</template>
        </div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>2</b> 换算结果</div>
      <div class="option-panel">
        <template v-if="result">
          <table class="data-table">
            <tbody>
              <tr v-for="[k, v] in result.rows" :key="k">
                <td class="k">{{ k }}</td>
                <td class="v">{{ v }}</td>
              </tr>
            </tbody>
          </table>

          <div class="result-box mt-4" :style="rasterStyle">{{ result.raster.text }}</div>

          <template v-if="result.candidates.length > 1">
            <div class="form-label mt-4">附近候选 GSCN</div>
            <table class="data-table mt-2">
              <thead>
                <tr>
                  <th>GSCN</th>
                  <th>SS_REF</th>
                  <th>N</th>
                  <th>M</th>
                  <th>与本频率的偏差</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in result.candidates" :key="c.gscn">
                  <td>{{ groupNumber(c.gscn) }}{{ c.isNearest ? '（最近）' : '' }}</td>
                  <td>{{ freqCell(c.freqMHz) }}</td>
                  <td>{{ c.N == null ? '—' : groupNumber(c.N) }}</td>
                  <td>{{ c.M == null ? '—' : groupNumber(c.M) }}</td>
                  <td>{{ khzText(c.deltaKHz) }}</td>
                </tr>
              </tbody>
            </table>
            <div class="tool-note">第一段同步栅格每 1.2 MHz 一组、组内 3 个 100 kHz 点，组间存在约 1 MHz 空洞，故「最近」未必与输入频率两侧对称。</div>
          </template>

          <div class="result-box mt-4">{{ result.text }}</div>
          <div class="flex mt-4">
            <button type="button" class="el-button el-button--info" @click="copyText(result.text, '结果已复制')">复制结果</button>
          </div>
        </template>
        <div v-else class="tool-note">选择换算模式并填写数值后点击「计算」，结果会显示在这里。</div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>3</b> 栅格参数表</div>
      <div class="option-panel">
        <table class="data-table">
          <thead>
            <tr>
              <th>频段</th>
              <th>SS_REF 公式</th>
              <th>GSCN 范围</th>
              <th>频率范围</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="seg in GSCN_SEGMENTS" :key="seg.key">
              <td>{{ seg.label }}</td>
              <td>{{ seg.formula }}</td>
              <td>{{ groupNumber(seg.gMin) }} – {{ groupNumber(seg.gMax) }}</td>
              <td>{{ mhzRange(seg.fMin, seg.fMax) }}</td>
            </tr>
          </tbody>
        </table>
        <div class="tool-note">
          第一段（<3 GHz）的同步栅格是「每 1.2 MHz 一组、组内 3 个点间隔 100 kHz」，组与组之间有约 1 MHz 空洞，
          因此并非任意 100 kHz 整数频率都有对应 GSCN。
        </div>
      </div>
    </div>

    <div class="step-actions">
      <button type="button" class="el-button el-button--primary" @click="calc">计算</button>
      <button type="button" class="el-button el-button--info" @click="clearAll">清空</button>
    </div>
  </ToolShell>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import ToolShell from '../../../components/ToolShell.vue'
import { msgError } from '../../../lib/ui.js'
import { copyText } from '../textkit.js'
import {
  ARFCN_MAX,
  ARFCN_MIN,
  GSCN_MAX,
  GSCN_MIN,
  GSCN_SEGMENTS,
  arfcnToFreq,
  formatFreq,
  freqToArfcn,
  gscnToSsRef,
  groupNumber,
  ssRefToGscn
} from '../nrkit.js'

const EXAMPLE = { gscn: '5400', freq: '2160.15', arfcn: '432030' }

const mode = ref('gscn')
const valueInput = ref('5400')
const unit = ref('MHz')
const result = ref(null)

const inputLabel = computed(() => {
  if (mode.value === 'gscn') return `GSCN（${groupNumber(GSCN_MIN)} – ${groupNumber(GSCN_MAX)}）`
  if (mode.value === 'freq') return 'SS_REF 频率'
  return 'NR-ARFCN'
})

const placeholder = computed(() => EXAMPLE[mode.value])

const rasterStyle = computed(() =>
  result.value && result.value.raster.ok
    ? 'color:#15803d;border-color:#bbf7d0;background:#f0fdf4'
    : 'color:#b45309;border-color:#fde68a;background:#fffbeb;font-weight:600'
)

watch([mode, unit], () => {
  result.value = null
})

function numOf(v) {
  const t = String(v == null ? '' : v).trim()
  if (t === '') return NaN
  const n = Number(t)
  return Number.isFinite(n) ? n : NaN
}

function khzText(v) {
  const n = Math.abs(Number(v)) < 5e-4 ? 0 : Number(v)
  if (n === 0) return `${groupNumber(0, 3)} kHz`
  return `${n > 0 ? '+' : '−'}${groupNumber(Math.abs(n), 3)} kHz`
}

/** 频率展示：formatFreq 为主，≥1000 MHz 时补一个精确 MHz 值 */
function freqCell(f) {
  const text = formatFreq(f, 5)
  return Math.abs(Number(f)) >= 1000 ? `${text}（${Number(f).toFixed(3)} MHz）` : text
}

function mhzRange(a, b) {
  const dec = (v) => (Number(v) % 1 === 0 ? 0 : 2)
  return `${groupNumber(a, dec(a))} – ${groupNumber(b, dec(b))} MHz`
}

function mText(m) {
  return m == null ? '—' : groupNumber(m)
}

function fail(message) {
  result.value = null
  msgError(message)
}

function buildCandidates(list, inputFreq, nearestGscn) {
  return list.map((c) => {
    const d = gscnToSsRef(c.gscn)
    return {
      gscn: c.gscn,
      freqMHz: c.freqMHz,
      N: d ? d.N : null,
      M: d ? d.M : null,
      deltaKHz: (inputFreq - c.freqMHz) * 1000,
      isNearest: c.gscn === nearestGscn
    }
  })
}

function buildResult(rows, raster, candidates) {
  const lines = rows.map(([k, v]) => `${k}：${v}`)
  lines.push(`栅格判定：${raster.text}`)
  if (candidates.length > 1) {
    lines.push('附近候选 GSCN：')
    for (const c of candidates) {
      lines.push(
        `GSCN ${groupNumber(c.gscn)}  SS_REF ${freqCell(c.freqMHz)}  N=${c.N == null ? '—' : groupNumber(c.N)}  M=${c.M == null ? '—' : groupNumber(c.M)}  偏差 ${khzText(c.deltaKHz)}`
      )
    }
  }
  return { rows, raster, candidates, text: lines.join('\n') }
}

function calcGscn() {
  const g = numOf(valueInput.value)
  if (!Number.isInteger(g)) {
    return fail(`GSCN 必须是 ${groupNumber(GSCN_MIN)} – ${groupNumber(GSCN_MAX)} 之间的整数`)
  }
  const ss = gscnToSsRef(g)
  if (!ss) {
    return fail(`GSCN 超出范围：有效范围 ${groupNumber(GSCN_MIN)} – ${groupNumber(GSCN_MAX)}`)
  }
  const seg = ss.segment
  const hit = freqToArfcn(ss.freqMHz)
  const rows = [
    ['GSCN', groupNumber(ss.gscn)],
    ['SS_REF', freqCell(ss.freqMHz)],
    ['N', groupNumber(ss.N)],
    ['M', mText(ss.M)],
    ['所属段', seg.label],
    ['该段 GSCN 范围', `${groupNumber(seg.gMin)} – ${groupNumber(seg.gMax)}`],
    ['段公式', seg.formula],
    ['最近 NR-ARFCN', hit ? groupNumber(hit.arfcn) : '—'],
    ['落在 NR-ARFCN 栅格', hit ? (hit.isExact ? '是' : '否') : '—'],
    ['ARFCN 偏差', hit ? khzText(hit.deltaKHz) : '—']
  ]
  let raster
  if (!hit) {
    raster = { ok: false, text: '该 SS_REF 超出 NR-ARFCN 可用范围，无法折算最近 ARFCN。' }
  } else if (hit.isExact) {
    raster = { ok: true, text: `SS_REF 落在 NR-ARFCN 栅格上（最近 NR-ARFCN = ${groupNumber(hit.arfcn)}，偏差 0 kHz）。` }
  } else {
    raster = {
      ok: false,
      text: `SS_REF 不在 NR-ARFCN 栅格上，最近 NR-ARFCN = ${groupNumber(hit.arfcn)}（${freqCell(hit.snappedMHz)}，偏差 ${khzText(hit.deltaKHz)}）。`
    }
  }
  return buildResult(rows, raster, [])
}

function calcFreq() {
  const raw = numOf(valueInput.value)
  if (!Number.isFinite(raw)) {
    return fail('频率必须是有效数字')
  }
  const freqMHz = unit.value === 'GHz' ? raw * 1000 : raw
  if (freqMHz < 0 || freqMHz > 100000) {
    return fail('频率必须在 0 – 100000 MHz 之间')
  }
  const r = ssRefToGscn(freqMHz)
  if (!r) {
    return fail('该频率超出同步栅格覆盖范围')
  }
  const seg = r.segment
  const hit = freqToArfcn(freqMHz)
  const inputText = unit.value === 'GHz' ? `${raw} GHz（${freqMHz} MHz）` : `${raw} MHz`
  const rows = [
    ['输入频率', inputText],
    ['GSCN', groupNumber(r.gscn)],
    ['SS_REF', freqCell(r.freqMHz)],
    ['N', groupNumber(r.N)],
    ['M', mText(r.M)],
    ['所属段', seg.label],
    ['栅格偏差', khzText(r.deltaKHz)],
    ['最近 NR-ARFCN', hit ? groupNumber(hit.arfcn) : '—']
  ]
  const raster = r.inRaster
    ? { ok: true, text: '该频率落在同步栅格上。' }
    : {
        ok: false,
        text: `该频率不在同步栅格上，最近 GSCN = ${groupNumber(r.gscn)}（SS_REF = ${freqCell(r.freqMHz)}，偏差 ${khzText(r.deltaKHz)}）。`
      }
  const candidates = r.candidates.length > 1 ? buildCandidates(r.candidates, freqMHz, r.gscn) : []
  return buildResult(rows, raster, candidates)
}

function calcArfcn() {
  const a = numOf(valueInput.value)
  if (!Number.isInteger(a) || a < ARFCN_MIN || a > ARFCN_MAX) {
    return fail(`NR-ARFCN 必须是 ${groupNumber(ARFCN_MIN)} – ${groupNumber(ARFCN_MAX)} 之间的整数`)
  }
  const entry = arfcnToFreq(a)
  if (!entry) {
    return fail('NR-ARFCN 超出范围，无法折算频率')
  }
  const r = ssRefToGscn(entry.freqMHz)
  if (!r) {
    return fail('该 ARFCN 对应频率超出同步栅格覆盖范围')
  }
  const seg = r.segment
  const rows = [
    ['输入 NR-ARFCN', groupNumber(a)],
    ['ARFCN 对应频率', freqCell(entry.freqMHz)],
    ['GSCN', groupNumber(r.gscn)],
    ['SS_REF', freqCell(r.freqMHz)],
    ['N', groupNumber(r.N)],
    ['M', mText(r.M)],
    ['所属段', seg.label],
    ['栅格偏差', khzText(r.deltaKHz)]
  ]
  const raster = r.inRaster
    ? { ok: true, text: '该 ARFCN 对应频率落在同步栅格上。' }
    : {
        ok: false,
        text: `该 ARFCN 对应频率不在同步栅格上，最近 GSCN = ${groupNumber(r.gscn)}（SS_REF = ${freqCell(r.freqMHz)}，偏差 ${khzText(r.deltaKHz)}）。`
      }
  const candidates = r.candidates.length > 1 ? buildCandidates(r.candidates, entry.freqMHz, r.gscn) : []
  return buildResult(rows, raster, candidates)
}

function calc() {
  result.value = null
  const next =
    mode.value === 'gscn' ? calcGscn() : mode.value === 'freq' ? calcFreq() : calcArfcn()
  // 各 calcXxx 在失败时已通过 fail() 提示并返回 undefined
  if (next) result.value = next
}

function fillExample() {
  valueInput.value = EXAMPLE[mode.value]
  if (mode.value === 'freq') unit.value = 'MHz'
  result.value = null
}

function clearAll() {
  valueInput.value = ''
  result.value = null
}
</script>

<style scoped>
.field-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 14px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field .form-label {
  margin-right: 0;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.data-table th,
.data-table td {
  border-bottom: 1px solid var(--border);
  padding: 9px 12px;
  text-align: left;
  vertical-align: top;
}
.data-table th {
  color: #64748b;
  font-weight: 600;
  background: #f8fafc;
}
.data-table td.k {
  color: #64748b;
  width: 132px;
  white-space: nowrap;
}
.data-table td.v {
  font-family: Consolas, Menlo, monospace;
  word-break: break-word;
}
@media (max-width: 640px) {
  .field-grid {
    grid-template-columns: 1fr;
  }
  .data-table td.k {
    width: 110px;
  }
}
</style>
