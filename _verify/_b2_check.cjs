// B2 图片改字：AI（MI-GAN）路径 E2E + 硬指标 + 失败回退实测
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

// 造图脚本（页面内执行）：渐变背景 + 深色文字
const MAKE_IMG = `(withText) => {
  const W = 900, H = 500
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d', { willReadFrequently: true })
  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, '#dfe9f5'); g.addColorStop(0.5, '#c9d9ea'); g.addColorStop(1, '#e8e2d6')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  if (withText) {
    ctx.fillStyle = '#1b2430'
    ctx.font = 'bold 78px Arial, sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('SAMPLE 88', W / 2, H / 2)
  }
  return c
}`

;(async () => {
  const browser = await chromium.launch({ executablePath: EXEC, headless: true })
  const consoleErrors = []
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message))

  await page.goto(BASE + '/#/textedit', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)

  // 0) 修复方式选择器存在，默认 AI
  const modes = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.option-panel .idphoto-tab'))
    return btns.map(b => ({ text: b.textContent.trim(), active: b.classList.contains('is-active') }))
  })
  check('修复方式选择器（默认 AI）', modes.length === 2 && modes[0].active && modes[0].text.includes('AI'),
    JSON.stringify(modes))

  // 1) 注入测试图
  const TEST = await page.evaluate(async (mkSrc) => {
    const mk = eval(mkSrc)
    const canvas = mk(true)
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
    const file = new File([blob], 'b2_test.png', { type: 'image/png' })
    const dt = new DataTransfer(); dt.items.add(file)
    document.querySelector('.upload-zone').dispatchEvent(
      new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }))
    return { w: canvas.width, h: canvas.height, dataUrl: canvas.toDataURL('image/png') }
  }, MAKE_IMG)
  fs.writeFileSync(path.join(V, '_b2_input.png'), Buffer.from(TEST.dataUrl.split(',')[1], 'base64'))
  await page.waitForTimeout(800)
  const loaded = await page.evaluate(() => {
    const c = document.querySelector('.te-canvas-wrap canvas')
    return c ? { w: c.width, h: c.height } : null
  })
  check('拖入图片自动载入画布', loaded && loaded.w === TEST.w && loaded.h === TEST.h, JSON.stringify(loaded))

  // 2) 画笔圈选文字
  await page.locator('.te-canvas-wrap').scrollIntoViewIfNeeded()
  await page.waitForTimeout(200)
  const box = await page.locator('.te-overlay').boundingBox()
  const toScreen = (ix, iy) => ({
    x: box.x + (ix / TEST.w) * box.width,
    y: box.y + (iy / TEST.h) * box.height
  })
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

  // 3) 输入新文字 → AI 应用
  await page.locator('.option-panel input[type="text"]').fill('NEW TEXT 2026')
  await page.waitForTimeout(200)
  const t0 = Date.now()
  await page.locator('.te-toolbar .el-button--primary').click()
  // 等 AI 完成（首次含 28MB 模型下载 + 推理）
  await page.waitForFunction(() => {
    const btns = document.querySelectorAll('.idphoto-toolbar .idphoto-tab')
    return btns.length >= 3 && !btns[2].disabled
  }, { timeout: 180000 })
  const applyMs = Date.now() - t0
  const afterApply = await page.evaluate(() => ({
    tabs: Array.from(document.querySelectorAll('.idphoto-toolbar .idphoto-tab')).map(b => ({
      text: b.textContent.trim(), disabled: b.disabled, active: b.classList.contains('is-active')
    })),
    hints: Array.from(document.querySelectorAll('.idphoto-toolbar .idphoto-hint')).map(e => e.textContent.trim()),
    success: Array.from(document.querySelectorAll('.el-message--success')).map(e => e.textContent.trim())
  }))
  check('AI 应用后进入「最终」三态', afterApply.tabs[2] && afterApply.tabs[2].active && !afterApply.tabs[2].disabled,
    JSON.stringify(afterApply.tabs))
  const pathHint = afterApply.hints.find(h => /耗时/.test(h)) || ''
  const timingHint = afterApply.hints.find(h => /模型加载/.test(h)) || ''
  check('AI 路径标识 + 耗时分开上报', /AI 修复耗时/.test(pathHint) && /模型加载/.test(timingHint),
    `${pathHint} | ${timingHint}`)
  console.log('    hints:', afterApply.hints.join(' | '))

  // 4) 三态切换 + 下载
  await page.locator('.idphoto-toolbar .idphoto-tab', { hasText: '已修复' }).click()
  await page.waitForTimeout(250)
  await page.locator('.idphoto-toolbar .idphoto-tab', { hasText: '最终' }).click()
  await page.waitForTimeout(250)
  await page.screenshot({ path: path.join(V, '_b2_ui.png'), fullPage: true })
  const dlPromise = page.waitForEvent('download', { timeout: 10000 })
  await page.locator('.step-actions .el-button--primary', { hasText: '下载 PNG' }).click()
  const dl = await dlPromise
  const dlPath = path.join(V, '_b2_download.png')
  await dl.saveAs(dlPath)
  const dlBuf = fs.readFileSync(dlPath)
  const dw = dlBuf.readUInt32BE(16), dh = dlBuf.readUInt32BE(20)
  check('下载 PNG 与原图同尺寸', dw === TEST.w && dh === TEST.h,
    `${dw}x${dh} file=${dl.suggestedFilename()} bytes=${dlBuf.length}`)

  // 5) 硬指标：页面内跑 AI 完整管线（crop→推理→回贴→低频补偿→羽化）
  const metrics = await page.evaluate(async ({ mkSrc, imgUrl }) => {
    const mk = eval(mkSrc)
    const { expandMask, lowFreqMatch, featherComposite } = await import('/src/lib/inpaint.js')
    const tr = await import('/src/lib/textrender.js')
    const { aiInpaint } = await import('/src/lib/aiInpaint.js')

    const W = 900, H = 500
    const img = mk(true).getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H)
    const baseline = mk(false).getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H)

    const raw = new Uint8Array(W * H)
    for (let y = 205; y < 300; y++) for (let x = 240; x < 665; x++) raw[y * W + x] = 1
    const expanded = expandMask(raw, W, H, 3)

    const tA = performance.now()
    const r = await aiInpaint(img, expanded, (n) => {})
    if (!r.ok) return { error: r.reason }
    const aiWall = performance.now() - tA
    const tB = performance.now()
    const matched = lowFreqMatch(r.filled, img, expanded, 24)
    const tLow = performance.now() - tB
    const tC = performance.now()
    const merged = featherComposite(img, matched, expanded, 3.5)
    const tFeather = performance.now() - tC

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
    // 指标 2：选区边界内外亮度差
    const lumOf = (d, j) => d[j] * 0.299 + d[j + 1] * 0.587 + d[j + 2] * 0.114
    const outerBand = expandMask(expanded, W, H, 4)
    let inSum = 0, inN = 0, outSum = 0, outN = 0
    for (let i = 0; i < W * H; i++) {
      const j = i * 4
      if (expanded[i]) { inSum += lumOf(merged.data, j); inN++ }
      else if (outerBand[i]) { outSum += lumOf(merged.data, j); outN++ }
    }
    const boundaryDiff = Math.abs(inSum / inN - outSum / outN)
    // 指标 3：修复区 vs 无字基线平均像素差
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

    // 最终图（写新字）
    const bx = tr.maskBounds(expanded, W, H)
    const final = { data: new Uint8ClampedArray(merged.data), width: W, height: H }
    const built = tr.drawText(null, {
      text: 'NEW TEXT 2026', fontSize: Math.round(tr.estimateFontSize(bx.h)), fontFamily: 'SimHei',
      bold: true, align: 'center', angle: 0, color: '#1b2430', x: 0, y: 0,
      boxW: bx.w, boxH: bx.h, shadow: true
    })
    tr.compositeText(final, built.canvas, { x: bx.x + bx.w / 2, y: bx.y + bx.h / 2, angle: 0, alpha: 1, blur: 0.4 })
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
      maxOutDiff: maxOut, outCount, boundaryDiff, regionDiff,
      finalDiff: finalDiff / fn,
      aiLoadMs: r.timings.loadMs, aiInferMs: r.timings.inferMs, aiWall,
      postMs: { lowFreq: tLow, feather: tFeather },
      box: bx,
    }
  }, { mkSrc: MAKE_IMG, imgUrl: TEST.dataUrl })

  console.log('\n--- 硬指标（AI 路径）---\n' + JSON.stringify(metrics, null, 1))
  if (metrics.error) {
    check('AI 管线可运行', false, metrics.error)
  } else {
    check('遮罩外像素最大改动 = 0', metrics.maxOutDiff === 0, `${metrics.maxOutDiff}（外区像素 ${metrics.outCount}）`)
    check('选区边界内外亮度差 < 12', metrics.boundaryDiff < 12, metrics.boundaryDiff.toFixed(2))
    check('文字区 vs 无字基线平均像素差 < 35', metrics.regionDiff < 35, metrics.regionDiff.toFixed(2))
    check('AI 单张耗时 < 30s（不含首次模型下载）', metrics.aiInferMs < 30000,
      `load=${metrics.aiLoadMs}ms infer=${metrics.aiInferMs}ms wall=${Math.round(metrics.aiWall)}ms`)
  }

  // 6) 回退实测：把 migan 资产路径打到不存在的位置（404），验证自动回退 + 提示
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page2 = await ctx2.newPage()
  const errors2 = []
  page2.on('pageerror', (e) => errors2.push(e.message))
  await page2.route('**/migan/**', (route) => route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' }))
  await page2.goto(BASE + '/#/textedit', { waitUntil: 'networkidle' })
  await page2.waitForTimeout(400)
  await page2.evaluate(async (mkSrc) => {
    const mk = eval(mkSrc)
    const canvas = mk(true)
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
    const file = new File([blob], 'b2_fallback.png', { type: 'image/png' })
    const dt = new DataTransfer(); dt.items.add(file)
    document.querySelector('.upload-zone').dispatchEvent(
      new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }))
  }, MAKE_IMG)
  await page2.waitForTimeout(800)
  await page2.locator('.te-canvas-wrap').scrollIntoViewIfNeeded()
  const box2 = await page2.locator('.te-overlay').boundingBox()
  const toS2 = (ix, iy) => ({
    x: box2.x + (ix / TEST.w) * box2.width,
    y: box2.y + (iy / TEST.h) * box2.height
  })
  await page2.mouse.move(...Object.values(toS2(255, 250)))
  await page2.mouse.down()
  for (let x = 255; x <= 650; x += 20) {
    for (const y of [228, 252, 276]) {
      const p = toS2(x, y)
      await page2.mouse.move(p.x, p.y, { steps: 1 })
    }
  }
  await page2.mouse.up()
  await page2.waitForTimeout(300)
  await page2.locator('.option-panel input[type="text"]').fill('FALLBACK 99')
  await page2.locator('.te-toolbar .el-button--primary').click()
  await page2.waitForFunction(() => {
    const btns = document.querySelectorAll('.idphoto-toolbar .idphoto-tab')
    return btns.length >= 3 && !btns[2].disabled
  }, { timeout: 60000 })
  const fb = await page2.evaluate(() => ({
    warn: Array.from(document.querySelectorAll('.el-message--warning')).map(e => e.textContent.trim()),
    success: Array.from(document.querySelectorAll('.el-message--success')).map(e => e.textContent.trim()),
    hints: Array.from(document.querySelectorAll('.idphoto-toolbar .idphoto-hint')).map(e => e.textContent.trim()),
    textVal: document.querySelector('.option-panel input[type="text"]').value,
    canUndo: !document.querySelectorAll('.te-toolbar .el-button')[0].disabled,
    tabsEnabled: Array.from(document.querySelectorAll('.idphoto-toolbar .idphoto-tab')).map(b => !b.disabled),
  }))
  check('AI 资源缺失 → 出现回退提示',
    fb.warn.length > 0 && /AI 修复失败，已回退经典修复/.test(fb.warn[0]), fb.warn.join(' || '))
  check('回退后仍产出最终图（经典路径）',
    fb.tabsEnabled.length === 3 && fb.tabsEnabled[2] && fb.hints.some(h => /经典修复耗时/.test(h)),
    fb.hints.join(' | '))
  check('回退不影响已选区与已输入文字',
    fb.canUndo === true && fb.textVal === 'FALLBACK 99', `undo=${fb.canUndo} text=${fb.textVal}`)
  await page2.screenshot({ path: path.join(V, '_b2_fallback.png'), fullPage: true })
  check('回退页无 pageerror', errors2.length === 0, errors2.slice(0, 3).join(' || '))

  check('无 console 错误（AI 页）', consoleErrors.length === 0, consoleErrors.slice(0, 4).join(' || '))

  const failed = results.filter(r => !r.ok)
  console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} passed`)
  fs.writeFileSync(path.join(V, '_b2_report.json'),
    JSON.stringify({ results, metrics, applyMs, consoleErrors }, null, 2))
  await browser.close()
  process.exit(failed.length ? 1 : 0)
})().catch(e => { console.error(e); process.exit(2) })
