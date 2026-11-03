// U3 运行时审计：26 个指定工具 + des/rsa 加解密验证
// 选择器一律限定在 .tool-main 内，避免命中全局侧边栏搜索框
const path = require('path')
const fs = require('fs')
const { chromium } = require('C:/Users/DELL/AppData/Local/hermes/hermes-agent/node_modules/playwright-core')
const { PDFDocument } = require('pdf-lib')

const BASE = 'http://localhost:5199'
const EXEC = 'C:/Users/DELL/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
const V = path.resolve('_verify')
const F = {
  png1: path.join(V, '_p2_img1.png'),
  png2: path.join(V, '_p2_img2.png'),
  pdf3: path.join(V, '_u3_pdf3.pdf'),
  pdf5: path.join(V, '_u3_pdf5.pdf'),
  pdfImg: path.join(V, '_u3_pdf_img.pdf'),
  txt: path.join(V, '_u3_text.txt')
}

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + detail : ''}`)
}

const main = (page) => page.locator('.tool-main')

async function addFiles(page, files) {
  const chooser = page.waitForEvent('filechooser', { timeout: 10000 })
  await page.locator('.uz-btn').first().click()
  const fc = await chooser
  await fc.setFiles(files)
}
async function allMsgs(page) {
  return (await page.locator('.el-message').allTextContents()).join(' | ')
}
async function waitDone(page, timeout = 30000) {
  await page.locator('.t-status.done').first().waitFor({ timeout })
}
function waitDownload(page, timeout = 60000) {
  return page.waitForEvent('download', { timeout })
}
async function saveDl(dl, name) {
  const p = path.join(V, name)
  await dl.saveAs(p)
  const st = fs.statSync(p)
  return { p, size: st.size }
}
// 显式等待 h1 出现；失败重试一次（消除长流程中的偶发导航时序问题）
async function goto(page, route, h1) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto(`${BASE}/#${route}`, { waitUntil: 'networkidle' })
    if (!h1) return
    try {
      await page.locator(`.tool-hero h1:has-text("${h1}")`).waitFor({ timeout: 10000 })
      return
    } catch (e) {
      if (attempt === 2) throw e
      await page.waitForTimeout(300)
    }
  }
}
const txt = (page, n = 0) => main(page).locator('textarea').nth(n)
const inp = (page, n = 0) => main(page).locator('input.el-input__inner').nth(n)

;(async () => {
  const browser = await chromium.launch({ executablePath: EXEC })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })
  const page = await ctx.newPage()
  const consoleErrors = []
  const pageErrors = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => pageErrors.push(String(e)))

  // ========== 图片类 ==========
  await goto(page, '/imageresize', '图片尺寸调整')
  await addFiles(page, [F.png1])
  const dlP = waitDownload(page)
  await page.locator('.step-actions button:has-text("开始处理")').click()
  await waitDone(page)
  const d1 = await saveDl(await dlP, '_u3_out_resize.png')
  check('imageresize 处理完成并下载', d1.size > 0, `${path.basename(d1.p)} ${d1.size}B`)

  await goto(page, '/imagerotate', '图片旋转翻转')
  await addFiles(page, [F.png1])
  await main(page).locator('.option-panel select').selectOption('90')
  const dlP2 = waitDownload(page)
  await page.locator('.step-actions button:has-text("开始处理")').click()
  await waitDone(page)
  const d2 = await saveDl(await dlP2, '_u3_out_rotate.png')
  check('imagerotate 处理完成并下载', d2.size > 0, `${path.basename(d2.p)} ${d2.size}B`)

  await goto(page, '/image2jpg', '图片转JPG')
  await addFiles(page, [F.png1])
  const dlP3 = waitDownload(page)
  await page.locator('.step-actions button:has-text("开始处理")').click()
  await waitDone(page)
  const d3 = await saveDl(await dlP3, '_u3_out.jpg')
  const isJpg = fs.readFileSync(d3.p).slice(0, 2).toString('hex') === 'ffd8'
  check('image2jpg 输出真实 JPEG', isJpg && d3.size > 0, `${d3.size}B magic=${isJpg}`)

  await goto(page, '/image2png', '图片转PNG')
  await addFiles(page, [F.png1])
  const dlP4 = waitDownload(page)
  await page.locator('.step-actions button:has-text("开始处理")').click()
  await waitDone(page)
  const d4 = await saveDl(await dlP4, '_u3_out.png')
  const isPng = fs.readFileSync(d4.p).slice(1, 4).toString('ascii') === 'PNG'
  check('image2png 输出真实 PNG', isPng && d4.size > 0, `${d4.size}B magic=${isPng}`)

  await goto(page, '/image2webp', '图片转webp')
  await addFiles(page, [F.png1])
  const dlP5 = waitDownload(page)
  await page.locator('.step-actions button:has-text("开始处理")').click()
  await waitDone(page)
  const d5 = await saveDl(await dlP5, '_u3_out.webp')
  const head = fs.readFileSync(d5.p).slice(0, 4).toString('ascii')
  check('image2webp 输出真实 WebP', head === 'RIFF' && d5.size > 0, `${d5.size}B magic=${head}`)

  await goto(page, '/imagecombine', '拼长图')
  await addFiles(page, [F.png1, F.png2])
  const dlP6 = waitDownload(page)
  await page.locator('.step-actions button:has-text("开始处理")').click()
  await waitDone(page)
  const d6 = await saveDl(await dlP6, '_u3_out_combined.png')
  check('imagecombine 生成拼接长图', d6.size > 0, `${path.basename(d6.p)} ${d6.size}B`)

  // ========== PDF 类 ==========
  await goto(page, '/pdfextract', 'PDF提取页面')
  await addFiles(page, [F.pdf5])
  const dlP7 = waitDownload(page)
  await page.locator('.step-actions button:has-text("开始处理")').click()
  await waitDone(page)
  const d7 = await saveDl(await dlP7, '_u3_out_extract.pdf')
  const pdf7 = await PDFDocument.load(fs.readFileSync(d7.p))
  check('pdfextract 提取 1-3,5 共 4 页', pdf7.getPageCount() === 4, `pages=${pdf7.getPageCount()}`)

  await goto(page, '/pdfrotate', 'PDF旋转')
  await addFiles(page, [F.pdf3])
  const dlP8 = waitDownload(page)
  await page.locator('.step-actions button:has-text("开始处理")').click()
  await waitDone(page)
  const d8 = await saveDl(await dlP8, '_u3_out_rotate.pdf')
  const pdf8 = await PDFDocument.load(fs.readFileSync(d8.p))
  const rot8 = pdf8.getPages().map(p => p.getRotation().angle)
  check('pdfrotate 全部页面旋转 90°', rot8.every(a => a === 90) && rot8.length === 3, JSON.stringify(rot8))

  await goto(page, '/pdfsort', 'PDF排序')
  await addFiles(page, [F.pdf3])
  const dlP9 = waitDownload(page)
  await page.locator('.step-actions button:has-text("开始处理")').click()
  await waitDone(page)
  const d9 = await saveDl(await dlP9, '_u3_out_sort.pdf')
  const pdf9 = await PDFDocument.load(fs.readFileSync(d9.p))
  check('pdfsort 输出 3 页', pdf9.getPageCount() === 3, `pages=${pdf9.getPageCount()}`)

  await goto(page, '/pdfcompress', 'PDF压缩')
  await addFiles(page, [F.pdf3])
  const dlP10 = waitDownload(page)
  await page.locator('.step-actions button:has-text("开始处理")').click()
  await waitDone(page)
  const d10 = await saveDl(await dlP10, '_u3_out_compress.pdf')
  const pdf10 = await PDFDocument.load(fs.readFileSync(d10.p))
  check('pdfcompress 输出可解析 PDF', pdf10.getPageCount() === 3, `pages=${pdf10.getPageCount()} ${d10.size}B`)

  await goto(page, '/pdf-metadata', 'PDF修改元数据')
  await addFiles(page, [F.pdf3])
  await inp(page, 0).fill('U3 Title')
  const dlP11 = waitDownload(page)
  await page.locator('.step-actions button:has-text("开始处理")').click()
  await waitDone(page)
  const d11 = await saveDl(await dlP11, '_u3_out_metadata.pdf')
  const pdf11 = await PDFDocument.load(fs.readFileSync(d11.p))
  check('pdf-metadata 写入标题并下载', pdf11.getTitle() === 'U3 Title', `title=${pdf11.getTitle()}`)

  await goto(page, '/pdf-resize', 'PDF页面调整')
  await addFiles(page, [F.pdf3])
  const dlP12 = waitDownload(page)
  await page.locator('.step-actions button:has-text("开始处理")').click()
  await waitDone(page)
  const d12 = await saveDl(await dlP12, '_u3_out_resizepdf.pdf')
  const pdf12 = await PDFDocument.load(fs.readFileSync(d12.p))
  const widths = pdf12.getPages().map(p => Math.round(p.getWidth()))
  check('pdf-resize 页面宽度统一为 595', widths.every(w => w === 595), JSON.stringify(widths))

  await goto(page, '/pdf-extract-image', 'PDF提取图片')
  await addFiles(page, [F.pdfImg])
  const dlP13 = waitDownload(page)
  await page.locator('.step-actions button:has-text("开始处理")').click()
  await waitDone(page)
  const d13 = await saveDl(await dlP13, '_u3_out_extracted.png')
  const isPng13 = fs.readFileSync(d13.p).slice(1, 4).toString('ascii') === 'PNG'
  check('pdf-extract-image 提取内嵌图片', isPng13 && d13.size > 0, `${d13.size}B magic=${isPng13}`)

  await goto(page, '/pdf-remove-watermark', 'PDF去水印')
  await addFiles(page, [F.pdf3])
  const dlP14 = waitDownload(page)
  await page.locator('.step-actions button:has-text("开始处理")').click()
  await waitDone(page, 60000)
  const d14 = await saveDl(await dlP14, '_u3_out_nowm.pdf')
  const pdf14 = await PDFDocument.load(fs.readFileSync(d14.p))
  check('pdf-remove-watermark 重建图片型 PDF', pdf14.getPageCount() === 3, `pages=${pdf14.getPageCount()}`)

  await goto(page, '/pdf-to-long-image', 'PDF转长图')
  await addFiles(page, [F.pdf3])
  const dlP15 = waitDownload(page)
  await page.locator('.step-actions button:has-text("开始处理")').click()
  await waitDone(page, 60000)
  const d15 = await saveDl(await dlP15, '_u3_out_long.png')
  const isPng15 = fs.readFileSync(d15.p).slice(1, 4).toString('ascii') === 'PNG'
  check('pdf-to-long-image 生成长图', isPng15 && d15.size > 0, `${d15.size}B magic=${isPng15}`)

  // ========== 文本/其他 ==========
  await goto(page, '/file_hash', '文件Hash计算')
  await addFiles(page, [F.txt])
  await page.locator('.step-actions button:has-text("计算 Hash")').click()
  await page.locator('.hash-row-value').first().waitFor({ timeout: 15000 })
  const fh = (await page.locator('.hash-row-value').allTextContents()).join('|')
  check('file_hash 输出 SHA-256', /^[0-9a-f]{64}$/.test(fh.trim()), fh.slice(0, 20) + '…')

  await goto(page, '/aes', 'AES加密解密')
  await inp(page, 0).fill('u3pass')
  await txt(page, 0).fill('U3 加密测试文本')
  await page.locator('.step-actions button:has-text("加密")').click()
  await page.locator('.result-box').waitFor({ timeout: 15000 })
  const cipher = (await page.locator('.result-box').textContent()).trim()
  check('aes 加密输出 Base64 密文', cipher.length > 20 && /^[A-Za-z0-9+/=]+$/.test(cipher), `${cipher.length} chars`)
  await main(page).locator('label.el-radio:has-text("解密") input').check()
  await txt(page, 0).fill(cipher)
  await page.locator('.step-actions button:has-text("解密")').click()
  await page.waitForTimeout(500)
  const plain = (await page.locator('.result-box').textContent()).trim()
  check('aes 解密还原明文', plain === 'U3 加密测试文本', plain)

  await goto(page, '/url', 'URL编码解码')
  await txt(page, 0).fill('a b&c=中文')
  await page.waitForTimeout(300)
  const urlOut = await txt(page, 1).inputValue()
  check('url 编码输出非空', urlOut.includes('%20') && urlOut.includes('%E4%B8%AD'), urlOut)

  await goto(page, '/unicode', 'Unicode编码转换')
  await txt(page, 0).fill('你好')
  await page.waitForTimeout(300)
  const uniOut = await txt(page, 1).inputValue()
  check('unicode 编码输出 \\uXXXX', /\\u4f60\\u597d/i.test(uniOut), uniOut)

  await goto(page, '/regex', '正则表达式测试')
  await inp(page, 0).fill('\\d+')
  await txt(page, 0).fill('a1 b22 c333')
  await page.waitForTimeout(400)
  const mCount = await page.locator('.match-row').count()
  const marks = await page.locator('.regex-mark').count()
  check('regex 匹配 3 处并高亮', mCount === 3 && marks === 3, `rows=${mCount} marks=${marks}`)

  await goto(page, '/number', '进制转换')
  await inp(page, 0).fill('255')
  await page.waitForTimeout(300)
  const nums = await page.locator('.num-row-value').allTextContents()
  check('number 255 转换正确', nums[0] === '11111111' && nums[4] === 'ff', JSON.stringify(nums))

  await goto(page, '/color', '颜色值转换')
  await inp(page, 0).fill('#ff0000')
  await page.waitForTimeout(300)
  const cols = await page.locator('.color-row-value').allTextContents()
  check('color 输出 HEX/RGB/RGBA/HSL', cols[0] === '#FF0000' && cols[1] === 'rgb(255, 0, 0)', JSON.stringify(cols))

  await goto(page, '/timestamp', 'Unix时间戳')
  await inp(page, 0).fill('1730000000')
  await page.locator('.step-actions button:has-text("时间戳 → 日期")').click()
  await page.locator('.result-box').waitFor({ timeout: 10000 })
  const ts = (await page.locator('.result-box').textContent()).replace(/\s+/g, ' ').trim()
  check('timestamp 输出本地/UTC 时间', ts.includes('2024-10-27') && ts.includes('UTC'), ts.slice(0, 80))

  await goto(page, '/morse', '摩斯电码')
  await txt(page, 0).fill('SOS')
  await page.waitForTimeout(300)
  const morseOut = await txt(page, 1).inputValue()
  check('morse SOS 编码', morseOut === '... --- ...', morseOut)

  await goto(page, '/hash', 'Hash计算')
  await txt(page, 0).fill('abc')
  // 默认只勾选 SHA-256，需定位到 SHA-256 那一行（第一行是未勾选的 SHA-1）
  const sha256Row = page.locator('.hash-row:has(.hash-row-label:text-is("SHA-256")) .hash-row-value')
  await sha256Row.waitFor({ timeout: 15000 })
  // compute 有 180ms 防抖，需等该行真正出值（64 位十六进制）
  await page.waitForFunction(() => {
    const rows = document.querySelectorAll('.hash-row')
    for (const r of rows) {
      const label = r.querySelector('.hash-row-label')
      if (label && label.textContent.trim() === 'SHA-256') {
        const v = r.querySelector('.hash-row-value')
        return v && /^[0-9a-f]{64}$/.test(v.textContent.trim())
      }
    }
    return false
  }, null, { timeout: 15000 })
  const hashVal = (await sha256Row.textContent()).trim()
  check('hash SHA-256(abc) 正确', hashVal === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', hashVal)

  await goto(page, '/qrcode', '二维码制作')
  await txt(page, 0).fill('https://example.com/')
  await page.locator('.step-actions button:has-text("生成二维码")').click()
  await page.locator('img[alt="二维码预览"]').waitFor({ timeout: 15000 })
  const src = await page.locator('img[alt="二维码预览"]').getAttribute('src')
  check('qrcode 生成 dataURL 预览', src.startsWith('data:image/png;base64,'), src.slice(0, 40) + '…')
  const dlP26 = waitDownload(page)
  await page.locator('button:has-text("下载 PNG")').click()
  const d26 = await saveDl(await dlP26, '_u3_out_qrcode.png')
  check('qrcode 下载 PNG', d26.size > 0, `${d26.size}B`)

  // ========== DES 加解密往返 ==========
  await goto(page, '/des', 'DES加密解密')
  await inp(page, 0).fill('12345678')
  await txt(page, 0).fill('hello imgtool')
  await page.locator('.step-actions button:has-text("加密")').click()
  await page.locator('.result-box').waitFor({ timeout: 15000 })
  const desCipher = (await page.locator('.result-box').textContent()).trim()
  check('des 加密输出 Base64 密文', /^[A-Za-z0-9+/=]+$/.test(desCipher) && desCipher.length > 8, desCipher)
  await main(page).locator('label.el-radio:has-text("解密") input').check()
  await txt(page, 0).fill(desCipher)
  await page.locator('.step-actions button:has-text("解密")').click()
  await page.waitForTimeout(400)
  const desPlain = (await page.locator('.result-box').textContent()).trim()
  check('des 解密还原明文', desPlain === 'hello imgtool', desPlain)

  // ========== RSA 生成密钥 + 加解密往返 ==========
  await goto(page, '/rsa', 'RSA加密解密')
  await page.locator('button:has-text("生成密钥对")').click()
  // 等待生成完成并写入公钥框（不能只看 .el-message，可能有上页残留 toast）
  await page.waitForFunction(() => {
    const ta = document.querySelectorAll('.tool-main textarea')
    return ta.length > 0 && ta[0].value.includes('BEGIN PUBLIC KEY')
  }, null, { timeout: 30000 })
  const rsaMsg = await allMsgs(page)
  const pubPem = await txt(page, 0).inputValue()          // 加密模式：textarea0=公钥
  await main(page).locator('label.el-radio:has-text("解密") input').check()
  await page.waitForFunction(() => {
    const ta = document.querySelectorAll('.tool-main textarea')
    return ta.length > 0 && ta[0].value.includes('BEGIN PRIVATE KEY')
  }, null, { timeout: 10000 })
  const privPem = await txt(page, 0).inputValue()         // 解密模式：textarea0=私钥
  check('rsa 生成密钥对', pubPem.includes('BEGIN PUBLIC KEY') && privPem.includes('BEGIN PRIVATE KEY'), `pub=${pubPem.length} priv=${privPem.length} msg=${rsaMsg.includes('已生成 2048 位 RSA 密钥对')}`)
  await main(page).locator('label.el-radio:has-text("加密") input').check()
  await txt(page, 1).fill('U3 RSA 测试')                  // 加密模式：textarea1=明文
  await page.locator('.step-actions button:has-text("加密")').click()
  await page.locator('.result-box').waitFor({ timeout: 20000 })
  const rsaCipher = (await page.locator('.result-box').textContent()).trim()
  check('rsa 公钥加密输出 Base64', /^[A-Za-z0-9+/=]+$/.test(rsaCipher) && rsaCipher.length > 100, `${rsaCipher.length} chars`)
  await main(page).locator('label.el-radio:has-text("解密") input').check()
  await txt(page, 1).fill(rsaCipher)                      // 解密模式：textarea1=密文
  await page.locator('.step-actions button:has-text("解密")').click()
  await page.waitForTimeout(600)
  const rsaPlain = (await page.locator('.result-box').textContent()).trim()
  check('rsa 私钥解密还原明文', rsaPlain === 'U3 RSA 测试', rsaPlain)

  check('无 console error', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' || '))
  check('无 pageerror', pageErrors.length === 0, pageErrors.slice(0, 2).join(' || '))

  await browser.close()
  const failed = results.filter(r => !r.ok)
  console.log(`\nTOTAL ${results.length} | PASS ${results.length - failed.length} | FAIL ${failed.length}`)
  fs.writeFileSync(path.join(V, '_u3_report.json'), JSON.stringify(results, null, 2))
  process.exit(failed.length ? 1 : 0)
})().catch(e => {
  console.error('FATAL', e)
  process.exit(2)
})
