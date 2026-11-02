<template>
  <ToolPage
    ref="pageRef"
    title="PDF加页码"
    accept="application/pdf,.pdf"
    :validator="pdfValidator"
    :process-handler="processHandler"
    intro="用 pdf-lib 给 PDF 每一页绘制页码，支持底部居中 / 右下 / 顶部居中三种位置，可设置起始页码与字号。"
    usage="1. 添加一个或多个 PDF 文件。&#10;2. 选择页码位置、起始页码与字号。&#10;3. 点击「开始处理」，每个文件输出加好页码的 PDF 并打包下载。&#10;提示：起始页码设为 1 表示第一页显示 1；设为 5 表示第一页显示 5 并依次递增。"
  >
    <template #options>
      <div class="mt-4 option-panel">
        <div class="flex items-center flex-wrap" style="gap:12px 20px">
          <span class="form-label">页码位置</span>
          <select v-model="position" class="el-input__inner" style="width:150px">
            <option value="bottom-center">底部居中</option>
            <option value="bottom-right">右下角</option>
            <option value="top-center">顶部居中</option>
          </select>

          <span class="form-label">起始页码</span>
          <input v-model.number="start" class="el-input__inner" style="width:110px" type="number" min="0" max="100000" />

          <span class="form-label">字号</span>
          <input v-model.number="fontSize" class="el-input__inner" style="width:110px" type="number" min="6" max="72" />
        </div>
        <div class="mt-2 flex items-center flex-wrap" style="gap:12px 20px">
          <span class="form-label">页码格式</span>
          <label class="el-radio"><input v-model="format" type="radio" value="plain" />1, 2, 3</label>
          <label class="el-radio"><input v-model="format" type="radio" value="page" />第 1 页</label>
          <label class="el-radio"><input v-model="format" type="radio" value="slash" />1 / N</label>
        </div>
      </div>
    </template>
  </ToolPage>
</template>

<script setup>
import { ref } from 'vue'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import ToolPage from '../../components/ToolPage.vue'
import { pdfValidator, msgSuccess, msgError, baseName, downloadZip } from '../../lib/ui.js'
import { loadPdfDoc, pdfBlob, clampNumber } from '../../lib/pdf.js'

const pageRef = ref(null)
const position = ref('bottom-center')
const start = ref(1)
const fontSize = ref(12)
const format = ref('plain')

function labelOf(index, total) {
  const n = (Number(start.value) || 0) + index
  if (format.value === 'page') return `第 ${n} 页`
  if (format.value === 'slash') return `${n} / ${(Number(start.value) || 0) + total - 1}`
  return String(n)
}

async function addNumbers(file) {
  const { doc } = await loadPdfDoc(file)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const size = clampNumber(fontSize.value, 6, 72, 12)
  const pages = doc.getPages()
  const total = pages.length

  pages.forEach((page, i) => {
    const { width, height } = page.getSize()
    const text = labelOf(i, total)
    const textWidth = font.widthOfTextAtSize(text, size)
    const margin = Math.max(18, size * 1.6)
    let x
    let y
    if (position.value === 'bottom-right') {
      x = width - margin - textWidth
      y = margin
    } else if (position.value === 'top-center') {
      x = (width - textWidth) / 2
      y = height - margin - size
    } else {
      x = (width - textWidth) / 2
      y = margin
    }
    page.drawText(text, { x, y, size, font, color: rgb(0.2, 0.2, 0.2) })
  })

  const bytes = await doc.save()
  return { blob: pdfBlob(bytes), name: `${baseName(file.name)}_numbered.pdf`, pages: total }
}

async function processHandler(tasks) {
  const outputs = []
  for (const t of tasks) {
    t.status = 'processing'
    try {
      const out = await addNumbers(t.file)
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
    await downloadZip(outputs, 'numbered.zip')
    msgSuccess(`页码添加完成，共 ${outputs.length} 个文件`)
  } else {
    msgError('没有可下载的结果')
  }
}
</script>
