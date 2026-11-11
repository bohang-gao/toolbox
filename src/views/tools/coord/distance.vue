<template>
  <ToolShell
    path="/coord/distance"
    title="经纬度距离计算"
    intro="计算两点间的球面距离（Haversine）与椭球距离（Vincenty 反算），给出起点 / 终点方位角及两种模型的差值，并反查两端所在行政区划与地址；另提供已知起点、方位角与距离的 Vincenty 正算。"
    :usage="[
      '填入两点的纬度、经度（单位：十进制度），选择椭球基准。',
      '距离同时以米、千米、海里输出；方位角自正北顺时针，单位度。',
      '「查询两端地址」按 WGS84 坐标调用 OpenStreetMap Nominatim 反查起点 / 终点位置，失败时回退 BigDataCloud；需联网，结果仅供定位参考。',
      '正算模块输入起点、方位角与距离，得到终点经纬度与终点方位角。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 两点坐标</div>
      <div class="option-panel">
        <div class="coord-grid">
          <label>
            <span class="form-label">起点纬度（°）</span>
            <input v-model="lat1Input" class="el-input__inner mt-2" type="text" spellcheck="false" placeholder="39.9042" />
          </label>
          <label>
            <span class="form-label">起点经度（°）</span>
            <input v-model="lon1Input" class="el-input__inner mt-2" type="text" spellcheck="false" placeholder="116.4074" />
          </label>
          <label>
            <span class="form-label">终点纬度（°）</span>
            <input v-model="lat2Input" class="el-input__inner mt-2" type="text" spellcheck="false" placeholder="31.2304" />
          </label>
          <label>
            <span class="form-label">终点经度（°）</span>
            <input v-model="lon2Input" class="el-input__inner mt-2" type="text" spellcheck="false" placeholder="121.4737" />
          </label>
          <label>
            <span class="form-label">椭球基准</span>
            <select v-model="ell" class="el-input__inner mt-2">
              <option v-for="key in ELL_OPTIONS" :key="key" :value="key">{{ ELLIPSOIDS[key].name }}</option>
            </select>
          </label>
        </div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>2</b> 距离与方位角</div>
      <div class="option-panel">
        <table v-if="result" class="data-table">
          <thead>
            <tr>
              <th>方法</th>
              <th>距离（m）</th>
              <th>距离（km）</th>
              <th>距离（海里）</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Haversine（球面）</td>
              <td>{{ fmt(result.h, 3) }}</td>
              <td>{{ fmt(result.h / 1000, 6) }}</td>
              <td>{{ fmt(result.h / 1852, 6) }}</td>
            </tr>
            <tr>
              <td>Vincenty（{{ ELLIPSOIDS[ell].name }}）</td>
              <td>{{ fmt(result.v.distance, 3) }}</td>
              <td>{{ fmt(result.v.distance / 1000, 6) }}</td>
              <td>{{ fmt(result.v.distance / 1852, 6) }}</td>
            </tr>
            <tr>
              <td>差值（H − V）</td>
              <td colspan="3">{{ fmt(result.diff, 3) }} m</td>
            </tr>
          </tbody>
        </table>
        <table v-if="result" class="data-table mt-4">
          <tbody>
            <tr><td>起点方位角（°）</td><td>{{ fmt(result.v.initialBearing, 6) }}</td></tr>
            <tr><td>终点方位角（°）</td><td>{{ fmt(result.v.finalBearing, 6) }}</td></tr>
          </tbody>
        </table>
        <p v-if="!result" class="tool-note">填写上方两点经纬度后点击「计算距离」，距离与方位角会显示在这里。</p>
        <div class="flex flex-wrap mt-4" style="gap:10px">
          <button type="button" class="el-button" @click="copyInverse">复制结果</button>
        </div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>3</b> 两端地址</div>
      <div class="option-panel">
        <div class="flex flex-wrap" style="gap:10px;align-items:center">
          <button type="button" class="el-button" :disabled="geo.status === 'loading'" @click="lookupPlaces">
            {{ geo.status === 'loading' ? '查询中…' : '查询两端地址' }}
          </button>
          <span class="tool-note" style="margin:0">按 WGS84 坐标反查起点 / 终点所在行政区划与地址（需联网）</span>
        </div>

        <div v-if="geo.status === 'error'" class="result-box mt-4" style="color:#e54d42">{{ geo.error }}</div>

        <table v-if="geo.status === 'ok'" class="data-table mt-4">
          <thead>
            <tr>
              <th style="width:88px">位置</th>
              <th>坐标（WGS84）</th>
              <th>行政区划</th>
              <th>详细地址</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in geo.points" :key="p.label">
              <td>{{ p.label }}</td>
              <td>{{ p.lon.toFixed(6) }}, {{ p.lat.toFixed(6) }}</td>
              <td>{{ p.region || '—' }}</td>
              <td>{{ p.display || '—' }}</td>
            </tr>
          </tbody>
        </table>
        <template v-if="geo.status === 'ok'">
          <div class="result-box mt-4">{{ geo.text }}</div>
          <div class="flex flex-wrap mt-4" style="gap:10px">
            <button type="button" class="el-button el-button--info" @click="copyText(geo.text, '两端地址已复制')">复制地址</button>
            <a class="el-button" :href="geo.links.start" target="_blank" rel="noopener">起点 OSM</a>
            <a class="el-button" :href="geo.links.end" target="_blank" rel="noopener">终点 OSM</a>
          </div>
        </template>
        <div v-else-if="geo.status === 'idle'" class="tool-note">点「计算距离」确定两端坐标后，再点「查询两端地址」即可得到起点与终点的省市区和详细地址。</div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>4</b> 正算：起点 + 方位角 + 距离 → 终点</div>
      <div class="option-panel">
        <div class="coord-grid">
          <label>
            <span class="form-label">起点纬度（°）</span>
            <input v-model="dLatInput" class="el-input__inner mt-2" type="text" spellcheck="false" placeholder="39.9042" />
          </label>
          <label>
            <span class="form-label">起点经度（°）</span>
            <input v-model="dLonInput" class="el-input__inner mt-2" type="text" spellcheck="false" placeholder="116.4074" />
          </label>
          <label>
            <span class="form-label">方位角（°，自北顺时针）</span>
            <input v-model="bearingInput" class="el-input__inner mt-2" type="text" spellcheck="false" placeholder="45" />
          </label>
          <label>
            <span class="form-label">距离（m）</span>
            <input v-model="distInput" class="el-input__inner mt-2" type="text" spellcheck="false" placeholder="1000" />
          </label>
        </div>

        <table v-if="direct" class="data-table mt-4">
          <tbody>
            <tr><td>终点纬度（°）</td><td>{{ fmt(direct.lat, 8) }}</td></tr>
            <tr><td>终点经度（°）</td><td>{{ fmt(direct.lon, 8) }}</td></tr>
            <tr><td>终点方位角（°）</td><td>{{ fmt(direct.finalBearing, 6) }}</td></tr>
          </tbody>
        </table>
        <p v-else class="tool-note mt-2">请输入有效的起点、方位角与距离。</p>

        <div class="flex flex-wrap mt-4" style="gap:10px">
          <button type="button" class="el-button el-button--primary" @click="calcDirect">正算</button>
          <button type="button" class="el-button" @click="copyDirect">复制正算结果</button>
        </div>
      </div>
    </div>

    <div class="step-actions">
      <button type="button" class="el-button el-button--primary" @click="calcInverse">计算距离</button>
      <button type="button" class="el-button el-button--info" @click="clearAll">清空</button>
    </div>
  </ToolShell>
</template>

<script setup>
import { reactive, ref } from 'vue'
import ToolShell from '../../../components/ToolShell.vue'
import { msgError } from '../../../lib/ui.js'
import { copyText } from '../textkit.js'
import { ELLIPSOIDS, haversine, vincentyInverse, vincentyDirect } from '../coordkit.js'
import { reverseGeocode } from '../revgeo.js'

const ELL_OPTIONS = ['WGS84', 'CGCS2000']

const lat1Input = ref('39.9042')
const lon1Input = ref('116.4074')
const lat2Input = ref('31.2304')
const lon2Input = ref('121.4737')
const ell = ref('WGS84')
const result = ref(null)

const dLatInput = ref('39.9042')
const dLonInput = ref('116.4074')
const bearingInput = ref('45')
const distInput = ref('1000')
const direct = ref(null)

const fmt = (v, d = 3) => Number(v).toFixed(d)

function parseNum(raw) {
  const t = String(raw ?? '').trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function checkLatLon(lat, lon) {
  if (lat < -90 || lat > 90) return '纬度必须在 -90 ~ 90 之间'
  if (lon < -180 || lon > 180) return '经度必须在 -180 ~ 180 之间'
  return null
}

function calcInverse() {
  const lat1 = parseNum(lat1Input.value)
  const lon1 = parseNum(lon1Input.value)
  const lat2 = parseNum(lat2Input.value)
  const lon2 = parseNum(lon2Input.value)
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) {
    result.value = null
    msgError('起点或终点经纬度不是有效数字')
    return
  }
  const err = checkLatLon(lat1, lon1) || checkLatLon(lat2, lon2)
  if (err) {
    result.value = null
    msgError(err)
    return
  }
  const h = haversine(lat1, lon1, lat2, lon2)
  const v = vincentyInverse(lat1, lon1, lat2, lon2, ell.value)
  result.value = { lat1, lon1, lat2, lon2, h, v, diff: h - v.distance }
  resetGeo()
}

function calcDirect() {
  const lat1 = parseNum(dLatInput.value)
  const lon1 = parseNum(dLonInput.value)
  const bearing = parseNum(bearingInput.value)
  const distance = parseNum(distInput.value)
  if (lat1 === null || lon1 === null || bearing === null || distance === null) {
    direct.value = null
    msgError('起点、方位角或距离不是有效数字')
    return
  }
  const err = checkLatLon(lat1, lon1)
  if (err) {
    direct.value = null
    msgError(err)
    return
  }
  if (distance < 0) {
    direct.value = null
    msgError('距离不能为负数')
    return
  }
  direct.value = vincentyDirect(lat1, lon1, bearing, distance, ell.value)
}

function copyInverse() {
  const r = result.value
  if (!r) {
    msgError('当前没有可复制的距离结果')
    return
  }
  const text = [
    `椭球：${ELLIPSOIDS[ell.value].name}`,
    `Haversine：${fmt(r.h, 3)} m / ${fmt(r.h / 1000, 6)} km / ${fmt(r.h / 1852, 6)} 海里`,
    `Vincenty：${fmt(r.v.distance, 3)} m / ${fmt(r.v.distance / 1000, 6)} km / ${fmt(r.v.distance / 1852, 6)} 海里`,
    `差值（H − V）：${fmt(r.diff, 3)} m`,
    `起点方位角：${fmt(r.v.initialBearing, 6)}°`,
    `终点方位角：${fmt(r.v.finalBearing, 6)}°`
  ].join('\n')
  copyText(text, '结果已复制')
}

function copyDirect() {
  const d = direct.value
  if (!d) {
    msgError('当前没有可复制的正算结果')
    return
  }
  const text = [
    `终点纬度：${fmt(d.lat, 8)}`,
    `终点经度：${fmt(d.lon, 8)}`,
    `终点方位角：${fmt(d.finalBearing, 6)}°`
  ].join('\n')
  copyText(text, '正算结果已复制')
}

// ===== 两端地址反查 =====
const geo = reactive({
  status: 'idle', // idle | loading | ok | error
  error: '',
  points: [],
  text: '',
  links: { start: '', end: '' }
})

function resetGeo() {
  geo.status = 'idle'
  geo.error = ''
  geo.points = []
  geo.text = ''
  geo.links = { start: '', end: '' }
}

async function lookupPlaces() {
  if (!result.value) {
    calcInverse()
    if (!result.value) return
  }
  const r = result.value
  geo.status = 'loading'
  geo.error = ''
  geo.points = []
  geo.text = ''

  const targets = [
    { label: '起点', lat: r.lat1, lon: r.lon1 },
    { label: '终点', lat: r.lat2, lon: r.lon2 }
  ]

  const points = []
  const notes = []
  for (const t of targets) {
    try {
      const info = await reverseGeocode(t.lat, t.lon)
      points.push({
        label: t.label,
        lat: t.lat,
        lon: t.lon,
        region: info.region || '—',
        display: info.display || info.name || '—',
        source: info.source
      })
    } catch (e) {
      const msg = e && e.kind === 'no-address' ? '该坐标无收录地址（多为海域或无人区）' : '查询失败，可稍后重试'
      points.push({ label: t.label, lat: t.lat, lon: t.lon, region: msg, display: '—', source: '' })
      notes.push(`${t.label}：${msg}`)
    }
  }

  geo.points = points
  geo.links = {
    start: `https://www.openstreetmap.org/?mlat=${r.lat1}&mlon=${r.lon1}#map=14/${r.lat1}/${r.lon1}`,
    end: `https://www.openstreetmap.org/?mlat=${r.lat2}&mlon=${r.lon2}#map=14/${r.lat2}/${r.lon2}`
  }
  geo.text = [
    '两端地址（OpenStreetMap / BigDataCloud 逆地理编码）',
    ...points.map((p) =>
      [
        `${p.label}：${p.lon.toFixed(6)}, ${p.lat.toFixed(6)}`,
        `　行政区划：${p.region || '—'}`,
        `　地址：${p.display || '—'}`
      ].join('\n')
    )
  ].join('\n')

  if (points.every((p) => !p.source)) {
    geo.status = 'error'
    geo.error = `两端地址均查询失败（${notes.join('；')}）。可能是网络受限或接口限流，可稍后重试。`
    return
  }
  geo.status = 'ok'
  if (notes.length) geo.error = notes.join('；')
}

function clearAll() {
  lat1Input.value = ''
  lon1Input.value = ''
  lat2Input.value = ''
  lon2Input.value = ''
  result.value = null
  dLatInput.value = ''
  dLonInput.value = ''
  bearingInput.value = ''
  distInput.value = ''
  direct.value = null
  resetGeo()
}

calcInverse()
calcDirect()
</script>

<style scoped>
.coord-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
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
