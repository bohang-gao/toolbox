const path = require('path')
const fs = require('fs')
const { chromium } = require('C:/Users/DELL/AppData/Local/hermes/hermes-agent/node_modules/playwright-core')
const EXEC = 'C:/Users/DELL/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
const BASE = 'http://localhost:5200'

;(async () => {
  const browser = await chromium.launch({ executablePath: EXEC, headless: true })
  const page = await browser.newPage()
  page.on('pageerror', e => console.log('[pageerror]', e.message))
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
    const img = mk(true), baseline = mk(false)
    const raw = new Uint8Array(W * H)
    for (let y = 205; y < 300; y++) for (let x = 240; x < 665; x++) raw[y * W + x] = 1
    const expanded = expandMask(raw, W, H, 3)
    const r = await aiInpaint(img, expanded, () => {})
    if (!r.ok) return { error: r.reason }
    const filled = r.filled

    // 简单盒模糊（半径 r，只用于细节分离）
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

    const metrics = (merged) => {
      let maxOut = 0
      for (let i = 0; i < W * H; i++) {
        if (expanded[i]) continue
        const j = i * 4
        maxOut = Math.max(maxOut, Math.abs(merged.data[j] - img.data[j]),
          Math.abs(merged.data[j + 1] - img.data[j + 1]), Math.abs(merged.data[j + 2] - img.data[j + 2]))
      }
      const lum = (d, j) => d[j] * 0.299 + d[j + 1] * 0.587 + d[j + 2] * 0.114
      const outer = expandMask(expanded, W, H, 4)
      let iS = 0, iN = 0, oS = 0, oN = 0
      for (let i = 0; i < W * H; i++) {
        const j = i * 4
        if (expanded[i]) { iS += lum(merged.data, j); iN++ }
        else if (outer[i]) { oS += lum(merged.data, j); oN++ }
      }
      const boundary = Math.abs(iS / iN - oS / oN)
      let ds = 0, dn = 0
      for (let i = 0; i < W * H; i++) {
        if (!expanded[i]) continue
        const j = i * 4
        ds += Math.abs(merged.data[j] - baseline.data[j]) + Math.abs(merged.data[j + 1] - baseline.data[j + 1])
          + Math.abs(merged.data[j + 2] - baseline.data[j + 2]); dn += 3
      }
      return { boundary: +boundary.toFixed(2), region: +(ds / dn).toFixed(2), maxOut }
    }

    const variants = {}
    // 0 现状
    variants.current = metrics(featherComposite(img, lowFreqMatch(filled, img, expanded, 24), expanded, 3.5))
    // 1 sigma 12 / 48
    variants.sigma12 = metrics(featherComposite(img, lowFreqMatch(filled, img, expanded, 12), expanded, 3.5))
    variants.sigma48 = metrics(featherComposite(img, lowFreqMatch(filled, img, expanded, 48), expanded, 3.5))
    // 2 两次 lowFreq
    variants.twice = metrics(featherComposite(img,
      lowFreqMatch(lowFreqMatch(filled, img, expanded, 24), img, expanded, 24), expanded, 3.5))
    // 3 经典做底 + AI 细节
    const classic = classicInpaint(img, expanded, { median: true, edge: true })
    const detail = (() => {
      const b = boxBlur(filled, 6); const o = new Uint8ClampedArray(filled.data.length)
      for (let i = 0; i < W * H * 4; i += 4) {
        o[i] = filled.data[i] - b.data[i] + 128
        o[i + 1] = filled.data[i + 1] - b.data[i + 1] + 128
        o[i + 2] = filled.data[i + 2] - b.data[i + 2] + 128
        o[i + 3] = 255
      }
      return { data: o, width: W, height: H }
    })()
    for (const k of [0.3, 0.6, 1.0]) {
      const blend = new Uint8ClampedArray(classic.data.length)
      for (let i = 0; i < W * H * 4; i += 4) {
        blend[i] = classic.data[i] + k * (detail.data[i] - 128)
        blend[i + 1] = classic.data[i + 1] + k * (detail.data[i + 1] - 128)
        blend[i + 2] = classic.data[i + 2] + k * (detail.data[i + 2] - 128)
        blend[i + 3] = 255
      }
      variants['detailK' + k] = metrics(featherComposite(img,
        lowFreqMatch({ data: blend, width: W, height: H }, img, expanded, 24), expanded, 3.5))
    }
    variants.classicOnly = metrics(featherComposite(img,
      lowFreqMatch(classic, img, expanded, 24), expanded, 3.5))
    return { timings: r.timings, variants }
  })
  console.log(JSON.stringify(out, null, 1))
  await browser.close()
})().catch(e => { console.error(e); process.exit(2) })
