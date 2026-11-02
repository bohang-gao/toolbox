<template>
  <ToolPage
    ref="pageRef"
    title="PDF加水印"
    accept="application/pdf,.pdf"
    :validator="pdfValidator"
    :process-handler="processHandler"
    intro="用 pdf-lib 给 PDF 添加文字水印，支持自定义内容、字号、透明度，并以 45° 斜向平铺到每一页。"
    usage="1. 添加一个或多个 PDF 文件。&#10;2. 输入水印文字，设置字号与透明度（平铺角度固定 45°）。&#10;3. 点击「开始处理」，每个文件输出加水印后的 PDF 并打包下载。&#10;提示：水印使用 Helvetica 字体，仅支持英文字母、数字与常用符号；中文会显示为空白，建议使用英文水印。"
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
            maxlength="60"
            placeholder="例如：CONFIDENTIAL"
          />
        </div>
        <div class="el-slider mt-2">
          <span class="form-label" style="flex-shrink:0;width:64px">透明度</span>
          <input v-model.number="opacity" type="range" min="5" max="100" />
          <span style="min-width:44px;text-align:right;color:#606266">{{ opacity }}%</span>
        </div>
        <div class="mt-2 flex items-center flex-wrap" style="gap:12px 20px">
          <span class="form-label">字号</span>
          <input v-model.number="fontSize" class="el-input__inner" style="width:110px" type="number" min="8" max="120" />
          <span style="color:#909399">pt</span>
          <span style="color:#909399;font-size:13px">平铺角度：45°</span>
        </div>
      </div>
    </template>
  </ToolPage>
</template>

<script setup>
import { ref } from 'vue'
import { StandardFonts, rgb, degrees } from 'pdf-lib'
import ToolPage from '../../components/ToolPage.vue'
import { pdfValidator, msgSuccess, msgError, baseName, downloadZip } from '../../lib/ui.js'
import { loadPdfDoc, pdfBlob, clampNumber } from '../../lib/pdf.js'

const pageRef = ref(null)
const text = ref('CONFIDENTIAL')
const fontSize = ref(36)
const opacity = ref(20)

async function watermarkOne(file) {
  const { doc } = await loadPdfDoc(file)
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const size = clampNumber(fontSize.value, 8, 120, 36)
  const alpha = clampNumber(opacity.value, 5, 100, 20) / 100
  const content = String(text.value || '').trim() || 'WATERMARK'
  const textWidth = font.widthOfTextAtSize(content, size)
  const color = rgb(0.5, 0.5, 0.5)

  for (const page of doc.getPages()) {
    const { width, height } = page.getSize()
    const stepX = Math.max(textWidth * 0.9, size * 4)
    const stepY = Math.max(size * 3, 80)
    const diag = Math.sqrt(width * width + height * height)

    for (let y = -diag / 2; y < height + diag / 2; y += stepY) {
      for (let x = -diag / 2; x < width + diag / 2; x += stepX) {
        page.drawText(content, {
          x,
          y,
          size,
          font,
          color,
          opacity: alpha,
          rotate: degrees(45)
        })
      }
    }
  }

  const bytes = await doc.save()
  return { blob: pdfBlob(bytes), name: `${baseName(file.name)}_watermark.pdf` }
}

async function processHandler(tasks) {
  const outputs = []
  for (const t of tasks) {
    t.status = 'processing'
    try {
      const out = await watermarkOne(t.file)
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
    await downloadZip(outputs, 'watermarked-pdf.zip')
    msgSuccess(`水印添加完成，共 ${outputs.length} 个文件`)
  } else {
    msgError('没有可下载的结果')
  }
}
</script>
