<template>
  <ToolShell
    path="/regex"
    title="正则表达式测试"
    intro="在线调试 JavaScript 正则表达式，实时高亮匹配片段并列出每一处匹配的位置与捕获组，便于验证复杂模式。"
    :usage="[
      '输入正则表达式与 flags（g/i/m/s/u/y），或勾选下方常用 flag。',
      '在测试文本中实时高亮匹配结果，匹配列表显示序号、内容、起始位置与捕获组。',
      '语法错误会直接提示；未加 g 标志时只返回首个匹配。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 输入与设置</div>
      <div class="option-panel">
      <div class="flex flex-wrap items-center" style="gap:12px 16px">
        <span class="form-label">正则表达式</span>
        <span style="color:#909399">/</span>
        <input
          v-model="pattern"
          class="el-input__inner"
          style="width:320px;font-family:Consolas,Menlo,monospace"
          type="text"
          spellcheck="false"
          placeholder="例如 \d+ 或 (?&lt;year&gt;\d{4})"
          @input="run"
        />
        <span style="color:#909399">/</span>
        <input
          v-model="flags"
          class="el-input__inner"
          style="width:110px;font-family:Consolas,Menlo,monospace"
          type="text"
          spellcheck="false"
          placeholder="flags：g i m s u y"
          @input="run"
        />
      </div>

      <div class="mt-2 flex flex-wrap" style="gap:8px">
        <label v-for="f in FLAG_OPTIONS" :key="f.value" class="el-radio">
          <input type="checkbox" :checked="flags.includes(f.value)" @change="toggleFlag(f.value)" />{{ f.value }}（{{ f.desc }}）
        </label>
      </div>

      <div class="mt-4">
        <div class="flex justify-between items-center">
          <span class="form-label">测试文本</span>
          <span style="font-size:12px;color:#909399">{{ text.length }} 字符</span>
        </div>
        <textarea
          v-model="text"
          class="el-textarea__inner mt-2"
          style="min-height:140px"
          placeholder="粘贴需要测试的文本"
          @input="run"
        ></textarea>
      </div>

      <div v-if="error" class="mt-2" style="color:#f56c6c;font-size:14px">{{ error }}</div>

      <div v-if="!error && pattern" class="mt-4">
        <div class="form-label">匹配高亮（共 {{ matches.length }} 处）</div>
        <div class="regex-highlight mt-2" v-html="highlighted"></div>
      </div>

      <div v-if="!error && pattern && matches.length" class="mt-4">
        <div class="form-label">匹配列表</div>
        <div class="result-box mt-2">
          <div v-for="(m, i) in matches" :key="i" class="match-row">
            <span class="match-index">#{{ i + 1 }}</span>
            <span class="match-text">{{ m.text }}</span>
            <span class="match-pos">位置 {{ m.index }}</span>
            <div v-if="m.groups && m.groups.length" class="match-groups">
              捕获组：
              <span v-for="(g, gi) in m.groups" :key="gi" class="match-group">${{ gi + 1 }} = {{ g === undefined ? 'undefined' : g }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="step-actions">
        <button type="button" class="el-button el-button--info" @click="clearAll">清空</button>
      </div>
      </div>
    </div>
  </ToolShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import ToolShell from '../../components/ToolShell.vue'
import { runRegex, buildHighlight } from './regexkit.js'

const FLAG_OPTIONS = [
  { value: 'g', desc: '全局' },
  { value: 'i', desc: '忽略大小写' },
  { value: 'm', desc: '多行' },
  { value: 's', desc: '点匹配换行' },
  { value: 'u', desc: 'Unicode' },
  { value: 'y', desc: '粘性' }
]

const pattern = ref('')
const flags = ref('g')
const text = ref('')
const error = ref('')
const matches = ref([])
const ranges = ref([])

function toggleFlag(f) {
  flags.value = flags.value.includes(f) ? flags.value.replace(f, '') : flags.value + f
  run()
}

function run() {
  const res = runRegex(pattern.value, flags.value, text.value)
  error.value = res.error
  matches.value = res.matches
  ranges.value = res.ranges
}

const highlighted = computed(() => buildHighlight(text.value, ranges.value))

function clearAll() {
  pattern.value = ''
  flags.value = 'g'
  text.value = ''
  matches.value = []
  ranges.value = []
  error.value = ''
}
</script>

<style scoped>
.regex-highlight{background:#f8f8f8;border:1px solid #ebeef5;border-radius:4px;padding:12px;font-family:Consolas,Menlo,monospace;font-size:13px;line-height:1.7;white-space:pre-wrap;word-break:break-all;max-height:260px;overflow:auto}
.regex-highlight :deep(.regex-mark){background:#ffd04b;color:#333;border-radius:2px;padding:0 1px}
.match-row{padding:6px 0;border-bottom:1px dashed #ebeef5}
.match-index{color:#909399;margin-right:8px}
.match-text{font-weight:600;color:#0081ff;word-break:break-all}
.match-pos{color:#909399;margin-left:8px;font-size:12px}
.match-groups{margin-top:4px;font-size:12px;color:#606266}
.match-group{display:inline-block;margin-right:10px;background:#ecf5ff;border-radius:3px;padding:1px 6px;word-break:break-all}
</style>
