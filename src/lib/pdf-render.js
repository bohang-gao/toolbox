// pdfjs-dist 渲染共享函数：打开 PDF / 页面渲染为 canvas / 内嵌图片解码
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc =
  new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href

// 浏览器 canvas 常见上限（Chrome/Firefox 单边约 32767，但显存安全值取 16384）
export const MAX_CANVAS_SIDE = 16384

export async function openPdf(file) {
  let data
  try {
    data = new Uint8Array(await file.arrayBuffer())
  } catch (e) {
    throw new Error('读取文件失败：' + (e.message || e))
  }
  if (!data.length) throw new Error('文件内容为空')
  try {
    const doc = await pdfjsLib.getDocument({ data }).promise
    return doc
  } catch (e) {
    throw new Error('无法解析 PDF（可能已加密或文件损坏）：' + (e.message || e))
  }
}

export async function renderPageToCanvas(page, scale = 1.5) {
  const viewport = page.getViewport({ scale })
  const width = Math.max(1, Math.ceil(viewport.width))
  const height = Math.max(1, Math.ceil(viewport.height))
  if (width > MAX_CANVAS_SIDE || height > MAX_CANVAS_SIDE) {
    throw new Error(`页面渲染尺寸 ${width}×${height} 超出浏览器 canvas 上限，请降低缩放倍数`)
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, height)
  // pdfjs 分块渲染依赖 requestAnimationFrame；后台标签/无头浏览器里 rAF 被暂停会导致
  // render().promise 永不 resolve。检测到 rAF 停摆时用 setTimeout 兜底（等价语义）。
  const restore = patchRafIfStalled()
  try {
    await page.render({ canvasContext: ctx, viewport }).promise
  } finally {
    restore()
  }
  return { canvas, viewport }
}

// 若页面不可见（rAF 被节流到 0 帧），临时把 rAF 换成 setTimeout 实现，返回还原函数
export function patchRafIfStalled() {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') return () => {}
  if (!document.hidden) return () => {}
  const origRaf = window.requestAnimationFrame
  const origCancel = window.cancelAnimationFrame
  window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16)
  window.cancelAnimationFrame = (id) => clearTimeout(id)
  return () => {
    window.requestAnimationFrame = origRaf
    window.cancelAnimationFrame = origCancel
  }
}

// 取页面对象（pdfjs 的 page.objs 可能异步解析，这里统一成 Promise）
export function getPageObject(page, objId) {
  return new Promise((resolve) => {
    let settled = false
    const done = (v) => { if (!settled) { settled = true; resolve(v) } }
    try {
      const value = page.objs.get(objId, done)
      if (value !== null && value !== undefined) done(value)
    } catch (e) {
      done(null)
    }
    // 兜底：极少数情况下回调不会触发
    setTimeout(() => done(null), 5000)
  })
}

// pdfjs 的 ImageKind：1=1bpp 灰度，2=RGB，3=RGBA
export function imgDataToCanvas(imgData) {
  const width = imgData.width
  const height = imgData.height
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  if (imgData.bitmap) {
    ctx.drawImage(imgData.bitmap, 0, 0)
    return canvas
  }
  const src = imgData.data
  if (!src) return null

  const out = ctx.createImageData(width, height)
  const dest = out.data
  const pixels = width * height

  if (imgData.kind === pdfjsLib.ImageKind.RGBA_32BPP) {
    dest.set(src.subarray ? src.subarray(0, pixels * 4) : src)
  } else if (imgData.kind === pdfjsLib.ImageKind.RGB_24BPP) {
    for (let i = 0, j = 0; i < pixels; i++) {
      dest[j++] = src[i * 3]
      dest[j++] = src[i * 3 + 1]
      dest[j++] = src[i * 3 + 2]
      dest[j++] = 255
    }
  } else if (imgData.kind === pdfjsLib.ImageKind.GRAYSCALE_1BPP) {
    const rowBytes = (width + 7) >> 3
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const byte = src[y * rowBytes + (x >> 3)] || 0
        const bit = (byte >> (7 - (x & 7))) & 1
        const v = bit ? 255 : 0
        const o = (y * width + x) * 4
        dest[o] = dest[o + 1] = dest[o + 2] = v
        dest[o + 3] = 255
      }
    }
  } else {
    return null
  }
  ctx.putImageData(out, 0, 0)
  return canvas
}

// 从页面的 operator list 中收集内嵌图片数据
export async function collectPageImages(page) {
  const OPS = pdfjsLib.OPS
  const ops = await page.getOperatorList()
  const found = []

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i]
    const args = ops.argsArray[i]

    if (fn === OPS.paintImageXObject || fn === OPS.paintImageXObjectRepeat) {
      found.push({ id: args[0] })
    } else if (fn === OPS.paintInlineImageXObject) {
      if (args[0]) found.push({ imgData: args[0] })
    } else if (fn === OPS.paintInlineImageXObjectGroup) {
      if (args[0]) found.push({ imgData: args[0] })
    } else if (fn === OPS.paintImageMaskXObject) {
      if (args[0]) found.push({ imgData: args[0] })
    } else if (fn === OPS.paintImageMaskXObjectGroup) {
      for (const img of args[0] || []) found.push({ imgData: img })
    }
  }

  const seen = new Set()
  const result = []
  for (const item of found) {
    if (item.imgData) {
      result.push(item.imgData)
      continue
    }
    if (seen.has(item.id)) continue
    seen.add(item.id)
    const data = await getPageObject(page, item.id)
    if (data) result.push(data)
  }
  return result
}

export async function closePdf(doc) {
  try {
    if (doc && typeof doc.destroy === 'function') await doc.destroy()
  } catch (e) {
    // 忽略销毁异常
  }
}
