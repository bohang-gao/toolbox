<template>
  <ToolShell
    path="/coord/molodensky-badekas"
    title="莫洛登斯基-巴德卡斯转换"
    intro="莫洛登斯基-巴德卡斯（Molodensky-Badekas）模型在七参数基础上引入旋转中心 (x0, y0, z0)，先把坐标重心化再做旋转与尺度变换，避免旋转中心远离测区时的数值耦合。"
    :usage="[
      '选择源椭球与目标椭球，填写源大地坐标（纬度、经度、大地高）。',
      '填写 7 个参数：dx/dy/dz 米，rx/ry/rz 角秒，s 为 ppm；再填写旋转中心 x0/y0/z0（ECEF 米）。',
      '旋转中心取测区重心时，结果与普通七参数转换最接近；取原点 (0,0,0) 时退化为普通 Bursa-Wolf。',
      '结果同时给出目标椭球上的大地坐标与 ECEF 空间直角坐标。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 基准与源坐标</div>
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
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>2</b> 七参数与旋转中心</div>
      <div class="option-panel">
        <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px">
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
          <label style="display:block">
            <span class="form-label">s (ppm)</span>
            <input v-model="s" class="el-input__inner mt-2" />
          </label>
          <label style="display:block">
            <span class="form-label">rx (″)</span>
            <input v-model="rx" class="el-input__inner mt-2" />
          </label>
          <label style="display:block">
            <span class="form-label">ry (″)</span>
            <input v-model="ry" class="el-input__inner mt-2" />
          </label>
          <label style="display:block">
            <span class="form-label">rz (″)</span>
            <input v-model="rz" class="el-input__inner mt-2" />
          </label>
        </div>
        <div class="mt-4" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px">
          <label style="display:block">
            <span class="form-label">旋转中心 x0 (m)</span>
            <input v-model="x0" class="el-input__inner mt-2" />
          </label>
          <label style="display:block">
            <span class="form-label">旋转中心 y0 (m)</span>
            <input v-model="y0" class="el-input__inner mt-2" />
          </label>
          <label style="display:block">
            <span class="form-label">旋转中心 z0 (m)</span>
            <input v-model="z0" class="el-input__inner mt-2" />
          </label>
        </div>
        <p class="tool-note">x0/y0/z0 为 ECEF 坐标（米）。取测区重心时转换结果与普通七参数最接近；全填 0 等价于普通 Bursa-Wolf。</p>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>3</b> 结果</div>
      <div class="option-panel">
        <div class="flex justify-between items-center">
          <span class="form-label">转换结果</span>
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
import { ELLIPSOIDS, molodenskyBadekasForward } from '../coordkit.js'

const ellOptions = ['WGS84', 'CGCS2000', 'KRASSOVSKY', 'IAG75'].map(k => ({ key: k, name: ELLIPSOIDS[k].name }))

const srcEll = ref('WGS84')
const dstEll = ref('CGCS2000')
const lat = ref('')
const lon = ref('')
const h = ref('')
const dx = ref('0')
const dy = ref('0')
const dz = ref('0')
const rx = ref('0')
const ry = ref('0')
const rz = ref('0')
const s = ref('0')
const x0 = ref('0')
const y0 = ref('0')
const z0 = ref('0')
const output = ref('')

function num(v, name) {
  const t = String(v).trim()
  if (t === '') throw new Error(`请填写${name}`)
  const n = Number(t)
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
    const p = {
      dx: num(dx.value, 'dx'),
      dy: num(dy.value, 'dy'),
      dz: num(dz.value, 'dz'),
      rx: num(rx.value, 'rx'),
      ry: num(ry.value, 'ry'),
      rz: num(rz.value, 'rz'),
      s: num(s.value, 's'),
      x0: num(x0.value, 'x0'),
      y0: num(y0.value, 'y0'),
      z0: num(z0.value, 'z0')
    }
    const r = molodenskyBadekasForward(b, l, hh, p, srcEll.value, dstEll.value)
    output.value = [
      `源椭球：${ELLIPSOIDS[srcEll.value].name} → 目标椭球：${ELLIPSOIDS[dstEll.value].name}`,
      `旋转中心：(${p.x0}, ${p.y0}, ${p.z0}) m`,
      '',
      '目标大地坐标：',
      `纬度 B = ${r.lat.toFixed(8)} °`,
      `经度 L = ${r.lon.toFixed(8)} °`,
      `大地高 H = ${r.h.toFixed(4)} m`,
      '',
      '目标 ECEF：',
      `X = ${r.x.toFixed(4)} m`,
      `Y = ${r.y.toFixed(4)} m`,
      `Z = ${r.z.toFixed(4)} m`
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
