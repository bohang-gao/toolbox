<template>
  <ToolShell
    path="/color"
    title="颜色值转换"
    intro="在 RGB、HEX、RGBA、HSL 之间互转颜色值，输入任意一种格式即可自动识别，并提供色块实时预览与一键复制。"
    :usage="[
      '在输入框填写颜色值（如 #0081ff、rgb(0,129,255)、hsl(210,100%,50%)），或点击色块使用取色器。',
      '下方会同时给出 HEX / RGB / RGBA / HSL 四种格式，点击「复制」即可取用。',
      '拖动「不透明度」滑杆可调整 RGBA 中的 alpha 值，预览背景为棋盘格。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 输入与设置</div>
      <div class="option-panel">
      <div class="flex flex-wrap items-center" style="gap:12px 20px">
        <span class="form-label">颜色输入（自动识别格式）</span>
        <input
          v-model="input"
          class="el-input__inner"
          style="width:280px"
          type="text"
          placeholder="#0081ff / rgb(0,129,255) / hsl(210,100%,50%)"
          @input="onInput"
        />
        <input v-model="picker" type="color" style="width:56px;height:40px;padding:2px;border:1px solid #dcdfe6;border-radius:4px;background:#fff;cursor:pointer" @input="onPick" />
        <button type="button" class="el-button el-button--info" @click="clearAll">清空</button>
      </div>

      <div class="mt-2" style="color:#909399;font-size:13px">
        支持 #RGB / #RRGGBB / #RRGGBBAA、rgb() / rgba()、hsl() / hsla()，也可直接输入 6 位十六进制值。
      </div>

      <div v-if="error" class="mt-2" style="color:#f56c6c;font-size:14px">{{ error }}</div>

      <div class="mt-4 flex flex-wrap" style="gap:20px;align-items:flex-start">
        <div>
          <div class="form-label">色块预览</div>
          <div class="color-preview mt-2" :style="{ background: previewBg }">
            <div class="color-preview-solid" :style="{ background: previewSolid }"></div>
          </div>
          <div class="mt-2" style="font-size:13px;color:#606266">不透明度 {{ Math.round(alpha) }}%</div>
        </div>

        <div style="flex:1;min-width:260px">
          <div v-for="row in formats" :key="row.label" class="color-row">
            <span class="color-row-label">{{ row.label }}</span>
            <span class="color-row-value">{{ row.value }}</span>
            <button type="button" class="el-button copy-btn" style="padding:6px 12px" @click="copyText(row.value, row.label + ' 已复制')">复制</button>
          </div>
        </div>
      </div>

      <div class="mt-4 flex flex-wrap items-center" style="gap:12px 20px">
        <span class="form-label">不透明度</span>
        <div class="el-slider" style="width:240px">
          <input v-model.number="alpha" type="range" min="0" max="100" step="1" @input="syncFromRgb" />
          <span style="min-width:44px;text-align:right;color:#606266">{{ alpha }}%</span>
        </div>
      </div>
      </div>
    </div>
  </ToolShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import ToolShell from '../../components/ToolShell.vue'
import { copyText } from './textkit.js'
import { rgbToHex, rgbToHsl, hexToRgb, parseColor } from './colorkit.js'

const input = ref('#0081ff')
const picker = ref('#0081ff')
const alpha = ref(100)
const rgb = ref({ r: 0, g: 129, b: 255 })
const error = ref('')

const alphaValue = computed(() => Math.min(1, Math.max(0, alpha.value / 100)))

const formats = computed(() => {
  const { r, g, b } = rgb.value
  const hsl = rgbToHsl(rgb.value)
  const a = Number(alphaValue.value.toFixed(2))
  return [
    { label: 'HEX', value: rgbToHex(rgb.value).toUpperCase() },
    { label: 'RGB', value: `rgb(${r}, ${g}, ${b})` },
    { label: 'RGBA', value: `rgba(${r}, ${g}, ${b}, ${a})` },
    { label: 'HSL', value: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` }
  ]
})

const previewSolid = computed(() => `rgb(${rgb.value.r}, ${rgb.value.g}, ${rgb.value.b})`)
const previewBg = computed(() => {
  const { r, g, b } = rgb.value
  const a = alphaValue.value
  return `linear-gradient(rgba(${r}, ${g}, ${b}, ${a}), rgba(${r}, ${g}, ${b}, ${a}))`
})

function applyParsed(parsed, updateInput = false) {
  rgb.value = { r: parsed.r, g: parsed.g, b: parsed.b }
  alpha.value = Math.round(parsed.a * 100)
  picker.value = rgbToHex(rgb.value)
  if (updateInput) input.value = rgbToHex(rgb.value)
  error.value = ''
}

function onInput() {
  const raw = String(input.value).trim()
  if (!raw) {
    error.value = ''
    return
  }
  const parsed = parseColor(raw)
  if (!parsed) {
    error.value = '无法识别该颜色格式，请检查输入'
    return
  }
  applyParsed(parsed)
}

function onPick() {
  const parsed = hexToRgb(picker.value)
  if (parsed) applyParsed(parsed, true)
}

// 调整透明度时保持当前 RGB
function syncFromRgb() {
  input.value = rgbToHex(rgb.value)
}

function clearAll() {
  input.value = ''
  error.value = ''
  rgb.value = { r: 0, g: 129, b: 255 }
  alpha.value = 100
  picker.value = '#0081ff'
}

// 初始解析一次
onInput()
</script>

<style scoped>
.color-preview{
  width:140px;height:140px;border:1px solid #dcdfe6;border-radius:4px;overflow:hidden;
  background-image:linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%);
  background-size:16px 16px;background-position:0 0,0 8px,8px -8px,-8px 0;position:relative;
}
.color-preview-solid{position:absolute;inset:0}
.color-row{display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px dashed #ebeef5}
.color-row-label{width:52px;flex-shrink:0;font-size:13px;color:#909399}
.color-row-value{flex:1;font-family:Consolas,Menlo,monospace;font-size:13px;color:#303133;word-break:break-all}
</style>
