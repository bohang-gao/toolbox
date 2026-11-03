// U4 打印流程复测：确认模态 → 取消不打印 → 继续打印（window.print 拦截计数）→ 导出 PDF 页数
const path = require('path')
const fs = require('fs')
const { chromium } = require('C:/Users/DELL/AppData/Local/hermes/hermes-agent/node_modules/playwright-core')
const { PDFDocument } = require('pdf-lib')

const BASE = 'http://localhost:5210'
const EXEC = 'C:/Users/DELL/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
const V = path.resolve('_verify')
const F = {
  pdf: path.join(V, '_p2_two_pages.pdf'),
  img1: path.join(V, '_p2_img1.png'),
  img2: path.join(V, '_p2_img2.png'),
  bad: path.join(V, '_p2_corrupt.pdf')
}

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + detail : ''}`)
}

const msgs = (page) => page.locator('.el-message').allTextContents()

async function addFiles(page, files) {
  const chooser = page.waitForEvent('filechooser', { timeout: 10000 })
  await page.locator('.uz-btn').first().click()
  const fc = await chooser
  await fc.setFiles(files)
}

function installPrintSpy(page) {
  return page.evaluate(() => {
    window.__printCalls = []
    window.print = function () {
      window.__printCalls.push({
        sheets: document.querySelectorAll('.print-sheet').length,
        imgs: document.querySelectorAll('.print-sheet img').length,
        modal: !!document.querySelector('.print-confirm'),
        bodyOverflow: document.body.style.overflow,
        hasStyle: !!document.getElementById('print-style')
      })
    }
  })
}

async function openPrintPage(page) {
  await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(200)
  await page.goto(`${BASE}/#/print`, { waitUntil: 'networkidle' })
  await page.locator('.tool-hero h1:has-text("批量打印")').waitFor({ timeout: 15000 })
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXEC, headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })
  const page = await ctx.newPage()
  const consoleErrors = []
  const pageErrors = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => pageErrors.push(String(e)))

  await openPrintPage(page)
  check('/print 打开正常', (await page.locator('.tool-hero h1').textContent()).trim() === '批量打印')
  check('打印说明块存在', (await page.locator('.print-about').textContent()).includes('不允许网页读取或枚举系统打印机'))

  await addFiles(page, [F.pdf, F.img1, F.img2])
  await page.waitForTimeout(800)
  check('添加 3 个文件（1 PDF + 2 图片）', (await page.locator('.task-item').count()) === 3)
  check('预计 4 页（PDF 2 页 + 图片 2 张）', (await page.locator('.print-info').textContent()).includes('预计 4 页'))

  await installPrintSpy(page)

  /* 1. 确认模态出现，未调用 window.print */
  await page.locator('.step-actions button:has-text("直接打印")').click()
  const modal = page.locator('.print-confirm')
  await modal.waitFor({ state: 'visible', timeout: 5000 })
  const title = (await page.locator('.print-confirm__title').textContent()).trim()
  const summary = (await page.locator('.print-confirm__summary').textContent()).replace(/\s+/g, ' ').trim()
  check('确认模态标题含页数', title.includes('准备打印') && title.includes('共 4 页'), title)
  check('确认模态汇总设置', summary.includes('A4') && summary.includes('纵向') && summary.includes('12mm') && summary.includes('3'), summary)
  check('确认阶段 window.print 计数为 0', (await page.evaluate(() => window.__printCalls.length)) === 0)
  await page.screenshot({ path: path.join(V, '_u4_print_confirm.png') })

  /* 2. 取消 → 不打印且无残留 */
  await page.locator('.print-confirm__actions button:has-text("取消")').click()
  await modal.waitFor({ state: 'detached', timeout: 3000 })
  await page.waitForTimeout(250)
  const afterCancel = await page.evaluate(() => ({
    calls: window.__printCalls.length,
    style: !!document.getElementById('print-style'),
    root: !!document.querySelector('.print-root'),
    overflow: document.body.style.overflow
  }))
  check('取消后 window.print 计数仍为 0', afterCancel.calls === 0, JSON.stringify(afterCancel))
  check('取消后无残留样式/节点/overflow', !afterCancel.style && !afterCancel.root && afterCancel.overflow === '', JSON.stringify(afterCancel))

  /* 3. 继续打印 → window.print 计数 1，纸张数与页数一致 */
  await page.locator('.step-actions button:has-text("直接打印")').click()
  await modal.waitFor({ state: 'visible', timeout: 5000 })
  await page.locator('.print-confirm__actions button:has-text("继续打印")').click()
  await page.waitForFunction(() => window.__printCalls.length > 0, null, { timeout: 30000 })
  const calls = await page.evaluate(() => window.__printCalls)
  check('继续打印后 window.print 恰好 1 次', calls.length === 1, `calls=${calls.length}`)
  check('打印纸张/图片数 = 4', calls[0].sheets === 4 && calls[0].imgs === 4, JSON.stringify(calls[0]))
  check('打印时模态关闭 + 样式注入 + overflow hidden', !calls[0].modal && calls[0].hasStyle && calls[0].bodyOverflow === 'hidden', JSON.stringify(calls[0]))
  await page.waitForTimeout(1800)
  check('打印完成 toast', (await msgs(page)).join('|').includes('已完成打印设置'), (await msgs(page)).join('|'))
  const cleaned = await page.evaluate(() => ({
    modal: !!document.querySelector('.print-confirm'),
    style: !!document.getElementById('print-style'),
    root: !!document.querySelector('.print-root'),
    overflow: document.body.style.overflow
  }))
  check('打印后清理干净', !cleaned.modal && !cleaned.style && !cleaned.root && cleaned.overflow === '', JSON.stringify(cleaned))
  await page.waitForTimeout(2600)

  /* 4. 导出 PDF 页数正确 */
  await page.locator('.step-actions button:has-text("直接打印")').click()
  await modal.waitFor({ state: 'visible', timeout: 5000 })
  const dlPromise = page.waitForEvent('download', { timeout: 30000 })
  await page.locator('.print-confirm__pdf-link').click()
  const dl = await dlPromise
  const outPath = path.join(V, '_u4_out_export.pdf')
  await dl.saveAs(outPath)
  const out = await PDFDocument.load(fs.readFileSync(outPath))
  check('导出 PDF 下载成功', true, dl.suggestedFilename())
  check('导出 PDF 页数 = 4', out.getPageCount() === 4, `pages=${out.getPageCount()} size=${fs.statSync(outPath).size}`)
  await page.waitForTimeout(300)
  check('导出 toast 文案', (await msgs(page)).join('|').includes('已导出 PDF，可在任意设备打印'), (await msgs(page)).join('|'))
  await page.waitForTimeout(2600)

  /* 5. 含失败项：仍可打印，失败项汇总 */
  await addFiles(page, [F.bad])
  await page.locator('.task-item').last().locator('.t-status.failed').waitFor({ timeout: 15000 })
  await page.evaluate(() => { window.__printCalls = [] })
  await page.locator('.step-actions button:has-text("直接打印")').click()
  await modal.waitFor({ state: 'visible', timeout: 5000 })
  check('失败项不计入预估页数（仍 4 页）', (await page.locator('.print-confirm__title').textContent()).includes('共 4 页'))
  await page.locator('.print-confirm__actions button:has-text("继续打印")').click()
  await page.waitForFunction(() => window.__printCalls.length > 0, null, { timeout: 30000 })
  check('部分失败仍打印 4 张纸', (await page.evaluate(() => window.__printCalls[0].sheets)) === 4)
  await page.waitForTimeout(3200)
  const mFail = (await msgs(page)).join('|')
  check('失败项汇总提示', mFail.includes('处理失败') && mFail.includes('_p2_corrupt.pdf'), mFail)
  await page.waitForTimeout(2600)

  /* 6. 全部失败 → 不进入打印 */
  await openPrintPage(page)
  await addFiles(page, [F.bad])
  await page.locator('.task-item').last().locator('.t-status.failed').waitFor({ timeout: 15000 })
  await installPrintSpy(page)
  await page.locator('.step-actions button:has-text("直接打印")').click()
  await page.waitForTimeout(400)
  const allFail = await page.evaluate(() => ({ calls: window.__printCalls.length, modal: !!document.querySelector('.print-confirm') }))
  check('全部失败不进入打印', allFail.calls === 0 && !allFail.modal, JSON.stringify(allFail))
  check('全部失败 toast 报错', (await msgs(page)).join('|').includes('所有文件均处理失败'), (await msgs(page)).join('|'))

  check('无 console error', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' || '))
  check('无 pageerror', pageErrors.length === 0, pageErrors.slice(0, 3).join(' || '))

  await browser.close()
  const failed = results.filter((r) => !r.ok)
  console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} passed`)
  fs.writeFileSync(path.join(V, '_u4_print_report.json'), JSON.stringify({ results, consoleErrors, pageErrors }, null, 2))
  process.exit(failed.length ? 1 : 0)
})().catch((e) => { console.error('FATAL', e); process.exit(2) })
