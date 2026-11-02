<template>
  <ToolPage
    ref="pageRef"
    title="PDF页面调整"
    accept="application/pdf,.pdf"
    :validator="pdfValidator"
    :process-handler="processHandler"
    intro="统一 PDF 所有页面的宽度：以目标宽度为基准等比缩放页面内容与高度，适合把宽窄不一的页面整理成统一规格。"
    usage="1. 添加一个或多个 PDF 文件。&#10;2. 选择目标宽度（A4/A3 等标准宽度，或自定义 pt）。&#10;3. 点击「开始处理」，每个文件输出页面宽度统一后的 PDF 并打包下载。&#10;提示：1 pt ≈ 1/72 英寸，A4 宽度 595 pt，A3 宽度 842 pt。"
  >
    <template #options>
      <div class="mt-4 option-panel">
        <div class="flex items-center flex-wrap" style="gap:12px 20px">
          <span class="form-label">目标宽度</span>
          <select v-model="preset" class="el-input__inner" style="width:190px" @change="onPreset">
            <option value="595">A4 宽度（595 pt）</option>
            <option value="842">A3 宽度（842 pt）</option>
            <option value="612">Letter 宽度（612 pt）</option>
            <option value="custom">自定义宽度</option>
          </select>
          <template v-if="preset === 'custom'">
            <input v-model.number="customWidth" class="el-input__inner" style="width:130px" type="number" min="100" max="5000" />
            <span style="color:#909399">pt</span>
          </template>
          <span style="color:#909399;font-size:13px">当前目标：{{ targetWidth }} pt</span>
        </div>
        <p class="mt-2" style="color:#909399;font-size:13px">
          页面高度按原比例同步缩放，内容不会变形；宽度已等于目标值的页面保持不变。
        </p>
      </div>
    </template>
  </ToolPage>
</template>

<script setup>
import { computed, ref } from 'vue'
import ToolPage from '../../components/ToolPage.vue'
import { pdfValidator, msgSuccess, msgError, baseName, downloadZip } from '../../lib/ui.js'
import { loadPdfDoc, pdfBlob, clampNumber } from '../../lib/pdf.js'

const pageRef = ref(null)
const preset = ref('595')
const customWidth = ref(700)

const targetWidth = computed(() => {
  if (preset.value === 'custom') return clampNumber(customWidth.value, 100, 5000, 595)
  return clampNumber(preset.value, 100, 5000, 595)
})

function onPreset() {
  // 切换预设时无需额外处理，targetWidth 自动更新
}

async function resizeOne(file) {
  const { doc } = await loadPdfDoc(file)
  const target = targetWidth.value

  for (const page of doc.getPages()) {
    const { width, height } = page.getSize()
    if (!width || !height) continue
    if (Math.abs(width - target) < 0.5) continue
    const scale = target / width
    page.scaleContent(scale, scale)
    page.setSize(target, height * scale)
  }

  const bytes = await doc.save()
  return { blob: pdfBlob(bytes), name: `${baseName(file.name)}_w${Math.round(target)}.pdf` }
}

async function processHandler(tasks) {
  const outputs = []
  for (const t of tasks) {
    t.status = 'processing'
    try {
      const out = await resizeOne(t.file)
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
    await downloadZip(outputs, 'resized-pdf.zip')
    msgSuccess(`页面调整完成，共 ${outputs.length} 个文件`)
  } else {
    msgError('没有可下载的结果')
  }
}
</script>
