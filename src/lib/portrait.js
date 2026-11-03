// 证件照抠图/合成/裁剪算法库（纯 JS，零依赖）
// 除 canvas 创建外不依赖 DOM；所有图像处理函数接受 { data, width, height } 结构，
// 因此在 Node 环境可用普通对象替代 ImageData。
//
// alpha 约定：0 = 背景（全透明），255 = 主体（完全不透明）。

const LUMA_R = 0.299
const LUMA_G = 0.587
const LUMA_B = 0.114

export function luma(r, g, b) {
  return LUMA_R * r + LUMA_G * g + LUMA_B * b
}

/* ---------- 基础工具 ---------- */

export function makeImageData(width, height) {
  const data = new Uint8ClampedArray(width * height * 4)
  if (typeof ImageData !== 'undefined') {
    try {
      return new ImageData(data, width, height)
    } catch (e) {
      /* Node / 非标准环境回退为普通对象 */
    }
  }
  return { data, width, height }
}

export function createCanvas(width, height) {
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

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v
}

function median(arr) {
  const a = arr.slice().sort((x, y) => x - y)
  const mid = a.length >> 1
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2
}

/* ---------- 背景色检测 ---------- */

/**
 * 采样图像四边最外 2px，计算背景色中位数与色差。
 * @returns {{bg:[number,number,number], variance:number}}
 *   variance 为边缘采样点相对背景色最大通道差的 80 分位数（0..255），
 *   越大表示背景越不均匀；> 60 时自动模式应改用手动点选。
 */
export function detectBackgroundColor(imageData) {
  const { data, width: w, height: h } = imageData
  const seen = new Uint8Array(w * h)
  const rs = []
  const gs = []
  const bs = []

  const sample = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const idx = y * w + x
    if (seen[idx]) return
    seen[idx] = 1
    const i = idx * 4
    rs.push(data[i])
    gs.push(data[i + 1])
    bs.push(data[i + 2])
  }

  // 左右两边最外 2px
  for (let y = 0; y < h; y++) {
    sample(0, y)
    sample(1, y)
    sample(w - 1, y)
    sample(w - 2, y)
  }
  // 上下两边最外 2px
  for (let x = 0; x < w; x++) {
    sample(x, 0)
    sample(x, 1)
    sample(x, h - 1)
    sample(x, h - 2)
  }

  const bg = [median(rs), median(gs), median(bs)]

  const diffs = new Array(rs.length)
  for (let i = 0; i < rs.length; i++) {
    const dr = Math.abs(rs[i] - bg[0])
    const dg = Math.abs(gs[i] - bg[1])
    const db = Math.abs(bs[i] - bg[2])
    diffs[i] = Math.max(dr, dg, db)
  }
  diffs.sort((a, b) => a - b)
  const p = Math.floor(0.8 * (diffs.length - 1))
  const variance = diffs.length ? diffs[p] : 0

  return { bg, variance }
}

/* ---------- 自适应背景分割（多源 BFS 区域生长） ---------- */

const MAX_REGION = 4096

/**
 * 单轮多源 BFS 区域生长，用「局部步进容差」跟随渐变/暗角背景。
 *
 * 与全局模型（四边中位数 + 固定容差）不同，这里每个边缘种子保留自己的
 * 参考色，生长时同时约束：
 *   1) 局部平滑：与入队前驱像素的通道差 <= stepTol（跟随渐变）
 *   2) 漂移有界：与该区域种子色的通道差 <= driftTol（防止渗进主体）
 *
 * 为防止浅色背景下区域生长渗入人脸/衬衫，额外约束：
 *   3) 肤色保护：YCbCr 判定为肤色的像素，仅当与区域参考色非常接近（<= skinTol）
 *      时才允许入背景，否则阻断生长（浅色平滑肤色不会被整块吞掉）。
 *   4) 强边缘屏障：Sobel 梯度幅值超过 edgeTol 的像素，若与前驱颜色跳变明显
 *      （> 6）则拒绝入背景（发型/下颌线/衣领等强边界不再渗透）。
 *
 * @param {{data:Uint8ClampedArray,width:number,height:number}} imageData
 * @param {{stepTol?:number,driftTol?:number,eraseSeeds?:number[][],keepSeeds?:number[][],
 *   skinGuard?:boolean,edgeGuard?:boolean,skinTol?:number,edgeTol?:number}} opts
 * @returns {{alpha:Uint8ClampedArray,coverage:number,ok:boolean,reason:string,
 *   bg:number[],variance:number,mask:Uint8Array}}
 */
function segmentAdaptivePass(imageData, opts = {}) {
  const {
    stepTol = 10, driftTol = 55, eraseSeeds = [], keepSeeds = [],
    skinGuard = true, edgeGuard = true, skinTol = 14, edgeTol = 30,
  } = opts
  const { data, width: w, height: h } = imageData
  const n = w * h

  const det = detectBackgroundColor(imageData)

  // 经典 YCbCr 肤色判定
  const isSkin = (r, g, b) => {
    const y = LUMA_R * r + LUMA_G * g + LUMA_B * b
    const cb = 128 - 0.169 * r - 0.331 * g + 0.5 * b
    const cr = 128 + 0.5 * r - 0.419 * g - 0.081 * b
    return cb >= 77 && cb <= 135 && cr >= 133 && cr <= 180 && y > 60
  }

  // 灰度 Sobel 梯度幅值（一次性预计算，Uint8）
  let grad = null
  if (edgeGuard) {
    const gray = new Float32Array(n)
    for (let k = 0; k < n; k++) {
      const i = k * 4
      gray[k] = LUMA_R * data[i] + LUMA_G * data[i + 1] + LUMA_B * data[i + 2]
    }
    grad = new Uint8Array(n)
    const gAt = (x, y) => {
      const gx = x < 0 ? 0 : x >= w ? w - 1 : x
      const gy = y < 0 ? 0 : y >= h ? h - 1 : y
      return gray[gy * w + gx]
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const gx =
          gAt(x + 1, y - 1) + 2 * gAt(x + 1, y) + gAt(x + 1, y + 1) -
          gAt(x - 1, y - 1) - 2 * gAt(x - 1, y) - gAt(x - 1, y + 1)
        const gy =
          gAt(x - 1, y + 1) + 2 * gAt(x, y + 1) + gAt(x + 1, y + 1) -
          gAt(x - 1, y - 1) - 2 * gAt(x, y - 1) - gAt(x + 1, y - 1)
        const mag = Math.abs(gx) + Math.abs(gy)
        grad[y * w + x] = mag > 255 ? 255 : Math.round(mag)
      }
    }
  }

  const alpha = new Uint8ClampedArray(n)
  alpha.fill(255)
  const mask = new Uint8Array(n) // 1 = 背景
  const keep = new Uint8Array(n) // 1 = 保护种子

  const region = new Int16Array(n).fill(-1) // 每个像素所属区域 id
  const refR = new Uint8Array(MAX_REGION)
  const refG = new Uint8Array(MAX_REGION)
  const refB = new Uint8Array(MAX_REGION)
  let regionCount = 0

  const queueIdx = new Int32Array(n)
  const queueRef = new Int16Array(n)
  let head = 0
  let tail = 0

  const inBounds = (x, y) => x >= 0 && y >= 0 && x < w && y < h

  for (const [x, y] of keepSeeds) {
    if (inBounds(x, y)) keep[y * w + x] = 1
  }

  // 新建区域；超过上限时复用最接近的既有参考色，避免 Int16 溢出
  const newRegion = (r, g, b) => {
    if (regionCount < MAX_REGION) {
      const id = regionCount++
      refR[id] = r
      refG[id] = g
      refB[id] = b
      return id
    }
    let best = 0
    let bestD = Infinity
    for (let k = 0; k < regionCount; k++) {
      const d = Math.max(
        Math.abs(r - refR[k]),
        Math.abs(g - refG[k]),
        Math.abs(b - refB[k])
      )
      if (d < bestD) {
        bestD = d
        best = k
      }
    }
    return best
  }

  let bgCount = 0
  const markBg = (idx) => {
    mask[idx] = 1
    alpha[idx] = 0
    bgCount++
  }

  const seedPixel = (idx) => {
    if (idx < 0 || idx >= n || keep[idx] || mask[idx]) return
    if (region[idx] !== -1) return
    const i = idx * 4
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    // 边缘种子若与全局背景中位数偏差过大（如肩部顶到画面边缘），不当作背景种子，
    // 否则主体会沿边界自成一区被整块抠掉
    const edgeDist = Math.max(
      Math.abs(r - det.bg[0]),
      Math.abs(g - det.bg[1]),
      Math.abs(b - det.bg[2])
    )
    if (edgeDist > driftTol) return
    const rid = newRegion(r, g, b)
    region[idx] = rid
    queueIdx[tail] = idx
    queueRef[tail] = rid
    tail++
  }

  // 种子：图像最外 1px 全部像素，每个种子携带自己的参考色
  for (let x = 0; x < w; x++) {
    seedPixel(x)
    seedPixel((h - 1) * w + x)
  }
  for (let y = 0; y < h; y++) {
    seedPixel(y * w)
    seedPixel(y * w + w - 1)
  }

  const growNeighbors = (idx, rid) => {
    const x = idx % w
    const y = (idx - x) / w
    const pi = idx * 4
    const pr = data[pi]
    const pg = data[pi + 1]
    const pb = data[pi + 2]
    const rr = refR[rid]
    const rg = refG[rid]
    const rb = refB[rid]

    const tryN = (ni) => {
      if (region[ni] !== -1 || keep[ni] || mask[ni]) return
      const qi = ni * 4
      const qr = data[qi]
      const qg = data[qi + 1]
      const qb = data[qi + 2]
      // 局部平滑：与入队前驱像素的颜色差
      const step = Math.max(Math.abs(qr - pr), Math.abs(qg - pg), Math.abs(qb - pb))
      // 漂移有界：与该区域种子色的颜色差
      const drift = Math.max(Math.abs(qr - rr), Math.abs(qg - rg), Math.abs(qb - rb))
      if (step > stepTol || drift > driftTol) return
      // 肤色保护：肤色像素必须与参考色几乎同色才可入背景，否则阻断生长
      if (skinGuard && isSkin(qr, qg, qb) && drift > skinTol) return
      // 强边缘屏障：颜色跳变明显处要求梯度足够低才允许跨越
      if (edgeGuard && step > 6 && grad[ni] > edgeTol) return
      region[ni] = rid
      queueIdx[tail] = ni
      queueRef[tail] = rid
      tail++
    }

    if (x > 0) tryN(idx - 1)
    if (x < w - 1) tryN(idx + 1)
    if (y > 0) tryN(idx - w)
    if (y < h - 1) tryN(idx + w)
  }

  while (head < tail) {
    const idx = queueIdx[head]
    const rid = queueRef[head]
    head++
    if (!mask[idx]) markBg(idx)
    growNeighbors(idx, rid)
  }

  // 手动擦除种子：以其自身颜色为参考单独生长一块并入背景
  for (const [x, y] of eraseSeeds) {
    if (!inBounds(x, y)) continue
    const idx = y * w + x
    if (keep[idx]) continue
    const i = idx * 4
    const rid = newRegion(data[i], data[i + 1], data[i + 2])
    if (!mask[idx]) markBg(idx)
    // 重置访问标记，从该种子重新生长（已判背景的像素不再进入）
    region.fill(-1)
    head = 0
    tail = 0
    region[idx] = rid
    queueIdx[tail] = idx
    queueRef[tail] = rid
    tail++
    while (head < tail) {
      const cur = queueIdx[head]
      const crid = queueRef[head]
      head++
      if (!mask[cur]) markBg(cur)
      growNeighbors(cur, crid)
    }
  }

  const coverage = bgCount / n
  let ok = true
  let reason = ''
  if (coverage > 0.92) {
    ok = false
    reason = '识别到的背景超过 92%，可能整张图被误判，请手动点选背景区域'
  } else if (coverage < 0.05) {
    ok = false
    reason = '未能识别背景（颜色变化过大或过于杂乱），请手动点选背景区域'
  }

  return { alpha, coverage, ok, reason, bg: det.bg, variance: det.variance, mask }
}

/* ---------- 主体连通域统计（碎片化评估） ---------- */

/**
 * 对 alpha>128 的像素做 4 邻域连通域标记，统计面积 ≥ 总面积 minFrac 的「有效主体块」。
 * @param {Uint8ClampedArray|Uint8Array} alpha
 * @param {number} w
 * @param {number} h
 * @param {number} [minFrac=0.005] 有效块最小面积占比（默认 0.5%）
 * @returns {{count:number,total:number,largest:number}}
 *   count = 有效主体块数；total = 前景像素总数；largest = 最大有效块面积
 */
export function countSubjectComponents(alpha, w, h, minFrac = 0.005) {
  const n = w * h
  const fg = new Uint8Array(n)
  let total = 0
  for (let i = 0; i < n; i++) {
    if (alpha[i] > 128) {
      fg[i] = 1
      total++
    }
  }
  if (total === 0) return { count: 0, total: 0, largest: 0 }

  const label = new Int32Array(n).fill(-1)
  const stack = new Int32Array(n)
  const minArea = n * minFrac
  let count = 0
  let largest = 0

  for (let start = 0; start < n; start++) {
    if (!fg[start] || label[start] !== -1) continue
    let top = 0
    stack[top++] = start
    label[start] = start
    let area = 0

    while (top > 0) {
      const idx = stack[--top]
      const x = idx % w
      const y = (idx - x) / w
      area++
      const push = (ni) => {
        if (fg[ni] && label[ni] === -1) {
          label[ni] = start
          stack[top++] = ni
        }
      }
      if (x > 0) push(idx - 1)
      if (x < w - 1) push(idx + 1)
      if (y > 0) push(idx - w)
      if (y < h - 1) push(idx + w)
    }

    if (area >= minArea) {
      count++
      if (area > largest) largest = area
    }
  }

  return { count, total, largest }
}

/** 碎片化分数：主体块数 / max(1, 最大块占前景比例)，越小越好 */
export function fragmentationScore(count, total, largest) {
  return count / Math.max(1, largest / Math.max(1, total))
}

/**
 * 最大主体块的边界紧凑度：perim² / (4π·area)。圆=1，人头肩部约 1.5–4，
 * 被侵蚀出毛边/空洞的主体会显著升高（实测 >5.5）。用于检测「颜色过于接近
 * 导致区域生长啃食主体」的无声失败。
 */
export function boundaryCompactness(alpha, w, h) {
  const IS = 128
  const subj = new Uint8Array(w * h)
  let total = 0
  for (let i = 0; i < w * h; i++) if (alpha[i] > IS) { subj[i] = 1; total++ }
  if (!total) return 0
  const lbl = new Int32Array(w * h)
  const qx = new Int32Array(w * h)
  let nl = 0, bestArea = 0, bestLbl = 0
  for (let s = 0; s < w * h; s++) {
    if (!subj[s] || lbl[s]) continue
    nl++; let head = 0, tail = 0, area = 0
    qx[tail++] = s; lbl[s] = nl
    while (head < tail) {
      const cur = qx[head++]; area++
      const cy = (cur / w) | 0, cx = cur - cy * w
      if (cx > 0 && subj[cur - 1] && !lbl[cur - 1]) { lbl[cur - 1] = nl; qx[tail++] = cur - 1 }
      if (cx < w - 1 && subj[cur + 1] && !lbl[cur + 1]) { lbl[cur + 1] = nl; qx[tail++] = cur + 1 }
      if (cy > 0 && subj[cur - w] && !lbl[cur - w]) { lbl[cur - w] = nl; qx[tail++] = cur - w }
      if (cy < h - 1 && subj[cur + w] && !lbl[cur + w]) { lbl[cur + w] = nl; qx[tail++] = cur + w }
    }
    if (area > bestArea) { bestArea = area; bestLbl = nl }
  }
  let perim = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (lbl[i] !== bestLbl) continue
      if (x === 0 || !subj[i - 1] || lbl[i - 1] !== bestLbl) { perim++; continue }
      if (x === w - 1 || !subj[i + 1] || lbl[i + 1] !== bestLbl) { perim++; continue }
      if (y === 0 || !subj[i - w] || lbl[i - w] !== bestLbl) { perim++; continue }
      if (y === h - 1 || !subj[i + w] || lbl[i + w] !== bestLbl) { perim++ }
    }
  }
  return perim * perim / (4 * Math.PI * bestArea)
}

/** 侵蚀警告阈值（实测校准：正常头肩 1.5–4.5，被啃食 >5.5） */
const COMPACT_WARN = 5

/* ---------- 自适应分割（含碎片化自动重试） ---------- */

/**
 * 自适应分割外层：单轮成功后再做碎片化质量评估，碎片化时收紧容差重试，
 * 择优返回，不依赖任何颜色先验（灰度照片同样适用）。
 *
 * 重试策略：driftTol *= 0.7（下限 25）、stepTol *= 0.8（下限 5），最多 3 轮。
 * 每轮都必须通过 coverage 合理区间（0.15–0.9），否则丢弃。
 * 择优：碎片化分数最小者胜出。
 *
 * @param {{data:Uint8ClampedArray,width:number,height:number}} imageData
 * @param {object} [opts] 同 segmentAdaptivePass
 * @returns 同 segmentAdaptivePass，另加 { retried:number }（0 = 一次成功）
 */
export function segmentAdaptive(imageData, opts = {}) {
  const baseStep = opts.stepTol ?? 10
  const baseDrift = opts.driftTol ?? 55
  const MIN_COVERAGE = 0.15
  const MAX_COVERAGE = 0.9
  const MAX_FRAGMENTS = 8
  const MIN_LARGEST_RATIO = 0.6
  const MAX_RETRY = 3

  // 首轮：必须 ok 且 coverage 合理才值得评估/重试（否则原逻辑直接判定失败）
  const first = segmentAdaptivePass(imageData, { ...opts, stepTol: baseStep, driftTol: baseDrift })
  const inRange = (res) => res.ok && res.coverage >= MIN_COVERAGE && res.coverage <= MAX_COVERAGE
  if (!inRange(first)) return { ...first, retried: 0 }

  const evaluate = (res) => {
    const { count, total, largest } = countSubjectComponents(
      res.alpha, imageData.width, imageData.height
    )
    const largestRatio = largest / Math.max(1, total)
    const fragmented = count > MAX_FRAGMENTS || largestRatio < MIN_LARGEST_RATIO
    return {
      fragmented,
      score: fragmentationScore(count, total, largest),
    }
  }

  // 首轮成功且不碎片化 → 一次到位，不多跑
  const withWarn = (r) => {
    const compact = boundaryCompactness(r.alpha, imageData.width, imageData.height)
    // 两类无声失败：边界被啃出毛边（compact 高）/ 主体被大面积吞食（背景占比异常高）
    if (compact > COMPACT_WARN || r.coverage > 0.8) {
      return { ...r, warning: '背景与主体颜色过于接近，自动抠图可能不完整；建议切换「手动点选」模式，右键点选脸部等需保留的区域后重新抠图' }
    }
    return r
  }
  const firstEval = evaluate(first)
  if (!firstEval.fragmented) return withWarn({ ...first, retried: 0 })

  let best = first
  let bestScore = firstEval.score
  let bestRound = 0
  let driftTol = baseDrift
  let stepTol = baseStep

  for (let round = 1; round <= MAX_RETRY; round++) {
    driftTol = Math.max(25, Math.round(driftTol * 0.7))
    stepTol = Math.max(5, Math.round(stepTol * 0.8))
    const res = segmentAdaptivePass(imageData, { ...opts, stepTol, driftTol })
    if (!inRange(res)) continue // coverage 不合理 → 丢弃该轮
    const ev = evaluate(res)
    if (ev.score < bestScore) {
      best = res
      bestScore = ev.score
      bestRound = round
    }
  }

  return withWarn({ ...best, retried: bestRound })
}

/* ---------- 背景分割（4 邻域 BFS） ---------- */

/**
 * @param {{data:Uint8ClampedArray,width:number,height:number}} imageData
 * @param {{tol?:number,tolLum?:number,stepTol?:number,driftTol?:number,
 *   mode?:'strict'|'adaptive',eraseSeeds?:number[][],keepSeeds?:number[][],
 *   skinGuard?:boolean,edgeGuard?:boolean,skinTol?:number,edgeTol?:number}} opts
 *   mode='strict'（默认）：全局背景色 + 固定容差，向后兼容；
 *   mode='adaptive'：先跑自适应区域生长，失败再回退 strict。
 * @returns {{alpha:Uint8ClampedArray,coverage:number,ok:boolean,reason:string,bg:number[],variance:number,mask:Uint8Array}}
 */
export function segmentBackground(imageData, opts = {}) {
  const {
    tol = 38, tolLum = 42, stepTol = 10, driftTol = 55,
    mode = 'strict', eraseSeeds = [], keepSeeds = [],
    skinGuard = true, edgeGuard = true, skinTol = 14, edgeTol = 30,
  } = opts
  const { data, width: w, height: h } = imageData
  const n = w * h

  // 自适应模式：成功即返回，否则回退 strict（variance 检查仅作用于 strict）
  if (mode === 'adaptive') {
    const adaptive = segmentAdaptive(imageData, {
      stepTol, driftTol, eraseSeeds, keepSeeds,
      skinGuard, edgeGuard, skinTol, edgeTol,
    })
    if (adaptive.ok) return adaptive
    return segmentBackground(imageData, { ...opts, mode: 'strict' })
  }

  const det = detectBackgroundColor(imageData)
  const bg = det.bg
  const bgL = luma(bg[0], bg[1], bg[2])

  const hardAlpha = () => {
    const a = new Uint8ClampedArray(n)
    a.fill(255)
    return a
  }

  // 背景不均匀且没有手动种子 → 直接判定失败，避免乱抠
  if (det.variance > 60 && eraseSeeds.length === 0) {
    return {
      alpha: hardAlpha(),
      coverage: 0,
      ok: false,
      reason: '背景颜色不均匀（色差过大），请手动点选背景区域',
      bg,
      variance: det.variance,
      mask: new Uint8Array(n),
    }
  }

  const alpha = hardAlpha()
  const mask = new Uint8Array(n) // 1 = 背景
  const keep = new Uint8Array(n) // 1 = 保护种子
  const visited = new Uint8Array(n)
  const queue = new Int32Array(n)
  let head = 0
  let tail = 0

  const inBounds = (x, y) => x >= 0 && y >= 0 && x < w && y < h

  for (const [x, y] of keepSeeds) {
    if (inBounds(x, y)) keep[y * w + x] = 1
  }

  const enqueue = (idx) => {
    if (visited[idx]) return
    visited[idx] = 1
    queue[tail++] = idx
  }

  const acceptAgainst = (idx, ref, refL) => {
    const i = idx * 4
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const dist = Math.max(Math.abs(r - ref[0]), Math.abs(g - ref[1]), Math.abs(b - ref[2]))
    return dist <= tol && Math.abs(luma(r, g, b) - refL) <= tolLum
  }
  const accept = (idx) => acceptAgainst(idx, bg, bgL)

  let bgCount = 0
  const markBg = (idx) => {
    mask[idx] = 1
    alpha[idx] = 0
    bgCount++
  }

  // 用给定判定函数跑一轮 BFS，返回新入队数量
  const flood = (isAcceptable) => {
    head = 0
    tail = 0
    for (let i = 0; i < n; i++) visited[i] = 0
    const seed = (idx) => {
      if (visited[idx]) return
      visited[idx] = 1
      queue[tail++] = idx
    }
    const tryNeighbor = (idx) => {
      if (visited[idx] || keep[idx]) return
      if (mask[idx]) return
      if (isAcceptable(idx)) seed(idx)
    }
    for (let i = 0; i < n; i++) {
      if (seedFlags[i]) seed(i)
    }
    while (head < tail) {
      const idx = queue[head++]
      if (mask[idx]) continue
      markBg(idx)
      const x = idx % w
      const y = (idx - x) / w
      if (x > 0) tryNeighbor(idx - 1)
      if (x < w - 1) tryNeighbor(idx + 1)
      if (y > 0) tryNeighbor(idx - w)
      if (y < h - 1) tryNeighbor(idx + w)
    }
  }

  // 1) 四边种子 + 背景色判定
  const seedFlags = new Uint8Array(n)
  for (let x = 0; x < w; x++) {
    for (const y of [0, h - 1]) {
      const idx = y * w + x
      if (!keep[idx] && accept(idx)) seedFlags[idx] = 1
    }
  }
  for (let y = 0; y < h; y++) {
    for (const x of [0, w - 1]) {
      const idx = y * w + x
      if (!keep[idx] && accept(idx)) seedFlags[idx] = 1
    }
  }
  flood(accept)

  // 2) 手动擦除种子：强制判为背景，并以种子自身颜色为参考向外传播，
  //    这样点一下就能清掉整块误判的残留区域（受 keepSeeds 阻挡）
  for (const [x, y] of eraseSeeds) {
    if (!inBounds(x, y)) continue
    const idx = y * w + x
    if (keep[idx]) continue
    keep[idx] = 0
    if (!mask[idx]) markBg(idx)
    const i = idx * 4
    const ref = [data[i], data[i + 1], data[i + 2]]
    const refL = luma(ref[0], ref[1], ref[2])
    seedFlags.fill(0)
    // 以该种子为起点，先标记相邻候选
    for (let k = 0; k < n; k++) visited[k] = 0
    visited[idx] = 1
    head = 0
    tail = 0
    queue[tail++] = idx
    const tryNeighbor = (ni) => {
      if (visited[ni] || keep[ni] || mask[ni]) return
      if (acceptAgainst(ni, ref, refL)) {
        visited[ni] = 1
        queue[tail++] = ni
      }
    }
    while (head < tail) {
      const cur = queue[head++]
      if (!mask[cur]) markBg(cur)
      const cx = cur % w
      const cy = (cur - cx) / w
      if (cx > 0) tryNeighbor(cur - 1)
      if (cx < w - 1) tryNeighbor(cur + 1)
      if (cy > 0) tryNeighbor(cur - w)
      if (cy < h - 1) tryNeighbor(cur + w)
    }
  }

  const coverage = bgCount / n
  let ok = true
  let reason = ''
  if (coverage > 0.92) {
    ok = false
    reason = '识别到的背景超过 92%，可能整张图被误判，请手动点选背景区域'
  } else if (coverage < 0.05) {
    ok = false
    reason = '未能识别纯色背景，请手动点选背景区域'
  }

  return { alpha, coverage, ok, reason, bg, variance: det.variance, mask }
}

/* ---------- 边缘 alpha 精修 ---------- */

/**
 * BFS 得到的是二值掩膜，其边界落在容差阈值处（通常远离 50% 覆盖线），
 * 直接羽化会让边界像素 alpha 高估真实覆盖率，去色边后仍残留背景色。
 * 这里对「紧邻背景的主体像素」用线性反混合估算 alpha：
 *   C ≈ bg + a * (F - bg)  →  a = <C-bg, F-bg> / |F-bg|²
 * F 取邻域内「深前景」像素的均值（非边界的主体像素）。
 */
export function refineEdgeAlpha(imageData, mask, bg, w, h) {
  const { data } = imageData
  const n = w * h
  const alpha = new Uint8ClampedArray(n)
  for (let i = 0; i < n; i++) alpha[i] = mask[i] ? 0 : 255

  const isBand = new Uint8Array(n)
  const band = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x
      if (mask[idx]) continue
      if (
        (x > 0 && mask[idx - 1]) ||
        (x < w - 1 && mask[idx + 1]) ||
        (y > 0 && mask[idx - w]) ||
        (y < h - 1 && mask[idx + w])
      ) {
        isBand[idx] = 1
        band.push(idx)
      }
    }
  }

  const deepFg = (idx) => !mask[idx] && !isBand[idx]

  for (const idx of band) {
    const x = idx % w
    const y = (idx - x) / w
    const i = idx * 4
    const cr = data[i]
    const cg = data[i + 1]
    const cb = data[i + 2]

    let fr = 0
    let fg = 0
    let fb = 0
    let count = 0
    for (const rad of [3, 5]) {
      fr = fg = fb = count = 0
      for (let dy = -rad; dy <= rad; dy++) {
        const ny = y + dy
        if (ny < 0 || ny >= h) continue
        for (let dx = -rad; dx <= rad; dx++) {
          const nx = x + dx
          if (nx < 0 || nx >= w) continue
          const ni = ny * w + nx
          if (!deepFg(ni)) continue
          const o = ni * 4
          fr += data[o]
          fg += data[o + 1]
          fb += data[o + 2]
          count++
        }
      }
      if (count >= 4) break
    }

    if (count < 4) continue // 没有可靠前景参考，保持 alpha=255

    fr /= count
    fg /= count
    fb /= count
    const vr = fr - bg[0]
    const vg = fg - bg[1]
    const vb = fb - bg[2]
    const denom = vr * vr + vg * vg + vb * vb
    if (denom < 100) continue // 前景与背景过于接近，无法可靠反混合

    const a = ((cr - bg[0]) * vr + (cg - bg[1]) * vg + (cb - bg[2]) * vb) / denom
    alpha[idx] = clamp(Math.round(a * 255), 0, 255)
  }

  return alpha
}

/* ---------- 掩膜清理 ---------- */

/**
 * 3×3 众数滤波，两轮，去除椒盐噪点。
 * @param {Uint8Array|Uint8ClampedArray} mask 0/1 掩膜（非 0 视为背景）
 */
export function cleanMask(mask, w, h) {
  let cur = Uint8Array.from(mask, (v) => (v ? 1 : 0))
  const n = w * h
  for (let round = 0; round < 2; round++) {
    const next = new Uint8Array(n)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
              sum += cur[y * w + x] // 边缘复制
            } else {
              sum += cur[ny * w + nx]
            }
          }
        }
        next[y * w + x] = sum >= 5 ? 1 : 0
      }
    }
    cur = next
  }
  return cur
}

/* ---------- 边缘羽化 ---------- */

function gaussianKernel(radius) {
  const sigma = Math.max(0.5, radius / 2)
  const size = radius * 2 + 1
  const k = new Float32Array(size)
  let sum = 0
  for (let i = 0; i < size; i++) {
    const d = i - radius
    const v = Math.exp(-(d * d) / (2 * sigma * sigma))
    k[i] = v
    sum += v
  }
  for (let i = 0; i < size; i++) k[i] /= sum
  return { k, radius }
}

/**
 * 高斯模糊 alpha（输入 0..255），输出 0..255，边缘像素得到中间值。
 */
export function featherAlpha(alpha, w, h, radius = 1) {
  const { k, radius: r } = gaussianKernel(Math.max(1, Math.round(radius)))
  const n = w * h
  const src = new Float32Array(n)
  for (let i = 0; i < n; i++) src[i] = alpha[i]

  const tmp = new Float32Array(n)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0
      for (let t = -r; t <= r; t++) {
        const nx = clamp(x + t, 0, w - 1)
        acc += src[y * w + nx] * k[t + r]
      }
      tmp[y * w + x] = acc
    }
  }

  const out = new Uint8ClampedArray(n)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0
      for (let t = -r; t <= r; t++) {
        const ny = clamp(y + t, 0, h - 1)
        acc += tmp[ny * w + x] * k[t + r]
      }
      out[y * w + x] = acc
    }
  }
  return out
}

/* ---------- 去色边 ---------- */

/**
 * 对半透明边缘像素做背景色反混合：fg = (C - (1-a) * bg) / a
 * @returns 新的 ImageData 结构（不修改入参）
 */
export function decontaminate(imageData, alpha, bg) {
  const { data, width: w, height: h } = imageData
  const out = makeImageData(w, h)
  out.data.set(data)
  const od = out.data
  const n = w * h
  for (let idx = 0; idx < n; idx++) {
    const a = alpha[idx] / 255
    if (a <= 0.05 || a >= 0.95) continue
    const i = idx * 4
    od[i] = clamp((data[i] - (1 - a) * bg[0]) / a, 0, 255)
    od[i + 1] = clamp((data[i + 1] - (1 - a) * bg[1]) / a, 0, 255)
    od[i + 2] = clamp((data[i + 2] - (1 - a) * bg[2]) / a, 0, 255)
    od[i + 3] = 255
  }
  return out
}

/* ---------- 合成 ---------- */

function lighten(c, f) {
  return c.map((v) => clamp(Math.round(v * (1 + f)), 0, 255))
}
function darken(c, f) {
  return c.map((v) => clamp(Math.round(v * (1 - f)), 0, 255))
}

function resolveBackground(bgOrGradient) {
  if (Array.isArray(bgOrGradient)) {
    return { solid: bgOrGradient, top: null, bottom: null }
  }
  if (bgOrGradient && typeof bgOrGradient === 'object') {
    const base = bgOrGradient.base || bgOrGradient.from || [255, 255, 255]
    const top = bgOrGradient.top || lighten(base, 0.08)
    const bottom = bgOrGradient.bottom || bgOrGradient.to || darken(base, 0.08)
    return { solid: base, top, bottom }
  }
  return { solid: [255, 255, 255], top: null, bottom: null }
}

/**
 * alpha 合成到纯色 / 竖直渐变背景。
 * @param bgOrGradient [r,g,b] 纯色，或 {base|from, top, bottom|to} 渐变
 */
export function composite(imageData, alpha, bgOrGradient) {
  const { data, width: w, height: h } = imageData
  const { solid, top, bottom } = resolveBackground(bgOrGradient)
  const out = makeImageData(w, h)
  const od = out.data
  const useGradient = top && bottom
  const denom = h > 1 ? h - 1 : 1

  for (let y = 0; y < h; y++) {
    let cr = solid[0]
    let cg = solid[1]
    let cb = solid[2]
    if (useGradient) {
      const t = y / denom
      cr = Math.round(top[0] + (bottom[0] - top[0]) * t)
      cg = Math.round(top[1] + (bottom[1] - top[1]) * t)
      cb = Math.round(top[2] + (bottom[2] - top[2]) * t)
    }
    for (let x = 0; x < w; x++) {
      const idx = y * w + x
      const i = idx * 4
      const a = alpha[idx] / 255
      od[i] = data[i] * a + cr * (1 - a)
      od[i + 1] = data[i + 1] * a + cg * (1 - a)
      od[i + 2] = data[i + 2] * a + cb * (1 - a)
      od[i + 3] = 255
    }
  }
  return out
}

/* ---------- 主体包围盒 ---------- */

/**
 * 按 alpha 求主体包围盒，忽略面积 < 总前景 2% 的噪声连通块。
 * @returns {{x:number,y:number,w:number,h:number}|null}
 */
export function subjectBox(alpha, w, h) {
  const n = w * h
  const fg = new Uint8Array(n)
  let total = 0
  for (let i = 0; i < n; i++) {
    if (alpha[i] > 128) {
      fg[i] = 1
      total++
    }
  }
  if (total === 0) return null

  const label = new Int32Array(n).fill(-1)
  const stack = new Int32Array(n)
  const comps = []

  for (let start = 0; start < n; start++) {
    if (!fg[start] || label[start] !== -1) continue
    const cid = comps.length
    let top = 0
    stack[top++] = start
    label[start] = cid
    let area = 0
    let x0 = w
    let y0 = h
    let x1 = -1
    let y1 = -1

    while (top > 0) {
      const idx = stack[--top]
      const x = idx % w
      const y = (idx - x) / w
      area++
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y

      const push = (ni) => {
        if (fg[ni] && label[ni] === -1) {
          label[ni] = cid
          stack[top++] = ni
        }
      }
      if (x > 0) push(idx - 1)
      if (x < w - 1) push(idx + 1)
      if (y > 0) push(idx - w)
      if (y < h - 1) push(idx + w)
    }

    comps.push({ area, x0, y0, x1, y1 })
  }

  const minArea = total * 0.02
  let kept = comps.filter((c) => c.area >= minArea)
  if (kept.length === 0) {
    // 全是小碎块时退化为最大连通块
    kept = [comps.reduce((a, b) => (b.area > a.area ? b : a))]
  }

  let x0 = w
  let y0 = h
  let x1 = -1
  let y1 = -1
  for (const c of kept) {
    if (c.x0 < x0) x0 = c.x0
    if (c.y0 < y0) y0 = c.y0
    if (c.x1 > x1) x1 = c.x1
    if (c.y1 > y1) y1 = c.y1
  }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

/* ---------- 裁剪缩放 ---------- */

/**
 * 按主体框裁剪并缩放至目标尺寸。headBias 让裁剪窗口上移（头顶留白）。
 * box 为空时退化为整图中心裁剪。
 * @returns ImageData 结构（目标尺寸）
 */
export function cropToBox(imageData, box, targetW, targetH, headBias = 0.08) {
  const { data, width: w, height: h } = imageData
  const tw = Math.max(1, Math.round(targetW))
  const th = Math.max(1, Math.round(targetH))
  const ar = tw / th

  const base = box || { x: 0, y: 0, w, h }
  let bw = base.w
  let bh = base.h
  if (bw / bh > ar) bh = bw / ar
  else bw = bh * ar

  const cx = base.x + base.w / 2
  const cy = base.y + base.h / 2 - (box ? headBias * base.h : 0)

  let sx = cx - bw / 2
  let sy = cy - bh / 2
  if (bw <= w) sx = clamp(sx, 0, w - bw)
  if (bh <= h) sy = clamp(sy, 0, h - bh)

  const out = makeImageData(tw, th)
  const od = out.data

  const sample = (fx, fy) => {
    const x = clamp(fx, 0, w - 1)
    const y = clamp(fy, 0, h - 1)
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const x1 = Math.min(w - 1, x0 + 1)
    const y1 = Math.min(h - 1, y0 + 1)
    const dx = x - x0
    const dy = y - y0
    const i00 = (y0 * w + x0) * 4
    const i10 = (y0 * w + x1) * 4
    const i01 = (y1 * w + x0) * 4
    const i11 = (y1 * w + x1) * 4
    const w00 = (1 - dx) * (1 - dy)
    const w10 = dx * (1 - dy)
    const w01 = (1 - dx) * dy
    const w11 = dx * dy
    return {
      r: data[i00] * w00 + data[i10] * w10 + data[i01] * w01 + data[i11] * w11,
      g: data[i00 + 1] * w00 + data[i10 + 1] * w10 + data[i01 + 1] * w01 + data[i11 + 1] * w11,
      b: data[i00 + 2] * w00 + data[i10 + 2] * w10 + data[i01 + 2] * w01 + data[i11 + 2] * w11,
    }
  }

  for (let ty = 0; ty < th; ty++) {
    const fy = sy + (ty + 0.5) * bh / th - 0.5
    for (let tx = 0; tx < tw; tx++) {
      const fx = sx + (tx + 0.5) * bw / tw - 0.5
      const c = sample(fx, fy)
      const o = (ty * tw + tx) * 4
      od[o] = c.r
      od[o + 1] = c.g
      od[o + 2] = c.b
      od[o + 3] = 255
    }
  }
  return out
}

/* ---------- 一步出图 ---------- */

/**
 * 合成 + 主体裁剪，输出目标尺寸 canvas。
 * alpha 为空时保留原背景，仅做中心裁剪。
 * @param {{bg?:number[],preset?:{width?:number,height?:number,w?:number,h?:number},gradient?:boolean|object}} opts
 */
export function renderIdPhoto(imageData, alpha, opts = {}) {
  const { bg = [255, 255, 255], preset, gradient = false } = opts
  const w = imageData.width
  const h = imageData.height
  const tw = Number(preset?.width ?? preset?.w ?? 295)
  const th = Number(preset?.height ?? preset?.h ?? 413)

  const bgArg = gradient
    ? typeof gradient === 'object'
      ? gradient
      : { base: bg }
    : bg

  let composed
  let box = null
  if (alpha) {
    let a = alpha
    // 入参若是未精修的二值 alpha，自动补做边缘反混合 + 羽化，保证直接可用
    let soft = false
    for (let i = 0; i < a.length; i++) {
      if (a[i] > 20 && a[i] < 235) { soft = true; break }
    }
    if (!soft) {
      const mask = new Uint8Array(a.length)
      for (let i = 0; i < a.length; i++) mask[i] = a[i] ? 0 : 1
      a = featherAlpha(refineEdgeAlpha(imageData, mask, bg, w, h), w, h, 1)
    }
    const fg = decontaminate(imageData, a, bg)
    composed = composite(fg, a, bgArg)
    box = subjectBox(a, w, h)
  } else {
    composed = imageData
  }

  const out = cropToBox(composed, box, tw, th, box ? 0.08 : 0)
  const canvas = createCanvas(tw, th)
  const ctx = canvas.getContext('2d')
  const native =
    typeof ImageData !== 'undefined' && !(out instanceof ImageData)
      ? new ImageData(out.data, tw, th)
      : out
  ctx.putImageData(native, 0, 0)
  return canvas
}
