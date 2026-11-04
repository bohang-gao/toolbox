#!/usr/bin/env node
// 从 node_modules 复制按分块命名的模型资产到 public/imgly/（自托管，避免依赖境外 CDN）
import fs from 'node:fs'
import path from 'node:path'

const SRC = 'node_modules/@imgly/background-removal-data/dist'
const DST = 'public/imgly'
const KEEP = [
  '/models/small',
  '/onnxruntime-web/ort-wasm.wasm',
  '/onnxruntime-web/ort-wasm-simd.wasm',
]

const resources = JSON.parse(fs.readFileSync(path.join(SRC, 'resources.json'), 'utf8'))
fs.mkdirSync(DST, { recursive: true })

// 只保留用到的条目，其余从 resources.json 里摘掉，避免运行时去请求不存在的分块
const kept = {}
let total = 0
for (const key of KEEP) {
  if (!resources[key]) throw new Error(`resources.json 缺少 ${key}`)
  kept[key] = resources[key]
  for (const c of resources[key].chunks) {
    const from = path.join(SRC, c.hash)
    const to = path.join(DST, c.hash)
    if (!fs.existsSync(to)) {
      fs.copyFileSync(from, to)
      total += fs.statSync(from).size
    }
  }
}
fs.writeFileSync(path.join(DST, 'resources.json'), JSON.stringify(kept, null, 2))
const mb = (n) => (n / 1e6).toFixed(1) + ' MB'
const all = fs.readdirSync(DST).reduce((s, f) => s + fs.statSync(path.join(DST, f)).size, 0)
console.log(`复制完成：${Object.keys(kept).length} 个资源条目，本次新增 ${mb(total)}，目录合计 ${mb(all)}`)
