<template>
  <ToolShell
    path="/coord/geodetic-ecef"
    title="大地坐标与空间直角坐标转换"
    intro="在大地坐标（纬度 B、经度 L、大地高 H）与地心空间直角坐标（ECEF X/Y/Z）之间双向转换，支持 WGS84、CGCS2000、克拉索夫斯基、IAG75、GRS80 等椭球。"
    :usage="[
      '选择转换方向与椭球，填写三个分量。',
      'BLH → XYZ 输入纬度、经度（十进制度）与大地高（米）；XYZ → BLH 输入 X、Y、Z（米）。',
      '结果同时给出该点卯酉圈曲率半径 N 与子午圈曲率半径 M，可用于检核。',
      '纬度范围 -90°～90°，经度 -180°～180°，大地高可正可负。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 输入</div>
      <div class="option-panel">
        <div class="flex flex-wrap items-center" style="gap:12px 20px">
          <span class="form-label">方向</span>
          <label class="el-radio"><input v-model="mode" type="radio" value="toEcef" />大地坐标 → 空间直角</label>
          <label class="el-radio"><input v-model="mode" type="radio" value="toBlh" />空间直角 → 大地坐标</label>
          <span class="form-label" style="margin-left:8px">椭球</span>
          <select v-model="ellKey" class="el-input__inner" style="width:220px">
            <option v-for="e in ellOptions" :key="e.key" :value="e.key">{{ e.name }}</option>
          </select>
        </div>

        <div class="mt-4" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px">
          <template v-if="mode === 'toEcef'">
            <label style="display:block">
              <span class="form-label">纬度 B (°)</span>
              <input v-model="lat" class="el-input__inner mt-2" placeholder="如 39.9042" />
            </label>
            <label style="display:block">
              <span class="form-label">经度 L (°)</span>
              <input v-model="lon" class="el-input__inner mt-2" placeholder="如 116.4074" />
            </label>
            <label style="display:block">
              <span class="form-label">大地高 H (m)</span>
              <input v-model="h" class="el-input__inner mt-2" placeholder="如 0" />
            </label>
          </template>
          <template v-else>
            <label style="display:block">
              <span class="form-label">X (m)</span>
              <input v-model="x" class="el-input__inner mt-2" placeholder="ECEF X" />
            </label>
            <label style="display:block">
              <span class="form-label">Y (m)</span>
              <input v-model="y" class="el-input__inner mt-2" placeholder="ECEF Y" />
            </label>
            <label style="display:block">
              <span class="form-label">Z (m)</span>
              <input v-model="z" class="el-input__inner mt-2" placeholder="ECEF Z" />
            </label>
          </template>
        </div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>2</b> 结果</div>
      <div class="option-panel">
        <div class="flex justify-between items-center">
          <span class="form-label">转换结果</span>
          <button type="button" class="el-button copy-btn" style="padding:6px 12px" @click="copyResult">复制结果</button>
        </div>
        <pre class="result-box mt-2">{{ output || '点击下方「计算」查看结果' }}</pre>
      </div>
    </div>

    <div class="step-actions">
      <button type="button" class="el-button" @click="fillExample">填入示例</button>
      <button type="button" class="el-button el-button--primary" @click="calc">计算</button>
    </div>
  </ToolShell>
</template>

<script setup>
import { ref } from 'vue'
import ToolShell from '../../../components/ToolShell.vue'
import { msgError } from '../../../lib/ui.js'
import { copyText } from '../textkit.js'
import { ELLIPSOIDS, ellipsoidParams, toRad, geodeticToEcef, ecefToGeodetic } from '../coordkit.js'

const ellOptions = ['WGS84', 'CGCS2000', 'KRASSOVSKY', 'IAG75', 'GRS80'].map(k => ({ key: k, name: ELLIPSOIDS[k].name }))

const mode = ref('toEcef')
const ellKey = ref('WGS84')
const lat = ref('')
const lon = ref('')
const h = ref('')
const x = ref('')
const y = ref('')
const z = ref('')
const output = ref('')

function num(v, name) {
  const s = String(v).trim()
  if (s === '') throw new Error(`请填写${name}`)
  const n = Number(s)
  if (!Number.isFinite(n)) throw new Error(`${name}不是有效数字`)
  return n
}

// 由椭球参数组合出卯酉圈曲率半径 N 与子午圈曲率半径 M
function curvatureRadii(latDeg, ell) {
  const { a, e2 } = ellipsoidParams(ell)
  const s = Math.sin(toRad(latDeg))
  const w = 1 - e2 * s * s
  return {
    N: a / Math.sqrt(w),
    M: (a * (1 - e2)) / Math.pow(w, 1.5)
  }
}

function calc() {
  try {
    const ell = ellKey.value
    let text = ''
    if (mode.value === 'toEcef') {
      const b = num(lat.value, '纬度')
      const l = num(lon.value, '经度')
      const hh = num(h.value, '大地高')
      if (b < -90 || b > 90) throw new Error('纬度应在 -90°～90° 之间')
      if (l < -180 || l > 180) throw new Error('经度应在 -180°～180° 之间')
      const r = geodeticToEcef(b, l, hh, ell)
      const { N, M } = curvatureRadii(b, ell)
      text = [
        '大地坐标 → 空间直角坐标',
        `椭球：${ELLIPSOIDS[ell].name}`,
        '',
        `X = ${r.x.toFixed(4)} m`,
        `Y = ${r.y.toFixed(4)} m`,
        `Z = ${r.z.toFixed(4)} m`,
        '',
        `卯酉圈曲率半径 N = ${N.toFixed(4)} m`,
        `子午圈曲率半径 M = ${M.toFixed(4)} m`
      ].join('\n')
    } else {
      const xx = num(x.value, 'X')
      const yy = num(y.value, 'Y')
      const zz = num(z.value, 'Z')
      const g = ecefToGeodetic(xx, yy, zz, ell)
      const { N, M } = curvatureRadii(g.lat, ell)
      text = [
        '空间直角坐标 → 大地坐标',
        `椭球：${ELLIPSOIDS[ell].name}`,
        '',
        `纬度 B = ${g.lat.toFixed(8)} °`,
        `经度 L = ${g.lon.toFixed(8)} °`,
        `大地高 H = ${g.h.toFixed(4)} m`,
        '',
        `卯酉圈曲率半径 N = ${N.toFixed(4)} m`,
        `子午圈曲率半径 M = ${M.toFixed(4)} m`
      ].join('\n')
    }
    output.value = text
  } catch (e) {
    output.value = ''
    msgError(e.message || '计算失败')
  }
}

function fillExample() {
  mode.value = 'toEcef'
  ellKey.value = 'WGS84'
  lat.value = '39.9042'
  lon.value = '116.4074'
  h.value = '0'
  calc()
}

function copyResult() {
  copyText(output.value, '结果已复制')
}
</script>
