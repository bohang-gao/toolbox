<template>
  <div>
    <h1 class="text-4xl">Unix时间戳</h1>

    <div class="tool-panel">
      <div class="flex flex-wrap items-center" style="gap:12px 20px">
        <span class="form-label">时间戳单位</span>
        <label class="el-radio"><input v-model="unit" type="radio" value="s" />秒（10 位）</label>
        <label class="el-radio"><input v-model="unit" type="radio" value="ms" />毫秒（13 位）</label>
        <button type="button" class="el-button el-button--primary" @click="useNow">
          <span><i class="fa fa-clock-o mr-1"></i> 填入当前时间</span>
        </button>
      </div>

      <div class="mt-4">
        <span class="form-label">时间戳</span>
        <input
          v-model="stamp"
          class="el-input__inner mt-2"
          type="text"
          inputmode="numeric"
          placeholder="例如 1730000000"
        />
      </div>

      <div class="mt-4">
        <span class="form-label">日期时间</span>
        <input
          v-model="dateText"
          class="el-input__inner mt-2"
          type="text"
          placeholder="例如 2024-10-27 03:33:20"
        />
      </div>

      <div class="mt-4 flex items-center flex-wrap" style="gap:12px">
        <button type="button" class="el-button el-button--primary" @click="convertFromStamp">
          <span><i class="fa fa-arrow-right mr-1"></i> 时间戳 → 日期</span>
        </button>
        <button type="button" class="el-button el-button--primary" @click="convertFromDate">
          <span><i class="fa fa-arrow-left mr-1"></i> 日期 → 时间戳</span>
        </button>
        <button type="button" class="el-button el-button--info" @click="clearAll">清空</button>
      </div>

      <div v-if="result" class="mt-4">
        <div class="result-box">
          <div><span class="form-label">时间戳</span>{{ result.stamp }}（{{ result.unitText }}）</div>
          <div><span class="form-label">本地时间</span>{{ result.local }}</div>
          <div><span class="form-label">UTC 时间</span>{{ result.utc }}</div>
          <div><span class="form-label">相对现在</span>{{ result.relative }}</div>
        </div>
        <div class="mt-2 flex flex-wrap" style="gap:12px">
          <button type="button" class="el-button" @click="copyText(result.stamp, '时间戳已复制')">复制时间戳</button>
          <button type="button" class="el-button" @click="copyText(result.local, '本地时间已复制')">复制本地时间</button>
        </div>
      </div>
    </div>

    <div class="mt-4 rounded-sm p-4" style="background-color:#dfd">
      <h2 class="text-xl">工具介绍：</h2>
      <p>Unix 时间戳表示自 1970-01-01 00:00:00 UTC 起经过的秒数（或毫秒数）。本工具支持秒/毫秒两种单位互转，并按浏览器本地时区显示日期。</p>
      <h2 class="mt-4 text-xl">使用说明：</h2>
      <p style="white-space:pre-line">1. 选择「秒」或「毫秒」单位，可一键填入当前时间。
2. 在「时间戳」输入数字后点「时间戳 → 日期」；在「日期时间」输入日期后点「日期 → 时间戳」。
3. 日期支持 2024-10-27、2024-10-27 03:33:20 等常见写法，结果同时给出本地时间与 UTC 时间。</p>
    </div>

    <RelatedTools current="/timestamp" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import RelatedTools from '../../components/RelatedTools.vue'
import { msgError } from '../../lib/ui.js'
import { copyText } from './textkit.js'
import { formatLocal, formatUtc, parseLocalDate, stampToMs, msToStamp, relativeText, autoUnit } from './timekit.js'

const unit = ref('s')
const stamp = ref('')
const dateText = ref('')
const result = ref(null)

function buildResult(ms, unitUsed) {
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) throw new Error('时间超出可表示范围')
  result.value = {
    stamp: msToStamp(ms, unitUsed),
    unitText: unitUsed === 's' ? '秒' : '毫秒',
    local: formatLocal(d),
    utc: formatUtc(d),
    relative: relativeText(ms)
  }
}

function convertFromStamp() {
  const raw = String(stamp.value).trim()
  if (!/^\d+$/.test(raw)) {
    msgError('请输入纯数字时间戳')
    return
  }
  // 输入位数与当前单位不符时自动纠正，避免误判
  unit.value = autoUnit(raw, unit.value)
  const ms = stampToMs(raw, unit.value)
  if (ms === null) {
    msgError('时间戳超出安全整数范围')
    return
  }
  try {
    buildResult(ms, unit.value)
  } catch (e) {
    msgError(e.message)
  }
}

function convertFromDate() {
  const raw = String(dateText.value).trim()
  if (!raw) {
    msgError('请输入日期时间')
    return
  }
  const d = parseLocalDate(raw)
  if (!d) {
    msgError('日期格式无法识别，请使用 2024-10-27 或 2024-10-27 03:33:20')
    return
  }
  try {
    buildResult(d.getTime(), unit.value)
  } catch (e) {
    msgError(e.message)
  }
}

function useNow() {
  const now = Date.now()
  stamp.value = msToStamp(now, unit.value)
  buildResult(now, unit.value)
}

function clearAll() {
  stamp.value = ''
  dateText.value = ''
  result.value = null
}
</script>
