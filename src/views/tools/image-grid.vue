<template>
  <ToolPage
    ref="pageRef"
    title="宫格拼图"
    accept="image/*"
    :validator="imageValidator"
    make-thumb
    :process-handler="processHandler"
    intro="把多张图片按 2×2 / 3×3 / 4×4 的网格拼成一张拼图，可自定义格子间距与背景色，全部在浏览器本地合成。"
    usage="1. 点击上传区或「添加文件」选择图片，顺序即网格填充顺序（从左到右、从上到下）。&#10;2. 选择网格规格，设置间距与背景色。&#10;3. 点击「开始处理」，生成拼图并下载；图片数量超过一个网格时，会按顺序生成多张拼图并打包 zip。&#10;提示：图片在格子内等比缩放并居中，空白区域显示背景色。"
  >
    <template #options>
      <div class="mt-4 option-panel">
        <div class="flex items-center flex-wrap" style="gap:12px 20px">
          <span class="form-label">网格规格</span>
          <label class="el-radio"><input v-model.number="gridSize" type="radio" :value="2" />2 × 2</label>
          <label class="el-radio"><input v-model.number="gridSize" type="radio" :value="3" />3 × 3</label>
          <label class="el-radio"><input v-model.number="gridSize" type="radio" :value="4" />4 × 4</label>
        </div>
        <div class="mt-2 flex items-center flex-wrap" style="gap:12px 20px">
          <span class="form-label">格子间距</span>
          <input v-model.number="gap" class="el-input__inner" style="width:110px" type="number" min="0" max="200" />
          <span style="color:#909399">px</span>

          <span class="form-label">背景色</span>
          <input v-model="bgColor" type="color" style="width:48px;height:32px;border:1px solid #dcdfe6;border-radius:4px;cursor:pointer;padding:2px" />
          <span style="color:#909399">{{ bgColor }}</span>
        </div>
        <p class="mt-2" style="color:#909399;font-size:13px">
          每个格子大小取本组图片的最大宽高；图片等比缩放居中，不裁剪。
        </p>
      </div>
    </template>
  </ToolPage>
</template>

<script setup>
import { ref } from 'vue'
import ToolPage from '../../components/ToolPage.vue'
import {
  imageValidator, loadImage, canvasToBlob, downloadZip,
  msgSuccess, msgError
} from '../../lib/ui.js'

const pageRef = ref(null)
const gridSize = ref(3)
const gap = ref(8)
const bgColor = ref('#ffffff')

const MAX_CANVAS = 32767
const MAX_AREA = 268000000

function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

async function renderGrid(imgs, index) {
  const n = gridSize.value
  const g = Math.min(200, Math.max(0, Math.round(Number(gap.value) || 0)))
  const cellW = Math.max(...imgs.map(img => img.naturalWidth))
  const cellH = Math.max(...imgs.map(img => img.naturalHeight))
  const width = n * cellW + g * (n - 1)
  const height = n * cellH + g * (n - 1)

  if (width > MAX_CANVAS || height > MAX_CANVAS || width * height > MAX_AREA) {
    throw new Error(`拼图尺寸 ${width}×${height} 超出浏览器画布限制，请减少网格数或缩小图片`)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = bgColor.value || '#ffffff'
  ctx.fillRect(0, 0, width, height)

  imgs.forEach((img, i) => {
    const col = i % n
    const row = Math.floor(i / n)
    const cellX = col * (cellW + g)
    const cellY = row * (cellH + g)
    const scale = Math.min(cellW / img.naturalWidth, cellH / img.naturalHeight)
    const w = img.naturalWidth * scale
    const h = img.naturalHeight * scale
    ctx.drawImage(img, cellX + (cellW - w) / 2, cellY + (cellH - h) / 2, w, h)
  })

  const blob = await canvasToBlob(canvas, 'image/png')
  return { blob, name: `grid_${index + 1}.png` }
}

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

  const cells = gridSize.value * gridSize.value
  const groups = chunk(decoded, cells)
  const outputs = []
  for (let i = 0; i < groups.length; i++) {
    try {
      outputs.push(await renderGrid(groups[i], i))
    } catch (e) {
      msgError(e.message || String(e))
    }
  }

  if (!outputs.length) {
    msgError('拼图生成失败')
    return
  }

  await downloadZip(outputs, 'grid.zip')
  msgSuccess(`拼图完成，共 ${outputs.length} 张`)
}
</script>
