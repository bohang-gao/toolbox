// 最近使用记录：localStorage 持久化 + 变更事件通知
import { ALL_TOOLS } from '../data/tools.js'

export const RECENT_KEY = 'toolbox.recent'
const CHANGE_EVENT = 'toolbox:recent-changed'

function readRecords() {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(r => r && typeof r.path === 'string')
      .map(r => ({
        path: r.path,
        count: Number.isFinite(r.count) ? r.count : 0,
        last: typeof r.last === 'string' ? r.last : ''
      }))
  } catch {
    return []
  }
}

function writeRecords(records) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(records))
  } catch {
    // 隐私模式 / 配额不足时静默失败，不影响页面其他功能
  }
}

/** 广播「最近使用数据可能已变化」，供路由切换等场景强制刷新订阅方 */
export function notifyRecentChange() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
}

const emitChange = notifyRecentChange

/** 记录一次工具访问：同一 path 去重累加 count，last 更新为当前 ISO 时间 */
export function recordToolVisit(path) {
  if (!path) return
  const records = readRecords()
  const now = new Date().toISOString()
  const idx = records.findIndex(r => r.path === path)
  if (idx >= 0) {
    records[idx] = { ...records[idx], count: records[idx].count + 1, last: now }
  } else {
    records.push({ path, count: 1, last: now })
  }
  writeRecords(records)
  emitChange()
}

const toolByPath = new Map(ALL_TOOLS.map(t => [t.path, t]))

function timeOf(record) {
  const ts = Date.parse(record.last)
  return Number.isNaN(ts) ? 0 : ts
}

/** 按（count 降序，last 降序）取前 N 个仍存在的工具条目 */
export function getRecentTools(limit = 8) {
  return readRecords()
    .filter(r => toolByPath.has(r.path))
    .sort((a, b) => (b.count - a.count) || (timeOf(b) - timeOf(a)))
    .slice(0, limit)
    .map(r => toolByPath.get(r.path))
}

/** 使用过的（仍存在）工具数量 */
export function getRecentCount() {
  return readRecords().filter(r => toolByPath.has(r.path)).length
}

/** 订阅最近使用变化（自定义事件 + 跨标签页 storage 事件），返回取消函数 */
export function onRecentChange(callback) {
  if (typeof window === 'undefined') return () => {}
  const onLocal = () => callback()
  const onStorage = (e) => {
    if (!e.key || e.key === RECENT_KEY) callback()
  }
  window.addEventListener(CHANGE_EVENT, onLocal)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onLocal)
    window.removeEventListener('storage', onStorage)
  }
}
