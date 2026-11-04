// AI 人像抠图：@imgly/background-removal（本地 WASM + 自托管模型资产）
// 懒加载：首次调用才 import，避免拖慢全站首屏。
// 模型资产位于 public/imgly/（由 scripts/sync-imgly-assets.mjs 生成）。

const MAX_EDGE = 800 // ISNet 输入最长边；800px 足够输出 295×413 证件照
const PROGRESS_INTERVAL = 500 // 进度回调节流（ms）

let modPromise = null
let ready = false // 模型是否已在本页成功加载过

function loadModule() {
  if (!modPromise) modPromise = import('@imgly/background-removal')
  return modPromise
}

/** 资产根目录必须是绝对 URL（库内部用 new URL(hash, publicPath) 拼接） */
function assetPublicPath() {
  return new URL(`${import.meta.env.BASE_URL}imgly/`, location.href).href
}

function mb(bytes) {
  return (bytes / 1e6).toFixed(1)
}

function describeError(e) {
  const msg = String((e && e.message) || e || '')
  if (/Failed to fetch|NetworkError|network|fetch|网络/i.test(msg)) {
    return '模型资源加载失败（网络不可用或资源缺失）'
  }
  if (/wasm|onnx|session|model|inference|初始化/i.test(msg)) {
    return 'AI 模型初始化失败'
  }
  return 'AI 抠图失败'
}

/** 把输入图缩到最长边 maxEdge（不放大），返回 PNG Blob */
async function downscale(file, maxEdge = MAX_EDGE) {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height))
  const w = Math.max(1, Math.round(bmp.width * scale))
  const h = Math.max(1, Math.round(bmp.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d').drawImage(bmp, 0, 0, w, h)
  if (bmp.close) bmp.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('图片编码失败'))), 'image/png')
  })
}

/** 从带 alpha 的 PNG Blob 提取 alpha 通道 */
async function extractAlpha(blob) {
  const bmp = await createImageBitmap(blob)
  const w = bmp.width
  const h = bmp.height
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(bmp, 0, 0)
  if (bmp.close) bmp.close()
  const data = ctx.getImageData(0, 0, w, h).data
  const alpha = new Uint8ClampedArray(w * h)
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3]
  return { alpha, width: w, height: h }
}

/** 读取 resources.json 汇总总字节数（用于进度条显示 x/64.6MB） */
async function totalAssetBytes(publicPath) {
  try {
    const res = await fetch(new URL('resources.json', publicPath))
    if (!res.ok) return 0
    const json = await res.json()
    return Object.values(json).reduce((sum, entry) => sum + (entry.size || 0), 0)
  } catch (e) {
    return 0
  }
}

/**
 * AI 抠图。输入 File/Blob，返回 alpha 掩膜。
 * @param {File|Blob} file
 * @param {(note:string)=>void} [onProgress] 页面进度提示（内部节流 500ms）
 * @returns {Promise<{ok:true,alpha:Uint8ClampedArray,width:number,height:number}
 *   | {ok:false,reason:string}>}
 */
export async function aiMatte(file, onProgress) {
  if (!file) return { ok: false, reason: '没有可处理的图片' }

  let lastEmit = 0
  const emit = (note, force = false) => {
    if (!onProgress) return
    const now = Date.now()
    if (!force && now - lastEmit < PROGRESS_INTERVAL) return
    lastEmit = now
    onProgress(note)
  }

  try {
    const mod = await loadModule()
    const publicPath = assetPublicPath()
    const totalBytes = await totalAssetBytes(publicPath)

    const input = await downscale(file)
    emit('AI 准备中…', true)

    // 各 fetch 条目的下载进度（不同资源分开上报，按 key 累加）
    const fetched = new Map()
    const onLibProgress = (key, cur, total) => {
      if (key.startsWith('fetch:')) {
        fetched.set(key, { cur, total })
        let loaded = 0
        let size = 0
        for (const v of fetched.values()) {
          loaded += v.cur
          size += v.total
        }
        // resources.json 的 size 之和更权威（含未开始下载的条目）
        const denom = totalBytes || size
        emit(`加载模型 ${mb(loaded)}/${mb(denom)}MB`)
      } else if (key.startsWith('compute:')) {
        emit('AI 推理中…', true)
      }
    }

    const out = await mod.removeBackground(input, {
      publicPath,
      device: 'cpu',
      model: 'small',
      output: { format: 'image/png' },
      progress: onLibProgress,
    })

    const result = await extractAlpha(out)
    ready = true
    emit('AI 推理完成', true)
    return { ok: true, ...result }
  } catch (e) {
    return { ok: false, reason: describeError(e) }
  }
}

/** 模型是否已在本页成功加载过 */
export function aiReady() {
  return ready
}

/**
 * 后台预取（仅预热 JS 模块，不触发 65MB 模型下载），失败静默。
 * 页面可在 mount 时调用；是否调用由页面决定。
 */
export async function preloadAi() {
  try {
    await loadModule()
  } catch (e) {
    /* 静默：预取失败不影响后续正式调用 */
  }
}
