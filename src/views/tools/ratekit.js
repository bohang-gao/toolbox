/**
 * 5G NR 速率（吞吐）计算库（编排者自持；页面只允许 import 调用，不得修改）
 *
 * 依据：
 *   TS 38.214 §5.1.3.1  Table 5.1.3.1-1/-2/-3/-4  MCS 索引表
 *   TS 38.214 §5.1.3.2  TBS 确定流程与 Table 5.1.3.2-1（N_info ≤ 3824 量化表）
 *   TS 38.214 §6.1.4.2  PUSCH 的 TBS 确定（同流程）
 *   TS 38.211 §4.2      numerology μ 与 slot 长度
 *   TS 38.211 §7.4.1.1  DM-RS 每符号每 RB 的 RE 数（type1 = 6，type2 = 4）
 *   TS 38.213 §11.1     TDD 上下行配置
 *
 * 纯函数，无外部依赖。
 */

// ===========================================================================
// 1. MCS 索引表（TS 38.214 表 5.1.3.1-1 ~ -4）
//    每项 [Qm, 目标码率 × 1024]
// ===========================================================================

const T1 = [
  [2, 120], [2, 157], [2, 193], [2, 251], [2, 308], [2, 379], [2, 449], [2, 526], [2, 602], [2, 679],
  [4, 340], [4, 378], [4, 434], [4, 490], [4, 553], [4, 616], [4, 658],
  [6, 438], [6, 466], [6, 517], [6, 567], [6, 616], [6, 666], [6, 719], [6, 772], [6, 822], [6, 873], [6, 910], [6, 948]
]

const T2 = [
  [2, 120], [2, 193], [2, 308], [2, 449], [2, 602],
  [4, 378], [4, 434], [4, 490], [4, 553], [4, 616], [4, 658],
  [6, 466], [6, 517], [6, 567], [6, 616], [6, 666], [6, 719], [6, 772], [6, 822], [6, 873],
  [8, 682.5], [8, 711], [8, 754], [8, 797], [8, 841], [8, 885], [8, 916.5], [8, 948]
]

const T3 = [
  [2, 30], [2, 40], [2, 50], [2, 64], [2, 78], [2, 99], [2, 120], [2, 157], [2, 193], [2, 251],
  [2, 308], [2, 379], [2, 449], [2, 526], [2, 602],
  [4, 340], [4, 378], [4, 434], [4, 490], [4, 553], [4, 616],
  [6, 438], [6, 466], [6, 517], [6, 567], [6, 616], [6, 666], [6, 719], [6, 772]
]

const T4 = [
  [2, 120], [2, 193], [2, 449],
  [4, 378], [4, 490], [4, 616],
  [6, 466], [6, 517], [6, 567], [6, 616], [6, 666], [6, 719], [6, 772], [6, 822], [6, 873],
  [8, 682.5], [8, 711], [8, 754], [8, 797], [8, 841], [8, 885], [8, 916.5], [8, 948],
  [10, 805.5], [10, 853], [10, 900.5], [10, 948]
]

export const MCS_TABLES = {
  1: { key: 1, rows: T1, label: '表 1（最高 64QAM，5.1.3.1-1）', maxIndex: 28 },
  2: { key: 2, rows: T2, label: '表 2（最高 256QAM，5.1.3.1-2）', maxIndex: 27 },
  3: { key: 3, rows: T3, label: '表 3（低码率 64QAM，5.1.3.1-3）', maxIndex: 28 },
  4: { key: 4, rows: T4, label: '表 4（最高 1024QAM，5.1.3.1-4）', maxIndex: 26 }
}

/**
 * 取 MCS 表项
 * @returns {{qm:number, rateX1024:number, rate:number, spectralEfficiency:number}|null}
 */
export function mcsEntry(tableKey, mcsIndex) {
  const t = MCS_TABLES[Number(tableKey)]
  if (!t) return null
  const i = Number(mcsIndex)
  if (!Number.isInteger(i) || i < 0 || i >= t.rows.length) return null
  const [qm, rateX1024] = t.rows[i]
  const rate = rateX1024 / 1024
  return { qm, rateX1024, rate, spectralEfficiency: qm * rate }
}

// ===========================================================================
// 2. TS 38.214 表 5.1.3.2-1（N_info ≤ 3824 的 TBS 量化表，共 93 项）
// ===========================================================================

export const TBS_TABLE_3824 = [
  24, 32, 40, 48, 56, 64, 72, 80, 88, 96,
  104, 112, 120, 128, 136, 144, 152, 160, 168, 176,
  184, 192, 208, 224, 240, 256, 272, 288, 304, 320,
  336, 352, 368, 384, 408, 432, 456, 480, 504, 528,
  552, 576, 608, 640, 672, 704, 736, 768, 808, 848,
  888, 928, 984, 1032, 1064, 1128, 1160, 1192, 1224, 1256,
  1288, 1320, 1352, 1416, 1480, 1544, 1608, 1672, 1736, 1800,
  1864, 1928, 2024, 2088, 2152, 2216, 2280, 2408, 2472, 2536,
  2600, 2664, 2728, 2792, 2856, 2976, 3104, 3240, 3368, 3496,
  3624, 3752, 3824
]

/**
 * TBS 确定（TS 38.214 §5.1.3.2）
 * @param {number} nInfo  中间信息比特数 N_info = N_RE × R × Qm × v
 * @param {number} rate   目标码率 R（0~1）
 * @returns {{tbs:number, nInfo:number, nInfoPrime:number, n:number, C:number|null, branch:string}}
 */
export function tbsFromNinfo(nInfo, rate) {
  const N = Number(nInfo)
  if (!Number.isFinite(N) || N <= 0) return null

  if (N <= 3824) {
    const n = Math.max(3, Math.floor(Math.log2(N)) - 6)
    const step = 2 ** n
    const nInfoPrime = Math.max(24, step * Math.floor(N / step))
    // 表 5.1.3.2-1 中「不小于 N_info' 的最近 TBS」
    let tbs = TBS_TABLE_3824[TBS_TABLE_3824.length - 1]
    for (const v of TBS_TABLE_3824) {
      if (v >= nInfoPrime) {
        tbs = v
        break
      }
    }
    return { tbs, nInfo: N, nInfoPrime, n, C: null, branch: 'N_info ≤ 3824（查表 5.1.3.2-1）' }
  }

  const n = Math.floor(Math.log2(N - 24)) - 5
  const step = 2 ** n
  const nInfoPrime = step * Math.round((N - 24) / step)
  const C = rate <= 0.25 ? Math.ceil((nInfoPrime + 24) / 3816) : Math.ceil((nInfoPrime + 24) / 8424)
  const tbs = 8 * C * Math.ceil((nInfoPrime + 24) / (8 * C)) - 24
  return { tbs, nInfo: N, nInfoPrime, n, C, branch: 'N_info > 3824（分段公式）' }
}

// ===========================================================================
// 3. DM-RS 开销与 N_RE
// ===========================================================================

/** DM-RS 每符号每 RB 每 CDM 组的 RE 数（TS 38.211 §7.4.1.1） */
export const DMRS_RE_PER_SYMBOL = { 1: 6, 2: 4 }

/**
 * N_DMRS_PRB：每 PRB 在调度时长内被 DM-RS 占用的 RE 数
 * （含无数据的 CDM 组开销）
 */
export function dmrsRePerPrb({ dmrsType = 1, frontSymbols = 1, extraSymbols = 0, cdmGroups = 1 }) {
  const per = DMRS_RE_PER_SYMBOL[Number(dmrsType)]
  if (!per) return null
  const symbols = Number(frontSymbols) + Number(extraSymbols)
  const groups = Number(cdmGroups)
  if (symbols < 0 || groups < 1) return null
  return per * symbols * groups
}

/** N'_RE = 12 × N_sh_symb − N_DMRS − N_oh */
export function nRePerPrb({ nSymb, dmrsRe, xOverhead = 0 }) {
  const v = 12 * Number(nSymb) - Number(dmrsRe) - Number(xOverhead)
  return v > 0 ? v : 0
}

// ===========================================================================
// 4. 时域：SCS / slot / TDD 配比
// ===========================================================================

export const SCS_TO_MU = { 15: 0, 30: 1, 60: 2, 120: 3, 240: 4, 480: 5, 960: 6 }
export const SCS_LIST = [15, 30, 60, 120, 240, 480, 960]

export function muOf(scsKHz) {
  const v = SCS_TO_MU[Number(scsKHz)]
  return v === undefined ? null : v
}

/** 每毫秒的 slot 数（= 2^μ） */
export function slotsPerMs(scsKHz) {
  const mu = muOf(scsKHz)
  return mu === null ? null : 2 ** mu
}

/** 每秒 slot 数 */
export function slotsPerSecond(scsKHz) {
  const spm = slotsPerMs(scsKHz)
  return spm === null ? null : spm * 1000
}

/**
 * 常见 TDD 上下行配置（TS 38.213 §11.1 的常用图案）
 * special 为特殊 slot（S），默认不计入某一方向的调度次数
 */
export const TDD_PATTERNS = [
  { key: 'dddSU', label: 'DDDSU（2.5 ms，3D:1S:1U）', dl: 3, ul: 1, special: 1 },
  { key: 'ddsuu', label: 'DDSUU（2.5 ms，2D:1S:2U）', dl: 2, ul: 2, special: 1 },
  { key: 'dddddddSUU', label: 'DDDDDDDSUU（5 ms，7D:1S:2U）', dl: 7, ul: 2, special: 1 },
  { key: 'ddddsuuuu', label: 'DDDDSUUUU（5 ms，4D:1S:4U）', dl: 4, ul: 4, special: 1 },
  { key: 'd1u1', label: '1:1（D:U，无特殊 slot）', dl: 1, ul: 1, special: 0 },
  { key: 'd3u1', label: '3:1（D:U，无特殊 slot）', dl: 3, ul: 1, special: 0 },
  { key: 'd7u3', label: '7:3（D:U，无特殊 slot）', dl: 7, ul: 3, special: 0 }
]

/**
 * 按双工方式自动算每秒可调度次数
 * @param {object} o
 * @param {'FDD'|'TDD'} o.duplex
 * @param {'DL'|'UL'} o.direction
 * @param {number} o.scs  子载波间隔 kHz
 * @param {{dl:number, ul:number, special:number}} [o.pattern] TDD 配比
 * @param {boolean} [o.specialCountsAsDl] 特殊 slot 是否计入下行
 * @returns {{scheduledPerSecond:number, slotsPerSecond:number, ratio:number, detail:string}}
 */
export function autoSchedulingCount({ duplex, direction, scs, pattern, specialCountsAsDl = false }) {
  const sps = slotsPerSecond(scs)
  if (sps === null) return null
  if (String(duplex).toUpperCase() === 'FDD') {
    return {
      scheduledPerSecond: sps,
      slotsPerSecond: sps,
      ratio: 1,
      detail: `FDD：全时隙均可用，${sps} slot/s`
    }
  }
  if (!pattern) return null
  const dl = Number(pattern.dl) + (specialCountsAsDl ? Number(pattern.special || 0) : 0)
  const ul = Number(pattern.ul)
  const total = dl + ul
  if (total <= 0) return null
  const ratio = String(direction).toUpperCase() === 'UL' ? ul / total : dl / total
  const scheduled = sps * ratio
  return {
    scheduledPerSecond: scheduled,
    slotsPerSecond: sps,
    ratio,
    detail: `TDD：${dl}D : ${ul}U（特殊 slot ${pattern.special || 0} 个${specialCountsAsTxt(specialCountsAsDl)}），可用占比 ${(ratio * 100).toFixed(2)}%，${scheduled.toFixed(1)} slot/s`
  }
}

function specialCountsAsTxt(flag) {
  return flag ? '计入下行' : '不计入'
}

// ===========================================================================
// 5. 综合计算
// ===========================================================================

/**
 * 计算每秒速率
 *
 * @param {object} o
 * @param {'DL'|'UL'} o.direction     下行 / 上行
 * @param {'FDD'|'TDD'} o.duplex
 * @param {number} o.scs              子载波间隔 kHz
 * @param {number} o.nSymb            每 slot 分配的符号数 N_sh_symb（1~14）
 * @param {number} o.nRb              分配 PRB 数 n_PRB
 * @param {number} o.mcsTable         MCS 表号 1~4
 * @param {number} o.mcsIndex         MCS 索引
 * @param {number} o.dmrsType         1 / 2
 * @param {number} o.dmrsFrontSymbols 前置 DM-RS 符号数
 * @param {number} o.dmrsExtraSymbols 附加 DM-RS 符号数
 * @param {number} o.cdmGroups        无数据的 CDM 组数
 * @param {number} o.xOverhead        高层开销 N_oh（0/6/12/18）
 * @param {number} o.layers           层数 v
 * @param {number|null} o.schedulingOverride 手动指定的每秒调度次数（null = 自动）
 * @param {object} [o.pattern]        TDD 配比
 * @param {boolean} [o.specialCountsAsDl]
 */
export function calcThroughput(o) {
  const mcs = mcsEntry(o.mcsTable, o.mcsIndex)
  if (!mcs) return { error: 'MCS 索引超出所选表的有效范围' }

  const mu = muOf(o.scs)
  if (mu === null) return { error: '子载波间隔不支持' }

  const nSymb = Number(o.nSymb)
  if (!Number.isInteger(nSymb) || nSymb < 1 || nSymb > 14) {
    return { error: '每 slot 符号数必须是 1 ~ 14 的整数' }
  }
  const nRb = Number(o.nRb)
  if (!Number.isInteger(nRb) || nRb < 1) return { error: 'PRB 数必须是正整数' }

  const layers = Number(o.layers)
  if (!Number.isInteger(layers) || layers < 1) return { error: '层数必须是正整数' }

  const dmrsRe = dmrsRePerPrb({
    dmrsType: o.dmrsType,
    frontSymbols: o.dmrsFrontSymbols,
    extraSymbols: o.dmrsExtraSymbols,
    cdmGroups: o.cdmGroups
  })
  if (dmrsRe === null) return { error: 'DM-RS 参数不合法' }

  const nRePrbRaw = nRePerPrb({ nSymb, dmrsRe, xOverhead: o.xOverhead })
  if (nRePrbRaw <= 0) return { error: 'DM-RS 与开销占满了所有 RE，请检查符号数与 DM-RS 配置' }

  const nRePrb = Math.min(156, nRePrbRaw)
  const nRe = nRePrb * nRb
  const nInfo = nRe * mcs.rate * mcs.qm * layers
  const tbsRes = tbsFromNinfo(nInfo, mcs.rate)

  const sps = slotsPerSecond(o.scs)
  const auto = autoSchedulingCount({
    duplex: o.duplex,
    direction: o.direction,
    scs: o.scs,
    pattern: o.pattern,
    specialCountsAsDl: o.specialCountsAsDl
  })
  const manual = o.schedulingOverride != null && Number.isFinite(Number(o.schedulingOverride))
  const scheduled = manual ? Number(o.schedulingOverride) : auto ? auto.scheduledPerSecond : null
  if (scheduled === null) return { error: '无法确定每秒调度次数，请手动填写' }

  const slotMs = 1 / 2 ** mu
  const bitsPerSecond = tbsRes.tbs * scheduled
  const theoreticalBitsPerSecond = nInfo * scheduled

  return {
    mcs,
    mu,
    slotMs,
    nSymb,
    nRb,
    layers,
    dmrsRe,
    nRePrbRaw,
    nRePrb,
    nRe,
    nInfo,
    tbs: tbsRes.tbs,
    tbsBranch: tbsRes.branch,
    nInfoPrime: tbsRes.nInfoPrime,
    codeBlocks: tbsRes.C,
    slotsPerSecond: sps,
    schedulingPerSecond: scheduled,
    schedulingManual: manual,
    schedulingDetail: manual ? '手动输入' : auto ? auto.detail : '—',
    dutyRatio: manual || !auto ? null : auto.ratio,
    bitsPerSecond,
    theoreticalBitsPerSecond,
    bytesPerSecond: bitsPerSecond / 8,
    /** 频谱效率（bit/s/Hz）：按占用带宽 BW = nRb × 12 × SCS 估算 */
    occupiedBwMHz: (nRb * 12 * Number(o.scs)) / 1000,
    spectralEfficiency: bitsPerSecond / ((nRb * 12 * Number(o.scs)) * 1e3)
  }
}

// ===========================================================================
// 6. 展示辅助
// ===========================================================================

/** 比特率自适应单位 */
export function formatRate(bps) {
  const v = Number(bps)
  if (!Number.isFinite(v)) return '—'
  if (v >= 1e9) return `${(v / 1e9).toFixed(4)} Gbps`
  if (v >= 1e6) return `${(v / 1e6).toFixed(3)} Mbps`
  if (v >= 1e3) return `${(v / 1e3).toFixed(3)} kbps`
  return `${v.toFixed(0)} bps`
}

/** 字节速率 */
export function formatByteRate(bytesPerSecond) {
  const v = Number(bytesPerSecond)
  if (!Number.isFinite(v)) return '—'
  if (v >= 1e9) return `${(v / 1e9).toFixed(4)} GB/s`
  if (v >= 1e6) return `${(v / 1e6).toFixed(3)} MB/s`
  if (v >= 1e3) return `${(v / 1e3).toFixed(3)} kB/s`
  return `${v.toFixed(0)} B/s`
}

/** 千分位分组（窄空格） */
export function groupNumber(v, digits = 0) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return n
    .toFixed(digits)
    .replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009')
}
