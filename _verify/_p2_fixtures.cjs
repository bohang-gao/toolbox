const zlib = require('zlib')
const fs = require('fs')
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')

function crc32(buf) {
  let crc = 0xffffffff
  for (let n = 0; n < buf.length; n++) {
    let c = (crc ^ buf[n]) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const b = Buffer.concat([Buffer.from(type), data])
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(b))
  return Buffer.concat([len, b, crc])
}
function makePng(w, h, color) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const raw = Buffer.alloc(h * (1 + w * 3))
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0
    for (let x = 0; x < w; x++) {
      const o = y * (1 + w * 3) + 1 + x * 3
      raw[o] = color[0]
      raw[o + 1] = color[1]
      raw[o + 2] = color[2]
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

;(async () => {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 1; i <= 2; i++) {
    const p = doc.addPage([595.28, 841.89])
    p.drawText(`Print Fixture Page ${i}`, { x: 60, y: 760, size: 28, font, color: rgb(0.1, 0.2, 0.7) })
  }
  fs.writeFileSync('_verify/_p2_two_pages.pdf', await doc.save())

  fs.writeFileSync('_verify/_p2_img1.png', makePng(300, 200, [220, 60, 60]))
  fs.writeFileSync('_verify/_p2_img2.png', makePng(200, 300, [60, 120, 220]))
  fs.writeFileSync('_verify/_p2_not_allowed.txt', 'hello')
  fs.writeFileSync('_verify/_p2_corrupt.pdf', Buffer.from('%PDF-1.4\nthis is not a pdf'))
  console.log('fixtures ready')
})()
