// B1 图片改字：浏览器内 E2E + 硬指标实测
const path = require('path')
const fs = require('fs')
const { chromium } = require('C:/Users/DELL/AppData/Local/hermes/hermes-agent/node_modules/playwright-core')

const BASE = 'http://localhost:5200'
const EXEC = 'C:/Users/DELL/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
const V = path.resolve('_verify')

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + detail : ''}`)
}

;(async () => {
  const browser = await chromium.launch({ executablePath: EXEC, headless: true })
  const consoleErrors = []
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message))

  await page.goto(BASE + '/#/textedit', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  // 1) 目录条目 + 页面骨架
  const meta = await page.evaluate(() => {
    const hero = document.querySelector('.tool-hero h1')
    return {
      title: hero ? hero.textContent.trim() : '',
      hasUpload: !!document.querySelector('.upload-zone'),
      steps: Array.from(document.querySelectorAll('.step')).map(e => e.textContent.trim()),
      usage: document.querySelectorAll('.aside-usage li').length,
      crumb: document.querySelector('.crumb-current') ? document.querySelector('.crumb-current').textContent.trim() : ''
    }
  })
  console.log('\n--- page skeleton ---\n' + JSON.stringify(meta, null, 1))
  check('route /#/textedit 渲染', meta.title === '图片改字' && meta.crumb === '图片改字', `${meta.title} / ${meta.crumb}`)
  check('上传区 + 使用说明', meta.hasUpload && meta.usage >= 4, `usage=${meta.usage}`)

  // 2) 生成测试图（渐变背景 + 深色文字 SAMPLE 88），并注入上传区
  const TEST = await page.evaluate(async () => {
    const W = 900, H = 500
    const mk = (withText) => {
      const c = document.createElement('canvas')
      c.width = W; c.height = H
      const ctx = c.getContext('2d')
      const g = ctx.createLinearGradient(0, 0, W, H)
      g.addColorStop(0, '#dfe9f5')
      g.addColorStop(0.5, '#c9d9ea')
      g.addColorStop(1, '#e8e2d6')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)
      if (withText) {
        ctx.fillStyle = '#1b2430'
        ctx.font = 'bold 78px Arial, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('SAMPLE 88', W / 2, H / 2)
      }
      return c
    }
    const canvas = mk(true)
    const dataUrl = canvas.toDataURL('image/png')
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
    const file = new File([blob], 'b1_test.png', { type: 'image/png' })
    const dt = new DataTransfer()
    dt.items.add(file)
    const zone = document.querySelector('.upload-zone')
    zone.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }))
    return { dataUrl, w: W, h: H }
  })
  fs.writeFileSync(path.join(V, '_b1_input.png'), Buffer.from(TEST.dataUrl.split(',')[1], 'base64'))
  await page.waitForTimeout(800)
  const loaded = await page.evaluate(() => {
    const c = document.querySelector('.te-canvas-wrap canvas')
    return c ? { w: c.width, h: c.height } : null
  })
  check('拖入图片自动载入画布', loaded && loaded.w === TEST.w && loaded.h === TEST.h, JSON.stringify(loaded))

  // 3) 画笔圈选：在文字区域来回涂抹
  await page.locator('.te-canvas-wrap').scrollIntoViewIfNeeded()
  await page.waitForTimeout(200)
  const box = await page.locator('.te-overlay').boundingBox()
  const toScreen = (ix, iy) => ({
    x: box.x + (ix / TEST.w) * box.width,
    y: box.y + (iy / TEST.h) * box.height
  })
  // 文字大致范围 y 215..285, x 250..650
  await page.mouse.move(...Object.values(toScreen(255, 250)))
  await page.mouse.down()
  for (let x = 255; x <= 650; x += 20) {
    for (const y of [230, 252, 274]) {
      const p = toScreen(x, y)
      await page.mouse.move(p.x, p.y, { steps: 1 })
    }
  }
  await page.mouse.up()
  await page.waitForTimeout(300)
  const afterBrush = await page.evaluate(() => ({
    canUndo: !document.querySelectorAll('.te-toolbar .el-button')[0].disabled,
    applyEnabled: !document.querySelectorAll('.te-toolbar .el-button--primary')[0].disabled,
    colorVal: document.querySelector('.te-hex') ? document.querySelector('.te-hex').textContent.trim() : ''
  }))
  check('画笔产生选区（可撤销）', afterBrush.canUndo, JSON.stringify(afterBrush))
  check('自动取样字色（深色）', /^#[0-4][0-9a-f][0-4][0-9a-f][0-4][0-9a-f]$/i.test(afterBrush.colorVal), afterBrush.colorVal)

  // 4) 撤销 / 清空
  await page.locator('.te-toolbar .el-button', { hasText: '撤销' }).click()
  await page.waitForTimeout(200)
  const afterUndo = await page.evaluate(() => document.querySelectorAll('.te-toolbar .el-button--primary')[0].disabled)
  check('撤销后选区为空 → 应用禁用', afterUndo === true, String(afterUndo))
  // 重画一遍
  await page.mouse.move(...Object.values(toScreen(255, 250)))
  await page.mouse.down()
  for (let x = 255; x <= 650; x += 20) {
    for (const y of [228, 252, 276]) {
      const p = toScreen(x, y)
      await page.mouse.move(p.x, p.y, { steps: 1 })
    }
  }
  await page.mouse.up()
  await page.waitForTimeout(300)

  // 5) 输入新文字 → 应用
  await page.locator('.option-panel input[type="text"]').fill('NEW TEXT 2026')
  await page.waitForTimeout(200)
  const t0 = Date.now()
  await page.locator('.te-toolbar .el-button--primary').click()
  await page.waitForFunction(() => {
    const btns = document.querySelectorAll('.idphoto-toolbar .idphoto-tab')
    return btns.length >= 3 && !btns[2].disabled
  }, { timeout: 15000 })
  const applyMs = Date.now() - t0
  const tabs = await page.evaluate(() => ({
    tabs: Array.from(document.querySelectorAll('.idphoto-toolbar .idphoto-tab')).map(b => ({
      text: b.textContent.trim(), disabled: b.disabled, active: b.classList.contains('is-active')
    })),
    hint: Array.from(document.querySelectorAll('.idphoto-toolbar .idphoto-hint')).map(e => e.textContent.trim())
  }))
  check('应用后进入「最终」三态', tabs.tabs[2] && tabs.tabs[2].active && !tabs.tabs[2].disabled, JSON.stringify(tabs.tabs))
  console.log('    hints:', tabs.hint.join(' | '))

  // 6) 三态切换 + 下载
  await page.locator('.idphoto-toolbar .idphoto-tab', { hasText: '已修复' }).click()
  await page.waitForTimeout(300)
  await page.locator('.idphoto-toolbar .idphoto-tab', { hasText: '最终' }).click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(V, '_b1_ui.png'), fullPage: true })

  const dlPromise = page.waitForEvent('download', { timeout: 10000 })
  await page.locator('.step-actions .el-button--primary', { hasText: '下载 PNG' }).click()
  const dl = await dlPromise
  const dlPath = path.join(V, '_b1_download.png')
  await dl.saveAs(dlPath)
  const dlBuf = fs.readFileSync(dlPath)
  // PNG IHDR 尺寸
  const dw = dlBuf.readUInt32BE(16), dh = dlBuf.readUInt32BE(20)
  check('下载 PNG 与原图同尺寸', dw === TEST.w && dh === TEST.h, `${dw}x${dh} file=${dl.suggestedFilename()} bytes=${dlBuf.length}`)

  // 7) 硬指标：在页面内用真实库跑完整管线
  const metrics = await page.evaluate(async () => {
    const { expandMask, classicInpaint, lowFreqMatch, featherComposite } = await import('/src/lib/inpaint.js')
    const tr = await import('/src/lib/textrender.js')
    const W = 900, H = 500
    const mk = (withText) => {
      const c = document.createElement('canvas')
      c.width = W; c.height = H
      const ctx = c.getContext('2d', { willReadFrequently: true })
      const g = ctx.createLinearGradient(0, 0, W, H)
      g.addColorStop(0, '#dfe9f5')
      g.addColorStop(0.5, '#c9d9ea')
      g.addColorStop(1, '#e8e2d6')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)
      if (withText) {
        ctx.fillStyle = '#1b2430'
        ctx.font = 'bold 78px Arial, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('SAMPLE 88', W / 2, H / 2)
      }
      return ctx.getImageData(0, 0, W, H)
    }
    const img = mk(true)
    const baseline = mk(false)

    // 选区：覆盖文字（比实际字框稍大，模拟手工涂抹）
    const raw = new Uint8Array(W * H)
    for (let y = 205; y < 300; y++) for (let x = 240; x < 665; x++) raw[y * W + x] = 1
    const tA = performance.now()
    const expanded = expandMask(raw, W, H, 3)
    const tExpand = performance.now() - tA
    const tB = performance.now()
    const filled = classicInpaint(img, expanded, { median: true, edge: true })
    const tInpaint = performance.now() - tB
    const tC = performance.now()
    const matched = lowFreqMatch(filled, img, expanded, 24)
    const tLow = performance.now() - tC
    const tD = performance.now()
    const merged = featherComposite(img, matched, expanded, 3.5)
    const tFeather = performance.now() - tD
    const total = tExpand + tInpaint + tLow + tFeather

    // 指标 1：遮罩外像素最大改动
    let maxOut = 0, outCount = 0
    for (let i = 0; i < W * H; i++) {
      if (expanded[i]) continue
      outCount++
      const j = i * 4
      maxOut = Math.max(maxOut,
        Math.abs(merged.data[j] - img.data[j]),
        Math.abs(merged.data[j + 1] - img.data[j + 1]),
        Math.abs(merged.data[j + 2] - img.data[j + 2]))
    }

    // 指标 2：选区边界内外亮度差（内侧 vs 外侧相邻带均值）
    const lumOf = (d, j) => d[j] * 0.299 + d[j + 1] * 0.587 + d[j + 2] * 0.114
    const outerBand = expandMask(expanded, W, H, 4)
    let inSum = 0, inN = 0, outSum = 0, outN = 0
    for (let i = 0; i < W * H; i++) {
      const j = i * 4
      if (expanded[i]) { inSum += lumOf(merged.data, j); inN++ }
      else if (outerBand[i]) { outSum += lumOf(merged.data, j); outN++ }
    }
    const boundaryDiff = Math.abs(inSum / inN - outSum / outN)

    // 指标 3：修复区 vs 无字基线的平均像素差
    let diffSum = 0, diffN = 0
    for (let i = 0; i < W * H; i++) {
      if (!expanded[i]) continue
      const j = i * 4
      diffSum += Math.abs(merged.data[j] - baseline.data[j])
        + Math.abs(merged.data[j + 1] - baseline.data[j + 1])
        + Math.abs(merged.data[j + 2] - baseline.data[j + 2])
      diffN += 3
    }
    const regionDiff = diffSum / diffN

    // 补充：把新文字写上去（最终图）
    const box = tr.maskBounds(expanded, W, H)
    const final = { data: new Uint8ClampedArray(merged.data), width: W, height: H }
    const fs = Math.round(tr.estimateFontSize(box.h) * 1)
    const built = tr.drawText(null, {
      text: 'NEW TEXT 2026', fontSize: fs, fontFamily: 'SimHei', bold: true,
      align: 'center', angle: 0, color: '#1b2430', x: 0, y: 0,
      boxW: box.w, boxH: box.h, shadow: true
    })
    tr.compositeText(final, built.canvas, {
      x: box.x + box.w / 2, y: box.y + box.h / 2, angle: 0, alpha: 1, blur: 0.4
    })

    // 最终图与无字基线在文字区平均差（衡量新字是否自然贴合）
    let finalDiff = 0, fn = 0
    for (let i = 0; i < W * H; i++) {
      if (!expanded[i]) continue
      const j = i * 4
      finalDiff += Math.abs(final.data[j] - baseline.data[j])
        + Math.abs(final.data[j + 1] - baseline.data[j + 1])
        + Math.abs(final.data[j + 2] - baseline.data[j + 2])
      fn += 3
    }

    return {
      maskPx: expanded.reduce((a, b) => a + b, 0),
      maxOutDiff: maxOut,
      outCount,
      boundaryDiff,
      regionDiff,
      finalDiff: finalDiff / fn,
      fontSize: fs,
      box,
      timing: { expand: tExpand, inpaint: tInpaint, lowFreq: tLow, feather: tFeather, total },
      elapsed: total
    }
  })
  console.log('\n--- 硬指标（经典修复路径）---\n' + JSON.stringify(metrics, null, 1))

  check('遮罩外像素最大改动 = 0', metrics.maxOutDiff === 0, `${metrics.maxOutDiff}（外区像素 ${metrics.outCount}）`)
  check('选区边界内外亮度差 < 12', metrics.boundaryDiff < 12, metrics.boundaryDiff.toFixed(2))
  check('文字区 vs 无字基线平均像素差 < 35', metrics.regionDiff < 35, metrics.regionDiff.toFixed(2))
  check('单张经典修复耗时 < 2s', metrics.timing.total < 2000, `${metrics.timing.total.toFixed(0)}ms`)
  check('UI 应用总耗时（含写字/渲染）', applyMs < 3000, `${applyMs}ms`)
  check('无 console 错误', consoleErrors.length === 0, consoleErrors.slice(0, 4).join(' || '))

  const failed = results.filter(r => !r.ok)
  console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} passed`)
  fs.writeFileSync(path.join(V, '_b1_report.json'), JSON.stringify({ results, metrics, applyMs, consoleErrors }, null, 2))
  await browser.close()
  process.exit(failed.length ? 1 : 0)
})().catch(e => { console.error(e); process.exit(2) })
