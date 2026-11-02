<template>
  <ToolPage
    ref="pageRef"
    title="PDF排序"
    accept="application/pdf,.pdf"
    :validator="pdfValidator"
    :process-handler="processHandler"
    intro="按指定顺序重新排列 PDF 页面，例如输入 3,1,2 会把第 3 页放到最前，第 1、2 页依次跟随。支持重复页码（用于插入重复页）。"
    usage="1. 添加一个或多个 PDF 文件。&#10;2. 输入新顺序，用逗号分隔，例如 3,1,2。&#10;3. 点击「开始处理」，每个文件输出重排后的 PDF 并打包下载。&#10;注意：必须给出全部页面的顺序（可重复），否则会提示页数不匹配。"
  >
    <template #options>
      <div class="mt-4 option-panel">
        <div class="flex items-center flex-wrap" style="gap:12px">
          <span class="form-label">新页序</span>
          <input
            v-model="orderText"
            class="el-input__inner"
            style="width:260px"
            type="text"
            placeholder="例如：3,1,2"
          />
        </div>
        <p class="mt-2" style="color:#909399;font-size:13px">
          页码从 1 开始；允许重复页码（会插入重复页），但页码总数需与原页数一致。
        </p>
      </div>
    </template>
  </ToolPage>
</template>

<script setup>
import { ref } from 'vue'
import ToolPage from '../../components/ToolPage.vue'
import { pdfValidator, msgSuccess, msgError, baseName, downloadZip } from '../../lib/ui.js'
import { loadPdfDoc, copyPagesToNewDoc, pdfBlob } from '../../lib/pdf.js'

const pageRef = ref(null)
const orderText = ref('3,1,2')

function parseOrder(text, total) {
  const tokens = String(text).replace(/[，、;；\s]+/g, ',').split(',').filter(Boolean)
  if (!tokens.length) throw new Error('请输入新的页序，例如 3,1,2')
  const order = tokens.map(tok => {
    if (!/^\d+$/.test(tok)) throw new Error(`无法识别「${tok}」，页码必须是正整数`)
    const n = Number(tok)
    if (n < 1 || n > total) throw new Error(`页码 ${n} 超出范围（共 ${total} 页）`)
    return n - 1
  })
  if (order.length !== total) {
    throw new Error(`页序数量 ${order.length} 与原页数 ${total} 不一致（重复页码也需要写全）`)
  }
  return order
}

async function sortOne(file) {
  const { doc } = await loadPdfDoc(file)
  const total = doc.getPageCount()
  const order = parseOrder(orderText.value, total)
  const outDoc = await copyPagesToNewDoc(doc, order)
  const bytes = await outDoc.save()
  return { blob: pdfBlob(bytes), name: `${baseName(file.name)}_sorted.pdf` }
}

async function processHandler(tasks) {
  const outputs = []
  for (const t of tasks) {
    t.status = 'processing'
    try {
      const out = await sortOne(t.file)
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
    await downloadZip(outputs, 'sorted.zip')
    msgSuccess(`排序完成，共 ${outputs.length} 个文件`)
  } else {
    msgError('没有可下载的结果')
  }
}
</script>
