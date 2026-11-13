<template>
  <ToolShell
    path="/rf/arfcn"
    title="NR 频点换算"
    desc="NR-ARFCN 与频率的双向换算（TS 38.104 表 5.4.2.1-1 三段全局频率栅格）"
    intro="NR-ARFCN 与频率两个输入框双向联动：在任一侧填入数值，另一侧即时显示换算结果，并按 3GPP TS 38.104 表 5.4.2.1-1 的三段全局频率栅格给出所属段、栅格偏差与往返校验。"
    :usage="[
      '在「N_REF（ARFCN）」填入 0 ~ 3279165 的整数，右侧频率框即时显示对应 F_REF；反过来在频率框填数值，ARFCN 框即时显示最近的 N_REF。',
      '频率支持 MHz / GHz 切换，切换后换算值按新单位重新显示。',
      '频率不落在 NR 栅格点上时，ARFCN 框显示的是最近的 N_REF，结果区会给出偏差（kHz）与是否精确命中。',
      '所有数值均按 TS 38.104 表 5.4.2.1-1 计算，页面底部附三段栅格参数表；第三段 F_REF-Offs 取规范值 24250 MHz。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 输入（任填一侧，另一侧自动换算）</div>
      <div class="option-panel">
        <div class="coord-grid">
          <label>
            <span class="form-label">N_REF（ARFCN）</span>
            <input
              v-model="arfcnInput"
              class="el-input__inner mt-2"
              type="text"
              inputmode="numeric"
              spellcheck="false"
              placeholder="0 ~ 3279165"
              @input="syncFromArfcn"
              @keyup.enter="syncFromArfcn"
            />
          </label>
          <label>
            <span class="form-label">频率（{{ unit }}）</span>
            <input
              v-model="freqInput"
              class="el-input__inner mt-2"
              type="text"
              inputmode="decimal"
              spellcheck="false"
              :placeholder="unit === 'GHz' ? '2.16' : '2160'"
              @input="syncFromFreq"
              @keyup.enter="syncFromFreq"
            />
          </label>
        </div>

        <div class="flex flex-wrap mt-4" style="gap:10px;align-items:center">
          <span class="form-label" style="margin:0">频率单位</span>
          <select v-model="unit" class="el-input__inner unit-select" @change="onUnitChange">
            <option value="MHz">MHz</option>
            <option value="GHz">GHz</option>
          </select>
          <button type="button" class="el-button" @click="fillSample">填入示例</button>
          <span class="tool-note" style="margin:0">示例：ARFCN 432000 ↔ 2160 MHz</span>
        </div>

        <div v-if="error" class="result-box mt-4" style="color:#e54d42">{{ error }}</div>
        <div v-else class="tool-note">两侧任填其一即可，输入过程中实时换算，无需点按钮。</div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>2</b> 换算结果</div>
      <div class="option-panel">
        <template v-if="result">
          <div v-if="result.warn" class="result-box mt-2" style="color:#b45309;border-color:#fde68a;background:#fffbeb">
            {{ result.warn }}
          </div>
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
        <div v-else class="tool-note">在任一输入框填入 ARFCN 或频率，换算结果会显示在这里。</div>
      </div>
    </div>

    <div class="step-actions">
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
import { ref } from 'vue'
import ToolShell from '../../../components/ToolShell.vue'
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

const arfcnInput = ref('432000')
const freqInput = ref('2160')
const unit = ref('MHz')
const result = ref(null)
const error = ref('')
/** 用户最后编辑的是哪一侧：'arfcn' | 'freq'，切换单位时以它为准 */
const lastSide = ref('arfcn')

const fmtMHz = (f) => `${Number(f).toFixed(3)} MHz`
const fmtKHz = (v) => `${Number(v).toFixed(3)} kHz`
/** 回显数值：最多 6 位小数，去掉末尾多余的 0 */
const trimNum = (v) => String(Number(Number(v).toFixed(6)))
/** 单位换算用：9 位小数，避免 MHz → GHz → MHz 往返丢精度（如 2160.0025） */
const trimNum9 = (v) => String(Number(Number(v).toFixed(9)))

/** 频率换算值在输入框里的回显文本（按当前单位） */
function freqFieldText(freqMHz) {
  const v = unit.value === 'GHz' ? Number(freqMHz) / 1000 : Number(freqMHz)
  return trimNum(v)
}

/** >=1000 MHz 时附带 GHz 表示（formatFreq），主值仍以 MHz 保留 kHz 精度 */
function freqCell(f) {
  const mhz = Number(f)
  if (Math.abs(mhz) >= 1000) return `${fmtMHz(mhz)}（${formatFreq(mhz, 5)}）`
  return fmtMHz(mhz)
}

function roundTripText(deltaKHz) {
  return Math.abs(deltaKHz) < 1e-6 ? '通过' : `偏差 ${fmtKHz(deltaKHz)}`
}

function finalize(rows, warn = '') {
  result.value = {
    rows,
    warn,
    text: rows.map(([k, v]) => `${k}：${v}`).join('\n')
  }
}

/** 实时输入不适合弹 toast，改为页面内提示并清空结果 */
function invalidate(message) {
  error.value = message
  result.value = null
}

/** ARFCN 侧输入 → 算出频率并回填频率框 */
function syncFromArfcn() {
  lastSide.value = 'arfcn'
  error.value = ''
  const raw = String(arfcnInput.value ?? '').trim()
  if (raw === '') {
    freqInput.value = ''
    result.value = null
    return
  }
  const n = Number(raw)
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    freqInput.value = ''
    return invalidate('ARFCN 必须是整数')
  }
  if (n < ARFCN_MIN || n > ARFCN_MAX) {
    freqInput.value = ''
    return invalidate(`ARFCN 超出范围（${groupNumber(ARFCN_MIN)} ~ ${groupNumber(ARFCN_MAX)}）`)
  }
  const r = arfcnToFreq(n)
  if (!r) {
    freqInput.value = ''
    return invalidate('ARFCN 无法换算，请检查输入')
  }

  freqInput.value = freqFieldText(r.freqMHz)

  const seg = r.segment
  const back = freqToArfcn(r.freqMHz)
  const rtDelta = back ? (r.freqMHz - back.snappedMHz) * 1000 : NaN

  finalize([
    ['输入方向', 'N_REF → F_REF'],
    ['N_REF', groupNumber(n)],
    ['F_REF', freqCell(r.freqMHz)],
    ['所属段', seg.label],
    ['频率范围标识', r.frLabel],
    ['ΔF_Global', `${seg.deltaFKHz} kHz`],
    ['N_REF 取值范围', `${groupNumber(seg.nMin)} – ${groupNumber(seg.nMax)}`],
    ['栅格偏差', '0.000 kHz（ARFCN 栅格点）'],
    ['代入公式', `F_REF = ${seg.fRefOffs} + ${seg.deltaFKHz} kHz × (${n} − ${seg.nRefOffs}) = ${fmtMHz(r.freqMHz)}`],
    ['往返校验', roundTripText(rtDelta)]
  ])
}

/** 频率侧输入 → 算出最近 ARFCN 并回填 ARFCN 框 */
function syncFromFreq() {
  lastSide.value = 'freq'
  error.value = ''
  const raw = String(freqInput.value ?? '').trim()
  if (raw === '') {
    arfcnInput.value = ''
    result.value = null
    return
  }
  const v = Number(raw)
  if (!Number.isFinite(v)) {
    arfcnInput.value = ''
    return invalidate('频率必须是有效数字')
  }
  const freqMHz = unit.value === 'GHz' ? v * 1000 : v
  if (freqMHz <= 0) {
    arfcnInput.value = ''
    return invalidate('频率必须大于 0')
  }
  if (freqMHz > 100000) {
    arfcnInput.value = ''
    return invalidate('频率超出范围（0 ~ 100 000 MHz）')
  }

  const r = freqToArfcn(freqMHz)
  if (!r) {
    arfcnInput.value = ''
    return invalidate('频率超出 NR 全局频率栅格范围')
  }

  arfcnInput.value = String(r.arfcn)

  const seg = r.segment
  const back = arfcnToFreq(r.arfcn)
  const rtDelta = back ? (back.freqMHz - r.snappedMHz) * 1000 : NaN
  const inputText =
    unit.value === 'GHz'
      ? `${trimNum9(v)} GHz（${trimNum9(freqMHz)} MHz）`
      : `${trimNum9(freqMHz)} MHz`
  const warn = r.isExact
    ? ''
    : `该频率不在 NR 栅格点上，最近的 N_REF = ${r.arfcn} 对应 ${fmtMHz(r.snappedMHz)}，偏差 ${fmtKHz(r.deltaKHz)}`

  finalize(
    [
      ['输入方向', '频率 → N_REF'],
      ['输入频率', inputText],
      ['最近 N_REF', groupNumber(r.arfcn)],
      ['该 N_REF 对应频率', freqCell(r.snappedMHz)],
      ['栅格偏差', fmtKHz(r.deltaKHz)],
      ['是否精确命中', r.isExact ? '是' : '否'],
      ['所属段', seg.label],
      ['频率范围标识', seg.frLabel],
      ['ΔF_Global', `${seg.deltaFKHz} kHz`],
      ['N_REF 取值范围', `${groupNumber(seg.nMin)} – ${groupNumber(seg.nMax)}`],
      ['代入公式', `N_REF = ${seg.nRefOffs} + (${trimNum(freqMHz)} − ${seg.fRefOffs}) ÷ ${seg.deltaFKHz} kHz = ${r.arfcn}（就近取整）`],
      ['往返校验', roundTripText(rtDelta)]
    ],
    warn
  )
}

/**
 * 切换 MHz / GHz：先把频率框的现有数值按新单位重写（保留用户原始输入，
 * 包括非栅格点），再按「最后编辑的那一侧」重新联动，避免互相覆盖。
 */
let prevUnit = unit.value
function onUnitChange() {
  const freqRaw = String(freqInput.value ?? '').trim()
  if (freqRaw !== '' && Number.isFinite(Number(freqRaw)) && prevUnit !== unit.value) {
    const v = Number(freqRaw)
    freqInput.value = trimNum9(unit.value === 'GHz' ? v / 1000 : v * 1000)
  }
  prevUnit = unit.value
  if (lastSide.value === 'freq' && String(freqInput.value ?? '').trim() !== '') {
    syncFromFreq()
  } else if (String(arfcnInput.value ?? '').trim() !== '') {
    syncFromArfcn()
  }
}

function fillSample() {
  arfcnInput.value = '432000'
  syncFromArfcn()
}

function clearAll() {
  arfcnInput.value = ''
  freqInput.value = ''
  error.value = ''
  result.value = null
}

// 首屏给出一个可对照的示例
syncFromArfcn()
</script>

<style scoped>
.coord-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.unit-select {
  width: 108px;
  flex: none;
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
  .coord-grid {
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
