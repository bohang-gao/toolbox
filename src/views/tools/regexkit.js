// 正则匹配与高亮纯函数（供 regex.vue 使用，也可独立单测）

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]))
}

// 执行匹配；返回 { error, matches: [{text,index,groups}], ranges }
export function runRegex(pattern, flags, text) {
  const empty = { error: '', matches: [], ranges: [] }
  if (!pattern) return empty
  let re
  try {
    re = new RegExp(pattern, flags)
  } catch (e) {
    return { error: `正则语法错误：${e.message}`, matches: [], ranges: [] }
  }
  const t = String(text == null ? '' : text)
  if (!t) return empty

  const list = []
  if (flags.includes('g')) {
    let m
    let guard = 0
    while ((m = re.exec(t)) !== null) {
      list.push({ text: m[0], index: m.index, groups: Array.from(m).slice(1) })
      if (m[0] === '') re.lastIndex++ // 防止空匹配死循环
      if (++guard > 100000) break
    }
  } else {
    const m = re.exec(t)
    if (m) list.push({ text: m[0], index: m.index, groups: Array.from(m).slice(1) })
  }
  const ranges = list.filter((x) => x.text.length > 0).map((x) => ({ start: x.index, end: x.index + x.text.length }))
  return { error: '', matches: list, ranges }
}

// 合并区间并按区间切分文本，输出带 <mark> 的转义 HTML
export function buildHighlight(text, ranges) {
  const t = String(text == null ? '' : text)
  if (!t) return '<span style="color:#909399">（测试文本为空）</span>'
  if (!ranges || !ranges.length) return escapeHtml(t)

  const sorted = [...ranges].sort((a, b) => a.start - b.start)
  const merged = []
  for (const r of sorted) {
    const last = merged[merged.length - 1]
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end)
    else merged.push({ ...r })
  }
  let out = ''
  let cursor = 0
  for (const r of merged) {
    out += escapeHtml(t.slice(cursor, r.start))
    out += `<mark class="regex-mark">${escapeHtml(t.slice(r.start, r.end))}</mark>`
    cursor = r.end
  }
  out += escapeHtml(t.slice(cursor))
  return out
}
