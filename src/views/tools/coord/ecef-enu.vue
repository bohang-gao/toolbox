<template>
  <ToolShell
    path="/coord/ecef-enu"
    title="ECEF与站心ENU转换"
    intro="在 ECEF 空间直角坐标与站心 ENU（东-北-天）坐标之间双向转换，并给出目标的方位角、俯仰角与斜距。常用于卫星可见性判断与基线解算。"
    :usage="[
      '先填写站点（原点）的大地坐标与椭球，它决定 ENU 三轴的指向。',
      '选择 ECEF → ENU 或 ENU → ECEF；ENU → ECEF 支持直接输入 E/N/U 分量，或输入方位角、俯仰角、斜距。',
      '结果给出 ENU 三分量、目标 ECEF 以及方位角/俯仰角/斜距；俯仰角大于 0 表示目标在地平线以上。',
      '应用场景：卫星可见性判断、GNSS 基线解算、测站局部坐标展示。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 站点（原点）</div>
      <div class="option-panel">
        <div class="flex flex-wrap items-center" style="gap:12px 20px">
          <span class="form-label">椭球</span>
          <select v-model="ellKey" class="el-input__inner" style="width:220px">
            <option v-for="e in ellOptions" :key="e.key" :value="e.key">{{ e.name }}</option>
          </select>
        </div>
        <div class="mt-4" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px">
          <label style="display:block">
            <span class="form-label">站点纬度 (°)</span>
            <input v-model="originLat" class="el-input__inner mt-2" placeholder="如 39.9042" />
          </label>
          <label style="display:block">
            <span class="form-label">站点经度 (°)</span>
            <input v-model="originLon" class="el-input__inner mt-2" placeholder="如 116.4074" />
          </label>
          <label style="display:block">
            <span class="form-label">站点大地高 (m)</span>
            <input v-model="originH" class="el-input__inner mt-2" placeholder="如 50" />
          </label>
        </div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>2</b> 目标坐标</div>
      <div class="option-panel">
        <div class="flex flex-wrap items-center" style="gap:12px 20px">
          <span class="form-label">方向</span>
          <label class="el-radio"><input v-model="mode" type="radio" value="toEnu" />ECEF → ENU</label>
          <label class="el-radio"><input v-model="mode" type="radio" value="toEcef" />ENU → ECEF</label>
          <template v-if="mode === 'toEcef'">
            <span class="form-label" style="margin-left:8px">输入方式</span>
            <label class="el-radio"><input v-model="enuSource" type="radio" value="enu" />E/N/U 分量</label>
            <label class="el-radio"><input v-model="enuSource" type="radio" value="azel" />方位角/俯仰角/斜距</label>
          </template>
        </div>

        <div class="mt-4" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px">
          <template v-if="mode === 'toEnu'">
            <label style="display:block">
              <span class="form-label">X (m)</span>
              <input v-model="tx" class="el-input__inner mt-2" placeholder="目标 ECEF X" />
            </label>
            <label style="display:block">
              <span class="form-label">Y (m)</span>
              <input v-model="ty" class="el-input__inner mt-2" placeholder="目标 ECEF Y" />
            </label>
            <label style="display:block">
              <span class="form-label">Z (m)</span>
              <input v-model="tz" class="el-input__inner mt-2" placeholder="目标 ECEF Z" />
            </label>
          </template>
          <template v-else-if="enuSource === 'enu'">
            <label style="display:block">
              <span class="form-label">E 东 (m)</span>
              <input v-model="east" class="el-input__inner mt-2" />
            </label>
            <label style="display:block">
              <span class="form-label">N 北 (m)</span>
              <input v-model="north" class="el-input__inner mt-2" />
            </label>
            <label style="display:block">
              <span class="form-label">U 天 (m)</span>
              <input v-model="up" class="el-input__inner mt-2" />
            </label>
          </template>
          <template v-else>
            <label style="display:block">
              <span class="form-label">方位角 (°)</span>
              <input v-model="azIn" class="el-input__inner mt-2" placeholder="从北顺时针" />
            </label>
            <label style="display:block">
              <span class="form-label">俯仰角 (°)</span>
              <input v-model="elIn" class="el-input__inner mt-2" placeholder="地平线以上为正" />
            </label>
            <label style="display:block">
              <span class="form-label">斜距 (m)</span>
              <input v-model="rangeIn" class="el-input__inner mt-2" />
            </label>
          </template>
        </div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>3</b> 结果</div>
      <div class="option-panel">
        <div class="flex justify-between items-center">
          <span class="form-label">ENU / 方位角 / 斜距</span>
          <button type="button" class="el-button copy-btn" style="padding:6px 12px" @click="copyResult">复制结果</button>
        </div>
        <pre class="result-box mt-2">{{ output || '点击「计算」查看结果' }}</pre>
      </div>
    </div>

    <div class="step-actions">
      <button type="button" class="el-button el-button--primary" @click="calc">计算</button>
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
  ecefToEnu,
  enuToEcef,
  enuToAzElRange,
  azElRangeToEnu
} from '../coordkit.js'

const ellOptions = ['WGS84', 'CGCS2000', 'KRASSOVSKY', 'IAG75', 'GRS80'].map(k => ({ key: k, name: ELLIPSOIDS[k].name }))

const ellKey = ref('WGS84')
const originLat = ref('')
const originLon = ref('')
const originH = ref('')
const mode = ref('toEnu')
const enuSource = ref('enu')
const tx = ref('')
const ty = ref('')
const tz = ref('')
const east = ref('')
const north = ref('')
const up = ref('')
const azIn = ref('')
const elIn = ref('')
const rangeIn = ref('')
const output = ref('')

function num(v, name) {
  const t = String(v).trim()
  if (t === '') throw new Error(`请填写${name}`)
  const n = Number(t)
  if (!Number.isFinite(n)) throw new Error(`${name}不是有效数字`)
  return n
}

function readOrigin() {
  const lat = num(originLat.value, '站点纬度')
  const lon = num(originLon.value, '站点经度')
  const h = num(originH.value, '站点大地高')
  if (lat < -90 || lat > 90) throw new Error('站点纬度应在 -90°～90° 之间')
  if (lon < -180 || lon > 180) throw new Error('站点经度应在 -180°～180° 之间')
  return { lat, lon, h }
}

function enuBlock(enu) {
  return [
    '站心 ENU：',
    `E（东） = ${enu.e.toFixed(4)} m`,
    `N（北） = ${enu.n.toFixed(4)} m`,
    `U（天） = ${enu.u.toFixed(4)} m`
  ].join('\n')
}

function azelBlock(az, el, range) {
  return [
    '方位角 / 俯仰角 / 斜距：',
    `方位角 = ${az.toFixed(6)} °`,
    `俯仰角 = ${el.toFixed(6)} °`,
    `斜距 = ${range.toFixed(4)} m`,
    el > 0 ? '（俯仰角 > 0，目标在地平线以上）' : '（俯仰角 ≤ 0，目标在地平线及以下）'
  ].join('\n')
}

function calc() {
  try {
    const o = readOrigin()
    const ell = ellKey.value
    if (mode.value === 'toEnu') {
      const xx = num(tx.value, 'X')
      const yy = num(ty.value, 'Y')
      const zz = num(tz.value, 'Z')
      const enu = ecefToEnu(xx, yy, zz, o.lat, o.lon, o.h, ell)
      const ae = enuToAzElRange(enu.e, enu.n, enu.u)
      output.value = [
        `站点：B=${o.lat}°, L=${o.lon}°, H=${o.h} m（${ELLIPSOIDS[ell].name}）`,
        `目标 ECEF：X=${xx}, Y=${yy}, Z=${zz} m`,
        '',
        enuBlock(enu),
        '',
        azelBlock(ae.az, ae.el, ae.range)
      ].join('\n')
    } else {
      let enu
      let srcNote
      if (enuSource.value === 'enu') {
        const ee = num(east.value, 'E')
        const nn = num(north.value, 'N')
        const uu = num(up.value, 'U')
        enu = { e: ee, n: nn, u: uu }
        srcNote = '由 ENU 分量反算'
      } else {
        const az = num(azIn.value, '方位角')
        const el = num(elIn.value, '俯仰角')
        const r = num(rangeIn.value, '斜距')
        if (r < 0) throw new Error('斜距不能为负')
        enu = azElRangeToEnu(az, el, r)
        srcNote = '由方位角/俯仰角/斜距换算为 ENU'
      }
      const ecef = enuToEcef(enu.e, enu.n, enu.u, o.lat, o.lon, o.h, ell)
      const ae = enuToAzElRange(enu.e, enu.n, enu.u)
      output.value = [
        `站点：B=${o.lat}°, L=${o.lon}°, H=${o.h} m（${ELLIPSOIDS[ell].name}）`,
        srcNote,
        '',
        enuBlock(enu),
        '',
        '目标 ECEF：',
        `X = ${ecef.x.toFixed(4)} m`,
        `Y = ${ecef.y.toFixed(4)} m`,
        `Z = ${ecef.z.toFixed(4)} m`,
        '',
        azelBlock(ae.az, ae.el, ae.range)
      ].join('\n')
    }
  } catch (e) {
    output.value = ''
    msgError(e.message || '计算失败')
  }
}

function copyResult() {
  copyText(output.value, '结果已复制')
}
</script>
