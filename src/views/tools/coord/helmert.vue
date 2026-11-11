<template>
  <ToolShell
    path="/coord/helmert"
    title="七参数坐标转换"
    intro="Bursa-Wolf 七参数（3 个平移、3 个旋转、1 个尺度）空间直角坐标转换，支持小角度近似正算、严格旋转矩阵正算与迭代反算。"
    :usage="[
      '先填写 7 个参数：dx/dy/dz 单位米，rx/ry/rz 单位角秒，s 单位 ppm。',
      '选择正算（源 → 目标）或反算（目标 → 源），再填写三个坐标分量。',
      '勾选「严格旋转」时正算使用完整旋转矩阵，适用于旋转角较大的场景；反算始终为迭代求解。',
      '「单位阵自检」会把参数置 0，验证输出与输入一致并给出误差，用于检查符号与单位。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 七参数</div>
      <div class="option-panel">
        <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px">
          <label style="display:block">
            <span class="form-label">dx (m)</span>
            <input v-model="dx" class="el-input__inner mt-2" />
          </label>
          <label style="display:block">
            <span class="form-label">dy (m)</span>
            <input v-model="dy" class="el-input__inner mt-2" />
          </label>
          <label style="display:block">
            <span class="form-label">dz (m)</span>
            <input v-model="dz" class="el-input__inner mt-2" />
          </label>
          <label style="display:block">
            <span class="form-label">s (ppm)</span>
            <input v-model="s" class="el-input__inner mt-2" />
          </label>
          <label style="display:block">
            <span class="form-label">rx (″)</span>
            <input v-model="rx" class="el-input__inner mt-2" />
          </label>
          <label style="display:block">
            <span class="form-label">ry (″)</span>
            <input v-model="ry" class="el-input__inner mt-2" />
          </label>
          <label style="display:block">
            <span class="form-label">rz (″)</span>
            <input v-model="rz" class="el-input__inner mt-2" />
          </label>
          <div class="flex items-center" style="padding-top:26px">
            <label class="el-radio"><input v-model="strict" type="checkbox" />严格旋转</label>
          </div>
        </div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>2</b> 坐标输入</div>
      <div class="option-panel">
        <div class="flex flex-wrap items-center" style="gap:12px 20px">
          <span class="form-label">方向</span>
          <label class="el-radio"><input v-model="mode" type="radio" value="forward" />正算（源 → 目标）</label>
          <label class="el-radio"><input v-model="mode" type="radio" value="inverse" />反算（目标 → 源）</label>
        </div>
        <div class="mt-4" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px">
          <label style="display:block">
            <span class="form-label">{{ mode === 'forward' ? 'X1 (m)' : 'X2 (m)' }}</span>
            <input v-model="x" class="el-input__inner mt-2" placeholder="空间直角坐标" />
          </label>
          <label style="display:block">
            <span class="form-label">{{ mode === 'forward' ? 'Y1 (m)' : 'Y2 (m)' }}</span>
            <input v-model="y" class="el-input__inner mt-2" placeholder="空间直角坐标" />
          </label>
          <label style="display:block">
            <span class="form-label">{{ mode === 'forward' ? 'Z1 (m)' : 'Z2 (m)' }}</span>
            <input v-model="z" class="el-input__inner mt-2" placeholder="空间直角坐标" />
          </label>
        </div>
        <div class="step-actions">
          <button type="button" class="el-button" @click="selfCheck">单位阵自检</button>
          <button type="button" class="el-button el-button--primary" @click="calc">计算</button>
        </div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>3</b> 结果</div>
      <div class="option-panel">
        <div class="flex justify-between items-center">
          <span class="form-label">转换结果</span>
          <button type="button" class="el-button copy-btn" style="padding:6px 12px" @click="copyResult">复制结果</button>
        </div>
        <pre class="result-box mt-2">{{ output || '点击「计算」查看结果' }}</pre>
      </div>
    </div>
  </ToolShell>
</template>

<script setup>
import { ref } from 'vue'
import ToolShell from '../../../components/ToolShell.vue'
import { msgError, msgSuccess } from '../../../lib/ui.js'
import { copyText } from '../textkit.js'
import { helmertForward, helmertForwardExact, helmertInverse } from '../coordkit.js'

const dx = ref('0')
const dy = ref('0')
const dz = ref('0')
const rx = ref('0')
const ry = ref('0')
const rz = ref('0')
const s = ref('0')
const strict = ref(false)
const mode = ref('forward')
const x = ref('')
const y = ref('')
const z = ref('')
const output = ref('')

function num(v, name) {
  const s0 = String(v).trim()
  if (s0 === '') throw new Error(`请填写${name}`)
  const n = Number(s0)
  if (!Number.isFinite(n)) throw new Error(`${name}不是有效数字`)
  return n
}

function readParams() {
  return {
    dx: num(dx.value, 'dx'),
    dy: num(dy.value, 'dy'),
    dz: num(dz.value, 'dz'),
    rx: num(rx.value, 'rx'),
    ry: num(ry.value, 'ry'),
    rz: num(rz.value, 'rz'),
    s: num(s.value, 's')
  }
}

function calc() {
  try {
    const p = readParams()
    const x1 = num(x.value, mode.value === 'forward' ? 'X1' : 'X2')
    const y1 = num(y.value, mode.value === 'forward' ? 'Y1' : 'Y2')
    const z1 = num(z.value, mode.value === 'forward' ? 'Z1' : 'Z2')
    const isForward = mode.value === 'forward'
    const label = isForward ? (strict.value ? '正算（严格旋转矩阵）' : '正算（Bursa-Wolf 小角度）') : '反算（迭代求解）'
    const r = isForward
      ? (strict.value ? helmertForwardExact(x1, y1, z1, p) : helmertForward(x1, y1, z1, p))
      : helmertInverse(x1, y1, z1, p)
    const outLabel = isForward ? 'X2/Y2/Z2' : 'X1/Y1/Z1'
    output.value = [
      label,
      `参数：dx=${p.dx} m, dy=${p.dy} m, dz=${p.dz} m`,
      `　　　rx=${p.rx}″, ry=${p.ry}″, rz=${p.rz}″, s=${p.s} ppm`,
      '',
      `${outLabel}：`,
      `X = ${r.x.toFixed(4)} m`,
      `Y = ${r.y.toFixed(4)} m`,
      `Z = ${r.z.toFixed(4)} m`
    ].join('\n')
  } catch (e) {
    output.value = ''
    msgError(e.message || '计算失败')
  }
}

// 参数全置 0，验证单位阵输出与输入一致
function selfCheck() {
  try {
    const x0 = num(x.value, 'X')
    const y0 = num(y.value, 'Y')
    const z0 = num(z.value, 'Z')
    dx.value = '0'
    dy.value = '0'
    dz.value = '0'
    rx.value = '0'
    ry.value = '0'
    rz.value = '0'
    s.value = '0'
    const zero = { dx: 0, dy: 0, dz: 0, rx: 0, ry: 0, rz: 0, s: 0 }
    const r = strict.value ? helmertForwardExact(x0, y0, z0, zero) : helmertForward(x0, y0, z0, zero)
    const err = Math.max(Math.abs(r.x - x0), Math.abs(r.y - y0), Math.abs(r.z - z0))
    const pass = err < 1e-6
    output.value = [
      `单位阵自检（${strict.value ? '严格旋转' : '小角度近似'}）`,
      '参数已全部置为 0',
      '',
      '输入：',
      `X = ${x0.toFixed(6)} m`,
      `Y = ${y0.toFixed(6)} m`,
      `Z = ${z0.toFixed(6)} m`,
      '',
      '输出：',
      `X = ${r.x.toFixed(6)} m`,
      `Y = ${r.y.toFixed(6)} m`,
      `Z = ${r.z.toFixed(6)} m`,
      '',
      `最大绝对误差 = ${err.toExponential(3)} m`,
      `判定：${pass ? '通过（输出与输入一致）' : '未通过（请检查参数或输入）'}`
    ].join('\n')
    if (pass) msgSuccess('单位阵自检通过')
    else msgError('单位阵自检未通过')
  } catch (e) {
    output.value = ''
    msgError(e.message || '自检失败')
  }
}

function copyResult() {
  copyText(output.value, '结果已复制')
}
</script>
