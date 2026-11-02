<template>
  <ToolPage
    ref="pageRef"
    title="PDF拆分"
    accept="application/pdf,.pdf"
    :validator="pdfValidator"
    :process-handler="processHandler"
    intro="按页码范围把 PDF 拆分成多个文件，例如输入 1-3,5 会拆出「1-3 页」和「第 5 页」两个 PDF。全部处理在浏览器本地完成。"
    usage="1. 添加一个或多个 PDF 文件。&#10;2. 在下方输入页码范围，逗号分隔，范围用短横线，例如 1-3,5。&#10;3. 点击「开始处理」，拆出的 PDF 会打包成 zip 下载（仅一个结果时直接下载）。"
  >
    <template #options>
      <div class="mt-4 option-panel">
        <div class="flex items-center flex-wrap" style="gap:12px">
          <span class="form-label">拆分范围</span>
          <input
            v-model="rangeText"
            class="el-input__inner"
            style="width:260px"
            type="text"
            placeholder="例如：1-3,5"
          />
        </div>
        <p class="mt-2" style="color:#909399;font-size:13px">
          每一段范围输出一个 PDF，如 1-3,5 会输出两个文件。超出总页数会给出错误提示。
        </p>
      </div>
    </template>
  </ToolPage>
</template>

<script setup>
import { ref } from 'vue'
import ToolPage from '../../components/ToolPage.vue'
import { pdfValidator, msgSuccess, msgError, baseName, downloadZip } from '../../lib/ui.js'
import { loadPdfDoc, copyPagesToNewDoc, parsePageGroups, pagesToLabel, pdfBlob } from '../../lib/pdf.js'

const pageRef = ref(null)
const rangeText = ref('1-3,5')

async function splitOne(file) {
  const { doc } = await loadPdfDoc(file)
  const total = doc.getPageCount()
  const { groups, error } = parsePageGroups(rangeText.value, total)
  if (error) throw new Error(error)
  if (!groups.length) throw new Error('请输入有效的页码范围')

  const outputs = []
  for (const group of groups) {
    const outDoc = await copyPagesToNewDoc(doc, group)
    const bytes = await outDoc.save()
    const label = pagesToLabel(group)
    outputs.push({
      blob: pdfBlob(bytes),
      name: `${baseName(file.name)}_${label}.pdf`
    })
  }
  return outputs
}

async function processHandler(tasks) {
  const outputs = []
  for (const t of tasks) {
    t.status = 'processing'
    try {
      const files = await splitOne(t.file)
      t.status = 'done'
      outputs.push(...files)
    } catch (e) {
      t.status = 'failed'
      t.error = e.message || String(e)
      msgError(`${t.file.name}：${t.error}`)
    }
  }
  if (outputs.length) {
    await downloadZip(outputs, 'split.zip')
    msgSuccess(`拆分完成，共 ${outputs.length} 个文件`)
  } else {
    msgError('没有可下载的结果')
  }
}
</script>
