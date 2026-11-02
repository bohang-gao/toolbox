<template>
  <div>
    <h1 class="text-4xl">摩斯电码</h1>

    <div class="tool-panel">
      <div class="flex flex-wrap items-center" style="gap:12px 20px">
        <span class="form-label">模式</span>
        <label class="el-radio"><input v-model="mode" type="radio" value="encode" />文本 → 摩斯电码</label>
        <label class="el-radio"><input v-model="mode" type="radio" value="decode" />摩斯电码 → 文本</label>
        <label v-if="mode === 'encode'" class="el-radio"><input v-model="slashSep" type="checkbox" />紧凑输出（单词间也用空格）</label>
      </div>

      <div class="mt-4">
        <div class="flex justify-between items-center">
          <span class="form-label">输入</span>
          <span style="font-size:12px;color:#909399">{{ input.length }} 字符</span>
        </div>
        <textarea
          v-model="input"
          class="el-textarea__inner mt-2"
          style="min-height:140px;font-family:Consolas,Menlo,monospace"
          :placeholder="mode === 'encode' ? '输入字母/数字/标点，例如：SOS' : '输入摩斯电码，例如：... --- ...'"
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
          style="min-height:140px;background:#f8f8f8;font-family:Consolas,Menlo,monospace"
          readonly
          placeholder="转换结果会实时显示在这里"
        ></textarea>
      </div>

      <div v-if="warn" class="mt-2" style="color:#e6a23c;font-size:14px">{{ warn }}</div>

      <div class="mt-4 flex items-center flex-wrap" style="gap:12px">
        <button type="button" class="el-button el-button--primary" @click="swap">
          <span><i class="fa fa-exchange mr-1"></i> 结果回填到输入</span>
        </button>
        <button type="button" class="el-button el-button--info" @click="clearAll">清空</button>
      </div>
    </div>

    <div class="mt-4 rounded-sm p-4" style="background-color:#dfd">
      <h2 class="text-xl">工具介绍：</h2>
      <p>摩斯电码（Morse Code）用短信号（·）与长信号（—）表示字母、数字和标点。本工具支持国际摩斯电码的双向转换，字母间以空格分隔、单词间以 / 分隔。</p>
      <h2 class="mt-4 text-xl">使用说明：</h2>
      <p style="white-space:pre-line">1. 选择编码或解码模式，输入内容后结果实时更新。
2. 编码时：字母间用空格分隔，单词间用 / 分隔；勾选「紧凑输出」则单词间也用空格。解码时兼容 ·/— 与 ./− 两种写法。
3. 无法识别的字符会在结果中提示，不支持的符号不会输出。</p>
    </div>

    <RelatedTools current="/morse" />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import RelatedTools from '../../components/RelatedTools.vue'
import { copyText } from './textkit.js'
import { encodeMorse, decodeMorse } from './morskit.js'

const mode = ref('encode')
const slashSep = ref(false)
const input = ref('')
const output = ref('')
const warn = ref('')

function convert() {
  const text = input.value
  warn.value = ''
  if (!text) {
    output.value = ''
    return
  }
  const res = mode.value === 'encode' ? encodeMorse(text) : decodeMorse(text)
  output.value = res.output
  if (slashSep.value && mode.value === 'encode') output.value = output.value.replace(/\s*\/\s*/g, ' ').replace(/\s+/g, ' ')
  warn.value = res.unsupported.length
    ? `${mode.value === 'encode' ? '以下字符不支持摩斯编码' : '以下电码无法识别'}：${res.unsupported.join(' ')}`
    : ''
}

watch([mode, slashSep], convert)

function swap() {
  if (!output.value) return
  input.value = output.value
  mode.value = mode.value === 'encode' ? 'decode' : 'encode'
  convert()
}

function clearAll() {
  input.value = ''
  output.value = ''
  warn.value = ''
}
</script>
