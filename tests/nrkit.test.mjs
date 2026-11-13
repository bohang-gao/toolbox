/**
 * nrkit 算例验证（node 直接跑）
 *
 * 基准来源：
 *   1) 3GPP 公式自证（ARFCN 三段 / GSCN 三段 / N_RB / SLIV）
 *   2) 项目参考脚本 plot_cell_freq_domain.py 的真实输出（三小区）
 */
import {
  arfcnToFreq,
  freqToArfcn,
  gscnToSsRef,
  ssRefToGscn,
  nrbOf,
  ssbBandwidth,
  muOf,
  decodeSliv,
  calcSib1Timing,
  calcCoreset0,
  coreset0Entry,
  pickCoreset0Table,
  ssbSymbolOffset,
  analyzeCell,
  CELL_PRESETS,
  ARFCN_SEGMENTS,
  GSCN_SEGMENTS
} from '../src/views/tools/nrkit.js'

let pass = 0
let fail = 0
const eq = (name, got, want) => {
  if (got === want) pass++
  else {
    fail++
    console.log(`  FAIL ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
  }
}
const near = (name, got, want, tol) => {
  if (Math.abs(Number(got) - want) <= tol) pass++
  else {
    fail++
    console.log(`  FAIL ${name}: got ${got}, want ${want} (tol ${tol})`)
  }
}

// ---------------------------------------------------------------- 1. ARFCN
console.log('== 1. NR-ARFCN 三段换算 ==')
eq('段数', ARFCN_SEGMENTS.length, 3)
near('432000 → MHz', arfcnToFreq(432000).freqMHz, 2160.0, 1e-9)
near('394000 → MHz', arfcnToFreq(394000).freqMHz, 1970.0, 1e-9)
near('1586664 → MHz', arfcnToFreq(1586664).freqMHz, 17799.96, 1e-9)
near('1606664 → MHz', arfcnToFreq(1606664).freqMHz, 18099.96, 1e-9)
// 第三段：规范 F_REF-Offs = 24250 MHz（参考脚本用 24250.08，差 80 kHz）
near('2072499 → MHz（规范）', arfcnToFreq(2072499).freqMHz, 27599.92, 1e-9)
near('2077499 → MHz（规范）', arfcnToFreq(2077499).freqMHz, 27899.92, 1e-9)
eq('600000 段属 FR2', arfcnToFreq(600000).frLabel, 'FR2')
eq('2016667 段属 FR2-2', arfcnToFreq(2016667).frLabel, 'FR2-2')
eq('599999 段属 FR1', arfcnToFreq(599999).frLabel, 'FR1')
near('3000 MHz 边界', arfcnToFreq(600000).freqMHz, 3000, 1e-9)
near('24250 MHz 边界', arfcnToFreq(2016667).freqMHz, 24250, 1e-9)
eq('越界 ARFCN', arfcnToFreq(3279166), null)

console.log('== 2. 频率 → ARFCN ==')
eq('2160 → arfcn', freqToArfcn(2160).arfcn, 432000)
eq('17799.96 → arfcn', freqToArfcn(17799.96).arfcn, 1586664)
eq('2160.0025 → 最近栅格', freqToArfcn(2160.0025).arfcn, 432001)
near('偏差 kHz（最近取整）', freqToArfcn(2160.0025).deltaKHz, -2.5, 1e-6)
near('偏差 kHz（正向）', freqToArfcn(2160.0015).deltaKHz, 1.5, 1e-6)
eq('精确命中', freqToArfcn(2160).isExact, true)
// 往返
for (const n of [0, 1, 599999, 600000, 2016666, 2016667, 3279165]) {
  eq(`往返 ${n}`, freqToArfcn(arfcnToFreq(n).freqMHz).arfcn, n)
}

// ---------------------------------------------------------------- 3. GSCN
console.log('== 3. GSCN 同步栅格 ==')
eq('段数', GSCN_SEGMENTS.length, 3)
near('GSCN 2 → 1.25 MHz', gscnToSsRef(2).freqMHz, 1.25, 1e-9)
eq('GSCN 2 的 M', gscnToSsRef(2).M, 1)
eq('GSCN 3 的 M', gscnToSsRef(3).M, 3)
eq('GSCN 4 的 M', gscnToSsRef(4).M, 5)
near('GSCN 7498 → 2999.05 MHz', gscnToSsRef(7498).freqMHz, 2999.05, 1e-9)
near('GSCN 7499 → 3000 MHz', gscnToSsRef(7499).freqMHz, 3000, 1e-9)
near('GSCN 22256 → 24250.08 MHz', gscnToSsRef(22256).freqMHz, 24250.08, 1e-9)
near('GSCN 22257 → 24250.08 MHz', gscnToSsRef(22257).freqMHz, 24250.08, 1e-9)
eq('越界 GSCN 1', gscnToSsRef(1), null)
eq('越界 GSCN 26640', gscnToSsRef(26640), null)

// 项目三小区 SSB 中心 → GSCN
const g0 = ssRefToGscn(2160.15)
eq('2160.15 → GSCN', g0.gscn, 5400)
eq('GSCN 5400 栅格对齐', g0.inRaster, true)
near('GSCN 5400 反解频率', g0.freqMHz, 2160.15, 1e-9)
const g1 = ssRefToGscn(17793.12)
eq('17793.12 → GSCN', g1.gscn, 17772)
eq('GSCN 17772 栅格对齐', g1.inRaster, true)
const g2 = ssRefToGscn(18104.16)
eq('18104.16 → GSCN', g2.gscn, 17988)
// 往返（三段各取首尾）
for (const g of [2, 3, 5400, 7498, 7499, 17772, 22256, 22257, 26639]) {
  eq(`GSCN 往返 ${g}`, ssRefToGscn(gscnToSsRef(g).freqMHz).gscn, g)
}

// ---------------------------------------------------------------- 4. 带宽
console.log('== 4. N_RB / numerology / SSB ==')
eq('20 MHz/30k', nrbOf(20, 30).nrb, 51)
eq('50 MHz/30k', nrbOf(50, 30).nrb, 133)
eq('100 MHz/30k', nrbOf(100, 30).nrb, 273)
eq('100 MHz/120k', nrbOf(100, 120).nrb, 66)
eq('400 MHz/120k', nrbOf(400, 120).nrb, 264)
eq('50 MHz/120k', nrbOf(50, 120).nrb, 32)
eq('20 MHz/30k 非估算', nrbOf(20, 30).estimated, false)
eq('mu(30)', muOf(30), 1)
eq('mu(120)', muOf(120), 3)
eq('mu(15)', muOf(15), 0)
near('SSB BW 30k', ssbBandwidth(30), 7.2, 1e-9)
near('SSB BW 120k', ssbBandwidth(120), 28.8, 1e-9)

// ---------------------------------------------------------------- 5. 时域
console.log('== 5. SLIV / SIB1 / SSB 符号 ==')
const sl = decodeSliv(53)
eq('SLIV 53 → S', sl.S, 2)
eq('SLIV 53 → L', sl.L, 12)
eq('SLIV 0 → S/L', `${decodeSliv(0).S}/${decodeSliv(0).L}`, '0/1')
eq('SLIV 104 → S/L', `${decodeSliv(104).S}/${decodeSliv(104).L}`, '6/8')
eq('SLIV 27 → S/L', `${decodeSliv(27).S}/${decodeSliv(27).L}`, '0/14')
eq('非法 SLIV', decodeSliv(999), null)
eq('SSB case 3 → 4', ssbSymbolOffset(3), 4)
eq('SSB case 9 → 2', ssbSymbolOffset(9), 2)
eq('SSB case 10 → 2', ssbSymbolOffset(10), 2)
eq('SSB case 1 → 0', ssbSymbolOffset(1), 0)
eq('CORSET 表 30k/30k', pickCoreset0Table(30, 30), '30k')
eq('CORSET 表 120k/120k', pickCoreset0Table(120, 120), '120k')
eq('30k 表 index 2', JSON.stringify(coreset0Entry('30k', 2)), JSON.stringify({ nRb: 24, symbols: 2, rbOffset: 2, reserved: false }))
eq('120k 表 index 3', JSON.stringify(coreset0Entry('120k', 3)), JSON.stringify({ nRb: 48, symbols: 2, rbOffset: 14, reserved: false }))
eq('120k 表保留项', coreset0Entry('120k', 8).reserved, true)

// ---------------------------------------------------------------- 6. 三小区对齐
console.log('== 6. 三小区复算 vs 参考脚本 ==')
const c0 = analyzeCell(CELL_PRESETS.sc)
const c1 = analyzeCell(CELL_PRESETS.ka)
const c2 = analyzeCell(CELL_PRESETS.ka_feeder)

// 小区0（sc, FR1 20 MHz / 30k）
near('c0 DL F_REF', c0.dl.freqMHz, 2160.0, 1e-6)
near('c0 DL Point A', c0.dl.pointAFreq, 2150.82, 1e-6)
eq('c0 DL N_RB', c0.dl.nrb, 51)
near('c0 DL 占用下界', c0.dl.occ[0], 2150.82, 1e-6)
near('c0 DL 占用上界', c0.dl.occ[1], 2169.18, 1e-6)
near('c0 DL 标称下界', c0.dl.nom[0], 2150.0, 1e-6)
near('c0 SSB 中心', c0.ssb.freqMHz, 2160.15, 1e-6)
near('c0 SSB 带宽', c0.ssb.bw, 7.2, 1e-6)
near('c0 SSB 下界', c0.ssb.range[0], 2156.55, 1e-6)
near('c0 SSB 上界', c0.ssb.range[1], 2163.75, 1e-6)
eq('c0 SSB 符号偏移', c0.ssb.symbolOffset, 2)
eq('c0 CORESET#0 表', c0.coreset0.tableKey, '30k')
eq('c0 CORESET#0 RB', c0.coreset0.nRb, 24)
eq('c0 CORESET#0 符号', c0.coreset0.symbols, 2)
eq('c0 CORESET#0 RB 偏移', c0.coreset0.startRb, 13)
near('c0 CORESET#0 起点', c0.coreset0.startF, 2155.5, 1e-6)
near('c0 CORESET#0 终点', c0.coreset0.endF, 2164.14, 1e-6)
eq('c0 n0', c0.sib1.n0, 4)
near('c0 PDCCH 起', c0.sib1.pdcch[0], 2.0, 1e-4)
near('c0 PDCCH 止', c0.sib1.pdcch[1], 2.071, 1e-3)
near('c0 PDSCH 起', c0.sib1.pdsch[0], 2.071, 1e-3)
near('c0 PDSCH 止', c0.sib1.pdsch[1], 2.5, 1e-4)
near('c0 UL F_REF', c0.ul.freqMHz, 1970.0, 1e-6)
near('c0 UL 占用下界', c0.ul.occ[0], 1970 - 9.18, 1e-6)

// 小区1（ka, FR2 100 MHz / 120k）
near('c1 DL F_REF', c1.dl.freqMHz, 17799.96, 1e-6)
near('c1 DL Point A', c1.dl.pointAFreq, 17752.44, 1e-6)
eq('c1 DL N_RB', c1.dl.nrb, 66)
near('c1 SSB 中心', c1.ssb.freqMHz, 17793.12, 1e-6)
near('c1 SSB 带宽', c1.ssb.bw, 28.8, 1e-6)
eq('c1 SSB 符号偏移', c1.ssb.symbolOffset, 2)
eq('c1 CORESET#0 表', c1.coreset0.tableKey, '120k')
eq('c1 CORESET#0 RB', c1.coreset0.nRb, 48)
eq('c1 CORESET#0 RB 偏移', c1.coreset0.startRb, 4)
near('c1 CORESET#0 起点', c1.coreset0.startF, 17758.2, 1e-6)
near('c1 CORESET#0 终点', c1.coreset0.endF, 17827.32, 1e-6)
eq('c1 n0', c1.sib1.n0, 20)
near('c1 PDCCH 起', c1.sib1.pdcch[0], 2.5, 1e-4)
near('c1 PDCCH 止', c1.sib1.pdcch[1], 2.518, 1e-3)
near('c1 PDSCH 止', c1.sib1.pdsch[1], 2.625, 1e-3)
// UL 第三段：规范值 27599.92（脚本 27600.00）
near('c1 UL F_REF（规范）', c1.ul.freqMHz, 27599.92, 1e-6)

// 小区2（ka_feeder, FR2 400 MHz / 120k）
near('c2 DL F_REF', c2.dl.freqMHz, 18099.96, 1e-6)
eq('c2 DL N_RB', c2.dl.nrb, 264)
near('c2 SSB 中心', c2.ssb.freqMHz, 18104.16, 1e-6)
eq('c2 SSB 符号偏移', c2.ssb.symbolOffset, 4)
eq('c2 CORESET#0 RB', c2.coreset0.nRb, 48)
eq('c2 CORESET#0 RB 偏移', c2.coreset0.startRb, 110)
near('c2 CORESET#0 起点', c2.coreset0.startF, 18068.28, 1e-6)
near('c2 CORESET#0 终点', c2.coreset0.endF, 18137.4, 1e-6)
eq('c2 n0', c2.sib1.n0, 0)
near('c2 PDCCH 止', c2.sib1.pdcch[1], 0.018, 1e-3)
near('c2 PDSCH 止', c2.sib1.pdsch[1], 0.125, 1e-3)

// 自检项
eq('c0 Point A 自检', c0.checks.find((c) => c.key === 'pointA').ok, true)
eq('c1 Point A 自检', c1.checks.find((c) => c.key === 'pointA').ok, true)
eq('c2 Point A 自检', c2.checks.find((c) => c.key === 'pointA').ok, true)
eq('c0 SSB 落在载波内', c0.checks.find((c) => c.key === 'ssb-in-carrier').ok, true)
eq('c1 SSB 落在载波内', c1.checks.find((c) => c.key === 'ssb-in-carrier').ok, true)
eq('c2 SSB 落在载波内', c2.checks.find((c) => c.key === 'ssb-in-carrier').ok, true)

// ---------------------------------------------------------------- 7. 反例
console.log('== 7. 反例 ==')
// 把 Point A 改成非占用下界 → 自检应失败
const bad = JSON.parse(JSON.stringify(CELL_PRESETS.sc))
bad.dl.pa = 430000
const cb = analyzeCell(bad)
eq('Point A 不一致自检', cb.checks.find((c) => c.key === 'pointA').ok, false)
// SSB 越界
const bad2 = JSON.parse(JSON.stringify(CELL_PRESETS.sc))
bad2.dl.ssb = 440000
const cb2 = analyzeCell(bad2)
eq('SSB 越界自检', cb2.checks.find((c) => c.key === 'ssb-in-carrier').ok, false)

console.log(`\n===== ${pass} passed, ${fail} failed =====`)
if (fail) process.exit(1)
