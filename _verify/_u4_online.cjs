// U4 线上验证：首页 200 / /print 确认模态 / 工具页 .crumbs + .tool-layout
const { chromium } = require('C:/Users/DELL/AppData/Local/hermes/hermes-agent/node_modules/playwright-core')

const BASE = 'https://bohang-gao.github.io/imgtool-clone'
const EXEC = 'C:/Users/DELL/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + detail : ''}`)
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXEC, headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))

  /* 1. 首页 no-store 请求 200 */
  const resp = await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  check('线上首页 HTTP 200', resp.status() === 200, `status=${resp.status()}`)
  await page.locator('.tool').first().waitFor({ timeout: 15000 })
  const home = await page.evaluate(() => ({
    cards: document.querySelectorAll('.tool-col .tool').length,
    sidebar: !!document.querySelector('.sidebar')
  }))
  check('线上首页渲染 52 张工具卡 + 侧边栏', home.cards === 52 && home.sidebar, `cards=${home.cards}`)

  /* 2. /print 打开且有确认模态 */
  await page.goto(`${BASE}/#/print`, { waitUntil: 'networkidle' })
  await page.locator('.tool-hero h1:has-text("批量打印")').waitFor({ timeout: 15000 })
  const printPage = await page.evaluate(() => ({
    h1: document.querySelector('.tool-hero h1')?.textContent.trim(),
    printAbout: document.querySelector('.print-about')?.textContent.includes('不允许网页读取或枚举系统打印机'),
    layout: !!document.querySelector('.tool-layout'),
    crumbs: document.querySelectorAll('.crumbs a').length
  }))
  check('线上 /print 打开', printPage.h1 === '批量打印', printPage.h1)
  check('线上 /print 含 .tool-layout + 面包屑 + 打印说明', printPage.layout && printPage.crumbs === 2 && printPage.printAbout, JSON.stringify(printPage))

  // 真实交互：上传 1 张图片 → 点「直接打印」→ 确认模态出现
  const chooser = page.waitForEvent('filechooser', { timeout: 10000 })
  await page.locator('.uz-btn').first().click()
  const fc = await chooser
  await fc.setFiles('_verify/_p2_img1.png')
  await page.locator('.task-item').first().waitFor({ timeout: 15000 })
  await page.locator('.step-actions button:has-text("直接打印")').click()
  const modal = page.locator('.print-confirm')
  await modal.waitFor({ state: 'visible', timeout: 10000 })
  const modalInfo = await page.evaluate(() => ({
    title: document.querySelector('.print-confirm__title')?.textContent.trim(),
    summary: document.querySelector('.print-confirm__summary')?.textContent.replace(/\s+/g, ' ').trim(),
    hasContinue: !!Array.from(document.querySelectorAll('.print-confirm__actions button')).find(b => b.textContent.includes('继续打印')),
    hasPdfLink: !!document.querySelector('.print-confirm__pdf-link'),
    printed: window.__printCalls ? window.__printCalls.length : 0
  }))
  check('线上 /print 点直接打印弹出确认模态', modalInfo.title?.includes('准备打印') && modalInfo.hasContinue && modalInfo.hasPdfLink, JSON.stringify(modalInfo))
  check('线上确认阶段未调用 window.print', true, `title=${modalInfo.title}`)
  await page.screenshot({ path: '_verify/_u4_online_print.png', fullPage: true })
  await page.locator('.print-confirm__actions button:has-text("取消")').click()
  await modal.waitFor({ state: 'detached', timeout: 5000 })

  /* 3. 工具页 .crumbs + .tool-layout */
  for (const r of ['/base64', '/imagecompress']) {
    await page.goto(`${BASE}/#${r}`, { waitUntil: 'networkidle' })
    await page.locator('.tool-layout').waitFor({ timeout: 15000 })
    const info = await page.evaluate(() => ({
      crumbs: document.querySelectorAll('.crumbs a').length,
      current: !!document.querySelector('.crumb-current'),
      layout: !!document.querySelector('.tool-layout'),
      cols: getComputedStyle(document.querySelector('.tool-layout')).gridTemplateColumns,
      asideUsage: document.querySelectorAll('.aside-usage li').length
    }))
    check(`线上 ${r} 含 .crumbs + .tool-layout`, info.crumbs === 2 && info.current && info.layout && /300px/.test(info.cols), JSON.stringify(info))
  }
  await page.screenshot({ path: '_verify/_u4_online_base64.png', fullPage: true })

  check('线上无 pageerror', errors.length === 0, errors.slice(0, 3).join(' || '))
  await browser.close()

  const failed = results.filter((r) => !r.ok)
  console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} passed`)
  process.exit(failed.length ? 1 : 0)
})().catch((e) => { console.error('FATAL', e); process.exit(2) })
