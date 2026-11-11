<template>
  <ToolShell
    path="/coord/geohash"
    title="Geohash编码解码"
    intro="Geohash 把经纬度按 5 位一组交替二分，编码成只含 0-9 与 b-z（去掉 a i l o）的短字符串。前缀相同表示空间相邻，位数越多精度越高。"
    :usage="[
      '编码：输入十进制经纬度并选择 1~12 位精度，得到 Geohash 字符串与每一级前缀。',
      '解码：输入 Geohash，得到单元格中心经纬度、误差半径与边界框。',
      '覆盖尺寸按中心纬度用球面距离估算，高纬度地区经度方向的实际长度会随纬度变化。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 编码（经纬度 → Geohash）</div>
      <div class="option-panel">
        <div class="field-grid">
          <label class="field">
            <span class="form-label">纬度（°）</span>
            <input v-model="latInput" class="el-input__inner" type="text" inputmode="decimal" spellcheck="false" placeholder="39.9042" />
          </label>
          <label class="field">
            <span class="form-label">经度（°）</span>
            <input v-model="lonInput" class="el-input__inner" type="text" inputmode="decimal" spellcheck="false" placeholder="116.4074" />
          </label>
          <label class="field">
            <span class="form-label">精度（位数）</span>
            <select v-model.number="precision" class="el-input__inner">
              <option v-for="n in 12" :key="n" :value="n">{{ n }} 位</option>
            </select>
          </label>
        </div>

        <div class="flex mt-4">
          <button type="button" class="el-button el-button--primary" @click="encode">编码</button>
        </div>

        <div v-if="encodeResult" class="mt-4">
          <table class="data-table">
            <tbody>
              <tr>
                <td class="k">纬度</td>
                <td class="v">{{ fmtDeg(encodeResult.lat) }}°</td>
              </tr>
              <tr>
                <td class="k">经度</td>
                <td class="v">{{ fmtDeg(encodeResult.lon) }}°</td>
              </tr>
              <tr>
                <td class="k">Geohash（{{ encodeResult.precision }} 位）</td>
                <td class="v strong">{{ encodeResult.hash }}</td>
              </tr>
            </tbody>
          </table>

          <div class="table-label">各级前缀</div>
          <table class="data-table">
            <thead>
              <tr>
                <th>位数</th>
                <th>Geohash</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in encodeResult.prefixes" :key="p.len">
                <td>{{ p.len }}</td>
                <td class="v">{{ p.hash }}</td>
              </tr>
            </tbody>
          </table>

          <div class="flex mt-4">
            <button type="button" class="el-button el-button--info" @click="copyText(encodeResult.text, '编码结果已复制')">复制结果</button>
          </div>
        </div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>2</b> 解码（Geohash → 经纬度）</div>
      <div class="option-panel">
        <label class="field">
          <span class="form-label">Geohash 字符串（1~12 位）</span>
          <input
            v-model="hashInput"
            class="el-input__inner"
            type="text"
            spellcheck="false"
            placeholder="wx4g0b"
            @keyup.enter="decode"
          />
        </label>

        <div class="flex mt-4">
          <button type="button" class="el-button el-button--primary" @click="decode">解码</button>
        </div>

        <div v-if="decodeResult" class="mt-4">
          <table class="data-table">
            <tbody>
              <tr v-for="([k, v]) in decodeResult.rows" :key="k">
                <td class="k">{{ k }}</td>
                <td class="v">{{ v }}</td>
              </tr>
            </tbody>
          </table>
          <div class="result-box mt-4">{{ decodeResult.text }}</div>
          <div class="flex mt-4">
            <button type="button" class="el-button el-button--info" @click="copyText(decodeResult.text, '解码结果已复制')">复制结果</button>
          </div>
        </div>
      </div>
    </div>

    <div class="step-actions">
      <button type="button" class="el-button el-button--info" @click="clearAll">清空</button>
    </div>
  </ToolShell>
</template>

<script setup>
import { ref } from 'vue'
import ToolShell from '../../../components/ToolShell.vue'
import { msgError } from '../../../lib/ui.js'
import { copyText } from '../textkit.js'
import { geohashEncode, geohashDecode, haversine } from '../coordkit.js'

const latInput = ref('39.9042')
const lonInput = ref('116.4074')
const precision = ref(12)
const hashInput = ref('wx4g0b')
const encodeResult = ref(null)
const decodeResult = ref(null)

const fmtDeg = (v) => (Number.isFinite(v) ? Number(v).toFixed(8) : '—')

function fmtSpanDeg(v) {
  if (!Number.isFinite(v)) return '—'
  if (v === 0) return '0'
  return Number(v.toPrecision(6)).toString()
}

function fmtLen(v) {
  if (!Number.isFinite(v)) return '—'
  const a = Math.abs(v)
  if (a === 0) return '0'
  if (a >= 1000) return Number(v.toFixed(1)).toString()
  if (a >= 1) return Number(v.toFixed(3)).toString()
  if (a >= 0.01) return Number(v.toFixed(4)).toString()
  return Number(v.toFixed(6)).toString()
}

function numOf(v) {
  const t = String(v == null ? '' : v).trim()
  if (t === '') return NaN
  const n = Number(t)
  return Number.isFinite(n) ? n : NaN
}

function fail(message) {
  msgError(message)
}

function encode() {
  encodeResult.value = null
  const lat = numOf(latInput.value)
  const lon = numOf(lonInput.value)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    fail('纬度与经度必须是有效数字')
    return
  }
  if (lat < -90 || lat > 90) {
    fail('纬度必须在 -90° ~ 90° 之间')
    return
  }
  if (lon < -180 || lon > 180) {
    fail('经度必须在 -180° ~ 180° 之间')
    return
  }
  const p = Number(precision.value)
  if (!Number.isInteger(p) || p < 1 || p > 12) {
    fail('精度必须是 1 ~ 12 位')
    return
  }

  const hash = geohashEncode(lat, lon, p)
  const prefixes = []
  for (let i = 1; i <= p; i++) prefixes.push({ len: i, hash: hash.slice(0, i) })
  const text = [
    `纬度：${fmtDeg(lat)}°`,
    `经度：${fmtDeg(lon)}°`,
    `精度：${p} 位`,
    `Geohash：${hash}`,
    '各级前缀：',
    ...prefixes.map((item) => `${item.len} 位 ${item.hash}`)
  ].join('\n')

  encodeResult.value = { lat, lon, precision: p, hash, prefixes, text }
}

function decode() {
  decodeResult.value = null
  const raw = String(hashInput.value == null ? '' : hashInput.value).trim().toLowerCase()
  if (!raw) {
    fail('请输入 Geohash 字符串')
    return
  }
  if (raw.length > 12) {
    fail('Geohash 长度通常不超过 12 位')
    return
  }
  if (!/^[0-9b-hjkmnp-z]+$/.test(raw)) {
    fail('Geohash 只能包含 0-9 与 b-z（不含 a、i、l、o）')
    return
  }

  let d
  try {
    d = geohashDecode(raw)
  } catch (e) {
    fail(`解码失败：${e.message || '非法 Geohash'}`)
    return
  }

  const b = d.bounds
  const latSpanM = haversine(b.latMin, d.lon, b.latMax, d.lon)
  const lonSpanM = haversine(d.lat, b.lonMin, d.lat, b.lonMax)

  const rows = [
    ['Geohash', raw],
    ['中心纬度', `${fmtDeg(d.lat)}°`],
    ['中心经度', `${fmtDeg(d.lon)}°`],
    ['纬度误差 latErr', `${fmtSpanDeg(d.latErr)}°`],
    ['经度误差 lonErr', `${fmtSpanDeg(d.lonErr)}°`],
    ['纬度范围', `${fmtDeg(b.latMin)}° ~ ${fmtDeg(b.latMax)}°`],
    ['经度范围', `${fmtDeg(b.lonMin)}° ~ ${fmtDeg(b.lonMax)}°`],
    ['纬度覆盖 latErr×2', `${fmtSpanDeg(d.latErr * 2)}° ≈ ${fmtLen(latSpanM)} m`],
    ['经度覆盖 lonErr×2', `${fmtSpanDeg(d.lonErr * 2)}° ≈ ${fmtLen(lonSpanM)} m`]
  ]

  decodeResult.value = {
    rows,
    text: rows.map(([k, v]) => `${k}：${v}`).join('\n')
  }
}

function clearAll() {
  latInput.value = ''
  lonInput.value = ''
  hashInput.value = ''
  encodeResult.value = null
  decodeResult.value = null
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
.table-label {
  margin-top: 16px;
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  margin-top: 8px;
}
.data-table th,
.data-table td {
  border-bottom: 1px solid var(--border);
  padding: 8px 12px;
  text-align: left;
  vertical-align: top;
}
.data-table th {
  background: #f8fafc;
  color: #64748b;
  font-weight: 600;
}
.data-table td.k {
  width: 190px;
  color: #64748b;
  white-space: nowrap;
}
.data-table td.v {
  font-family: Consolas, Menlo, monospace;
  word-break: break-all;
}
.data-table td.v.strong {
  font-size: 15px;
  font-weight: 600;
  color: var(--primary);
}
@media (max-width: 640px) {
  .field-grid {
    grid-template-columns: 1fr;
  }
  .data-table td.k {
    width: 130px;
  }
}
</style>
