<template>
  <div>
    <h1 class="text-4xl">URL编码解码</h1>

    <div class="tool-panel">
      <div class="flex flex-wrap items-center" style="gap:12px 20px">
        <span class="form-label">模式</span>
        <label class="el-radio"><input v-model="mode" type="radio" value="encode" />编码</label>
        <label class="el-radio"><input v-model="mode" type="radio" value="decode" />解码</label>
        <label class="el-radio"><input v-model="component" type="checkbox" />encodeURIComponent（默认）</label>
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
          placeholder="输入需要编码/解码的 URL 或文本"
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

      <div class="mt-4 flex items-center flex-wrap" style="gap:12px">
        <button type="button" class="el-button el-button--primary" @click="swap">
          <span><i class="fa fa-exchange mr-1"></i> 结果回填到输入</span>
        </button>
        <button type="button" class="el-button el-button--info" @click="clearAll">清空</button>
      </div>
    </div>

    <div class="mt-4 rounded-sm p-4" style="background-color:#dfd">
      <h2 class="text-xl">工具介绍：</h2>
      <p>使用浏览器原生的 encodeURIComponent / decodeURIComponent 对 URL 参数进行百分号编码与解码，也可切换到 encodeURI 保留 : / ? # 等分隔符。</p>
      <h2 class="mt-4 text-xl">使用说明：</h2>
      <p style="white-space:pre-line">1. 选择编码或解码模式，结果实时更新。
2. 默认使用 encodeURIComponent（适合对参数值编码）；取消勾选则使用 encodeURI（保留 URL 结构字符）。
3. 解码时遇到残缺的 % 转义序列会提示错误。</p>
    </div>

    <RelatedTools current="/url" />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import RelatedTools from '../../components/RelatedTools.vue'
import { msgError } from '../../lib/ui.js'
import { copyText } from './textkit.js'

const mode = ref('encode')
const component = ref(true)
const input = ref('')
const output = ref('')

function convert() {
  const text = input.value
  if (!text) {
    output.value = ''
    return
  }
  try {
    if (mode.value === 'encode') {
      output.value = component.value ? encodeURIComponent(text) : encodeURI(text)
    } else {
      output.value = component.value ? decodeURIComponent(text) : decodeURI(text)
    }
  } catch (e) {
    output.value = ''
    msgError(`转换失败：${e.message || '输入包含非法的转义序列'}`)
  }
}

watch([mode, component], convert)

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
