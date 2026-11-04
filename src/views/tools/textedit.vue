<template>
  <ToolPage
    ref="pageRef"
    title="图片改字"
    accept="image/*"
    :multiple="false"
    :validator="imageValidator"
    make-thumb
    :process-handler="processHandler"
    :intro="intro"
    :usage="usage"
  >
    <template #options>
      <div class="mt-4 option-panel">
        <div class="flex items-center flex-wrap" style="gap:10px 14px">
          <span class="form-label">修复方式</span>
          <div class="idphoto-tabs">
            <button
              type="button"
              class="idphoto-tab"
              :class="{ 'is-active': repairMode === 'ai' }"
              @click="repairMode = 'ai'"
            >AI 修复（推荐）</button>
            <button
              type="button"
              class="idphoto-tab"
              :class="{ 'is-active': repairMode === 'classic' }"
              @click="repairMode = 'classic'"
            >经典修复（快速）</button>
          </div>
          <span class="idphoto-hint">AI 首次需加载 28.1MB 模型（本地自托管）</span>
        </div>

        <div class="flex items-center flex-wrap mt-2" style="gap:10px 14px">
          <span class="form-label">新文字</span>
          <input
            v-model="text"
            class="el-input__inner"
            style="width:300px"
            type="text"
            maxlength="80"
            placeholder="输入要替换成的文字"
          />
        </div>

        <div class="flex items-center flex-wrap mt-2" style="gap:10px 14px">
          <span class="form-label">字体</span>
          <select v-model="fontFamily" class="el-input__inner" style="width:150px">
            <option v-for="f in FONTS" :key="f.id" :value="f.id">{{ f.name }}</option>
          </select>

          <span class="form-label">粗细</span>
          <label class="el-radio"><input v-model="bold" type="checkbox" />加粗</label>

          <span class="form-label">对齐</span>
          <select v-model="align" class="el-input__inner" style="width:90px">
            <option value="left">左</option>
            <option value="center">中</option>
            <option value="right">右</option>
          </select>

          <span class="form-label">旋转</span>
          <input v-model.number="angle" class="el-input__inner" style="width:90px" type="number" min="-45" max="45" />
          <span class="te-unit">°</span>
        </div>

        <div class="el-slider mt-2">
          <span class="form-label" style="flex-shrink:0;width:84px">字号</span>
          <input v-model.number="sizeScale" type="range" min="50" max="150" step="1" />
          <span class="te-value">{{ fontSizePx }} px（{{ sizeScale }}%）</span>
        </div>

        <div class="flex items-center flex-wrap mt-2" style="gap:10px 14px">
          <span class="form-label">字色</span>
          <input v-model="color" type="color" class="idphoto-color" title="文字颜色" @input="colorTouched = true" />
          <span class="te-hex">{{ color }}</span>
          <button type="button" class="el-button" :disabled="!hasMask" @click="autoSampleColor">
            <span><i class="fa fa-eyedropper mr-1"></i> 自动取样</span>
          </button>
        </div>

        <p class="idphoto-hint mt-2">
          默认字号 = 选区高度 × 0.72；字色默认取选区内与背景差异最大的 30% 像素的中位色。
        </p>
      </div>
    </template>

    <template #result>
      <div v-if="hasSource" class="step-block">
        <div class="step"><b>3</b> 圈选文字与预览</div>

        <div class="te-toolbar">
          <div class="idphoto-tabs">
            <button
              type="button"
              class="idphoto-tab"
              :class="{ 'is-active': mode === 'brush' }"
              @click="mode = 'brush'"
            >画笔</button>
            <button
              type="button"
              class="idphoto-tab"
              :class="{ 'is-active': mode === 'rect' }"
              @click="mode = 'rect'"
            >矩形框 (R)</button>
          </div>

          <div class="el-slider" style="min-width:200px">
            <span class="form-label" style="flex-shrink:0">笔刷</span>
            <input v-model.number="brushSize" type="range" min="8" max="80" />
            <span class="te-value">{{ brushSize }} px</span>
          </div>

          <button type="button" class="el-button" :disabled="!ops.length" @click="undo">
            <span><i class="fa fa-undo mr-1"></i> 撤销</span>
          </button>
          <button type="button" class="el-button" :disabled="!ops.length" @click="clearOps">
            <span><i class="fa fa-trash-o mr-1"></i> 清空</span>
          </button>

          <button
            type="button"
            class="el-button el-button--primary"
            :disabled="!hasMask || !text.trim() || working"
            @click="apply"
          >
            <span><i class="fa fa-magic mr-1"></i> {{ working ? '处理中…' : '应用' }}</span>
          </button>
        </div>

        <div class="idphoto-toolbar">
          <div class="idphoto-tabs">
            <button
              type="button"
              class="idphoto-tab"
              :class="{ 'is-active': tab === 'original' }"
              @click="switchTab('original')"
            >原图</button>
            <button
              type="button"
              class="idphoto-tab"
              :class="{ 'is-active': tab === 'repaired' }"
              :disabled="!repaired"
              @click="switchTab('repaired')"
            >已修复</button>
            <button
              type="button"
              class="idphoto-tab"
              :class="{ 'is-active': tab === 'final' }"
              :disabled="!finalData"
              @click="switchTab('final')"
            >最终</button>
          </div>
          <span v-if="elapsedMs > 0" class="idphoto-hint">{{ lastPathLabel }}耗时 {{ elapsedMs }} ms</span>
          <span v-if="aiLoadMs > 0" class="idphoto-hint">模型加载 {{ aiLoadMs }} ms / 推理 {{ aiInferMs }} ms</span>
          <span v-if="progressNote" class="idphoto-hint">{{ progressNote }}</span>
          <span v-if="lastTextWidth > 0" class="idphoto-hint">文字宽 {{ lastTextWidth }} px / 选区高 {{ lastBoxH }} px</span>
        </div>

        <div class="idphoto-preview">
          <div class="te-canvas-wrap" :class="{ 'is-drawing': tab === 'original' }">
            <canvas ref="viewCanvasRef"></canvas>
            <canvas
              ref="overlayCanvasRef"
              class="te-overlay"
              @pointerdown="onPointerDown"
              @pointermove="onPointerMove"
              @pointerup="onPointerUp"
              @pointercancel="onPointerUp"
            ></canvas>
          </div>
        </div>

        <div class="step-actions">
          <button type="button" class="el-button el-button--primary" :disabled="!currentData" @click="downloadPng">
            <span><i class="fa fa-download mr-1"></i> 下载 PNG</span>
          </button>
        </div>

        <p class="idphoto-note mt-2">
          已知限制：手动圈选、不做自动文字检测；AI 修复对大面积纹理（密集人群、复杂花纹）仍可能与原图有质感差异；斜排/弧形文字不做透视校正（新字按水平基线绘制，可旋转）。
        </p>
      </div>
    </template>
  </ToolPage>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import ToolPage from '../../components/ToolPage.vue'
import {
  imageValidator, loadImage, canvasToBlob, downloadBlob, baseName, msgError, msgSuccess, msgWarning
} from '../../lib/ui.js'
import {
  expandMask, classicInpaint, lowFreqMatch, featherComposite
} from '../../lib/inpaint.js'
import { aiInpaint } from '../../lib/aiInpaint.js'
import {
  estimateFontSize, sampleTextColor, drawText, compositeText, maskBounds
} from '../../lib/textrender.js'

const FONTS = [
  { id: 'SimHei', name: '黑体 SimHei' },
  { id: '微软雅黑', name: '微软雅黑' },
  { id: 'SimSun', name: '宋体 SimSun' },
  { id: 'KaiTi', name: '楷体 KaiTi' },
  { id: 'Arial', name: 'Arial' }
]

const intro = '圈选图片中已有的文字，用 AI（MI-GAN）或经典修复算法抹掉原字并写上新文字，全程在浏览器本地处理，图片不上传服务器。'
const usage = [
  '上传或拖入一张图片，点「开始处理」载入画布（也可直接拖入后自动载入）。',
  '用画笔涂抹或按 R 切矩形框，圈出要替换的文字；选区显示为红色半透明，可撤销、清空。',
  '输入新文字，调整字体、字号、字色、粗细、对齐与旋转；字号默认按选区高度 ×0.72。',
  '选择修复方式：AI 修复（推荐，首次需加载 28.1MB 本地模型）或经典修复（快速）。AI 失败或超时会自动回退经典修复。',
  '点「应用」：抹除原字 → 低频色彩补偿 → 羽化融合 → 写上新文字。',
  '用「原图 / 已修复 / 最终」三态预览确认效果，下载与原图同尺寸的 PNG。'
]

const MODE_KEY = 'r'
const EXPAND_PX = 3
const RING_PX = 6
const LOWFREQ_SIGMA = 24
const FEATHER_SIGMA = 3.5

const pageRef = ref(null)
const text = ref('')
const fontFamily = ref('SimHei')
const bold = ref(false)
const align = ref('center')
const angle = ref(0)
const sizeScale = ref(100)
const color = ref('#000000')
const colorTouched = ref(false)
const brushSize = ref(24)
const mode = ref('brush')
const working = ref(false)
const tab = ref('original')
const repairMode = ref('ai')
const elapsedMs = ref(0)
const lastPathLabel = ref('经典修复')
const aiLoadMs = ref(0)
const aiInferMs = ref(0)
const progressNote = ref('')
const lastTextWidth = ref(0)
const lastBoxH = ref(0)

const hasSource = ref(false)
const sourceImage = shallowRef(null)
const currentFile = shallowRef(null)
const currentName = ref('图片')

const originalData = shallowRef(null)
const repaired = shallowRef(null)
const finalData = shallowRef(null)

const viewCanvasRef = ref(null)
const overlayCanvasRef = ref(null)

// 选区操作序列：{ type:'brush', size, points:[[x,y]...] } | { type:'rect', x, y, w, h }
const ops = ref([])
const drag = ref(null)
const maskCache = shallowRef(null)
const hasMask = ref(false)

const currentData = computed(() => {
  if (tab.value === 'repaired') return repaired.value
  if (tab.value === 'final') return finalData.value
  return originalData.value
})

const fontSizePx = computed(() => {
  const box = maskCache.value ? maskCache.value.box : null
  if (!box) return estimateFontSize(48)
  return Math.max(8, Math.round(estimateFontSize(box.h) * sizeScale.value / 100))
})

function naturalSize() {
  return sourceImage.value
    ? { w: sourceImage.value.naturalWidth, h: sourceImage.value.naturalHeight }
    : { w: 1, h: 1 }
}

function resetEditor() {
  ops.value = []
  drag.value = null
  maskCache.value = null
  hasMask.value = false
  originalData.value = null
  repaired.value = null
  finalData.value = null
  elapsedMs.value = 0
  aiLoadMs.value = 0
  aiInferMs.value = 0
  progressNote.value = ''
  lastTextWidth.value = 0
  lastBoxH.value = 0
  tab.value = 'original'
}

async function loadFile(file) {
  if (currentFile.value === file) return
  const img = await loadImage(file)
  resetEditor()
  currentFile.value = file
  currentName.value = baseName(file.name) || '图片'
  sourceImage.value = img
  hasSource.value = true
  await nextTick()

  const w = img.naturalWidth
  const h = img.naturalHeight
  const view = viewCanvasRef.value
  const over = overlayCanvasRef.value
  view.width = w
  view.height = h
  over.width = w
  over.height = h

  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0)
  try {
    originalData.value = ctx.getImageData(0, 0, w, h)
  } catch (e) {
    msgError('无法读取图片像素，请更换图片后重试')
    hasSource.value = false
    return
  }
  drawView(originalData.value)
  drawOverlay()
  if (!text.value) text.value = ''
}

function drawView(data) {
  const c = viewCanvasRef.value
  if (!c || !data) return
  if (c.width !== data.width) c.width = data.width
  if (c.height !== data.height) c.height = data.height
  const ctx = c.getContext('2d')
  const native = data instanceof ImageData ? data : new ImageData(data.data, data.width, data.height)
  ctx.putImageData(native, 0, 0)
}

function drawOverlay() {
  const c = overlayCanvasRef.value
  if (!c) return
  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, c.width, c.height)
  if (tab.value !== 'original') return
  ctx.save()
  ctx.fillStyle = 'rgba(239,68,68,0.45)'
  ctx.strokeStyle = 'rgba(239,68,68,0.45)'
  for (const op of ops.value) {
    if (op.type === 'rect') {
      ctx.fillRect(op.x, op.y, op.w, op.h)
    } else {
      ctx.lineWidth = op.size
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      op.points.forEach(([x, y], i) => {
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      if (op.points.length === 1) {
        ctx.lineTo(op.points[0][0] + 0.01, op.points[0][1] + 0.01)
      }
      ctx.stroke()
    }
  }
  ctx.restore()
  if (drag.value) {
    const d = drag.value
    ctx.save()
    ctx.fillStyle = 'rgba(239,68,68,0.55)'
    ctx.strokeStyle = 'rgba(239,68,68,0.55)'
    if (d.type === 'rect') {
      ctx.fillRect(d.x, d.y, d.w, d.h)
    } else {
      ctx.lineWidth = d.size
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      d.points.forEach(([x, y], i) => {
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      if (d.points.length === 1) ctx.lineTo(d.points[0][0] + 0.01, d.points[0][1] + 0.01)
      ctx.stroke()
    }
    ctx.restore()
  }
}

/** 用 canvas 栅格化选区操作 → 原始尺寸 Uint8Array 蒙版 */
function rasterizeMask() {
  const { w, h } = naturalSize()
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#fff'
  ctx.strokeStyle = '#fff'
  for (const op of ops.value) {
    if (op.type === 'rect') {
      ctx.fillRect(op.x, op.y, op.w, op.h)
    } else {
      ctx.lineWidth = op.size
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      op.points.forEach(([x, y], i) => {
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      if (op.points.length === 1) ctx.lineTo(op.points[0][0] + 0.01, op.points[0][1] + 0.01)
      ctx.stroke()
    }
  }
  const d = ctx.getImageData(0, 0, w, h).data
  const mask = new Uint8Array(w * h)
  for (let i = 0; i < mask.length; i++) mask[i] = d[i * 4] > 8 ? 1 : 0
  return mask
}

/** 重新计算蒙版 + 包围盒 + 自动字色（选区变化后调用） */
function refreshMask() {
  if (!hasSource.value || !ops.value.length) {
    maskCache.value = null
    hasMask.value = false
    drawOverlay()
    return
  }
  const { w, h } = naturalSize()
  const raw = rasterizeMask()
  const expanded = expandMask(raw, w, h, EXPAND_PX)
  const box = maskBounds(expanded, w, h)
  if (!box) {
    maskCache.value = null
    hasMask.value = false
    return
  }
  maskCache.value = { raw, expanded, box, w, h }
  hasMask.value = true
  if (!colorTouched.value && originalData.value) {
    color.value = sampleTextColor(originalData.value, expanded, RING_PX)
  }
  drawOverlay()
}

function autoSampleColor() {
  const m = maskCache.value
  if (!m || !originalData.value) return
  color.value = sampleTextColor(originalData.value, m.expanded, RING_PX)
  colorTouched.value = false
  msgSuccess('已按原文字取样颜色')
}

function undo() {
  ops.value.pop()
  refreshMask()
}

function clearOps() {
  ops.value = []
  refreshMask()
}

/* ---------- 指针交互 ---------- */

function toImageCoords(e) {
  const c = overlayCanvasRef.value
  const rect = c.getBoundingClientRect()
  if (!rect.width || !rect.height) return null
  const x = ((e.clientX - rect.left) / rect.width) * c.width
  const y = ((e.clientY - rect.top) / rect.height) * c.height
  return {
    x: Math.max(0, Math.min(c.width, x)),
    y: Math.max(0, Math.min(c.height, y))
  }
}

function onPointerDown(e) {
  if (tab.value !== 'original' || !hasSource.value) return
  if (e.button !== 0) return
  const p = toImageCoords(e)
  if (!p) return
  e.preventDefault()
  overlayCanvasRef.value.setPointerCapture(e.pointerId)
  if (mode.value === 'rect') {
    drag.value = { type: 'rect', ox: p.x, oy: p.y, x: p.x, y: p.y, w: 0, h: 0 }
  } else {
    drag.value = { type: 'brush', size: Number(brushSize.value), points: [[p.x, p.y]] }
  }
  drawOverlay()
}

function onPointerMove(e) {
  const d = drag.value
  if (!d) return
  const p = toImageCoords(e)
  if (!p) return
  if (d.type === 'rect') {
    d.x = Math.min(d.ox, p.x)
    d.y = Math.min(d.oy, p.y)
    d.w = Math.abs(p.x - d.ox)
    d.h = Math.abs(p.y - d.oy)
  } else {
    d.points.push([p.x, p.y])
  }
  drawOverlay()
}

function onPointerUp(e) {
  const d = drag.value
  drag.value = null
  if (!d) return
  if (overlayCanvasRef.value && overlayCanvasRef.value.hasPointerCapture(e.pointerId)) {
    overlayCanvasRef.value.releasePointerCapture(e.pointerId)
  }
  if (d.type === 'rect') {
    if (d.w < 2 || d.h < 2) { drawOverlay(); return }
    ops.value.push({ type: 'rect', x: d.x, y: d.y, w: d.w, h: d.h })
  } else {
    if (d.points.length < 1) { drawOverlay(); return }
    ops.value.push({ type: 'brush', size: d.size, points: d.points })
  }
  refreshMask()
}

function onKeyDown(e) {
  if (e.key === MODE_KEY || e.key === MODE_KEY.toUpperCase()) {
    const tag = (e.target && e.target.tagName) || ''
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return
    mode.value = mode.value === 'rect' ? 'brush' : 'rect'
  }
}

/* ---------- 应用：修复 + 写字 ---------- */

/** 在已修复图上写新文字，返回最终像素（不改动入参） */
function buildFinal(merged) {
  const box = maskCache.value.box
  const fs = Math.max(8, Math.round(estimateFontSize(box.h) * sizeScale.value / 100))
  const built = drawText(null, {
    text: text.value,
    fontSize: fs,
    fontFamily: fontFamily.value,
    bold: bold.value,
    align: align.value,
    angle: angle.value,
    color: color.value,
    x: 0,
    y: 0,
    boxW: box.w,
    boxH: box.h,
    shadow: true
  })
  lastTextWidth.value = built.canvas.width
  lastBoxH.value = box.h

  // 对齐决定锚点：左/右贴选区边缘，居中取中心
  const centerX = align.value === 'left'
    ? box.x + built.canvas.width / 2
    : align.value === 'right'
      ? box.x + box.w - built.canvas.width / 2
      : box.x + box.w / 2
  const out = { data: new Uint8ClampedArray(merged.data), width: merged.width, height: merged.height }
  compositeText(out, built.canvas, {
    x: centerX,
    y: box.y + box.h / 2,
    angle: angle.value,
    alpha: 1,
    blur: 0.4
  })
  return out
}

/** 经典修复 + 融合，返回已修复像素 */
function runClassic(orig, mask) {
  const filled = classicInpaint(orig, mask, { median: true, edge: true })
  return fuseFilled(orig, filled, mask)
}

/** 低频色彩补偿 + 羽化合成（AI 与经典共用） */
function fuseFilled(orig, filled, mask) {
  const matched = lowFreqMatch(filled, orig, mask, LOWFREQ_SIGMA)
  return featherComposite(orig, matched, mask, FEATHER_SIGMA)
}

async function apply() {
  const m = maskCache.value
  if (!m || !originalData.value) {
    msgError('请先在原图上圈选要改的文字')
    return
  }
  if (!text.value.trim()) {
    msgError('请输入新文字')
    return
  }
  working.value = true
  progressNote.value = ''
  aiLoadMs.value = 0
  aiInferMs.value = 0
  const t0 = performance.now()
  const orig = originalData.value
  try {
    let merged = null
    let fellBack = null
    if (repairMode.value === 'ai') {
      const r = await aiInpaint(orig, m.expanded, (note) => { progressNote.value = note })
      if (r.ok) {
        merged = fuseFilled(orig, r.filled, m.expanded)
        aiLoadMs.value = r.timings.loadMs
        aiInferMs.value = r.timings.inferMs
        lastPathLabel.value = 'AI 修复'
      } else {
        fellBack = r.reason
      }
    }
    if (!merged) {
      merged = runClassic(orig, m.expanded)
      lastPathLabel.value = '经典修复'
    }
    repaired.value = merged
    drawView(merged)

    // 写新文字（在已修复图上）
    finalData.value = buildFinal(merged)
    elapsedMs.value = Math.round(performance.now() - t0)
    progressNote.value = ''
    tab.value = 'final'
    drawView(finalData.value)
    drawOverlay()
    if (fellBack) {
      msgWarning(`AI 修复失败，已回退经典修复：${fellBack}`)
    } else {
      msgSuccess(`已应用（${lastPathLabel.value}），耗时 ${elapsedMs.value} ms`)
    }
  } catch (e) {
    console.error(e)
    msgError(`处理失败：${e.message || e}`)
  } finally {
    working.value = false
  }
}

function switchTab(t) {
  if (t === 'repaired' && !repaired.value) return
  if (t === 'final' && !finalData.value) return
  tab.value = t
  drawView(currentData.value)
  drawOverlay()
}

async function downloadPng() {
  const data = currentData.value
  if (!data) return
  try {
    const cv = document.createElement('canvas')
    cv.width = data.width
    cv.height = data.height
    const native = data instanceof ImageData ? data : new ImageData(data.data, data.width, data.height)
    cv.getContext('2d').putImageData(native, 0, 0)
    const blob = await canvasToBlob(cv, 'image/png')
    const suffix = { original: '原图', repaired: '已修复', final: '改字' }[tab.value] || '改字'
    downloadBlob(blob, `${currentName.value}_${suffix}.png`)
    msgSuccess('已开始下载 PNG（与原图同尺寸）')
  } catch (e) {
    msgError(`下载失败：${e.message || e}`)
  }
}

async function processHandler(tasks) {
  for (const t of tasks) {
    t.status = 'processing'
    try {
      await loadFile(t.file)
      t.status = 'done'
      t.note = '已载入画布，请圈选文字'
    } catch (e) {
      t.status = 'failed'
      t.error = e.message || String(e)
      msgError(`${t.file.name}：${t.error}`)
    }
  }
}

// 拖入/选择文件后自动载入（免去再点「开始处理」）
watch(
  () => (pageRef.value && pageRef.value.tasks ? pageRef.value.tasks.length : 0),
  async (len) => {
    const tasks = pageRef.value && pageRef.value.tasks
    if (!len || !tasks) return
    const last = tasks[tasks.length - 1]
    if (!last || last.status === 'processing') return
    if (last.file === currentFile.value) return
    last.status = 'processing'
    try {
      await loadFile(last.file)
      last.status = 'done'
      last.note = '已载入画布，请圈选文字'
    } catch (e) {
      last.status = 'failed'
      last.error = e.message || String(e)
      msgError(`${last.file.name}：${last.error}`)
    }
  }
)

watch([brushSize, mode], () => drawOverlay())

onMounted(() => window.addEventListener('keydown', onKeyDown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))
</script>
