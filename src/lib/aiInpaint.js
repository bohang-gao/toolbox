// AI 图像修复：MI-GAN（ONNX Runtime Web，纯前端，自托管资产）
//
// 契约（实测，勿改）：
//   image uint8 [1,3,512,512]   mask uint8 [1,1,512,512]（0=待填充，255=保留）
//   result uint8 [1,3,512,512]（NCHW）
// 模型会重绘整张图，因此这里自己 crop → 512 推理 → resize 回 crop → 只回贴 mask 区域。
//
// 资产位于 public/migan/（migan.onnx + ort/），由 scripts/sync-migan-assets.mjs 生成。
// 懒加载：首次调用才 import onnxruntime-web 并下载模型。

const MODEL_BYTES = 28.1 * 1e6
const MODEL_SIZE = 512
const INFER_TIMEOUT_MS = 60000
const PROGRESS_INTERVAL = 120

let ortPromise = null
let sessionPromise = null

function loadOrt() {
  if (!ortPromise) ortPromise = import('onnxruntime-web')
  return ortPromise
}

function assetUrl(rel) {
  return new URL(`${import.meta.env.BASE_URL}migan/${rel}`, location.href).href
}

function mb(bytes) {
  return (bytes / 1e6).toFixed(1)
}

function describeError(e) {
  const msg = String((e && e.message) || e || '')
  if (/timeout|超时/i.test(msg)) return 'AI 推理超时（超过 60s）'
  if (/Failed to fetch|NetworkError|network|fetch|网络|404/i.test(msg)) {
    return '模型资源加载失败（资源缺失或网络不可用）'
  }
  if (/wasm|onnx|session|model|inference|初始化|tensor/i.test(msg)) {
    return 'AI 模型初始化或推理失败'
  }
  return 'AI 修复失败'
}

/** 带进度的模型下载（一次成功后缓存 ArrayBuffer，后续不再请求） */
let modelBufferPromise = null

async function loadModelBuffer(onProgress) {
  if (modelBufferPromise) {
    onProgress(`加载模型 ${mb(MODEL_BYTES)}/${mb(MODEL_BYTES)}MB`)
    return modelBufferPromise
  }
  modelBufferPromise = (async () => {
    const res = await fetch(assetUrl('migan.onnx'))
    if (!res.ok) throw new Error(`模型下载失败：HTTP ${res.status}`)
    const total = Number(res.headers.get('content-length')) || MODEL_BYTES
    if (!res.body || !res.body.getReader) {
      const buf = new Uint8Array(await res.arrayBuffer())
      onProgress(`加载模型 ${mb(buf.byteLength)}/${mb(total)}MB`)
      return buf
    }
    const reader = res.body.getReader()
    const chunks = []
    let loaded = 0
    let lastEmit = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      loaded += value.byteLength
      const now = Date.now()
      if (now - lastEmit >= PROGRESS_INTERVAL) {
        lastEmit = now
        onProgress(`加载模型 ${mb(loaded)}/${mb(total)}MB`)
      }
    }
    onProgress(`加载模型 ${mb(loaded)}/${mb(total)}MB`)
    const out = new Uint8Array(loaded)
    let off = 0
    for (const c of chunks) { out.set(c, off); off += c.byteLength }
    return out
  })().catch((e) => {
    modelBufferPromise = null
    throw e
  })
  return modelBufferPromise
}

async function loadSession(onProgress) {
  if (sessionPromise) return sessionPromise
  sessionPromise = (async () => {
    const ort = await loadOrt()
    // 自托管 WASM，绝不走 CDN；单线程避免需要 SharedArrayBuffer/COOP-COEP
    ort.env.wasm.wasmPaths = assetUrl('ort/')
    ort.env.wasm.numThreads = 1
    const buf = await loadModelBuffer(onProgress)
    return ort.InferenceSession.create(buf, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    })
  })().catch((e) => {
    sessionPromise = null
    throw e
  })
  return sessionPromise
}

/* ---------- canvas 缩放 ---------- */

function makeCanvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

/** 图像 crop（LANCZOS 等效：高质量平滑） */
function cropImage(src, x, y, side, size) {
  const c = makeCanvas(size, size)
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, x, y, side, side, 0, 0, size, size)
  return ctx.getImageData(0, 0, size, size)
}

/**
 * mask crop（NEAREST，保持硬边）。
 * 注意极性：MI-GAN 的 mask 是「0 = 待填充，255 = 保留」，
 * 与内部约定（1 = 待填充）相反，这里直接输出 0/255 给模型。
 */
function cropMask(mask, w, h, x, y, side, size) {
  const raw = makeCanvas(side, side)
  const rctx = raw.getContext('2d', { willReadFrequently: true })
  const id = rctx.createImageData(side, side)
  for (let yy = 0; yy < side; yy++) {
    const sy = y + yy
    for (let xx = 0; xx < side; xx++) {
      const sx = x + xx
      const v = mask[sy * w + sx] ? 0 : 255
      const o = (yy * side + xx) * 4
      id.data[o] = v
      id.data[o + 1] = v
      id.data[o + 2] = v
      id.data[o + 3] = 255
    }
  }
  rctx.putImageData(id, 0, 0)
  const c = makeCanvas(size, size)
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(raw, 0, 0, side, side, 0, 0, size, size)
  const out = new Uint8Array(size * size)
  const d = ctx.getImageData(0, 0, size, size).data
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4] > 127 ? 255 : 0
  return out
}

/** 把 512 推理结果（NCHW uint8 [3,size,size]）缩回 side×side 的 RGBA */
function resizeResult(resultData, size, side) {
  // ORT 输出为 NCHW 三通道；ImageData 只接受 RGBA + Uint8ClampedArray
  const n = size * size
  const rgba = new Uint8ClampedArray(n * 4)
  for (let i = 0; i < n; i++) {
    rgba[i * 4] = resultData[i]
    rgba[i * 4 + 1] = resultData[n + i]
    rgba[i * 4 + 2] = resultData[2 * n + i]
    rgba[i * 4 + 3] = 255
  }
  const src = makeCanvas(size, size)
  src.getContext('2d').putImageData(new ImageData(rgba, size, size), 0, 0)
  const c = makeCanvas(side, side)
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, size, size, 0, 0, side, side)
  return ctx.getImageData(0, 0, side, side)
}

/* ---------- 主流程 ---------- */

function cropGeometry(box, w, h) {
  const raw = Math.max(box.w, box.h) * 1.8
  // 正常图片下即 clamp(raw,128,512)；小图时不超过图像短边
  let side = Math.round(Math.min(MODEL_SIZE, Math.max(128, raw)))
  side = Math.max(16, Math.min(side, w, h))
  let x = Math.round(box.x + box.w / 2 - side / 2)
  let y = Math.round(box.y + box.h / 2 - side / 2)
  x = Math.max(0, Math.min(w - side, x))
  y = Math.max(0, Math.min(h - side, y))
  return { x, y, side }
}

function withTimeout(promise, ms) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`inference timeout ${ms}ms`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/**
 * AI 修复。只回贴 mask 区域，mask 外像素保持原图。
 * @param {{data:Uint8ClampedArray|Uint8Array,width:number,height:number}} imageData
 * @param {Uint8Array} mask 1 = 待填充
 * @param {(note:string)=>void} [onProgress]
 * @returns {Promise<{ok:true, filled:ImageData, timings:{loadMs:number,inferMs:number}}
 *   | {ok:false, reason:string}>}
 */
export async function aiInpaint(imageData, mask, onProgress) {
  if (!imageData || !mask) return { ok: false, reason: '缺少图像或选区' }
  const w = imageData.width
  const h = imageData.height
  const emit = (note) => { if (onProgress) onProgress(note) }

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
  if (maxX < 0) return { ok: false, reason: '选区为空' }
  const box = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }

  const tLoad0 = performance.now()
  let session
  try {
    session = await loadSession((note) => emit(note))
  } catch (e) {
    return { ok: false, reason: describeError(e) }
  }
  const loadMs = Math.round(performance.now() - tLoad0)

  try {
    const ort = await loadOrt()
    const { x: cx, y: cy, side } = cropGeometry(box, w, h)

    const src = makeCanvas(w, h)
    src.getContext('2d').putImageData(
      new ImageData(new Uint8ClampedArray(imageData.data), w, h), 0, 0
    )
    const imgCrop = cropImage(src, cx, cy, side, MODEL_SIZE)
    const maskCrop = cropMask(mask, w, h, cx, cy, side, MODEL_SIZE)

    // NCHW uint8
    const imgTensor = new Uint8Array(3 * MODEL_SIZE * MODEL_SIZE)
    const n = MODEL_SIZE * MODEL_SIZE
    for (let i = 0; i < n; i++) {
      imgTensor[i] = imgCrop.data[i * 4]
      imgTensor[n + i] = imgCrop.data[i * 4 + 1]
      imgTensor[2 * n + i] = imgCrop.data[i * 4 + 2]
    }
    const inputs = {
      image: new ort.Tensor('uint8', imgTensor, [1, 3, MODEL_SIZE, MODEL_SIZE]),
      mask: new ort.Tensor('uint8', maskCrop, [1, 1, MODEL_SIZE, MODEL_SIZE]),
    }

    emit('AI 修复中…')
    const tInfer0 = performance.now()
    const out = await withTimeout(session.run(inputs), INFER_TIMEOUT_MS)
    const inferMs = Math.round(performance.now() - tInfer0)

    const raw = out.result || out[Object.keys(out)[0]]
    if (!raw || !raw.data) throw new Error('模型输出缺失')
    const flat = raw.data instanceof Uint8Array
      ? raw.data
      : Uint8Array.from(raw.data, (v) => Math.max(0, Math.min(255, Math.round(v))))

    const small = resizeResult(flat, MODEL_SIZE, side)

    // 只回贴 mask 区域（mask 外保持原图）
    const filled = new ImageData(new Uint8ClampedArray(imageData.data), w, h)
    const fd = filled.data
    for (let yy = 0; yy < side; yy++) {
      const gy = cy + yy
      for (let xx = 0; xx < side; xx++) {
        const gx = cx + xx
        if (!mask[gy * w + gx]) continue
        const si = (yy * side + xx) * 4
        const di = (gy * w + gx) * 4
        fd[di] = small.data[si]
        fd[di + 1] = small.data[si + 1]
        fd[di + 2] = small.data[si + 2]
        fd[di + 3] = 255
      }
    }

    emit('AI 修复完成')
    return { ok: true, filled, timings: { loadMs, inferMs } }
  } catch (e) {
    return { ok: false, reason: describeError(e) }
  }
}

/** 模型是否已在本页成功加载过 */
export function aiReady() {
  return sessionPromise !== null
}
