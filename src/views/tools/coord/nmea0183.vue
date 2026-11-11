<template>
  <ToolShell
    path="/coord/nmea0183"
    title="NMEA-0183协议解析"
    intro="逐条解析接收机输出的 NMEA-0183 语句，用 *hh 异或校验和验证完整性，并把 GGA、RMC、GSA、GSV、VTG、GLL、ZDA 展开为结构化字段。"
    :usage="[
      '粘贴一行或多行以 $ 开头的 NMEA 语句。',
      '点击「解析」，每条语句显示类型徽标、校验和状态和字段表。',
      '校验和是 $ 与 * 之间所有字符的逐字节异或；未带 * 校验的语句按通过显示。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 输入 NMEA 语句</div>
      <div class="option-panel">
        <div class="flex justify-between items-center">
          <span class="form-label">支持多行，每行一条语句</span>
          <span style="font-size:12px;color:#909399">{{ lineCount }} 行</span>
        </div>
        <textarea
          v-model="input"
          class="el-textarea__inner mt-2"
          style="min-height:160px;font-family:Consolas,Menlo,monospace"
          placeholder="$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47&#10;$GPRMC,..."
        ></textarea>
        <div class="flex items-center mt-4" style="gap:10px;flex-wrap:wrap">
          <button type="button" class="el-button el-button--primary" @click="parse">解析</button>
          <button type="button" class="el-button" @click="fillSample">填入示例</button>
          <button type="button" class="el-button el-button--info" @click="clearAll">清空</button>
        </div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>2</b> 解析结果</div>
      <div class="option-panel">
        <div v-if="!results.length" class="tool-note">解析结果会显示在这里。</div>

        <div v-for="(rec, i) in results" :key="i" class="nmea-block">
          <div class="nmea-head">
            <span class="badge">{{ rec.type || 'RAW' }}</span>
            <span class="nmea-meta">{{ rec.talker || '—' }} · {{ rec.sentence || '—' }}</span>
            <span v-if="rec.error" class="chk-bad">{{ rec.error }}</span>
            <template v-else>
              <span v-if="!rec.checksum" class="chk-none">未提供校验和（按通过处理）</span>
              <span v-else-if="rec.ok" class="chk-ok">校验和 OK（{{ rec.checksum }}）</span>
              <span v-else class="chk-bad">校验和不匹配：报文 {{ rec.checksum }} / 计算 {{ rec.checksumCalc }}</span>
            </template>
          </div>

          <table v-if="rec.parsed" class="data-table">
            <tbody>
              <tr v-for="([key, val]) in parsedRows(rec)" :key="key">
                <td class="k">{{ labelOf(key) }}</td>
                <td class="v">{{ formatValue(key, val) }}</td>
              </tr>
            </tbody>
          </table>

          <table v-else-if="rec.fields" class="data-table">
            <tbody>
              <tr v-for="(f, idx) in rec.fields" :key="idx">
                <td class="k">字段 {{ idx + 1 }}</td>
                <td class="v">{{ f || '—' }}</td>
              </tr>
            </tbody>
          </table>

          <div class="nmea-raw">{{ rec.raw }}</div>
        </div>
      </div>
    </div>
  </ToolShell>
</template>

<script setup>
import { ref, computed } from 'vue'
import ToolShell from '../../../components/ToolShell.vue'
import { msgError, msgSuccess } from '../../../lib/ui.js'
import { parseNmea, nmeaChecksum } from '../coordkit.js'

const input = ref('')
const results = ref([])

const lineCount = computed(() => input.value.split(/\r?\n/).filter(s => s.trim()).length)

const LABELS = {
  utc: 'UTC 时间',
  lat: '纬度(°)',
  lon: '经度(°)',
  fixQuality: '定位质量码',
  fixQualityText: '定位质量说明',
  satellites: '卫星数',
  hdop: 'HDOP',
  altitude: '海拔',
  altitudeUnit: '海拔单位',
  geoidSep: '大地水准面差距',
  geoidUnit: '差距单位',
  diffAge: '差分龄期',
  diffStation: '差分站',
  status: '状态',
  speedKnots: '速度(节)',
  speedKmh: '速度(km/h)',
  course: '航向(°)',
  date: '日期',
  magVar: '磁偏角',
  magVarDir: '磁偏方向',
  mode: '模式',
  fixType: '定位类型码',
  fixTypeText: '定位类型',
  sats: '卫星列表',
  pdop: 'PDOP',
  vdop: 'VDOP',
  totalMsg: '消息总数',
  msgNum: '消息序号',
  satsInView: '可见卫星数',
  courseTrue: '真航向(°)',
  courseMag: '磁航向(°)',
  day: '日',
  month: '月',
  year: '年',
  localZoneH: '本地时区(时)',
  localZoneM: '本地时区(分)'
}

function labelOf(key) {
  return LABELS[key] || key
}

function parsedRows(rec) {
  return rec && rec.parsed ? Object.entries(rec.parsed) : []
}

function formatValue(key, v) {
  if (v === undefined || v === null || v === '') return '—'
  if (key === 'lat' || key === 'lon') {
    const n = Number(v)
    return Number.isFinite(n) ? n.toFixed(8) : '—'
  }
  if (key === 'sats') {
    if (!Array.isArray(v)) return String(v)
    if (v.length && typeof v[0] === 'object') {
      return v
        .map(s => `PRN${s.prn} 仰角${s.elevation}° 方位${s.azimuth}°${s.snr != null ? ` SNR${s.snr}` : ''}`)
        .join('；')
    }
    return v.length ? v.join(', ') : '—'
  }
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return '—'
    return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(6)))
  }
  return String(v)
}

const SAMPLE_BODIES = [
  'GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,',
  'GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W',
  'GPGSA,A,3,04,05,,09,12,,,24,,,,,2.5,1.3,2.1',
  'GPGSV,2,1,08,01,40,083,46,02,17,308,41,12,07,344,39,14,22,228,45'
]

function fillSample() {
  input.value = SAMPLE_BODIES.map(b => `$${b}*${nmeaChecksum(b)}`).join('\n')
  parse()
}

function parse() {
  if (!input.value.trim()) {
    results.value = []
    msgError('请输入 NMEA 语句')
    return
  }
  try {
    const list = parseNmea(input.value)
    if (!list.length) {
      results.value = []
      msgError('没有可解析的语句')
      return
    }
    results.value = list
    msgSuccess(`已解析 ${list.length} 条语句`)
  } catch (e) {
    results.value = []
    msgError(`解析失败：${e.message || '输入格式有误'}`)
  }
}

function clearAll() {
  input.value = ''
  results.value = []
}
</script>

<style scoped>
.data-table{width:100%;border-collapse:collapse;font-size:13px;margin-top:10px}
.data-table th,.data-table td{border:1px solid var(--border);padding:7px 10px;text-align:left;vertical-align:top}
.data-table th{background:#eef2f7;color:var(--text-2);font-weight:600;white-space:nowrap}
.data-table td.k{width:190px;color:var(--text-2);white-space:nowrap}
.data-table td.v{font-family:Consolas,Menlo,monospace;word-break:break-all}
.nmea-block{border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;margin-bottom:12px;background:var(--surface)}
.nmea-block:last-child{margin-bottom:0}
.nmea-head{display:flex;align-items:center;flex-wrap:wrap;gap:10px}
.badge{display:inline-block;padding:2px 10px;border-radius:999px;background:var(--primary-weak);color:var(--primary);font-size:12px;font-weight:600}
.nmea-meta{font-size:12px;color:var(--text-3)}
.chk-ok{font-size:12px;color:#16a34a;font-weight:500}
.chk-bad{font-size:12px;color:#dc2626;font-weight:500}
.chk-none{font-size:12px;color:var(--text-3)}
.nmea-raw{margin-top:8px;font-family:Consolas,Menlo,monospace;font-size:12px;color:var(--text-3);word-break:break-all}
</style>
