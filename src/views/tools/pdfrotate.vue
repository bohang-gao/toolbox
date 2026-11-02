<template>
  <ToolPage
    ref="pageRef"
    title="PDF旋转"
    accept="application/pdf,.pdf"
    :validator="pdfValidator"
    :process-handler="processHandler"
    intro="批量旋转 PDF 的全部页面，支持 90 / 180 / 270 度，使用 pdf-lib 设置页面旋转角度，输出新的 PDF。"
    usage="1. 添加一个或多个 PDF 文件。&#10;2. 选择旋转角度（顺时针）。&#10;3. 点击「开始处理」，每个文件输出旋转后的 PDF 并打包下载。&#10;提示：旋转角度会直接写入页面，常见的 PDF 阅读器均能正确显示。"
  >
    <template #options>
      <div class="mt-4 option-panel">
        <div class="flex items-center flex-wrap" style="gap:12px 20px">
          <span class="form-label">旋转角度</span>
          <label class="el-radio"><input v-model.number="angle" type="radio" :value="90" />顺时针 90°</label>
          <label class="el-radio"><input v-model.number="angle" type="radio" :value="180" />180°</label>
          <label class="el-radio"><input v-model.number="angle" type="radio" :value="270" />顺时针 270°</label>
        </div>
      </div>
    </template>
  </ToolPage>
</template>

<script setup>
import { ref } from 'vue'
import { degrees } from 'pdf-lib'
import ToolPage from '../../components/ToolPage.vue'
import { pdfValidator, msgSuccess, msgError, baseName, downloadZip } from '../../lib/ui.js'
import { loadPdfDoc, pdfBlob } from '../../lib/pdf.js'

const pageRef = ref(null)
const angle = ref(90)

async function rotateOne(file) {
  const { doc } = await loadPdfDoc(file)
  for (const page of doc.getPages()) {
    page.setRotation(degrees(Number(angle.value) || 90))
  }
  const bytes = await doc.save()
  return { blob: pdfBlob(bytes), name: `${baseName(file.name)}_rot${angle.value}.pdf` }
}

async function processHandler(tasks) {
  const outputs = []
  for (const t of tasks) {
    t.status = 'processing'
    try {
      const out = await rotateOne(t.file)
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
    await downloadZip(outputs, 'rotated-pdf.zip')
    msgSuccess(`旋转完成，共 ${outputs.length} 个文件`)
  } else {
    msgError('没有可下载的结果')
  }
}
</script>
