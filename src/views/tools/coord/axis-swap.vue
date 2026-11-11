<template>
  <ToolShell
    path="/coord/axis-swap"
    title="坐标轴交换"
    intro="把输入的三分量按指定轴序重排，共 6 种排列（XYZ / XZY / YXZ / YZX / ZXY / ZYX）。例如选择 XZY 时，输出为 (x, z, y)。适用于不同软件、不同坐标系之间的轴向约定差异。"
    :usage="[
      '输入 X、Y、Z 三个分量，选择目标轴序。',
      '排列字符串表示「输出第 1、2、3 位分别取自哪个输入轴」，XZY 即输出 (x, z, y)。',
      '下方对照表同时给出 6 种排列对当前输入的重排结果。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 输入</div>
      <div class="option-panel">
        <div class="coord-grid">
          <label>
            <span class="form-label">X</span>
            <input v-model="xInput" class="el-input__inner mt-2" type="text" spellcheck="false" placeholder="1" />
          </label>
          <label>
            <span class="form-label">Y</span>
            <input v-model="yInput" class="el-input__inner mt-2" type="text" spellcheck="false" placeholder="2" />
          </label>
          <label>
            <span class="form-label">Z</span>
            <input v-model="zInput" class="el-input__inner mt-2" type="text" spellcheck="false" placeholder="3" />
          </label>
          <label>
            <span class="form-label">输出轴序</span>
            <select v-model="order" class="el-input__inner mt-2">
              <option v-for="o in ORDERS" :key="o" :value="o">{{ o }} → ({{ exprOf(o) }})</option>
            </select>
          </label>
        </div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>2</b> 结果</div>
      <div class="option-panel">
        <table v-if="out" class="data-table">
          <thead>
            <tr>
              <th>输出位</th>
              <th>来源轴</th>
              <th>数值</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(v, i) in out.values" :key="i">
              <td>第 {{ i + 1 }} 位</td>
              <td>{{ out.order[i] }}</td>
              <td>{{ fmt(v, 6) }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="out" class="result-box mt-4">{{ resultText }}</div>
        <p v-else class="tool-note">请输入有效的 X、Y、Z 三个数值。</p>
        <div class="flex flex-wrap mt-4" style="gap:10px">
          <button type="button" class="el-button" @click="copyText(resultText, '结果已复制')">复制结果</button>
        </div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>3</b> 6 种排列对照表</div>
      <div class="option-panel">
        <table v-if="table.length" class="data-table">
          <thead>
            <tr>
              <th>排列</th>
              <th>输出表达式</th>
              <th>当前结果</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in table" :key="row.order">
              <td>{{ row.order }}</td>
              <td>({{ row.expr }})</td>
              <td>{{ row.result.map(v => fmt(v, 6)).join(', ') }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="tool-note">输入有效数值后显示各排列的对照结果。</p>
      </div>
    </div>
  </ToolShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import ToolShell from '../../../components/ToolShell.vue'
import { copyText } from '../textkit.js'
import { swapAxes } from '../coordkit.js'

const ORDERS = ['XYZ', 'XZY', 'YXZ', 'YZX', 'ZXY', 'ZYX']

const xInput = ref('1')
const yInput = ref('2')
const zInput = ref('3')
const order = ref('XYZ')

const fmt = (v, d = 6) => Number(v).toFixed(d)

const exprOf = (o) => o.split('').join(', ')

function parseNum(raw) {
  const t = String(raw ?? '').trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

const nums = computed(() => {
  const arr = [parseNum(xInput.value), parseNum(yInput.value), parseNum(zInput.value)]
  return arr.some(v => v === null) ? null : arr
})

const out = computed(() => {
  if (!nums.value) return null
  const values = swapAxes(nums.value, order.value)
  return { order: order.value, values }
})

const table = computed(() => {
  if (!nums.value) return []
  return ORDERS.map(o => ({
    order: o,
    expr: exprOf(o),
    result: swapAxes(nums.value, o)
  }))
})

const resultText = computed(() => {
  const o = out.value
  if (!o) return ''
  return [
    `${o.order} → (${exprOf(o.order)})`,
    `第 1 位（${o.order[0]}）：${fmt(o.values[0], 6)}`,
    `第 2 位（${o.order[1]}）：${fmt(o.values[1], 6)}`,
    `第 3 位（${o.order[2]}）：${fmt(o.values[2], 6)}`
  ].join('\n')
})
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
