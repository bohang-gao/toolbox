const fs = require('fs')

;(async () => {
  const pass = []
  const fail = []
  const ok = (name, cond, extra) => { (cond ? pass : fail).push(name + (extra ? ' :: ' + extra : '')) }

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const { createCanvas } = await import('@napi-rs/canvas')

  async function openPdf(path) {
    const data = new Uint8Array(fs.readFileSync(path))
    return pdfjs.getDocument({ data, useSystemFonts: false, isEvalSupported: false }).promise
  }

  // ---- pdf2image: 每页渲染 PNG，数量应等于页数 ----
  {
    const doc = await openPdf('_t3_A.pdf')
    const scale = 1.5
    const pngs = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const viewport = page.getViewport({ scale })
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvasContext: ctx, viewport }).promise
      const buf = await canvas.encode('png')
      pngs.push({ page: i, w: canvas.width, h: canvas.height, bytes: buf.length, magic: buf.slice(1, 4).toString() })
      page.cleanup()
    }
    await doc.destroy()
    ok('pdf2image png count = 5', pngs.length === 5, pngs.map(p => `${p.page}:${p.w}x${p.h}`).join('|'))
    ok('pdf2image all real PNG', pngs.every(p => p.magic === 'PNG' && p.bytes > 1000), pngs.map(p => p.bytes).join(','))
  }

  // ---- pdf-extract-image: 内嵌位图提取，minSize=16 过滤图标 ----
  async function collectPageImages(page) {
    const { fnArray, argsArray } = await page.getOperatorList()
    const ids = []
    const seen = new Set()
    const OPS = pdfjs.OPS
    for (let i = 0; i < fnArray.length; i++) {
      const fn = fnArray[i]
      const args = argsArray[i]
      if (fn === OPS.paintImageXObject || fn === OPS.paintImageXObjectRepeat ||
          fn === OPS.paintInlineImageXObject || fn === OPS.paintInlineImageXObjectGroup ||
          fn === OPS.paintImageMaskXObject || fn === OPS.paintImageMaskXObjectGroup) {
        if (!args || !args[0]) continue
        const id = args[0]
        if (typeof id === 'string') { if (!seen.has(id)) { seen.add(id); ids.push(id) } }
      }
    }
    const imgs = []
    for (const id of ids) {
      const data = await new Promise(res => {
        let done = false
        page.objs.get(id, d => { if (!done) { done = true; res(d) } })
        setTimeout(() => { if (!done) { done = true; res(null) } }, 5000)
      })
      if (data && data.width && data.height) imgs.push(data)
    }
    return imgs
  }

  {
    const doc = await openPdf('_t3_C.pdf')
    const all = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const imgs = await collectPageImages(page)
      all.push(...imgs.map(im => ({ page: i, w: im.width, h: im.height, kind: im.kind })))
      page.cleanup()
    }
    await doc.destroy()
    const min = 16
    const kept = all.filter(im => !(im.w < min && im.h < min))
    ok('extract raw images = 6 (3 big + 3 icon)', all.length === 6, all.map(a => `${a.page}:${a.w}x${a.h}/k${a.kind}`).join('|'))
    ok('extract minSize=16 keeps 3 (120x90)', kept.length === 3 && kept.every(k => k.w === 120 && k.h === 90), kept.map(k => `${k.w}x${k.h}`).join('|'))
    ok('extract minSize=1 keeps 6', all.filter(im => !(im.w < 1 && im.h < 1)).length === 6)
  }

  // ---- pdf-to-long-image: 默认 1.5x 下总高度不超过画布上限 ----
  {
    const doc = await openPdf('_t3_A.pdf')
    const scale = 1.5
    let width = 0
    const heights = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const vp = page.getViewport({ scale })
      width = Math.max(width, Math.ceil(vp.width))
      heights.push(Math.ceil(vp.height))
      page.cleanup()
    }
    await doc.destroy()
    const gap = 10
    const totalH = heights.reduce((s, h) => s + h, 0) + gap * (heights.length - 1)
    ok('long-image height under 16384', totalH < 16384, `w=${width} totalH=${totalH}`)
  }

  console.log('\nPASS (' + pass.length + ')')
  pass.forEach(x => console.log('  OK  ' + x))
  if (fail.length) {
    console.log('\nFAIL (' + fail.length + ')')
    fail.forEach(x => console.log('  NG  ' + x))
  }
  process.exit(fail.length ? 1 : 0)
})().catch(e => { console.error('TEST CRASH', e); process.exit(2) })
