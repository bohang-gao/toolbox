<template>
  <ToolShell
    path="/coord/itrf"
    title="ITRF坐标转换"
    intro="在不同 ITRF 框架/历元之间做简化归算：先把 BLH 转成 ECEF，按用户给定的速度场（mm/年）做线性历元外推，再可选施加 7 参数（Bursa-Wolf）完成框架差异改正，最后转回 BLH。"
    :usage="[
      '填写源历元与目标历元（十进制年，如 2000.0、2020.5）、测站 BLH 与速度场 Vx/Vy/Vz（mm/年）。',
      '若已知两框架间的 7 参数则填入，留空按 0 处理；计算会依次执行速度外推与七参数改正。',
      '这是简化线性模型，不做板块运动模型（PMF）严格解算，仅适用于短基线、短时间跨度的工程估算。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 历元与测站坐标</div>
      <div class="option-panel">
        <div class="grid-2">
          <label>
            <span class="form-label">源历元（年）</span>
            <input v-model="epoch1" class="el-input__inner mt-2" type="text" placeholder="2000.0" />
          </label>
          <label>
            <span class="form-label">目标历元（年）</span>
            <input v-model="epoch2" class="el-input__inner mt-2" type="text" placeholder="2020.0" />
          </label>
        </div>
        <div class="grid-3 mt-4">
          <label>
            <span class="form-label">纬度（°）</span>
            <input v-model="lat" class="el-input__inner mt-2" type="text" placeholder="39.9042" />
          </label>
          <label>
            <span class="form-label">经度（°）</span>
            <input v-model="lon" class="el-input__inner mt-2" type="text" placeholder="116.4074" />
          </label>
          <label>
            <span class="form-label">大地高 h（m）</span>
            <input v-model="h" class="el-input__inner mt-2" type="text" placeholder="50" />
          </label>
        </div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>2</b> 速度场与框架参数</div>
      <div class="option-panel">
        <div class="section-title">速度场（mm/年，ECEF 三方向）</div>
        <div class="grid-3">
          <label>
            <span class="form-label">Vx</span>
            <input v-model="vx" class="el-input__inner mt-2" type="text" placeholder="0" />
          </label>
          <label>
            <span class="form-label">Vy</span>
            <input v-model="vy" class="el-input__inner mt-2" type="text" placeholder="0" />
          </label>
          <label>
            <span class="form-label">Vz</span>
            <input v-model="vz" class="el-input__inner mt-2" type="text" placeholder="0" />
          </label>
        </div>

        <div class="section-title mt-4">可选 7 参数（留空 = 0）</div>
        <div class="grid-3">
          <label>
            <span class="form-label">dx（m）</span>
            <input v-model="dx" class="el-input__inner mt-2" type="text" placeholder="0" />
          </label>
          <label>
            <span class="form-label">dy（m）</span>
            <input v-model="dy" class="el-input__inner mt-2" type="text" placeholder="0" />
          </label>
          <label>
            <span class="form-label">dz（m）</span>
            <input v-model="dz" class="el-input__inner mt-2" type="text" placeholder="0" />
          </label>
          <label>
            <span class="form-label">rx（角秒）</span>
            <input v-model="rx" class="el-input__inner mt-2" type="text" placeholder="0" />
          </label>
          <label>
            <span class="form-label">ry（角秒）</span>
            <input v-model="ry" class="el-input__inner mt-2" type="text" placeholder="0" />
          </label>
          <label>
            <span class="form-label">rz（角秒）</span>
            <input v-model="rz" class="el-input__inner mt-2" type="text" placeholder="0" />
          </label>
          <label>
            <span class="form-label">尺度 s（ppm）</span>
            <input v-model="s" class="el-input__inner mt-2" type="text" placeholder="0" />
          </label>
        </div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>3</b> 归算结果</div>
      <div class="option-panel">
        <template v-if="result">
        <table class="data-table">
          <thead>
            <tr>
              <th>项目</th>
              <th>X / 纬度</th>
              <th>Y / 经度</th>
              <th>Z / 大地高</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>源 ECEF（m）</td>
              <td>{{ result.e0.x.toFixed(3) }}</td>
              <td>{{ result.e0.y.toFixed(3) }}</td>
              <td>{{ result.e0.z.toFixed(3) }}</td>
            </tr>
            <tr>
              <td>速度外推位移（m）</td>
              <td>{{ result.velDisp.x.toFixed(6) }}</td>
              <td>{{ result.velDisp.y.toFixed(6) }}</td>
              <td>{{ result.velDisp.z.toFixed(6) }}</td>
            </tr>
            <tr>
              <td>七参数改正（m）</td>
              <td>{{ result.frameDelta.x.toFixed(6) }}</td>
              <td>{{ result.frameDelta.y.toFixed(6) }}</td>
              <td>{{ result.frameDelta.z.toFixed(6) }}</td>
            </tr>
            <tr>
              <td>目标 ECEF（m）</td>
              <td>{{ result.ecef.x.toFixed(3) }}</td>
              <td>{{ result.ecef.y.toFixed(3) }}</td>
              <td>{{ result.ecef.z.toFixed(3) }}</td>
            </tr>
            <tr>
              <td>目标 BLH</td>
              <td>{{ result.blh.lat.toFixed(9) }}°</td>
              <td>{{ result.blh.lon.toFixed(9) }}°</td>
              <td>{{ result.blh.h.toFixed(3) }} m</td>
            </tr>
          </tbody>
        </table>

        <div class="result-box mt-4">{{ summaryText }}</div>

        <div class="flex flex-wrap mt-4" style="gap:10px">
          <button type="button" class="el-button el-button--info" @click="copyText(resultText, '归算结果已复制')">复制结果</button>
        </div>
        </template>
        <div v-else class="tool-note">填写历元、测站坐标与速度后点击「计算」，归算结果会显示在这里。</div>
      </div>
    </div>

    <div class="step-actions">
      <button type="button" class="el-button el-button--primary" @click="calc">计算</button>
      <button type="button" class="el-button el-button--info" @click="reset">清空</button>
    </div>
  </ToolShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import ToolShell from '../../../components/ToolShell.vue'
import { msgError } from '../../../lib/ui.js'
import { copyText } from '../textkit.js'
import { geodeticToEcef, ecefToGeodetic, helmertForward } from '../coordkit.js'

const epoch1 = ref('2000.0')
const epoch2 = ref('2020.0')
const lat = ref('39.9042')
const lon = ref('116.4074')
const h = ref('50')
const vx = ref('0')
const vy = ref('0')
const vz = ref('0')
const dx = ref('')
const dy = ref('')
const dz = ref('')
const rx = ref('')
const ry = ref('')
const rz = ref('')
const s = ref('')

const result = ref(null)

function reqNum(raw) {
  const t = String(raw == null ? '' : raw).trim()
  if (!t) return NaN
  const n = Number(t)
  return Number.isFinite(n) ? n : NaN
}

function optNum(raw) {
  const t = String(raw == null ? '' : raw).trim()
  if (!t) return 0
  const n = Number(t)
  return Number.isFinite(n) ? n : NaN
}

function calc() {
  const t1 = reqNum(epoch1.value)
  const t2 = reqNum(epoch2.value)
  const la = reqNum(lat.value)
  const lo = reqNum(lon.value)
  const hh = reqNum(h.value)
  const vX = reqNum(vx.value)
  const vY = reqNum(vy.value)
  const vZ = reqNum(vz.value)

  if (!Number.isFinite(t1) || !Number.isFinite(t2)) {
    result.value = null
    msgError('历元必须是十进制年，如 2000.0')
    return
  }
  if (!Number.isFinite(la) || la < -90 || la > 90) {
    result.value = null
    msgError('纬度必须是 -90 ~ 90 之间的数值')
    return
  }
  if (!Number.isFinite(lo) || lo < -180 || lo > 180) {
    result.value = null
    msgError('经度必须是 -180 ~ 180 之间的数值')
    return
  }
  if (!Number.isFinite(hh)) {
    result.value = null
    msgError('大地高必须是数值（米）')
    return
  }
  if (!Number.isFinite(vX) || !Number.isFinite(vY) || !Number.isFinite(vZ)) {
    result.value = null
    msgError('速度场 Vx/Vy/Vz 必须是数值（mm/年）')
    return
  }

  const p = {
    dx: optNum(dx.value),
    dy: optNum(dy.value),
    dz: optNum(dz.value),
    rx: optNum(rx.value),
    ry: optNum(ry.value),
    rz: optNum(rz.value),
    s: optNum(s.value)
  }
  if (Object.values(p).some((v) => !Number.isFinite(v))) {
    result.value = null
    msgError('7 参数必须是数值，留空按 0 处理')
    return
  }

  const dt = t2 - t1
  const e0 = geodeticToEcef(la, lo, hh, 'WGS84')
  const velDisp = { x: (vX / 1000) * dt, y: (vY / 1000) * dt, z: (vZ / 1000) * dt }
  const moved = { x: e0.x + velDisp.x, y: e0.y + velDisp.y, z: e0.z + velDisp.z }
  const ecef = helmertForward(moved.x, moved.y, moved.z, p)
  const frameDelta = { x: ecef.x - moved.x, y: ecef.y - moved.y, z: ecef.z - moved.z }
  const blh = ecefToGeodetic(ecef.x, ecef.y, ecef.z, 'WGS84')
  const total = { x: ecef.x - e0.x, y: ecef.y - e0.y, z: ecef.z - e0.z }

  result.value = {
    dt,
    e0,
    velDisp,
    frameDelta,
    ecef,
    blh,
    total,
    totalMag: Math.hypot(total.x, total.y, total.z),
    dLatArcsec: (blh.lat - la) * 3600,
    dLonArcsec: (blh.lon - lo) * 3600,
    dH: blh.h - hh
  }
}

const summaryText = computed(() => {
  const r = result.value
  if (!r) return ''
  return [
    `时间跨度：${r.dt.toFixed(3)} 年`,
    `速度外推合位移：${Math.hypot(r.velDisp.x, r.velDisp.y, r.velDisp.z).toFixed(6)} m`,
    `七参数改正合量：${Math.hypot(r.frameDelta.x, r.frameDelta.y, r.frameDelta.z).toFixed(6)} m`,
    `总位移（ECEF）：${r.totalMag.toFixed(6)} m`,
    `大地坐标变化：ΔLat ${r.dLatArcsec.toFixed(6)}″，ΔLon ${r.dLonArcsec.toFixed(6)}″，Δh ${r.dH.toFixed(6)} m`,
    '注：简化线性外推，未做板块运动模型（PMF）严格解算。'
  ].join('\n')
})

const resultText = computed(() => {
  const r = result.value
  if (!r) return ''
  return [
    'ITRF 简化历元归算结果',
    `源 ECEF：${r.e0.x.toFixed(3)}, ${r.e0.y.toFixed(3)}, ${r.e0.z.toFixed(3)}`,
    `目标 ECEF：${r.ecef.x.toFixed(3)}, ${r.ecef.y.toFixed(3)}, ${r.ecef.z.toFixed(3)}`,
    `目标 BLH：${r.blh.lat.toFixed(9)}, ${r.blh.lon.toFixed(9)}, ${r.blh.h.toFixed(3)}`,
    `速度位移：${r.velDisp.x.toFixed(6)}, ${r.velDisp.y.toFixed(6)}, ${r.velDisp.z.toFixed(6)}`,
    `七参数改正：${r.frameDelta.x.toFixed(6)}, ${r.frameDelta.y.toFixed(6)}, ${r.frameDelta.z.toFixed(6)}`,
    `总位移：${r.totalMag.toFixed(6)} m`
  ].join('\n')
})

function reset() {
  epoch1.value = ''
  epoch2.value = ''
  lat.value = ''
  lon.value = ''
  h.value = ''
  vx.value = ''
  vy.value = ''
  vz.value = ''
  dx.value = ''
  dy.value = ''
  dz.value = ''
  rx.value = ''
  ry.value = ''
  rz.value = ''
  s.value = ''
  result.value = null
}
</script>

<style scoped>
.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
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
@media (max-width: 720px) {
  .grid-3 {
    grid-template-columns: 1fr;
  }
  .grid-2 {
    grid-template-columns: 1fr;
  }
}
</style>
