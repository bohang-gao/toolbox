// 证件照算法自测脚本：node src/lib/portrait.test.mjs
// 不依赖浏览器，自行构造 ImageData 结构 + 极简 OffscreenCanvas 桩。
import {
  detectBackgroundColor,
  segmentBackground,
  cleanMask,
  featherAlpha,
  decontaminate,
  composite,
  subjectBox,
  cropToBox,
  renderIdPhoto,
  refineEdgeAlpha,
  makeImageData,
} from './portrait.js'
import { SIZE_PRESETS, getPreset, A4, layoutA4 } from './idphoto.js'

/* ---------- 极简断言框架 ---------- */
let pass = 0
let fail = 0
function check(name, cond, detail = '') {
  if (cond) {
    pass++
    console.log(`  PASS  ${name}${detail ? `  (${detail})` : ''}`)
  } else {
    fail++
    console.log(`  FAIL  ${name}${detail ? `  (${detail})` : ''}`)
  }
}
function section(title) {
  console.log(`\n[${title}]`)
}

/* ---------- canvas 桩（Node 无 canvas） ---------- */
class FakeCanvas {
  constructor(w, h) {
    this.width = w
    this.height = h
    this.draws = []
    this.puts = []
  }
  getContext() {
    const self = this
    return {
      fillStyle: '#fff',
      fillRect() {},
      drawImage(...args) {
        self.draws.push(args)
      },
      putImageData(img, x, y) {
        self.puts.push({ img, x, y })
      },
    }
  }
}
globalThis.OffscreenCanvas = FakeCanvas

/* ---------- 测试图构造 ---------- */
const BLUE = [51, 102, 204]
const SKIN = [233, 196, 160]
const SHOULDER = [70, 75, 85]

function insideEllipse(x, y, cx, cy, rx, ry) {
  const dx = (x - cx) / rx
  const dy = (y - cy) / ry
  return dx * dx + dy * dy <= 1
}

function makePortrait(w = 300, h = 420) {
  const img = makeImageData(w, h)
  const d = img.data
  const cx = 150
  const cy = 150
  const rx = 58
  const ry = 78

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      let color = BLUE

      // 肩部矩形（先画，会被头部覆盖）
      if (y >= 250 && x >= 75 && x <= 225) color = SHOULDER

      // 抗锯齿椭圆头像：4×4 超采样得到与背景的混合边缘
      let cov = 0
      for (let sy = 0; sy < 4; sy++) {
        for (let sx = 0; sx < 4; sx++) {
          if (insideEllipse(x + (sx + 0.5) / 4, y + (sy + 0.5) / 4, cx, cy, rx, ry)) cov++
        }
      }
      cov /= 16
      if (cov > 0) {
        color = [
          Math.round(SKIN[0] * cov + color[0] * (1 - cov)),
          Math.round(SKIN[1] * cov + color[1] * (1 - cov)),
          Math.round(SKIN[2] * cov + color[2] * (1 - cov)),
        ]
      }

      d[i] = color[0]
      d[i + 1] = color[1]
      d[i + 2] = color[2]
      d[i + 3] = 255
    }
  }
  return img
}

function makeClutter(w = 200, h = 200) {
  const img = makeImageData(w, h)
  const d = img.data
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const red = ((x >> 3) + (y >> 3)) % 2 === 0
      d[i] = red ? 220 : 20
      d[i + 1] = red ? 30 : 210
      d[i + 2] = red ? 25 : 35
      d[i + 3] = 255
    }
  }
  return img
}

/* ---------- 用例 1：背景色检测 ---------- */
section('背景色检测')
{
  const img = makePortrait()
  const { bg, variance } = detectBackgroundColor(img)
  check('纯蓝底中位数 ≈ (51,102,204)',
    Math.abs(bg[0] - 51) <= 2 && Math.abs(bg[1] - 102) <= 2 && Math.abs(bg[2] - 204) <= 2,
    `bg=${bg.map((v) => Math.round(v)).join(',')}`)
  check('均匀背景 variance <= 60', variance <= 60, `variance=${variance}`)
}

/* ---------- 用例 2：自动抠图 ---------- */
section('自动抠图')
let alphaRef
let maskRef
{
  const img = makePortrait()
  const res = segmentBackground(img)
  alphaRef = res.alpha
  maskRef = res.mask
  check('抠图成功 ok=true', res.ok === true, `coverage=${(res.coverage * 100).toFixed(1)}%`)
  check('coverage 在合理范围 (0.05, 0.92)',
    res.coverage > 0.05 && res.coverage <= 0.92,
    `coverage=${(res.coverage * 100).toFixed(1)}%`)

  const W = img.width
  const at = (x, y) => res.alpha[y * W + x]
  const bgPts = [[5, 5], [295, 5], [5, 415], [295, 415]]
  const bgMax = Math.max(...bgPts.map(([x, y]) => at(x, y)))
  check('背景区 alpha < 40', bgMax < 40, `背景采样最大 alpha=${bgMax}`)

  const fgPts = [[150, 150], [150, 340], [120, 120]]
  const fgMin = Math.min(...fgPts.map(([x, y]) => at(x, y)))
  check('主体区 alpha > 200', fgMin > 200, `主体采样最小 alpha=${fgMin}`)
}

/* ---------- 用例 3：掩膜清理 + 羽化 + 去色边 ---------- */
section('掩膜清理 / 羽化 / 去色边')
{
  const img = makePortrait()
  const W = img.width
  const H = img.height

  // 清理后的掩膜应保持背景为 1、主体为 0
  const cleaned = cleanMask(maskRef, W, H)
  check('清理后角落仍是背景', cleaned[5 * W + 5] === 1)
  check('清理后脸部仍是主体', cleaned[150 * W + 150] === 0)

  // 边缘 alpha 精修（反混合），再羽化
  const refined = refineEdgeAlpha(img, cleaned, BLUE, W, H)
  const feathered = featherAlpha(refined, W, H, 1)
  const edgePixels = []
  for (let i = 0; i < W * H; i++) {
    if (feathered[i] > 128 && feathered[i] < 242) edgePixels.push(i)
  }
  check('羽化产生半透明边缘像素', edgePixels.length > 50, `边缘像素=${edgePixels.length}`)

  const decon = decontaminate(img, feathered, BLUE)
  const dd = decon.data
  let maxBlue = 0
  for (const idx of edgePixels) {
    const b = dd[idx * 4 + 2]
    if (b > maxBlue) maxBlue = b
  }
  const blueIncrement = maxBlue - SKIN[2]
  check('边缘无明显蓝色残留（B 通道增量 < 30）',
    blueIncrement < 30,
    `最大增量=${blueIncrement.toFixed(1)}（maxB=${maxBlue.toFixed(1)}, skinB=${SKIN[2]}）`)

  // 合成到纯红底：背景应为红色，主体不应变红
  const comp = composite(decon, feathered, [255, 0, 0])
  const ci = (5 * W + 5) * 4
  check('纯色合成：背景像素变红',
    comp.data[ci] > 200 && comp.data[ci + 1] < 40 && comp.data[ci + 2] < 40,
    `rgb=${comp.data[ci]},${comp.data[ci + 1]},${comp.data[ci + 2]}`)

  // 渐变合成：顶部应比底部亮
  const grad = composite(decon, feathered, { base: [200, 200, 200] })
  const topI = (2 * W + 150) * 4
  const botI = (415 * W + 5) * 4
  check('渐变合成：顶部亮于底部',
    grad.data[topI] >= grad.data[botI],
    `top=${grad.data[topI]}, bottom=${grad.data[botI]}`)
}

/* ---------- 用例 4：主体框与裁剪 ---------- */
section('主体框 / 裁剪')
{
  const img = makePortrait()
  const box = subjectBox(alphaRef, img.width, img.height)
  check('主体包围盒非空', !!box, box ? `box=${JSON.stringify(box)}` : '')
  if (box) {
    check('包围盒覆盖头部与肩部',
      box.x <= 80 && box.x + box.w >= 220 && box.y <= 80,
      `x=${box.x}, y=${box.y}, w=${box.w}, h=${box.h}`)
  }

  const oneInch = getPreset('one-inch')
  const cropped = cropToBox(img, box, oneInch.width, oneInch.height)
  check('一寸裁剪输出 295×413',
    cropped.width === 295 && cropped.height === 413,
    `${cropped.width}×${cropped.height}`)
}

/* ---------- 用例 5：预设与 A4 ---------- */
section('尺寸预设 / A4 排版')
{
  const one = getPreset('one-inch')
  check('一寸预设 25×35mm → 295×413', one.width === 295 && one.height === 413,
    `${one.width}×${one.height}`)
  check('预设数量 = 8', SIZE_PRESETS.length === 8, `count=${SIZE_PRESETS.length}`)
  const small = getPreset('small-one-inch')
  check('小一寸预设 260×378', small.width === 260 && small.height === 378,
    `${small.width}×${small.height}`)

  const source = new FakeCanvas(295, 413)
  const a4 = layoutA4(source, one)
  check('A4 画布 2480×3508', a4.width === 2480 && a4.height === 3508,
    `${a4.width}×${a4.height}`)
  check('A4 排版含 8 个副本', a4.draws.length === 8, `draws=${a4.draws.length}`)

  // 一寸照片完整出图（含合成与裁剪）
  const img = makePortrait()
  const canvas = renderIdPhoto(img, alphaRef, { bg: [255, 255, 255], preset: one })
  check('renderIdPhoto 输出一寸 295×413',
    canvas.width === 295 && canvas.height === 413,
    `${canvas.width}×${canvas.height}`)
}

/* ---------- 用例 6：失败场景 ---------- */
section('失败场景（杂乱背景）')
{
  let res
  let threw = false
  try {
    res = segmentBackground(makeClutter())
  } catch (e) {
    threw = true
    console.log(`  ERROR ${e.message}`)
  }
  check('不抛异常', !threw)
  check('ok=false', res && res.ok === false, res ? `coverage=${(res.coverage * 100).toFixed(1)}%` : '')
  check('reason 非空', !!res && typeof res.reason === 'string' && res.reason.length > 0,
    res ? res.reason : '')

  // 失败时返回的 alpha 应全为不透明（不清空整图）
  if (res) {
    let opaque = true
    for (let i = 0; i < res.alpha.length; i += 97) {
      if (res.alpha[i] !== 255) { opaque = false; break }
    }
    check('失败时 alpha 全不透明（保守返回原图）', opaque)
  }
}

/* ---------- 用例 7：手动种子 ---------- */
section('手动点选种子')
{
  const img = makePortrait()
  // 在脸部中心放一个「擦除种子」，该区域应被强制判为背景
  const erase = segmentBackground(img, { eraseSeeds: [[150, 150]] })
  check('擦除种子点 alpha 变为 0（判为背景）',
    erase.alpha[150 * img.width + 150] < 40,
    `alpha=${erase.alpha[150 * img.width + 150]}`)

  // 在背景角落放「保护种子」，该点应永不判为背景
  const keep = segmentBackground(img, { keepSeeds: [[5, 5]] })
  check('保护种子点 alpha 保持 255（判为主体）',
    keep.alpha[5 * img.width + 5] === 255,
    `alpha=${keep.alpha[5 * img.width + 5]}`)

  // 擦除种子整块传播：孤立近背景色块（BFS 从边缘到不了）→ 点一下整块被清除
  const W = 200
  const H = 200
  const patchImg = makeImageData(W, H)
  const pd = patchImg.data
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      let c = BLUE
      if (x >= 50 && x <= 150 && y >= 50 && y <= 150) c = SKIN
      // 主体内部的近背景色块（与蓝色差 29/29/16，容差内但被肤色包围）
      if (x >= 90 && x <= 110 && y >= 90 && y <= 110) c = [80, 131, 220]
      pd[i] = c[0]
      pd[i + 1] = c[1]
      pd[i + 2] = c[2]
      pd[i + 3] = 255
    }
  }
  const patchBefore = segmentBackground(patchImg)
  check('孤立近背景色块默认保留为主体',
    patchBefore.alpha[100 * W + 100] > 200,
    `alpha=${patchBefore.alpha[100 * W + 100]}`)
  const patchAfter = segmentBackground(patchImg, { eraseSeeds: [[100, 100]] })
  check('擦除种子整块传播后该区域 alpha < 40',
    patchAfter.alpha[100 * W + 100] < 40,
    `alpha=${patchAfter.alpha[100 * W + 100]}`)

  // 保护种子阻挡传播：与边缘连通的近背景色条带默认被抠掉，保护后保留
  const stripImg = makeImageData(W, H)
  const sd = stripImg.data
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      let c = BLUE
      if (x >= 60 && x <= 140 && y <= 40) c = [80, 131, 220]
      sd[i] = c[0]
      sd[i + 1] = c[1]
      sd[i + 2] = c[2]
      sd[i + 3] = 255
    }
  }
  const stripBefore = segmentBackground(stripImg)
  check('与边缘连通的近背景色条带默认被抠为背景',
    stripBefore.alpha[20 * W + 100] < 40,
    `alpha=${stripBefore.alpha[20 * W + 100]}`)
  const stripAfter = segmentBackground(stripImg, { keepSeeds: [[100, 20]] })
  check('保护种子后该区域 alpha > 200（点选修补生效）',
    stripAfter.alpha[20 * W + 100] > 200,
    `alpha=${stripAfter.alpha[20 * W + 100]}`)
}

/* ---------- 用例 8：自适应模式（渐变 / 暗角 / 噪声） ---------- */
section('自适应抠图（渐变背景）')
{
  const W = 240
  const H = 320
  const TOP = [219, 231, 245] // #dbe7f5
  const BOTTOM = [147, 169, 200] // #93a9c8
  const img = makeImageData(W, H)
  const d = img.data
  const cx = 120
  const cy = 110
  const rx = 46
  const ry = 60

  for (let y = 0; y < H; y++) {
    const t = y / (H - 1)
    const bgc = TOP.map((v, k) => Math.round(v + (BOTTOM[k] - v) * t))
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      let color = bgc
      if (y >= 190 && x >= 55 && x <= 185) color = SHOULDER
      let cov = 0
      for (let sy = 0; sy < 4; sy++) {
        for (let sx = 0; sx < 4; sx++) {
          if (insideEllipse(x + (sx + 0.5) / 4, y + (sy + 0.5) / 4, cx, cy, rx, ry)) cov++
        }
      }
      cov /= 16
      if (cov > 0) {
        color = [
          Math.round(SKIN[0] * cov + color[0] * (1 - cov)),
          Math.round(SKIN[1] * cov + color[1] * (1 - cov)),
          Math.round(SKIN[2] * cov + color[2] * (1 - cov)),
        ]
      }
      d[i] = color[0]
      d[i + 1] = color[1]
      d[i + 2] = color[2]
      d[i + 3] = 255
    }
  }

  const res = segmentBackground(img, { mode: 'adaptive' })
  const at = (x, y) => res.alpha[y * W + x]
  const bgPts = [[5, 5], [W - 5, 5], [5, H - 5], [W - 5, H - 5]]
  const bgMax = Math.max(...bgPts.map(([x, y]) => at(x, y)))
  const fgMin = Math.min(at(cx, cy), at(120, 260))
  check('渐变背景：ok=true', res.ok === true, `coverage=${(res.coverage * 100).toFixed(1)}%`)
  check('渐变背景：coverage 40%–85%',
    res.coverage >= 0.40 && res.coverage <= 0.85,
    `coverage=${(res.coverage * 100).toFixed(1)}%`)
  check('渐变背景：背景 alpha < 40', bgMax < 40, `max=${bgMax}`)
  check('渐变背景：主体 alpha > 200', fgMin > 200, `min=${fgMin}`)
}

section('自适应抠图（径向暗角）')
{
  const W = 240
  const H = 320
  const img = makeImageData(W, H)
  const d = img.data
  const cx = 120
  const cy = 110
  const rx = 46
  const ry = 60
  const maxR = Math.hypot(W / 2, H / 2)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      const rr = Math.hypot(x - W / 2, y - H / 2) / maxR
      const light = [232, 238, 248]
      const dark = [110, 126, 158]
      let color = light.map((v, k) => Math.round(v + (dark[k] - v) * rr))
      if (y >= 190 && x >= 55 && x <= 185) color = SHOULDER
      let cov = 0
      for (let sy = 0; sy < 4; sy++) {
        for (let sx = 0; sx < 4; sx++) {
          if (insideEllipse(x + (sx + 0.5) / 4, y + (sy + 0.5) / 4, cx, cy, rx, ry)) cov++
        }
      }
      cov /= 16
      if (cov > 0) {
        color = [
          Math.round(SKIN[0] * cov + color[0] * (1 - cov)),
          Math.round(SKIN[1] * cov + color[1] * (1 - cov)),
          Math.round(SKIN[2] * cov + color[2] * (1 - cov)),
        ]
      }
      d[i] = color[0]
      d[i + 1] = color[1]
      d[i + 2] = color[2]
      d[i + 3] = 255
    }
  }

  const res = segmentBackground(img, { mode: 'adaptive' })
  check('径向暗角：ok=true', res.ok === true, `coverage=${(res.coverage * 100).toFixed(1)}%`)
  check('径向暗角：背景 alpha < 40', res.alpha[5 * W + 5] < 40,
    `corner=${res.alpha[5 * W + 5]}`)
}

section('自适应抠图（JPEG 噪声）')
{
  const W = 200
  const H = 260
  const img = makeImageData(W, H)
  const d = img.data
  // 确定性伪随机（LCG），避免用例不稳定
  let seed = 12345
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  const cx = 100
  const cy = 90
  const rx = 38
  const ry = 50

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      let color = BLUE
      if (y >= 160 && x >= 45 && x <= 155) color = SHOULDER
      let cov = 0
      for (let sy = 0; sy < 4; sy++) {
        for (let sx = 0; sx < 4; sx++) {
          if (insideEllipse(x + (sx + 0.5) / 4, y + (sy + 0.5) / 4, cx, cy, rx, ry)) cov++
        }
      }
      cov /= 16
      if (cov > 0) {
        color = [
          Math.round(SKIN[0] * cov + color[0] * (1 - cov)),
          Math.round(SKIN[1] * cov + color[1] * (1 - cov)),
          Math.round(SKIN[2] * cov + color[2] * (1 - cov)),
        ]
      }
      // 每通道 ±6 噪声
      d[i] = color[0] + Math.round((rnd() * 2 - 1) * 6)
      d[i + 1] = color[1] + Math.round((rnd() * 2 - 1) * 6)
      d[i + 2] = color[2] + Math.round((rnd() * 2 - 1) * 6)
      d[i + 3] = 255
    }
  }

  const res = segmentBackground(img, { mode: 'adaptive' })
  check('JPEG 噪声纯色底：ok=true', res.ok === true, `coverage=${(res.coverage * 100).toFixed(1)}%`)
  check('JPEG 噪声纯色底：coverage 在合理范围',
    res.coverage > 0.05 && res.coverage <= 0.92,
    `coverage=${(res.coverage * 100).toFixed(1)}%`)
}

section('自适应抠图（杂乱彩色噪声）')
{
  const W = 160
  const H = 160
  const img = makeImageData(W, H)
  const d = img.data
  let seed = 999
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  for (let i = 0; i < W * H; i++) {
    d[i * 4] = Math.floor(rnd() * 256)
    d[i * 4 + 1] = Math.floor(rnd() * 256)
    d[i * 4 + 2] = Math.floor(rnd() * 256)
    d[i * 4 + 3] = 255
  }
  const res = segmentBackground(img, { mode: 'adaptive' })
  check('杂乱彩色噪声：ok=false', res.ok === false,
    `coverage=${(res.coverage * 100).toFixed(1)}%`)
  check('杂乱彩色噪声：reason 非空', typeof res.reason === 'string' && res.reason.length > 0,
    res.reason)
}

section('回归：strict 模式结果不变')
{
  const img = makePortrait()
  const strict = segmentBackground(img, { mode: 'strict' })
  const legacy = segmentBackground(img)
  let sameAlpha = true
  let sameMask = true
  for (let i = 0; i < strict.alpha.length; i++) {
    if (strict.alpha[i] !== legacy.alpha[i]) { sameAlpha = false; break }
  }
  for (let i = 0; i < strict.mask.length; i++) {
    if (strict.mask[i] !== legacy.mask[i]) { sameMask = false; break }
  }
  check('strict 模式 alpha 与默认调用完全一致', sameAlpha)
  check('strict 模式 mask 与默认调用完全一致', sameMask)
  check('strict 模式仍 ok=true', strict.ok === true,
    `coverage=${(strict.coverage * 100).toFixed(1)}%`)
}

/* ---------- 汇总 ---------- */
console.log(`\n===== 结果：${pass} 通过 / ${fail} 失败 =====`)
if (fail > 0) process.exit(1)
