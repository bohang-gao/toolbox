<template>
  <ToolPage
    ref="pageRef"
    title="拼长图"
    accept="image/*"
    :validator="imageValidator"
    make-thumb
    :process-handler="processHandler"
    intro="把多张图片按上传顺序横向或纵向拼接成一张长图，可自定义图片间距。"
    usage="1. 点击上传区或「添加文件」选择多张图片（顺序即拼接顺序）。&#10;2. 选择横向 / 纵向拼接，设置间距（像素）。&#10;3. 点击「开始处理」，生成一张长图并直接下载。&#10;提示：拼接后的画布尺寸不能超过浏览器上限（约 32767px）。"
  >
    <template #options>
      <div class="mt-4 option-panel">
        <div class="flex items-center flex-wrap" style="gap:12px 16px">
          <span class="form-label">拼接方式</span>
          <label class="el-radio"><input v-model="direction" type="radio" value="vertical" />纵向拼接</label>
          <label class="el-radio"><input v-model="direction" type="radio" value="horizontal" />横向拼接</label>
        </div>
        <div class="mt-2 flex items-center flex-wrap" style="gap:12px">
          <span class="form-label">图片间距</span>
          <input v-model.number="gap" class="el-input__inner" style="width:110px" type="number" min="0" max="200" />
          <span style="color:#909399">px</span>
        </div>
        <p class="mt-2" style="color:#909399;font-size:13px">
          空白区域填充为白色；图片不缩放，按原始像素拼接。
        </p>
      </div>
    </template>
  </ToolPage>
</template>

<script setup>
import { ref } from 'vue'
import ToolPage from '../../components/ToolPage.vue'
import {
  imageValidator, loadImage, canvasToBlob, downloadBlob,
  msgSuccess, msgError
} from '../../lib/ui.js'

const pageRef = ref(null)
const direction = ref('vertical')
const gap = ref(0)

const MAX_CANVAS = 32767
const MAX_AREA = 268000000

async function processHandler(tasks) {
  const decoded = []
  for (const t of tasks) {
    t.status = 'processing'
    try {
      const img = await loadImage(t.file)
      decoded.push(img)
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

  const g = Math.min(200, Math.max(0, Math.round(Number(gap.value) || 0)))
  const vertical = direction.value === 'vertical'
  const width = vertical
    ? Math.max(...decoded.map(img => img.naturalWidth))
    : decoded.reduce((sum, img) => sum + img.naturalWidth, 0) + g * (decoded.length - 1)
  const height = vertical
    ? decoded.reduce((sum, img) => sum + img.naturalHeight, 0) + g * (decoded.length - 1)
    : Math.max(...decoded.map(img => img.naturalHeight))

  if (width > MAX_CANVAS || height > MAX_CANVAS || width * height > MAX_AREA) {
    msgError(`拼接后尺寸 ${width}×${height} 超出浏览器画布限制，请减少图片数量或先缩小图片`)
    return
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, height)

  let offset = 0
  for (const img of decoded) {
    if (vertical) {
      ctx.drawImage(img, 0, offset)
      offset += img.naturalHeight + g
    } else {
      ctx.drawImage(img, offset, 0)
      offset += img.naturalWidth + g
    }
  }

  try {
    const blob = await canvasToBlob(canvas, 'image/png')
    downloadBlob(blob, `combined_${vertical ? 'vertical' : 'horizontal'}.png`)
    msgSuccess(`拼接完成（${width}×${height}）`)
  } catch (e) {
    msgError(`拼接失败：${e.message || e}`)
  }
}
</script>
