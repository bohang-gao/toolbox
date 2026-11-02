const fs = require('fs')
const { PDFDocument } = require('pdf-lib')

async function open(path){ const d=await PDFDocument.load(fs.readFileSync(path),{ignoreEncryption:true}); return d }
function info(d){ return { pages: d.getPageCount(), sizes: d.getPages().map(p=>{const s=p.getSize();return `${Math.round(s.width)}x${Math.round(s.height)}@${p.getRotation().angle}`}), title: d.getTitle(), author: d.getAuthor(), subject: d.getSubject(), keywords: d.getKeywords(), created: d.getCreationDate() && d.getCreationDate().toISOString() } }
module.exports = { open, info }
if (require.main === module) {
  (async()=>{ for (const f of ['_t3_A.pdf','_t3_B.pdf','_t3_C.pdf']) console.log(f, info(await open(f))) })()
}
