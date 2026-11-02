// PDF 共享工具：页码解析 / 加载 / 复制页面 / 保存下载
// 供 pdfsplit / pdfextract / pdfdelete / pdfsort 等工具复用
import { PDFDocument } from 'pdf-lib'
import { downloadBlob, baseName } from './ui.js'

/* ---------- 页码表达式解析 ---------- */
// 支持：单页 `5`、范围 `1-3`、组合 `1-3,5`（兼容中文逗号、顿号、空格分隔）
// 返回 { groups: number[][]（0 基页码，保持输入顺序）, error: string|null }
export function parsePageGroups(spec, total) {
  const text = String(spec == null ? '' : spec)
    .replace(/[，、;；]/g, ',')
    .replace(/\s*[-~]\s*/g, '-')
    .trim()
  if (!text) return { groups: [], error: '请输入页码范围，例如 1-3,5' }

  const tokens = text.split(/[,\s]+/).filter(Boolean)
  if (!tokens.length) return { groups: [], error: '请输入页码范围，例如 1-3,5' }

  const groups = []
  for (const token of tokens) {
    const m = token.match(/^(\d+)(?:\s*[-~]\s*(\d+))?$/)
    if (!m) return { groups: [], error: `无法识别「${token}」，请使用 1-3 或 5 这样的写法` }
    const start = Number(m[1])
    const end = m[2] === undefined ? start : Number(m[2])
    if (start < 1 || end < 1) return { groups: [], error: `页码必须从 1 开始：「${token}」无效` }
    if (start > end) return { groups: [], error: `范围起点不能大于终点：「${token}」` }
    if (end > total) return { groups: [], error: `页码超出范围：文档共 ${total} 页，「${token}」无效` }
    const group = []
    for (let p = start; p <= end; p++) group.push(p - 1)
    groups.push(group)
  }
  return { groups, error: null }
}

// 扁平化页码列表（去重，保持首次出现顺序）
export function flattenGroups(groups) {
  const out = []
  const seen = new Set()
  for (const g of groups) {
    for (const p of g) {
      if (!seen.has(p)) { seen.add(p); out.push(p) }
    }
  }
  return out
}

// 把 0 基页码列表压缩成易读标签： [0,1,2,4] -> "1-3,5"
export function pagesToLabel(pages) {
  const sorted = [...new Set(pages)].sort((a, b) => a - b)
  if (!sorted.length) return ''
  const parts = []
  let runStart = sorted[0]
  let prev = sorted[0]
  for (let i = 1; i <= sorted.length; i++) {
    const cur = sorted[i]
    if (cur === prev + 1) { prev = cur; continue }
    parts.push(runStart === prev ? `${runStart + 1}` : `${runStart + 1}-${prev + 1}`)
    runStart = cur
    prev = cur
  }
  return parts.join(',')
}

/* ---------- 加载 / 保存 ---------- */
export async function loadPdfDoc(file) {
  let bytes
  try {
    bytes = new Uint8Array(await file.arrayBuffer())
  } catch (e) {
    throw new Error('读取文件失败：' + (e.message || e))
  }
  if (bytes.length === 0) throw new Error('文件内容为空')
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
    return { doc, bytes }
  } catch (e) {
    throw new Error('无法解析 PDF（可能已加密或文件损坏）：' + (e.message || e))
  }
}

// 从源文档按给定 0 基页码顺序生成新文档
export async function copyPagesToNewDoc(srcDoc, pageIndices) {
  const out = await PDFDocument.create()
  const pages = await out.copyPages(srcDoc, pageIndices)
  for (const p of pages) out.addPage(p)
  return out
}

export function pdfBlob(bytes) {
  return new Blob([bytes], { type: 'application/pdf' })
}

// 保存并直接下载
export async function saveAndDownload(doc, name) {
  const bytes = await doc.save()
  downloadBlob(pdfBlob(bytes), name)
  return bytes
}

export function pdfOutputName(fileName, suffix = '') {
  return `${baseName(fileName)}${suffix}.pdf`
}

/* ---------- 常用绘制 ---------- */
export function clampNumber(value, min, max, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}
