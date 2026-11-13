<template>
  <ToolShell
    path="/rf/rate"
    title="速率计算"
    desc="按 3GPP TS 38.214 的 TBS 流程估算 1 秒吞吐量"
    intro="输入方向、符号数、MCS、PRB、DM-RS 配置与双工方式，按 TS 38.214 的 TBS 确定流程（含表 5.1.3.2-1 量化）算出每 slot 的传输块大小，再乘每秒可调度次数，得到 1 秒的速率。参数改动即时重算。"
    :usage="[
      '先选下行（PDSCH）/ 上行（PUSCH）与双工方式；TDD 需选上下行 slot 配比，可勾选特殊 slot 是否计入下行。',
      '每 slot 符号数、PRB 数、MCS 表与索引、层数按实际调度填写；DM-RS 填类型、前置/附加符号数与无数据的 CDM 组数。',
      '「每秒调度次数」默认按双工与配比自动算（FDD 全时隙可用；TDD 按 D:U 占比），也可勾选手动指定。',
      '速率 = TBS × 每秒调度次数。TBS 按规范量化，会略低于「RE × Qm × 码率」的理论值，页面同时给出两者对比。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 传输方向与帧结构</div>
      <div class="option-panel">
        <div class="coord-grid">
          <label>
            <span class="form-label">传输方向</span>
            <select v-model="cfg.direction" class="el-input__inner mt-2">
              <option value="DL">下行（PDSCH）</option>
              <option value="UL">上行（PUSCH）</option>
            </select>
          </label>
          <label>
            <span class="form-label">双工方式</span>
            <select v-model="cfg.duplex" class="el-input__inner mt-2">
              <option value="FDD">FDD（全时隙可用）</option>
              <option value="TDD">TDD（按时隙配比）</option>
            </select>
          </label>
          <label>
            <span class="form-label">子载波间隔 SCS</span>
            <select v-model.number="cfg.scs" class="el-input__inner mt-2">
              <option v-for="s in SCS_LIST" :key="s" :value="s">{{ s }} kHz（μ = {{ muOf(s) }}）</option>
            </select>
          </label>
          <label v-if="cfg.duplex === 'TDD'">
            <span class="form-label">TDD 上下行配比</span>
            <select v-model="cfg.patternKey" class="el-input__inner mt-2">
              <option v-for="p in TDD_PATTERNS" :key="p.key" :value="p.key">{{ p.label }}</option>
            </select>
          </label>
        </div>

        <label v-if="cfg.duplex === 'TDD'" class="check-row mt-2">
          <input v-model="cfg.specialCountsAsDl" type="checkbox" />
          <span>特殊 slot（S）计入下行</span>
        </label>

        <div class="tool-note">
          <template v-if="cfg.duplex === 'FDD'">FDD：每秒 {{ groupNumber(slotsPerSecond(cfg.scs)) }} 个 slot 全部可用于{{ cfg.direction === 'DL' ? '下行' : '上行' }}。</template>
          <template v-else>{{ tddDetail }}</template>
        </div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>2</b> 时频资源与 MCS</div>
      <div class="option-panel">
        <div class="coord-grid">
          <label>
            <span class="form-label">每 slot 分配符号数 N_sh_symb</span>
            <input v-model.number="cfg.nSymb" class="el-input__inner mt-2" type="number" min="1" max="14" step="1" />
          </label>
          <label>
            <span class="form-label">PRB 数 n_PRB</span>
            <input v-model.number="cfg.nRb" class="el-input__inner mt-2" type="number" min="1" step="1" />
          </label>
          <label>
            <span class="form-label">MCS 表</span>
            <select v-model.number="cfg.mcsTable" class="el-input__inner mt-2" @change="onTableChange">
              <option v-for="t in MCS_OPTIONS" :key="t.key" :value="t.key">{{ t.label }}</option>
            </select>
          </label>
          <label>
            <span class="form-label">MCS 索引 I_MCS</span>
            <select v-model.number="cfg.mcsIndex" class="el-input__inner mt-2">
              <option v-for="m in mcsOptions" :key="m.index" :value="m.index">{{ m.label }}</option>
            </select>
          </label>
          <label>
            <span class="form-label">层数 v</span>
            <input v-model.number="cfg.layers" class="el-input__inner mt-2" type="number" min="1" max="8" step="1" />
          </label>
          <label>
            <span class="form-label">xOverhead N_oh（PRB）</span>
            <select v-model.number="cfg.xOverhead" class="el-input__inner mt-2">
              <option :value="0">0</option>
              <option :value="6">6</option>
              <option :value="12">12</option>
              <option :value="18">18</option>
            </select>
          </label>
        </div>

        <div class="form-label mt-4">DM-RS 配置</div>
        <div class="coord-grid mt-2">
          <label>
            <span class="form-label">DM-RS 类型</span>
            <select v-model.number="cfg.dmrsType" class="el-input__inner mt-2">
              <option :value="1">Type 1（6 RE/RB/符号/CDM 组）</option>
              <option :value="2">Type 2（4 RE/RB/符号/CDM 组）</option>
            </select>
          </label>
          <label>
            <span class="form-label">前置 DM-RS 符号数</span>
            <select v-model.number="cfg.dmrsFrontSymbols" class="el-input__inner mt-2">
              <option :value="1">单符号</option>
              <option :value="2">双符号</option>
            </select>
          </label>
          <label>
            <span class="form-label">附加 DM-RS 符号数</span>
            <select v-model.number="cfg.dmrsExtraSymbols" class="el-input__inner mt-2">
              <option v-for="n in [0, 1, 2, 3]" :key="n" :value="n">{{ n }}</option>
            </select>
          </label>
          <label>
            <span class="form-label">无数据的 CDM 组数</span>
            <select v-model.number="cfg.cdmGroups" class="el-input__inner mt-2">
              <option v-for="n in [1, 2, 3]" :key="n" :value="n">{{ n }}</option>
            </select>
          </label>
        </div>

        <div class="tool-note">
          当前 DM-RS 占用 N_DMRS_PRB = {{ dmrsPreview }} RE/PRB；
          N'_RE = 12 × {{ cfg.nSymb }} − {{ dmrsPreview }} − {{ cfg.xOverhead }} = {{ nRePrbPreview }} RE/PRB。
        </div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>3</b> 每秒调度次数</div>
      <div class="option-panel">
        <div class="flex flex-wrap" style="gap:10px;align-items:center">
          <label class="check-row">
            <input v-model="cfg.manualSchedule" type="checkbox" />
            <span>手动指定调度次数</span>
          </label>
          <input
            v-if="cfg.manualSchedule"
            v-model.number="cfg.scheduleInput"
            class="el-input__inner schedule-input"
            type="number"
            min="0"
            step="1"
            placeholder="每秒调度次数"
          />
        </div>
        <div class="tool-note">
          <template v-if="cfg.manualSchedule">手动指定：{{ groupNumber(cfg.scheduleInput || 0) }} 次/秒。</template>
          <template v-else>{{ schedulingDetail }}</template>
        </div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>4</b> 速率结果（1 秒）</div>
      <div class="option-panel">
        <template v-if="result && !result.error">
          <div class="rate-hero">
            <div class="rate-value">{{ formatRate(result.bitsPerSecond) }}</div>
            <div class="rate-sub">
              = {{ formatByteRate(result.bytesPerSecond) }}　｜　
              {{ groupNumber(result.tbs) }} bit/slot × {{ groupNumber(result.schedulingPerSecond, 1) }} slot/s
            </div>
            <div class="rate-compare">
              理论值（未做 TBS 量化）：{{ formatRate(result.theoreticalBitsPerSecond) }}
              <span class="dim">（{{ ((result.bitsPerSecond / result.theoreticalBitsPerSecond) * 100).toFixed(1) }}%）</span>
            </div>
          </div>

          <table class="data-table mt-4">
            <tbody>
              <tr v-for="([k, v]) in rows" :key="k">
                <td class="k">{{ k }}</td>
                <td class="v">{{ v }}</td>
              </tr>
            </tbody>
          </table>

          <div class="flex mt-4">
            <button type="button" class="el-button el-button--info" @click="copyText(resultText, '计算结果已复制')">复制结果</button>
          </div>
        </template>
        <div v-else-if="result && result.error" class="result-box" style="color:#e54d42">{{ result.error }}</div>
        <div v-else class="tool-note">填写上方参数后，速率会实时显示在这里。</div>
      </div>
    </div>

    <div class="step-actions">
      <button type="button" class="el-button" @click="applyPreset('fr1_100')">示例：n78 100 MHz / 30 kHz / MCS 27</button>
      <button type="button" class="el-button" @click="applyPreset('fr2_400')">示例：FR2 400 MHz / 120 kHz / MCS 27</button>
      <button type="button" class="el-button" @click="applyPreset('tdd')">示例：TDD 2.5 ms DDDSU 下行</button>
      <button type="button" class="el-button el-button--info" @click="resetAll">恢复默认</button>
    </div>
  </ToolShell>
</template>

<script setup>
import { computed, reactive } from 'vue'
import ToolShell from '../../../components/ToolShell.vue'
import { copyText } from '../textkit.js'
import {
  MCS_TABLES,
  SCS_LIST,
  TDD_PATTERNS,
  calcThroughput,
  dmrsRePerPrb,
  formatByteRate,
  formatRate,
  groupNumber,
  muOf,
  nRePerPrb,
  slotsPerSecond
} from '../ratekit.js'

const MCS_OPTIONS = Object.values(MCS_TABLES).map((t) => ({ key: t.key, label: t.label }))

const DEFAULTS = {
  direction: 'DL',
  duplex: 'FDD',
  scs: 30,
  patternKey: 'dddSU',
  specialCountsAsDl: false,
  nSymb: 13,
  nRb: 273,
  mcsTable: 1,
  mcsIndex: 27,
  layers: 1,
  xOverhead: 0,
  dmrsType: 1,
  dmrsFrontSymbols: 2,
  dmrsExtraSymbols: 0,
  cdmGroups: 1,
  manualSchedule: false,
  scheduleInput: 2000
}

const cfg = reactive({ ...DEFAULTS })

const mcsOptions = computed(() => {
  const t = MCS_TABLES[cfg.mcsTable]
  return t.rows.map(([qm, rateX1024], index) => ({
    index,
    label: `${index} → Qm ${qm}，R ${rateX1024}/1024`
  }))
})

function onTableChange() {
  const t = MCS_TABLES[cfg.mcsTable]
  if (cfg.mcsIndex > t.maxIndex) cfg.mcsIndex = t.maxIndex
}

const patternObj = computed(() => TDD_PATTERNS.find((p) => p.key === cfg.patternKey) || TDD_PATTERNS[0])

const dmrsPreview = computed(() => {
  const v = dmrsRePerPrb({
    dmrsType: cfg.dmrsType,
    frontSymbols: cfg.dmrsFrontSymbols,
    extraSymbols: cfg.dmrsExtraSymbols,
    cdmGroups: cfg.cdmGroups
  })
  return v === null ? '—' : v
})

const nRePrbPreview = computed(() =>
  nRePerPrb({ nSymb: cfg.nSymb, dmrsRe: dmrsPreview.value === '—' ? 0 : dmrsPreview.value, xOverhead: cfg.xOverhead })
)

const result = computed(() =>
  calcThroughput({
    direction: cfg.direction,
    duplex: cfg.duplex,
    scs: cfg.scs,
    nSymb: cfg.nSymb,
    nRb: cfg.nRb,
    mcsTable: cfg.mcsTable,
    mcsIndex: cfg.mcsIndex,
    dmrsType: cfg.dmrsType,
    dmrsFrontSymbols: cfg.dmrsFrontSymbols,
    dmrsExtraSymbols: cfg.dmrsExtraSymbols,
    cdmGroups: cfg.cdmGroups,
    xOverhead: cfg.xOverhead,
    layers: cfg.layers,
    schedulingOverride: cfg.manualSchedule ? Number(cfg.scheduleInput) : null,
    pattern: patternObj.value,
    specialCountsAsDl: cfg.specialCountsAsDl
  })
)

const tddDetail = computed(() => {
  const p = patternObj.value
  const dl = p.dl + (cfg.specialCountsAsDl ? p.special : 0)
  const total = dl + p.ul
  return `TDD：${dl}D : ${p.ul}U（特殊 slot ${p.special} 个${cfg.specialCountsAsDl ? '计入下行' : '不计入'}），可用占比 ${((dl / total) * 100).toFixed(2)}%`
})

const schedulingDetail = computed(() => {
  const r = result.value
  if (!r || r.error) return '参数不足，无法自动计算调度次数'
  return `${r.schedulingDetail}`
})

const rows = computed(() => {
  const r = result.value
  if (!r || r.error) return []
  return [
    ['传输方向 / 双工', `${r.mcs ? (cfg.direction === 'DL' ? '下行 PDSCH' : '上行 PUSCH') : ''} / ${cfg.duplex}`],
    ['调制阶数 Qm', String(r.mcs.qm)],
    ['目标码率 R', `${r.mcs.rateX1024}/1024 = ${r.mcs.rate.toFixed(6)}`],
    ['频谱效率 Qm×R', r.mcs.spectralEfficiency.toFixed(4)],
    ['N_DMRS_PRB', `${r.dmrsRe} RE/PRB`],
    ['N′_RE（未限幅）', `${r.nRePrbRaw} RE/PRB`],
    ['N_RE（限幅 156 后）', `${r.nRePrb} RE/PRB × ${groupNumber(r.nRb)} PRB = ${groupNumber(r.nRe)} RE`],
    ['N_info = N_RE×R×Qm×v', groupNumber(r.nInfo, 1)],
    ['TBS（量化后）', `${groupNumber(r.tbs)} bit　（${r.tbsBranch}）`],
    ['每 slot 字节数', `${groupNumber(r.tbs / 8, 1)} Byte`],
    ['layer / μ / slot 长度', `${r.layers} / ${r.mu} / ${r.slotMs} ms`],
    ['每秒 slot 数', groupNumber(r.slotsPerSecond)],
    ['每秒调度次数', `${groupNumber(r.schedulingPerSecond, 1)}${r.schedulingManual ? '（手动）' : r.dutyRatio != null ? `（占比 ${(r.dutyRatio * 100).toFixed(2)}%）` : ''}`],
    ['占用带宽（PRB×12×SCS）', `${r.occupiedBwMHz.toFixed(3)} MHz`],
    ['实际频谱效率', `${r.spectralEfficiency.toFixed(4)} bit/s/Hz`],
    ['1 秒吞吐', `${formatRate(r.bitsPerSecond)}（${formatByteRate(r.bytesPerSecond)}）`]
  ]
})

const resultText = computed(() => {
  const r = result.value
  if (!r || r.error) return ''
  return [
    `速率计算结果（${cfg.direction === 'DL' ? '下行' : '上行'} / ${cfg.duplex}）`,
    ...rows.value.map(([k, v]) => `${k}：${v}`)
  ].join('\n')
})

function applyPreset(key) {
  if (key === 'fr1_100') {
    Object.assign(cfg, { ...DEFAULTS, scs: 30, nRb: 273, nSymb: 13, mcsTable: 1, mcsIndex: 27, duplex: 'FDD', direction: 'DL' })
  } else if (key === 'fr2_400') {
    Object.assign(cfg, { ...DEFAULTS, scs: 120, nRb: 264, nSymb: 13, mcsTable: 1, mcsIndex: 27, duplex: 'FDD', direction: 'DL' })
  } else {
    Object.assign(cfg, {
      ...DEFAULTS,
      duplex: 'TDD',
      direction: 'DL',
      patternKey: 'dddSU',
      scs: 30,
      nRb: 273,
      nSymb: 13,
      mcsTable: 1,
      mcsIndex: 27
    })
  }
}

function resetAll() {
  Object.assign(cfg, { ...DEFAULTS })
}
</script>

<style scoped>
.coord-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}
.check-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-2, #475569);
  cursor: pointer;
}
.schedule-input {
  width: 180px;
}
.rate-hero {
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 12px;
  padding: 18px 20px;
  background: linear-gradient(135deg, #f8fafc 0%, #eef6ff 100%);
}
.rate-value {
  font-size: 32px;
  font-weight: 700;
  color: #0081ff;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
.rate-sub {
  margin-top: 6px;
  font-size: 13px;
  color: #475569;
  font-variant-numeric: tabular-nums;
}
.rate-compare {
  margin-top: 10px;
  font-size: 12px;
  color: #64748b;
  font-variant-numeric: tabular-nums;
}
.rate-compare .dim {
  color: #94a3b8;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.data-table td {
  border-bottom: 1px solid var(--border);
  padding: 9px 12px;
  text-align: left;
  vertical-align: top;
}
.data-table td.k {
  width: 190px;
  color: #64748b;
  white-space: nowrap;
}
.data-table td.v {
  font-variant-numeric: tabular-nums;
  word-break: break-word;
}
@media (max-width: 640px) {
  .coord-grid {
    grid-template-columns: 1fr;
  }
  .data-table td.k {
    width: 120px;
    white-space: normal;
  }
  .rate-value {
    font-size: 26px;
  }
}
</style>