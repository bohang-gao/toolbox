<template>
  <ToolPage
    ref="pageRef"
    title="PDF压缩"
    accept="application/pdf,.pdf"
    :validator="pdfValidator"
    :process-handler="processHandler"
    intro="简化实现：使用 pdf-lib 重新加载并序列化 PDF（开启对象流压缩），去掉部分冗余结构。注意：这不等于图片重采样压缩，压缩率可能有限，对以图片为主的 PDF 往往效果不明显。"
    usage="1. 添加一个或多个 PDF 文件。&#10;2. 点击「开始处理」，任务列表会显示压缩前后的体积对比。&#10;3. 结果打包 zip 下载。&#10;说明：本工具只做结构级重新序列化，不做图片重采样；如需大幅压缩，请先把 PDF 转为图片压缩后再转回 PDF。"
  >
    <template #options>
      <div class="mt-4 option-panel">
        <p style="color:#606266">
          结构级压缩：重新序列化 PDF，启用对象流（Object Streams）与交叉引用流，移除未使用的对象。
        </p>
        <p class="mt-2" style="color:#909399;font-size:13px">
          如实说明：该实现不会对页面图片重新编码，因此压缩率可能有限，部分文件甚至可能略微变大。
        </p>
      </div>
    </template>
  </ToolPage>
</template>

<script setup>
import { ref } from 'vue'
import ToolPage from '../../components/ToolPage.vue'
import { pdfValidator, msgSuccess, msgError, baseName, downloadZip, formatSize } from '../../lib/ui.js'
import { loadPdfDoc, pdfBlob } from '../../lib/pdf.js'

const pageRef = ref(null)

async function compressOne(file) {
  const { doc } = await loadPdfDoc(file)
  const bytes = await doc.save({
    useObjectStreams: true,
    addDefaultPage: false,
    updateFieldAppearances: false
  })
  return { blob: pdfBlob(bytes), name: `${baseName(file.name)}_compressed.pdf`, original: file.size }
}

async function processHandler(tasks) {
  const outputs = []
  const ratios = []
  for (const t of tasks) {
    t.status = 'processing'
    try {
      const out = await compressOne(t.file)
      t.status = 'done'
      t.outSize = out.blob.size
      const ratio = out.original ? (1 - out.blob.size / out.original) * 100 : 0
      ratios.push(`${t.file.name}: ${formatSize(out.original)} → ${formatSize(out.blob.size)}（${ratio >= 0 ? '减小' : '增大'} ${Math.abs(ratio).toFixed(1)}%）`)
      outputs.push(out)
    } catch (e) {
      t.status = 'failed'
      t.error = e.message || String(e)
      msgError(`${t.file.name}：${e.message || e}`)
    }
  }
  if (outputs.length) {
    await downloadZip(outputs, 'compressed-pdf.zip')
    msgSuccess(`处理完成，共 ${outputs.length} 个文件；${ratios[0] || ''}`)
  } else {
    msgError('没有可下载的结果')
  }
}
</script>
