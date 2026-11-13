/**
 * ratekit 算例验证（node 直接跑）
 *
 * 基准来源：
 *   1) TS 38.214 表 5.1.3.1-1 ~ -4 的 MCS 值（逐表抽查）
 *   2) TS 38.214 表 5.1.3.2-1 的 93 项 TBS 量化值（结构 + 边界）
 *   3) TBS 确定流程的手算推导（≤3824 与 >3824 两条分支）
 *   4) 273 RB / 30 kHz / MCS27 单层的工程常见配置，对齐业界量级
 */
import {
  MCS_TABLES,
  mcsEntry,
  TBS_TABLE_3824,
  tbsFromNinfo,
  DMRS_RE_PER_SYMBOL,
  dmrsRePerPrb,
  nRePerPrb,
  muOf,
  slotsPerMs,
  slotsPerSecond,
  TDD_PATTERNS,
  autoSchedulingCount,
  calcThroughput,
  formatRate,
  formatByteRate
} from '../src/views/tools/ratekit.js'

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

// ---------------------------------------------------------------- 1. MCS 表
console.log('== 1. MCS 索引表 ==')
eq('表 1 行数', MCS_TABLES[1].rows.length, 29)
eq('表 2 行数', MCS_TABLES[2].rows.length, 28)
eq('表 3 行数', MCS_TABLES[3].rows.length, 29)
eq('表 4 行数', MCS_TABLES[4].rows.length, 27)

// 表 1 抽查
eq('T1 MCS0 Qm', mcsEntry(1, 0).qm, 2)
eq('T1 MCS0 码率', mcsEntry(1, 0).rateX1024, 120)
eq('T1 MCS9 码率', mcsEntry(1, 9).rateX1024, 679)
eq('T1 MCS10 Qm', mcsEntry(1, 10).qm, 4)
eq('T1 MCS17 Qm', mcsEntry(1, 17).qm, 6)
eq('T1 MCS28 码率', mcsEntry(1, 28).rateX1024, 948)
eq('T1 MCS29 越界', mcsEntry(1, 29), null)
near('T1 MCS28 频谱效率', mcsEntry(1, 28).spectralEfficiency, 6 * (948 / 1024), 1e-9)

// 表 2 抽查（含 682.5 / 916.5 两个非整数码率）
eq('T2 MCS0 码率', mcsEntry(2, 0).rateX1024, 120)
eq('T2 MCS1 码率', mcsEntry(2, 1).rateX1024, 193)
eq('T2 MCS20 Qm', mcsEntry(2, 20).qm, 8)
eq('T2 MCS20 码率', mcsEntry(2, 20).rateX1024, 682.5)
eq('T2 MCS26 码率', mcsEntry(2, 26).rateX1024, 916.5)
eq('T2 MCS27 码率', mcsEntry(2, 27).rateX1024, 948)
eq('T2 MCS28 越界', mcsEntry(2, 28), null)

// 表 3 抽查（低码率 64QAM）
eq('T3 MCS0 码率', mcsEntry(3, 0).rateX1024, 30)
eq('T3 MCS14 码率', mcsEntry(3, 14).rateX1024, 602)
eq('T3 MCS15 Qm', mcsEntry(3, 15).qm, 4)
eq('T3 MCS28 码率', mcsEntry(3, 28).rateX1024, 772)

// 表 4 抽查（1024QAM）
eq('T4 MCS2 码率', mcsEntry(4, 2).rateX1024, 449)
eq('T4 MCS22 Qm', mcsEntry(4, 22).qm, 8)
eq('T4 MCS23 Qm', mcsEntry(4, 23).qm, 10)
eq('T4 MCS26 码率', mcsEntry(4, 26).rateX1024, 948)
eq('T4 MCS27 越界', mcsEntry(4, 27), null)

// ---------------------------------------------------------------- 2. TBS 表
console.log('== 2. TBS 量化表（表 5.1.3.2-1）==')
eq('表项数', TBS_TABLE_3824.length, 93)
eq('首项', TBS_TABLE_3824[0], 24)
eq('末项', TBS_TABLE_3824[92], 3824)
let monotonic = true
for (let i = 1; i < TBS_TABLE_3824.length; i += 1) {
  if (TBS_TABLE_3824[i] <= TBS_TABLE_3824[i - 1]) monotonic = false
}
eq('严格递增', monotonic, true)
eq('全部为 8 的倍数', TBS_TABLE_3824.every((v) => v % 8 === 0), true)

// ---------------------------------------------------------------- 3. TBS 计算
console.log('== 3. TBS 确定流程 ==')
// N_info = 100 → n=max(3, 6-6=0)=3, step 8, floor(100/8)*8=96 → 表中 ≥96 的最近值 = 96
const t100 = tbsFromNinfo(100, 0.5)
eq('N_info=100 的 n', t100.n, 3)
eq('N_info=100 的 N_info\'', t100.nInfoPrime, 96)
eq('N_info=100 的 TBS', t100.tbs, 96)

// N_info = 1000 → n=3, floor(1000/8)*8=1000 → 表中 ≥1000 的最近值 = 1032
const t1000 = tbsFromNinfo(1000, 0.5)
eq('N_info=1000 的 N_info\'', t1000.nInfoPrime, 1000)
eq('N_info=1000 的 TBS', t1000.tbs, 1032)

// N_info = 3800 → n=max(3, 11-6=5)=5, step 32, floor(3800/32)*32=3776 → ≥3776 的最近值 = 3824
const t3800 = tbsFromNinfo(3800, 0.5)
eq('N_info=3800 的 n', t3800.n, 5)
eq('N_info=3800 的 N_info\'', t3800.nInfoPrime, 3776)
eq('N_info=3800 的 TBS', t3800.tbs, 3824)

// N_info = 5000, R=0.6 > 0.25：n=floor(log2(4976))-5=12-5=7，step 128
// round(4976/128)=39 → N_info'=4992；C=ceil(5016/8424)=1 → TBS=8*1*ceil(5016/8)-24=4992
const t5000 = tbsFromNinfo(5000, 0.6)
eq('N_info=5000 的 n', t5000.n, 7)
eq('N_info=5000 的 N_info\'', t5000.nInfoPrime, 4992)
eq('N_info=5000 的 C', t5000.C, 1)
eq('N_info=5000 R=0.6 的 TBS', t5000.tbs, 4992)

// 同 N_info 但 R=0.2 ≤ 0.25：C=ceil(5016/3816)=2 → TBS=16*ceil(5016/16)-24=5000
const t5000b = tbsFromNinfo(5000, 0.2)
eq('N_info=5000 R=0.2 的 C', t5000b.C, 2)
eq('N_info=5000 R=0.2 的 TBS', t5000b.tbs, 5000)

// ---------------------------------------------------------------- 4. DMRS / RE
console.log('== 4. DM-RS 开销与 N_RE ==')
eq('type1 每符号 RE', DMRS_RE_PER_SYMBOL[1], 6)
eq('type2 每符号 RE', DMRS_RE_PER_SYMBOL[2], 4)
eq('type1 前置1 附加0 1组', dmrsRePerPrb({ dmrsType: 1, frontSymbols: 1, extraSymbols: 0, cdmGroups: 1 }), 6)
eq('type1 前置2 附加0 1组', dmrsRePerPrb({ dmrsType: 1, frontSymbols: 2, extraSymbols: 0, cdmGroups: 1 }), 12)
eq('type1 前置1 附加2 1组', dmrsRePerPrb({ dmrsType: 1, frontSymbols: 1, extraSymbols: 2, cdmGroups: 1 }), 18)
eq('type2 前置1 附加0 2组', dmrsRePerPrb({ dmrsType: 2, frontSymbols: 1, extraSymbols: 0, cdmGroups: 2 }), 8)
eq('非法 type', dmrsRePerPrb({ dmrsType: 3 }), null)
eq('13 符号 × DMRS 12', nRePerPrb({ nSymb: 13, dmrsRe: 12, xOverhead: 0 }), 144)
eq('12 符号 × DMRS 6 + oh6', nRePerPrb({ nSymb: 12, dmrsRe: 6, xOverhead: 6 }), 132)
eq('极小配置不为负', nRePerPrb({ nSymb: 1, dmrsRe: 18, xOverhead: 0 }), 0)

// ---------------------------------------------------------------- 5. 时域
console.log('== 5. SCS / slot / TDD ==')
eq('mu(15)', muOf(15), 0)
eq('mu(30)', muOf(30), 1)
eq('mu(120)', muOf(120), 3)
eq('30 kHz 每 ms slot', slotsPerMs(30), 2)
eq('30 kHz 每秒 slot', slotsPerSecond(30), 2000)
eq('120 kHz 每秒 slot', slotsPerSecond(120), 8000)

const fdd = autoSchedulingCount({ duplex: 'FDD', direction: 'DL', scs: 30 })
eq('FDD 30k 调度次数', fdd.scheduledPerSecond, 2000)
eq('FDD 占比', fdd.ratio, 1)

const dddSU = TDD_PATTERNS.find((p) => p.key === 'dddSU')
const tddDl = autoSchedulingCount({ duplex: 'TDD', direction: 'DL', scs: 30, pattern: dddSU })
eq('TDD DDDSU 下行占比', tddDl.ratio, 3 / 4)
eq('TDD DDDSU 下行调度次数', tddDl.scheduledPerSecond, 1500)
const tddUl = autoSchedulingCount({ duplex: 'TDD', direction: 'UL', scs: 30, pattern: dddSU })
eq('TDD DDDSU 上行占比', tddUl.ratio, 1 / 4)
eq('TDD DDDSU 上行调度次数', tddUl.scheduledPerSecond, 500)

const withSpecial = autoSchedulingCount({
  duplex: 'TDD',
  direction: 'DL',
  scs: 30,
  pattern: dddSU,
  specialCountsAsDl: true
})
eq('特殊 slot 计入下行占比', withSpecial.ratio, 4 / 5)

// ---------------------------------------------------------------- 6. 综合
console.log('== 6. 综合速率（273 RB / 30 kHz / MCS27 / 13 符号）==')
const r = calcThroughput({
  direction: 'DL',
  duplex: 'FDD',
  scs: 30,
  nSymb: 13,
  nRb: 273,
  mcsTable: 1,
  mcsIndex: 27,
  dmrsType: 1,
  dmrsFrontSymbols: 2,
  dmrsExtraSymbols: 0,
  cdmGroups: 1,
  xOverhead: 0,
  layers: 1
})
eq('无错误', r.error, undefined)
eq('N\'_RE', r.nRePrb, 144)
eq('N_RE', r.nRe, 144 * 273)
eq('Qm', r.mcs.qm, 6)
near('N_info', r.nInfo, 144 * 273 * 6 * (910 / 1024), 1e-6)
eq('TBS', r.tbs, 208976)
eq('每秒调度次数', r.schedulingPerSecond, 2000)
near('TBS 速率 Mbps', r.bitsPerSecond / 1e6, 208976 * 2000 / 1e6, 1e-6)
near('理论速率 Mbps', r.theoreticalBitsPerSecond / 1e6, 419.2, 0.5)
eq('TBS ≤ 理论值', r.bitsPerSecond <= r.theoreticalBitsPerSecond + 1e-6, true)
near('TBS/理论 比值', r.bitsPerSecond / r.theoreticalBitsPerSecond, 0.997, 0.01)
near('占用带宽 MHz', r.occupiedBwMHz, 98.28, 1e-6)
console.log(
  `   → TBS ${r.tbs} bit/slot × ${r.schedulingPerSecond} slot/s = ${formatRate(r.bitsPerSecond)}（理论 ${formatRate(r.theoreticalBitsPerSecond)}）`
)

// 双流应约翻倍
const r2 = calcThroughput({
  direction: 'DL', duplex: 'FDD', scs: 30, nSymb: 13, nRb: 273,
  mcsTable: 1, mcsIndex: 27, dmrsType: 1, dmrsFrontSymbols: 2,
  dmrsExtraSymbols: 0, cdmGroups: 1, xOverhead: 0, layers: 2
})
near('双流速率 ≈ 单流 ×2', r2.bitsPerSecond / r.bitsPerSecond, 2, 0.02)

// TDD 下行应为 FDD 的 3/4
const r3 = calcThroughput({
  direction: 'DL', duplex: 'TDD', scs: 30, nSymb: 13, nRb: 273,
  mcsTable: 1, mcsIndex: 27, dmrsType: 1, dmrsFrontSymbols: 2,
  dmrsExtraSymbols: 0, cdmGroups: 1, xOverhead: 0, layers: 1, pattern: dddSU
})
near('TDD/FDD 速率比', r3.bitsPerSecond / r.bitsPerSecond, 0.75, 1e-9)

// 手动覆盖调度次数
const r4 = calcThroughput({
  direction: 'DL', duplex: 'FDD', scs: 30, nSymb: 13, nRb: 273,
  mcsTable: 1, mcsIndex: 27, dmrsType: 1, dmrsFrontSymbols: 2,
  dmrsExtraSymbols: 0, cdmGroups: 1, xOverhead: 0, layers: 1, schedulingOverride: 1000
})
eq('手动调度次数生效', r4.schedulingPerSecond, 1000)
eq('手动标记', r4.schedulingManual, true)
near('手动速率 = TBS × 1000', r4.bitsPerSecond, r4.tbs * 1000, 1e-6)

// ---------------------------------------------------------------- 7. 反例
console.log('== 7. 反例 ==')
eq('MCS 越界报错', !!calcThroughput({
  direction: 'DL', duplex: 'FDD', scs: 30, nSymb: 13, nRb: 273,
  mcsTable: 2, mcsIndex: 28, dmrsType: 1, dmrsFrontSymbols: 1,
  dmrsExtraSymbols: 0, cdmGroups: 1, xOverhead: 0, layers: 1
}).error, true)
eq('符号数越界报错', !!calcThroughput({
  direction: 'DL', duplex: 'FDD', scs: 30, nSymb: 15, nRb: 273,
  mcsTable: 1, mcsIndex: 10, dmrsType: 1, dmrsFrontSymbols: 1,
  dmrsExtraSymbols: 0, cdmGroups: 1, xOverhead: 0, layers: 1
}).error, true)
eq('DMRS 占满 RE 报错', !!calcThroughput({
  direction: 'DL', duplex: 'FDD', scs: 30, nSymb: 1, nRb: 273,
  mcsTable: 1, mcsIndex: 10, dmrsType: 1, dmrsFrontSymbols: 3,
  dmrsExtraSymbols: 0, cdmGroups: 1, xOverhead: 0, layers: 1
}).error, true)

// ---------------------------------------------------------------- 8. 格式化
console.log('== 8. 格式化 ==')
eq('Gbps', formatRate(417953000), '417.953 Mbps')
eq('Gbps 大值', formatRate(1200000000), '1.2000 Gbps')
eq('MB/s', formatByteRate(52125000), '52.125 MB/s')

console.log(`\n===== ${pass} passed, ${fail} failed =====`)
if (fail) process.exit(1)
