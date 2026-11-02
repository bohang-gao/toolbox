<template>
  <ToolPage
    ref="pageRef"
    title="图片尺寸调整"
    accept="image/*"
    :validator="imageValidator"
    make-thumb
    :process-handler="processHandler"
    intro="按百分比或指定宽度批量等比缩放图片，保持原始宽高比，支持 JPG / PNG / WebP 等格式。"
    usage="1. 点击上传区或「添加文件」选择图片，支持多选与拖拽。&#10;2. 选择「按百分比」或「指定宽度」，填写数值。&#10;3. 点击「开始处理」，完成后自动下载（单文件直接下载，多文件打包 zip）。"
  >
    <template #options>
      <div class="mt-4 option-panel">
        <div class="flex items-center flex-wrap" style="gap:12px 16px">
          <span class="form-label">缩放方式</span>
          <label class="el-radio"><input v-model="mode" type="radio" value="percent" />按百分比</label>
          <label class="el-radio"><input v-model="mode" type="radio" value="width" />指定宽度</label>
          <template v-if="mode === 'percent'">
            <input v-model.number="percent" class="el-input__inner" style="width:100px" type="number" min="1" max="400" />
            <span style="color:#909399">%</span>
          </template>
          <template v-else>
            <input v-model.number="targetWidth" class="el-input__inner" style="width:120px" type="number" min="1" max="20000" />
            <span style="color:#909399">px（高度按比例自动计算）</span>
          </template>
        </div>
        <p class="mt-2" style="color:#909399;font-size:13px">
          输出格式与原图一致；JPG / WebP 以 0.95 质量重新编码，PNG 保留透明通道。
        </p>
      </div>
    </template>
  </ToolPage>
</template>

<script setup>
import { ref } from 'vue'
import ToolPage from '../../components/ToolPage.vue'
import {
  imageValidator, loadImage, canvasToBlob, baseName,
  downloadZip, msgSuccess, msgError
} from '../../lib/ui.js'

const pageRef = ref(null)
const mode = ref('percent')
const percent = ref(50)
const targetWidth = ref(800)

function outFormat(type) {
  if (type === 'image/png') return { mime: 'image/png', ext: 'png' }
  if (type === 'image/webp') return { mime: 'image/webp', ext: 'webp' }
  if (type === 'image/gif') return { mime: 'image/png', ext: 'png' }
  return { mime: 'image/jpeg', ext: 'jpg' }
}

function calcSize(w, h) {
  let tw
  if (mode.value === 'percent') {
    const p = Math.min(400, Math.max(1, Number(percent.value) || 100))
    tw = Math.round(w * p / 100)
  } else {
    tw = Math.min(20000, Math.max(1, Math.round(Number(targetWidth.value) || w)))
  }
  tw = Math.max(1, tw)
  return { w: tw, h: Math.max(1, Math.round(h * tw / w)) }
}

async function resizeOne(t) {
  const img = await loadImage(t.file)
  const size = calcSize(img.naturalWidth, img.naturalHeight)
  const fmt = outFormat(t.file.type)
  const canvas = document.createElement('canvas')
  canvas.width = size.w
  canvas.height = size.h
  const ctx = canvas.getContext('2d')
  if (fmt.mime === 'image/jpeg') {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, size.w, size.h)
  }
  ctx.drawImage(img, 0, 0, size.w, size.h)
  const blob = await canvasToBlob(canvas, fmt.mime, 0.95)
  return { blob, name: `${baseName(t.file.name)}.${fmt.ext}` }
}

async function processHandler(tasks) {
  const outputs = []
  for (const t of tasks) {
    t.status = 'processing'
    try {
      const out = await resizeOne(t)
      t.status = 'done'
      t.outSize = out.blob.size
      outputs.push(out)
    } catch (e) {
      t.status = 'failed'
      t.error = e.message || String(e)
      msgError(`${t.file.name}：${t.error}`)
    }
  }
  if (outputs.length) {
    await downloadZip(outputs, 'resized.zip')
    msgSuccess(`处理完成，共 ${outputs.length} 个文件`)
  } else {
    msgError('没有可下载的结果')
  }
}
</script>
