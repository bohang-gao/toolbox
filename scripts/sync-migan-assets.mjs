#!/usr/bin/env node
// 自托管 MI-GAN 修复模型与 ONNX Runtime Web 的 WASM 后端到 public/migan/。
// 模型来源：HF CardAnvilModels/MI-GAN-ONNX（MIT），本地已有副本，不联网下载。
// 运行时通过 ort.env.wasm.wasmPaths 指向 public/migan/ort/，避免走 CDN。
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const MODEL_SRC = process.env.MIGAN_MODEL ||
  path.join(os.homedir(), 'AppData/Local/hermes/profiles/obsidian/cache/scratch/migan.onnx')
const ORT_DIST = 'node_modules/onnxruntime-web/dist'
const DST = 'public/migan'
const ORT_DST = path.join(DST, 'ort')
const ORT_FILES = ['ort-wasm.wasm', 'ort-wasm-simd.wasm']

function copyIfChanged(from, to) {
  if (!fs.existsSync(from)) throw new Error(`缺少源文件：${from}`)
  if (fs.existsSync(to) && fs.statSync(to).size === fs.statSync(from).size) return 0
  fs.copyFileSync(from, to)
  return fs.statSync(from).size
}

fs.mkdirSync(ORT_DST, { recursive: true })

let added = 0
added += copyIfChanged(MODEL_SRC, path.join(DST, 'migan.onnx'))
for (const f of ORT_FILES) added += copyIfChanged(path.join(ORT_DIST, f), path.join(ORT_DST, f))

const mb = (n) => (n / 1e6).toFixed(1) + ' MB'
const all = [DST, ORT_DST].reduce((sum, dir) =>
  sum + fs.readdirSync(dir).reduce((s, f) => s + fs.statSync(path.join(dir, f)).size, 0), 0)
console.log(`复制完成：模型 1 个 + WASM ${ORT_FILES.length} 个，本次新增 ${mb(added)}，目录合计 ${mb(all)}`)
