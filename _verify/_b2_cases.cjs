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
    const { expandMask } = await import('/src/lib/inpaint.js')
    const { aiInpaint } = await import('/src/lib/aiInpaint.js')
    const W = 900, H = 500
    const mk = (withText) => {
      const c = document.createElement('canvas'); c.width = W; c.height = H
      const ctx = c.getContext('2d', { willReadFrequently: true })
      const g = ctx.createLinearGradient(0, 0, W, H)
      g.addColorStop(0, '#dfe9f5'); g.addColorStop(0.5, '#c9d9ea'); g.addColorStop(1, '#e8e2d6')
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
      if (withText) {
        ctx.fillStyle = '#1b2430'; ctx.font = 'bold 78px Arial, sans-serif'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText('SAMPLE 88', W / 2, H / 2)
      }
      return ctx.getImageData(0, 0, W, H)
    }
    const toUrl = (id) => {
      const c = document.createElement('canvas'); c.width = id.width; c.height = id.height
      c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(id.data), id.width, id.height), 0, 0)
      return c.toDataURL('image/png')
    }
    const run = async (label, maskW, maskH, ox, oy, withText) => {
      const img = mk(withText)
      const raw = new Uint8Array(W * H)
      for (let y = oy; y < oy + maskH; y++) for (let x = ox; x < ox + maskW; x++) raw[y * W + x] = 1
      const mask = expandMask(raw, W, H, 3)
      const r = await aiInpaint(img, mask, () => {})
      if (!r.ok) return { label, error: r.reason }
      return { label, url: toUrl(r.filled), timings: r.timings }
    }
    const res = []
    res.push(await run('small_hole_gradient', 60, 40, 420, 230, false))
    res.push(await run('small_text', 200, 80, 350, 210, true))
    res.push(await run('full_text', 431, 101, 237, 202, true))
    res.push(await run('square_gradient', 120, 120, 390, 190, false))
    return res
  })
  for (const r of out) {
    if (r.error) { console.log(r.label, 'ERROR', r.error); continue }
    fs.writeFileSync(path.join(V, `_b2_case_${r.label}.png`), Buffer.from(r.url.split(',')[1], 'base64'))
    console.log(r.label, JSON.stringify(r.timings))
  }
  await browser.close()
})().catch(e => { console.error(e); process.exit(2) })
