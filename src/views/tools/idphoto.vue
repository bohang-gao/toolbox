<template>
  <ToolPage
    title="证件照换底色"
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
        <div class="flex items-center flex-wrap" style="gap:12px 16px">
          <span class="form-label">抠图模式</span>
          <label class="el-radio"><input v-model="mode" type="radio" value="auto" />自动</label>
          <label class="el-radio"><input v-model="mode" type="radio" value="manual" />手动点选</label>
          <span class="idphoto-hint">手动模式：左键点背景（只抠你点的区域，自动扩展同色连通区），右键点主体（保留）</span>
        </div>

        <div class="flex items-center flex-wrap mt-2" style="gap:12px 16px">
          <span class="form-label">抠图算法</span>
          <label class="el-radio">
            <input v-model="algorithm" type="radio" value="adaptive" />自适应（推荐 · 支持渐变背景）
          </label>
          <label class="el-radio"><input v-model="algorithm" type="radio" value="strict" />严格单色</label>
        </div>

        <div class="el-slider mt-2">
          <span class="form-label" style="flex-shrink:0">颜色容差</span>
          <input v-model.number="tol" type="range" min="10" max="90" @change="recompute" />
          <span class="idphoto-value">{{ tol }}</span>
        </div>
        <div class="el-slider">
          <span class="form-label" style="flex-shrink:0">亮度容差</span>
          <input v-model.number="tolLum" type="range" min="10" max="90" @change="recompute" />
          <span class="idphoto-value">{{ tolLum }}</span>
        </div>

        <div class="flex items-center flex-wrap mt-2" style="gap:10px 14px">
          <span class="form-label">背景色</span>
          <div class="idphoto-swatches">
            <button
              v-for="s in SWATCHES"
              :key="s.id"
              type="button"
              class="idphoto-swatch"
              :class="[`idphoto-swatch--${s.id}`, { 'is-active': bgMode === s.id }]"
              :style="s.color ? { background: s.color } : null"
              :title="s.name"
              @click="selectSwatch(s)"
            ></button>
            <button
              type="button"
              class="idphoto-swatch idphoto-swatch--custom"
              :class="{ 'is-active': bgMode === 'custom' }"
              title="自定义颜色"
              @click="bgMode = 'custom'"
            ><i class="fa fa-eyedropper"></i></button>
            <input
              v-model="customColor"
              type="color"
              class="idphoto-color"
              title="自定义背景色"
              @input="bgMode = 'custom'"
            />
          </div>
          <label class="el-radio"><input v-model="gradientOn" type="checkbox" />渐变背景</label>
        </div>

        <div class="flex items-center flex-wrap mt-2" style="gap:12px 16px">
          <span class="form-label">尺寸</span>
          <select v-model="presetId" class="el-input__inner" style="width:240px">
            <option v-for="p in SIZE_PRESETS" :key="p.id" :value="p.id">
              {{ p.name }}（{{ p.mm[0] }}×{{ p.mm[1] }}mm · {{ p.width }}×{{ p.height }}px）
            </option>
          </select>
          <label class="el-radio"><input v-model="a4Enabled" type="checkbox" />A4 排版（8 张）</label>
        </div>
        <p class="mt-2 idphoto-note">
          纯前端处理，照片不上传服务器；输出 300dpi PNG，可直接冲印。
        </p>
      </div>
    </template>

    <template #result>
      <div v-if="hasSource" class="step-block">
        <div class="step"><b>3</b> 预览与下载</div>
        <div class="idphoto-toolbar">
          <div class="idphoto-tabs">
            <button
              type="button"
              class="idphoto-tab"
              :class="{ 'is-active': tab === 'original' }"
              @click="tab = 'original'"
            >原图</button>
            <button
              type="button"
              class="idphoto-tab"
              :class="{ 'is-active': tab === 'cutout' }"
              :disabled="!state"
              @click="tab = 'cutout'"
            >抠图</button>
            <button
              type="button"
              class="idphoto-tab"
              :class="{ 'is-active': tab === 'result' }"
              :disabled="!state"
              @click="tab = 'result'"
            >效果</button>
          </div>
          <template v-if="mode === 'manual'">
            <button type="button" class="el-button" :disabled="working" @click="recompute">重新抠图</button>
            <button v-if="markers.length" type="button" class="el-button" @click="clearSeeds">
              清除标记（{{ markers.length }}）
            </button>
            <span class="idphoto-hint">
              左键 = 擦除背景 <span class="idphoto-dot erase"></span>
              右键 = 保留主体 <span class="idphoto-dot keep"></span>
            </span>
          </template>
        </div>

        <div class="idphoto-preview">
          <div
            v-show="tab === 'original'"
            class="idphoto-canvas-wrap"
            :class="{ 'is-manual': mode === 'manual' }"
          >
            <canvas
              ref="originalCanvasRef"
              @click="onSeedClick($event, 'erase')"
              @contextmenu.prevent="onSeedClick($event, 'keep')"
            ></canvas>
            <span
              v-for="(m, i) in visibleMarkers"
              :key="`o${i}`"
              class="idphoto-marker"
              :class="m.type"
              :style="markerStyle(m)"
            ></span>
          </div>
          <div
            v-show="tab === 'cutout'"
            class="idphoto-canvas-wrap idphoto-checker"
            :class="{ 'is-manual': mode === 'manual' }"
          >
            <canvas
              ref="cutoutCanvasRef"
              @click="onSeedClick($event, 'erase')"
              @contextmenu.prevent="onSeedClick($event, 'keep')"
            ></canvas>
            <span
              v-for="(m, i) in visibleMarkers"
              :key="`c${i}`"
              class="idphoto-marker"
              :class="m.type"
              :style="markerStyle(m)"
            ></span>
          </div>
          <div v-show="tab === 'result'" class="idphoto-canvas-wrap">
            <canvas ref="resultCanvasRef"></canvas>
          </div>
          <div v-if="tab !== 'original' && !state" class="idphoto-empty">
            尚未生成效果图，请点击下方「开始处理」。
          </div>
        </div>

        <div class="step-actions">
          <button
            type="button"
            class="el-button el-button--primary"
            :disabled="!state"
            @click="downloadSingle"
          >
            <span><i class="fa fa-download mr-1"></i> 下载单张</span>
          </button>
          <button
            type="button"
            class="el-button el-button--info"
            :disabled="!a4Canvas"
            @click="downloadA4"
          >
            <span><i class="fa fa-file-o mr-1"></i> 下载 A4 排版</span>
          </button>
        </div>
      </div>
    </template>
  </ToolPage>
</template>

<script setup>
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import ToolPage from '../../components/ToolPage.vue'
import {
  imageValidator, loadImage, canvasToBlob, downloadBlob, baseName, msgSuccess, msgError, msgWarning
} from '../../lib/ui.js'
import {
  detectBackgroundColor, segmentBackground, cleanMask, featherAlpha, refineEdgeAlpha,
  decontaminate, composite, subjectBox, cropToBox, makeImageData
} from '../../lib/portrait.js'
import { SIZE_PRESETS, getPreset, layoutA4 } from '../../lib/idphoto.js'

const SWATCHES = [
  { id: 'white', name: '白色', color: '#ffffff' },
  { id: 'red', name: '红色', color: '#d9001b' },
  { id: 'blue', name: '蓝色', color: '#438edb' },
  { id: 'gray', name: '浅灰', color: '#f0f0f0' },
  { id: 'gradient', name: '淡蓝渐变', color: '' }
]
const COLOR_HEX = { white: '#ffffff', red: '#d9001b', blue: '#438edb', gray: '#f0f0f0', gradient: '#dbeafe' }

const intro = '纯前端在浏览器本地完成抠图、换底色与标准尺寸裁剪，照片不上传服务器。适合背景相对干净的正面证件照。'
const usage = [
  '上传或拖入一张正面照，纯色背景的成像效果最佳。',
  '选择抠图模式：自动去背；背景杂乱时改用手动点选修补。',
  '设置背景色与证件照尺寸，按需开启 A4 排版（8 张）。',
  '点击「开始处理」生成效果，用「原图 / 抠图 / 效果」三态预览确认。',
  '下载单张 PNG，或下载 A4 排版图后直接冲印。'
]

const mode = ref('auto')
const algorithm = ref('adaptive')
const tol = ref(38)
const tolLum = ref(42)
const bgMode = ref('white')
const customColor = ref('#ffffff')
const gradientOn = ref(false)
const presetId = ref('one-inch')
const a4Enabled = ref(false)
const tab = ref('original')
const working = ref(false)

const hasSource = ref(false)
const sourceImage = shallowRef(null)
const state = shallowRef(null) // { imageData, bg, alpha, decon, box }
const a4Canvas = shallowRef(null)
const resultBlob = ref(null)
const currentFile = shallowRef(null)
const currentName = ref('证件照')

const eraseSeeds = ref([])
const keepSeeds = ref([])
const markers = ref([])

const originalCanvasRef = ref(null)
const cutoutCanvasRef = ref(null)
const resultCanvasRef = ref(null)

const preset = computed(() => getPreset(presetId.value))
const visibleMarkers = computed(() => (mode.value === 'manual' ? markers.value : []))

function hexToRgb(hex) {
  const s = String(hex || '').replace('#', '')
  const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s
  const n = parseInt(full, 16)
  if (Number.isNaN(n)) return [255, 255, 255]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function resolveBgArg() {
  const base = hexToRgb(bgMode.value === 'custom' ? customColor.value : COLOR_HEX[bgMode.value] || '#ffffff')
  return gradientOn.value ? { base } : base
}

function selectSwatch(s) {
  bgMode.value = s.id
  gradientOn.value = s.id === 'gradient'
}

function markerStyle(m) {
  const w = sourceImage.value ? sourceImage.value.naturalWidth : 1
  const h = sourceImage.value ? sourceImage.value.naturalHeight : 1
  return {
    left: `${(m.x / Math.max(1, w)) * 100}%`,
    top: `${(m.y / Math.max(1, h)) * 100}%`
  }
}

function resetSeeds() {
  eraseSeeds.value = []
  keepSeeds.value = []
  markers.value = []
}

function clearSeeds() {
  resetSeeds()
}

function clearCanvas(c) {
  if (!c) return
  c.width = 1
  c.height = 1
}

function drawOriginal() {
  const c = originalCanvasRef.value
  const img = sourceImage.value
  if (!c || !img) return
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  c.getContext('2d').drawImage(img, 0, 0)
}

function drawCutout(decon, alpha) {
  const c = cutoutCanvasRef.value
  if (!c) return
  const w = decon.width
  const h = decon.height
  c.width = w
  c.height = h
  const out = makeImageData(w, h)
  const od = out.data
  const sd = decon.data
  const n = w * h
  for (let i = 0; i < n; i++) {
    const j = i * 4
    od[j] = sd[j]
    od[j + 1] = sd[j + 1]
    od[j + 2] = sd[j + 2]
    od[j + 3] = alpha[i]
  }
  c.getContext('2d').putImageData(out, 0, 0)
}

function drawResult(out) {
  const c = resultCanvasRef.value
  if (!c) return
  c.width = out.width
  c.height = out.height
  const native = typeof ImageData !== 'undefined' && !(out instanceof ImageData)
    ? new ImageData(out.data, out.width, out.height)
    : out
  c.getContext('2d').putImageData(native, 0, 0)
}

/** 合成 → 裁剪 → 绘制效果图；A4 开关打开时同步生成排版画布 */
function renderOutputs() {
  const st = state.value
  const c = resultCanvasRef.value
  if (!st || !c) return
  const composed = composite(st.decon, st.alpha, resolveBgArg())
  const p = preset.value
  const out = cropToBox(composed, st.box, p.width, p.height)
  drawResult(out)
  resultBlob.value = null
  a4Canvas.value = a4Enabled.value ? layoutA4(c, p) : null
}

/**
 * 抠图 + 边缘精修，成功时更新 state 并渲染预览。
 * @returns {Promise<{ ok:boolean, retried:number }>}
 */
async function runSegmentation() {
  const img = sourceImage.value
  if (!img) return { ok: false, retried: 0 }
  const w = img.naturalWidth
  const h = img.naturalHeight

  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0)
  let imageData
  try {
    imageData = ctx.getImageData(0, 0, w, h)
  } catch (e) {
    msgError('无法读取图片像素，请更换图片后重试')
    return { ok: false, retried: 0 }
  }

  const det = detectBackgroundColor(imageData)
  // 仅严格单色模式下，背景不均匀才阻止自动流程并切手动；自适应模式可处理渐变
  if (mode.value === 'auto' && algorithm.value === 'strict' && det.variance > 60) {
    mode.value = 'manual'
    tab.value = 'original'
    msgError('背景颜色不均匀，已切换为手动模式：左键点选要去掉的背景（只抠你点的区域）、右键点选需保留的主体，然后点击「重新抠图」')
    return { ok: false, retried: 0 }
  }

  const seedOpts = mode.value === 'manual'
    ? { eraseSeeds: eraseSeeds.value, keepSeeds: keepSeeds.value }
    : {}
  const seg = segmentBackground(imageData, {
    mode: algorithm.value,
    tol: Number(tol.value),
    tolLum: Number(tolLum.value),
    ...seedOpts
  })
  if (!seg.ok) {
    tab.value = 'original'
    msgError(seg.reason || '抠图失败，请尝试手动点选背景区域')
    return { ok: false, retried: 0 }
  }
  if (seg.warning) msgWarning(seg.warning)

  const cleaned = cleanMask(seg.mask, w, h)
  const alpha = featherAlpha(refineEdgeAlpha(imageData, cleaned, seg.bg, w, h), w, h, 1)
  const decon = decontaminate(imageData, alpha, seg.bg)
  const box = subjectBox(alpha, w, h)

  state.value = { imageData, bg: seg.bg, alpha, decon, box }
  drawCutout(decon, alpha)
  renderOutputs()
  tab.value = 'result'
  return { ok: true, retried: seg.retried || 0 }
}

async function recompute() {
  // 尚未添加图片时静默忽略（避免拖动容差滑杆就弹错误提示）
  if (!sourceImage.value) return
  working.value = true
  try {
    await runSegmentation()
  } finally {
    working.value = false
  }
}

function onSeedClick(e, type) {
  if (mode.value !== 'manual' || !sourceImage.value) return
  const canvas = e.currentTarget
  const rect = canvas.getBoundingClientRect()
  if (!rect.width || !rect.height) return
  const x = Math.round(((e.clientX - rect.left) / rect.width) * canvas.width)
  const y = Math.round(((e.clientY - rect.top) / rect.height) * canvas.height)
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return
  const list = type === 'erase' ? eraseSeeds.value : keepSeeds.value
  list.push([x, y])
  markers.value.push({ x, y, type })
}

async function processHandler(tasks) {
  for (const t of tasks) {
    t.status = 'processing'
    t.note = ''
    try {
      if (currentFile.value !== t.file) {
        resetSeeds()
        currentFile.value = t.file
        currentName.value = baseName(t.file.name) || '证件照'
      }
      const img = await loadImage(t.file)
      sourceImage.value = img
      hasSource.value = true
      await nextTick()

      state.value = null
      a4Canvas.value = null
      resultBlob.value = null
      tab.value = 'original'
      clearCanvas(cutoutCanvasRef.value)
      clearCanvas(resultCanvasRef.value)
      drawOriginal()

      const res = await runSegmentation()
      if (!res.ok) {
        t.status = 'failed'
        continue
      }
      if (res.retried > 0) t.note = '（已自动优化边缘）'

      const blob = await canvasToBlob(resultCanvasRef.value, 'image/png')
      resultBlob.value = blob
      t.outSize = blob.size
      t.status = 'done'
    } catch (e) {
      t.status = 'failed'
      t.error = e.message || String(e)
      msgError(`${t.file.name}：${t.error}`)
    }
  }
  if (tasks.some((t) => t.status === 'done')) msgSuccess('处理完成，可预览并下载')
}

async function downloadSingle() {
  if (!state.value || !resultCanvasRef.value) return
  try {
    let blob = resultBlob.value
    if (!blob) {
      blob = await canvasToBlob(resultCanvasRef.value, 'image/png')
      resultBlob.value = blob
    }
    downloadBlob(blob, `${currentName.value}_${preset.value.name}.png`)
    msgSuccess('已开始下载单张证件照')
  } catch (e) {
    msgError(`下载失败：${e.message || e}`)
  }
}

async function downloadA4() {
  if (!a4Canvas.value) return
  try {
    const blob = await canvasToBlob(a4Canvas.value, 'image/png')
    downloadBlob(blob, `${currentName.value}_A4排版.png`)
    msgSuccess('已开始下载 A4 排版图')
  } catch (e) {
    msgError(`下载失败：${e.message || e}`)
  }
}

watch([bgMode, customColor, gradientOn, presetId, a4Enabled], () => {
  if (state.value) renderOutputs()
})
</script>
