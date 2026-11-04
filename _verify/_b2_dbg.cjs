const path = require('path')
const { chromium } = require('C:/Users/DELL/AppData/Local/hermes/hermes-agent/node_modules/playwright-core')
const EXEC = 'C:/Users/DELL/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
const BASE = 'http://localhost:5200'

;(async () => {
  const browser = await chromium.launch({ executablePath: EXEC, headless: true })
  const page = await browser.newPage()
  page.on('console', m => console.log('[console.' + m.type() + ']', m.text()))
  page.on('pageerror', e => console.log('[pageerror]', e.message))
  page.on('requestfailed', r => console.log('[reqfail]', r.url(), r.failure() && r.failure().errorText))
  await page.goto(BASE + '/#/textedit', { waitUntil: 'networkidle' })
  const out = await page.evaluate(async () => {
    const ort = await import('/@id/onnxruntime-web')
    ort.env.wasm.wasmPaths = new URL('/migan/ort/', location.href).href
    ort.env.wasm.numThreads = 1
    const logs = []
    logs.push('ort version=' + (ort.env.versions && JSON.stringify(ort.env.versions)))
    const res = await fetch('/migan/migan.onnx')
    logs.push('fetch status=' + res.status)
    const buf = new Uint8Array(await res.arrayBuffer())
    logs.push('model bytes=' + buf.byteLength)
    let session
    try {
      session = await ort.InferenceSession.create(buf, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' })
    } catch (e) {
      return { logs, createError: String(e && (e.stack || e.message || e)) }
    }
    logs.push('inputs=' + JSON.stringify(session.inputNames) + ' outputs=' + JSON.stringify(session.outputNames))
    try {
      const img = new Uint8Array(3 * 512 * 512).fill(120)
      const mask = new Uint8Array(1 * 512 * 512)
      for (let y = 200; y < 300; y++) for (let x = 200; x < 320; x++) mask[y * 512 + x] = 1
      const inputs = {
        image: new ort.Tensor('uint8', img, [1, 3, 512, 512]),
        mask: new ort.Tensor('uint8', mask, [1, 1, 512, 512]),
      }
      const t0 = performance.now()
      const r = await session.run(inputs)
      const dt = performance.now() - t0
      const key = Object.keys(r)[0]
      logs.push('run ok ' + dt.toFixed(0) + 'ms key=' + key + ' type=' + r[key].type + ' dims=' + JSON.stringify(r[key].dims) + ' ctor=' + r[key].data.constructor.name)
    } catch (e) {
      return { logs, runError: String(e && (e.stack || e.message || e)) }
    }
    return { logs }
  })
  console.log(JSON.stringify(out, null, 1))
  await browser.close()
})().catch(e => { console.error(e); process.exit(2) })
