const path=require('path')
const { chromium } = require('C:/Users/DELL/AppData/Local/hermes/hermes-agent/node_modules/playwright-core')
;(async()=>{
const b=await chromium.launch({executablePath:'C:/Users/DELL/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',headless:true})
const p=await b.newPage({viewport:{width:1440,height:900}})
p.on('console',m=>console.log('CONSOLE',m.type(),m.text()))
p.on('pageerror',e=>console.log('ERR',e.message))
await p.goto('http://localhost:5200/#/textedit',{waitUntil:'networkidle'})
await p.evaluate(async()=>{
 const c=document.createElement('canvas');c.width=900;c.height=500;const x=c.getContext('2d');
 const g=x.createLinearGradient(0,0,900,500);g.addColorStop(0,'#dfe9f5');g.addColorStop(1,'#e8e2d6');x.fillStyle=g;x.fillRect(0,0,900,500);
 x.fillStyle='#1b2430';x.font='bold 78px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText('SAMPLE 88',450,250);
 const blob=await new Promise(r=>c.toBlob(r,'image/png'))
 const dt=new DataTransfer();dt.items.add(new File([blob],'t.png',{type:'image/png'}))
 document.querySelector('.upload-zone').dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}))
})
await p.waitForTimeout(700)
console.log(await p.evaluate(()=>{
 const wrap=document.querySelector('.te-canvas-wrap'); const ov=document.querySelector('.te-overlay')
 const r=ov.getBoundingClientRect(); const cs=getComputedStyle(ov)
 return {wrapClass:wrap.className, ovRect:{x:r.x,y:r.y,w:r.width,h:r.height}, pe:cs.pointerEvents, ovAttr:[ov.width,ov.height], wrapRect: wrap.getBoundingClientRect().toJSON()}
}))
const bb=await p.locator('.te-overlay').boundingBox();console.log('bbox',bb)
await p.mouse.move(bb.x+300,bb.y+250);await p.mouse.down()
await p.mouse.move(bb.x+400,bb.y+250,{steps:5});await p.mouse.move(bb.x+500,bb.y+250,{steps:5});await p.mouse.up()
await p.waitForTimeout(300)
console.log(await p.evaluate(()=>{
 const btns=document.querySelectorAll('.te-toolbar .el-button')
 return {undoDisabled:btns[0].disabled, applyDisabled:document.querySelector('.te-toolbar .el-button--primary').disabled, hex:document.querySelector('.te-hex').textContent}
}))
await b.close()
})()
