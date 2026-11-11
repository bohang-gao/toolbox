<template>
  <ToolShell
    path="/coord/ntrip-sourcetable"
    title="NTRIP Source-Table"
    intro="解析或生成 NTRIP Caster 的 Source-Table：STR 挂载点、CAS Caster、NET 网络三类记录，覆盖格式、导航系统、经纬度、码率等字段。"
    :usage="[
      '在解析区粘贴 Source-Table 文本（STR/CAS/NET 行），点击「解析」查看挂载点、Caster 和网络表。',
      '在生成区按行录入挂载点，点「生成」输出符合 NTRIP 规范的 Source-Table 文本。',
      '生成时会自动补齐默认的格式详情、认证方式和码率，并做数字字段校验。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 解析 Source-Table</div>
      <div class="option-panel">
        <span class="form-label">粘贴以 STR / CAS / NET 开头的文本，每行一条记录</span>
        <textarea
          v-model="input"
          class="el-textarea__inner mt-2"
          style="min-height:150px;font-family:Consolas,Menlo,monospace"
          placeholder="STR;MOUNTPOINT;Identifier;RTCM 3.2;1005(10),1074(1);2;GPS+GLO;Net;CHN;39.90;116.40;0;0;toolbox;none;B;N;9600;"
        ></textarea>
        <div class="flex items-center mt-4" style="gap:10px;flex-wrap:wrap">
          <button type="button" class="el-button el-button--primary" @click="parse">解析</button>
          <button type="button" class="el-button" @click="fillSample">填入示例</button>
          <button type="button" class="el-button el-button--info" @click="clearParse">清空</button>
        </div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>2</b> 解析结果</div>
      <div class="option-panel">
        <div v-if="!parsed" class="tool-note">解析结果会显示在这里。</div>

        <template v-else>
          <div class="form-label">挂载点（{{ parsed.mountpoints.length }}）</div>
          <table v-if="parsed.mountpoints.length" class="data-table">
            <thead>
              <tr>
                <th>挂载点</th>
                <th>标识</th>
                <th>格式</th>
                <th>导航系统</th>
                <th>国家</th>
                <th>纬度</th>
                <th>经度</th>
                <th>需NMEA</th>
                <th>收费</th>
                <th>码率</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(m, i) in parsed.mountpoints" :key="i">
                <td>{{ m.mountpoint || '—' }}</td>
                <td>{{ m.identifier || '—' }}</td>
                <td>
                  {{ m.format || '—' }}
                  <div class="muted">{{ m.formatDetails }}</div>
                </td>
                <td>{{ m.navSystem || '—' }}</td>
                <td>{{ m.country || '—' }}</td>
                <td>{{ fmtNum(m.latitude, 4) }}</td>
                <td>{{ fmtNum(m.longitude, 4) }}</td>
                <td>{{ m.nmea ? '是' : '否' }}</td>
                <td>{{ m.fee ? '是' : '否' }}</td>
                <td>{{ Number.isFinite(m.bitrate) ? m.bitrate : '—' }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="tool-note">没有 STR 记录。</div>

          <div class="form-label mt-4">Caster（{{ parsed.casters.length }}）</div>
          <table v-if="parsed.casters.length" class="data-table">
            <thead>
              <tr>
                <th>主机</th>
                <th>端口</th>
                <th>标识</th>
                <th>运营者</th>
                <th>需NMEA</th>
                <th>国家</th>
                <th>纬度</th>
                <th>经度</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(c, i) in parsed.casters" :key="i">
                <td>{{ c.host || '—' }}</td>
                <td>{{ Number.isFinite(c.port) ? c.port : '—' }}</td>
                <td>{{ c.identifier || '—' }}</td>
                <td>{{ c.operator || '—' }}</td>
                <td>{{ c.nmea ? '是' : '否' }}</td>
                <td>{{ c.country || '—' }}</td>
                <td>{{ fmtNum(c.latitude, 4) }}</td>
                <td>{{ fmtNum(c.longitude, 4) }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="tool-note">没有 CAS 记录。</div>

          <div class="form-label mt-4">网络（{{ parsed.networks.length }}）</div>
          <table v-if="parsed.networks.length" class="data-table">
            <thead>
              <tr>
                <th>标识</th>
                <th>运营者</th>
                <th>认证</th>
                <th>收费</th>
                <th>网站</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(n, i) in parsed.networks" :key="i">
                <td>{{ n.identifier || '—' }}</td>
                <td>{{ n.operator || '—' }}</td>
                <td>{{ n.authentication || '—' }}</td>
                <td>{{ n.fee ? '是' : '否' }}</td>
                <td>{{ n.web || '—' }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="tool-note">没有 NET 记录。</div>
        </template>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>3</b> 生成 Source-Table</div>
      <div class="option-panel">
        <div v-for="(row, i) in rows" :key="i" class="row-card">
          <div class="flex justify-between items-center">
            <span class="form-label">挂载点行 {{ i + 1 }}</span>
            <button
              v-if="rows.length > 1"
              type="button"
              class="el-button"
              style="padding:5px 10px"
              @click="removeRow(i)"
            >删除</button>
          </div>
          <div class="field-grid mt-2">
            <label class="field">
              <span class="field-label">挂载点</span>
              <input v-model="row.mountpoint" class="el-input__inner" placeholder="如 RTCM32" />
            </label>
            <label class="field">
              <span class="field-label">标识</span>
              <input v-model="row.identifier" class="el-input__inner" placeholder="站点说明" />
            </label>
            <label class="field">
              <span class="field-label">格式</span>
              <input v-model="row.format" class="el-input__inner" />
            </label>
            <label class="field">
              <span class="field-label">格式详情</span>
              <input v-model="row.formatDetails" class="el-input__inner" />
            </label>
            <label class="field">
              <span class="field-label">载波</span>
              <input v-model="row.carrier" class="el-input__inner" />
            </label>
            <label class="field">
              <span class="field-label">导航系统</span>
              <input v-model="row.navSystem" class="el-input__inner" />
            </label>
            <label class="field">
              <span class="field-label">网络</span>
              <input v-model="row.network" class="el-input__inner" />
            </label>
            <label class="field">
              <span class="field-label">国家</span>
              <input v-model="row.country" class="el-input__inner" />
            </label>
            <label class="field">
              <span class="field-label">纬度</span>
              <input v-model="row.latitude" class="el-input__inner" placeholder="如 39.90" />
            </label>
            <label class="field">
              <span class="field-label">经度</span>
              <input v-model="row.longitude" class="el-input__inner" placeholder="如 116.40" />
            </label>
            <label class="field">
              <span class="field-label">解算类型</span>
              <input v-model="row.solution" class="el-input__inner" />
            </label>
            <label class="field">
              <span class="field-label">生成器</span>
              <input v-model="row.generator" class="el-input__inner" />
            </label>
            <label class="field">
              <span class="field-label">压缩</span>
              <input v-model="row.compression" class="el-input__inner" />
            </label>
            <label class="field">
              <span class="field-label">认证</span>
              <input v-model="row.authentication" class="el-input__inner" />
            </label>
            <label class="field">
              <span class="field-label">码率</span>
              <input v-model="row.bitrate" class="el-input__inner" />
            </label>
            <label class="field">
              <span class="field-label">备注</span>
              <input v-model="row.misc" class="el-input__inner" />
            </label>
            <div class="field field-checks">
              <label class="el-radio"><input v-model="row.nmea" type="checkbox" />需 NMEA</label>
              <label class="el-radio"><input v-model="row.fee" type="checkbox" />收费</label>
            </div>
          </div>
        </div>

        <div class="flex items-center mt-4" style="gap:10px;flex-wrap:wrap">
          <button type="button" class="el-button" @click="addRow">添加一行</button>
          <button type="button" class="el-button el-button--primary" @click="generate">生成</button>
          <button type="button" class="el-button el-button--info" @click="resetRows">恢复默认</button>
        </div>

        <div class="flex justify-between items-center mt-4">
          <span class="form-label">生成结果</span>
          <button
            type="button"
            class="el-button copy-btn"
            style="padding:6px 12px"
            @click="copyText(generated, 'Source-Table 已复制')"
          >复制</button>
        </div>
        <pre v-if="generated" class="result-box mt-2">{{ generated }}</pre>
        <div v-else class="tool-note">点击「生成」后在此显示 Source-Table 文本。</div>
      </div>
    </div>
  </ToolShell>
</template>

<script setup>
import { ref } from 'vue'
import ToolShell from '../../../components/ToolShell.vue'
import { msgError, msgSuccess } from '../../../lib/ui.js'
import { copyText } from '../textkit.js'
import { parseNtripSourcetable, buildNtripSourcetable } from '../coordkit.js'

const input = ref('')
const parsed = ref(null)
const generated = ref('')

function createRow() {
  return {
    mountpoint: '',
    identifier: '',
    format: 'RTCM 3.2',
    formatDetails: '1005(10),1074(1),1084(1),1094(1),1124(1)',
    carrier: '2',
    navSystem: 'GPS+GLO+GAL+BDS',
    network: '',
    country: 'CHN',
    latitude: '',
    longitude: '',
    nmea: true,
    solution: 0,
    generator: 'toolbox',
    compression: 'none',
    authentication: 'B',
    fee: false,
    bitrate: 9600,
    misc: ''
  }
}

const rows = ref([createRow()])

function addRow() {
  rows.value.push(createRow())
}

function removeRow(i) {
  if (rows.value.length <= 1) return
  rows.value.splice(i, 1)
}

function resetRows() {
  rows.value = [createRow()]
  generated.value = ''
}

function fmtNum(v, d) {
  if (v === '' || v === null || v === undefined) return '—'
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(d) : '—'
}

const SAMPLE = [
  'STR;CHN-Example;Example Mountpoint;RTCM 3.2;1005(10),1074(1),1084(1),1094(1),1124(1);2;GPS+GLO+GAL+BDS;ExampleNet;CHN;39.90;116.40;0;0;toolbox;none;B;N;9600;',
  'CAS;caster.example.com;2101;ExampleCaster;Example Operator;1;CHN;39.90;116.40',
  'NET;ExampleNet;Example Operator;B;N;https://example.com'
].join('\n')

function fillSample() {
  input.value = SAMPLE
  parse()
}

function parse() {
  if (!input.value.trim()) {
    parsed.value = null
    msgError('请粘贴 Source-Table 文本')
    return
  }
  try {
    const res = parseNtripSourcetable(input.value)
    if (!res.mountpoints.length && !res.casters.length && !res.networks.length) {
      parsed.value = null
      msgError('未识别到 STR / CAS / NET 行')
      return
    }
    parsed.value = res
    msgSuccess(`解析到 ${res.mountpoints.length} 个挂载点`)
  } catch (e) {
    parsed.value = null
    msgError(`解析失败：${e.message || '格式有误'}`)
  }
}

function clearParse() {
  input.value = ''
  parsed.value = null
}

const NUMERIC_FIELDS = [
  ['latitude', '纬度'],
  ['longitude', '经度'],
  ['solution', '解算类型'],
  ['bitrate', '码率']
]

function generate() {
  const list = rows.value
  if (!list.length) {
    msgError('至少需要一行挂载点')
    return
  }
  if (list.some(r => !String(r.mountpoint || '').trim())) {
    generated.value = ''
    msgError('挂载点名称不能为空')
    return
  }
  for (const r of list) {
    for (const [key, label] of NUMERIC_FIELDS) {
      const v = r[key]
      if (v !== '' && v !== null && v !== undefined && !Number.isFinite(Number(v))) {
        generated.value = ''
        msgError(`「${label}」必须是数字`)
        return
      }
    }
  }
  try {
    generated.value = buildNtripSourcetable(list.map(r => ({ ...r })))
    msgSuccess('Source-Table 已生成')
  } catch (e) {
    generated.value = ''
    msgError(`生成失败：${e.message || '字段有误'}`)
  }
}
</script>

<style scoped>
.data-table{width:100%;border-collapse:collapse;font-size:13px}
.data-table th,.data-table td{border:1px solid var(--border);padding:7px 10px;text-align:left;vertical-align:top}
.data-table th{background:#eef2f7;color:var(--text-2);font-weight:600;white-space:nowrap}
.muted{color:var(--text-3);font-size:12px}
.row-card{border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;margin-bottom:12px;background:var(--surface)}
.row-card:last-child{margin-bottom:0}
.field-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px 14px}
.field{display:flex;flex-direction:column;gap:4px;min-width:0}
.field-label{font-size:12px;color:var(--text-2)}
.field .el-input__inner{height:36px;line-height:36px}
.field-checks{flex-direction:row;align-items:center;gap:8px;flex-wrap:wrap}
.field-checks .el-radio{margin-right:0}
</style>
