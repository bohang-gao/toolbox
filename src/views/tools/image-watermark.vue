<template>
  <ToolPage
    ref="pageRef"
    title="图片加水印"
    accept="image/*"
    :validator="imageValidator"
    make-thumb
    :process-handler="processHandler"
    intro="为多张图片批量添加文字水印，可设置水印内容、字号、透明度、九宫格位置与旋转角度，处理在浏览器本地完成。"
    usage="1. 点击上传区或「添加文件」选择图片，支持多选与拖拽。&#10;2. 输入水印文字，调整字号、透明度、位置与旋转角度。&#10;3. 点击「开始处理」，完成后自动下载（单文件直接下载，多文件打包 zip）。&#10;提示：水印使用白色文字并带半透明描边，便于在深浅不同的图片上辨识。"
  >
    <template #options>
      <div class="mt-4 option-panel">
        <div class="flex items-center flex-wrap" style="gap:12px 16px">
          <span class="form-label">水印文字</span>
          <input
            v-model="text"
            class="el-input__inner"
            style="width:280px"
            type="text"
            maxlength="120"
            placeholder="例如：仅供内部使用"
          />
        </div>

        <div class="el-slider mt-2">
          <span class="form-label" style="flex-shrink:0;width:64px">透明度</span>
          <input v-model.number="opacity" type="range" min="5" max="100" />
          <span style="min-width:44px;text-align:right;color:#606266">{{ opacity }}%</span>
        </div>

        <div class="mt-2 flex items-center flex-wrap" style="gap:12px 20px">
          <span class="form-label">字号</span>
          <input v-model.number="fontSize" class="el-input__inner" style="width:110px" type="number" min="8" max="400" />
          <span style="color:#909399">px</span>

          <span class="form-label">旋转角度</span>
          <input v-model.number="rotation" class="el-input__inner" style="width:110px" type="number" min="-180" max="180" />
          <span style="color:#909399">°</span>
        </div>

        <div class="mt-2 flex items-center flex-wrap" style="gap:12px">
          <span class="form-label">位置</span>
          <select v-model="position" class="el-input__inner" style="width:150px">
            <option value="top-left">左上</option>
            <option value="top-center">上中</option>
            <option value="top-right">右上</option>
            <option value="middle-left">左中</option>
            <option value="center">居中</option>
            <option value="middle-right">右中</option>
            <option value="bottom-left">左下</option>
            <option value="bottom-center">下中</option>
            <option value="bottom-right">右下</option>
          </select>
        </div>
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
const text = ref('')
const fontSize = ref(36)
const opacity = ref(50)
const position = ref('bottom-right')
const rotation = ref(0)

const ALIGN = {
  left: { align: 'left', anchorX: 'pad' },
  center: { align: 'center', anchorX: 'half' },
  right: { align: 'right', anchorX: 'pad' }
}
const BASELINE = {
  top: { baseline: 'top', anchorY: 'pad' },
  middle: { baseline: 'middle', anchorY: 'half' },
  bottom: { baseline: 'bottom', anchorY: 'pad' }
}

function anchorOf(pos, w, h, pad) {
  const [v, hz] = pos.split('-')
  const hKey = hz || 'center'
  const hMap = { left: ALIGN.left, center: ALIGN.center, right: ALIGN.right }
  const vMap = {
    top: BASELINE.top,
    middle: BASELINE.middle,
    bottom: BASELINE.bottom
  }
  const hSpec = hMap[hKey] || ALIGN.center
  const vSpec = vMap[v] || BASELINE.middle
  const x = hSpec.anchorX === 'pad' ? (hKey === 'left' ? pad : w - pad) : w / 2
  const y = vSpec.anchorY === 'pad' ? (v === 'top' ? pad : h - pad) : h / 2
  return { x, y, align: hSpec.align, baseline: vSpec.baseline }
}

function outFormat(type) {
  if (type === 'image/png') return { mime: 'image/png', ext: 'png' }
  if (type === 'image/webp') return { mime: 'image/webp', ext: 'webp' }
  return { mime: 'image/jpeg', ext: 'jpg' }
}

async function watermarkOne(t) {
  const img = await loadImage(t.file)
  const w = img.naturalWidth
  const h = img.naturalHeight
  const fmt = outFormat(t.file.type)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (fmt.mime === 'image/jpeg') {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
  }
  ctx.drawImage(img, 0, 0)

  const size = Math.min(400, Math.max(8, Math.round(Number(fontSize.value) || 36)))
  const pad = Math.max(12, Math.round(size * 0.5))
  const { x, y, align, baseline } = anchorOf(position.value, w, h, pad)

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate((Number(rotation.value) || 0) * Math.PI / 180)
  ctx.globalAlpha = Math.min(1, Math.max(0.05, (Number(opacity.value) || 50) / 100))
  ctx.font = `bold ${size}px "Microsoft YaHei", "PingFang SC", sans-serif`
  ctx.textAlign = align
  ctx.textBaseline = baseline
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(1, size / 10)
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.fillStyle = '#ffffff'
  const content = text.value.trim() || '水印'
  ctx.strokeText(content, 0, 0)
  ctx.fillText(content, 0, 0)
  ctx.restore()

  const blob = await canvasToBlob(canvas, fmt.mime, 0.95)
  return { blob, name: `${baseName(t.file.name)}_watermark.${fmt.ext}` }
}

async function processHandler(tasks) {
  const outputs = []
  for (const t of tasks) {
    t.status = 'processing'
    try {
      const out = await watermarkOne(t)
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
    await downloadZip(outputs, 'watermarked.zip')
    msgSuccess(`处理完成，共 ${outputs.length} 个文件`)
  } else {
    msgError('没有可下载的结果')
  }
}
</script>
