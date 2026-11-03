<template>
  <ToolShell
    path="/unicode"
    title="Unicode编码转换"
    intro="在中文与 \uXXXX 转义序列之间互转，按 UTF-16 码元编码，支持 BMP 之外的字符（自动输出代理对），并可选仅转换非 ASCII 字符以保留英文与符号。"
    :usage="[
      '选择编码或解码模式，输入内容后结果实时更新。',
      '编码时可勾选「仅转换非 ASCII 字符」，ASCII 部分保持原样；「大写 U+」控制十六进制字母大小写。',
      '解码支持 \\uXXXX、\\u{XXXXX}、U+XXXX、&#XXXX; 等多种写法。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 输入与设置</div>
      <div class="option-panel">
      <div class="flex flex-wrap items-center" style="gap:12px 20px">
        <span class="form-label">模式</span>
        <label class="el-radio"><input v-model="mode" type="radio" value="encode" />中文 → \uXXXX</label>
        <label class="el-radio"><input v-model="mode" type="radio" value="decode" />\uXXXX → 中文</label>
        <label class="el-radio"><input v-model="upper" type="checkbox" />大写 U+ 十六进制</label>
        <label class="el-radio"><input v-model="onlyNonAscii" type="checkbox" />仅转换非 ASCII 字符</label>
      </div>

      <div class="mt-4">
        <div class="flex justify-between items-center">
          <span class="form-label">输入</span>
          <span style="font-size:12px;color:#909399">{{ input.length }} 字符</span>
        </div>
        <textarea
          v-model="input"
          class="el-textarea__inner mt-2"
          style="min-height:140px"
          :placeholder="mode === 'encode' ? '输入中文或其他文本，例如：你好，世界' : '输入 \\uXXXX 序列，例如：\\u4f60\\u597d'"
          @input="convert"
        ></textarea>
      </div>

      <div class="mt-4">
        <div class="flex justify-between items-center">
          <span class="form-label">输出结果</span>
          <button type="button" class="el-button copy-btn" style="padding:6px 12px" @click="copyText(output, '结果已复制')">复制结果</button>
        </div>
        <textarea
          v-model="output"
          class="el-textarea__inner mt-2"
          style="min-height:140px;background:#f8f8f8"
          readonly
          placeholder="转换结果会实时显示在这里"
        ></textarea>
      </div>

      <div class="step-actions">
        <button type="button" class="el-button el-button--primary" @click="swap">
          <span><i class="fa fa-exchange mr-1"></i> 结果回填到输入</span>
        </button>
        <button type="button" class="el-button el-button--info" @click="clearAll">清空</button>
      </div>
      </div>
    </div>
  </ToolShell>
</template>

<script setup>
import { ref, watch } from 'vue'
import ToolShell from '../../components/ToolShell.vue'
import { msgError } from '../../lib/ui.js'
import { copyText } from './textkit.js'

const mode = ref('encode')
const upper = ref(false)
const onlyNonAscii = ref(true)
const input = ref('')
const output = ref('')

const hex = (code) => {
  const s = code.toString(16).padStart(4, '0')
  return upper.value ? s.toUpperCase() : s
}

function encodeText(text) {
  let out = ''
  for (const ch of text) {
    const code = ch.codePointAt(0)
    if (onlyNonAscii.value && code < 0x80) {
      out += ch
      continue
    }
    if (code <= 0xffff) {
      out += `\\u${hex(code)}`
    } else {
      // 补充平面：拆成代理对
      const cp = code - 0x10000
      const hi = 0xd800 + (cp >> 10)
      const lo = 0xdc00 + (cp & 0x3ff)
      out += `\\u${hex(hi)}\\u${hex(lo)}`
    }
  }
  return out
}

function decodeText(text) {
  const unified = String(text)
    .replace(/\\u\{([0-9a-fA-F]{1,6})\}/g, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\bu\+([0-9a-fA-F]{4,6})\b/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#x([0-9a-fA-F]{1,6});/g, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d{1,7});/g, (m, d) => String.fromCodePoint(parseInt(d, 10)))
  return unified
}

function convert() {
  const text = input.value
  if (!text) {
    output.value = ''
    return
  }
  try {
    output.value = mode.value === 'encode' ? encodeText(text) : decodeText(text)
  } catch (e) {
    output.value = ''
    msgError(`转换失败：${e.message || e}`)
  }
}

watch([mode, upper, onlyNonAscii], convert)

function swap() {
  if (!output.value) {
    msgError('没有可回填的结果')
    return
  }
  input.value = output.value
  mode.value = mode.value === 'encode' ? 'decode' : 'encode'
  convert()
}

function clearAll() {
  input.value = ''
  output.value = ''
}
</script>
