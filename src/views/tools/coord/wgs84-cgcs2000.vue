<template>
  <ToolShell
    path="/coord/wgs84-cgcs2000"
    title="WGS84与CGCS2000转换"
    intro="WGS84 与 CGCS2000 的椭球参数几乎一致（长半轴相同，扁率倒数相差 1.3×10⁻⁹）。本工具用 Molodensky 公式给出纯椭球差异，并可选施加 7 参数完成框架/历元差异改正。中国境内两者在米级以内一致，工程上常直接等同。"
    :usage="[
      '选择转换方向，填写 BLH 与可选的 7 参数（dx/dy/dz 米，rx/ry/rz 角秒，s ppm），留空按 0 处理。',
      '结果同时给出目标 BLH、目标 ECEF、总差异，以及仅由椭球不同引起的理论差异。',
      '仅在厘米级/毫米级高精度要求下才需要框架归算；普通工程可忽略两者的基准差异。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 输入与设置</div>
      <div class="option-panel">
        <div class="flex flex-wrap items-center" style="gap:12px 20px">
          <span class="form-label">方向</span>
          <label class="el-radio">
            <input v-model="mode" type="radio" value="w2c" />WGS84 → CGCS2000
          </label>
          <label class="el-radio">
            <input v-model="mode" type="radio" value="c2w" />CGCS2000 → WGS84
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

        <div class="section-title mt-4">可选 7 参数（框架差异，留空 = 0）</div>
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
      <div class="step"><b>2</b> 转换结果</div>
      <div class="option-panel">
        <template v-if="result">
        <table class="data-table">
          <thead>
            <tr>
              <th>项目</th>
              <th>纬度 / X</th>
              <th>经度 / Y</th>
              <th>大地高 / Z</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>源 ECEF（m）</td>
              <td>{{ result.ecefSrc.x.toFixed(3) }}</td>
              <td>{{ result.ecefSrc.y.toFixed(3) }}</td>
              <td>{{ result.ecefSrc.z.toFixed(3) }}</td>
            </tr>
            <tr>
              <td>目标 ECEF（m）</td>
              <td>{{ result.ecefDst.x.toFixed(3) }}</td>
              <td>{{ result.ecefDst.y.toFixed(3) }}</td>
              <td>{{ result.ecefDst.z.toFixed(3) }}</td>
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
          <button type="button" class="el-button el-button--info" @click="copyText(resultText, '转换结果已复制')">复制结果</button>
        </div>
        </template>
        <div v-else class="tool-note">填写 BLH 与可选 7 参数后点击「计算」，转换结果会显示在这里。</div>
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
import { molodenskyForward, geodeticToEcef, ecefToGeodetic, helmertForward } from '../coordkit.js'

const mode = ref('w2c')
const lat = ref('39.9042')
const lon = ref('116.4074')
const h = ref('50')
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
  const la = reqNum(lat.value)
  const lo = reqNum(lon.value)
  const hh = reqNum(h.value)
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

  const srcEll = mode.value === 'w2c' ? 'WGS84' : 'CGCS2000'
  const dstEll = mode.value === 'w2c' ? 'CGCS2000' : 'WGS84'

  // 仅椭球不同引起的理论差异（三参数为 0）
  const ell = molodenskyForward(la, lo, hh, { dx: 0, dy: 0, dz: 0 }, srcEll, dstEll)

  // 框架差异：在 ECEF 上施加 7 参数，再按目标椭球转回 BLH
  const ecefSrc = geodeticToEcef(la, lo, hh, srcEll)
  const ecefDst = helmertForward(ecefSrc.x, ecefSrc.y, ecefSrc.z, p)
  const blh = ecefToGeodetic(ecefDst.x, ecefDst.y, ecefDst.z, dstEll)

  const frameDelta = {
    x: ecefDst.x - ecefSrc.x,
    y: ecefDst.y - ecefSrc.y,
    z: ecefDst.z - ecefSrc.z
  }

  result.value = {
    srcEll,
    dstEll,
    ecefSrc,
    ecefDst,
    blh,
    ell,
    frameDelta,
    dLatArcsec: (blh.lat - la) * 3600,
    dLonArcsec: (blh.lon - lo) * 3600,
    dH: blh.h - hh
  }
}

const summaryText = computed(() => {
  const r = result.value
  if (!r) return ''
  const lines = [
    `方向：${r.srcEll} → ${r.dstEll}（BLH 单位：度 / 度 / 米）`,
    `总差异：ΔLat ${r.dLatArcsec.toFixed(6)}″，ΔLon ${r.dLonArcsec.toFixed(6)}″，Δh ${r.dH.toFixed(6)} m`,
    `ECEF 差异：ΔX ${r.frameDelta.x.toFixed(6)} m，ΔY ${r.frameDelta.y.toFixed(6)} m，ΔZ ${r.frameDelta.z.toFixed(6)} m`,
    `纯椭球理论差异：ΔLat ${(r.ell.dLat * 3600).toFixed(6)}″，ΔLon ${(r.ell.dLon * 3600).toFixed(6)}″，Δh ${r.ell.dH.toFixed(6)} m`,
    '注：中国境内 CGCS2000 与 WGS84 在米级以内一致，普通工程可直接等同；高精度应用才需框架归算。'
  ]
  return lines.join('\n')
})

const resultText = computed(() => {
  const r = result.value
  if (!r) return ''
  return [
    `WGS84 / CGCS2000 转换结果（${r.srcEll} → ${r.dstEll}）`,
    `目标 BLH：${r.blh.lat.toFixed(9)}, ${r.blh.lon.toFixed(9)}, ${r.blh.h.toFixed(3)}`,
    `目标 ECEF：${r.ecefDst.x.toFixed(3)}, ${r.ecefDst.y.toFixed(3)}, ${r.ecefDst.z.toFixed(3)}`,
    `总差异：ΔLat ${r.dLatArcsec.toFixed(6)}″，ΔLon ${r.dLonArcsec.toFixed(6)}″，Δh ${r.dH.toFixed(6)} m`,
    `纯椭球差异：ΔLat ${(r.ell.dLat * 3600).toFixed(6)}″，ΔLon ${(r.ell.dLon * 3600).toFixed(6)}″，Δh ${r.ell.dH.toFixed(6)} m`
  ].join('\n')
})

function reset() {
  lat.value = ''
  lon.value = ''
  h.value = ''
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
}
</style>
