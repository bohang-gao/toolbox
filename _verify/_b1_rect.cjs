const path=require('path');const fs=require('fs')
const { chromium } = require('C:/Users/DELL/AppData/Local/hermes/hermes-agent/node_modules/playwright-core')
const V=path.resolve('_verify')
;(async()=>{
const b=await chromium.launch({executablePath:'C:/Users/DELL/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',headless:true})
const p=await b.newPage({viewport:{width:1440,height:900}})
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())})
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
// R 键切换
await p.keyboard.press('r')
await p.waitForTimeout(200)
const modeActive=await p.evaluate(()=>Array.from(document.querySelectorAll('.te-toolbar .idphoto-tab')).map(b=>[b.textContent.trim(),b.classList.contains('is-active')]))
console.log('R 键后模式:',JSON.stringify(modeActive))
// 矩形框选（覆盖整段文字）
await p.locator('.te-canvas-wrap').scrollIntoViewIfNeeded();await p.waitForTimeout(200)
const bb=await p.locator('.te-overlay').boundingBox()
const s=(ix,iy)=>({x:bb.x+ix/900*bb.width,y:bb.y+iy/500*bb.height})
await p.mouse.move(s(225,195).x,s(225,195).y);await p.mouse.down()
await p.mouse.move(s(680,305).x,s(680,305).y,{steps:8});await p.mouse.up()
await p.waitForTimeout(300)
console.log('矩形后:',await p.evaluate(()=>({
  undoDisabled:document.querySelectorAll('.te-toolbar .el-button')[0].disabled,
  hex:document.querySelector('.te-hex').textContent,
  fontSize:document.querySelector('.te-value').textContent
})))
// 改参数：宋体 + 旋转 8° + 字号 120% + 左对齐
await p.locator('.option-panel select').nth(0).selectOption('SimSun')
await p.locator('.option-panel input[type=number]').fill('8')
await p.locator('.option-panel input[type=range]').fill('120')
await p.locator('.option-panel select').nth(1).selectOption('left')
await p.locator('.option-panel input[type=text]').fill('改字测试 RECT')
await p.locator('.te-toolbar .el-button--primary').click()
await p.waitForFunction(()=>{const b=document.querySelectorAll('.idphoto-toolbar .idphoto-tab');return b.length>=3&&!b[2].disabled},{timeout:15000})
await p.waitForTimeout(300)
console.log('hints:',await p.evaluate(()=>Array.from(document.querySelectorAll('.idphoto-toolbar .idphoto-hint')).map(e=>e.textContent.trim())))
await p.screenshot({path:path.join(V,'_b1_rect.png'),fullPage:true})
// 已修复态截图
await p.locator('.idphoto-toolbar .idphoto-tab',{hasText:'已修复'}).click();await p.waitForTimeout(300)
await p.locator('.te-canvas-wrap').screenshot({path:path.join(V,'_b1_repaired.png')})
await p.locator('.idphoto-toolbar .idphoto-tab',{hasText:'最终'}).click();await p.waitForTimeout(300)
await p.locator('.te-canvas-wrap').screenshot({path:path.join(V,'_b1_final.png')})
// 清空
await p.locator('.te-toolbar .el-button',{hasText:'清空'}).click();await p.waitForTimeout(200)
console.log('清空后 applyDisabled:',await p.evaluate(()=>document.querySelector('.te-toolbar .el-button--primary').disabled))
console.log('errors:',errs.length?errs.slice(0,3):'none')
await b.close()
})().catch(e=>{console.error(e);process.exit(2)})
