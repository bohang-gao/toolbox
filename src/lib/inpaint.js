// 经典图像修复（纯 JS，零依赖）
// 输入输出统一为 { data, width, height }（data 为 RGBA 字节数组），
// 不依赖 DOM，方便在浏览器与 Node 中复用。

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v)
const smoothstep = (a, b, x) => {
  if (x <= a) return 0
  if (x >= b) return 1
  const t = (x - a) / (b - a)
  return t * t * (3 - 2 * t)
}

/**
 * 3×3 邻域计数膨胀。每个像素统计 8 邻域 + 自身中被标记的个数，
 * 只要 ≥1 就置 1（即标准膨胀），迭代 r 次得到外扩 r 像素的蒙版。
 */
export function expandMask(mask, w, h, r = 1) {
  const n = w * h
  const R = Math.max(0, Math.round(r))
  let cur = mask
  for (let it = 0; it < R; it++) {
    const out = new Uint8Array(n)
    for (let y = 0; y < h; y++) {
      const row = y * w
      const up = y > 0 ? row - w : -1
      const dn = y + 1 < h ? row + w : -1
      for (let x = 0; x < w; x++) {
        const i = row + x
        if (cur[i]) { out[i] = 1; continue }
        let c = 0
        if (x > 0 && cur[i - 1]) c++
        if (x + 1 < w && cur[i + 1]) c++
        if (up >= 0) {
          if (cur[up + x]) c++
          if (x > 0 && cur[up + x - 1]) c++
          if (x + 1 < w && cur[up + x + 1]) c++
        }
        if (dn >= 0) {
          if (cur[dn + x]) c++
          if (x > 0 && cur[dn + x - 1]) c++
          if (x + 1 < w && cur[dn + x + 1]) c++
        }
        out[i] = c >= 1 ? 1 : 0
      }
    }
    cur = out
  }
  return cur
}

/* ---------- 可分离盒式模糊（3 次 ≈ 高斯） ---------- */

function boxH(src, dst, w, h, r) {
  const d = 2 * r + 1
  for (let y = 0; y < h; y++) {
    const row = y * w
    let sum = 0
    for (let k = -r; k <= r; k++) {
      const xx = k < 0 ? 0 : k >= w ? w - 1 : k
      sum += src[row + xx]
    }
    for (let x = 0; x < w; x++) {
      dst[row + x] = sum / d
      const addX = x + r + 1
      const subX = x - r
      sum += src[row + (addX >= w ? w - 1 : addX)]
      sum -= src[row + (subX < 0 ? 0 : subX)]
    }
  }
}

function boxV(src, dst, w, h, r) {
  const d = 2 * r + 1
  for (let x = 0; x < w; x++) {
    let sum = 0
    for (let k = -r; k <= r; k++) {
      const yy = k < 0 ? 0 : k >= h ? h - 1 : k
      sum += src[yy * w + x]
    }
    for (let y = 0; y < h; y++) {
      dst[y * w + x] = sum / d
      const addY = y + r + 1
      const subY = y - r
      sum += src[(addY >= h ? h - 1 : addY) * w + x]
      sum -= src[(subY < 0 ? 0 : subY) * w + x]
    }
  }
}

/** 单通道浮点平面高斯近似；3 次盒式模糊，半径由 sigma 推导 */
export function blurPlane(src, w, h, sigma) {
  const s = Math.max(0.1, Number(sigma) || 0)
  const r = Math.max(1, Math.round((Math.sqrt(4 * s * s + 1) - 1) / 2))
  let a = Float32Array.from(src)
  let b = new Float32Array(w * h)
  for (let p = 0; p < 3; p++) {
    boxH(a, b, w, h, r)
    boxV(b, a, w, h, r)
  }
  return a
}

/* ---------- 多尺度 pull-push 填充 ---------- */

function sampleBilinear(plane, cw, ch, u, v) {
  const x0 = Math.max(0, Math.min(cw - 1, Math.floor(u)))
  const y0 = Math.max(0, Math.min(ch - 1, Math.floor(v)))
  const x1 = Math.min(cw - 1, x0 + 1)
  const y1 = Math.min(ch - 1, y0 + 1)
  const fx = Math.max(0, Math.min(1, u - x0))
  const fy = Math.max(0, Math.min(1, v - y0))
  const a = plane[y0 * cw + x0]
  const b = plane[y0 * cw + x1]
  const c = plane[y1 * cw + x0]
  const d = plane[y1 * cw + x1]
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy
}

function buildBaseLevel(data, mask, w, h) {
  const n = w * h
  const r = new Float32Array(n)
  const g = new Float32Array(n)
  const b = new Float32Array(n)
  const wt = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    if (mask[i]) continue // 待填充：权重 0
    const j = i * 4
    r[i] = data[j]
    g[i] = data[j + 1]
    b[i] = data[j + 2]
    wt[i] = 1
  }
  return { w, h, r, g, b, wt }
}

function downsampleLevel(lv) {
  const cw = (lv.w + 1) >> 1
  const ch = (lv.h + 1) >> 1
  const n = cw * ch
  const r = new Float32Array(n)
  const g = new Float32Array(n)
  const b = new Float32Array(n)
  const wt = new Float32Array(n)
  for (let cy = 0; cy < ch; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      let sr = 0, sg = 0, sb = 0, sw = 0, cnt = 0
      for (let dy = 0; dy < 2; dy++) {
        const y = cy * 2 + dy
        if (y >= lv.h) continue
        for (let dx = 0; dx < 2; dx++) {
          const x = cx * 2 + dx
          if (x >= lv.w) continue
          const i = y * lv.w + x
          const ww = lv.wt[i]
          sr += lv.r[i] * ww
          sg += lv.g[i] * ww
          sb += lv.b[i] * ww
          sw += ww
          cnt++
        }
      }
      const o = cy * cw + cx
      if (sw > 0) {
        r[o] = sr / sw
        g[o] = sg / sw
        b[o] = sb / sw
      }
      wt[o] = cnt > 0 ? sw / cnt : 0
    }
  }
  return { w: cw, h: ch, r, g, b, wt }
}

/**
 * 多尺度 pull-push：先按权重逐层下采样（粗层用邻域加权平均），
 * 最粗层用全局均值补空，再逐层双线性上采样回填细层。
 * 权重为 1 的像素（蒙版外）全程保持不变。
 */
function pullPushFill(data, mask, w, h) {
  const levels = [buildBaseLevel(data, mask, w, h)]
  while (levels[levels.length - 1].w > 4 || levels[levels.length - 1].h > 4) {
    levels.push(downsampleLevel(levels[levels.length - 1]))
  }

  const top = levels[levels.length - 1]
  let ar = 0, ag = 0, ab = 0, aw = 0
  for (let i = 0; i < top.w * top.h; i++) {
    if (top.wt[i] > 0) {
      ar += top.r[i]
      ag += top.g[i]
      ab += top.b[i]
      aw++
    }
  }
  if (aw > 0) { ar /= aw; ag /= aw; ab /= aw }
  const tn = top.w * top.h
  for (let i = 0; i < tn; i++) {
    if (top.wt[i] <= 0) {
      top.r[i] = ar
      top.g[i] = ag
      top.b[i] = ab
    }
  }

  for (let li = levels.length - 2; li >= 0; li--) {
    const fine = levels[li]
    const coarse = levels[li + 1]
    for (let y = 0; y < fine.h; y++) {
      const u = (y - 0.5) / 2
      for (let x = 0; x < fine.w; x++) {
        const i = y * fine.w + x
        const fw = fine.wt[i]
        if (fw >= 0.999) continue
        const v = (x - 0.5) / 2
        const cr = sampleBilinear(coarse.r, coarse.w, coarse.h, v, u)
        const cg = sampleBilinear(coarse.g, coarse.w, coarse.h, v, u)
        const cb = sampleBilinear(coarse.b, coarse.w, coarse.h, v, u)
        const cw = sampleBilinear(coarse.wt, coarse.w, coarse.h, v, u)
        fine.r[i] = fine.r[i] * fw + cr * (1 - fw)
        fine.g[i] = fine.g[i] * fw + cg * (1 - fw)
        fine.b[i] = fine.b[i] * fw + cb * (1 - fw)
        fine.wt[i] = fw + (1 - fw) * cw
      }
    }
  }
  return levels[0]
}

/* ---------- 填充区后处理 ---------- */

function median9(arr) {
  // 插入排序取中位（9 个元素，开销可忽略）
  for (let i = 1; i < 9; i++) {
    const v = arr[i]
    let j = i - 1
    while (j >= 0 && arr[j] > v) { arr[j + 1] = arr[j]; j-- }
    arr[j + 1] = v
  }
  return arr[4]
}

function medianFilterMasked(out, mask, w, h) {
  const src = Uint8ClampedArray.from(out)
  const vals = new Array(9)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (!mask[i]) continue
      for (let c = 0; c < 3; c++) {
        let k = 0
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy
          if (yy < 0 || yy >= h) continue
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx
            if (xx < 0 || xx >= w) continue
            vals[k++] = src[(yy * w + xx) * 4 + c]
          }
        }
        while (k < 9) vals[k++] = src[i * 4 + c]
        out[i * 4 + c] = median9(vals)
      }
    }
  }
}

function samplePlane(data, w, h, x, y, c) {
  if (x < 0) x = 0
  if (y < 0) y = 0
  if (x > w - 1) x = w - 1
  if (y > h - 1) y = h - 1
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(w - 1, x0 + 1)
  const y1 = Math.min(h - 1, y0 + 1)
  const fx = x - x0
  const fy = y - y0
  const a = data[(y0 * w + x0) * 4 + c]
  const b = data[(y0 * w + x1) * 4 + c]
  const d = data[(y1 * w + x0) * 4 + c]
  const e = data[(y1 * w + x1) * 4 + c]
  return (a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + e * fx) * fy
}

/** 沿边缘方向（垂直于梯度）的 5 抽头模糊：保结构、去噪点 */
function edgeBlurMasked(out, mask, w, h) {
  const src = Uint8ClampedArray.from(out)
  const taps = [-2, -1, 0, 1, 2]
  const kws = [1, 2, 3, 2, 1]
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      if (!mask[i]) continue
      const lum = (xx, yy) => {
        const j = (yy * w + xx) * 4
        return src[j] * 0.299 + src[j + 1] * 0.587 + src[j + 2] * 0.114
      }
      const gx = lum(x + 1, y) - lum(x - 1, y)
      const gy = lum(x, y + 1) - lum(x, y - 1)
      const mag = Math.abs(gx) + Math.abs(gy)
      if (mag < 1e-3) continue
      // 边缘切向 = 梯度方向旋转 90°
      const tx = -gy / mag
      const ty = gx / mag
      let sum = 0
      let wsum = 0
      for (let k = 0; k < 5; k++) {
        const off = taps[k]
        const sx = x + tx * off
        const sy = y + ty * off
        const wgt = kws[k]
        const c0 = samplePlane(src, w, h, sx, sy, 0)
        const c1 = samplePlane(src, w, h, sx, sy, 1)
        const c2 = samplePlane(src, w, h, sx, sy, 2)
        const lumS = c0 * 0.299 + c1 * 0.587 + c2 * 0.114
        sum += lumS * wgt
        wsum += wgt
      }
      const target = sum / wsum
      const cur = lum(x, y)
      if (Math.abs(target - cur) > 0.5) {
        const d = (target - cur) * 0.75
        out[i * 4] = clamp255(src[i * 4] + d)
        out[i * 4 + 1] = clamp255(src[i * 4 + 1] + d)
        out[i * 4 + 2] = clamp255(src[i * 4 + 2] + d)
      }
    }
  }
}

/**
 * 经典修复：多尺度 pull-push 填充（粗→细）+ 填充区 3×3 中值滤波 + 边缘导向模糊。
 * 蒙版外像素逐位不变。
 * @param {{data:Uint8ClampedArray|Uint8Array,width:number,height:number}} imageData
 * @param {Uint8Array} mask 1 = 待填充
 * @param {{median?:boolean, edge?:boolean}} [opts]
 * @returns {{data:Uint8ClampedArray,width:number,height:number}}
 */
export function classicInpaint(imageData, mask, opts = {}) {
  const w = imageData.width
  const h = imageData.height
  const { median = true, edge = true } = opts
  const lv = pullPushFill(imageData.data, mask, w, h)
  const out = new Uint8ClampedArray(imageData.data) // 蒙版外逐位保留原值
  for (let i = 0; i < w * h; i++) {
    if (!mask[i]) continue
    const j = i * 4
    out[j] = clamp255(lv.r[i])
    out[j + 1] = clamp255(lv.g[i])
    out[j + 2] = clamp255(lv.b[i])
  }
  if (median) medianFilterMasked(out, mask, w, h)
  if (edge) edgeBlurMasked(out, mask, w, h)
  return { data: out, width: w, height: h }
}

/* ---------- 低频色彩补偿 ---------- */

/**
 * 低频色彩补偿：用「蒙版外像素」做归一化低通（蒙版区不参与），
 * 与「修复后全图」的低通做差，把低频差加回填充结果。
 * 只作用在蒙版外扩 8px 的范围内，避免影响无关区域。
 * 低通在 1/4 分辨率上完成，兼顾速度与平滑度。
 */
export function lowFreqMatch(filled, orig, mask, sigma = 24) {
  const w = filled.width
  const h = filled.height
  const n = w * h
  const ds = Math.max(w, h) > 256 ? 4 : 1
  const lw = Math.max(1, Math.ceil(w / ds))
  const lh = Math.max(1, Math.ceil(h / ds))
  const ln = lw * lh

  const bgW = new Float32Array(ln)
  const fillR = new Float32Array(ln)
  const fillG = new Float32Array(ln)
  const fillB = new Float32Array(ln)
  const bgR = new Float32Array(ln)
  const bgG = new Float32Array(ln)
  const bgB = new Float32Array(ln)

  for (let ly = 0; ly < lh; ly++) {
    for (let lx = 0; lx < lw; lx++) {
      let cr = 0, cg = 0, cb = 0, fr = 0, fg = 0, fb = 0, cnt = 0, known = 0
      for (let dy = 0; dy < ds; dy++) {
        const y = ly * ds + dy
        if (y >= h) continue
        for (let dx = 0; dx < ds; dx++) {
          const x = lx * ds + dx
          if (x >= w) continue
          const i = y * w + x
          const j = i * 4
          fr += filled.data[j]
          fg += filled.data[j + 1]
          fb += filled.data[j + 2]
          if (!mask[i]) {
            cr += orig.data[j]
            cg += orig.data[j + 1]
            cb += orig.data[j + 2]
            known++
          }
          cnt++
        }
      }
      const o = ly * lw + lx
      if (cnt > 0) {
        fillR[o] = fr / cnt
        fillG[o] = fg / cnt
        fillB[o] = fb / cnt
      }
      if (known > 0) {
        bgR[o] = cr / known
        bgG[o] = cg / known
        bgB[o] = cb / known
        bgW[o] = 1
      }
    }
  }

  // 归一化低通：分别对「颜色×权重」与「权重」做模糊，再相除
  const s = Math.max(1, sigma / ds)
  const wBlur = blurPlane(bgW, lw, lh, s)
  const rMul = new Float32Array(ln)
  const gMul = new Float32Array(ln)
  const bMul = new Float32Array(ln)
  for (let i = 0; i < ln; i++) {
    rMul[i] = bgR[i] * bgW[i]
    gMul[i] = bgG[i] * bgW[i]
    bMul[i] = bgB[i] * bgW[i]
  }
  const rBlur = blurPlane(rMul, lw, lh, s)
  const gBlur = blurPlane(gMul, lw, lh, s)
  const bBlur = blurPlane(bMul, lw, lh, s)
  const fR = blurPlane(fillR, lw, lh, s)
  const fG = blurPlane(fillG, lw, lh, s)
  const fB = blurPlane(fillB, lw, lh, s)

  // 蒙版区权重可能为 0（大面积遮挡），退化为全局背景均值
  let gr = 0, gg = 0, gb = 0, gc = 0
  for (let i = 0; i < ln; i++) {
    if (bgW[i] > 0) { gr += bgR[i]; gg += bgG[i]; gb += bgB[i]; gc++ }
  }
  if (gc > 0) { gr /= gc; gg /= gc; gb /= gc }

  const band = expandMask(mask, w, h, 8)
  const out = new Uint8ClampedArray(filled.data)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (!band[i]) continue
      const lu = (x - 0.5) / ds
      const lv = (y - 0.5) / ds
      const ww = sampleBilinear(wBlur, lw, lh, lu, lv)
      let br0, bg0, bb0
      if (ww > 1e-3) {
        br0 = sampleBilinear(rBlur, lw, lh, lu, lv) / ww
        bg0 = sampleBilinear(gBlur, lw, lh, lu, lv) / ww
        bb0 = sampleBilinear(bBlur, lw, lh, lu, lv) / ww
      } else {
        br0 = gr; bg0 = gg; bb0 = gb
      }
      const dr = br0 - sampleBilinear(fR, lw, lh, lu, lv)
      const dg = bg0 - sampleBilinear(fG, lw, lh, lu, lv)
      const db = bb0 - sampleBilinear(fB, lw, lh, lu, lv)
      const j = i * 4
      out[j] = clamp255(filled.data[j] + dr)
      out[j + 1] = clamp255(filled.data[j + 1] + dg)
      out[j + 2] = clamp255(filled.data[j + 2] + db)
    }
  }
  return { data: out, width: w, height: h }
}

/* ---------- 羽化合成 ---------- */

/**
 * 羽化合成：alpha = smoothstep(blur(mask, sigma))，
 * final = orig×(1−alpha) + filled×alpha。
 * 硬性约束：蒙版外像素逐位保持原图。
 */
export function featherComposite(orig, filled, mask, sigma = 4) {
  const w = orig.width
  const h = orig.height
  const n = w * h
  const m = new Float32Array(n)
  for (let i = 0; i < n; i++) m[i] = mask[i] ? 1 : 0
  const a = blurPlane(m, w, h, sigma)
  const out = new Uint8ClampedArray(orig.data) // 先逐位复制原图
  for (let i = 0; i < n; i++) {
    if (!mask[i]) continue // 遮罩外：保持原图，误差恒为 0
    const alpha = smoothstep(0.3, 0.75, a[i])
    const j = i * 4
    out[j] = orig.data[j] * (1 - alpha) + filled.data[j] * alpha
    out[j + 1] = orig.data[j + 1] * (1 - alpha) + filled.data[j + 1] * alpha
    out[j + 2] = orig.data[j + 2] * (1 - alpha) + filled.data[j + 2] * alpha
  }
  return { data: out, width: w, height: h }
}
