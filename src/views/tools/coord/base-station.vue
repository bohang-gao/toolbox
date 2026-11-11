<template>
  <ToolShell
    path="/coord/base-station"
    title="基站坐标计算"
    intro="由多条观测值/多个已知点按给定权做加权平均，求基站的 ECEF 坐标，并换算为 WGS84 椭球下的 BLH，同时给出各点相对加权平均值的残差与 RMS。"
    :usage="[
      '每行填写点名、X/Y/Z（米）与权；权可留空，默认按 1 处理，权越大对结果影响越大。',
      '点击「计算」后得到加权平均 ECEF、对应 BLH，以及每行的三维残差与残差 RMS。',
      '基站坐标通常以 ECEF 存储和发布；本页 BLH 换算固定使用 WGS84 椭球。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 观测值 / 已知点</div>
      <div class="option-panel">
        <table class="data-table">
          <thead>
            <tr>
              <th>点名</th>
              <th>X（m）</th>
              <th>Y（m）</th>
              <th>Z（m）</th>
              <th>权</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in rows" :key="row.id">
              <td><input v-model="row.name" class="el-input__inner cell-input" type="text" /></td>
              <td><input v-model="row.x" class="el-input__inner cell-input" type="text" placeholder="0.000" /></td>
              <td><input v-model="row.y" class="el-input__inner cell-input" type="text" placeholder="0.000" /></td>
              <td><input v-model="row.z" class="el-input__inner cell-input" type="text" placeholder="0.000" /></td>
              <td><input v-model="row.w" class="el-input__inner cell-input" type="text" placeholder="1" /></td>
              <td>
                <button type="button" class="el-button btn-small" :disabled="rows.length <= 1" @click="removeRow(i)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="flex flex-wrap mt-4" style="gap:10px">
          <button type="button" class="el-button" @click="addRow">添加一行</button>
          <button type="button" class="el-button el-button--info" @click="resetRows">重置为 3 行</button>
        </div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>2</b> 加权平均坐标</div>
      <div class="option-panel">
        <template v-if="result">
        <table class="data-table">
          <thead>
            <tr>
              <th>项目</th>
              <th>X / 纬度</th>
              <th>Y / 经度</th>
              <th>Z / 大地高</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>加权平均 ECEF（m）</td>
              <td>{{ result.avg.x.toFixed(3) }}</td>
              <td>{{ result.avg.y.toFixed(3) }}</td>
              <td>{{ result.avg.z.toFixed(3) }}</td>
            </tr>
            <tr>
              <td>对应 BLH（WGS84）</td>
              <td>{{ result.blh.lat.toFixed(9) }}°</td>
              <td>{{ result.blh.lon.toFixed(9) }}°</td>
              <td>{{ result.blh.h.toFixed(3) }} m</td>
            </tr>
          </tbody>
        </table>
        <div class="result-box mt-4">参与点数：{{ result.residuals.length }}　残差 RMS：{{ result.rms.toFixed(4) }} m　最大残差：{{ result.maxResidual.toFixed(4) }} m</div>
        </template>
        <div v-else class="tool-note">在上表填入至少 2 行观测值（X / Y / Z，单位 m）后点击「计算」，加权平均坐标会显示在这里。</div>
      </div>
    </div>

    <div v-if="result" class="step-block">
      <div class="step"><b>3</b> 各点残差</div>
      <div class="option-panel">
        <table class="data-table">
          <thead>
            <tr>
              <th>点名</th>
              <th>权</th>
              <th>残差（m）</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in result.residuals" :key="r.id">
              <td>{{ r.name }}</td>
              <td>{{ r.weight }}</td>
              <td>{{ r.residual.toFixed(4) }}</td>
            </tr>
          </tbody>
        </table>

        <div class="flex flex-wrap mt-4" style="gap:10px">
          <button type="button" class="el-button el-button--info" @click="copyText(resultText, '基站坐标已复制')">复制结果</button>
        </div>
      </div>
    </div>

    <div class="step-actions">
      <button type="button" class="el-button el-button--primary" @click="calc">计算</button>
      <button type="button" class="el-button el-button--info" @click="clearAll">清空结果</button>
    </div>
  </ToolShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import ToolShell from '../../../components/ToolShell.vue'
import { msgError } from '../../../lib/ui.js'
import { copyText } from '../textkit.js'
import { averageCoordinate, ecefToGeodetic } from '../coordkit.js'

let seq = 0

function makeRow() {
  seq += 1
  return { id: seq, name: `点${seq}`, x: '', y: '', z: '', w: '1' }
}

const rows = ref([makeRow(), makeRow(), makeRow()])
const result = ref(null)

function addRow() {
  rows.value.push(makeRow())
}

function removeRow(index) {
  if (rows.value.length <= 1) return
  rows.value.splice(index, 1)
  result.value = null
}

function resetRows() {
  seq = 0
  rows.value = [makeRow(), makeRow(), makeRow()]
  result.value = null
}

function calc() {
  const points = []
  const weights = []
  const names = []

  for (let i = 0; i < rows.value.length; i++) {
    const row = rows.value[i]
    const x = Number(String(row.x).trim())
    const y = Number(String(row.y).trim())
    const z = Number(String(row.z).trim())
    if (![x, y, z].every((v) => Number.isFinite(v)) || String(row.x).trim() === '' || String(row.y).trim() === '' || String(row.z).trim() === '') {
      result.value = null
      msgError(`第 ${i + 1} 行的 X/Y/Z 必须是数值`)
      return
    }
    const wRaw = String(row.w == null ? '' : row.w).trim()
    const w = wRaw === '' ? 1 : Number(wRaw)
    if (!Number.isFinite(w) || w <= 0) {
      result.value = null
      msgError(`第 ${i + 1} 行的权必须为正数`)
      return
    }
    points.push({ x, y, z })
    weights.push(w)
    names.push(String(row.name || '').trim() || `点${i + 1}`)
  }

  let avg
  try {
    avg = averageCoordinate(points, weights)
  } catch (e) {
    result.value = null
    msgError(e.message || '无法计算加权平均')
    return
  }

  const blh = ecefToGeodetic(avg.x, avg.y, avg.z, 'WGS84')
  const residuals = points.map((p, i) => ({
    id: rows.value[i].id,
    name: names[i],
    weight: weights[i],
    residual: Math.hypot(p.x - avg.x, p.y - avg.y, p.z - avg.z)
  }))
  const rms = Math.sqrt(residuals.reduce((sum, r) => sum + r.residual * r.residual, 0) / residuals.length)
  const maxResidual = Math.max(...residuals.map((r) => r.residual))

  result.value = { avg, blh, residuals, rms, maxResidual }
}

const resultText = computed(() => {
  const r = result.value
  if (!r) return ''
  const lines = r.residuals.map((row) => `${row.name}（权 ${row.weight}）：${row.residual.toFixed(4)} m`)
  return [
    '基站加权平均坐标',
    `ECEF：${r.avg.x.toFixed(3)}, ${r.avg.y.toFixed(3)}, ${r.avg.z.toFixed(3)}`,
    `BLH（WGS84）：${r.blh.lat.toFixed(9)}, ${r.blh.lon.toFixed(9)}, ${r.blh.h.toFixed(3)}`,
    `残差 RMS：${r.rms.toFixed(4)} m，最大残差：${r.maxResidual.toFixed(4)} m`,
    ...lines
  ].join('\n')
})

function clearAll() {
  result.value = null
}
</script>

<style scoped>
.cell-input {
  height: 36px;
  line-height: 36px;
  padding: 0 10px;
}
.btn-small {
  padding: 8px 12px;
  font-size: 13px;
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
</style>
