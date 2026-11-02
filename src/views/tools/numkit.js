// 任意进制转换纯函数（BigInt，无精度损失）

export const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz'

// 解析数值字符串；非法字符返回 null
export function parseInBase(raw, base) {
  const text = String(raw == null ? '' : raw).trim()
  if (!text) return null
  const sign = text.startsWith('-') ? -1n : 1n
  const body = text.replace(/^[-+]/, '')
  if (!body) return null
  const allowed = DIGITS.slice(0, base)
  const lower = body.toLowerCase()
  for (const ch of lower) {
    if (!allowed.includes(ch)) return null
  }
  let result = 0n
  const b = BigInt(base)
  for (const ch of lower) {
    result = result * b + BigInt(DIGITS.indexOf(ch))
  }
  return sign * result
}

// 数值 → 指定进制字符串
export function toStringBase(n, base) {
  if (n === 0n) return '0'
  const neg = n < 0n
  let v = neg ? -n : n
  const b = BigInt(base)
  let out = ''
  while (v > 0n) {
    out = DIGITS[Number(v % b)] + out
    v /= b
  }
  return (neg ? '-' : '') + out
}
