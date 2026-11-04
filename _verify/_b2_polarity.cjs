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
    const buf = new Uint8Array(await (await fetch('/migan/migan.onnx')).arrayBuffer())
    const session = await ort.InferenceSession.create(buf, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' })

    const W = 512, H = 512, n = W * H
    const c = document.createElement('canvas'); c.width = W; c.height = H
    const ctx = c.getContext('2d', { willReadFrequently: true })
    const g = ctx.createLinearGradient(0, 0, W, H)
    g.addColorStop(0, '#dfe9f5'); g.addColorStop(0.5, '#c9d9ea'); g.addColorStop(1, '#e8e2d6')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#1b2430'; ctx.font = 'bold 78px Arial, sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('SAMPLE 88', W / 2, H / 2)
    const id = ctx.getImageData(0, 0, W, H)
    const img = new Uint8Array(3 * n)
    for (let i = 0; i < n; i++) { img[i] = id.data[i*4]; img[n+i] = id.data[i*4+1]; img[2*n+i] = id.data[i*4+2] }
    const hole = new Uint8Array(n)
    for (let y = 195; y < 315; y++) for (let x = 80; x < 440; x++) hole[y*W+x] = 1

    const toUrl = (d, mode) => {
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H
      const rgba = new Uint8ClampedArray(W*H*4)
      if (mode === 'nchw') for (let i = 0; i < n; i++) { rgba[i*4]=d[i]; rgba[i*4+1]=d[n+i]; rgba[i*4+2]=d[2*n+i]; rgba[i*4+3]=255 }
      else for (let i = 0; i < n; i++) { rgba[i*4]=d[i*3]; rgba[i*4+1]=d[i*3+1]; rgba[i*4+2]=d[i*3+2]; rgba[i*4+3]=255 }
      cv.getContext('2d').putImageData(new ImageData(rgba, W, H), 0, 0)
      return cv.toDataURL('image/png')
    }
    const inputUrl = toUrl(img, 'nchw')
    const res = { inputUrl, runs: {} }
    for (const pol of ['hole255', 'hole0']) {
      const m = new Uint8Array(n)
      for (let i = 0; i < n; i++) m[i] = hole[i] ? (pol === 'hole255' ? 255 : 0) : (pol === 'hole255' ? 0 : 255)
      const r = await session.run({
        image: new ort.Tensor('uint8', img, [1,3,512,512]),
        mask: new ort.Tensor('uint8', m, [1,1,512,512]),
      })
      const d = r.result.data
      res.runs[pol] = { nchw: toUrl(d, 'nchw'), nhwc: toUrl(d, 'nhwc') }
    }
    return res
  })
  fs.writeFileSync(path.join(V, '_b2_pol_input.png'), Buffer.from(out.inputUrl.split(',')[1], 'base64'))
  for (const [pol, v] of Object.entries(out.runs)) {
    fs.writeFileSync(path.join(V, `_b2_pol_${pol}_nchw.png`), Buffer.from(v.nchw.split(',')[1], 'base64'))
    fs.writeFileSync(path.join(V, `_b2_pol_${pol}_nhwc.png`), Buffer.from(v.nhwc.split(',')[1], 'base64'))
  }
  console.log('done')
  await browser.close()
})().catch(e => { console.error(e); process.exit(2) })
