<template>
  <ToolShell
    path="/coord/position"
    title="经纬度查询定位"
    intro="输入 WGS84 经纬度，一次性给出 WGS84 / GCJ02（火星坐标）/ BD09（百度坐标）三套表示、对应 Geohash 与 UTM 投影，并生成高德、腾讯、百度与 OpenStreetMap 的定位外链。本工具不加载任何地图 SDK。"
    :usage="[
      '经度、纬度支持十进制度（如 116.4074）与度分秒（如 116°24′26.64″）；南纬/西经可用负数或 S/W 后缀。',
      '点击「计算」后列出三套坐标系的经纬度，外链按钮会在新标签页打开对应地图。',
      '腾讯、百度外链分别使用 GCJ02、BD09 坐标；直接把 WGS84 坐标填进百度会偏移数百米。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 输入经纬度</div>
      <div class="option-panel">
        <div class="coord-grid">
          <label>
            <span class="form-label">经度（WGS84）</span>
            <input
              v-model="lonInput"
              class="el-input__inner mt-2"
              type="text"
              spellcheck="false"
              placeholder="116.4074 或 116°24′26.64″"
              @keyup.enter="calc"
            />
          </label>
          <label>
            <span class="form-label">纬度（WGS84）</span>
            <input
              v-model="latInput"
              class="el-input__inner mt-2"
              type="text"
              spellcheck="false"
              placeholder="39.9042 或 39°54′15.12″"
              @keyup.enter="calc"
            />
          </label>
        </div>
        <div class="mt-2 hint">经纬度顺序固定为「经度, 纬度」；输入按 WGS84 基准处理。</div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>2</b> 坐标系结果</div>
      <div class="option-panel">
        <template v-if="result">
        <table class="data-table">
          <thead>
            <tr>
              <th>坐标系</th>
              <th>经度（°）</th>
              <th>纬度（°）</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>WGS84（GPS 原始）</td>
              <td>{{ fmt(result.lon) }}</td>
              <td>{{ fmt(result.lat) }}</td>
            </tr>
            <tr>
              <td>GCJ02（高德 / 腾讯）</td>
              <td>{{ fmt(result.gcj.lon) }}</td>
              <td>{{ fmt(result.gcj.lat) }}</td>
            </tr>
            <tr>
              <td>BD09（百度）</td>
              <td>{{ fmt(result.bd.lon) }}</td>
              <td>{{ fmt(result.bd.lat) }}</td>
            </tr>
          </tbody>
        </table>

        <div class="result-box mt-4">{{ detailText }}</div>

        <div class="flex flex-wrap mt-4" style="gap:10px">
          <a class="el-button" :href="result.links.amap" target="_blank" rel="noopener">高德地图</a>
          <a class="el-button" :href="result.links.tencent" target="_blank" rel="noopener">腾讯地图</a>
          <a class="el-button" :href="result.links.baidu" target="_blank" rel="noopener">百度地图</a>
          <a class="el-button" :href="result.links.osm" target="_blank" rel="noopener">OpenStreetMap</a>
          <button type="button" class="el-button el-button--info" @click="copyText(resultText, '定位结果已复制')">复制结果</button>
        </div>
        </template>
        <div v-else class="tool-note">输入经纬度后点击「计算」，各坐标系结果与地图链接会显示在这里。</div>
      </div>
    </div>

    <div class="step-actions">
      <button type="button" class="el-button el-button--primary" @click="calc">计算</button>
      <button type="button" class="el-button el-button--info" @click="clearAll">清空</button>
    </div>
  </ToolShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import ToolShell from '../../../components/ToolShell.vue'
import { msgError } from '../../../lib/ui.js'
import { copyText } from '../textkit.js'
import { convertChinaDatum, geohashEncode, utmForward, parseDms } from '../coordkit.js'

const lonInput = ref('116.4074')
const latInput = ref('39.9042')
const result = ref(null)

const fmt = (v) => Number(v).toFixed(8)

function parseAngle(raw) {
  const t = String(raw || '').trim()
  if (!t) return NaN
  const n = Number(t)
  if (Number.isFinite(n)) return n
  const d = parseDms(t)
  return d === null ? NaN : d
}

function buildLinks(lat, lon, gcj, bd) {
  const w = 6
  const wLat = lat.toFixed(w)
  const wLon = lon.toFixed(w)
  const gLat = gcj.lat.toFixed(w)
  const gLon = gcj.lon.toFixed(w)
  const bLat = bd.lat.toFixed(w)
  const bLon = bd.lon.toFixed(w)
  return {
    amap: `https://uri.amap.com/marker?position=${gLon},${gLat}`,
    tencent: `https://apis.map.qq.com/uri/v1/marker?marker=coord:${gLat},${gLon}`,
    baidu: `https://api.map.baidu.com/marker?location=${bLat},${bLon}&title=位置&content=坐标&output=html`,
    osm: `https://www.openstreetmap.org/?mlat=${wLat}&mlon=${wLon}#map=15/${wLat}/${wLon}`
  }
}

function calc() {
  const lon = parseAngle(lonInput.value)
  const lat = parseAngle(latInput.value)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    result.value = null
    msgError('经度或纬度格式无法识别')
    return
  }
  if (lat < -90 || lat > 90) {
    result.value = null
    msgError('纬度必须在 -90 ~ 90 之间')
    return
  }
  if (lon < -180 || lon > 180) {
    result.value = null
    msgError('经度必须在 -180 ~ 180 之间')
    return
  }
  const gcj = convertChinaDatum(lat, lon, 'WGS84', 'GCJ02')
  const bd = convertChinaDatum(lat, lon, 'WGS84', 'BD09')
  result.value = {
    lat,
    lon,
    gcj,
    bd,
    geohash: geohashEncode(lat, lon, 12),
    utm: utmForward(lat, lon),
    links: buildLinks(lat, lon, gcj, bd)
  }
}

const detailText = computed(() => {
  const r = result.value
  if (!r) return ''
  return [
    `Geohash(12)：${r.geohash}`,
    `UTM：${r.utm.zone}${r.utm.hemisphere}  E ${r.utm.x.toFixed(3)} m  N ${r.utm.y.toFixed(3)} m`,
    `中央经线：${r.utm.lon0}°`
  ].join('\n')
})

const resultText = computed(() => {
  const r = result.value
  if (!r) return ''
  return [
    '经纬度定位结果（WGS84 输入）',
    `WGS84：${fmt(r.lon)}, ${fmt(r.lat)}`,
    `GCJ02：${fmt(r.gcj.lon)}, ${fmt(r.gcj.lat)}`,
    `BD09：${fmt(r.bd.lon)}, ${fmt(r.bd.lat)}`,
    `Geohash(12)：${r.geohash}`,
    `UTM：${r.utm.zone}${r.utm.hemisphere} E ${r.utm.x.toFixed(3)} N ${r.utm.y.toFixed(3)} (lon0=${r.utm.lon0}°)`,
    `高德：${r.links.amap}`,
    `腾讯：${r.links.tencent}`,
    `百度：${r.links.baidu}`,
    `OSM：${r.links.osm}`
  ].join('\n')
})

function clearAll() {
  lonInput.value = ''
  latInput.value = ''
  result.value = null
}
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
