const path = require('path')
const fs = require('fs')
const { chromium } = require('C:/Users/DELL/AppData/Local/hermes/hermes-agent/node_modules/playwright-core')
const EXEC = 'C:/Users/DELL/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
const BASE = 'http://localhost:5200'
const V = path.resolve('_verify')

;(async () => {
  const browser = await chromium.launch({ executablePath: EXEC, headless: true })
  const page = await browser.newPage()
  page.on('console', m => { if (m.type() !== 'debug') console.log('[' + m.type() + ']', m.text()) })
  page.on('pageerror', e => console.log('[pageerror]', e.message))
  await page.goto(BASE + '/#/textedit', { waitUntil: 'networkidle' })
  const out = await page.evaluate(async () => {
    const { expandMask, lowFreqMatch, featherComposite } = await import('/src/lib/inpaint.js')
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
    const img = mk(true), baseline = mk(false)
    const raw = new Uint8Array(W * H)
    for (let y = 205; y < 300; y++) for (let x = 240; x < 665; x++) raw[y * W + x] = 1
    const expanded = expandMask(raw, W, H, 3)

    const r = await aiInpaint(img, expanded, () => {})
    if (!r.ok) return { error: r.reason }
    const filled = r.filled
    const matched = lowFreqMatch(filled, img, expanded, 24)
    const merged = featherComposite(img, matched, expanded, 3.5)

    const toUrl = (id) => {
      const c = document.createElement('canvas'); c.width = id.width; c.height = id.height
      const ctx = c.getContext('2d')
      const imgData = new ImageData(new Uint8ClampedArray(id.data), id.width, id.height)
      ctx.putImageData(imgData, 0, 0); return c.toDataURL('image/png')
    }
    // 统计：mask 内 filled 与 baseline 的均值差；matched 同
    const stat = (id, name) => {
      let sf = [0,0,0], sb = [0,0,0], n = 0
      for (let i = 0; i < W*H; i++) {
        if (!expanded[i]) continue
        const j = i*4
        for (let c = 0; c < 3; c++) { sf[c] += id.data[j+c]; sb[c] += baseline.data[j+c] }
        n++
      }
      return { name, n, filledMean: sf.map(v => +(v/n).toFixed(1)), baseMean: sb.map(v => +(v/n).toFixed(1)) }
    }
    const origStat = stat(img, 'orig')
    const fillStat = stat(filled, 'filled')
    const matchStat = stat(matched, 'matched')
    const mergedStat = stat(merged, 'merged')
    return {
      timings: r.timings,
      origStat, fillStat, matchStat, mergedStat,
      urls: { filled: toUrl(filled), matched: toUrl(matched), merged: toUrl(merged) },
    }
  })
  if (out.error) { console.log('ERROR', out.error); await browser.close(); return }
  console.log(JSON.stringify({ timings: out.timings, origStat: out.origStat, fillStat: out.fillStat, matchStat: out.matchStat, mergedStat: out.mergedStat }, null, 1))
  for (const [k, u] of Object.entries(out.urls)) {
    fs.writeFileSync(path.join(V, `_b2_dbg_${k}.png`), Buffer.from(u.split(',')[1], 'base64'))
  }
  await browser.close()
})().catch(e => { console.error(e); process.exit(2) })
