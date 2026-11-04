const path = require('path')
const fs = require('fs')
const { chromium } = require('C:/Users/DELL/AppData/Local/hermes/hermes-agent/node_modules/playwright-core')
const EXEC = 'C:/Users/DELL/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
const BASE = 'http://localhost:5200'
const V = path.resolve('_verify')

;(async () => {
  const browser = await chromium.launch({ executablePath: EXEC, headless: true })
  const page = await browser.newPage()
  page.on('pageerror', e => console.log('[pageerror]', e.message))
  await page.goto(BASE + '/#/textedit', { waitUntil: 'networkidle' })
  const out = await page.evaluate(async () => {
    const ort = await import('/@id/onnxruntime-web')
    ort.env.wasm.wasmPaths = new URL('/migan/ort/', location.href).href
    ort.env.wasm.numThreads = 1
    const res = await fetch('/migan/migan.onnx')
    const buf = new Uint8Array(await res.arrayBuffer())
    const session = await ort.InferenceSession.create(buf, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' })
    const meta = { inputs: session.inputNames, outputs: session.outputNames }

    // 输入：渐变 + 深色文字，裁剪成 512
    const W = 512, H = 512
    const c = document.createElement('canvas'); c.width = W; c.height = H
    const ctx = c.getContext('2d', { willReadFrequently: true })
    const g = ctx.createLinearGradient(0, 0, W, H)
    g.addColorStop(0, '#dfe9f5'); g.addColorStop(0.5, '#c9d9ea'); g.addColorStop(1, '#e8e2d6')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#1b2430'; ctx.font = 'bold 78px Arial, sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('SAMPLE 88', W / 2, H / 2)
    const id = ctx.getImageData(0, 0, W, H)
    const n = W * H
    const img = new Uint8Array(3 * n)
    for (let i = 0; i < n; i++) {
      img[i] = id.data[i * 4]; img[n + i] = id.data[i * 4 + 1]; img[2 * n + i] = id.data[i * 4 + 2]
    }
    const mask = new Uint8Array(n)
    for (let y = 200; y < 310; y++) for (let x = 90; x < 430; x++) mask[y * W + x] = 1

    const toUrl = (d, w, h, mode) => {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h
      const cc = cv.getContext('2d')
      const rgba = new Uint8ClampedArray(w * h * 4)
      if (mode === 'nchw') {
        for (let i = 0; i < w * h; i++) { rgba[i*4]=d[i]; rgba[i*4+1]=d[w*h+i]; rgba[i*4+2]=d[2*w*h+i]; rgba[i*4+3]=255 }
      } else {
        for (let i = 0; i < w * h; i++) { rgba[i*4]=d[i*3]; rgba[i*4+1]=d[i*3+1]; rgba[i*4+2]=d[i*3+2]; rgba[i*4+3]=255 }
      }
      cc.putImageData(new ImageData(rgba, w, h), 0, 0)
      return cv.toDataURL('image/png')
    }

    const runs = {}
    for (const [tag, maskVal] of [['mask1', 1], ['mask255', 255]]) {
      const m = new Uint8Array(n)
      for (let i = 0; i < n; i++) if (mask[i]) m[i] = maskVal
      const inputs = {
        image: new ort.Tensor('uint8', img, [1, 3, 512, 512]),
        mask: new ort.Tensor('uint8', m, [1, 1, 512, 512]),
      }
      const r = await session.run(inputs)
      const t = r.result
      const data = t.data
      let min = 255, max = 0, sum = 0
      for (let i = 0; i < data.length; i++) { const v = data[i]; if (v<min)min=v; if(v>max)max=v; sum+=v }
      runs[tag] = {
        type: t.type, dims: t.dims, ctor: data.constructor.name,
        min, max, mean: +(sum / data.length).toFixed(2),
        nchw: toUrl(data, 512, 512, 'nchw'),
        nhwc: toUrl(data, 512, 512, 'nhwc'),
      }
    }
    return { meta, runs }
  })
  console.log('meta', JSON.stringify(out.meta))
  for (const [k, v] of Object.entries(out.runs)) {
    console.log(k, JSON.stringify({ type: v.type, dims: v.dims, ctor: v.ctor, min: v.min, max: v.max, mean: v.mean }))
    fs.writeFileSync(path.join(V, `_b2_layout_${k}_nchw.png`), Buffer.from(v.nchw.split(',')[1], 'base64'))
    fs.writeFileSync(path.join(V, `_b2_layout_${k}_nhwc.png`), Buffer.from(v.nhwc.split(',')[1], 'base64'))
  }
  await browser.close()
})().catch(e => { console.error(e); process.exit(2) })
