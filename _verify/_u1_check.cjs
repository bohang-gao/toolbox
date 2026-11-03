const path = require('path')
const fs = require('fs')
const { chromium } = require('C:/Users/DELL/AppData/Local/hermes/hermes-agent/node_modules/playwright-core')

const BASE = 'http://localhost:5200'
const EXEC = 'C:/Users/DELL/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
const V = path.resolve('_verify')
const PAGES = [
  ['imagecompress', '/imagecompress'],
  ['pdfmerge', '/pdfmerge'],
  ['base64', '/base64'],
  ['print', '/print'],
  ['idphoto', '/idphoto']
]

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + detail : ''}`)
}

async function inspect(page, label) {
  const info = await page.evaluate(() => {
    const q = (s) => document.querySelector(s)
    const layout = q('.tool-layout')
    const cols = layout ? getComputedStyle(layout).gridTemplateColumns : ''
    const crumbs = q('.crumbs')
    const crumbLinks = crumbs ? crumbs.querySelectorAll('a').length : 0
    const current = q('.crumb-current')
    const hero = q('.tool-hero')
    const heroIcon = q('.hero-icon')
    const heroTitle = hero ? hero.querySelector('h1') : null
    const main = q('.tool-main')
    const aside = q('.tool-aside')
    const asideCard = q('.aside-card')
    const asideH3 = asideCard ? asideCard.querySelector('h3') : null
    const usageItems = document.querySelectorAll('.aside-usage li').length
    const steps = Array.from(document.querySelectorAll('.step')).map(el => el.textContent.trim())
    const upload = q('.upload-zone')
    const uploadStyle = upload ? getComputedStyle(upload) : null
    return {
      hasLayout: !!layout,
      cols,
      hasCrumbs: !!crumbs,
      crumbLinks,
      currentText: current ? current.textContent.trim() : '',
      hasHero: !!hero,
      heroTitle: heroTitle ? heroTitle.textContent.trim() : '',
      heroIconBg: heroIcon ? getComputedStyle(heroIcon).backgroundColor : '',
      hasMain: !!main,
      mainBg: main ? getComputedStyle(main).backgroundColor : '',
      hasAside: !!aside,
      asideH3: asideH3 ? asideH3.textContent.trim() : '',
      usageItems,
      steps,
      upload: !!upload,
      uploadBorder: uploadStyle ? uploadStyle.borderTopStyle : '',
      uploadBg: uploadStyle ? uploadStyle.backgroundColor : '',
      uploadHeight: uploadStyle ? uploadStyle.height : '',
      hasStepActions: !!q('.step-actions'),
      greenBox: document.querySelectorAll('[style*="background-color:#dfd"]').length
    }
  })
  return info
}

;(async () => {
  const browser = await chromium.launch({ executablePath: EXEC, headless: true })
  const consoleErrors = []
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message))

  for (const [label, p] of PAGES) {
    await page.goto(BASE + '/#' + p, { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)
    const info = await inspect(page, label)
    console.log('\n--- ' + label + ' ' + p + ' ---')
    console.log(JSON.stringify(info, null, 1))
    check(`${label}: tool-layout present`, info.hasLayout)
    check(`${label}: two columns`, /300px/.test(info.cols), info.cols)
    check(`${label}: crumbs 2 links + current`, info.hasCrumbs && info.crumbLinks === 2 && !!info.currentText, `links=${info.crumbLinks} current=${info.currentText}`)
    check(`${label}: hero + h1`, info.hasHero && !!info.heroTitle, info.heroTitle)
    check(`${label}: hero icon bg tint`, !!info.heroIconBg, info.heroIconBg)
    check(`${label}: main card`, info.hasMain && info.mainBg !== 'rgba(0, 0, 0, 0)', info.mainBg)
    check(`${label}: aside usage`, info.hasAside && info.asideH3.includes('使用说明') && info.usageItems > 0, `h3=${info.asideH3} items=${info.usageItems}`)
    check(`${label}: step numbers`, info.steps.length > 0, info.steps.join(' | '))
    check(`${label}: no green legacy box`, info.greenBox === 0, String(info.greenBox))
    if (['imagecompress', 'print', 'idphoto'].includes(label)) {
      check(`${label}: dashed upload zone`, info.upload && info.uploadBorder === 'dashed' && info.uploadBg === 'rgb(245, 249, 255)', `${info.uploadBorder} ${info.uploadBg} ${info.uploadHeight}`)
    }
    await page.screenshot({ path: path.join(V, `_u1_${label}.png`), fullPage: true })
  }

  // 991px single column
  await page.setViewportSize({ width: 900, height: 900 })
  await page.goto(BASE + '/#/imagecompress', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const mob = await page.evaluate(() => {
    const layout = document.querySelector('.tool-layout')
    const aside = document.querySelector('.tool-aside')
    const main = document.querySelector('.tool-main')
    const rMain = main.getBoundingClientRect()
    const rAside = aside.getBoundingClientRect()
    return {
      cols: getComputedStyle(layout).gridTemplateColumns,
      asideTop: Math.round(rAside.top - rMain.top),
      asidePosition: getComputedStyle(aside).position,
      asideBelow: rAside.top >= rMain.bottom - 1
    }
  })
  console.log('\n--- mobile 900px ---')
  console.log(JSON.stringify(mob, null, 1))
  check('mobile: single column', !/300px/.test(mob.cols), mob.cols)
  check('mobile: aside below main', mob.asideBelow && mob.asidePosition === 'static', `pos=${mob.asidePosition} below=${mob.asideBelow}`)
  await page.screenshot({ path: path.join(V, '_u1_mobile.png'), fullPage: true })

  check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' || '))

  const failed = results.filter(r => !r.ok)
  console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} passed`)
  fs.writeFileSync(path.join(V, '_u1_report.json'), JSON.stringify({ results, consoleErrors }, null, 2))
  await browser.close()
  process.exit(failed.length ? 1 : 0)
})().catch(e => { console.error(e); process.exit(2) })
