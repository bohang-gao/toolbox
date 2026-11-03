// 生成 U3 运行时审计所需的测试文件
const fs = require('fs')
const path = require('path')
const { PDFDocument, StandardFonts } = require('pdf-lib')

const V = path.resolve('_verify')

async function makePdf(file, pages) {
  // pages: [{w,h,label}]
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (const p of pages) {
    const page = doc.addPage([p.w, p.h])
    page.drawText(p.label, { x: 40, y: p.h - 60, size: 22, font })
  }
  fs.writeFileSync(path.join(V, file), await doc.save())
}

async function makeImagePdf(file, pngPath) {
  const doc = await PDFDocument.create()
  const png = await doc.embedPng(fs.readFileSync(path.join(V, pngPath)))
  const page = doc.addPage([png.width, png.height])
  page.drawImage(png, { x: 0, y: 0, width: png.width, height: png.height })
  fs.writeFileSync(path.join(V, file), await doc.save())
}

(async () => {
  await makePdf('_u3_pdf3.pdf', [
    { w: 595, h: 842, label: 'PAGE-1' },
    { w: 842, h: 595, label: 'PAGE-2' },
    { w: 400, h: 600, label: 'PAGE-3' }
  ])
  await makePdf('_u3_pdf5.pdf', [
    { w: 595, h: 842, label: 'P1' },
    { w: 595, h: 842, label: 'P2' },
    { w: 595, h: 842, label: 'P3' },
    { w: 595, h: 842, label: 'P4' },
    { w: 595, h: 842, label: 'P5' }
  ])
  await makeImagePdf('_u3_pdf_img.pdf', '_p2_img1.png')
  fs.writeFileSync(path.join(V, '_u3_text.txt'), 'hello imgtool\nU3 runtime audit\n', 'utf8')
  console.log('fixtures ready')
})()
