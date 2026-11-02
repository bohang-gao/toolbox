// 全站共享 UI 原语：消息浮条 / 文件选择（点击+拖拽）/ 任务列表 / zip 下载 / canvas 工具
import JSZip from 'jszip'

/* ---------- el-message 风格消息 ---------- */
export function showMessage(text, type = 'info', duration = 2500) {
  const el = document.createElement('div')
  el.className = `el-message el-message--${type}`
  el.textContent = text
  document.body.appendChild(el)
  setTimeout(() => {
    el.classList.add('msg-leave')
    setTimeout(() => el.remove(), 300)
  }, duration)
}
export const msgSuccess = (t) => showMessage(t, 'success')
export const msgError = (t) => showMessage(t, 'error')

/* ---------- 文件选择（点击 + 拖拽），返回 File[] ---------- */
export function pickFiles({ accept = '', multiple = true, validator } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = multiple
    input.style.display = 'none'
    document.body.appendChild(input)
    input.addEventListener('change', () => {
      const files = Array.from(input.files || [])
      input.remove()
      resolve(validate(files, validator))
    })
    input.click()
  })
}
export function validate(files, validator) {
  if (!validator) return files
  const ok = []
  for (const f of files) {
    const err = validator(f)
    if (err) showMessage(`${f.name}：${err}`, 'error')
    else ok.push(f)
  }
  return ok
}
export const MAX_SIZE = 50 * 1024 * 1024
export const imageValidator = (f) => {
  if (!/^image\//.test(f.type)) return '仅支持图片文件'
  if (f.size > MAX_SIZE) return '文件超过 50MB 限制'
  return null
}
export const pdfValidator = (f) => {
  if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) return '仅支持 PDF 文件'
  if (f.size > MAX_SIZE) return '文件超过 50MB 限制'
  return null
}

/* ---------- 响应式任务列表模型 ---------- */
export function createTasks() {
  const tasks = reactive([])
  let processing = ref(false)
  return { tasks, processing }
}
import { reactive, ref } from 'vue'

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/* ---------- 打包下载 ---------- */
export async function downloadZip(items, zipName = 'output.zip') {
  if (items.length === 1) {
    downloadBlob(items[0].blob, items[0].name)
    return
  }
  const zip = new JSZip()
  const used = new Set()
  for (const it of items) {
    let name = it.name || 'file'
    let i = 1
    while (used.has(name)) {
      const dot = name.lastIndexOf('.')
      name = dot > 0 ? `${name.slice(0, dot)}_${i++}${name.slice(dot)}` : `${name}_${i++}`
    }
    used.add(name)
    zip.file(name, it.blob)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(blob, zipName)
}
export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/* ---------- canvas 图像处理 ---------- */
export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片解码失败')) }
    img.src = url
  })
}
export function canvasToBlob(canvas, mime = 'image/jpeg', quality = 0.8) {
  // toBlob 在后台标签/headless 环境会被调度节流（实测可达 1s/次），批量切片会明显卡顿。
  // 策略：页面不可见时直接走同步 toDataURL；可见时优先 toBlob（400ms 超时回退）。
  if (typeof document !== 'undefined' && document.hidden) {
    return Promise.resolve().then(() => dataUrlToBlob(canvas.toDataURL(mime, quality)))
  }
  return new Promise((resolve, reject) => {
    let done = false
    const settle = (fn, val) => { if (done) return; done = true; fn(val) }
    const fallback = () => {
      try {
        settle(resolve, dataUrlToBlob(canvas.toDataURL(mime, quality)))
      } catch (e) {
        settle(reject, e)
      }
    }
    const timer = setTimeout(fallback, 400)
    try {
      canvas.toBlob(b => {
        clearTimeout(timer)
        if (b) settle(resolve, b)
        else fallback()
      }, mime, quality)
    } catch (e) {
      clearTimeout(timer)
      fallback()
    }
  })
}
export function dataUrlToBlob(dataUrl) {
  const comma = dataUrl.indexOf(',')
  const head = dataUrl.slice(0, comma)
  const body = dataUrl.slice(comma + 1)
  const mime = (head.match(/^data:([^;]+)/) || [])[1] || 'application/octet-stream'
  const bin = atob(body)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}
export function baseName(name) {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(0, i) : name
}
export function extOf(name) {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(i + 1).toLowerCase() : ''
}
