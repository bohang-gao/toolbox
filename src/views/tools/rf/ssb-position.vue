<template>
  <ToolShell
    path="/rf/ssb-position"
    title="SSB 位置关系"
    desc="载波、Point A、SSB、CORESET#0 与 SIB1 的频域 / 时域位置关系计算与示意图。"
    intro="由 ARFCN、带宽、SCS 与 CORESET#0 参数推导载波占用带宽、Point A、SSB 频域区间、CORESET#0 位置与 SIB1 的 Type0-PDCCH 监测时机，并绘制频域与时频示意图。"
    :usage="[
      '可直接点击上方预置按钮载入项目三小区参数，也可手动填写 DL / SSB ARFCN、带宽、SCS、ssb_case、controlResourceSetZero、searchSpaceZero 与 SLIV。',
      '点击「计算」后依次给出载波与频点、SSB / CORESET#0 / SIB1 三张结果表、自检结论，以及频域示意图与时频示意图。',
      '示意图横轴为频率（MHz）：标称带宽、占用带宽、CORESET#0、SSB 四条车道自下而上排列，并标出 F_REF 与 Point A 两条竖线。',
      '所有数值均来自共享算法库 nrkit.js，未做二次换算；自检项警告不阻止结果展示。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 输入与参数</div>
      <div class="option-panel">
        <div class="flex flex-wrap preset-row">
          <button type="button" class="el-button" @click="loadPreset('sc')">载入 小区0（sc）</button>
          <button type="button" class="el-button" @click="loadPreset('ka')">载入 小区1（ka）</button>
          <button type="button" class="el-button" @click="loadPreset('ka_feeder')">载入 小区2（ka_feeder）</button>
        </div>

        <div class="coord-grid mt-4">
          <label>
            <span class="form-label">小区名称</span>
            <input v-model="name" class="el-input__inner mt-2" type="text" spellcheck="false" placeholder="自定义小区" @keyup.enter="calc" />
          </label>
          <label>
            <span class="form-label">频段号</span>
            <input v-model="band" class="el-input__inner mt-2" type="text" inputmode="numeric" spellcheck="false" placeholder="例如 127" @keyup.enter="calc" />
          </label>
          <label>
            <span class="form-label">频率范围</span>
            <select v-model="fr" class="el-input__inner mt-2" @change="onDlEdit">
              <option value="FR1">FR1</option>
              <option value="FR2">FR2</option>
            </select>
          </label>
          <label>
            <span class="form-label">DL ARFCN</span>
            <input v-model="dlArfcn" class="el-input__inner mt-2" type="text" inputmode="numeric" spellcheck="false" placeholder="432000" @input="onDlEdit" @keyup.enter="calc" />
          </label>
          <label>
            <span class="form-label">Point A ARFCN</span>
            <input v-model="dlPa" class="el-input__inner mt-2" type="text" inputmode="numeric" spellcheck="false" placeholder="430164" @input="onDlEdit" @keyup.enter="calc" />
          </label>
          <label>
            <span class="form-label">DL 带宽（MHz）</span>
            <select v-model="dlBw" class="el-input__inner mt-2" @change="onDlEdit">
              <option value="">请选择</option>
              <option v-for="bw in BW_OPTIONS" :key="bw" :value="String(bw)">{{ bw }}</option>
            </select>
          </label>
          <label>
            <span class="form-label">DL SCS（kHz）</span>
            <select v-model="dlScs" class="el-input__inner mt-2" @change="onDlEdit">
              <option value="">请选择</option>
              <option v-for="scs in SCS_LIST" :key="scs" :value="String(scs)">{{ scs }}</option>
            </select>
          </label>
          <label>
            <span class="form-label">SSB ARFCN</span>
            <input v-model="ssbArfcn" class="el-input__inner mt-2" type="text" inputmode="numeric" spellcheck="false" placeholder="432030" @input="onDlEdit" @keyup.enter="calc" />
          </label>
          <label>
            <span class="form-label">SSB SCS（kHz）</span>
            <select v-model="ssbScs" class="el-input__inner mt-2" @change="onDlEdit">
              <option value="">请选择</option>
              <option v-for="scs in SCS_LIST" :key="scs" :value="String(scs)">{{ scs }}</option>
            </select>
          </label>
          <label>
            <span class="form-label">ssb_case</span>
            <select v-model="ssbCase" class="el-input__inner mt-2" @change="onDlEdit">
              <option value="">请选择</option>
              <option v-for="c in SSB_CASES" :key="c" :value="String(c)">{{ c }}</option>
            </select>
          </label>
          <label>
            <span class="form-label">controlResourceSetZero</span>
            <select v-model="coreset0Index" class="el-input__inner mt-2" @change="onDlEdit">
              <option value="">请选择</option>
              <option v-for="i in INDEX_0_15" :key="i" :value="String(i)">{{ i }}</option>
            </select>
          </label>
          <label>
            <span class="form-label">searchSpaceZero</span>
            <select v-model="searchSpaceZero" class="el-input__inner mt-2" @change="onDlEdit">
              <option value="">请选择</option>
              <option v-for="i in INDEX_0_15" :key="i" :value="String(i)">{{ i }}</option>
            </select>
          </label>
          <label>
            <span class="form-label">初始 BWP PDSCH SLIV</span>
            <input v-model="sliv" class="el-input__inner mt-2" type="text" inputmode="numeric" spellcheck="false" placeholder="53" @input="onDlEdit" @keyup.enter="calc" />
          </label>
        </div>

        <div class="tool-note">载入预置小区会同时带入其 UL 参数；手动修改任一 DL 参数后 UL 参数会被清空，UL 表随之隐藏。</div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>2</b> 载波与频点</div>
      <div class="option-panel">
        <template v-if="result">
          <table class="data-table">
            <tbody>
              <tr><td class="k">DL N_REF</td><td class="v">{{ groupNumber(result.dl.arfcn) }}</td></tr>
              <tr><td class="k">DL F_REF</td><td class="v">{{ freqCell(result.dl.freqMHz) }}</td></tr>
              <tr><td class="k">DL Point A (N_REF)</td><td class="v">{{ groupNumber(result.dl.pointA) }}</td></tr>
              <tr><td class="k">DL Point A (频率)</td><td class="v">{{ freqCell(result.dl.pointAFreq) }}</td></tr>
              <tr><td class="k">带宽 BW</td><td class="v">{{ result.dl.bw }} MHz</td></tr>
              <tr><td class="k">SCS / μ</td><td class="v">{{ result.dl.scs }} kHz / μ = {{ result.dl.mu }}</td></tr>
              <tr><td class="k">N_RB</td><td class="v">{{ result.dl.nrb }}{{ result.dl.nrbEstimated ? '（估算值）' : '' }}</td></tr>
              <tr><td class="k">占用带宽 BW_occ</td><td class="v">{{ mhz(result.dl.occBw) }}</td></tr>
              <tr><td class="k">标称带宽区间</td><td class="v">{{ mhzRange(result.dl.nom) }}</td></tr>
              <tr><td class="k">占用带宽区间</td><td class="v">{{ mhzRange(result.dl.occ) }}</td></tr>
            </tbody>
          </table>

          <table v-if="result.ul" class="data-table mt-4">
            <tbody>
              <tr><td class="k">UL N_REF</td><td class="v">{{ groupNumber(result.ul.arfcn) }}</td></tr>
              <tr><td class="k">UL F_REF</td><td class="v">{{ freqCell(result.ul.freqMHz) }}</td></tr>
              <tr><td class="k">UL Point A (N_REF)</td><td class="v">{{ groupNumber(result.ul.pointA) }}</td></tr>
              <tr><td class="k">UL Point A (频率)</td><td class="v">{{ freqCell(result.ul.pointAFreq) }}</td></tr>
              <tr><td class="k">带宽 BW</td><td class="v">{{ result.ul.bw }} MHz</td></tr>
              <tr><td class="k">SCS / μ</td><td class="v">{{ result.ul.scs }} kHz / μ = {{ result.ul.mu }}</td></tr>
              <tr><td class="k">N_RB</td><td class="v">{{ result.ul.nrb }}{{ result.ul.nrbEstimated ? '（估算值）' : '' }}</td></tr>
              <tr><td class="k">占用带宽 BW_occ</td><td class="v">{{ mhz(result.ul.occBw) }}</td></tr>
              <tr><td class="k">标称带宽区间</td><td class="v">{{ mhzRange(result.ul.nom) }}</td></tr>
              <tr><td class="k">占用带宽区间</td><td class="v">{{ mhzRange(result.ul.occ) }}</td></tr>
            </tbody>
          </table>
        </template>
        <div v-else class="tool-note">填写上方参数后点击「计算」，载波与频点结果会显示在这里。</div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>3</b> SSB / CORESET#0 / SIB1</div>
      <div class="option-panel">
        <template v-if="result">
          <div class="sub-title">SSB</div>
          <table class="data-table">
            <tbody>
              <tr><td class="k">SSB N_REF</td><td class="v">{{ groupNumber(result.ssb.arfcn) }}</td></tr>
              <tr><td class="k">F_SSB</td><td class="v">{{ freqCell(result.ssb.freqMHz) }}</td></tr>
              <tr><td class="k">SCS / μ</td><td class="v">{{ result.ssb.scs }} kHz / μ = {{ result.ssb.mu }}</td></tr>
              <tr><td class="k">BW_SSB（240 × SCS）</td><td class="v">{{ mhz(result.ssb.bw) }}</td></tr>
              <tr><td class="k">SSB 占用区间</td><td class="v">{{ mhzRange(result.ssb.range) }}</td></tr>
              <tr><td class="k">SSB 相对 Point A 偏移（MHz）</td><td class="v">{{ mhz(result.ssb.freqMHz - result.dl.pointAFreq) }}</td></tr>
              <tr>
                <td class="k">offsetToPointA（RB）</td>
                <td class="v">
                  <template v-if="result.coreset0">{{ result.coreset0.startRb }} RB（CORESET#0 起点的 RB 偏移，offsetToPa = {{ result.coreset0.offsetToPa }}）</template>
                  <template v-else>—</template>
                </td>
              </tr>
              <tr><td class="k">SSB#0 起始符号</td><td class="v">{{ result.ssb.symbolOffset }}</td></tr>
            </tbody>
          </table>

          <div class="sub-title mt-4">CORESET#0</div>
          <table class="data-table">
            <tbody>
              <tr><td class="k">选用表</td><td class="v">{{ coresetTableLabel }}</td></tr>
              <tr><td class="k">controlResourceSetZero</td><td class="v">{{ result.coreset0 ? result.coreset0.index : '—' }}</td></tr>
              <tr><td class="k">N_RB</td><td class="v">{{ result.coreset0 ? result.coreset0.nRb : '—' }}</td></tr>
              <tr><td class="k">符号数</td><td class="v">{{ result.coreset0 ? result.coreset0.symbols : '—' }}</td></tr>
              <tr><td class="k">表内 RB 偏移</td><td class="v">{{ result.coreset0 ? result.coreset0.tableOffset : '—' }}</td></tr>
              <tr><td class="k">起始 RB</td><td class="v">{{ result.coreset0 ? result.coreset0.startRb : '—' }}</td></tr>
              <tr><td class="k">RB 带宽</td><td class="v">{{ result.coreset0 ? mhz(result.coreset0.rbMhz) : '—' }}</td></tr>
              <tr><td class="k">频域区间</td><td class="v">{{ result.coreset0 ? mhzRange([result.coreset0.startF, result.coreset0.endF]) : '—' }}</td></tr>
              <tr><td class="k">offsetToPa</td><td class="v">{{ result.coreset0 ? result.coreset0.offsetToPa : '—' }}</td></tr>
              <tr>
                <td class="k">numSsb / numCommon / numRef</td>
                <td class="v">{{ result.coreset0 ? `${result.coreset0.numSsb} / ${result.coreset0.numCommon} / ${result.coreset0.numRef}` : '—' }}</td>
              </tr>
            </tbody>
          </table>

          <div class="sub-title mt-4">SIB1 时域</div>
          <table class="data-table">
            <tbody>
              <tr><td class="k">n0</td><td class="v">{{ result.sib1 ? result.sib1.n0 : '—' }}</td></tr>
              <tr><td class="k">slot 时长</td><td class="v">{{ result.sib1 ? `${result.sib1.slotMs} ms` : '—' }}</td></tr>
              <tr><td class="k">PDCCH 符号区间 (ms)</td><td class="v">{{ result.sib1 ? msRange(result.sib1.pdcch) : '—' }}</td></tr>
              <tr><td class="k">SLIV → (S, L)</td><td class="v">{{ slivLabel }}</td></tr>
              <tr><td class="k">PDSCH 符号区间 (ms)</td><td class="v">{{ result.sib1 ? msRange(result.sib1.pdsch) : '—' }}</td></tr>
              <tr><td class="k">监测 slot</td><td class="v">{{ result.sib1 ? `${result.sib1.monitoring[0]} / ${result.sib1.monitoring[1]}` : '—' }}</td></tr>
            </tbody>
          </table>

          <div class="flex mt-4">
            <button type="button" class="el-button el-button--info" @click="copyText(resultText, '结果已复制')">复制结果</button>
          </div>
        </template>
        <div v-else class="tool-note">计算后在此展示 SSB、CORESET#0 与 SIB1 的详细位置参数。</div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>4</b> 自检</div>
      <div class="option-panel">
        <template v-if="result">
          <div v-for="c in result.checks" :key="c.key" class="tool-note check-row" :class="'check--' + c.level">
            <span class="check-icon">{{ c.level === 'ok' ? '✓' : c.level === 'warn' ? '!' : '✗' }}</span>
            <span>{{ c.msg }}</span>
          </div>
        </template>
        <div v-else class="tool-note">计算后在此逐条列出 Point A、N_RB、SSB 与 CORESET#0 的自检结论。</div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>5</b> 频域 / 时频示意图</div>
      <div class="option-panel">
        <template v-if="freqChart">
          <div class="chart-title">频域位置示意</div>
          <svg class="sv-chart" viewBox="0 0 960 320" role="img" aria-label="频域位置示意图">
            <line x1="92" y1="274" x2="932" y2="274" stroke="#cbd5e1" />
            <g v-for="t in freqChart.ticks" :key="'ft' + t.x">
              <line :x1="t.x" y1="274" :x2="t.x" y2="280" stroke="#94a3b8" />
              <text :x="t.x" y="293" text-anchor="middle" class="sv-axis">{{ t.label }}</text>
            </g>
            <text x="932" y="310" text-anchor="end" class="sv-axis">频率 / MHz</text>

            <g v-for="lane in freqChart.lanes" :key="lane.key">
              <rect :x="lane.x1" :y="lane.y" :width="lane.w" :height="lane.h" :class="'lane lane--' + lane.key" />
              <text x="86" :y="lane.y + lane.h / 2 + 4" text-anchor="end" class="sv-lane-name">{{ lane.title }}</text>
              <text :x="lane.labelX" :y="lane.y + lane.h / 2 + 4" :text-anchor="lane.labelAnchor" class="sv-lane-label">{{ lane.label }}</text>
              <circle v-if="lane.dot" :cx="lane.dot" :cy="lane.y + lane.h / 2" r="4" fill="#D62728" />
            </g>

            <line :x1="freqChart.frefX" y1="108" :x2="freqChart.frefX" y2="274" stroke="#334155" stroke-dasharray="5 4" />
            <line :x1="freqChart.paX" y1="108" :x2="freqChart.paX" y2="274" stroke="#1E8449" stroke-dasharray="5 4" />
            <text :x="freqChart.frefX" y="96" text-anchor="middle" class="sv-line-label">F_REF {{ freqChart.frefLabel }}</text>
            <text :x="freqChart.paX" y="82" text-anchor="middle" class="sv-line-label" fill="#1E8449">Point A {{ freqChart.paLabel }}</text>

            <g transform="translate(738,8)">
              <rect x="0" y="0" width="188" height="66" rx="6" fill="#ffffff" stroke="#e2e8f0" />
              <rect x="10" y="12" width="16" height="8" fill="none" stroke="#94a3b8" stroke-dasharray="4 3" />
              <text x="34" y="20" class="sv-axis">标称带宽</text>
              <rect x="10" y="27" width="16" height="8" fill="rgba(37,99,235,0.25)" stroke="#2563eb" />
              <text x="34" y="35" class="sv-axis">占用带宽</text>
              <rect x="10" y="42" width="16" height="8" fill="#6A3D9A" fill-opacity="0.75" />
              <text x="34" y="50" class="sv-axis">CORESET#0</text>
              <rect x="108" y="12" width="16" height="8" fill="rgba(214,39,40,0.15)" stroke="#D62728" stroke-width="2" />
              <text x="132" y="20" class="sv-axis">SSB</text>
            </g>
          </svg>
        </template>
        <div v-else class="tool-note">计算后在此绘制频域位置示意图。</div>

        <template v-if="timeChart">
          <div class="chart-title mt-4">时频位置示意</div>
          <svg class="sv-chart" viewBox="0 0 960 300" role="img" aria-label="时频位置示意图">
            <line :x1="timeChart.L" :y1="timeChart.bottom" :x2="timeChart.R" :y2="timeChart.bottom" stroke="#cbd5e1" />
            <line :x1="timeChart.L" :y1="timeChart.top" :x2="timeChart.L" :y2="timeChart.bottom" stroke="#cbd5e1" />

            <g v-for="t in timeChart.ticks" :key="'tt' + t.x">
              <line :x1="t.x" :y1="timeChart.bottom" :x2="t.x" :y2="timeChart.bottom + 6" stroke="#94a3b8" />
              <line :x1="t.x" :y1="timeChart.top" :x2="t.x" :y2="timeChart.bottom" stroke="#e2e8f0" />
              <text :x="t.x" :y="timeChart.bottom + 20" text-anchor="middle" class="sv-axis">{{ t.label }}</text>
            </g>
            <text :x="timeChart.R" :y="timeChart.bottom + 34" text-anchor="end" class="sv-axis">时间 / ms</text>

            <g v-for="t in timeChart.yTicks" :key="'ty' + t.y">
              <line :x1="timeChart.L - 4" :y1="t.y" :x2="timeChart.L" :y2="t.y" stroke="#94a3b8" />
              <line :x1="timeChart.L" :y1="t.y" :x2="timeChart.R" :y2="t.y" stroke="#eef2f7" />
              <text :x="timeChart.L - 8" :y="t.y + 3" text-anchor="end" class="sv-axis">{{ t.label }}</text>
            </g>

            <g v-for="rect in timeChart.rects" :key="rect.key">
              <rect :x="rect.x" :y="rect.y" :width="rect.w" :height="rect.h" :class="'tr tr--' + rect.key" />
            </g>

            <g transform="translate(96,8)">
              <rect x="0" y="0" width="250" height="26" rx="6" fill="#ffffff" stroke="#e2e8f0" />
              <rect x="10" y="9" width="16" height="8" fill="rgba(214,39,40,0.15)" stroke="#D62728" stroke-width="2" />
              <text x="32" y="17" class="sv-axis">SSB</text>
              <rect x="86" y="9" width="16" height="8" fill="#6A3D9A" fill-opacity="0.75" />
              <text x="108" y="17" class="sv-axis">PDCCH</text>
              <rect x="174" y="9" width="16" height="8" fill="rgba(37,99,235,0.25)" stroke="#2563eb" />
              <text x="196" y="17" class="sv-axis">PDSCH</text>
            </g>
          </svg>
          <div class="tool-note">
            μ = {{ result.dl.mu }}，{{ result.sib1.slotMs }} ms/slot；SSB 取 {{ result.ssb.symbolOffset }} ~ {{ result.ssb.symbolOffset + 4 }} 符号，PDCCH 取 CORESET#0 的 {{ result.coreset0 ? result.coreset0.symbols : 0 }} 个符号。
          </div>
        </template>
        <div v-else class="tool-note">计算后在此绘制时频位置示意图。</div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>6</b> 三小区对比</div>
      <div class="option-panel">
        <table class="data-table compare-table">
          <thead>
            <tr>
              <th>小区</th>
              <th>DL N_REF / F_REF</th>
              <th>DL N_RB / BW / SCS</th>
              <th>SSB N_REF / F_SSB</th>
              <th>CORESET#0</th>
              <th>n0</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in presetCells" :key="item.key">
              <td>{{ item.a.name }}（{{ item.a.type }}，{{ item.a.fr }}，n{{ item.a.band }}）</td>
              <td>{{ groupNumber(item.a.dl.arfcn) }} / {{ formatFreq(item.a.dl.freqMHz) }}</td>
              <td>{{ item.a.dl.nrb }} / {{ item.a.dl.bw }} MHz / {{ item.a.dl.scs }} kHz</td>
              <td>{{ groupNumber(item.a.ssb.arfcn) }} / {{ formatFreq(item.a.ssb.freqMHz) }}</td>
              <td>
                {{ item.a.coreset0 ? `${item.a.coreset0.nRb} RB / ${item.a.coreset0.symbols} sym @ ${item.a.coreset0.startF.toFixed(2)}~${item.a.coreset0.endF.toFixed(2)} MHz` : '—' }}
              </td>
              <td>{{ item.a.sib1 ? item.a.sib1.n0 : '—' }}</td>
            </tr>
          </tbody>
        </table>

        <div class="result-box mt-4">
          <div v-for="d in pairDiffs" :key="d.label" class="pair-block">
            <div class="pair-title">{{ d.label }}</div>
            <div>DL 中心频点间隔 ΔF：{{ mhz(d.dlCenter) }}</div>
            <div>DL 占用带宽间隔 ΔF：{{ mhz(d.occGap) }}<span v-if="d.occGap < 0">（负值表示占用带宽重叠）</span></div>
            <div>UL 中心频点间隔 ΔF：{{ d.ulCenter == null ? '—' : mhz(d.ulCenter) }}</div>
          </div>
        </div>
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
import {
  analyzeCell,
  CELL_PRESETS,
  SCS_LIST,
  NRB_TABLE_FR1,
  NRB_TABLE_FR2,
  groupNumber,
  formatFreq
} from '../nrkit.js'

const BW_OPTIONS = Array.from(
  new Set([...Object.keys(NRB_TABLE_FR1), ...Object.keys(NRB_TABLE_FR2)].map(Number))
).sort((a, b) => a - b)
const SSB_CASES = Array.from({ length: 11 }, (_, i) => i + 1)
const INDEX_0_15 = Array.from({ length: 16 }, (_, i) => i)
const PRESET_KEYS = ['sc', 'ka', 'ka_feeder']

const name = ref('')
const band = ref('')
const fr = ref('FR1')
const dlArfcn = ref('')
const dlPa = ref('')
const dlBw = ref('')
const dlScs = ref('')
const ssbArfcn = ref('')
const ssbScs = ref('')
const ssbCase = ref('')
const coreset0Index = ref('')
const searchSpaceZero = ref('')
const sliv = ref('53')
const ulData = ref(null)
const result = ref(null)

/* ---------- 展示格式 ---------- */
const mhz = (v, d = 3) => `${Number(v).toFixed(d)} MHz`
const mhzRange = (range, d = 3) => `${Number(range[0]).toFixed(d)} ~ ${Number(range[1]).toFixed(d)} MHz`
const msRange = (range, d = 3) => (range ? `${Number(range[0]).toFixed(d)} ~ ${Number(range[1]).toFixed(d)} ms` : '—')
const freqCell = (f) => `${formatFreq(f)}（${mhz(f)}）`

function tickLabel(v, span) {
  const d = span >= 200 ? 0 : span >= 40 ? 1 : 2
  return Number(v).toFixed(d)
}

function intOf(value) {
  const t = String(value == null ? '' : value).trim()
  if (t === '') return NaN
  const n = Number(t)
  return Number.isInteger(n) ? n : NaN
}

function fail(message) {
  result.value = null
  msgError(message)
}

/* ---------- 预置 ---------- */
function loadPreset(key) {
  const preset = CELL_PRESETS[key]
  if (!preset) return
  const cell = JSON.parse(JSON.stringify(preset))
  name.value = cell.name
  band.value = String(cell.band)
  fr.value = cell.fr
  dlArfcn.value = String(cell.dl.arfcn)
  dlPa.value = String(cell.dl.pa)
  dlBw.value = String(cell.dl.bw)
  dlScs.value = String(cell.dl.scs)
  ssbArfcn.value = String(cell.dl.ssb)
  ssbScs.value = String(cell.dl.ssbScs)
  ssbCase.value = String(cell.dl.ssbCase)
  coreset0Index.value = String(cell.dl.coreset0Index)
  searchSpaceZero.value = String(cell.dl.searchSpaceZero)
  sliv.value = String(cell.sliv)
  ulData.value = cell.ul ? { ...cell.ul } : null
  result.value = analyzeCell(cell)
  if (!result.value) msgError('预置数据计算失败，请检查 nrkit.js')
}

/* UL 参数只在载入预置时带入，手动改 DL 后清空，避免 DL/UL 不一致 */
function onDlEdit() {
  ulData.value = null
}

/* ---------- 计算 ---------- */
function calc() {
  result.value = null

  const arfcn = intOf(dlArfcn.value)
  if (!Number.isInteger(arfcn) || arfcn < 0) return fail('DL ARFCN 必须是 0 ~ 3279165 的整数')
  const pa = intOf(dlPa.value)
  if (!Number.isInteger(pa) || pa < 0) return fail('Point A ARFCN 必须是 0 ~ 3279165 的整数')
  const ssb = intOf(ssbArfcn.value)
  if (!Number.isInteger(ssb) || ssb < 0) return fail('SSB ARFCN 必须是 0 ~ 3279165 的整数')

  const bw = intOf(dlBw.value)
  if (!BW_OPTIONS.includes(bw)) return fail('请从列表中选择有效的 DL 带宽')

  const scs = intOf(dlScs.value)
  if (!SCS_LIST.includes(scs)) return fail('请从列表中选择有效的 DL SCS')

  const ssbScsV = intOf(ssbScs.value)
  if (!SCS_LIST.includes(ssbScsV)) return fail('请从列表中选择有效的 SSB SCS')

  const ssbCaseV = intOf(ssbCase.value)
  if (!Number.isInteger(ssbCaseV) || ssbCaseV < 1 || ssbCaseV > 11) return fail('ssb_case 必须是 1 ~ 11 的整数')

  const coresetIndex = intOf(coreset0Index.value)
  if (!Number.isInteger(coresetIndex) || coresetIndex < 0 || coresetIndex > 15) {
    return fail('controlResourceSetZero 必须是 0 ~ 15 的整数')
  }

  const sssZero = intOf(searchSpaceZero.value)
  if (!Number.isInteger(sssZero) || sssZero < 0 || sssZero > 15) {
    return fail('searchSpaceZero 必须是 0 ~ 15 的整数')
  }

  const slivV = intOf(sliv.value)
  if (!Number.isInteger(slivV) || slivV < 0) return fail('SLIV 必须是非负整数')

  const bandV = String(band.value).trim() === '' ? null : intOf(band.value)
  if (String(band.value).trim() !== '' && !Number.isInteger(bandV)) return fail('频段号必须是整数')

  const cell = {
    name: String(name.value).trim() || '自定义小区',
    type: '',
    fr: fr.value,
    band: bandV,
    sliv: slivV,
    dl: {
      arfcn,
      pa,
      bw,
      scs,
      ssb,
      ssbScs: ssbScsV,
      ssbCase: ssbCaseV,
      coreset0Index: coresetIndex,
      searchSpaceZero: sssZero
    },
    ul: ulData.value
  }

  const analyzed = analyzeCell(cell)
  if (!analyzed) return fail('输入无法解析：请检查 ARFCN 是否落在 0 ~ 3279165 范围内')

  result.value = analyzed

  if (!analyzed.sib1 || !analyzed.sib1.sliv) {
    msgError('SLIV 无法解码为合法的 (S, L)，PDSCH 位置未给出')
  }
  if (!analyzed.coreset0) {
    msgError('CORESET#0 未能计算，请检查 controlResourceSetZero 与 SSB / SCS 配置')
  }
}

function clearAll() {
  name.value = ''
  band.value = ''
  fr.value = 'FR1'
  dlArfcn.value = ''
  dlPa.value = ''
  dlBw.value = ''
  dlScs.value = ''
  ssbArfcn.value = ''
  ssbScs.value = ''
  ssbCase.value = ''
  coreset0Index.value = ''
  searchSpaceZero.value = ''
  sliv.value = '53'
  ulData.value = null
  result.value = null
}

/* ---------- 结果文本 ---------- */
const coresetTableLabel = computed(() => {
  const r = result.value
  if (!r || !r.coreset0) return '—'
  return r.coreset0.tableKey === '120k' ? '120 kHz 表 13-8' : '30 kHz 表 13-4'
})

const slivLabel = computed(() => {
  const r = result.value
  if (!r || !r.sib1 || !r.sib1.sliv) return '—'
  return `(${r.sib1.sliv.S}, ${r.sib1.sliv.L})`
})

const resultText = computed(() => {
  const r = result.value
  if (!r) return ''
  const lines = []
  lines.push(`${r.name}（${r.fr}${r.band != null ? `，n${r.band}` : ''}）`)
  lines.push(`DL N_REF：${groupNumber(r.dl.arfcn)}，F_REF：${mhz(r.dl.freqMHz)}`)
  lines.push(`DL Point A：N_REF ${groupNumber(r.dl.pointA)}，${mhz(r.dl.pointAFreq)}`)
  lines.push(`DL N_RB：${r.dl.nrb}，BW：${r.dl.bw} MHz，SCS：${r.dl.scs} kHz（μ=${r.dl.mu}）`)
  lines.push(`DL 标称区间：${mhzRange(r.dl.nom)}`)
  lines.push(`DL 占用区间：${mhzRange(r.dl.occ)}（BW_occ ${mhz(r.dl.occBw)}）`)
  if (r.ul) {
    lines.push(`UL N_REF：${groupNumber(r.ul.arfcn)}，F_REF：${mhz(r.ul.freqMHz)}，Point A：${mhz(r.ul.pointAFreq)}`)
    lines.push(`UL N_RB：${r.ul.nrb}，BW：${r.ul.bw} MHz，SCS：${r.ul.scs} kHz（μ=${r.ul.mu}）`)
    lines.push(`UL 占用区间：${mhzRange(r.ul.occ)}`)
  }
  if (r.ssb) {
    lines.push(`SSB N_REF：${groupNumber(r.ssb.arfcn)}，F_SSB：${mhz(r.ssb.freqMHz)}`)
    lines.push(`SSB SCS：${r.ssb.scs} kHz（μ=${r.ssb.mu}），BW_SSB：${mhz(r.ssb.bw)}`)
    lines.push(`SSB 区间：${mhzRange(r.ssb.range)}，起始符号：${r.ssb.symbolOffset}`)
  }
  if (r.coreset0) {
    lines.push(`CORESET#0：${coresetTableLabel.value}，index ${r.coreset0.index}，${r.coreset0.nRb} RB / ${r.coreset0.symbols} sym`)
    lines.push(`CORESET#0 起始 RB：${r.coreset0.startRb}，区间：${mhzRange([r.coreset0.startF, r.coreset0.endF])}`)
    lines.push(`offsetToPa：${r.coreset0.offsetToPa}，numSsb/numCommon/numRef：${r.coreset0.numSsb}/${r.coreset0.numCommon}/${r.coreset0.numRef}`)
  }
  if (r.sib1) {
    lines.push(`SIB1 n0：${r.sib1.n0}，slot ${r.sib1.slotMs} ms`)
    lines.push(`PDCCH：${msRange(r.sib1.pdcch)}，SLIV → ${slivLabel.value}`)
    lines.push(`PDSCH：${msRange(r.sib1.pdsch)}，监测 slot：${r.sib1.monitoring[0]} / ${r.sib1.monitoring[1]}`)
  }
  lines.push('自检：')
  for (const c of r.checks) lines.push(`  [${c.level}] ${c.msg}`)
  return lines.join('\n')
})

/* ---------- 频域示意图 ---------- */
const freqChart = computed(() => {
  const r = result.value
  if (!r || !r.dl) return null
  const pts = [r.dl.nom[0], r.dl.nom[1]]
  if (r.coreset0) pts.push(r.coreset0.startF, r.coreset0.endF)
  if (r.ssb) pts.push(r.ssb.range[0], r.ssb.range[1])
  const lo = Math.min(...pts)
  const hi = Math.max(...pts)
  const span = hi - lo
  const margin = span > 0 ? span * 0.12 : 1
  const min = lo - margin
  const max = hi + margin
  const L = 92
  const R = 932
  const x = (f) => L + ((f - min) / (max - min)) * (R - L)

  const ticks = []
  const N = 7
  for (let i = 0; i < N; i += 1) {
    const v = min + ((max - min) * i) / (N - 1)
    ticks.push({ v, x: x(v), label: tickLabel(v, max - min) })
  }

  const mkLane = (key, title, y, h, x1, x2, label, dot) => {
    const wide = x2 - x1 > 190
    return {
      key,
      title,
      y,
      h,
      x1,
      x2,
      w: Math.max(2, x2 - x1),
      label,
      dot,
      labelX: wide ? x1 + 8 : Math.min(x2 + 6, R - 4),
      labelAnchor: 'start'
    }
  }

  const lanes = []
  lanes.push(mkLane('nom', '标称带宽', 246, 14, x(r.dl.nom[0]), x(r.dl.nom[1]), `BW ${r.dl.bw} MHz`))
  lanes.push(mkLane('occ', '占用带宽', 208, 22, x(r.dl.occ[0]), x(r.dl.occ[1]), `${r.dl.nrb} RB × 12 × ${r.dl.scs} kHz`))
  if (r.coreset0) {
    lanes.push(mkLane('coreset', 'CORESET#0', 170, 22, x(r.coreset0.startF), x(r.coreset0.endF), `CORESET#0 ${r.coreset0.nRb} RB / ${r.coreset0.symbols} sym`))
  }
  if (r.ssb) {
    lanes.push(mkLane('ssb', 'SSB', 132, 22, x(r.ssb.range[0]), x(r.ssb.range[1]), `SSB ${Number(r.ssb.bw).toFixed(1)} MHz`, x(r.ssb.freqMHz)))
  }

  return {
    min,
    max,
    ticks,
    lanes,
    frefX: x(r.dl.freqMHz),
    paX: x(r.dl.pointAFreq),
    frefLabel: mhz(r.dl.freqMHz),
    paLabel: mhz(r.dl.pointAFreq)
  }
})

/* ---------- 时频示意图 ---------- */
const timeChart = computed(() => {
  const r = result.value
  const fc = freqChart.value
  if (!r || !fc || !r.sib1 || !r.ssb) return null
  const pdcch = r.sib1.pdcch
  const pdsch = r.sib1.pdsch
  const tMax = Math.max(1, pdcch ? pdcch[1] : 0, pdsch ? pdsch[1] : 0) * 1.15
  const L = 76
  const R = 932
  const top = 40
  const bottom = 248
  const xT = (t) => L + (t / tMax) * (R - L)
  const yF = (f) => bottom - ((f - fc.min) / (fc.max - fc.min)) * (bottom - top)

  const symMs = r.sib1.slotMs / 14
  const rect = (key, x1, x2, lo, hi) => ({
    key,
    x: xT(x1),
    y: yF(hi),
    w: Math.max(2, xT(x2) - xT(x1)),
    h: Math.max(2, yF(lo) - yF(hi))
  })

  const rects = []
  if (pdsch) rects.push(rect('pdsch', pdsch[0], pdsch[1], r.dl.occ[0], r.dl.occ[1]))
  if (r.coreset0 && pdcch) rects.push(rect('pdcch', pdcch[0], pdcch[1], r.coreset0.startF, r.coreset0.endF))
  rects.push(rect('ssb', r.ssb.symbolOffset * symMs, (r.ssb.symbolOffset + 4) * symMs, r.ssb.range[0], r.ssb.range[1]))

  const ticks = []
  const N = 6
  for (let i = 0; i < N; i += 1) {
    const t = (tMax * i) / (N - 1)
    ticks.push({ t, x: xT(t), label: t.toFixed(2) })
  }

  const yTicks = []
  const M = 5
  for (let i = 0; i < M; i += 1) {
    const f = fc.min + ((fc.max - fc.min) * i) / (M - 1)
    yTicks.push({ f, y: yF(f), label: tickLabel(f, fc.max - fc.min) })
  }

  return { L, R, top, bottom, ticks, yTicks, rects, tMax, symMs }
})

/* ---------- 三小区静态对比 ---------- */
const presetCells = PRESET_KEYS.map((key) => ({
  key,
  a: analyzeCell(CELL_PRESETS[key])
}))

const pairDiffs = computed(() => {
  const list = []
  for (let i = 0; i < presetCells.length; i += 1) {
    for (let j = i + 1; j < presetCells.length; j += 1) {
      const a = presetCells[i].a
      const b = presetCells[j].a
      if (!a || !b) continue
      const lower = a.dl.freqMHz <= b.dl.freqMHz ? a : b
      const upper = lower === a ? b : a
      const occGap = upper.dl.occ[0] - lower.dl.occ[1]
      const ulCenter = a.ul && b.ul ? Math.abs(b.ul.freqMHz - a.ul.freqMHz) : null
      list.push({
        label: `${a.name} ↔ ${b.name}`,
        dlCenter: Math.abs(b.dl.freqMHz - a.dl.freqMHz),
        occGap,
        ulCenter
      })
    }
  }
  return list
})
</script>

<style scoped>
.coord-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.preset-row {
  gap: 10px;
}
.sub-title {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 8px;
}
.chart-title {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 8px;
}
.sv-chart {
  width: 100%;
  height: auto;
  display: block;
  overflow: visible;
}
.sv-axis {
  font-size: 10px;
  fill: #64748b;
}
.sv-lane-name {
  font-size: 11px;
  fill: #475569;
}
.sv-lane-label {
  font-size: 10px;
  fill: #334155;
}
.sv-line-label {
  font-size: 10px;
  fill: #334155;
}
.lane--nom {
  fill: none;
  stroke: #94a3b8;
  stroke-dasharray: 6 4;
}
.lane--occ {
  fill: rgba(37, 99, 235, 0.25);
  stroke: #2563eb;
  stroke-width: 1.5;
}
.lane--coreset {
  fill: #6a3d9a;
  fill-opacity: 0.75;
  stroke: #4c2a75;
}
.lane--ssb {
  fill: rgba(214, 39, 40, 0.15);
  stroke: #d62728;
  stroke-width: 2;
}
.tr--pdsch {
  fill: rgba(37, 99, 235, 0.25);
  stroke: #2563eb;
}
.tr--pdcch {
  fill: #6a3d9a;
  fill-opacity: 0.75;
  stroke: #4c2a75;
}
.tr--ssb {
  fill: rgba(214, 39, 40, 0.15);
  stroke: #d62728;
  stroke-width: 2;
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
  vertical-align: top;
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
  width: 210px;
  white-space: nowrap;
}
.data-table td.v {
  font-family: Consolas, Menlo, monospace;
  word-break: break-all;
}
.compare-table {
  font-size: 13px;
}
.compare-table td:first-child {
  white-space: nowrap;
}
.check-row {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}
.check-icon {
  flex: 0 0 14px;
  font-weight: 700;
  text-align: center;
}
.check--ok {
  color: #64748b;
}
.check--warn {
  color: #e6a23c;
}
.check--error {
  color: #e54d42;
}
.pair-block + .pair-block {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--border);
}
.pair-title {
  font-weight: 600;
  color: #334155;
  margin-bottom: 4px;
}
@media (max-width: 640px) {
  .coord-grid {
    grid-template-columns: 1fr;
  }
  .data-table td.k {
    width: 150px;
  }
}
</style>
