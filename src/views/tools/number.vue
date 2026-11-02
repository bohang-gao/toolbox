<template>
  <div>
    <h1 class="text-4xl">进制转换</h1>

    <div class="tool-panel">
      <div class="flex flex-wrap items-center" style="gap:12px 20px">
        <span class="form-label">输入进制</span>
        <label v-for="b in BASES" :key="b" class="el-radio">
          <input v-model.number="fromBase" type="radio" :value="b" @change="convert" />{{ b }} 进制
        </label>
      </div>

      <div class="mt-4">
        <div class="flex justify-between items-center">
          <span class="form-label">输入数值（支持 BigInt 大数，可带负号）</span>
          <span style="font-size:12px;color:#909399">有效字符：{{ validChars }}</span>
        </div>
        <input
          v-model="input"
          class="el-input__inner mt-2"
          type="text"
          spellcheck="false"
          placeholder="例如 255"
          @input="convert"
        />
      </div>

      <div v-if="error" class="mt-2" style="color:#f56c6c;font-size:14px">{{ error }}</div>

      <div class="mt-4">
        <div v-for="row in outputs" :key="row.base" class="num-row">
          <span class="num-row-label">{{ row.base }} 进制</span>
          <span class="num-row-value">{{ row.value }}</span>
          <button type="button" class="el-button copy-btn" style="padding:6px 12px" @click="copyText(row.value, row.base + ' 进制结果已复制')">复制</button>
        </div>
      </div>

      <div class="mt-4 flex items-center flex-wrap" style="gap:12px">
        <button type="button" class="el-button el-button--info" @click="clearAll">清空</button>
      </div>
    </div>

    <div class="mt-4 rounded-sm p-4" style="background-color:#dfd">
      <h2 class="text-xl">工具介绍：</h2>
      <p>在二、四、八、十、十六、三十二进制之间互转，基于 BigInt 实现，任意长度的整数都不会丢失精度（32 进制使用 0-9a-v 字符集）。</p>
      <h2 class="mt-4 text-xl">使用说明：</h2>
      <p style="white-space:pre-line">1. 选择输入进制，填写数值，其余进制结果实时显示。
2. 支持前导负号；十六进制与三十二进制大小写均可识别，输出统一为小写。
3. 空输入或含非法字符时会提示错误。</p>
    </div>

    <RelatedTools current="/number" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import RelatedTools from '../../components/RelatedTools.vue'
import { copyText } from './textkit.js'
import { DIGITS, parseInBase, toStringBase } from './numkit.js'

const BASES = [2, 4, 8, 10, 16, 32]

const fromBase = ref(10)
const input = ref('255')
const error = ref('')

const validChars = computed(() => DIGITS.slice(0, fromBase.value).toUpperCase())

// null = 空输入；undefined = 非法输入；BigInt = 有效值
const value = computed(() => {
  const raw = String(input.value).trim()
  if (!raw) return null
  const n = parseInBase(raw, fromBase.value)
  return n === null ? undefined : n
})

const outputs = computed(() => {
  const v = value.value
  if (typeof v !== 'bigint') return BASES.map((b) => ({ base: b, value: '' }))
  return BASES.map((b) => ({ base: b, value: toStringBase(v, b) }))
})

function convert() {
  const raw = String(input.value).trim()
  if (!raw) {
    error.value = ''
    return
  }
  error.value = value.value === undefined
    ? `包含不属于 ${fromBase.value} 进制的字符，有效字符为 ${validChars.value}`
    : ''
}

function clearAll() {
  input.value = ''
  error.value = ''
}

convert()
</script>

<style scoped>
.num-row{display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px dashed #ebeef5}
.num-row-label{width:70px;flex-shrink:0;font-size:13px;color:#909399}
.num-row-value{flex:1;font-family:Consolas,Menlo,monospace;font-size:13px;color:#303133;word-break:break-all;min-height:20px}
</style>
