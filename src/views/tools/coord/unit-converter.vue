<template>
  <ToolShell
    path="/coord/unit-converter"
    title="坐标单位转换"
    intro="角度单位与长度单位批量换算。角度涵盖度、弧度、角分、角秒、密位（6400 制）与 gon；长度涵盖米、千米、海里、英尺、英里、市里、市尺等常用单位。"
    :usage="[
      '先选择「角度」或「长度」分段，再输入数值并选择源单位与目标单位。',
      '点击「换算」后给出目标单位结果，并列出换算到该类别所有单位的一览表。',
      '角度内部以「度」为基准，长度内部以「米」为基准；密位采用 360° = 6400 mil 的军用口径。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 选择类别与输入</div>
      <div class="option-panel">
        <div class="flex flex-wrap items-center" style="gap:10px 20px">
          <span class="form-label">类别</span>
          <label class="el-radio"><input v-model="mode" type="radio" value="angle" />角度</label>
          <label class="el-radio"><input v-model="mode" type="radio" value="length" />长度</label>
        </div>

        <div class="field-grid mt-4">
          <label class="field">
            <span class="form-label">数值</span>
            <input
              v-model="value"
              class="el-input__inner"
              type="text"
              inputmode="decimal"
              spellcheck="false"
              placeholder="输入要换算的数值"
              @keyup.enter="calc"
            />
          </label>
          <label class="field">
            <span class="form-label">源单位</span>
            <select v-model="from" class="el-input__inner">
              <option v-for="unit in unitList" :key="unit" :value="unit">{{ unit }}</option>
            </select>
          </label>
          <label class="field">
            <span class="form-label">目标单位</span>
            <select v-model="to" class="el-input__inner">
              <option v-for="unit in unitList" :key="unit" :value="unit">{{ unit }}</option>
            </select>
          </label>
        </div>

        <div class="tool-note">
          <template v-if="mode === 'angle'">角度基准为度：1 弧度 = 57.29578°，1 角分 = 1/60°，1 角秒 = 1/3600°，1 密位 = 0.05625°，1 gon = 0.9°。</template>
          <template v-else>长度基准为米：1 海里 = 1852 m，1 英尺 = 0.3048 m，1 英里 = 1609.344 m，1 市里 = 500 m，1 市尺 = 1/3 m。</template>
        </div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>2</b> 换算结果</div>
      <div class="option-panel">
        <template v-if="result">
        <div class="conv-main">
          {{ fmt(result.value) }} {{ result.from }} = <b>{{ fmt(result.out) }}</b> {{ result.to }}
        </div>

        <div class="table-label">换算到所有{{ result.mode === 'angle' ? '角度' : '长度' }}单位</div>
        <table class="data-table">
          <thead>
            <tr>
              <th>单位</th>
              <th>数值</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in result.rows" :key="row.unit" :class="{ active: row.unit === result.to }">
              <td>{{ row.unit }}</td>
              <td class="v">{{ fmt(row.val) }}</td>
            </tr>
          </tbody>
        </table>

        <div class="result-box mt-4">{{ result.text }}</div>
        <div class="flex mt-4">
          <button type="button" class="el-button el-button--info" @click="copyText(result.text, '结果已复制')">复制结果</button>
        </div>
        </template>
        <div v-else class="tool-note">选择类别、输入数值并选定目标单位后点击「换算」，结果会显示在这里。</div>
      </div>
    </div>

    <div class="step-actions">
      <button type="button" class="el-button el-button--primary" @click="calc">换算</button>
      <button type="button" class="el-button" @click="swapUnits">交换单位</button>
      <button type="button" class="el-button el-button--info" @click="clearAll">清空</button>
    </div>
  </ToolShell>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import ToolShell from '../../../components/ToolShell.vue'
import { msgError } from '../../../lib/ui.js'
import { copyText } from '../textkit.js'
import { ANGLE_UNITS, LENGTH_UNITS, convertUnit } from '../coordkit.js'

const mode = ref('angle')
const value = ref('1')
const from = ref('度')
const to = ref('弧度')
const result = ref(null)

const table = computed(() => (mode.value === 'angle' ? ANGLE_UNITS : LENGTH_UNITS))
const unitList = computed(() => Object.keys(table.value))

watch(mode, (m) => {
  if (m === 'angle') {
    from.value = '度'
    to.value = '弧度'
  } else {
    from.value = '米'
    to.value = '千米'
  }
  result.value = null
})

function fmt(v) {
  if (!Number.isFinite(v)) return '—'
  if (v === 0) return '0'
  return Number(v.toPrecision(10)).toString()
}

function fail(message) {
  result.value = null
  msgError(message)
}

function calc() {
  const raw = String(value.value == null ? '' : value.value).trim()
  const v = Number(raw)
  if (raw === '' || !Number.isFinite(v)) {
    fail('请输入有效数值')
    return
  }
  const t = table.value
  if (!(from.value in t) || !(to.value in t)) {
    fail('请选择有效的源单位与目标单位')
    return
  }
  try {
    const out = convertUnit(v, from.value, to.value, t)
    const rows = Object.keys(t).map((unit) => ({ unit, val: convertUnit(v, from.value, unit, t) }))
    const text = [
      `${fmt(v)} ${from.value} = ${fmt(out)} ${to.value}`,
      '',
      `换算到所有${mode.value === 'angle' ? '角度' : '长度'}单位：`,
      ...rows.map((r) => `${r.unit}：${fmt(r.val)}`)
    ].join('\n')
    result.value = {
      mode: mode.value,
      value: v,
      from: from.value,
      to: to.value,
      out,
      rows,
      text
    }
  } catch (e) {
    fail(`换算失败：${e.message || '未知单位'}`)
  }
}

function swapUnits() {
  const prevFrom = from.value
  from.value = to.value
  to.value = prevFrom
  if (result.value) calc()
}

function clearAll() {
  value.value = ''
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
.conv-main {
  font-size: 20px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.6;
  word-break: break-all;
}
.conv-main b {
  color: var(--primary);
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
}
.data-table th {
  background: #f8fafc;
  color: #64748b;
  font-weight: 600;
}
.data-table td.v {
  font-family: Consolas, Menlo, monospace;
  word-break: break-all;
}
.data-table tr.active td {
  background: var(--primary-weak);
  color: var(--primary);
  font-weight: 600;
}
@media (max-width: 640px) {
  .field-grid {
    grid-template-columns: 1fr;
  }
  .conv-main {
    font-size: 17px;
  }
}
</style>
