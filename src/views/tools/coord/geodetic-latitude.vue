<template>
  <ToolShell
    path="/coord/geodetic-latitude"
    title="大地纬度转地心纬度"
    intro="大地纬度 φ 是椭球法线与赤道面的夹角，地心纬度 φ′ 是地心向径与赤道面的夹角，两者满足 tan(φ′) = (1 − e²)·tan(φ)。本工具支持双向换算，并给出差值与对应 ECEF 的 z/ρ 比。"
    :usage="[
      '选择换算方向，输入纬度（十进制度，南纬用负数），并选择参考椭球。',
      '结果同时给出大地纬度、地心纬度、差值（角分/角秒）以及该纬度在椭球面上的 ECEF 坐标。',
      'ECEF 统一取 lon = 0°、h = 0 m；z/ρ 即为地心纬度的正切值，可用于交叉核对。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 输入</div>
      <div class="option-panel">
        <div class="flex flex-wrap items-center" style="gap:10px 20px">
          <span class="form-label">换算方向</span>
          <label class="el-radio"><input v-model="mode" type="radio" value="g2c" />大地纬度 → 地心纬度</label>
          <label class="el-radio"><input v-model="mode" type="radio" value="c2g" />地心纬度 → 大地纬度</label>
        </div>

        <div class="field-grid mt-4">
          <label class="field">
            <span class="form-label">{{ mode === 'g2c' ? '大地纬度 φ（°）' : '地心纬度 φ′（°）' }}</span>
            <input
              v-model="latInput"
              class="el-input__inner"
              type="text"
              inputmode="decimal"
              spellcheck="false"
              placeholder="39.9042"
              @keyup.enter="calc"
            />
          </label>
          <label class="field">
            <span class="form-label">参考椭球</span>
            <select v-model="ell" class="el-input__inner">
              <option v-for="key in ELL_KEYS" :key="key" :value="key">{{ ELLIPSOIDS[key].name }}</option>
            </select>
          </label>
        </div>

        <div class="tool-note">纬度范围 -90° ~ 90°，南半球用负数。大地纬度与地心纬度在 45° 附近差异最大，约 11.5′。</div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>2</b> 计算结果</div>
      <div class="option-panel">
        <template v-if="result">
        <table class="data-table">
          <tbody>
            <tr v-for="([k, v]) in result.rows" :key="k">
              <td class="k">{{ k }}</td>
              <td class="v">{{ v }}</td>
            </tr>
          </tbody>
        </table>

        <div class="result-box mt-4">{{ result.formula }}</div>
        <div class="flex mt-4">
          <button type="button" class="el-button el-button--info" @click="copyText(result.text, '结果已复制')">复制结果</button>
        </div>
        </template>
        <div v-else class="tool-note">填写大地纬度与椭球参数后点击「计算」，结果会显示在这里。</div>
      </div>
    </div>

    <div class="step-actions">
      <button type="button" class="el-button el-button--primary" @click="calc">计算</button>
      <button type="button" class="el-button el-button--info" @click="clearAll">清空</button>
    </div>
  </ToolShell>
</template>

<script setup>
import { ref } from 'vue'
import ToolShell from '../../../components/ToolShell.vue'
import { msgError } from '../../../lib/ui.js'
import { copyText } from '../textkit.js'
import {
  ELLIPSOIDS,
  ellipsoidParams,
  geodeticToGeocentricLat,
  geocentricToGeodeticLat,
  geodeticToEcef,
  toDeg
} from '../coordkit.js'

const ELL_KEYS = ['WGS84', 'CGCS2000', 'KRASSOVSKY', 'IAG75']

const mode = ref('g2c')
const latInput = ref('39.9042')
const ell = ref('WGS84')
const result = ref(null)

const fmtDeg = (v) => (Number.isFinite(v) ? Number(v).toFixed(8) : '—')
const fmtM = (v) => (Number.isFinite(v) ? Number(v).toFixed(6) : '—')
const fmtMin = (v) => (Number.isFinite(v) ? Number(v).toFixed(6) : '—')
const fmtSec = (v) => (Number.isFinite(v) ? Number(v).toFixed(4) : '—')

function fmtRatio(v) {
  if (!Number.isFinite(v)) return v === Infinity ? '∞' : v === -Infinity ? '-∞' : '—'
  if (Math.abs(v) >= 1e6) return v.toExponential(6)
  return Number(v).toFixed(6)
}

function fail(message) {
  result.value = null
  msgError(message)
}

function calc() {
  const raw = String(latInput.value == null ? '' : latInput.value).trim()
  const lat = Number(raw)
  if (raw === '' || !Number.isFinite(lat)) {
    fail('请输入有效纬度')
    return
  }
  if (lat < -90 || lat > 90) {
    fail('纬度必须在 -90° ~ 90° 之间')
    return
  }
  if (!ELLIPSOIDS[ell.value]) {
    fail('未知椭球')
    return
  }

  const g2c = mode.value === 'g2c'
  const latG = g2c ? lat : geocentricToGeodeticLat(lat, ell.value)
  const latC = g2c ? geodeticToGeocentricLat(lat, ell.value) : lat
  if (!Number.isFinite(latG) || !Number.isFinite(latC)) {
    fail('换算失败，请检查输入纬度')
    return
  }

  const params = ellipsoidParams(ell.value)
  const ecef = geodeticToEcef(latG, 0, 0, ell.value)
  const rho = Math.hypot(ecef.x, ecef.y)
  const ratio = rho === 0 ? Infinity : ecef.z / rho
  const diffMin = Math.abs(latG - latC) * 60
  const diffSec = diffMin * 60
  const ecefLatC = toDeg(Math.atan2(ecef.z, rho))

  const rows = [
    ['换算方向', g2c ? '大地纬度 → 地心纬度' : '地心纬度 → 大地纬度'],
    ['参考椭球', ELLIPSOIDS[ell.value].name],
    ['大地纬度 φ', `${fmtDeg(latG)}°`],
    ['地心纬度 φ′', `${fmtDeg(latC)}°`],
    ['差值 |φ − φ′|', `${fmtMin(diffMin)}′`],
    ['差值（角秒）', `${fmtSec(diffSec)}″`],
    ['第一偏心率平方 e²', params.e2.toFixed(10)],
    ['ECEF X', `${fmtM(ecef.x)} m`],
    ['ECEF Y', `${fmtM(ecef.y)} m`],
    ['ECEF Z', `${fmtM(ecef.z)} m`],
    ['ρ = √(X² + Y²)', `${fmtM(rho)} m`],
    ['z / ρ', fmtRatio(ratio)],
    ['由 ECEF 反算 φ′', `${fmtDeg(ecefLatC)}°`]
  ]

  const formula = [
    'tan(φ′) = (1 − e²) · tan(φ)',
    'φ′ = arctan[(1 − e²) · tan(φ)]',
    'φ = arctan[tan(φ′) / (1 − e²)]',
    `本次 e² = ${params.e2.toFixed(10)}`,
    'ECEF 取 lon = 0°、h = 0 m（椭球面本初子午线方向）'
  ].join('\n')

  result.value = {
    rows,
    formula,
    text: rows.map(([k, v]) => `${k}：${v}`).join('\n')
  }
}

function clearAll() {
  latInput.value = ''
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
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.data-table td {
  border-bottom: 1px solid var(--border);
  padding: 9px 12px;
  text-align: left;
  vertical-align: top;
}
.data-table td.k {
  width: 190px;
  color: #64748b;
  white-space: nowrap;
}
.data-table td.v {
  font-family: Consolas, Menlo, monospace;
  word-break: break-all;
}
@media (max-width: 640px) {
  .field-grid {
    grid-template-columns: 1fr;
  }
  .data-table td.k {
    width: 130px;
  }
}
</style>
