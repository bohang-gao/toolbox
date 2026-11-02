<template>
  <ToolPage
    ref="pageRef"
    title="拼字幕"
    accept="image/*"
    :validator="imageValidator"
    make-thumb
    :process-handler="processHandler"
    intro="把多张图片按顺序纵向拼接，并在每张图片下方合成对应的字幕文字条，最终输出一张长图，适合制作台词、字幕截图合集。"
    usage="1. 点击上传区或「添加文件」选择图片，顺序即从上到下的拼接顺序。&#10;2. 在下方列表中为每张图片输入对应的字幕文字（可留空，留空则不生成字幕条）。&#10;3. 可设置字号、文字颜色与字幕条背景色。&#10;4. 点击「开始处理」，生成一张长图并直接下载。&#10;提示：字幕会按图片宽度自动换行；拼接后的总高度不能超过浏览器画布上限。"
  >
    <template #options>
      <div class="mt-4 option-panel">
        <div class="flex items-center flex-wrap" style="gap:12px 20px">
          <span class="form-label">字号</span>
          <input v-model.number="fontSize" class="el-input__inner" style="width:110px" type="number" min="10" max="120" />
          <span style="color:#909399">px</span>

          <span class="form-label">文字颜色</span>
          <input v-model="textColor" type="color" style="width:48px;height:32px;border:1px solid #dcdfe6;border-radius:4px;cursor:pointer;padding:2px" />

          <span class="form-label">字幕条底色</span>
          <input v-model="barColor" type="color" style="width:48px;height:32px;border:1px solid #dcdfe6;border-radius:4px;cursor:pointer;padding:2px" />
        </div>

        <div v-if="pageRef && pageRef.tasks.length" class="mt-4">
          <p style="color:#606266">逐张填写字幕：</p>
          <div v-for="t in pageRef.tasks" :key="t.id" class="mt-2">
            <div style="color:#303133;font-size:14px;margin-bottom:4px">{{ t.file.name }}</div>
            <textarea
              class="el-textarea__inner"
              style="min-height:60px"
              :value="textOf(t)"
              placeholder="输入这张图片对应的字幕文字，留空则不生成字幕条"
              @input="setText(t.id, $event.target.value)"
            ></textarea>
          </div>
        </div>
        <p v-else class="mt-2" style="color:#909399">请先添加图片，再为每张图片填写字幕。</p>
      </div>
    </template>
  </ToolPage>
</template>

<script setup>
import { reactive, ref } from 'vue'
import ToolPage from '../../components/ToolPage.vue'
import {
  imageValidator, loadImage, canvasToBlob, downloadBlob,
  msgSuccess, msgError
} from '../../lib/ui.js'

const pageRef = ref(null)
const fontSize = ref(28)
const textColor = ref('#333333')
const barColor = ref('#ffffff')
const taskText = reactive({})

const MAX_CANVAS = 32767
const MAX_AREA = 268000000

function textOf(t) {
  return taskText[t.id] || ''
}
function setText(id, val) {
  taskText[id] = val
}

function wrapText(ctx, content, maxWidth) {
  const lines = []
  const paragraphs = String(content).split(/\r?\n/)
  for (const para of paragraphs) {
    if (!para) { lines.push(''); continue }
    let line = ''
    for (const ch of para) {
      const next = line + ch
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line)
        line = ch
      } else {
        line = next
      }
    }
    lines.push(line)
  }
  return lines
}

async function processHandler(tasks) {
  const decoded = []
  for (const t of tasks) {
    t.status = 'processing'
    try {
      const img = await loadImage(t.file)
      decoded.push({ img, text: textOf(t).trim() })
      t.status = 'done'
    } catch (e) {
      t.status = 'failed'
      t.error = e.message || String(e)
      msgError(`${t.file.name}：${t.error}`)
    }
  }

  if (!decoded.length) {
    msgError('没有可拼接的图片')
    return
  }

  const size = Math.min(120, Math.max(10, Math.round(Number(fontSize.value) || 28)))
  const lineHeight = Math.round(size * 1.4)
  const pad = Math.max(8, Math.round(size * 0.6))
  const width = Math.max(...decoded.map(d => d.img.naturalWidth))

  const measureCanvas = document.createElement('canvas')
  const measureCtx = measureCanvas.getContext('2d')
  measureCtx.font = `${size}px "Microsoft YaHei", "PingFang SC", sans-serif`

  const blocks = decoded.map(({ img, text }) => {
    const lines = text ? wrapText(measureCtx, text, width - pad * 2) : []
    const barHeight = text ? lines.length * lineHeight + pad * 2 : 0
    return { img, text, lines, barHeight }
  })

  const height = blocks.reduce((sum, b) => sum + b.img.naturalHeight + b.barHeight, 0)
  if (width > MAX_CANVAS || height > MAX_CANVAS || width * height > MAX_AREA) {
    msgError(`拼接后尺寸 ${width}×${height} 超出浏览器画布限制，请减少图片数量或先缩小图片`)
    return
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  let y = 0
  for (const b of blocks) {
    const iw = b.img.naturalWidth
    const ih = b.img.naturalHeight
    ctx.drawImage(b.img, Math.round((width - iw) / 2), y, iw, ih)
    y += ih

    if (b.barHeight) {
      ctx.fillStyle = barColor.value || '#ffffff'
      ctx.fillRect(0, y, width, b.barHeight)
      ctx.fillStyle = textColor.value || '#333333'
      ctx.font = `${size}px "Microsoft YaHei", "PingFang SC", sans-serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      b.lines.forEach((line, i) => {
        ctx.fillText(line, pad, y + pad + i * lineHeight)
      })
      y += b.barHeight
    }
  }

  try {
    const blob = await canvasToBlob(canvas, 'image/png')
    downloadBlob(blob, 'subtitle.png')
    msgSuccess(`拼接完成（${width}×${height}）`)
  } catch (e) {
    msgError(`拼接失败：${e.message || e}`)
  }
}
</script>
