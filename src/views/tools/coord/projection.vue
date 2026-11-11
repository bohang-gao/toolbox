<template>
  <ToolShell
    path="/coord/projection"
    title="坐标投影计算"
    intro="支持横轴墨卡托（TM / Gauss-Krüger）、UTM 与 Web 墨卡托（EPSG:3857）三种投影的正反算。正算由经纬度求平面坐标，反算由平面坐标还原经纬度，并自动做一次往返核对。"
    :usage="[
      '选择投影类型与计算方向，填写对应参数。TM 可自定义中央经线、比例因子、假东与假北；UTM 需指定带号与南北半球。',
      'UTM 正算时可点「自动计算带号」按经度推算 6° 带号；Web 墨卡托无需任何参数。',
      '结果同时给出投影坐标、带号/中央经线，以及往返核对得到的经纬度或坐标残差。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 输入与参数</div>
      <div class="option-panel">
        <div class="field-grid">
          <label class="field">
            <span class="form-label">投影类型</span>
            <select v-model="kind" class="el-input__inner">
              <option value="tm">TM（横轴墨卡托）</option>
              <option value="utm">UTM（通用横轴墨卡托）</option>
              <option value="web">Web 墨卡托（EPSG:3857）</option>
            </select>
          </label>
          <div class="field">
            <span class="form-label">计算方向</span>
            <div class="radio-row">
              <label class="el-radio"><input v-model="direction" type="radio" value="forward" />正算</label>
              <label class="el-radio"><input v-model="direction" type="radio" value="inverse" />反算</label>
            </div>
          </div>
          <label v-if="kind !== 'web'" class="field">
            <span class="form-label">参考椭球</span>
            <select v-model="ell" class="el-input__inner">
              <option v-for="key in ELL_KEYS" :key="key" :value="key">{{ ELLIPSOIDS[key].name }}</option>
            </select>
          </label>
        </div>

        <div v-if="kind === 'tm'" class="field-grid mt-4">
          <label class="field">
            <span class="form-label">中央经线 lon0（°）</span>
            <input v-model="lon0" class="el-input__inner" type="text" inputmode="decimal" spellcheck="false" />
          </label>
          <label class="field">
            <span class="form-label">比例因子 k0</span>
            <input v-model="k0" class="el-input__inner" type="text" inputmode="decimal" spellcheck="false" />
          </label>
          <label class="field">
            <span class="form-label">假东 FE（m）</span>
            <input v-model="fe" class="el-input__inner" type="text" inputmode="decimal" spellcheck="false" />
          </label>
          <label class="field">
            <span class="form-label">假北 FN（m）</span>
            <input v-model="fn" class="el-input__inner" type="text" inputmode="decimal" spellcheck="false" />
          </label>
        </div>

        <div v-if="kind === 'utm'" class="field-grid mt-4">
          <label class="field">
            <span class="form-label">UTM 带号（1–60）</span>
            <input v-model="zone" class="el-input__inner" type="text" inputmode="numeric" spellcheck="false" />
          </label>
          <div class="field">
            <span class="form-label">半球</span>
            <label class="el-radio radio-inline">
              <input v-model="south" type="checkbox" :disabled="isForward" />南半球（S）
            </label>
          </div>
          <div class="field">
            <span class="form-label">按经度推算</span>
            <button
              type="button"
              class="el-button"
              :class="{ 'is-disabled': !isForward }"
              :disabled="!isForward"
              @click="autoZone"
            >
              自动计算带号
            </button>
          </div>
        </div>

        <div class="field-grid mt-4">
          <template v-if="isForward">
            <label class="field">
              <span class="form-label">纬度（°）</span>
              <input v-model="latInput" class="el-input__inner" type="text" inputmode="decimal" spellcheck="false" placeholder="39.9042" />
            </label>
            <label class="field">
              <span class="form-label">经度（°）</span>
              <input v-model="lonInput" class="el-input__inner" type="text" inputmode="decimal" spellcheck="false" placeholder="116.4074" />
            </label>
          </template>
          <template v-else>
            <label class="field">
              <span class="form-label">X（东坐标，m）</span>
              <input v-model="xInput" class="el-input__inner" type="text" inputmode="decimal" spellcheck="false" />
            </label>
            <label class="field">
              <span class="form-label">Y（北坐标，m）</span>
              <input v-model="yInput" class="el-input__inner" type="text" inputmode="decimal" spellcheck="false" />
            </label>
          </template>
        </div>

        <div class="tool-note">
          <template v-if="isForward">正算输入十进制度经纬度；UTM 带号可点上方按钮按经度推算，南北半球由纬度符号自动判断。</template>
          <template v-else>反算输入投影坐标（米）；UTM 需手动指定带号与南北半球，Web 墨卡托 X/Y 有效范围为 ±20037508.34 m。</template>
        </div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>2</b> 计算结果</div>
      <div class="option-panel">
        <template v-if="result">
          <table class="data-table">
            <tbody>
              <tr v-for="([k, v]) in result.rows" :key="k">
                <td class="k">{{ k }}</td>
                <td class="v">{{ v }}</td>
              </tr>
            </tbody>
          </table>
          <div class="result-box mt-4">{{ result.text }}</div>
          <div class="flex mt-4">
            <button type="button" class="el-button el-button--info" @click="copyText(result.text, '结果已复制')">复制结果</button>
          </div>
        </template>
        <div v-else class="tool-note">填写上方参数后点击「计算」，结果会显示在这里。</div>
      </div>
    </div>

    <div class="step-actions">
      <button type="button" class="el-button el-button--primary" @click="calc">计算</button>
      <button type="button" class="el-button el-button--info" @click="clearAll">清空</button>
    </div>
  </ToolShell>
</template>

<script setup>
import { ref, computed } from 'vue'
import ToolShell from '../../../components/ToolShell.vue'
import { msgError, msgSuccess } from '../../../lib/ui.js'
import { copyText } from '../textkit.js'
import {
  ELLIPSOIDS,
  tmForward,
  tmInverse,
  utmForward,
  utmInverse,
  utmZoneOf,
  webMercatorForward,
  webMercatorInverse
} from '../coordkit.js'

const ELL_KEYS = ['WGS84', 'CGCS2000', 'KRASSOVSKY', 'IAG75', 'GRS80']
const WEB_MAX = 20037508.342789244
const WEB_LAT_MAX = 85.0511287798066
const KIND_LABELS = {
  tm: 'TM（横轴墨卡托）',
  utm: 'UTM（通用横轴墨卡托）',
  web: 'Web 墨卡托（EPSG:3857）'
}

const kind = ref('utm')
const direction = ref('forward')
const ell = ref('WGS84')
const lon0 = ref('117')
const k0 = ref('1')
const fe = ref('500000')
const fn = ref('0')
const zone = ref('50')
const south = ref(false)
const latInput = ref('39.9042')
const lonInput = ref('116.4074')
const xInput = ref('449350')
const yInput = ref('4420000')
const result = ref(null)

const isForward = computed(() => direction.value === 'forward')

function numOf(v) {
  const t = String(v == null ? '' : v).trim()
  if (t === '') return NaN
  const n = Number(t)
  return Number.isFinite(n) ? n : NaN
}

const fmtM = (v, d = 3) => Number(v).toFixed(d)
const fmtDeg = (v, d = 8) => Number(v).toFixed(d)
const fmtArcsec = (v) => Number(v * 3600).toFixed(4)

function fail(message) {
  result.value = null
  msgError(message)
}

function checkLatLon(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '纬度与经度必须是有效数字'
  if (lat < -90 || lat > 90) return '纬度必须在 -90° ~ 90° 之间'
  if (lon < -180 || lon > 180) return '经度必须在 -180° ~ 180° 之间'
  return null
}

function finalize(rows) {
  return { rows, text: rows.map(([k, v]) => `${k}：${v}`).join('\n') }
}

function rowsForward({ label, ellLabel, params, x, y, zoneNo, hemisphere, lon0v, lat, lon, verify }) {
  const rows = [
    ['投影类型', label],
    ['椭球 / 基准', ellLabel],
    ['计算方向', '正算（经纬度 → 投影坐标）'],
    ['投影参数', params],
    ['X（东坐标）', `${fmtM(x)} m`],
    ['Y（北坐标）', `${fmtM(y)} m`]
  ]
  if (zoneNo != null) rows.push(['UTM 带号', `${zoneNo}${hemisphere || ''}`])
  if (lon0v != null) rows.push(['中央经线', `${fmtDeg(lon0v, 4)}°`])
  rows.push(
    ['反算纬度', `${fmtDeg(verify.lat)}°`],
    ['反算经度', `${fmtDeg(verify.lon)}°`],
    ['残差 Δ纬度', `${fmtArcsec(verify.lat - lat)}″`],
    ['残差 Δ经度', `${fmtArcsec(verify.lon - lon)}″`]
  )
  return finalize(rows)
}

function rowsInverse({ label, ellLabel, params, x, y, zoneNo, hemisphere, lon0v, lat, lon, verify }) {
  const rows = [
    ['投影类型', label],
    ['椭球 / 基准', ellLabel],
    ['计算方向', '反算（投影坐标 → 经纬度）'],
    ['投影参数', params],
    ['输入 X（东坐标）', `${fmtM(x)} m`],
    ['输入 Y（北坐标）', `${fmtM(y)} m`]
  ]
  if (zoneNo != null) rows.push(['UTM 带号', `${zoneNo}${hemisphere || ''}`])
  if (lon0v != null) rows.push(['中央经线', `${fmtDeg(lon0v, 4)}°`])
  rows.push(
    ['纬度', `${fmtDeg(lat)}°`],
    ['经度', `${fmtDeg(lon)}°`],
    ['正算核对 X', `${fmtM(verify.x)} m`],
    ['正算核对 Y', `${fmtM(verify.y)} m`],
    ['残差 ΔX', `${fmtM(verify.x - x, 4)} m`],
    ['残差 ΔY', `${fmtM(verify.y - y, 4)} m`]
  )
  return finalize(rows)
}

function calcTm() {
  if (!ELLIPSOIDS[ell.value]) return fail('未知椭球')
  const L0 = numOf(lon0.value)
  const K0 = numOf(k0.value)
  const FE = numOf(fe.value)
  const FN = numOf(fn.value)
  if (![L0, K0, FE, FN].every(Number.isFinite)) return fail('TM 参数必须是有效数字')
  if (K0 <= 0) return fail('比例因子 k0 必须大于 0')
  if (L0 < -180 || L0 > 180) return fail('中央经线必须在 -180° ~ 180° 之间')
  const opts = { ellipsoid: ell.value, k0: K0, lon0: L0, fe: FE, fn: FN }
  const label = KIND_LABELS.tm
  const ellLabel = ELLIPSOIDS[ell.value].name
  const params = `中央经线 ${L0}°，k0=${K0}，假东 ${FE} m，假北 ${FN} m`

  if (isForward.value) {
    const lat = numOf(latInput.value)
    const lon = numOf(lonInput.value)
    const err = checkLatLon(lat, lon)
    if (err) return fail(err)
    if (lat <= -90 || lat >= 90) return fail('TM 正算纬度需在 (-90°, 90°) 之间')
    const out = tmForward(lat, lon, opts)
    const verify = tmInverse(out.x, out.y, opts)
    result.value = rowsForward({ label, ellLabel, params, x: out.x, y: out.y, zoneNo: null, hemisphere: null, lon0v: L0, lat, lon, verify })
    return
  }

  const x = numOf(xInput.value)
  const y = numOf(yInput.value)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return fail('X/Y 必须是有效数字')
  const geo = tmInverse(x, y, opts)
  if (!Number.isFinite(geo.lat) || !Number.isFinite(geo.lon)) return fail('反算失败，请检查坐标与参数')
  const verify = tmForward(geo.lat, geo.lon, opts)
  result.value = rowsInverse({ label, ellLabel, params, x, y, zoneNo: null, hemisphere: null, lon0v: L0, lat: geo.lat, lon: geo.lon, verify })
}

function calcUtm() {
  if (!ELLIPSOIDS[ell.value]) return fail('未知椭球')
  const z = numOf(zone.value)
  if (!Number.isInteger(z) || z < 1 || z > 60) return fail('UTM 带号必须是 1 ~ 60 的整数')
  const label = KIND_LABELS.utm
  const ellLabel = ELLIPSOIDS[ell.value].name

  if (isForward.value) {
    const lat = numOf(latInput.value)
    const lon = numOf(lonInput.value)
    const err = checkLatLon(lat, lon)
    if (err) return fail(err)
    if (lat < -80 || lat > 84) return fail('UTM 标准适用范围为 80°S ~ 84°N')
    const out = utmForward(lat, lon, z, ell.value)
    const verify = utmInverse(out.x, out.y, out.zone, out.hemisphere === 'S', ell.value)
    const params = `带号 ${out.zone}${out.hemisphere}，中央经线 ${out.lon0}°，k0=0.9996，假东 500000 m${out.hemisphere === 'S' ? '，假北 10000000 m' : ''}`
    result.value = rowsForward({
      label,
      ellLabel,
      params,
      x: out.x,
      y: out.y,
      zoneNo: out.zone,
      hemisphere: out.hemisphere,
      lon0v: out.lon0,
      lat,
      lon,
      verify
    })
    return
  }

  const x = numOf(xInput.value)
  const y = numOf(yInput.value)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return fail('X/Y 必须是有效数字')
  const geo = utmInverse(x, y, z, south.value, ell.value)
  if (!Number.isFinite(geo.lat) || !Number.isFinite(geo.lon)) return fail('反算失败，请检查坐标与带号')
  const verify = utmForward(geo.lat, geo.lon, z, ell.value)
  const hemisphere = south.value ? 'S' : 'N'
  const params = `带号 ${z}${hemisphere}，中央经线 ${verify.lon0}°，k0=0.9996，假东 500000 m${south.value ? '，假北 10000000 m' : ''}`
  result.value = rowsInverse({
    label,
    ellLabel,
    params,
    x,
    y,
    zoneNo: z,
    hemisphere,
    lon0v: verify.lon0,
    lat: geo.lat,
    lon: geo.lon,
    verify
  })
}

function calcWeb() {
  const label = KIND_LABELS.web
  const ellLabel = '球体 R = 6378137 m（EPSG:3857）'
  const params = '固定参数（球体半径 6378137 m），无自定义项'

  if (isForward.value) {
    const lat = numOf(latInput.value)
    const lon = numOf(lonInput.value)
    const err = checkLatLon(lat, lon)
    if (err) return fail(err)
    if (Math.abs(lat) > WEB_LAT_MAX) return fail('Web 墨卡托纬度范围为 ±85.051129°')
    const out = webMercatorForward(lat, lon)
    const verify = webMercatorInverse(out.x, out.y)
    result.value = rowsForward({ label, ellLabel, params, x: out.x, y: out.y, zoneNo: null, hemisphere: null, lon0v: 0, lat, lon, verify })
    return
  }

  const x = numOf(xInput.value)
  const y = numOf(yInput.value)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return fail('X/Y 必须是有效数字')
  if (Math.abs(x) > WEB_MAX || Math.abs(y) > WEB_MAX) return fail(`Web 墨卡托 X/Y 必须在 ±${WEB_MAX.toFixed(2)} m 以内`)
  const geo = webMercatorInverse(x, y)
  const verify = webMercatorForward(geo.lat, geo.lon)
  result.value = rowsInverse({ label, ellLabel, params, x, y, zoneNo: null, hemisphere: null, lon0v: 0, lat: geo.lat, lon: geo.lon, verify })
}

function calc() {
  result.value = null
  if (kind.value === 'tm') return calcTm()
  if (kind.value === 'utm') return calcUtm()
  return calcWeb()
}

function autoZone() {
  if (!isForward.value) {
    msgError('反算时请手动指定带号')
    return
  }
  const lat = numOf(latInput.value)
  const lon = numOf(lonInput.value)
  const err = checkLatLon(lat, lon)
  if (err) {
    msgError(err)
    return
  }
  let z = utmZoneOf(lon, lat)
  if (z < 1) z = 1
  if (z > 60) z = 60
  zone.value = String(z)
  south.value = lat < 0
  msgSuccess(`已按经度 ${lon}° 推算带号 ${z}${lat < 0 ? 'S' : 'N'}`)
}

function clearAll() {
  latInput.value = ''
  lonInput.value = ''
  xInput.value = ''
  yInput.value = ''
  result.value = null
}
</script>

<style scoped>
.field-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field .form-label {
  margin-right: 0;
}
.radio-row {
  display: flex;
  align-items: center;
  min-height: 40px;
}
.radio-inline {
  display: flex;
  align-items: center;
  min-height: 40px;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.data-table th,
.data-table td {
  border-bottom: 1px solid var(--border);
  padding: 9px 12px;
  text-align: left;
  vertical-align: top;
}
.data-table td.k {
  width: 180px;
  color: #64748b;
  white-space: nowrap;
}
.data-table td.v {
  font-family: Consolas, Menlo, monospace;
  word-break: break-all;
}
@media (max-width: 640px) {
  .field-grid {
    grid-template-columns: 1fr;
  }
  .data-table td.k {
    width: 120px;
  }
}
</style>
