<template>
  <ToolShell
    path="/rf/arfcn"
    title="NR 频点换算"
    desc="NR-ARFCN 与频率的双向换算（TS 38.104 表 5.4.2.1-1 三段全局频率栅格）"
    intro="输入 NR-ARFCN 或频率（MHz / GHz），按 3GPP TS 38.104 表 5.4.2.1-1 的三段全局频率栅格双向换算，并自动做一次往返校验。"
    :usage="[
      '选择换算模式，填入 ARFCN（0 ~ 3279165 的整数）或频率；频率模式可切换 MHz / GHz，选 GHz 时先乘 1000 换成 MHz 再计算。',
      '按回车或点「计算」。频率不落在 NR 栅格点上时，结果会给出最近的 N_REF 及其偏差（kHz）。',
      '所有数值均按 TS 38.104 表 5.4.2.1-1 计算，页面底部附三段栅格参数表；第三段 F_REF-Offs 取规范值 24250 MHz。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 输入与参数</div>
      <div class="option-panel">
        <div class="field-grid">
          <div class="field">
            <span class="form-label">换算模式</span>
            <div class="radio-row">
              <label class="el-radio"><input v-model="mode" type="radio" value="toFreq" />ARFCN → 频率</label>
              <label class="el-radio"><input v-model="mode" type="radio" value="toArfcn" />频率 → ARFCN</label>
            </div>
          </div>
          <label class="field">
            <span class="form-label">{{ mode === 'toFreq' ? 'N_REF（ARFCN）' : `频率（${unit}）` }}</span>
            <input
              v-model="value"
              class="el-input__inner"
              type="text"
              inputmode="decimal"
              spellcheck="false"
              :placeholder="mode === 'toFreq' ? '432000' : '2160'"
              @keyup.enter="calc"
            />
          </label>
          <label v-if="mode === 'toArfcn'" class="field">
            <span class="form-label">频率单位</span>
            <select v-model="unit" class="el-input__inner">
              <option value="MHz">MHz</option>
              <option value="GHz">GHz</option>
            </select>
          </label>
          <div class="field">
            <span class="form-label">示例</span>
            <button type="button" class="el-button" @click="fillSample">填入示例</button>
          </div>
        </div>

        <div class="tool-note">
          <template v-if="mode === 'toFreq'">输入 0 ~ 3279165 之间的整数 ARFCN，换算得到对应的 F_REF。</template>
          <template v-else>输入中心频率，换算得到最近的 N_REF；GHz 会自动乘 1000 转成 MHz。</template>
        </div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>2</b> 换算结果</div>
      <div class="option-panel">
        <template v-if="result">
          <div v-if="result.warn" class="result-box mt-2">{{ result.warn }}</div>
          <table class="data-table">
            <tbody>
              <tr v-for="([k, v]) in result.rows" :key="k">
                <td class="k">{{ k }}</td>
                <td class="v">{{ v }}</td>
              </tr>
            </tbody>
          </table>
          <div class="result-box mt-4">{{ result.text }}</div>
          <div class="flex mt-4">
            <button type="button" class="el-button el-button--info" @click="copyText(result.text, '结果已复制')">复制结果</button>
          </div>
        </template>
        <div v-else class="tool-note">填写上方参数后点击「计算」，结果会显示在这里。</div>
      </div>
    </div>

    <div class="step-actions">
      <button type="button" class="el-button el-button--primary" @click="calc">计算</button>
      <button type="button" class="el-button el-button--info" @click="clearAll">清空</button>
    </div>

    <div class="step-block">
      <div class="step"><b>3</b> 栅格参数表（TS 38.104 表 5.4.2.1-1）</div>
      <div class="option-panel">
        <table class="data-table seg-table">
          <thead>
            <tr>
              <th>段</th>
              <th>频率范围 (MHz)</th>
              <th>ΔF_Global</th>
              <th>N_REF 范围</th>
              <th>F_REF-Offs</th>
              <th>N_REF-Offs</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="seg in ARFCN_SEGMENTS" :key="seg.key">
              <td>{{ seg.label }}</td>
              <td>{{ groupNumber(seg.fMin) }} – {{ groupNumber(seg.fMax) }}</td>
              <td>{{ seg.deltaFKHz }} kHz</td>
              <td>{{ groupNumber(seg.nMin) }} – {{ groupNumber(seg.nMax) }}</td>
              <td>{{ groupNumber(seg.fRefOffs) }} MHz</td>
              <td>{{ groupNumber(seg.nRefOffs) }}</td>
            </tr>
          </tbody>
        </table>

        <div class="tool-note">
          本工具按 TS 38.104 表 5.4.2.1-1 取第三段 F_REF-Offs = 24250 MHz。<br />
          项目参考脚本 plot_cell_freq_domain.py 使用 24250.08 MHz（该值是 GSCN 表 5.4.3.1-1 的偏移量），<br />
          因此在 &gt;24.25 GHz 段两者相差 80 kHz，例如 N_REF = 2072499 → 规范 27599.92 MHz，脚本 27600.00 MHz。
        </div>
      </div>
    </div>
  </ToolShell>
</template>

<script setup>
import { ref, watch } from 'vue'
import ToolShell from '../../../components/ToolShell.vue'
import { msgError } from '../../../lib/ui.js'
import { copyText } from '../textkit.js'
import {
  ARFCN_SEGMENTS,
  ARFCN_MIN,
  ARFCN_MAX,
  arfcnToFreq,
  freqToArfcn,
  groupNumber,
  formatFreq
} from '../nrkit.js'

const mode = ref('toFreq')
const value = ref('432000')
const unit = ref('MHz')
const result = ref(null)

watch([mode, unit], () => {
  result.value = null
})

function numOf(v) {
  const t = String(v == null ? '' : v).trim()
  if (t === '') return NaN
  const n = Number(t)
  return Number.isFinite(n) ? n : NaN
}

const fmtMHz = (f) => `${Number(f).toFixed(3)} MHz`
const fmtKHz = (v) => `${Number(v).toFixed(3)} kHz`
/** 回显用户输入频率：保留 6 位小数并去掉末尾多余的 0 */
const trimNum = (v) => String(Number(Number(v).toFixed(6)))

/** >=1000 MHz 时附带 GHz 表示（formatFreq），主值仍以 MHz 保留 kHz 精度 */
function freqCell(f) {
  const mhz = Number(f)
  if (Math.abs(mhz) >= 1000) return `${fmtMHz(mhz)}（${formatFreq(mhz, 5)}）`
  return fmtMHz(mhz)
}

function fail(message) {
  result.value = null
  msgError(message)
}

function finalize(rows, warn = '') {
  result.value = {
    rows,
    warn,
    text: rows.map(([k, v]) => `${k}：${v}`).join('\n')
  }
}

function roundTripText(deltaKHz) {
  return Math.abs(deltaKHz) < 1e-6 ? '通过' : `偏差 ${fmtKHz(deltaKHz)}`
}

function calcToFreq() {
  const n = numOf(value.value)
  if (!Number.isFinite(n)) return fail('请输入有效的 ARFCN 数值')
  if (!Number.isInteger(n)) return fail('ARFCN 必须是整数')
  if (n < ARFCN_MIN || n > ARFCN_MAX) return fail(`ARFCN 超出范围（${ARFCN_MIN} ~ ${ARFCN_MAX}）`)

  const r = arfcnToFreq(n)
  if (!r) return fail('ARFCN 无法换算，请检查输入')

  const seg = r.segment
  const back = freqToArfcn(r.freqMHz)
  const rtDelta = back ? (r.freqMHz - back.snappedMHz) * 1000 : NaN
  const formula = `F_REF = ${seg.fRefOffs} + ${seg.deltaFKHz} kHz × (${n} − ${seg.nRefOffs}) = ${fmtMHz(r.freqMHz)}`

  finalize([
    ['N_REF', groupNumber(n)],
    ['F_REF', freqCell(r.freqMHz)],
    ['所属段', seg.label],
    ['频率范围标识', r.frLabel],
    ['ΔF_Global', `${seg.deltaFKHz} kHz`],
    ['N_REF 取值范围', `${groupNumber(seg.nMin)} – ${groupNumber(seg.nMax)}`],
    ['代入公式', formula],
    ['往返校验', roundTripText(rtDelta)]
  ])
}

function calcToArfcn() {
  const raw = numOf(value.value)
  if (!Number.isFinite(raw)) return fail('请输入有效的频率数值')
  const freqMHz = unit.value === 'GHz' ? raw * 1000 : raw
  if (freqMHz <= 0) return fail('频率必须大于 0 MHz')
  if (freqMHz > 100000) return fail('频率超出范围（0 ~ 100000 MHz）')

  const r = freqToArfcn(freqMHz)
  if (!r) return fail('频率超出 NR 全局频率栅格范围')

  const seg = r.segment
  const back = arfcnToFreq(r.arfcn)
  const rtDelta = back ? (back.freqMHz - r.snappedMHz) * 1000 : NaN
  const inputText =
    unit.value === 'GHz'
      ? `${trimNum(raw)} GHz（${trimNum(freqMHz)} MHz）`
      : `${trimNum(freqMHz)} MHz`
  const warn = r.isExact
    ? ''
    : `该频率不在 NR 栅格点上，最近的 N_REF 对应 ${fmtMHz(r.snappedMHz)}，偏差 ${fmtKHz(r.deltaKHz)}`

  finalize(
    [
      ['输入频率', inputText],
      ['最近 N_REF', groupNumber(r.arfcn)],
      ['该 N_REF 对应频率', freqCell(r.snappedMHz)],
      ['栅格偏差 (kHz)', fmtKHz(r.deltaKHz)],
      ['是否精确命中', r.isExact ? '是' : '否'],
      ['所属段', seg.label],
      ['频率范围标识', seg.frLabel],
      ['ΔF_Global', `${seg.deltaFKHz} kHz`],
      ['往返校验', roundTripText(rtDelta)]
    ],
    warn
  )
}

function calc() {
  result.value = null
  if (mode.value === 'toFreq') return calcToFreq()
  return calcToArfcn()
}

function fillSample() {
  if (mode.value === 'toFreq') {
    value.value = '432000'
  } else {
    unit.value = 'MHz'
    value.value = '2160'
  }
  result.value = null
}

function clearAll() {
  value.value = ''
  result.value = null
}
</script>

<style scoped>
.field-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
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
.radio-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  min-height: 40px;
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
.data-table td.k {
  width: 132px;
  color: #64748b;
  white-space: nowrap;
}
.data-table td.v {
  font-family: Consolas, Menlo, monospace;
  word-break: break-all;
}
.seg-table th {
  color: #64748b;
  font-weight: 600;
  white-space: nowrap;
}
.seg-table td {
  white-space: nowrap;
}
@media (max-width: 640px) {
  .field-grid {
    grid-template-columns: 1fr;
  }
  .data-table td.k {
    width: 110px;
  }
  .seg-table td,
  .seg-table th {
    white-space: normal;
  }
}
</style>
