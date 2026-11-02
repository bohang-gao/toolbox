<template>
  <ToolPage
    ref="pageRef"
    title="图片分割"
    accept="image/*"
    :validator="imageValidator"
    make-thumb
    :process-handler="processHandler"
    intro="按行 × 列网格把每张图片切割成若干小图，批量处理后可打包下载全部切片。"
    usage="1. 点击上传区或「添加文件」选择图片，支持多选。&#10;2. 设置行数与列数（例如 3×3 即九宫格切图）。&#10;3. 点击「开始处理」，所有切片会打包成 zip 下载（仅一个切片时直接下载）。"
  >
    <template #options>
      <div class="mt-4 option-panel">
        <div class="flex items-center flex-wrap" style="gap:12px 16px">
          <span class="form-label">分割行数</span>
          <input v-model.number="rows" class="el-input__inner" style="width:100px" type="number" min="1" max="20" />
          <span class="form-label">分割列数</span>
          <input v-model.number="cols" class="el-input__inner" style="width:100px" type="number" min="1" max="20" />
          <span style="color:#909399">每张图输出 {{ safeRows }}×{{ safeCols }} = {{ safeRows * safeCols }} 个切片</span>
        </div>
        <p class="mt-2" style="color:#909399;font-size:13px">
          切片按像素四舍五入均分，边缘切片自动补齐尺寸，输出为 PNG。
        </p>
      </div>
    </template>
  </ToolPage>
</template>

<script setup>
import { computed, ref } from 'vue'
import ToolPage from '../../components/ToolPage.vue'
import {
  imageValidator, loadImage, canvasToBlob, baseName,
  downloadZip, msgSuccess, msgError
} from '../../lib/ui.js'

const pageRef = ref(null)
const rows = ref(3)
const cols = ref(3)

const clampCount = (v) => Math.min(20, Math.max(1, Math.round(Number(v) || 1)))
const safeRows = computed(() => clampCount(rows.value))
const safeCols = computed(() => clampCount(cols.value))

async function splitOne(t) {
  const img = await loadImage(t.file)
  const r = safeRows.value
  const c = safeCols.value
  const w = img.naturalWidth
  const h = img.naturalHeight
  const tiles = []
  let total = 0

  for (let row = 0; row < r; row++) {
    const y1 = Math.round(row * h / r)
    const y2 = Math.round((row + 1) * h / r)
    for (let col = 0; col < c; col++) {
      const x1 = Math.round(col * w / c)
      const x2 = Math.round((col + 1) * w / c)
      const tw = x2 - x1
      const th = y2 - y1
      if (tw <= 0 || th <= 0) continue
      const canvas = document.createElement('canvas')
      canvas.width = tw
      canvas.height = th
      canvas.getContext('2d').drawImage(img, x1, y1, tw, th, 0, 0, tw, th)
      const blob = await canvasToBlob(canvas, 'image/png')
      total += blob.size
      tiles.push({
        blob,
        name: `${baseName(t.file.name)}_r${row + 1}c${col + 1}.png`
      })
    }
  }
  return { tiles, total }
}

async function processHandler(tasks) {
  const outputs = []
  for (const t of tasks) {
    t.status = 'processing'
    try {
      const { tiles, total } = await splitOne(t)
      if (!tiles.length) throw new Error('切片尺寸无效')
      t.status = 'done'
      t.outSize = total
      outputs.push(...tiles)
    } catch (e) {
      t.status = 'failed'
      t.error = e.message || String(e)
      msgError(`${t.file.name}：${t.error}`)
    }
  }
  if (outputs.length) {
    await downloadZip(outputs, 'split.zip')
    msgSuccess(`处理完成，共生成 ${outputs.length} 个切片`)
  } else {
    msgError('没有可下载的结果')
  }
}
</script>
