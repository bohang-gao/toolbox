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
  bad: path.join(V, '_p2_corrupt.pdf')
}

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + detail : ''}`)
}

async function addFiles(page, files) {
  const chooser = page.waitForEvent('filechooser', { timeout: 10000 })
  await page.locator('.uz-btn').click()
  const fc = await chooser
  await fc.setFiles(files)
}
async function allMsgs(page) {
  return (await page.locator('.el-message').allTextContents()).join(' | ')
}
function installPrintSpy(page) {
  return page.evaluate(() => {
    window.__printCalls = []
    window.print = function () {
      const sheets = Array.from(document.querySelectorAll('.print-sheet'))
      window.__printCalls.push({
        sheets: sheets.length,
        imgs: document.querySelectorAll('.print-sheet img').length,
        modal: !!document.querySelector('.print-confirm'),
        bodyOverflow: document.body.style.overflow,
        hasStyle: !!document.getElementById('print-style')
      })
    }
  })
}

;(async () => {
  // 生成 30 页 PDF，用于观察渲染进度
  const MANY = path.join(V, '_u2_many.pdf')
  if (!fs.existsSync(MANY)) {
    const d = await PDFDocument.create()
    for (let i = 0; i < 30; i++) {
      const p = d.addPage([595.28, 841.89])
      p.drawText(`Progress Page ${i + 1}`, { x: 50, y: 780, size: 24 })
    }
    fs.writeFileSync(MANY, await d.save())
  }

  const browser = await chromium.launch({ executablePath: EXEC })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })
  const page = await ctx.newPage()
  const consoleErrors = []
  const pageErrors = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => pageErrors.push(String(e)))

  await page.goto(`${BASE}/#/print`, { waitUntil: 'networkidle' })
  await page.locator('h1:has-text("批量打印")').waitFor({ timeout: 15000 })
  check('/print 页面可打开', true)

  // 页面说明块
  const about = await page.locator('.print-about').textContent()
  check('打印相关说明块存在', about.includes('不允许网页读取或枚举系统打印机') && about.includes('另存为 PDF'), about.trim().slice(0, 80))

  await addFiles(page, [F.pdf, F.img1, F.img2])
  await page.locator('.task-item').nth(0).locator('.t-status.processing').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(400)
  check('已添加 3 个文件', (await page.locator('.task-item').count()) === 3)

  await installPrintSpy(page)

  // ---------- 1. 点直接打印 → 确认模态，不触发 print ----------
  await page.locator('.step-actions button:has-text("直接打印")').click()
  const modal = page.locator('.print-confirm')
  await modal.waitFor({ state: 'visible', timeout: 5000 })
  const title = await page.locator('.print-confirm__title').textContent()
  const summary = await page.locator('.print-confirm__summary').textContent()
  const hint = await page.locator('.print-confirm__hint').textContent()
  check('模态标题含页数', title.includes('准备打印') && title.includes('共 4 页'), title.trim())
  check('设置汇总 纸张/方向/份数/边距/文件数',
    summary.includes('A4') && summary.includes('纵向') && summary.includes('12mm') && summary.includes('文件数') && summary.includes('3'),
    summary.replace(/\s+/g, ' ').trim())
  check('提示条说明系统打印窗口', hint.includes('系统打印窗口') && hint.includes('网页无法直接列出打印机列表'), hint.replace(/\s+/g, ' ').trim())
  check('存在「没有打印机？导出 PDF」链接', (await page.locator('.print-confirm__pdf-link').textContent()).includes('没有打印机？导出 PDF'))
  check('确认阶段未调用 window.print', (await page.evaluate(() => window.__printCalls.length)) === 0)

  // ---------- 2. 取消 → 不打印、无残留 ----------
  await page.locator('.print-confirm__actions button:has-text("取消")').click()
  await modal.waitFor({ state: 'detached', timeout: 3000 })
  await page.waitForTimeout(200)
  const afterCancel = await page.evaluate(() => ({
    calls: window.__printCalls.length,
    style: !!document.getElementById('print-style'),
    root: !!document.querySelector('.print-root'),
    overflow: document.body.style.overflow
  }))
  check('取消后未触发 print', afterCancel.calls === 0, JSON.stringify(afterCancel))
  check('取消后无残留遮罩/样式', !afterCancel.style && !afterCancel.root && afterCancel.overflow === '', JSON.stringify(afterCancel))
  // 页面仍可操作：切换设置
  await page.locator('.print-field:has-text("纸张") select').selectOption('A3')
  check('取消后页面可继续操作', (await page.locator('.print-field:has-text("纸张") select').inputValue()) === 'A3')
  await page.locator('.print-field:has-text("纸张") select').selectOption('A4')

  // ---------- 3. 继续打印 → 调用 window.print（计数 1） ----------
  await page.locator('.step-actions button:has-text("直接打印")').click()
  await modal.waitFor({ state: 'visible', timeout: 5000 })
  await page.locator('.print-confirm__actions button:has-text("继续打印")').click()
  await page.waitForFunction(() => window.__printCalls.length > 0, null, { timeout: 30000 })
  const p1 = await page.evaluate(() => window.__printCalls[0])
  check('继续打印后调用 print 1 次', (await page.evaluate(() => window.__printCalls.length)) === 1)
  check('sheet/图片数量与设置一致', p1.sheets === 4 && p1.imgs === 4, JSON.stringify(p1))
  check('打印时模态已关闭 / 样式注入 / overflow hidden', !p1.modal && p1.hasStyle && p1.bodyOverflow === 'hidden', JSON.stringify(p1))
  await page.waitForTimeout(1800)
  const m1 = await allMsgs(page)
  check('打印后 toast「已完成打印设置」', m1.includes('已完成打印设置'), m1)
  const clean = await page.evaluate(() => ({
    modal: !!document.querySelector('.print-confirm'),
    style: !!document.getElementById('print-style'),
    root: !!document.querySelector('.print-root'),
    overflow: document.body.style.overflow
  }))
  check('打印后清理干净', !clean.modal && !clean.style && !clean.root && clean.overflow === '', JSON.stringify(clean))
  await page.waitForTimeout(2800)

  // ---------- 4. 导出 PDF ----------
  await page.locator('.step-actions button:has-text("直接打印")').click()
  await modal.waitFor({ state: 'visible', timeout: 5000 })
  const dlPromise = page.waitForEvent('download', { timeout: 30000 })
  await page.locator('.print-confirm__pdf-link').click()
  await modal.waitFor({ state: 'detached', timeout: 3000 }).catch(() => {})
  const dl = await dlPromise
  const outPath = path.join(V, '_u2_out_export.pdf')
  await dl.saveAs(outPath)
  const out = await PDFDocument.load(fs.readFileSync(outPath))
  check('导出 PDF 下载成功', true, dl.suggestedFilename())
  check('导出 PDF 页数正确 (4)', out.getPageCount() === 4, `pages=${out.getPageCount()}`)
  await page.waitForTimeout(300)
  const m2 = await allMsgs(page)
  check('导出 toast 说明可在任意设备打印', m2.includes('已导出 PDF，可在任意设备打印'), m2)
  await page.waitForTimeout(2800)

  // ---------- 5. 部分失败 → 汇总但仍打印 ----------
  await addFiles(page, [F.bad])
  await page.locator('.task-item').last().locator('.t-status.failed').waitFor({ timeout: 15000 })
  await page.evaluate(() => { window.__printCalls = [] })
  await page.locator('.step-actions button:has-text("直接打印")').click()
  await modal.waitFor({ state: 'visible', timeout: 5000 })
  const titleBad = await page.locator('.print-confirm__title').textContent()
  check('含失败项仍预估 4 页', titleBad.includes('共 4 页'), titleBad.trim())
  await page.locator('.print-confirm__actions button:has-text("继续打印")').click()
  await page.waitForFunction(() => window.__printCalls.length > 0, null, { timeout: 30000 })
  const p2 = await page.evaluate(() => window.__printCalls[0])
  check('部分失败仍打印 4 张纸', p2.sheets === 4, JSON.stringify(p2))
  await page.waitForTimeout(3200)
  const m3 = await allMsgs(page)
  check('失败项汇总提示', m3.includes('处理失败') && m3.includes('_p2_corrupt.pdf'), m3)
  check('部分失败仍提示已完成打印设置', m3.includes('已完成打印设置'), m3)
  await page.waitForTimeout(2800)

  // ---------- 6. 全部失败 → 不进入打印 ----------
  await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  await page.goto(`${BASE}/#/print`, { waitUntil: 'networkidle' })
  await page.locator('h1:has-text("批量打印")').waitFor({ timeout: 15000 })
  check('重置后任务列表为空', (await page.locator('.task-item').count()) === 0)
  await addFiles(page, [F.bad])
  await page.locator('.task-item').last().locator('.t-status.failed').waitFor({ timeout: 15000 })
  await installPrintSpy(page)
  await page.locator('.step-actions button:has-text("直接打印")').click()
  await page.waitForTimeout(400)
  const allFail = await page.evaluate(() => ({ calls: window.__printCalls.length, modal: !!document.querySelector('.print-confirm') }))
  const m4 = await allMsgs(page)
  check('全部失败不进入打印', allFail.calls === 0 && !allFail.modal, JSON.stringify(allFail))
  check('全部失败 toast 报错', m4.includes('所有文件均处理失败'), m4)
  await page.waitForTimeout(2800)

  // ---------- 7. 渲染进度与按钮禁用 ----------
  await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  await page.goto(`${BASE}/#/print`, { waitUntil: 'networkidle' })
  await page.locator('h1:has-text("批量打印")').waitFor({ timeout: 15000 })
  await addFiles(page, [MANY])
  await page.locator('.task-item').nth(0).locator('.t-status.processing').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(300)
  await installPrintSpy(page)
  await page.locator('.step-actions button:has-text("直接打印")').click()
  await modal.waitFor({ state: 'visible', timeout: 5000 })
  check('30 页 PDF 预估页数', (await page.locator('.print-confirm__title').textContent()).includes('共 30 页'))
  await page.locator('.print-confirm__actions button:has-text("继续打印")').click()
  await page.waitForSelector('.print-confirm__progress', { timeout: 5000 })
  const progText = await page.locator('.print-confirm__progress-text').textContent()
  const btnDisabled = await page.locator('.print-confirm__actions button').evaluateAll((els) => els.map((e) => e.disabled))
  check('渲染阶段显示进度（第 x/30 页）', /第 \d+\/30 页/.test(progText), progText.replace(/\s+/g, ' ').trim())
  check('渲染阶段模态按钮禁用', btnDisabled.length === 2 && btnDisabled.every(Boolean), JSON.stringify(btnDisabled))
  await page.waitForFunction(() => window.__printCalls.length > 0, null, { timeout: 120000 })
  const p3 = await page.evaluate(() => window.__printCalls[0])
  check('30 页渲染出 30 张纸', p3.sheets === 30 && p3.imgs === 30, JSON.stringify(p3))
  await page.waitForTimeout(1800)

  check('无 console error', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' || '))
  check('无 pageerror', pageErrors.length === 0, pageErrors.slice(0, 2).join(' || '))

  await browser.close()
  const failed = results.filter((r) => !r.ok)
  console.log(`\nTOTAL ${results.length} | PASS ${results.length - failed.length} | FAIL ${failed.length}`)
  fs.writeFileSync(path.join(V, '_u2_report.json'), JSON.stringify(results, null, 2))
  process.exit(failed.length ? 1 : 0)
})().catch((e) => {
  console.error('FATAL', e)
  process.exit(2)
})
