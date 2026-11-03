const path = require('path')
const fs = require('fs')
const { chromium } = require('C:/Users/DELL/AppData/Local/hermes/hermes-agent/node_modules/playwright-core')
const { PDFDocument } = require('pdf-lib')

const BASE = 'http://localhost:5199'
const EXEC = 'C:/Users/DELL/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
const V = path.resolve('_verify')
const F = {
  pdf: path.join(V, '_p2_two_pages.pdf'),
  img1: path.join(V, '_p2_img1.png'),
  img2: path.join(V, '_p2_img2.png'),
  txt: path.join(V, '_p2_not_allowed.txt'),
  bad: path.join(V, '_p2_corrupt.pdf')
}

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + detail : ''}`)
}

async function addFiles(page, files) {
  const chooser = page.waitForEvent('filechooser', { timeout: 10000 })
  await page.locator('button:has-text("添加文件")').first().click()
  const fc = await chooser
  await fc.setFiles(files)
}

async function lastMsg(page) {
  const msg = page.locator('.el-message').last()
  await msg.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {})
  return (await page.locator('.el-message').allTextContents()).join(' | ')
}

;(async () => {
  const browser = await chromium.launch({ executablePath: EXEC })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })
  const page = await ctx.newPage()
  const consoleErrors = []
  const pageErrors = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => pageErrors.push(String(e)))

  // ---------- 1. /print 页面 ----------
  await page.goto(`${BASE}/#/print`, { waitUntil: 'networkidle' })
  await page.locator('h1:has-text("批量打印")').waitFor({ timeout: 15000 })
  check('/print 页面可打开', true, await page.title())

  // 空态
  await page.locator('button:has-text("直接打印")').click()
  const m1 = await lastMsg(page)
  check('空态直接打印报错', m1.includes('请先添加文件'), m1)
  await page.waitForTimeout(2800)
  await page.locator('button:has-text("生成合并PDF")').click()
  const m2 = await lastMsg(page)
  check('空态生成PDF报错', m2.includes('请先添加文件'), m2)
  await page.waitForTimeout(2800)

  // 非法文件
  await addFiles(page, [F.txt])
  const m3 = await lastMsg(page)
  const rowsAfterTxt = await page.locator('.task-item').count()
  check('非法 .txt 被拒绝', m3.includes('仅支持 PDF 或图片文件') && rowsAfterTxt === 0, m3)
  await page.waitForTimeout(2800)

  // 添加合法文件
  await addFiles(page, [F.pdf, F.img1, F.img2])
  await page.locator('.task-item').nth(0).locator('.t-status.processing').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(300)
  const names = await page.locator('.task-item .t-name').allTextContents()
  const info = await page.locator('.print-info').textContent()
  check('列表 3 行', names.length === 3, names.join(', '))
  check('页数预估 4 页', info.includes('共 3 项') && info.includes('预计 4 页'), info.trim())
  check('PDF 页数标签', (await page.locator('.print-type-tag.pdf').first().textContent()).includes('2页'))

  // 排序：下移第 1 项 → 顺序变为 img1, pdf, img2
  await page.locator('.task-item').nth(0).locator('button[title="下移"]').click()
  const afterDown = await page.locator('.task-item .t-name').allTextContents()
  check('下移排序', afterDown.join('|') === ['_p2_img1.png', '_p2_two_pages.pdf', '_p2_img2.png'].join('|'), afterDown.join('|'))
  await page.locator('.task-item').nth(1).locator('button[title="上移"]').click()
  const afterUp = await page.locator('.task-item .t-name').allTextContents()
  check('上移排序', afterUp.join('|') === ['_p2_two_pages.pdf', '_p2_img1.png', '_p2_img2.png'].join('|'), afterUp.join('|'))
  // 删除/再添加
  await page.locator('.task-item').nth(2).locator('.t-del').click()
  const afterDel = await page.locator('.task-item').count()
  check('删除项', afterDel === 2, `rows=${afterDel}`)
  await addFiles(page, [F.img2])
  await page.waitForTimeout(300)
  check('重新添加恢复 3 项', (await page.locator('.task-item').count()) === 3)
  await page.screenshot({ path: path.join(V, '_p2_print_list.png') })

  // 生成合并 PDF
  const dlPromise = page.waitForEvent('download', { timeout: 30000 })
  await page.locator('button:has-text("生成合并PDF")').click()
  const dl = await dlPromise
  const savePath = path.join(V, '_p2_out_merged.pdf')
  await dl.saveAs(savePath)
  const out = await PDFDocument.load(fs.readFileSync(savePath))
  const sizes = out.getPages().map((p) => `${Math.round(p.getWidth() * 100) / 100}x${Math.round(p.getHeight() * 100) / 100}`)
  const msgGen = await lastMsg(page)
  check('合并PDF 4 页', out.getPageCount() === 4, `pages=${out.getPageCount()} sizes=${sizes.join(',')}`)
  check('合并PDF 首两张为 A4 (595.28x841.89)', sizes[0] === '595.28x841.89' && sizes[1] === '595.28x841.89', sizes.join(','))
  check('合并PDF 图片页为 A4 尺寸', sizes[2] === '595.28x841.89' && sizes[3] === '595.28x841.89', sizes.slice(2).join(','))
  check('生成成功提示', msgGen.includes('已生成 4 页可打印 PDF'), msgGen)
  check('下载文件名', dl.suggestedFilename() === '_p2_two_pages_print.pdf', dl.suggestedFilename())
  await page.waitForTimeout(2800)

  // 直接打印（拦截 window.print）
  await page.evaluate(() => {
    window.__printCalls = []
    window.print = function () {
      const sheets = Array.from(document.querySelectorAll('.print-sheet'))
      const imgs = Array.from(document.querySelectorAll('.print-sheet img'))
      const style = document.getElementById('print-style')
      window.__printCalls.push({
        sheets: sheets.length,
        imgs: imgs.length,
        widths: sheets.map((s) => s.style.width),
        heights: sheets.map((s) => s.style.height),
        gap: sheets.map((s) => s.style.gap),
        pageRule: style ? (style.textContent.match(/@page\{[^}]*\}/) || [''])[0] : '',
        hasStyle: !!style,
        bodyOverflow: document.body.style.overflow,
        rootInDom: !!document.querySelector('.print-root')
      })
    }
  })
  await page.locator('button:has-text("直接打印")').click()
  await page.waitForFunction(() => window.__printCalls && window.__printCalls.length > 0, null, { timeout: 30000 })
  const p1 = await page.evaluate(() => window.__printCalls[0])
  check('直接打印 4 张纸 / 4 图', p1.sheets === 4 && p1.imgs === 4, JSON.stringify({ sheets: p1.sheets, imgs: p1.imgs }))
  check('A4 纵向纸张尺寸', p1.widths.every((w) => w === '210mm') && p1.heights.every((h) => h === '297mm'), p1.widths[0] + ' x ' + p1.heights[0])
  check('@page 规则 A4 portrait', p1.pageRule.includes('size:A4 portrait') && p1.pageRule.includes('margin:0'), p1.pageRule)
  check('打印样式/容器已注入', p1.hasStyle && p1.rootInDom && p1.bodyOverflow === 'hidden')
  await page.waitForTimeout(1800)
  const cleaned = await page.evaluate(() => ({
    style: !!document.getElementById('print-style'),
    root: !!document.querySelector('.print-root'),
    overflow: document.body.style.overflow
  }))
  check('打印后清理', !cleaned.style && !cleaned.root && cleaned.overflow === '', JSON.stringify(cleaned))

  // copies=2 → 3 张纸 4 图
  await page.locator('.print-field:has-text("每页份数") select').selectOption('2')
  await page.evaluate(() => { window.__printCalls = [] })
  await page.locator('button:has-text("直接打印")').click()
  await page.waitForFunction(() => window.__printCalls.length > 0, null, { timeout: 30000 })
  const p2 = await page.evaluate(() => window.__printCalls[0])
  check('每页2份 → 3 张纸 4 图', p2.sheets === 3 && p2.imgs === 4, JSON.stringify({ sheets: p2.sheets, imgs: p2.imgs }))
  await page.waitForTimeout(1800)

  // A3 横向 + 边距 0
  await page.locator('.print-field:has-text("纸张") select').selectOption('A3')
  await page.locator('.print-field:has-text("方向") select').selectOption('landscape')
  await page.locator('.print-field:has-text("页边距") select').selectOption('0')
  await page.evaluate(() => { window.__printCalls = [] })
  await page.locator('button:has-text("直接打印")').click()
  await page.waitForFunction(() => window.__printCalls.length > 0, null, { timeout: 30000 })
  const p3 = await page.evaluate(() => window.__printCalls[0])
  check('A3 横向 420x297mm', p3.widths.every((w) => w === '420mm') && p3.heights.every((h) => h === '297mm'), p3.widths[0] + ' x ' + p3.heights[0])
  check('@page A3 landscape margin:0', p3.pageRule.includes('size:A3 landscape') && p3.pageRule.includes('margin:0'), p3.pageRule)
  await page.waitForTimeout(1800)

  // 恢复默认，测试损坏 PDF
  await page.locator('.print-field:has-text("纸张") select').selectOption('A4')
  await page.locator('.print-field:has-text("方向") select').selectOption('portrait')
  await page.locator('.print-field:has-text("页边距") select').selectOption('12')
  await page.locator('.print-field:has-text("每页份数") select').selectOption('1')
  await addFiles(page, [F.bad])
  await page.locator('.task-item').last().locator('.t-status.failed').waitFor({ timeout: 15000 })
  const failedTitle = await page.locator('.task-item').last().locator('.t-status.failed').getAttribute('title')
  const msgBad = await lastMsg(page)
  check('损坏 PDF 行标记失败', failedTitle && failedTitle.length > 0, failedTitle)
  check('损坏 PDF 错误提示', msgBad.includes('_p2_corrupt.pdf'), msgBad)
  const infoBad = await page.locator('.print-info').textContent()
  check('失败项不计入页数', infoBad.includes('共 4 项') && infoBad.includes('预计 4 页'), infoBad.trim())
  await page.waitForTimeout(2800)

  // 生成含失败项：应仍成功并给失败总结
  const dl2Promise = page.waitForEvent('download', { timeout: 30000 })
  await page.locator('button:has-text("生成合并PDF")').click()
  const dl2 = await dl2Promise
  await dl2.saveAs(path.join(V, '_p2_out_with_bad.pdf'))
  const out2 = await PDFDocument.load(fs.readFileSync(path.join(V, '_p2_out_with_bad.pdf')))
  check('含失败项仍生成 4 页', out2.getPageCount() === 4, `pages=${out2.getPageCount()}`)
  await page.waitForTimeout(3200)
  const allMsgs = await page.locator('.el-message').allTextContents()
  check('失败项总结提示', allMsgs.some((t) => t.includes('处理失败') && t.includes('_p2_corrupt.pdf')), allMsgs.join(' | '))
  await page.waitForTimeout(2800)

  // ---------- 2. 侧边栏分类与搜索 ----------
  await page.goto(`${BASE}/#/c/pdf`, { waitUntil: 'networkidle' })
  const pdfCards = await page.locator('a.tool').allTextContents()
  const printCard = page.locator('a.tool[href="#/print"]')
  check('/c/pdf 出现「批量打印」卡片', (await printCard.count()) === 1 && (await printCard.first().textContent()).includes('批量打印'), pdfCards.length + ' cards')
  await printCard.first().click()
  await page.waitForTimeout(500)
  check('卡片可进入 /print', page.url().endsWith('#/print') && (await page.locator('h1:has-text("批量打印")').count()) === 1, page.url())

  await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  const searchInput = page.locator('.side-search-input')
  await searchInput.fill('打印')
  await page.waitForTimeout(600)
  const searchHrefs = await page.locator('.search-section a.tool').evaluateAll((els) => els.map((e) => e.getAttribute('href')))
  const searchTexts = await page.locator('.search-section a.tool').allTextContents()
  check('搜索「打印」命中批量打印', searchHrefs.includes('#/print') && searchTexts.some((t) => t.includes('批量打印')), searchHrefs.join(',') + ' :: ' + searchTexts.join(' / '))
  await searchInput.fill('')
  await page.waitForTimeout(600)

  // ---------- 3. 全站回归 ----------
  const regressions = [
    { name: '首页', url: '/#/', expect: '常用工具' },
    { name: '/c/img', url: '/#/c/img', expect: '图片工具' },
    { name: '/c/pdf', url: '/#/c/pdf', expect: 'PDF 文档工具' },
    { name: '/c/text', url: '/#/c/text', expect: '文本编码工具' },
    { name: '/c/recent', url: '/#/c/recent', expect: '常用工具' },
    { name: 'imagecompress', url: '/#/imagecompress', expect: '图片压缩' },
    { name: 'pdfmerge', url: '/#/pdfmerge', expect: 'PDF合并' },
    { name: 'base64', url: '/#/base64', expect: 'Base64编码解码' }
  ]
  for (const r of regressions) {
    await page.goto(BASE + r.url, { waitUntil: 'networkidle' })
    await page.waitForTimeout(300)
    const h1 = await page.locator('h1').first().textContent().catch(() => '')
    check(`回归 ${r.name}`, h1.includes(r.expect), h1.trim())
  }
  await page.goto(`${BASE}/#/no-such-route-xyz`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const fallbackH1 = await page.locator('h1').allTextContents()
  check('未知路由兜底到首页', page.url().endsWith('#/') && fallbackH1.some((t) => t.includes('图片工具')), page.url() + ' :: ' + fallbackH1.join(' | '))

  // 侧边栏分类链接
  await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  const sideLinks = await page.locator('.side-menu .side-item').evaluateAll((els) => els.map((e) => `${e.textContent.trim()}→${e.getAttribute('href')}`))
  check('侧边栏 5 个类目', sideLinks.length === 5, sideLinks.join(' | '))

  check('无 console error', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' || '))
  check('无 pageerror', pageErrors.length === 0, pageErrors.slice(0, 3).join(' || '))

  await browser.close()

  const failed = results.filter((r) => !r.ok)
  console.log(`\nTOTAL ${results.length} | PASS ${results.length - failed.length} | FAIL ${failed.length}`)
  fs.writeFileSync(path.join(V, '_p2_report.json'), JSON.stringify(results, null, 2))
  process.exit(failed.length ? 1 : 0)
})().catch((e) => {
  console.error('FATAL', e)
  process.exit(2)
})
