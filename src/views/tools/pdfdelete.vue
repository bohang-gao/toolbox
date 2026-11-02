<template>
  <ToolPage
    ref="pageRef"
    title="PDF删除页面"
    accept="application/pdf,.pdf"
    :validator="pdfValidator"
    :process-handler="processHandler"
    intro="删除 PDF 中指定的页码并输出新的 PDF，剩余页面保持原有顺序。例如输入 2,4-5 会删除第 2 页以及第 4、5 页。"
    usage="1. 添加一个或多个 PDF 文件。&#10;2. 输入要删除的页码，支持 2,4-5 这类写法。&#10;3. 点击「开始处理」，每个文件输出一个删除后的 PDF 并打包下载。&#10;注意：不能删除全部页面，至少需要保留一页。"
  >
    <template #options>
      <div class="mt-4 option-panel">
        <div class="flex items-center flex-wrap" style="gap:12px">
          <span class="form-label">删除页码</span>
          <input
            v-model="rangeText"
            class="el-input__inner"
            style="width:260px"
            type="text"
            placeholder="例如：2,4-5"
          />
        </div>
        <p class="mt-2" style="color:#909399;font-size:13px">
          输入的是要删除的页码（1 开始计数），其余页面按原顺序保留。
        </p>
      </div>
    </template>
  </ToolPage>
</template>

<script setup>
import { ref } from 'vue'
import ToolPage from '../../components/ToolPage.vue'
import { pdfValidator, msgSuccess, msgError, baseName, downloadZip } from '../../lib/ui.js'
import {
  loadPdfDoc, copyPagesToNewDoc, parsePageGroups, flattenGroups,
  pagesToLabel, pdfBlob
} from '../../lib/pdf.js'

const pageRef = ref(null)
const rangeText = ref('2,4-5')

async function deleteOne(file) {
  const { doc } = await loadPdfDoc(file)
  const total = doc.getPageCount()
  const { groups, error } = parsePageGroups(rangeText.value, total)
  if (error) throw new Error(error)
  const removed = flattenGroups(groups)
  if (!removed.length) throw new Error('请输入要删除的页码')
  if (removed.length >= total) throw new Error(`共 ${total} 页，不能删除全部页面`)

  const removedSet = new Set(removed)
  const keep = []
  for (let i = 0; i < total; i++) if (!removedSet.has(i)) keep.push(i)

  const outDoc = await copyPagesToNewDoc(doc, keep)
  const bytes = await outDoc.save()
  return {
    blob: pdfBlob(bytes),
    name: `${baseName(file.name)}_del_${pagesToLabel(removed)}.pdf`,
    count: keep.length
  }
}

async function processHandler(tasks) {
  const outputs = []
  for (const t of tasks) {
    t.status = 'processing'
    try {
      const out = await deleteOne(t.file)
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
    await downloadZip(outputs, 'deleted.zip')
    msgSuccess(`删除完成，共 ${outputs.length} 个文件`)
  } else {
    msgError('没有可下载的结果')
  }
}
</script>
