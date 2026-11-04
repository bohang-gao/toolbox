const path = require('path')
const fs = require('fs')
const { chromium } = require('C:/Users/DELL/AppData/Local/hermes/hermes-agent/node_modules/playwright-core')
const EXEC = 'C:/Users/DELL/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
const BASE = 'http://localhost:5200'
const V = path.resolve('_verify')

;(async () => {
  const browser = await chromium.launch({ executablePath: EXEC, headless: true })
  const page = await browser.newPage()
  await page.goto(BASE + '/#/textedit', { waitUntil: 'networkidle' })
  const out = await page.evaluate(async () => {
    const { expandMask, lowFreqMatch, featherComposite, classicInpaint } = await import('/src/lib/inpaint.js')
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
    const img = mk(true)
    const raw = new Uint8Array(W * H)
    for (let y = 205; y < 300; y++) for (let x = 240; x < 665; x++) raw[y * W + x] = 1
    const expanded = expandMask(raw, W, H, 3)
    const r = await aiInpaint(img, expanded, () => {})
    if (!r.ok) return { error: r.reason }
    const filled = r.filled
    const boxBlur = (id, rad) => {
      const d = id.data, o = new Uint8ClampedArray(d.length)
      const tmp = new Float32Array(W * H * 3)
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let sr = 0, sg = 0, sb = 0, n = 0
        for (let k = -rad; k <= rad; k++) {
          const xx = Math.min(W - 1, Math.max(0, x + k)); const j = (y * W + xx) * 4
          sr += d[j]; sg += d[j + 1]; sb += d[j + 2]; n++
        }
        const t = (y * W + x) * 3
        tmp[t] = sr / n; tmp[t + 1] = sg / n; tmp[t + 2] = sb / n
      }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let sr = 0, sg = 0, sb = 0, n = 0
        for (let k = -rad; k <= rad; k++) {
          const yy = Math.min(H - 1, Math.max(0, y + k)); const t = (yy * W + x) * 3
          sr += tmp[t]; sg += tmp[t + 1]; sb += tmp[t + 2]; n++
        }
        const j = (y * W + x) * 4
        o[j] = sr / n; o[j + 1] = sg / n; o[j + 2] = sb / n; o[j + 3] = 255
      }
      return { data: o, width: W, height: H }
    }
    const classic = classicInpaint(img, expanded, { median: true, edge: true })
    const b = boxBlur(filled, 6)
    const detail = new Float32Array(W * H * 3)
    for (let i = 0, p = 0; i < W * H; i++, p += 4) {
      const t = i * 3
      detail[t] = filled.data[p] - b.data[p]
      detail[t + 1] = filled.data[p + 1] - b.data[p + 1]
      detail[t + 2] = filled.data[p + 2] - b.data[p + 2]
    }
    const toUrl = (id) => {
      const c = document.createElement('canvas'); c.width = id.width; c.height = id.height
      c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(id.data), id.width, id.height), 0, 0)
      return c.toDataURL('image/png')
    }
    const urls = {}
    for (const k of [0.3, 0.6]) {
      const blend = new Uint8ClampedArray(classic.data.length)
      for (let i = 0, p = 0; i < W * H; i++, p += 4) {
        const t = i * 3
        blend[p] = classic.data[p] + k * detail[t]
        blend[p + 1] = classic.data[p + 1] + k * detail[t + 1]
        blend[p + 2] = classic.data[p + 2] + k * detail[t + 2]
        blend[p + 3] = 255
      }
      urls['k' + k] = toUrl(featherComposite(img, lowFreqMatch({ data: blend, width: W, height: H }, img, expanded, 24), expanded, 3.5))
    }
    urls.classic = toUrl(featherComposite(img, lowFreqMatch(classic, img, expanded, 24), expanded, 3.5))
    return { urls }
  })
  if (out.error) { console.log('ERROR', out.error); await browser.close(); return }
  for (const [k, u] of Object.entries(out.urls)) {
    fs.writeFileSync(path.join(V, `_b2_variant_${k}.png`), Buffer.from(u.split(',')[1], 'base64'))
  }
  await browser.close()
})().catch(e => { console.error(e); process.exit(2) })
