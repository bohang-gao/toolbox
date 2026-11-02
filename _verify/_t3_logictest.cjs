const fs = require('fs')
const { PDFDocument, StandardFonts, rgb, degrees } = require('pdf-lib')
const { open, info } = require('./_t3_check.cjs')

// ---- 复刻 src/lib/pdf.js 的纯函数 ----
function parsePageGroups(spec, total) {
  const text = String(spec == null ? '' : spec).replace(/[，、;；]/g, ',').replace(/\s*[-~]\s*/g, '-').trim()
  if (!text) return { groups: [], error: 'empty' }
  const tokens = text.split(/[,\s]+/).filter(Boolean)
  if (!tokens.length) return { groups: [], error: 'empty' }
  const groups = []
  for (const token of tokens) {
    const m = token.match(/^(\d+)(?:\s*[-~]\s*(\d+))?$/)
    if (!m) return { groups: [], error: 'bad token ' + token }
    const start = Number(m[1])
    const end = m[2] === undefined ? start : Number(m[2])
    if (start < 1 || end < 1) return { groups: [], error: 'zero' }
    if (start > end) return { groups: [], error: 'range order' }
    if (end > total) return { groups: [], error: 'out of range ' + total }
    const group = []
    for (let p = start; p <= end; p++) group.push(p - 1)
    groups.push(group)
  }
  return { groups, error: null }
}
function flattenGroups(groups) {
  const out = []
  const seen = new Set()
  for (const g of groups) for (const p of g) { if (!seen.has(p)) { seen.add(p); out.push(p) } }
  return out
}
function pagesToLabel(pages) {
  const sorted = [...new Set(pages)].sort((a, b) => a - b)
  if (!sorted.length) return ''
  const parts = []
  let runStart = sorted[0]
  let prev = sorted[0]
  for (let i = 1; i <= sorted.length; i++) {
    const cur = sorted[i]
    if (cur === prev + 1) { prev = cur; continue }
    parts.push(runStart === prev ? String(runStart + 1) : (runStart + 1) + '-' + (prev + 1))
    runStart = cur
    prev = cur
  }
  return parts.join(',')
}
async function copyPagesToNewDoc(src, idx) {
  const out = await PDFDocument.create()
  const pages = await out.copyPages(src, idx)
  for (const p of pages) out.addPage(p)
  return out
}

;(async () => {
  const pass = []
  const fail = []
  const ok = (name, cond, extra) => { (cond ? pass : fail).push(name + (extra ? ' :: ' + extra : '')) }

  // ---- 页码解析 ----
  let r
  r = parsePageGroups('1-3,5', 5)
  ok('parse 1-3,5 groups', r.groups.length === 2 && r.groups[0].join(',') === '0,1,2' && r.groups[1][0] === 4)
  ok('parse flat', flattenGroups(r.groups).join(',') === '0,1,2,4')
  ok('label roundtrip', pagesToLabel(flattenGroups(r.groups)) === '1-3,5', pagesToLabel(flattenGroups(r.groups)))
  r = parsePageGroups('3,1,2', 3)
  ok('parse order preserved', r.groups.map(g => g[0]).join(',') === '2,0,1')
  r = parsePageGroups('1，3', 5)
  ok('chinese comma', r.groups.length === 2)
  r = parsePageGroups('1 - 3', 5)
  ok('spaces around dash', r.groups[0].join(',') === '0,1,2')
  r = parsePageGroups('1-9', 5)
  ok('out of range rejected', !!r.error, r.error)
  r = parsePageGroups('3-1', 5)
  ok('reverse rejected', !!r.error)
  r = parsePageGroups('abc', 5)
  ok('invalid token rejected', !!r.error)
  r = parsePageGroups('', 5)
  ok('empty rejected', !!r.error)
  r = parsePageGroups('0', 5)
  ok('zero rejected', !!r.error)

  // ---- 合并 ----
  const A = await open('_t3_A.pdf')
  const B = await open('_t3_B.pdf')
  {
    const out = await PDFDocument.create()
    for (const d of [A, B]) {
      const pages = await out.copyPages(d, d.getPageIndices())
      for (const p of pages) out.addPage(p)
    }
    fs.writeFileSync('_out_merge.pdf', await out.save())
    const o = info(await open('_out_merge.pdf'))
    ok('merge pages = 7', o.pages === 7, String(o.pages))
  }

  // ---- 拆分 1-3,5 ----
  {
    const { groups } = parsePageGroups('1-3,5', A.getPageCount())
    for (let gi = 0; gi < groups.length; gi++) {
      const out = await copyPagesToNewDoc(A, groups[gi])
      const p = '_out_split_' + gi + '.pdf'
      fs.writeFileSync(p, await out.save())
      const o = info(await open(p))
      ok('split[' + gi + '] pages', o.pages === groups[gi].length, o.pages + ' vs ' + groups[gi].length)
    }
  }

  // ---- 提取 2-4 ----
  {
    const { groups } = parsePageGroups('2-4', A.getPageCount())
    const out = await copyPagesToNewDoc(A, flattenGroups(groups))
    fs.writeFileSync('_out_extract.pdf', await out.save())
    ok('extract 2-4 pages=3', info(await open('_out_extract.pdf')).pages === 3)
  }

  // ---- 删除 2,4-5 ----
  {
    const { groups } = parsePageGroups('2,4-5', A.getPageCount())
    const removed = new Set(flattenGroups(groups))
    const keep = []
    for (let i = 0; i < A.getPageCount(); i++) if (!removed.has(i)) keep.push(i)
    const out = await copyPagesToNewDoc(A, keep)
    fs.writeFileSync('_out_delete.pdf', await out.save())
    ok('delete 2,4-5 keeps 2', info(await open('_out_delete.pdf')).pages === 2, 'removed=' + [...removed])
  }

  // ---- 旋转 ----
  for (const ang of [90, 180, 270]) {
    const d = await open('_t3_A.pdf')
    for (const p of d.getPages()) p.setRotation(degrees(ang))
    const p = '_out_rotate_' + ang + '.pdf'
    fs.writeFileSync(p, await d.save())
    const o = info(await open(p))
    ok('rotate ' + ang + ' all pages', o.sizes.every(s => s.endsWith('@' + ang)), o.sizes.join('|'))
  }

  // ---- 排序 ----
  {
    const order = [4, 3, 2, 1, 0]
    const out = await copyPagesToNewDoc(A, order)
    fs.writeFileSync('_out_sort.pdf', await out.save())
    ok('sort pages=5', info(await open('_out_sort.pdf')).pages === 5)
  }

  // ---- 压缩 ----
  {
    const d = await open('_t3_A.pdf')
    const bytes = await d.save({ useObjectStreams: true, addDefaultPage: false, updateFieldAppearances: false })
    fs.writeFileSync('_out_compress.pdf', bytes)
    const o = info(await open('_out_compress.pdf'))
    ok('compress pages=5', o.pages === 5, 'size ' + fs.statSync('_t3_A.pdf').size + ' -> ' + bytes.length)
  }

  // ---- 页码 ----
  {
    const d = await open('_t3_A.pdf')
    const font = await d.embedFont(StandardFonts.Helvetica)
    d.getPages().forEach((page, i) => {
      const { width } = page.getSize()
      const t = String(1 + i)
      const tw = font.widthOfTextAtSize(t, 12)
      page.drawText(t, { x: (width - tw) / 2, y: 20, size: 12, font, color: rgb(0.2, 0.2, 0.2) })
    })
    fs.writeFileSync('_out_pagenum.pdf', await d.save())
    ok('page number pages=5', info(await open('_out_pagenum.pdf')).pages === 5)
  }

  // ---- 水印 ----
  {
    const d = await open('_t3_A.pdf')
    const font = await d.embedFont(StandardFonts.HelveticaBold)
    const content = 'CONFIDENTIAL'
    const size = 36
    const tw = font.widthOfTextAtSize(content, size)
    let draws = 0
    for (const page of d.getPages()) {
      const { width, height } = page.getSize()
      const stepX = Math.max(tw * 0.9, size * 4)
      const stepY = Math.max(size * 3, 80)
      const diag = Math.sqrt(width * width + height * height)
      for (let y = -diag / 2; y < height + diag / 2; y += stepY) {
        for (let x = -diag / 2; x < width + diag / 2; x += stepX) {
          page.drawText(content, { x, y, size, font, color: rgb(0.5, 0.5, 0.5), opacity: 0.2, rotate: degrees(45) })
          draws++
        }
      }
    }
    fs.writeFileSync('_out_watermark.pdf', await d.save())
    ok('watermark pages=5', info(await open('_out_watermark.pdf')).pages === 5, 'draws=' + draws)
  }

  // ---- 元数据 ----
  {
    const d = await open('_t3_A.pdf')
    d.setTitle('New Title')
    d.setAuthor('New Author')
    d.setSubject('New Subj')
    d.setKeywords(['x', 'y'])
    d.setCreationDate(new Date('2025-06-01T12:00:00'))
    fs.writeFileSync('_out_metadata.pdf', await d.save())
    const o = info(await open('_out_metadata.pdf'))
    ok('metadata applied',
      o.title === 'New Title' && o.author === 'New Author' && o.subject === 'New Subj' && o.keywords === 'x y',
      JSON.stringify({ t: o.title, a: o.author, s: o.subject, k: o.keywords, c: o.created }))
  }

  // ---- 页面宽度统一 ----
  {
    const d = await open('_t3_A.pdf')
    const target = 595
    for (const page of d.getPages()) {
      const { width, height } = page.getSize()
      if (Math.abs(width - target) < 0.5) continue
      const sc = target / width
      page.scaleContent(sc, sc)
      page.setSize(target, height * sc)
    }
    fs.writeFileSync('_out_resize.pdf', await d.save())
    const o = info(await open('_out_resize.pdf'))
    ok('resize all width=595', o.sizes.every(s => parseInt(s, 10) === 595), o.sizes.join('|'))
  }

  console.log('\nPASS (' + pass.length + ')')
  pass.forEach(x => console.log('  OK  ' + x))
  if (fail.length) {
    console.log('\nFAIL (' + fail.length + ')')
    fail.forEach(x => console.log('  NG  ' + x))
  }
  process.exit(fail.length ? 1 : 0)
})().catch(e => { console.error('TEST CRASH', e); process.exit(2) })
