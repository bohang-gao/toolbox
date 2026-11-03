<template>
  <ToolShell
    :path="route.path"
    title="批量打印"
    intro="把多个 PDF 与图片按列表顺序一次性打印，或导出为一个可打印的合并 PDF。所有处理均在浏览器本地完成，文件不会上传服务器。"
    :usage="[
      '点击上传区或「选择文件」添加 PDF / 图片（可多选、可分批添加），列表顺序即打印顺序，可用上移/下移调整。',
      '选择纸张、方向、每页份数与页边距；「每页份数」只影响图片，PDF 页面始终 1 页 1 张。',
      '「生成合并PDF」使用矢量复制/嵌入，保真度最高；「直接打印」会把 PDF 渲染为位图后调起系统打印对话框。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 添加文件</div>
      <div class="upload-zone" :class="{ 'is-drag': dragOver }"
           @click="addFiles" @dragover.prevent="dragOver = true" @dragleave="dragOver = false"
           @drop.prevent="onDrop">
        <i class="fa fa-cloud-upload uz-icon"></i>
        <div class="uz-main">点击或拖拽文件到此处</div>
        <div class="uz-sub">支持 PDF、JPG、PNG、WEBP、GIF、BMP，单文件 ≤50MB</div>
        <button type="button" class="uz-btn" :disabled="busy" @click.stop="addFiles">选择文件</button>
      </div>

      <div v-if="items.length" class="print-info mt-2">
        共 {{ items.length }} 项 · 预计 {{ estimate }} 页
      </div>

      <div v-if="items.length" class="task-list">
        <div v-for="(t, i) in items" :key="t.id" class="task-item">
          <span class="t-dot" :class="{ waiting: t.status !== 'failed', failed: t.status === 'failed' }"></span>
          <img v-if="t.thumb" :src="t.thumb" class="task-thumb" alt="" />
          <i v-else class="fa fa-file-pdf-o print-pdf-icon"></i>
          <span class="t-name">{{ t.file.name }}</span>
          <span class="print-type-tag" :class="t.kind">{{ typeLabel(t) }}</span>
          <span class="t-size">{{ formatSize(t.file.size) }}</span>
          <span v-if="t.status === 'reading'" class="t-status processing">读取中</span>
          <span v-else-if="t.status === 'failed'" class="t-status failed" :title="t.error">失败</span>
          <span class="print-actions">
            <button type="button" class="print-move-btn" title="上移" :disabled="i === 0 || busy" @click="move(i, -1)">
              <i class="fa fa-arrow-up"></i>
            </button>
            <button type="button" class="print-move-btn" title="下移" :disabled="i === items.length - 1 || busy" @click="move(i, 1)">
              <i class="fa fa-arrow-down"></i>
            </button>
            <span class="t-del" title="删除" @click="remove(i)">✕</span>
          </span>
        </div>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>2</b> 设置</div>
      <div class="option-panel">
        <div class="flex flex-wrap print-options">
          <label class="print-field">
            <span class="form-label">纸张</span>
            <select v-model="paper" class="el-input__inner">
              <option value="A4">A4（210×297mm）</option>
              <option value="A3">A3（297×420mm）</option>
              <option value="Letter">Letter（215.9×279.4mm）</option>
              <option value="B5">B5（176×250mm）</option>
            </select>
          </label>
          <label class="print-field">
            <span class="form-label">方向</span>
            <select v-model="orientation" class="el-input__inner">
              <option value="portrait">纵向</option>
              <option value="landscape">横向</option>
            </select>
          </label>
          <label class="print-field">
            <span class="form-label">每页份数</span>
            <select v-model.number="copies" class="el-input__inner">
              <option :value="1">1 份 / 页</option>
              <option :value="2">2 份 / 页</option>
              <option :value="4">4 份 / 页</option>
            </select>
          </label>
          <label class="print-field">
            <span class="form-label">页边距</span>
            <select v-model.number="margin" class="el-input__inner">
              <option :value="0">0 mm</option>
              <option :value="6">6 mm</option>
              <option :value="12">12 mm</option>
              <option :value="20">20 mm</option>
            </select>
          </label>
          <label class="print-field">
            <span class="form-label">图片缩放</span>
            <select v-model="imageScale" class="el-input__inner">
              <option value="fit">适应页面</option>
              <option value="original">原始尺寸居中</option>
            </select>
          </label>
        </div>
        <p class="mt-2" style="color:#9ca3af;font-size:13px">
          PDF 页面按原尺寸 1 页 1 张复制；仅图片按「每页份数」拼版。直接打印为位图渲染，文本型 PDF 建议先「生成合并PDF」再打印以保真。
        </p>
      </div>
    </div>

    <div class="step-actions">
      <button type="button" class="el-button el-button--primary" :disabled="busy" @click="generatePdf">
        <span><i class="fa fa-file-pdf-o mr-1"></i> 生成合并PDF</span>
      </button>
      <button type="button" class="el-button el-button--primary" :disabled="busy" @click="doPrint">
        <span v-if="!printing"><i class="fa fa-print mr-1"></i> 直接打印</span>
        <span v-else><i class="fa fa-spinner fa-spin mr-1"></i> 正在准备打印…（共 {{ estimate }} 页）</span>
      </button>
      <button type="button" class="el-button el-button--info" :disabled="busy || !items.length" @click="clearAll">
        <span><i class="fa fa-trash-o mr-1"></i> 清空任务</span>
      </button>
    </div>

    <div class="print-about">
      <h3><i class="fa fa-info-circle"></i> 打印相关说明</h3>
      <p>浏览器安全模型<strong>不允许网页读取或枚举系统打印机</strong>，打印机列表只会出现在点击「继续打印」后弹出的系统打印窗口中。网页无法直接列出打印机列表。</p>
      <p>如果打印窗口里没有实体打印机、只能看到「另存为 PDF」，说明当前设备未安装可用打印机。可先用「生成合并PDF」导出文件，再在任意设备上打印。</p>
    </div>

    <!-- 打印前确认模态：选择打印机只能在系统打印窗口完成，这里先汇总设置 -->
    <div v-if="confirmOpen" class="print-confirm" role="dialog" aria-modal="true"
         aria-labelledby="print-confirm-title" @click.self="cancelConfirm">
      <div class="print-confirm__card">
        <h3 id="print-confirm-title" class="print-confirm__title">准备打印 · 共 {{ confirmInfo.pages }} 页</h3>
        <dl class="print-confirm__summary">
          <div><dt>纸张</dt><dd>{{ confirmInfo.paper }}</dd></div>
          <div><dt>方向</dt><dd>{{ confirmInfo.orientation }}</dd></div>
          <div><dt>每页份数</dt><dd>{{ confirmInfo.copies }}</dd></div>
          <div><dt>边距</dt><dd>{{ confirmInfo.margin }}mm</dd></div>
          <div><dt>文件数</dt><dd>{{ confirmInfo.files }}</dd></div>
        </dl>
        <div class="print-confirm__hint">
          <i class="fa fa-info-circle"></i>
          <span>下一步会打开<strong>系统打印窗口</strong>，在那里选择打印机、份数、是否双面。网页无法直接列出打印机列表。</span>
        </div>
        <div v-if="rendering" class="print-confirm__progress">
          <div class="print-confirm__progress-text">
            <span>正在准备打印 · 第 {{ progress.current }}/{{ progress.total }} 页</span>
            <span v-if="cancellable" class="print-confirm__cancel" role="button" tabindex="0"
                  @click="cancelRendering" @keydown.enter="cancelRendering">取消准备</span>
          </div>
          <div class="print-confirm__bar"><span :style="{ width: progressPct + '%' }"></span></div>
          <p v-if="cancellable" class="print-confirm__slow">准备已超过 30 秒，可点击「取消准备」放弃本次打印。</p>
        </div>
        <div class="print-confirm__actions">
          <button type="button" class="el-button" :disabled="rendering" @click="cancelConfirm">取消</button>
          <button type="button" class="el-button el-button--primary" :disabled="rendering" @click="beginPrint">
            <span v-if="!rendering"><i class="fa fa-print mr-1"></i> 继续打印</span>
            <span v-else><i class="fa fa-spinner fa-spin mr-1"></i> 正在准备…</span>
          </button>
        </div>
        <button type="button" class="print-confirm__pdf-link" :disabled="rendering" @click="exportFromConfirm">
          没有打印机？导出 PDF
        </button>
      </div>
    </div>
  </ToolShell>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { PDFDocument } from 'pdf-lib'
import ToolShell from '../../components/ToolShell.vue'
import {
  MAX_SIZE, formatSize, loadImage, msgError, msgSuccess, downloadBlob,
  validate, pickFiles, canvasToBlob, baseName
} from '../../lib/ui.js'
import { loadPdfDoc } from '../../lib/pdf.js'
import { openPdf, renderPageToCanvas, closePdf } from '../../lib/pdf-render.js'

const route = useRoute()

const PAPER_SIZES = {
  A4: { w: 210, h: 297 },
  A3: { w: 297, h: 420 },
  Letter: { w: 215.9, h: 279.4 },
  B5: { w: 176, h: 250 }
}
const CSS_PAGE_NAME = { A4: 'A4', A3: 'A3', Letter: 'letter', B5: 'B5' }
const MM_TO_PT = 72 / 25.4
const RENDER_TIMEOUT = 30000

const items = reactive([])
const dragOver = ref(false)
const paper = ref('A4')
const orientation = ref('portrait')
const copies = ref(1)
const margin = ref(12)
const imageScale = ref('fit')
const generating = ref(false)
const printing = ref(false)
const busy = computed(() => generating.value || printing.value)
const estimate = computed(() => buildJobs(items, copies.value).length)

/* 打印前确认层 */
const confirmOpen = ref(false)
const phase = ref('confirm') // confirm | rendering
const confirmInfo = reactive({ pages: 0, paper: 'A4', orientation: '纵向', copies: 1, margin: 12, files: 0 })
const progress = reactive({ current: 0, total: 0 })
const elapsed = ref(0)
const cancelRequested = ref(false)
const rendering = computed(() => phase.value === 'rendering')
const cancellable = computed(() => rendering.value && elapsed.value >= 30)
const progressPct = computed(() => progress.total
  ? Math.min(100, Math.round((progress.current / progress.total) * 100))
  : 0)

const ORIENTATION_LABEL = { portrait: '纵向', landscape: '横向' }
const CANCEL_MARK = '__print_cancelled__'
const NO_CONTENT_MARK = '__print_no_content__'
let ticker = null

let seq = 0

/* ---------- 文件添加与列表 ---------- */
const IMG_RE = /\.(jpe?g|png|webp|gif|bmp)$/i
const IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/x-ms-bmp']

function fileValidator(f) {
  const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
  if (!isPdf) {
    const isImg = IMG_TYPES.includes(f.type) || IMG_RE.test(f.name)
    if (!isImg) return '仅支持 PDF 或图片文件（JPG/PNG/WEBP/GIF/BMP）'
  }
  if (f.size > MAX_SIZE) return '文件超过 50MB 限制'
  return null
}

function typeLabel(t) {
  if (t.kind === 'pdf') return t.pages ? `PDF · ${t.pages}页` : 'PDF'
  const ext = (t.file.name.match(/\.([^.]+)$/) || [])[1]
  return ext ? ext.toUpperCase() : '图片'
}

function pushFiles(files) {
  const added = []
  for (const f of files) {
    const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    const item = reactive({
      id: ++seq,
      file: f,
      kind: isPdf ? 'pdf' : 'image',
      pages: 0,
      status: isPdf ? 'reading' : 'done',
      error: '',
      thumb: isPdf ? '' : URL.createObjectURL(f)
    })
    items.push(item)
    added.push(item)
  }
  for (const it of added) {
    if (it.kind === 'pdf') readPdfPages(it)
  }
}

async function readPdfPages(it) {
  try {
    const doc = await withTimeout(openPdf(it.file), RENDER_TIMEOUT, 'PDF 解析超时（30 秒）')
    it.pages = doc.numPages
    it.status = 'done'
    await closePdf(doc)
  } catch (e) {
    it.status = 'failed'
    it.error = e.message || String(e)
    msgError(`${it.file.name}：${it.error}`)
  }
}

async function addFiles() {
  if (busy.value) return
  const files = await pickFiles({ accept: '.pdf,application/pdf,image/*', multiple: true, validator: fileValidator })
  if (files.length) pushFiles(files)
}

function onDrop(e) {
  dragOver.value = false
  if (busy.value) return
  const files = Array.from(e.dataTransfer.files || [])
  const ok = validate(files, fileValidator)
  if (ok.length) pushFiles(ok)
}

function move(i, delta) {
  const j = i + delta
  if (j < 0 || j >= items.length || busy.value) return
  const [it] = items.splice(i, 1)
  items.splice(j, 0, it)
}

function remove(i) {
  if (busy.value) return
  const [it] = items.splice(i, 1)
  if (it.thumb) URL.revokeObjectURL(it.thumb)
}

function clearAll() {
  for (const it of items) if (it.thumb) URL.revokeObjectURL(it.thumb)
  items.splice(0)
}

onBeforeUnmount(() => {
  stopTicker()
  clearAll()
})

/* ---------- 版面计算 ---------- */
function sheetSize() {
  const p = PAPER_SIZES[paper.value] || PAPER_SIZES.A4
  return orientation.value === 'landscape' ? { w: p.h, h: p.w } : { w: p.w, h: p.h }
}

function cellsFor(n, sheet) {
  if (n <= 1) return { cols: 1, rows: 1 }
  if (n === 2) return sheet.w > sheet.h ? { cols: 2, rows: 1 } : { cols: 1, rows: 2 }
  return { cols: 2, rows: 2 }
}

function cellSize(sheet, m, cols, rows) {
  return {
    cw: (sheet.w - 2 * m - (cols - 1) * m) / cols,
    ch: (sheet.h - 2 * m - (rows - 1) * m) / rows
  }
}

// 打印/导出任务序列：PDF 每页一项，图片按份数分组
function buildJobs(list, n) {
  const jobs = []
  let group = []
  const flush = () => {
    if (group.length) { jobs.push({ kind: 'image', items: group }); group = [] }
  }
  for (const it of list) {
    if (it.status === 'failed') continue
    if (it.kind === 'pdf') {
      flush()
      for (let p = 0; p < (it.pages || 0); p++) jobs.push({ kind: 'pdf', item: it, page: p })
    } else {
      group.push(it)
      if (group.length >= n) flush()
    }
  }
  flush()
  return jobs
}

/* ---------- 通用 ---------- */
function withTimeout(promise, ms, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e) => { clearTimeout(timer); reject(e) }
    )
  })
}

function firstBaseName(list) {
  return list.length ? baseName(list[0].file.name) : 'print'
}

function reportFailures(failures) {
  if (!failures.length) return
  setTimeout(() => msgError(`处理失败：${failures.join('、')}`), 2600)
}

/* ---------- 动作 1：生成合并 PDF ---------- */
async function embedImageItem(pdfDoc, it) {
  const img = await withTimeout(loadImage(it.file), RENDER_TIMEOUT, '图片解码超时（30 秒）')
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0)
  const blob = await withTimeout(canvasToBlob(canvas, 'image/jpeg', 0.92), RENDER_TIMEOUT, '图片编码超时（30 秒）')
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const embedded = await pdfDoc.embedJpg(bytes)
  return { embedded, iw: embedded.width, ih: embedded.height }
}

function placeOnCell(page, entry, cellX, cellY, cellW, cellH) {
  let drawW
  let drawH
  if (imageScale.value === 'original') {
    drawW = entry.iw * 0.75
    drawH = entry.ih * 0.75
    const clamp = Math.min(1, cellW / drawW, cellH / drawH)
    drawW *= clamp
    drawH *= clamp
  } else {
    const s = Math.min(cellW / entry.iw, cellH / entry.ih)
    drawW = entry.iw * s
    drawH = entry.ih * s
  }
  page.drawImage(entry.embedded, {
    x: cellX + (cellW - drawW) / 2,
    y: cellY + (cellH - drawH) / 2,
    width: drawW,
    height: drawH
  })
}

async function generatePdf(opts = {}) {
  if (!items.length) { msgError('请先添加文件'); return }
  if (busy.value) return
  if (items.some(t => t.status === 'reading')) { msgError('正在读取 PDF 页数，请稍候'); return }

  generating.value = true
  const failures = alreadyFailedNames()
  const pdfCache = new Map()
  const imgCache = new Map()
  let out = null
  let pages = 0
  try {
    out = await PDFDocument.create()
    const jobs = buildJobs(items, copies.value)

    for (const job of jobs) {
      if (job.kind === 'pdf') {
        const it = job.item
        try {
          let src = pdfCache.get(it.id)
          if (!src) {
            src = (await withTimeout(loadPdfDoc(it.file), RENDER_TIMEOUT, 'PDF 解析超时（30 秒）')).doc
            pdfCache.set(it.id, src)
          }
          const [p] = await out.copyPages(src, [job.page])
          out.addPage(p)
        } catch (e) {
          if (!failures.includes(it.file.name)) failures.push(it.file.name)
          it.status = 'failed'
          it.error = e.message || String(e)
        }
        continue
      }

      // 图片分组：一张纸放一组
      const entries = []
      for (const it of job.items) {
        try {
          let entry = imgCache.get(it.id)
          if (!entry) {
            entry = await embedImageItem(out, it)
            imgCache.set(it.id, entry)
          }
          entries.push(entry)
        } catch (e) {
          if (!failures.includes(it.file.name)) failures.push(it.file.name)
          it.status = 'failed'
          it.error = e.message || String(e)
        }
      }
      if (!entries.length) continue

      const sheet = sheetSize()
      const page = out.addPage([sheet.w * MM_TO_PT, sheet.h * MM_TO_PT])
      const m = margin.value
      // 最后一批不足份数时按实际数量排版，避免图片挤在角落
      const { cols, rows } = cellsFor(entries.length, sheet)
      const { cw, ch } = cellSize(sheet, m, cols, rows)
      entries.forEach((entry, idx) => {
        const col = idx % cols
        const row = Math.floor(idx / cols)
        const x = (m + col * (cw + m)) * MM_TO_PT
        const y = (sheet.h - m - row * (ch + m) - ch) * MM_TO_PT
        placeOnCell(page, entry, x, y, cw * MM_TO_PT, ch * MM_TO_PT)
      })
    }

    pages = out.getPageCount()
    if (!pages) {
      msgError(failures.length >= items.length
        ? '所有文件均处理失败，无法导出 PDF'
        : '没有可打印的内容')
      return
    }
    const bytes = await out.save()
    downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${firstBaseName(items)}_print.pdf`)
    msgSuccess(opts.doneText ? opts.doneText(pages) : `已生成 ${pages} 页可打印 PDF`)
    reportFailures(failures)
  } catch (e) {
    console.error(e)
    msgError(`生成失败：${e.message || e}`)
  } finally {
    generating.value = false
  }
}

/* ---------- 打印前确认层 ---------- */
function startTicker() {
  stopTicker()
  elapsed.value = 0
  ticker = setInterval(() => { elapsed.value += 1 }, 1000)
}

function stopTicker() {
  if (ticker) { clearInterval(ticker); ticker = null }
}

function closeConfirm() {
  confirmOpen.value = false
  phase.value = 'confirm'
  stopTicker()
}

function cancelConfirm() {
  if (rendering.value) return
  closeConfirm()
}

function cancelRendering() {
  if (!rendering.value) return
  cancelRequested.value = true
}

// 「直接打印」不立刻调用 window.print：先汇总设置并说明打印机只在系统窗口中可选
function doPrint() {
  if (!items.length) { msgError('请先添加文件'); return }
  if (busy.value || confirmOpen.value) return
  if (items.some(t => t.status === 'reading')) { msgError('正在读取 PDF 页数，请稍候'); return }

  const total = buildJobs(items, copies.value).length
  if (!total) {
    msgError(items.length && items.every(t => t.status === 'failed')
      ? '所有文件均处理失败，已取消打印'
      : '没有可打印的内容，已取消打印')
    return
  }

  confirmInfo.pages = total
  confirmInfo.paper = paper.value
  confirmInfo.orientation = ORIENTATION_LABEL[orientation.value] || '纵向'
  confirmInfo.copies = copies.value
  confirmInfo.margin = margin.value
  confirmInfo.files = items.length
  progress.current = 0
  progress.total = total
  elapsed.value = 0
  cancelRequested.value = false
  phase.value = 'confirm'
  confirmOpen.value = true
}

// 「没有打印机？导出 PDF」：复用合并 PDF 逻辑，直接下载
async function exportFromConfirm() {
  if (rendering.value) return
  closeConfirm()
  await generatePdf({ doneText: (pages) => `已导出 PDF，可在任意设备打印（共 ${pages} 页）` })
}

/* ---------- 动作 2：直接打印 ---------- */
function buildPrintCss() {
  const sheet = sheetSize()
  const m = margin.value
  const paperName = CSS_PAGE_NAME[paper.value] || 'A4'
  return `
@page{size:${paperName} ${orientation.value};margin:0}
.print-sheet{width:${sheet.w}mm;height:${sheet.h}mm;display:flex;flex-wrap:wrap;align-content:center;justify-content:center;gap:${m}mm;page-break-after:always;break-after:page;background:#fff;overflow:hidden}
.print-sheet:last-child{page-break-after:auto;break-after:auto}
.print-sheet img{display:block;object-fit:contain;max-width:calc(100% - ${2 * m}mm);max-height:calc(100% - ${2 * m}mm)}
@media print{
  html,body{overflow:visible!important;height:auto!important;margin:0!important;padding:0!important;background:#fff!important}
  body>*:not(.print-root){display:none!important}
  .print-root{position:static!important;left:auto!important;top:auto!important;margin:0!important;padding:0!important;z-index:auto!important}
}
`
}

function createSheet() {
  const sheet = sheetSize()
  const el = document.createElement('div')
  el.className = 'print-sheet'
  el.style.width = `${sheet.w}mm`
  el.style.height = `${sheet.h}mm`
  el.style.gap = `${margin.value}mm`
  return el
}

function addImgToSheet(sheetEl, src, cellW, cellH, itemId) {
  const img = document.createElement('img')
  img.src = src
  img.style.maxWidth = `${cellW}mm`
  img.style.maxHeight = `${cellH}mm`
  if (itemId != null) img.dataset.itemId = String(itemId)
  sheetEl.appendChild(img)
  return img
}

async function renderPdfPageToDataUrl(doc, pageNo) {
  const page = await withTimeout(doc.getPage(pageNo), RENDER_TIMEOUT, 'PDF 页面读取超时（30 秒）')
  const { canvas } = await withTimeout(renderPageToCanvas(page, 2), RENDER_TIMEOUT, 'PDF 渲染超时（30 秒），已中断')
  page.cleanup()
  return canvas.toDataURL('image/jpeg', 0.92)
}

function waitForImages(root) {
  const imgs = Array.from(root.querySelectorAll('img'))
  return withTimeout(Promise.all(imgs.map((img) => new Promise((resolve) => {
    if (img.complete && img.naturalWidth > 0) { resolve(); return }
    img.addEventListener('load', () => resolve(), { once: true })
    img.addEventListener('error', () => {
      img.dataset.failed = '1'
      resolve()
    }, { once: true })
  }))), RENDER_TIMEOUT, '图片加载超时（30 秒），已中断')
}

function waitAfterPrint() {
  return new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      window.removeEventListener('afterprint', finish)
      resolve()
    }
    window.addEventListener('afterprint', finish, { once: true })
    // 打印被拦截/覆盖时 afterprint 不会触发，延时兜底清理
    setTimeout(finish, 1200)
  })
}

// 打印前已失败的项在总结里统一说明
function alreadyFailedNames() {
  return items.filter((it) => it.status === 'failed').map((it) => it.file.name)
}

async function beginPrint() {
  if (rendering.value || busy.value) return
  if (items.some(t => t.status === 'reading')) { msgError('正在读取 PDF 页数，请稍候'); return }

  const jobs = buildJobs(items, copies.value)
  if (!jobs.length) {
    closeConfirm()
    msgError('所有文件均处理失败，已取消打印')
    return
  }

  phase.value = 'rendering'
  printing.value = true
  cancelRequested.value = false
  progress.current = 0
  progress.total = jobs.length
  startTicker()

  const failures = alreadyFailedNames()
  const pdfCache = new Map()
  const styleEl = document.createElement('style')
  styleEl.id = 'print-style'
  styleEl.textContent = buildPrintCss()
  document.head.appendChild(styleEl)
  const root = document.createElement('div')
  root.className = 'print-root'
  document.body.appendChild(root)
  const prevOverflow = document.body.style.overflow

  try {
    const sheet = sheetSize()
    const m = margin.value

    for (const job of jobs) {
      if (cancelRequested.value) throw new Error(CANCEL_MARK)
      if (job.kind === 'pdf') {
        const it = job.item
        try {
          let doc = pdfCache.get(it.id)
          if (!doc) {
            doc = await withTimeout(openPdf(it.file), RENDER_TIMEOUT, 'PDF 解析超时（30 秒）')
            pdfCache.set(it.id, doc)
          }
          const src = await renderPdfPageToDataUrl(doc, job.page + 1)
          const sheetEl = createSheet()
          addImgToSheet(sheetEl, src, sheet.w - 2 * m, sheet.h - 2 * m, it.id)
          root.appendChild(sheetEl)
        } catch (e) {
          if (!failures.includes(it.file.name)) failures.push(it.file.name)
          it.status = 'failed'
          it.error = e.message || String(e)
        }
        progress.current += 1
        continue
      }

      const live = job.items.filter((it) => it.status !== 'failed')
      if (live.length) {
        // 最后一批不足份数时按实际数量排版，避免图片挤在角落
        const { cols, rows } = cellsFor(live.length, sheet)
        const { cw, ch } = cellSize(sheet, m, cols, rows)
        const sheetEl = createSheet()
        for (const it of live) {
          const src = it.thumb || URL.createObjectURL(it.file)
          addImgToSheet(sheetEl, src, cw, ch, it.id)
        }
        root.appendChild(sheetEl)
      }
      progress.current += 1
    }

    // 某项失败不阻断其它项；全部失败则不进入打印
    await waitForImages(root)
    if (cancelRequested.value) throw new Error(CANCEL_MARK)

    // 移除加载失败的图片与空纸
    root.querySelectorAll('img[data-failed="1"]').forEach((img) => {
      const id = Number(img.dataset.itemId)
      const it = items.find((x) => x.id === id)
      if (it && !failures.includes(it.file.name)) {
        failures.push(it.file.name)
        it.status = 'failed'
        it.error = '图片解码失败'
      }
      img.remove()
    })
    root.querySelectorAll('.print-sheet').forEach((s) => { if (!s.children.length) s.remove() })

    if (!root.querySelector('.print-sheet')) throw new Error(NO_CONTENT_MARK)

    if (failures.length) reportFailures(failures)

    // 渲染完成，关闭确认层后进入系统打印窗口（等 DOM 更新完再调 print）
    closeConfirm()
    await nextTick()
    document.body.style.overflow = 'hidden'
    window.print()
    await waitAfterPrint()
    msgSuccess('已完成打印设置')
  } catch (e) {
    if (e.message === CANCEL_MARK) {
      msgError('已取消打印准备，未打开打印窗口')
    } else if (e.message === NO_CONTENT_MARK) {
      msgError(failures.length >= items.length
        ? '所有文件均处理失败，已取消打印'
        : '没有可打印的内容，已取消打印')
    } else {
      console.error(e)
      msgError(`打印准备失败：${e.message || e}`)
    }
  } finally {
    stopTicker()
    for (const doc of pdfCache.values()) closePdf(doc)
    root.remove()
    styleEl.remove()
    document.body.style.overflow = prevOverflow
    printing.value = false
    if (confirmOpen.value) closeConfirm()
  }
}
</script>
