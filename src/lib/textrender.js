// 新文字渲染（纯 JS，零依赖）
// 只做「算字号 / 取样字色 / 画字」三件事；融合由 inpaint.js 负责。
import { expandMask } from './inpaint.js'

/** 选区高度 → 字号。文字实际高度约占框高 72%。 */
export function estimateFontSize(boxH) {
  const h = Math.max(1, Number(boxH) || 0)
  return Math.max(8, Math.round(h * 0.72))
}

const lum = (r, g, b) => r * 0.299 + g * 0.587 + b * 0.114

/**
 * 自动取样原文字颜色。
 * 用「选区外扩 ringPx 的背景」均值作参考，取选区内与背景差异最大的 30% 像素，
 * 返回这些像素的中位色（逐通道中位）。
 * @param {{data:Uint8ClampedArray|Uint8Array,width:number,height:number}} imageData
 * @param {Uint8Array} mask 1 = 选区
 * @param {number} ringPx 外圈宽度
 * @returns {string} #rrggbb
 */
export function sampleTextColor(imageData, mask, ringPx = 6) {
  const w = imageData.width
  const h = imageData.height
  const n = w * h
  const d = imageData.data
  const ring = Math.max(1, Math.round(ringPx))

  // 外圈背景均值：膨胀 ring 像素后落在环带内的「非选区」像素（O(n)）
  const ringBand = expandMask(mask, w, h, ring)
  let br = 0, bg = 0, bb = 0, bc = 0
  for (let i = 0; i < n; i++) {
    if (mask[i] || !ringBand[i]) continue
    const j = i * 4
    br += d[j]
    bg += d[j + 1]
    bb += d[j + 2]
    bc++
  }
  if (bc === 0) return '#000000'
  br /= bc; bg /= bc; bb /= bc

  // 选区内像素按「与背景的亮度差」排序，取前 30%
  const list = []
  for (let i = 0; i < n; i++) {
    if (!mask[i]) continue
    const j = i * 4
    const diff = Math.abs(lum(d[j], d[j + 1], d[j + 2]) - lum(br, bg, bb))
    list.push({ diff, r: d[j], g: d[j + 1], b: d[j + 2] })
  }
  if (!list.length) {
    const v = Math.round(lum(br, bg, bb)) > 127 ? '#000000' : '#ffffff'
    return v
  }
  list.sort((a, b) => b.diff - a.diff)
  // 取差异最大的 12%（笔画核心像素，避开抗锯齿边缘），且中位数比背景暗则取更暗分位
  const take = Math.max(1, Math.round(list.length * 0.12))
  const picked = list.slice(0, take)
  const rs = picked.map(p => p.r).sort((a, b) => a - b)
  const gs = picked.map(p => p.g).sort((a, b) => a - b)
  const bs = picked.map(p => p.b).sort((a, b) => a - b)
  const mid = (arr) => arr[Math.floor(arr.length / 2)]
  // 笔画核心若仍混入边缘像素，往更极端的一侧取 25% 分位再压一次
  const extreme = (arr, towardDark) => {
    if (!towardDark) return arr[Math.floor(arr.length * 0.25)]
    return arr[Math.floor(arr.length * 0.25)]
  }
  const bgL = lum(br, bg, bb)
  const strokeL = lum(mid(rs), mid(gs), mid(bs))
  const towardDark = strokeL < bgL
  const r = towardDark ? extreme(rs, true) : extreme(rs, false)
  const g = towardDark ? extreme(gs, true) : extreme(gs, false)
  const b = towardDark ? extreme(bs, true) : extreme(bs, false)
  const hex = (v) => Math.round(v).toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

function parseColor(color) {
  const s = String(color || '#000').trim()
  if (s.startsWith('#')) {
    let h = s.slice(1)
    if (h.length === 3) h = h.split('').map(c => c + c).join('')
    const v = parseInt(h, 16)
    if (Number.isNaN(v)) return [0, 0, 0, 255]
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255, 255]
  }
  const m = s.match(/rgba?\(([^)]+)\)/i)
  if (m) {
    const parts = m[1].split(',').map(x => parseFloat(x))
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0, parts[3] === undefined ? 255 : parts[3] * 255]
  }
  return [0, 0, 0, 255]
}

const FONT_STACK = {
  SimHei: '"SimHei", "黑体", sans-serif',
  '微软雅黑': '"Microsoft YaHei", "微软雅黑", sans-serif',
  SimSun: '"SimSun", "宋体", serif',
  KaiTi: '"KaiTi", "楷体", serif',
  Arial: 'Arial, Helvetica, sans-serif'
}

/**
 * 在离屏 canvas 上画字，返回 { canvas, box }。
 * 旋转时自动扩大画布，避免裁切。
 * @param {CanvasRenderingContext2D} _ctx 目标上下文（用于创建兼容画布，可传 null）
 * @param {object} opts
 * @returns {{canvas: HTMLCanvasElement, box: {x:number,y:number,w:number,h:number}}}
 */
export function drawText(ctx, opts = {}) {
  const text = String(opts.text || '')
  const fontSize = Math.max(1, Number(opts.fontSize) || 16)
  const fontFamily = FONT_STACK[opts.fontFamily] || FONT_STACK.SimHei
  const bold = !!opts.bold
  const align = opts.align || 'center'
  const angle = (Number(opts.angle) || 0) * Math.PI / 180
  const color = opts.color || '#000000'
  const x = Number(opts.x) || 0
  const y = Number(opts.y) || 0
  const boxW = Math.max(1, Number(opts.boxW) || fontSize * Math.max(1, text.length))
  const boxH = Math.max(1, Number(opts.boxH) || fontSize)
  const shadow = opts.shadow !== false

  const font = `${bold ? 'bold ' : ''}${fontSize}px ${fontFamily}`
  const measure = document.createElement('canvas').getContext('2d')
  measure.font = font
  const tw = Math.max(1, Math.ceil(measure.measureText(text || ' ').width))

  const padX = Math.ceil(fontSize * 0.4)
  const padY = Math.ceil(fontSize * 0.5)
  const w = tw + padX * 2
  const h = Math.ceil(fontSize * 1.4) + padY * 2
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const c = canvas.getContext('2d')
  c.clearRect(0, 0, w, h)
  c.font = font
  c.textAlign = align
  c.textBaseline = 'middle'
  c.fillStyle = color
  const anchorX = align === 'left' ? padX : align === 'right' ? w - padX : w / 2
  const anchorY = h / 2
  if (shadow) {
    c.shadowColor = 'rgba(0,0,0,0.18)'
    c.shadowBlur = Math.max(1, fontSize * 0.08)
    c.shadowOffsetY = Math.max(1, fontSize * 0.04)
  }
  c.fillText(text, anchorX, anchorY)
  c.shadowColor = 'transparent'
  c.shadowBlur = 0
  c.shadowOffsetY = 0

  return { canvas, box: { x: x - boxW / 2, y: y - boxH / 2, w: boxW, h: boxH, angle } }
}

/**
 * 把画好的文字合成进目标像素数组（就地修改）。
 * 轻微高斯模糊匹配原图锐度；按局部对比度微调 alpha。
 * @param {{data:Uint8ClampedArray,width:number,height:number}} imageData
 * @param {HTMLCanvasElement} textCanvas
 * @param {{x:number,y:number,alpha?:number,blur?:number,angle?:number,boxW:number,boxH:number}} placement
 */
export function compositeText(imageData, textCanvas, placement) {
  const w = imageData.width
  const h = imageData.height
  const d = imageData.data
  const cx = Math.round(Number(placement.x) || 0)
  const cy = Math.round(Number(placement.y) || 0)
  const angle = (Number(placement.angle) || 0) * Math.PI / 180
  const alpha = Math.max(0, Math.min(1, placement.alpha === undefined ? 1 : placement.alpha))
  const blurPx = Math.max(0, Number(placement.blur) || 0)

  // 旋转后的外包尺寸
  const cos = Math.abs(Math.cos(angle))
  const sin = Math.abs(Math.sin(angle))
  const rw = Math.ceil(textCanvas.width * cos + textCanvas.height * sin)
  const rh = Math.ceil(textCanvas.width * sin + textCanvas.height * cos)

  const off = document.createElement('canvas')
  off.width = rw
  off.height = rh
  const oc = off.getContext('2d')
  if (blurPx > 0) oc.filter = `blur(${blurPx}px)`
  oc.translate(rw / 2, rh / 2)
  oc.rotate(angle)
  oc.drawImage(textCanvas, -textCanvas.width / 2, -textCanvas.height / 2)
  oc.filter = 'none'

  let src
  try {
    src = oc.getImageData(0, 0, rw, rh).data
  } catch (e) {
    return imageData // 跨域污染时静默跳过（本地 canvas 不会触发）
  }

  const ox = cx - Math.floor(rw / 2)
  const oy = cy - Math.floor(rh / 2)
  for (let yy = 0; yy < rh; yy++) {
    const ty = oy + yy
    if (ty < 0 || ty >= h) continue
    for (let xx = 0; xx < rw; xx++) {
      const tx = ox + xx
      if (tx < 0 || tx >= w) continue
      const si = (yy * rw + xx) * 4
      const a = (src[si + 3] / 255) * alpha
      if (a <= 0.002) continue
      const di = (ty * w + tx) * 4
      // 局部对比度：新字落在背景上的对比越弱，越要压 alpha，避免过锐
      const local = lum(d[di], d[di + 1], d[di + 2])
      const ink = lum(src[si], src[si + 1], src[si + 2])
      const contrast = Math.abs(ink - local) / 255
      const adj = 0.75 + 0.25 * Math.min(1, contrast * 1.4)
      const aa = Math.min(1, a * adj)
      d[di] = d[di] * (1 - aa) + src[si] * aa
      d[di + 1] = d[di + 1] * (1 - aa) + src[si + 1] * aa
      d[di + 2] = d[di + 2] * (1 - aa) + src[si + 2] * aa
    }
  }
  return imageData
}

/** 选区包围盒（按蒙版像素统计） */
export function maskBounds(mask, w, h) {
  let minX = w, minY = h, maxX = -1, maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  if (maxX < 0) return null
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

export { parseColor }
