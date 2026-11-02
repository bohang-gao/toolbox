// 时间戳转换纯函数（供 timestamp.vue 使用，也可独立单测）

const pad = (n, len = 2) => String(n).padStart(len, '0')

export function formatLocal(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function formatUtc(d) {
  return d.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC')
}

// 解析 "2024-10-27" / "2024-10-27 03:33:20"（本地时区）；无效返回 null
export function parseLocalDate(raw) {
  const m = String(raw || '').trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/)
  if (!m) return null
  const d = new Date(
    Number(m[1]), Number(m[2]) - 1, Number(m[3]),
    Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0)
  )
  return Number.isNaN(d.getTime()) ? null : d
}

// 时间戳 → 毫秒（按单位），非法返回 null
export function stampToMs(raw, unit) {
  const s = String(raw || '').trim()
  if (!/^\d+$/.test(s)) return null
  const n = Number(s)
  if (!Number.isSafeInteger(n)) return null
  return unit === 's' ? n * 1000 : n
}

// 毫秒 → 时间戳字符串
export function msToStamp(ms, unit) {
  return unit === 's' ? String(Math.floor(ms / 1000)) : String(Math.round(ms))
}

export function relativeText(ms, now = Date.now()) {
  const diff = Math.round((now - ms) / 1000)
  const abs = Math.abs(diff)
  const unitText = abs < 60 ? `${abs} 秒` : abs < 3600 ? `${Math.floor(abs / 60)} 分钟` : abs < 86400 ? `${Math.floor(abs / 3600)} 小时` : `${Math.floor(abs / 86400)} 天`
  if (diff === 0) return '就是现在'
  return diff > 0 ? `${unitText}前` : `${unitText}后`
}

// 根据位数纠正秒/毫秒单位
export function autoUnit(raw, unit) {
  const len = String(raw).trim().length
  if (unit === 's' && len >= 13) return 'ms'
  if (unit === 'ms' && len <= 10) return 's'
  return unit
}
