// U4 回归：站点导航 / 搜索 / 侧边栏 / 抽屉 / 六页新布局 / U3 修复项复测
const path = require('path')
const fs = require('fs')
const { chromium } = require('C:/Users/DELL/AppData/Local/hermes/hermes-agent/node_modules/playwright-core')
const { PDFDocument } = require('pdf-lib')

const BASE = 'http://localhost:5210'
const EXEC = 'C:/Users/DELL/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
const V = path.resolve('_verify')
const F = {
  png1: path.join(V, '_p2_img1.png'),
  png2: path.join(V, '_p2_img2.png'),
  pdf: path.join(V, '_p2_two_pages.pdf'),
  pdf3: path.join(V, '_u3_pdf3.pdf')
}

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + detail : ''}`)
}

const msgs = (page) => page.locator('.el-message').allTextContents()

async function goto(page, route, waitFor) {
  await page.goto(`${BASE}/#${route}`, { waitUntil: 'networkidle' })
  if (waitFor) await page.locator(waitFor).first().waitFor({ timeout: 15000 })
}

async function addFiles(page, files) {
  const chooser = page.waitForEvent('filechooser', { timeout: 10000 })
  await page.locator('.uz-btn').first().click()
  const fc = await chooser
  await fc.setFiles(files)
}

async function saveDl(dl, name) {
  const p = path.join(V, name)
  await dl.saveAs(p)
  return { p, size: fs.statSync(p).size }
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXEC, headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
  const page = await ctx.newPage()
  const consoleErrors = []
  const pageErrors = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => pageErrors.push(String(e)))

  /* ========== 1. 首页 / 分类 / 最近 / 空态 / 搜索 ========== */
  await goto(page, '/', '.tool')
  const home = await page.evaluate(() => ({
    sections: document.querySelectorAll('.section-head h1').length,
    heads: Array.from(document.querySelectorAll('.section-head h1')).map(h => h.textContent.trim()),
    cards: document.querySelectorAll('.tool-col .tool').length,
    sidebar: !!document.querySelector('.sidebar'),
    activeItem: (document.querySelector('.side-item.is-active') || {}).textContent?.trim() || '',
    recentEmpty: !!document.querySelector('.recent-empty')
  }))
  check('首页 200 且渲染', home.cards > 0, `cards=${home.cards}`)
  check('首页 3 个分区 + 常用工具', home.sections === 4, home.heads.join(' / '))
  check('首页 52 张工具卡', home.cards === 52, `cards=${home.cards}`)
  check('首页常用工具空态', home.recentEmpty)
  check('侧边栏常驻 + 全部工具高亮', home.sidebar && home.activeItem.includes('全部工具'), `active=${home.activeItem}`)

  for (const [cat, label, expect] of [['img', '图片工具', 17], ['pdf', 'PDF 文档工具', 21], ['text', '文本编码工具', 14]]) {
    await goto(page, `/c/${cat}`, '.section-head')
    const info = await page.evaluate(() => ({
      heads: Array.from(document.querySelectorAll('.section-head h1')).map(h => h.textContent.trim()),
      cards: document.querySelectorAll('.tool-col .tool').length,
      active: (document.querySelector('.side-item.is-active') || {}).textContent?.trim() || ''
    }))
    check(`/c/${cat} 单分区 ${expect} 个`, info.cards === expect && info.heads.length === 1, `cards=${info.cards} heads=${info.heads.join('/')}`)
    check(`/c/${cat} 侧边栏高亮 ${label}`, info.active.includes(label.replace(' 文档工具', '')), `active=${info.active}`)
  }

  // /c/recent 空态（清空 localStorage）
  await page.evaluate(() => localStorage.clear())
  await goto(page, '/c/recent', '.recent-empty')
  const recentEmpty = await page.evaluate(() => ({
    empty: !!document.querySelector('.recent-empty'),
    text: (document.querySelector('.recent-empty p') || {}).textContent || '',
    head: (document.querySelector('.section-head h1') || {}).textContent?.trim() || ''
  }))
  check('/c/recent 空态展示', recentEmpty.empty && recentEmpty.head === '常用工具', recentEmpty.text.trim().slice(0, 40))
  await page.screenshot({ path: path.join(V, '_u4_recent_empty.png'), fullPage: true })

  // /c/recent 有数据态：访问 3 个工具
  for (const r of ['/base64', '/qrcode', '/pdfmerge']) {
    await goto(page, r, '.tool-hero h1')
    await page.waitForTimeout(300)
  }
  await goto(page, '/c/recent', '.recent-tools')
  const recentList = await page.evaluate(() => ({
    cards: document.querySelectorAll('.recent-card').length,
    names: Array.from(document.querySelectorAll('.recent-card .tool-header')).map(x => x.textContent.trim()),
    badge: (document.querySelector('.side-item .side-badge') || {}).textContent?.trim() || ''
  }))
  check('/c/recent 有数据（3 个，按最近排序）', recentList.cards === 3, recentList.names.join(', '))
  check('侧边栏常用工具徽标', recentList.badge === '3', `badge=${recentList.badge}`)
  await page.screenshot({ path: path.join(V, '_u4_recent_list.png'), fullPage: true })

  // 搜索：侧边栏输入 → ?q= → 结果过滤
  await goto(page, '/', '.tool')
  await page.locator('.side-search-input').fill('pdf')
  await page.waitForFunction(() => location.hash.includes('q=pdf'), null, { timeout: 5000 })
  await page.waitForTimeout(300)
  const search = await page.evaluate(() => ({
    hash: location.hash,
    head: (document.querySelector('.search-section .section-head h1') || {}).textContent?.trim() || '',
    cards: document.querySelectorAll('.search-section .tool').length
  }))
  check('搜索跳转 /?q=pdf', search.hash.includes('q=pdf'), search.hash)
  check('搜索结果标题含数量', /搜索结果 · \d+ 个/.test(search.head), search.head)
  check('搜索结果过滤（≥1 且 <52）', search.cards > 0 && search.cards < 52, `cards=${search.cards}`)
  await page.screenshot({ path: path.join(V, '_u4_search.png'), fullPage: true })

  // Esc 清空搜索
  await page.locator('.side-search-input').press('Escape')
  await page.waitForTimeout(400)
  const afterEsc = await page.evaluate(() => ({ hash: location.hash, val: document.querySelector('.side-search-input').value }))
  check('Esc 清空搜索并回首页', !afterEsc.hash.includes('q=') && afterEsc.val === '', JSON.stringify(afterEsc))

  // 无结果搜索
  await page.locator('.side-search-input').fill('zzzzzz')
  await page.waitForFunction(() => location.hash.includes('q=zzzzzz'), null, { timeout: 5000 })
  await page.waitForTimeout(300)
  check('搜索空态', (await page.locator('.search-empty').count()) === 1)
  await page.locator('.side-search-input').press('Escape')
  await page.waitForTimeout(400)

  // 未知路由兜底
  await goto(page, '/no-such-tool', '.tool')
  const fallbackHash = await page.evaluate(() => location.hash)
  check('未知路由兜底首页', fallbackHash === '#/' || fallbackHash === '', fallbackHash)

  /* ========== 2. 六页新布局检查 ========== */
  const PAGES = [
    ['imagecompress', '/imagecompress', '图片压缩'],
    ['pdfmerge', '/pdfmerge', 'PDF合并'],
    ['base64', '/base64', 'Base64编码解码'],
    ['qrcode', '/qrcode', '二维码制作'],
    ['print', '/print', '批量打印'],
    ['idphoto', '/idphoto', '证件照换底色']
  ]
  for (const [label, p, title] of PAGES) {
    await goto(page, p, '.tool-layout')
    await page.waitForTimeout(300)
    const info = await page.evaluate(() => {
      const q = (s) => document.querySelector(s)
      const layout = q('.tool-layout')
      const aside = q('.tool-aside')
      const main = q('.tool-main')
      const crumbs = q('.crumbs')
      return {
        hasLayout: !!layout,
        cols: layout ? getComputedStyle(layout).gridTemplateColumns : '',
        crumbLinks: crumbs ? crumbs.querySelectorAll('a').length : 0,
        crumbTexts: crumbs ? Array.from(crumbs.querySelectorAll('a,.crumb-current')).map(x => x.textContent.trim()) : [],
        h1: (q('.tool-hero h1') || {}).textContent?.trim() || '',
        heroIcon: !!q('.hero-icon'),
        mainCard: main ? getComputedStyle(main).backgroundColor : '',
        asideH3: (q('.aside-card h3') || {}).textContent?.trim() || '',
        usageItems: document.querySelectorAll('.aside-usage li').length,
        related: document.querySelectorAll('.related-tools, .related').length
      }
    })
    console.log('\n--- ' + label + ' ---\n' + JSON.stringify(info))
    check(`${label}: 两栏 .tool-layout 含 300px 侧栏`, info.hasLayout && /300px/.test(info.cols), info.cols)
    check(`${label}: 面包屑 2 链接 + 当前项`, info.crumbLinks === 2 && info.crumbTexts.length === 3, info.crumbTexts.join(' / '))
    check(`${label}: hero 标题`, info.h1 === title && info.heroIcon, info.h1)
    check(`${label}: 主区卡片白底`, info.mainCard === 'rgb(255, 255, 255)', info.mainCard)
    // 占位页（Stub）按设计只有 1 条说明
    const minUsage = label === 'idphoto' ? 1 : 2
    check(`${label}: 侧栏使用说明 ≥${minUsage} 条`, info.asideH3.includes('使用说明') && info.usageItems >= minUsage, `items=${info.usageItems}`)
    await page.screenshot({ path: path.join(V, `_u4_page_${label}.png`), fullPage: true })
  }

  // 移动端单栏（900px）
  await page.setViewportSize({ width: 900, height: 900 })
  for (const [label, p] of [['imagecompress', '/imagecompress'], ['print', '/print']]) {
    await goto(page, p, '.tool-layout')
    const mob = await page.evaluate(() => {
      const layout = document.querySelector('.tool-layout')
      const main = document.querySelector('.tool-main')
      const aside = document.querySelector('.tool-aside')
      const rMain = main.getBoundingClientRect()
      const rAside = aside.getBoundingClientRect()
      return {
        cols: getComputedStyle(layout).gridTemplateColumns,
        asidePosition: getComputedStyle(aside).position,
        asideBelow: rAside.top >= rMain.bottom - 1,
        hamburger: getComputedStyle(document.querySelector('.mobile-bar')).display
      }
    })
    check(`${label} 移动端单栏`, !/300px/.test(mob.cols) && mob.asidePosition === 'static' && mob.asideBelow, JSON.stringify(mob))
    check(`${label} 移动端汉堡按钮显示`, mob.hamburger === 'flex', mob.hamburger)
    await page.screenshot({ path: path.join(V, `_u4_mobile_${label}.png`), fullPage: true })
  }

  /* ========== 抽屉交互 ========== */
  await goto(page, '/', '.tool')
  const drawerClosed = await page.evaluate(() => getComputedStyle(document.querySelector('.sidebar')).transform)
  await page.locator('.hamburger').click()
  await page.waitForTimeout(350)
  const drawerOpen = await page.evaluate(() => ({
    open: document.querySelector('.sidebar').classList.contains('is-open'),
    mask: getComputedStyle(document.querySelector('.sidebar-mask')).display,
    transform: getComputedStyle(document.querySelector('.sidebar')).transform
  }))
  check('抽屉：汉堡打开', drawerOpen.open && drawerOpen.mask !== 'none', `closedTransform=${drawerClosed}`)
  await page.locator('.sidebar-mask').click({ position: { x: 600, y: 400 } })
  await page.waitForTimeout(350)
  check('抽屉：点遮罩关闭', await page.evaluate(() => !document.querySelector('.sidebar').classList.contains('is-open')))
  await page.locator('.hamburger').click()
  await page.waitForTimeout(350)
  await page.locator('.side-item:has-text("文本编码工具")').click()
  await page.waitForTimeout(500)
  check('抽屉：点菜单项跳转并关闭', await page.evaluate(() => !document.querySelector('.sidebar').classList.contains('is-open') && location.hash.includes('/c/text')), await page.evaluate(() => location.hash))
  await page.screenshot({ path: path.join(V, '_u4_drawer.png') })

  // 恢复桌面视口
  await page.setViewportSize({ width: 1440, height: 900 })

  /* ========== 4. U3 修复项复测（DES / RSA） ========== */
  await goto(page, '/des', '.tool-hero h1')
  const main = page.locator('.tool-main')
  await main.locator('input[placeholder*="8 字节密钥"]').fill('12345678')
  await main.locator('textarea').first().fill('U4 des test')
  await main.locator('.step-actions button:has-text("加密")').click()
  await page.waitForTimeout(400)
  const desEnc = await main.locator('.result-box').textContent()
  check('DES 加密输出 Base64', !!desEnc && /^[A-Za-z0-9+/=]+$/.test(desEnc.trim()), desEnc?.trim().slice(0, 40))
  await main.locator('label.el-radio:has-text("解密") input').check()
  await main.locator('textarea').first().fill(desEnc.trim())
  await main.locator('.step-actions button:has-text("解密")').click()
  await page.waitForTimeout(400)
  const desDec = await main.locator('.result-box').textContent()
  check('DES 解密还原明文', desDec.trim() === 'U4 des test', desDec.trim())

  await goto(page, '/rsa', '.tool-hero h1')
  const rsa = page.locator('.tool-main')
  await rsa.locator('button:has-text("生成密钥对")').click()
  await page.waitForTimeout(1200)
  // 加密模式只渲染公钥 textarea；切到解密模式才能读到私钥
  const rsaPubLen = await rsa.locator('textarea').first().inputValue().then(v => v.length)
  await rsa.locator('label.el-radio:has-text("解密") input').check()
  await page.waitForTimeout(200)
  const rsaPrivLen = await rsa.locator('textarea').first().inputValue().then(v => v.length)
  await rsa.locator('label.el-radio:has-text("加密") input').check()
  await page.waitForTimeout(200)
  check('RSA 生成密钥对（公/私钥 PEM 非空）', rsaPubLen > 400 && rsaPrivLen > 1600, `pub=${rsaPubLen} priv=${rsaPrivLen}`)
  await rsa.locator('textarea').last().fill('U4 rsa test')
  await rsa.locator('.step-actions button:has-text("加密")').click()
  await page.waitForTimeout(600)
  const rsaEnc = await rsa.locator('.result-box').textContent()
  check('RSA 公钥加密输出 Base64', !!rsaEnc && rsaEnc.trim().length > 300, `len=${rsaEnc?.trim().length}`)
  await rsa.locator('label.el-radio:has-text("解密") input').check()
  await rsa.locator('textarea').last().fill(rsaEnc.trim())
  await rsa.locator('.step-actions button:has-text("解密")').click()
  await page.waitForTimeout(800)
  const rsaDec = await rsa.locator('.result-box').textContent()
  check('RSA 私钥解密还原明文', rsaDec.trim() === 'U4 rsa test', rsaDec.trim())

  /* ========== 降级项复测（占位页 2 个） ========== */
  for (const [label, p, title] of [['ocr', '/ocr', '图片转文字'], ['word2pdf', '/word2pdf', 'Word转PDF']]) {
    await goto(page, p, '.tool-layout')
    const stub = await page.evaluate(() => ({
      notice: (document.querySelector('.stub-notice') || {}).textContent?.trim() || '',
      disabledUpload: !!document.querySelector('.upload-zone.is-disabled'),
      disabledBtn: !!document.querySelector('.uz-btn[disabled]'),
      h1: (document.querySelector('.tool-hero h1') || {}).textContent?.trim() || '',
      crumbs: document.querySelectorAll('.crumbs a').length
    }))
    check(`${label}: 占位页明确说明未实现`, stub.notice.includes('演示版未实现') && stub.disabledUpload && stub.disabledBtn, stub.notice)
    check(`${label}: 标题 + 面包屑一致`, stub.h1 === title && stub.crumbs === 2, `${stub.h1} links=${stub.crumbs}`)
  }

  check('无 console error', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' || '))
  check('无 pageerror', pageErrors.length === 0, pageErrors.slice(0, 5).join(' || '))

  const failed = results.filter(r => !r.ok)
  console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} passed`)
  fs.writeFileSync(path.join(V, '_u4_regress_report.json'), JSON.stringify({ results, consoleErrors, pageErrors }, null, 2))
  await browser.close()
  process.exit(failed.length ? 1 : 0)
})().catch(e => { console.error(e); process.exit(2) })
