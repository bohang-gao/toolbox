<template>
  <ToolShell
    path="/coord/rtcm3"
    title="RTCM3数据解析"
    intro="解析 RTCM 3.x 二进制报文：识别 0xD3 前导、10 位长度、12 位消息号和 CRC24Q 校验，并给出常用消息类型名称。"
    :usage="[
      '粘贴十六进制报文，支持「D3 00 13 ...」和「D30013...」两种写法。',
      '点击「解析」，表格列出每个帧的偏移、长度、消息号与 CRC 校验结果。',
      '点击表格中的帧，可在下方查看该帧的头部字节与完整负载十六进制。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 输入十六进制报文</div>
      <div class="option-panel">
        <span class="form-label">支持空格、换行、0x 前缀，也支持连续十六进制串</span>
        <textarea
          v-model="hex"
          class="el-textarea__inner mt-2"
          style="min-height:140px;font-family:Consolas,Menlo,monospace"
          placeholder="D3 00 13 3E D0 00 03 ..."
        ></textarea>
        <div class="flex items-center mt-4" style="gap:10px;flex-wrap:wrap">
          <button type="button" class="el-button el-button--primary" @click="parse">解析</button>
          <button type="button" class="el-button" @click="fillSample">填入示例</button>
          <button type="button" class="el-button el-button--info" @click="clearAll">清空</button>
        </div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>2</b> 帧解析结果</div>
      <div class="option-panel">
        <div v-if="!frames.length" class="tool-note">解析结果会显示在这里。</div>

        <template v-else>
          <table class="data-table">
            <thead>
              <tr>
                <th>帧序号</th>
                <th>偏移</th>
                <th>长度(字节)</th>
                <th>消息号</th>
                <th>名称</th>
                <th>CRC24Q</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(f, i) in frames"
                :key="i"
                :class="{ 'is-sel': i === selected }"
                @click="select(i)"
              >
                <template v-if="!f.error">
                  <td>{{ i + 1 }}</td>
                  <td>{{ f.offset }}</td>
                  <td>{{ f.length }}<span class="muted">（负载 {{ f.payloadLength }}）</span></td>
                  <td>{{ f.messageType }}</td>
                  <td>{{ f.messageName }}</td>
                  <td :class="f.crcOk ? 'chk-ok' : 'chk-bad'">
                    {{ f.crcOk ? '通过' : '失败' }}<span class="muted"> {{ f.crcGiven }} / {{ f.crcCalc }}</span>
                  </td>
                </template>
                <template v-else>
                  <td>{{ i + 1 }}</td>
                  <td colspan="5" class="chk-bad">{{ f.error }}</td>
                </template>
              </tr>
            </tbody>
          </table>

          <div v-if="selectedFrame && !selectedFrame.error" class="mt-4">
            <div class="flex justify-between items-center">
              <span class="form-label">
                选中帧 #{{ selected + 1 }} · {{ selectedFrame.messageName }}（{{ selectedFrame.messageType }}）
              </span>
              <button
                type="button"
                class="el-button copy-btn"
                style="padding:6px 12px"
                @click="copyText(selectedFrame.payloadHex, '负载已复制')"
              >复制负载</button>
            </div>
            <div class="kv">头部：{{ selectedFrame.headerHex }}　|　负载长度：{{ selectedFrame.payloadLength }} 字节</div>
            <div class="kv">CRC：报文 {{ selectedFrame.crcGiven }}　计算 {{ selectedFrame.crcCalc}}　{{ selectedFrame.crcOk ? '（一致）' : '（不一致）' }}</div>
            <pre class="result-box mt-2">{{ selectedFrame.payloadHex }}</pre>
          </div>
        </template>
      </div>
    </div>
  </ToolShell>
</template>

<script setup>
import { ref, computed } from 'vue'
import ToolShell from '../../../components/ToolShell.vue'
import { msgError, msgSuccess } from '../../../lib/ui.js'
import { copyText } from '../textkit.js'
import { parseRtcm3, crc24q } from '../coordkit.js'

const hex = ref('')
const frames = ref([])
const selected = ref(0)

const selectedFrame = computed(() => frames.value[selected.value] || null)

function select(i) {
  selected.value = i
}

function hexBytes(bytes) {
  return bytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')
}

// 动态构造一个合法的 RTCM3 帧（消息号 1005），CRC 由 crc24q 实时计算
function buildSample() {
  const payload = [
    0x3e, 0xd0, // 12 位消息号：1005
    0x00, 0x00, 0x00, 0x00, 0x00, 0x11, 0x22, 0x33,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x44, 0x55, 0x66,
    0x00
  ]
  const len = payload.length
  const header = [0xd3, (len >> 8) & 0x03, len & 0xff]
  const crc = crc24q([...header, ...payload])
  const bytes = [
    ...header,
    ...payload,
    (crc >> 16) & 0xff,
    (crc >> 8) & 0xff,
    crc & 0xff
  ]
  return hexBytes(bytes)
}

function fillSample() {
  hex.value = buildSample()
  parse()
}

function parse() {
  if (!hex.value.trim()) {
    frames.value = []
    selected.value = 0
    msgError('请输入 RTCM3 十六进制报文')
    return
  }
  try {
    const list = parseRtcm3(hex.value)
    const good = list.filter(f => !f.error)
    frames.value = list
    selected.value = 0
    if (!list.length) {
      msgError('未找到以 0xD3 开头的 RTCM3 帧')
      return
    }
    if (!good.length) {
      msgError(list[0].error || '报文长度不足，无法构成完整帧')
      return
    }
    msgSuccess(`解析到 ${good.length} 个 RTCM3 帧`)
  } catch (e) {
    frames.value = []
    selected.value = 0
    msgError(`解析失败：${e.message || '十六进制格式有误'}`)
  }
}

function clearAll() {
  hex.value = ''
  frames.value = []
  selected.value = 0
}
</script>

<style scoped>
.data-table{width:100%;border-collapse:collapse;font-size:13px}
.data-table th,.data-table td{border:1px solid var(--border);padding:7px 10px;text-align:left;vertical-align:top}
.data-table th{background:#eef2f7;color:var(--text-2);font-weight:600;white-space:nowrap}
.data-table tbody tr{cursor:pointer;transition:background-color .15s}
.data-table tbody tr:hover{background:#f8fafc}
.data-table tbody tr.is-sel{background:var(--primary-weak)}
.chk-ok{color:#16a34a;font-weight:500}
.chk-bad{color:#dc2626;font-weight:500}
.muted{color:var(--text-3);font-size:12px}
.kv{font-size:13px;color:var(--text-2);margin-top:6px;word-break:break-all}
</style>
