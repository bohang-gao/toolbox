// 证件照尺寸预设与 A4 排版（纯 JS，零依赖）

export const DPI = 300
const MM_PER_INCH = 25.4

/** mm → 300dpi 像素 */
export function mmToPx(mm) {
  return Math.round((mm * DPI) / MM_PER_INCH)
}

const preset = (id, name, mmW, mmH) => ({
  id,
  name,
  mm: [mmW, mmH],
  width: mmToPx(mmW),
  height: mmToPx(mmH),
})

export const SIZE_PRESETS = [
  preset('one-inch', '一寸', 25, 35),          // 295×413
  preset('small-one-inch', '小一寸', 22, 32),   // 260×378
  preset('large-one-inch', '大一寸', 33, 48),   // 390×567
  preset('two-inch', '二寸', 35, 49),           // 413×579
  preset('small-two-inch', '小二寸', 35, 45),   // 413×531
  preset('passport', '护照', 33, 48),           // 390×567
  preset('visa', '签证', 35, 45),               // 413×531
  preset('social', '社保/简历', 26, 32),        // 307×378
]

export function getPreset(id) {
  return SIZE_PRESETS.find((p) => p.id === id) || SIZE_PRESETS[0]
}

/* ---------- A4 排版 ---------- */

export const A4 = {
  mm: [210, 297],
  width: mmToPx(210),  // 2480
  height: mmToPx(297), // 3508
}

const A4_MARGIN_MM = 20
const MAX_COPIES = 8

/**
 * 将证件照画到 A4 白底画布上，2 列 × 4 行居中，最多 8 张。
 * @param {HTMLImageElement|HTMLCanvasElement|ImageBitmap} source
 * @param {{width:number,height:number}|string} presetOrSize 预设对象或预设 id
 * @returns {HTMLCanvasElement}
 */
export function layoutA4(source, presetOrSize) {
  const p = typeof presetOrSize === 'string'
    ? getPreset(presetOrSize)
    : presetOrSize || SIZE_PRESETS[0]
  const pw = p.width
  const ph = p.height

  const canvas = createCanvas(A4.width, A4.height)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, A4.width, A4.height)

  const margin = mmToPx(A4_MARGIN_MM)
  const availW = A4.width - margin * 2
  const availH = A4.height - margin * 2

  // 2 列 × 4 行，按可用区域等比缩放，不放大超过原尺寸
  const cols = 2
  const rows = 4
  const cellW = availW / cols
  const cellH = availH / rows
  const scale = Math.min(cellW / pw, cellH / ph, 1)
  const dw = Math.round(pw * scale)
  const dh = Math.round(ph * scale)

  const gridW = dw * cols
  const gridH = dh * rows
  const startX = (A4.width - gridW) / 2
  const startY = (A4.height - gridH) / 2

  let drawn = 0
  for (let row = 0; row < rows && drawn < MAX_COPIES; row++) {
    for (let col = 0; col < cols && drawn < MAX_COPIES; col++) {
      const x = startX + col * dw
      const y = startY + row * dh
      ctx.drawImage(source, x, y, dw, dh)
      drawn++
    }
  }

  return canvas
}

function createCanvas(width, height) {
  // 优先 DOM canvas：页面需要 toBlob/toDataURL，OffscreenCanvas 只提供 convertToBlob
  if (typeof document !== 'undefined' && document.createElement) {
    const c = document.createElement('canvas')
    c.width = width
    c.height = height
    return c
  }
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height)
  }
  throw new Error('当前环境不支持 canvas')
}
