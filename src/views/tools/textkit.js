// 文本/编码工具共享小工具：复制到剪贴板 / UTF-8 与 Base64 互转 / HTML 转义
import { msgSuccess, msgError } from '../../lib/ui.js'

/* ---------- 复制到剪贴板（Clipboard API + execCommand 回退） ---------- */
export function copyText(text, label = '已复制') {
  const value = String(text == null ? '' : text)
  if (!value) {
    msgError('没有可复制的内容')
    return
  }
  const done = () => msgSuccess(label)
  const fail = () => msgError('复制失败，请手动选择文本复制')

  const fallback = () => {
    try {
      const ta = document.createElement('textarea')
      ta.value = value
      ta.style.position = 'fixed'
      ta.style.top = '-9999px'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      if (ok) done()
      else fail()
    } catch (e) {
      fail()
    }
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(value).then(done).catch(fallback)
  } else {
    fallback()
  }
}

/* ---------- Uint8Array → Base64（分块避免超长参数溢出） ---------- */
export function bytesToBase64(bytes) {
  const CHUNK = 0x8000
  let bin = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

/* ---------- Base64 → Uint8Array（非法输入会抛异常） ---------- */
export function base64ToBytes(b64) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

/* ---------- UTF-8 文本 → Base64 ---------- */
export function utf8ToBase64(str) {
  return bytesToBase64(new TextEncoder().encode(String(str)))
}

/* ---------- Base64 → UTF-8 文本 ---------- */
export function base64ToUtf8(b64) {
  return new TextDecoder('utf-8').decode(base64ToBytes(b64))
}

/* ---------- HTML 转义（用于 v-html 高亮，防 XSS） ---------- */
export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]))
}
