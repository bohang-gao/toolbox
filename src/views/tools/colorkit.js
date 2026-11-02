// 颜色转换纯函数（供 color.vue 使用，也可独立单测）

// 加极小量吸收 HSL 公式的浮点误差，避免 127.4999… 被舍成 127
const EPS = 1e-6
export const clamp255 = (n) => Math.min(255, Math.max(0, Math.round(n + EPS)))

export function rgbToHex({ r, g, b }) {
  const h = (n) => clamp255(n).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

export function rgbToHsl({ r, g, b }) {
  const rn = clamp255(r) / 255, gn = clamp255(g) / 255, bn = clamp255(b) / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  let h = 0, s = 0
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60
    else if (max === gn) h = ((bn - rn) / d + 2) * 60
    else h = ((rn - gn) / d + 4) * 60
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) }
}

export function hslToRgb(h, s, l) {
  const hn = (((h % 360) + 360) % 360) / 360
  const sn = Math.min(100, Math.max(0, s)) / 100
  const ln = Math.min(100, Math.max(0, l)) / 100
  if (sn === 0) {
    const v = clamp255(ln * 255)
    return { r: v, g: v, b: v }
  }
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn
  const p = 2 * ln - q
  const hue = (t) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }
  return {
    r: clamp255(hue(hn + 1 / 3) * 255),
    g: clamp255(hue(hn) * 255),
    b: clamp255(hue(hn - 1 / 3) * 255)
  }
}

function expandHex(c) {
  return parseInt(c.length === 1 ? c + c : c, 16)
}

export function hexToRgb(hex) {
  const h = String(hex).replace(/^#/, '')
  if (![3, 4, 6, 8].includes(h.length) || !/^[0-9a-f]+$/i.test(h)) return null
  if (h.length === 3 || h.length === 4) {
    return {
      r: expandHex(h[0]), g: expandHex(h[1]), b: expandHex(h[2]),
      a: h.length === 4 ? expandHex(h[3]) / 255 : 1
    }
  }
  return {
    r: expandHex(h.slice(0, 2)), g: expandHex(h.slice(2, 4)), b: expandHex(h.slice(4, 6)),
    a: h.length === 8 ? expandHex(h.slice(6, 8)) / 255 : 1
  }
}

// 解析任意受支持格式 → { r, g, b, a }；无法识别返回 null
export function parseColor(text) {
  const raw = String(text == null ? '' : text).trim()
  if (!raw) return null

  const hex = hexToRgb(raw)
  if (hex) return hex

  const rgbMatch = raw.match(/^rgba?\s*\(([^)]+)\)$/i)
  if (rgbMatch) {
    const parts = rgbMatch[1].split(/[\s,/]+/).filter(Boolean)
    if (parts.length < 3) return null
    const num = (v) => (v.endsWith('%') ? parseFloat(v) * 2.55 : parseFloat(v))
    const r = num(parts[0]), g = num(parts[1]), b = num(parts[2])
    if ([r, g, b].some((n) => !Number.isFinite(n))) return null
    let a = 1
    if (parts[3] !== undefined) a = parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3])
    if (!Number.isFinite(a)) a = 1
    return { r: clamp255(r), g: clamp255(g), b: clamp255(b), a: Math.min(1, Math.max(0, a)) }
  }

  const hslMatch = raw.match(/^hsla?\s*\(([^)]+)\)$/i)
  if (hslMatch) {
    const parts = hslMatch[1].split(/[\s,/]+/).filter(Boolean)
    if (parts.length < 3) return null
    const h = parseFloat(parts[0]), s = parseFloat(parts[1]), l = parseFloat(parts[2])
    if ([h, s, l].some((n) => !Number.isFinite(n))) return null
    let a = 1
    if (parts[3] !== undefined) a = parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3])
    if (!Number.isFinite(a)) a = 1
    return { ...hslToRgb(h, s, l), a: Math.min(1, Math.max(0, a)) }
  }
  return null
}
