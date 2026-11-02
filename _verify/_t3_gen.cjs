const zlib = require('zlib')
const { PDFDocument, StandardFonts, rgb, degrees } = require('pdf-lib')
const fs = require('fs')

function crc32(buf){let crc=0xffffffff;for(let n=0;n<buf.length;n++){let c=(crc^buf[n])&0xff;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crc=(crc>>>8)^c;}return (crc^0xffffffff)>>>0;}
function chunk(type,data){const b=Buffer.concat([Buffer.from(type),data]);const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(b));return Buffer.concat([len,b,crc]);}
function makePng(w,h,rgb){const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;
 const raw=Buffer.alloc(h*(1+w*3));for(let y=0;y<h;y++){raw[y*(1+w*3)]=0;for(let x=0;x<w;x++){const o=y*(1+w*3)+1+x*3;raw[o]=rgb[0];raw[o+1]=rgb[1];raw[o+2]=rgb[2];}}
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);}

;(async()=>{
  // A: 5-page text PDF, varying sizes
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i=1;i<=5;i++){
    const w = i===3 ? 500 : 400
    const p = doc.addPage([w, 600])
    p.drawText(`Page ${i}`, {x:40,y:520,size:48,font,color:rgb(0.1,0.2,0.7)})
    p.drawRectangle({x:20,y:20,width:w-40,height:560,borderWidth:1,borderColor:rgb(0.6,0.6,0.6)})
  }
  doc.setTitle('Original Title'); doc.setAuthor('Original Author'); doc.setSubject('Subj'); doc.setKeywords(['k1','k2'])
  doc.setCreationDate(new Date('2024-01-02T03:04:00'))
  fs.writeFileSync('_t3_A.pdf', await doc.save())

  // B: 2-page PDF for merge
  const docB = await PDFDocument.create()
  const fb = await docB.embedFont(StandardFonts.Helvetica)
  for (let i=1;i<=2;i++){
    const p = docB.addPage([300,400])
    p.drawText(`B-${i}`, {x:30,y:330,size:30,font:fb})
  }
  fs.writeFileSync('_t3_B.pdf', await docB.save())

  // C: image PDF for extract-image (3 pages, each with 1 embedded png + repeated small icon)
  const docC = await PDFDocument.create()
  const img = await docC.embedPng(makePng(120,90,[220,40,40]))
  const icon = await docC.embedPng(makePng(8,8,[40,40,220]))
  for (let i=1;i<=3;i++){
    const p = docC.addPage([400,300])
    p.drawImage(img,{x:40,y:60,width:240,height:180})
    p.drawImage(icon,{x:360,y:270,width:8,height:8})
  }
  fs.writeFileSync('_t3_C.pdf', await docC.save())
  console.log('generated _t3_A.pdf _t3_B.pdf _t3_C.pdf')
})()
