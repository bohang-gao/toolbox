<template>
  <ToolShell
    path="/coord/molodensky"
    title="莫洛登斯基转换"
    intro="莫洛登斯基（Molodensky）公式直接在大地坐标上施加三参数平移与椭球差异改正，无需先转成空间直角坐标，适合不同基准间的小范围坐标换算。"
    :usage="[
      '选择源椭球与目标椭球，填写源大地坐标（纬度、经度、大地高）。',
      '填写三个平移参数 dx、dy、dz（米），旋转与尺度项在本公式中不参与。',
      '结果为目标椭球上的大地坐标，并列出纬度、经度改正量（角秒）与大地高改正量（米）。',
      '本工具按三参数莫洛登斯基公式计算，源/目标椭球不同时自动加入长半轴与扁率差异项。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 输入</div>
      <div class="option-panel">
        <div class="flex flex-wrap items-center" style="gap:12px 24px">
          <label class="flex items-center">
            <span class="form-label">源椭球</span>
            <select v-model="srcEll" class="el-input__inner" style="width:200px">
              <option v-for="e in ellOptions" :key="e.key" :value="e.key">{{ e.name }}</option>
            </select>
          </label>
          <label class="flex items-center">
            <span class="form-label">目标椭球</span>
            <select v-model="dstEll" class="el-input__inner" style="width:200px">
              <option v-for="e in ellOptions" :key="e.key" :value="e.key">{{ e.name }}</option>
            </select>
          </label>
        </div>

        <div class="mt-4" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px">
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
            <input v-model="h" class="el-input__inner mt-2" placeholder="如 50" />
          </label>
        </div>

        <div class="mt-4" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px">
          <label style="display:block">
            <span class="form-label">dx (m)</span>
            <input v-model="dx" class="el-input__inner mt-2" />
          </label>
          <label style="display:block">
            <span class="form-label">dy (m)</span>
            <input v-model="dy" class="el-input__inner mt-2" />
          </label>
          <label style="display:block">
            <span class="form-label">dz (m)</span>
            <input v-model="dz" class="el-input__inner mt-2" />
          </label>
        </div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>2</b> 结果</div>
      <div class="option-panel">
        <div class="flex justify-between items-center">
          <span class="form-label">目标大地坐标与改正量</span>
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
import { ELLIPSOIDS, molodenskyForward } from '../coordkit.js'

const ellOptions = ['WGS84', 'CGCS2000', 'KRASSOVSKY', 'IAG75'].map(k => ({ key: k, name: ELLIPSOIDS[k].name }))

const srcEll = ref('WGS84')
const dstEll = ref('CGCS2000')
const lat = ref('')
const lon = ref('')
const h = ref('')
const dx = ref('0')
const dy = ref('0')
const dz = ref('0')
const output = ref('')

function num(v, name) {
  const s = String(v).trim()
  if (s === '') throw new Error(`请填写${name}`)
  const n = Number(s)
  if (!Number.isFinite(n)) throw new Error(`${name}不是有效数字`)
  return n
}

function calc() {
  try {
    const b = num(lat.value, '纬度')
    const l = num(lon.value, '经度')
    const hh = num(h.value, '大地高')
    if (b < -90 || b > 90) throw new Error('纬度应在 -90°～90° 之间')
    if (l < -180 || l > 180) throw new Error('经度应在 -180°～180° 之间')
    const p = { dx: num(dx.value, 'dx'), dy: num(dy.value, 'dy'), dz: num(dz.value, 'dz') }
    const r = molodenskyForward(b, l, hh, p, srcEll.value, dstEll.value)
    output.value = [
      `源椭球：${ELLIPSOIDS[srcEll.value].name} → 目标椭球：${ELLIPSOIDS[dstEll.value].name}`,
      '',
      '目标大地坐标：',
      `纬度 B = ${r.lat.toFixed(8)} °`,
      `经度 L = ${r.lon.toFixed(8)} °`,
      `大地高 H = ${r.h.toFixed(4)} m`,
      '',
      '改正量：',
      `ΔB = ${(r.dLat * 3600).toFixed(6)} ″`,
      `ΔL = ${(r.dLon * 3600).toFixed(6)} ″`,
      `ΔH = ${r.dH.toFixed(4)} m`
    ].join('\n')
  } catch (e) {
    output.value = ''
    msgError(e.message || '计算失败')
  }
}

function copyResult() {
  copyText(output.value, '结果已复制')
}
</script>
