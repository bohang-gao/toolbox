<template>
  <ToolShell
    path="/qrcode"
    title="二维码制作"
    intro="根据输入的文本或网址生成二维码图片，可自定义尺寸与纠错级别；生成过程在浏览器本地完成，内容不会上传到服务器。"
    :usage="[
      '在「文本内容」中输入需要编码的文字或网址。',
      '选择二维码尺寸与纠错级别（级别越高，图案越密集、容错越强）。',
      '点击「生成二维码」，预览确认后点击「下载 PNG」保存图片。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 输入与设置</div>
      <div class="option-panel">
      <div class="flex flex-wrap items-center" style="gap:12px 20px">
        <span class="form-label">二维码尺寸</span>
        <select v-model.number="size" class="el-input__inner" style="width:140px">
          <option :value="128">128 × 128</option>
          <option :value="256">256 × 256</option>
          <option :value="384">384 × 384</option>
          <option :value="512">512 × 512</option>
          <option :value="1024">1024 × 1024</option>
        </select>

        <span class="form-label">纠错级别</span>
        <label class="el-radio"><input v-model="level" type="radio" value="L" />L（7%）</label>
        <label class="el-radio"><input v-model="level" type="radio" value="M" />M（15%）</label>
        <label class="el-radio"><input v-model="level" type="radio" value="Q" />Q（25%）</label>
        <label class="el-radio"><input v-model="level" type="radio" value="H" />H（30%）</label>
      </div>

      <div class="mt-4">
        <span class="form-label">文本内容</span>
        <textarea
          v-model="text"
          class="el-textarea__inner mt-2"
          style="min-height:120px"
          placeholder="输入需要生成二维码的文字或网址，例如 https://example.com/"
        ></textarea>
      </div>

      <div class="step-actions">
        <button type="button" class="el-button el-button--primary" :disabled="busy" @click="generate">
          <span><i class="fa fa-qrcode mr-1"></i> 生成二维码</span>
        </button>
        <button type="button" class="el-button el-button--info" @click="clearAll">清空</button>
      </div>

      <div v-if="dataUrl" class="mt-4 flex flex-col items-center">
        <img
          :src="dataUrl"
          alt="二维码预览"
          :style="{ width: Math.min(size, 320) + 'px', height: Math.min(size, 320) + 'px', border: '1px solid #ebeef5', borderRadius: '4px', background: '#fff', padding: '8px' }"
        />
        <div class="mt-4">
          <button type="button" class="el-button el-button--primary" @click="download">
            <span><i class="fa fa-download mr-1"></i> 下载 PNG</span>
          </button>
        </div>
      </div>
      </div>
    </div>
  </ToolShell>
</template>

<script setup>
import { ref } from 'vue'
import QRCode from 'qrcode'
import ToolShell from '../../components/ToolShell.vue'
import { downloadBlob, msgSuccess, msgError } from '../../lib/ui.js'

const text = ref('')
const size = ref(256)
const level = ref('M')
const dataUrl = ref('')
const busy = ref(false)

async function generate() {
  const content = text.value.trim()
  if (!content) {
    msgError('请输入需要生成二维码的文本内容')
    return
  }
  busy.value = true
  try {
    dataUrl.value = await QRCode.toDataURL(content, {
      width: size.value,
      margin: 2,
      errorCorrectionLevel: level.value
    })
    msgSuccess('二维码生成成功')
  } catch (e) {
    dataUrl.value = ''
    msgError(`生成失败：${e.message || e}`)
  } finally {
    busy.value = false
  }
}

function dataUrlToBlob(dataUrlStr) {
  const comma = dataUrlStr.indexOf(',')
  const mime = (dataUrlStr.slice(0, comma).match(/^data:([^;]+)/) || [])[1] || 'image/png'
  const bin = atob(dataUrlStr.slice(comma + 1))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

function download() {
  if (!dataUrl.value) return
  try {
    downloadBlob(dataUrlToBlob(dataUrl.value), 'qrcode.png')
    msgSuccess('已开始下载')
  } catch (e) {
    msgError(`下载失败：${e.message || e}`)
  }
}

function clearAll() {
  text.value = ''
  dataUrl.value = ''
}
</script>
