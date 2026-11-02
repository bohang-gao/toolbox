<template>
  <div>
    <h1 class="text-4xl">Base64编码解码</h1>

    <div class="tool-panel">
      <div class="flex flex-wrap items-center" style="gap:12px 20px">
        <span class="form-label">模式</span>
        <label class="el-radio"><input v-model="mode" type="radio" value="encode" />编码（文本 → Base64）</label>
        <label class="el-radio"><input v-model="mode" type="radio" value="decode" />解码（Base64 → 文本）</label>
        <label class="el-radio"><input v-model="urlSafe" type="checkbox" />URL 安全（- _ 替代 + /）</label>
      </div>

      <div class="mt-4">
        <div class="flex justify-between items-center">
          <span class="form-label">{{ mode === 'encode' ? '原始文本' : 'Base64 文本' }}</span>
          <span style="font-size:12px;color:#909399">{{ input.length }} 字符</span>
        </div>
        <textarea
          v-model="input"
          class="el-textarea__inner mt-2"
          style="min-height:140px"
          :placeholder="mode === 'encode' ? '输入需要编码的文本（支持中文/emoji）' : '粘贴 Base64 字符串'"
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
      <p>Base64 是一种把任意字节编码为 ASCII 字符串的方案。本工具使用 TextEncoder/TextDecoder 处理 UTF-8，中英文、emoji 均可安全往返，并支持 URL 安全字符集。</p>
      <h2 class="mt-4 text-xl">使用说明：</h2>
      <p style="white-space:pre-line">1. 选择编码或解码模式，输入内容后结果实时更新。
2. 勾选「URL 安全」后，输出中的 + / 会被替换为 - _，适用于 URL 参数场景。
3. 解码时若输入不是合法的 Base64，会给出错误提示且不覆盖上次有效结果。</p>
    </div>

    <RelatedTools current="/base64" />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import RelatedTools from '../../components/RelatedTools.vue'
import { msgError } from '../../lib/ui.js'
import { copyText, utf8ToBase64, base64ToUtf8 } from './textkit.js'

const mode = ref('encode')
const urlSafe = ref(false)
const input = ref('')
const output = ref('')

function normalizeForDecode(s) {
  const t = String(s).replace(/\s+/g, '')
  const restored = t.replace(/-/g, '+').replace(/_/g, '/')
  return restored
}

function convert() {
  const text = input.value
  if (!text) {
    output.value = ''
    return
  }
  try {
    if (mode.value === 'encode') {
      let b64 = utf8ToBase64(text)
      if (urlSafe.value) b64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      output.value = b64
    } else {
      const b64 = normalizeForDecode(text)
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) throw new Error('包含非法 Base64 字符')
      output.value = base64ToUtf8(b64)
    }
  } catch (e) {
    output.value = ''
    msgError(`转换失败：${e.message || '输入不是合法的 Base64'}`)
  }
}

watch([mode, urlSafe], convert)

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
