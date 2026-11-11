<template>
  <ToolShell
    path="/coord/polar-cartesian"
    title="直角坐标与极坐标转换"
    intro="二维直角坐标 (x, y) 与极坐标 (r, θ) 双向换算，θ 自北顺时针、单位度；另提供三维直角坐标 (x, y, z) 与球坐标 (斜距 r、方位角 az、天顶距 zen / 高度角 el) 双向换算，反算输出 ENU 三分量并对应 x / y / z。"
    :usage="[
      '选择二维或三维；两个方向同时计算，输入任意一侧即可。',
      '约定 x 轴指东、y 轴指北，角度自北顺时针；天顶距 zen 与高度角 el 满足 zen + el = 90°。',
      '三维反算输入方位角 az、高度角 el、斜距 range，得到 e / n / u，分别对应 x / y / z。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 输入</div>
      <div class="option-panel">
        <div class="flex flex-wrap items-center" style="gap:12px 20px">
          <span class="form-label">维度</span>
          <label class="el-radio"><input v-model="dim" type="radio" value="2d" />二维 (x, y) ↔ (r, θ)</label>
          <label class="el-radio"><input v-model="dim" type="radio" value="3d" />三维 (x, y, z) ↔ (r, az, zen)</label>
        </div>

        <template v-if="dim === '2d'">
          <p class="group-title mt-4">直角坐标（x 东、y 北）</p>
          <div class="coord-grid mt-2">
            <label>
              <span class="form-label">x（东）</span>
              <input v-model="x2Input" class="el-input__inner mt-2" type="text" spellcheck="false" placeholder="3" />
            </label>
            <label>
              <span class="form-label">y（北）</span>
              <input v-model="y2Input" class="el-input__inner mt-2" type="text" spellcheck="false" placeholder="4" />
            </label>
          </div>

          <p class="group-title mt-4">极坐标（r 距离、θ 自北顺时针）</p>
          <div class="coord-grid mt-2">
            <label>
              <span class="form-label">r</span>
              <input v-model="r2Input" class="el-input__inner mt-2" type="text" spellcheck="false" placeholder="5" />
            </label>
            <label>
              <span class="form-label">θ（°）</span>
              <input v-model="theta2Input" class="el-input__inner mt-2" type="text" spellcheck="false" placeholder="30" />
            </label>
          </div>
        </template>

        <template v-else>
          <p class="group-title mt-4">直角坐标（x 东、y 北、z 天）</p>
          <div class="coord-grid mt-2">
            <label>
              <span class="form-label">x（东）</span>
              <input v-model="x3Input" class="el-input__inner mt-2" type="text" spellcheck="false" placeholder="1" />
            </label>
            <label>
              <span class="form-label">y（北）</span>
              <input v-model="y3Input" class="el-input__inner mt-2" type="text" spellcheck="false" placeholder="2" />
            </label>
            <label>
              <span class="form-label">z（天）</span>
              <input v-model="z3Input" class="el-input__inner mt-2" type="text" spellcheck="false" placeholder="2" />
            </label>
          </div>

          <p class="group-title mt-4">球坐标（az 方位角、el 高度角、range 斜距）</p>
          <div class="coord-grid mt-2">
            <label>
              <span class="form-label">az（°）</span>
              <input v-model="az3Input" class="el-input__inner mt-2" type="text" spellcheck="false" placeholder="30" />
            </label>
            <label>
              <span class="form-label">el（°）</span>
              <input v-model="el3Input" class="el-input__inner mt-2" type="text" spellcheck="false" placeholder="45" />
            </label>
            <label>
              <span class="form-label">range</span>
              <input v-model="range3Input" class="el-input__inner mt-2" type="text" spellcheck="false" placeholder="100" />
            </label>
          </div>
        </template>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>2</b> 结果</div>
      <div class="option-panel">
        <template v-if="dim === '2d'">
          <table v-if="polar2d" class="data-table">
            <thead>
              <tr><th>直角 → 极坐标</th><th>数值</th></tr>
            </thead>
            <tbody>
              <tr><td>r（距离）</td><td>{{ fmt(polar2d.r, 6) }}</td></tr>
              <tr><td>θ（°，自北顺时针）</td><td>{{ fmt(polar2d.theta, 6) }}</td></tr>
            </tbody>
          </table>
          <p v-else class="tool-note">请输入有效的 x、y。</p>

          <table v-if="cart2d" class="data-table mt-4">
            <thead>
              <tr><th>极坐标 → 直角</th><th>数值</th></tr>
            </thead>
            <tbody>
              <tr><td>x（东）</td><td>{{ fmt(cart2d.x, 6) }}</td></tr>
              <tr><td>y（北）</td><td>{{ fmt(cart2d.y, 6) }}</td></tr>
            </tbody>
          </table>
          <p v-else class="tool-note mt-2">请输入有效的 r、θ。</p>
        </template>

        <template v-else>
          <table v-if="sph3d" class="data-table">
            <thead>
              <tr><th>直角 → 球坐标</th><th>数值</th></tr>
            </thead>
            <tbody>
              <tr><td>r（斜距）</td><td>{{ fmt(sph3d.r, 6) }}</td></tr>
              <tr><td>az 方位角（°，自北顺时针）</td><td>{{ fmt(sph3d.az, 6) }}</td></tr>
              <tr><td>zen 天顶距（°）</td><td>{{ fmt(sph3d.zen, 6) }}</td></tr>
              <tr><td>el 高度角（°）</td><td>{{ fmt(sph3d.el, 6) }}</td></tr>
            </tbody>
          </table>
          <p v-else class="tool-note">请输入有效的 x、y、z。</p>

          <table v-if="enu3d" class="data-table mt-4">
            <thead>
              <tr><th>球坐标 → ENU</th><th>对应轴</th><th>数值</th></tr>
            </thead>
            <tbody>
              <tr><td>e</td><td>x（东）</td><td>{{ fmt(enu3d.e, 6) }}</td></tr>
              <tr><td>n</td><td>y（北）</td><td>{{ fmt(enu3d.n, 6) }}</td></tr>
              <tr><td>u</td><td>z（天）</td><td>{{ fmt(enu3d.u, 6) }}</td></tr>
            </tbody>
          </table>
          <p v-else class="tool-note mt-2">请输入有效的 az、el、range。</p>
        </template>

        <div class="flex flex-wrap mt-4" style="gap:10px">
          <button type="button" class="el-button" @click="copyText(resultText, '结果已复制')">复制结果</button>
        </div>
      </div>
    </div>
  </ToolShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import ToolShell from '../../../components/ToolShell.vue'
import { copyText } from '../textkit.js'
import {
  cartesianToPolar,
  polarToCartesian,
  cartesian3dToSpherical,
  azElRangeToEnu
} from '../coordkit.js'

const dim = ref('2d')

const x2Input = ref('3')
const y2Input = ref('4')
const r2Input = ref('5')
const theta2Input = ref('30')

const x3Input = ref('1')
const y3Input = ref('2')
const z3Input = ref('2')
const az3Input = ref('30')
const el3Input = ref('45')
const range3Input = ref('100')

const fmt = (v, d = 6) => Number(v).toFixed(d)

function parseNum(raw) {
  const t = String(raw ?? '').trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

const polar2d = computed(() => {
  const x = parseNum(x2Input.value)
  const y = parseNum(y2Input.value)
  if (x === null || y === null) return null
  return cartesianToPolar(x, y)
})

const cart2d = computed(() => {
  const r = parseNum(r2Input.value)
  const theta = parseNum(theta2Input.value)
  if (r === null || theta === null) return null
  return polarToCartesian(r, theta)
})

const sph3d = computed(() => {
  const x = parseNum(x3Input.value)
  const y = parseNum(y3Input.value)
  const z = parseNum(z3Input.value)
  if (x === null || y === null || z === null) return null
  return cartesian3dToSpherical(x, y, z)
})

const enu3d = computed(() => {
  const az = parseNum(az3Input.value)
  const el = parseNum(el3Input.value)
  const range = parseNum(range3Input.value)
  if (az === null || el === null || range === null) return null
  return azElRangeToEnu(az, el, range)
})

const resultText = computed(() => {
  if (dim.value === '2d') {
    const p = polar2d.value
    const c = cart2d.value
    if (!p && !c) return ''
    const lines = []
    if (p) {
      lines.push(`直角 (${x2Input.value}, ${y2Input.value}) → 极坐标`)
      lines.push(`r = ${fmt(p.r, 6)}`)
      lines.push(`θ = ${fmt(p.theta, 6)}°（自北顺时针）`)
    }
    if (c) {
      if (lines.length) lines.push('')
      lines.push(`极坐标 (${r2Input.value}, ${theta2Input.value}°) → 直角`)
      lines.push(`x = ${fmt(c.x, 6)}（东）`)
      lines.push(`y = ${fmt(c.y, 6)}（北）`)
    }
    return lines.join('\n')
  }

  const s = sph3d.value
  const q = enu3d.value
  if (!s && !q) return ''
  const lines = []
  if (s) {
    lines.push(`直角 (${x3Input.value}, ${y3Input.value}, ${z3Input.value}) → 球坐标`)
    lines.push(`r = ${fmt(s.r, 6)}`)
    lines.push(`az = ${fmt(s.az, 6)}°（自北顺时针）`)
    lines.push(`zen = ${fmt(s.zen, 6)}°`)
    lines.push(`el = ${fmt(s.el, 6)}°`)
  }
  if (q) {
    if (lines.length) lines.push('')
    lines.push(`球坐标 (az ${az3Input.value}°, el ${el3Input.value}°, range ${range3Input.value}) → ENU`)
    lines.push(`e = ${fmt(q.e, 6)}（x 东）`)
    lines.push(`n = ${fmt(q.n, 6)}（y 北）`)
    lines.push(`u = ${fmt(q.u, 6)}（z 天）`)
  }
  return lines.join('\n')
})
</script>

<style scoped>
.coord-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.group-title {
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  margin: 0;
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
@media (max-width: 640px) {
  .coord-grid {
    grid-template-columns: 1fr;
  }
}
</style>