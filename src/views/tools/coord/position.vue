<template>
  <ToolShell
    path="/coord/position"
    title="经纬度查询定位"
    intro="输入 WGS84 经纬度，一次性给出 WGS84 / GCJ02（火星坐标）/ BD09（百度坐标）三套表示、对应 Geohash 与 UTM 投影，并生成高德、腾讯、百度与 OpenStreetMap 的定位外链；还可反查该坐标所在的行政区划与地址。"
    :usage="[
      '经度、纬度支持十进制度（如 116.4074）与度分秒（如 116°24′26.64″）；南纬/西经可用负数或 S/W 后缀。',
      '点击「计算」后列出三套坐标系的经纬度，外链按钮会在新标签页打开对应地图。',
      '腾讯、百度外链分别使用 GCJ02、BD09 坐标；直接把 WGS84 坐标填进百度会偏移数百米。',
      '「查询地址」按 WGS84 坐标调用 OpenStreetMap Nominatim 反查位置，失败时自动回退到 BigDataCloud；两者均为公开接口，需联网，结果仅供定位参考。'
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

    <div class="step-block">
      <div class="step"><b>3</b> 地理位置反查</div>
      <div class="option-panel">
        <div class="flex flex-wrap" style="gap:10px;align-items:center">
          <button type="button" class="el-button el-button--primary" :disabled="geo.status === 'loading'" @click="lookupPlace">
            {{ geo.status === 'loading' ? '查询中…' : '查询地址' }}
          </button>
          <span class="tool-note" style="margin:0">按 WGS84 坐标反查行政区划与地址（需联网）</span>
        </div>

        <div v-if="geo.status === 'error'" class="result-box mt-4" style="color:#e54d42">{{ geo.error }}</div>

        <template v-if="geo.status === 'ok'">
          <table class="data-table mt-4">
            <tbody>
              <tr v-for="row in geo.rows" :key="row.k">
                <td class="k">{{ row.k }}</td>
                <td class="v">{{ row.v }}</td>
              </tr>
            </tbody>
          </table>
          <div class="result-box mt-4">{{ geo.display }}</div>
          <div class="flex flex-wrap mt-4" style="gap:10px">
            <button type="button" class="el-button el-button--info" @click="copyText(geo.text, '地理位置已复制')">复制地址</button>
            <a class="el-button" :href="geo.links.osm" target="_blank" rel="noopener">在 OSM 查看</a>
          </div>
        </template>
        <div v-else-if="geo.status === 'idle'" class="tool-note">先点「计算」确定坐标，再点「查询地址」即可得到该点所在的省市区与街道地址。</div>
      </div>
    </div>

    <div class="step-actions">
      <button type="button" class="el-button el-button--primary" @click="calc">计算</button>
      <button type="button" class="el-button el-button--info" @click="clearAll">清空</button>
    </div>
  </ToolShell>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
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
  resetGeo()
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
  resetGeo()
}

// ===== 逆地理编码：坐标 → 地址 =====
const GEO_TIMEOUT = 8000

const geo = reactive({
  status: 'idle', // idle | loading | ok | error
  error: '',
  rows: [],
  display: '',
  text: '',
  links: { osm: '' }
})

function resetGeo() {
  geo.status = 'idle'
  geo.error = ''
  geo.rows = []
  geo.display = ''
  geo.text = ''
  geo.links = { osm: '' }
}

async function fetchJson(url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), GEO_TIMEOUT)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
    if (res.status === 429) throw new Error('请求过于频繁（429），请稍等几秒再试')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

// 直辖市没有 state 字段，用 ISO3166-2 省级码兜底
const CN_PROVINCE_BY_ISO = {
  'CN-BJ': '北京市',
  'CN-SH': '上海市',
  'CN-TJ': '天津市',
  'CN-CQ': '重庆市',
  'CN-HE': '河北省',
  'CN-SX': '山西省',
  'CN-LN': '辽宁省',
  'CN-JL': '吉林省',
  'CN-HL': '黑龙江省',
  'CN-JS': '江苏省',
  'CN-ZJ': '浙江省',
  'CN-AH': '安徽省',
  'CN-FJ': '福建省',
  'CN-JX': '江西省',
  'CN-SD': '山东省',
  'CN-HA': '河南省',
  'CN-HB': '湖北省',
  'CN-HN': '湖南省',
  'CN-GD': '广东省',
  'CN-GX': '广西壮族自治区',
  'CN-HI': '海南省',
  'CN-SC': '四川省',
  'CN-GZ': '贵州省',
  'CN-YN': '云南省',
  'CN-XZ': '西藏自治区',
  'CN-SN': '陕西省',
  'CN-GS': '甘肃省',
  'CN-QH': '青海省',
  'CN-NX': '宁夏回族自治区',
  'CN-XJ': '新疆维吾尔自治区',
  'CN-TW': '台湾省',
  'CN-HK': '香港特别行政区',
  'CN-MO': '澳门特别行政区'
}

// 上游多语言字段会拼成「法国;法國」，取首个
function firstName(v) {
  const s = String(v == null ? '' : v)
  return s.split(';')[0].trim()
}

// 按出现顺序去重（省市同名时只保留一个）
function uniqueJoin(parts) {
  const seen = []
  for (const p of parts) {
    const v = firstName(p)
    if (v && v !== '—' && !seen.includes(v)) seen.push(v)
  }
  return seen.join(' ')
}

// OpenStreetMap Nominatim：粒度最细（可到门牌）
async function viaNominatim(lat, lon) {
  const url =
    'https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=zh-CN' +
    `&lat=${lat}&lon=${lon}`
  const data = await fetchJson(url)
  if (!data || (!data.display_name && !data.address)) throw new Error('empty')
  const a = data.address || {}
  const segs = String(data.display_name || '')
    .split(',')
    .map((s) => s.trim())
  const NON_ADMIN = /(社区|园区|片区|小区|街区|景区|校区|矿区|灾区|城区|库区)$/
  const isDistrict = (s) =>
    s.length >= 2 && s.length <= 4 && /^[\u4e00-\u9fa5]+$/.test(s) && /(区|县|旗)$/.test(s) && !NON_ADMIN.test(s)

  let province = a.state || a.province || a.region || CN_PROVINCE_BY_ISO[a['ISO3166-2-lvl4']] || ''
  if (!province) province = segs.find((s) => /(省|自治区|特别行政区)$/.test(s)) || ''

  const cityOrCounty = [a.city, a.county, a.district, a.municipality].filter(Boolean)
  // 上游常缺市级（如广州只给越秀区），从 display_name 补，且排在区县之前
  if (!cityOrCounty.some((s) => /市$/.test(s))) {
    const c = segs.find(
      (s) => /^[\u4e00-\u9fa5]{2,4}市$/.test(s) && s !== province && !cityOrCounty.includes(s)
    )
    if (c) cityOrCounty.unshift(c)
  }
  // 上游偶尔缺区县（如上海只给市），从 display_name 补
  if (!cityOrCounty.some((s) => /(区|县|旗)$/.test(s))) {
    const d = segs.find((s) => isDistrict(s) && s !== province && !cityOrCounty.includes(s))
    if (d) cityOrCounty.push(d)
  }
  const rows = [
    { k: '国家 / 地区', v: firstName(a.country) || '—' },
    { k: '行政区划', v: uniqueJoin([province, ...cityOrCounty]) || '—' },
    { k: '街道 / 乡镇', v: firstName(a.suburb || a.town || a.township || a.village || a.city_district) || '—' },
    { k: '社区 / 片区', v: firstName(a.quarter || a.neighbourhood || a.residential) || '—' },
    { k: '道路', v: firstName(a.road || a.pedestrian || a.footway) || '—' },
    { k: '门牌 / 地物', v: firstName(a.house_number || a.landuse || a.building || a.tourism || data.name) || '—' },
    { k: '邮编', v: a.postcode || '—' },
    { k: '地物类别', v: [data.category, data.type].filter(Boolean).join(' / ') || '—' }
  ]
  const displayName = String(data.display_name || '')
    .split(',')
    .map((s) => firstName(s))
    .filter(Boolean)
    .join('，')
  return { source: 'OpenStreetMap Nominatim', rows, display: displayName, name: firstName(data.name) }
}

// BigDataCloud：行政区划规整，作为回退
async function viaBigDataCloud(lat, lon) {
  const url =
    'https://api.bigdatacloud.net/data/reverse-geocode-client' +
    `?latitude=${lat}&longitude=${lon}&localityLanguage=zh`
  const data = await fetchJson(url)
  if (!data || (!data.countryName && !data.city && !data.locality)) throw new Error('empty')
  const admin = (data.localityInfo && data.localityInfo.administrative) || []
  const pick = (lvl) => {
    const hit = admin.find((x) => Number(x.adminLevel) === lvl)
    return hit ? hit.name : ''
  }
  const rows = [
    { k: '国家 / 地区', v: data.countryName || pick(2) || '—' },
    { k: '行政区划', v: uniqueJoin([data.principalSubdivision || pick(4), data.city, data.locality]) || '—' },
    { k: '街道 / 乡镇', v: pick(8) || '—' },
    { k: '社区 / 片区', v: pick(10) || '—' },
    { k: '道路', v: '—' },
    { k: '门牌 / 地物', v: '—' },
    { k: '邮编', v: data.postcode || '—' },
    { k: '地物类别', v: '—' }
  ]
  const display = [data.countryName, data.principalSubdivision, data.city, data.locality]
    .filter(Boolean)
    .join(' ')
  return { source: 'BigDataCloud', rows, display, name: data.locality || '' }
}

// Nominatim 要求 ≤1 req/s，客户端自行节流
const GEO_MIN_GAP = 1200
let lastLookupAt = 0

async function lookupPlace() {
  if (!result.value) {
    calc()
    if (!result.value) return
  }
  const wait = GEO_MIN_GAP - (Date.now() - lastLookupAt)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastLookupAt = Date.now()

  const { lat, lon } = result.value
  geo.status = 'loading'
  geo.error = ''
  geo.rows = []
  geo.display = ''

  const errors = []
  let noAddress = false
  for (const provider of [viaNominatim, viaBigDataCloud]) {
    try {
      const info = await provider(lat, lon)
      geo.rows = [{ k: '数据来源', v: info.source }, ...info.rows]
      geo.display = info.display || info.name || '—'
      geo.text = [
        `${info.source} 逆地理编码结果`,
        `坐标（WGS84）：${lon.toFixed(6)}, ${lat.toFixed(6)}`,
        ...info.rows.filter((r) => r.v && r.v !== '—').map((r) => `${r.k}：${r.v}`),
        `地址：${geo.display}`
      ].join('\n')
      geo.links = {
        osm: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`
      }
      geo.status = 'ok'
      return
    } catch (e) {
      if (e && e.message === 'empty') noAddress = true
      errors.push(`${provider.name}: ${e && e.name === 'AbortError' ? '超时' : String(e && e.message ? e.message : e)}`)
    }
  }

  if (noAddress && errors.every((s) => s.includes('empty'))) {
    geo.status = 'error'
    geo.error = `该坐标不在已收录的行政区内（多为海域、无人区或极地），查不到地址。可点下方地图外链确认位置。`
    return
  }

  geo.status = 'error'
  geo.error = `逆地理编码服务暂不可用（${errors.join('；')}）。可能是网络受限或接口限流，可稍后重试，或用下方地图外链查看位置。`
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
.data-table td.k {
  color: #64748b;
  width: 132px;
  white-space: nowrap;
}
.data-table td.v {
  word-break: break-word;
}
@media (max-width: 640px) {
  .coord-grid {
    grid-template-columns: 1fr;
  }
}
</style>
