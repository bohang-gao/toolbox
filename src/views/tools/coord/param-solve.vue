<template>
  <ToolShell
    path="/coord/param-solve"
    title="坐标转换参数求解"
    intro="由 3 组以上公共点（源 ECEF 与目标 ECEF）用最小二乘求解 Bursa-Wolf 七参数：dx/dy/dz（米）、rx/ry/rz（角秒）、尺度 s（ppm）。求解后逐点回代，给出残差与 RMS。"
    :usage="[
      '每行一组公共点，格式为「源x,源y,源z, 目标x,目标y,目标z」，逗号、空格或分号分隔均可，单位米。',
      '至少需要 3 组不共线的公共点；少于 3 组或某行字段不全时不会计算并给出提示。',
      '残差为七参数正算回代后与目标点的三维距离；RMS 越小说明公共点几何与参数模型越匹配。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 粘贴公共点</div>
      <div class="option-panel">
        <div class="flex justify-between items-center">
          <span class="form-label">公共点（每行 6 个数：源 X,Y,Z, 目标 X,Y,Z）</span>
          <span class="tool-note">单位：米</span>
        </div>
        <textarea
          v-model="input"
          class="el-textarea__inner mt-2"
          style="min-height:180px"
          spellcheck="false"
          placeholder="例如：&#10;-2267749.162, 5009154.930, 3221290.709, -2267734.118, 5009148.052, 3221287.879&#10;-2267735.480, 5009155.216, 3221288.201, -2267720.437, 5009148.339, 3221285.372&#10;..."
        ></textarea>
        <div class="tool-note mt-2">目标椭球/框架须与源一致地按同一套 7 参数模型描述，本工具不区分方向，解算结果表示「源 → 目标」。</div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>2</b> 七参数</div>
      <div class="option-panel">
        <template v-if="result">
        <table class="data-table">
          <thead>
            <tr>
              <th>平移（m）</th>
              <th>旋转（角秒）</th>
              <th>尺度（ppm）</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>dx = {{ result.p.dx.toFixed(4) }}</td>
              <td>rx = {{ result.p.rx.toFixed(6) }}</td>
              <td rowspan="3" class="scale">s = {{ result.p.s.toFixed(6) }}</td>
            </tr>
            <tr>
              <td>dy = {{ result.p.dy.toFixed(4) }}</td>
              <td>ry = {{ result.p.ry.toFixed(6) }}</td>
            </tr>
            <tr>
              <td>dz = {{ result.p.dz.toFixed(4) }}</td>
              <td>rz = {{ result.p.rz.toFixed(6) }}</td>
            </tr>
          </tbody>
        </table>

        <div class="result-box mt-4">残差 RMS：{{ result.rms.toFixed(4) }} m　最大残差：{{ result.maxResidual.toFixed(4) }} m　点数：{{ result.points.length }}</div>
        </template>
        <div v-else class="tool-note">粘贴至少 3 组公共点后点击「求解」，七参数与残差会显示在这里。</div>
      </div>
    </div>

    <div v-if="result" class="step-block">
      <div class="step"><b>3</b> 逐点残差</div>
      <div class="option-panel">
        <table class="data-table">
          <thead>
            <tr>
              <th>序号</th>
              <th>残差（m）</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in result.points" :key="row.index">
              <td>{{ row.index }}</td>
              <td>{{ row.residual.toFixed(4) }}</td>
            </tr>
          </tbody>
        </table>

        <div class="flex flex-wrap mt-4" style="gap:10px">
          <button type="button" class="el-button el-button--info" @click="copyText(resultText, '七参数已复制')">复制结果</button>
        </div>
      </div>
    </div>

    <div class="step-actions">
      <button type="button" class="el-button el-button--primary" @click="calc">求解</button>
      <button type="button" class="el-button el-button--info" @click="clearAll">清空</button>
    </div>
  </ToolShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import ToolShell from '../../../components/ToolShell.vue'
import { msgError, msgSuccess } from '../../../lib/ui.js'
import { copyText } from '../textkit.js'
import { solveHelmert, helmertForward } from '../coordkit.js'

const input = ref('')
const result = ref(null)

function parsePoints(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  const src = []
  const dst = []
  const bad = []
  lines.forEach((line, i) => {
    const nums = line
      .replace(/[，；;]/g, ',')
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number)
    if (nums.length !== 6 || nums.some((n) => !Number.isFinite(n))) {
      bad.push(i + 1)
      return
    }
    src.push({ x: nums[0], y: nums[1], z: nums[2] })
    dst.push({ x: nums[3], y: nums[4], z: nums[5] })
  })
  return { src, dst, bad }
}

function calc() {
  const { src, dst, bad } = parsePoints(input.value)
  if (bad.length) {
    result.value = null
    msgError(`第 ${bad.join('、')} 行格式不正确（每行需 6 个数值）`)
    return
  }
  if (src.length < 3) {
    result.value = null
    msgError('至少需要 3 组公共点')
    return
  }

  let p
  try {
    p = solveHelmert(src, dst)
  } catch (e) {
    result.value = null
    msgError(`求解失败：${e.message || '矩阵奇异'}`)
    return
  }

  const points = src.map((sp, i) => {
    const f = helmertForward(sp.x, sp.y, sp.z, p)
    const d = Math.hypot(f.x - dst[i].x, f.y - dst[i].y, f.z - dst[i].z)
    return { index: i + 1, residual: d }
  })
  const rms = Math.sqrt(points.reduce((sum, r) => sum + r.residual * r.residual, 0) / points.length)
  const maxResidual = Math.max(...points.map((r) => r.residual))

  result.value = { p, points, rms, maxResidual }
  msgSuccess('七参数求解完成')
}

const resultText = computed(() => {
  const r = result.value
  if (!r) return ''
  const rows = r.points.map((row) => `点 ${row.index}：${row.residual.toFixed(4)} m`).join('\n')
  return [
    '七参数求解结果（源 → 目标）',
    `dx = ${r.p.dx.toFixed(4)} m`,
    `dy = ${r.p.dy.toFixed(4)} m`,
    `dz = ${r.p.dz.toFixed(4)} m`,
    `rx = ${r.p.rx.toFixed(6)} 角秒`,
    `ry = ${r.p.ry.toFixed(6)} 角秒`,
    `rz = ${r.p.rz.toFixed(6)} 角秒`,
    `s  = ${r.p.s.toFixed(6)} ppm`,
    `残差 RMS = ${r.rms.toFixed(4)} m，最大残差 = ${r.maxResidual.toFixed(4)} m`,
    rows
  ].join('\n')
})

function clearAll() {
  input.value = ''
  result.value = null
}
</script>

<style scoped>
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
.data-table .scale {
  font-size: 15px;
  font-weight: 600;
}
</style>
