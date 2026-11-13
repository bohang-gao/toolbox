/**
 * 5G NR 射频换算算法库（编排者自持；各工具页面只允许 import 调用，不得修改）
 *
 * 依据：
 *   TS 38.104 Table 5.4.2.1-1  NR-ARFCN 全局频率栅格
 *   TS 38.104 Table 5.4.3.1-1  GSCN / 同步栅格
 *   TS 38.101-1 / 38.101-2 Table 5.3.2-1  传输带宽配置 N_RB
 *   TS 38.211 Table 4.2-1      numerology μ
 *   TS 38.213 Table 13-4/13-8  CORESET#0 复用样式
 *   TS 38.213 Table 13-11/13-12 Type0-PDCCH CSS 监测时机
 *   TS 38.214 Table 5.1.2.1-1  SLIV
 *
 * 纯函数、无外部依赖、无副作用（除控制台外不产生 IO）。
 */

// ===========================================================================
// 1. NR-ARFCN（TS 38.104 表 5.4.2.1-1）
// ===========================================================================

/**
 * 三段全局频率栅格。
 * f = fRefOffs + deltaF_kHz * (n - nRefOffs) / 1000   （单位 MHz）
 */
export const ARFCN_SEGMENTS = [
  {
    key: 'fr1',
    label: 'FR1（0 – 3 GHz）',
    fMin: 0,
    fMax: 3000,
    deltaFKHz: 5,
    nMin: 0,
    nMax: 599999,
    fRefOffs: 0,
    nRefOffs: 0,
    frLabel: 'FR1'
  },
  {
    key: 'fr2',
    label: 'FR2（3 – 24.25 GHz）',
    fMin: 3000,
    fMax: 24250,
    deltaFKHz: 15,
    nMin: 600000,
    nMax: 2016666,
    fRefOffs: 3000,
    nRefOffs: 600000,
    frLabel: 'FR2'
  },
  {
    key: 'fr2-2',
    label: 'FR2-2（24.25 – 100 GHz）',
    fMin: 24250,
    fMax: 100000,
    deltaFKHz: 60,
    nMin: 2016667,
    nMax: 3279165,
    fRefOffs: 24250,
    nRefOffs: 2016667,
    frLabel: 'FR2-2'
  }
]

export const ARFCN_MIN = 0
export const ARFCN_MAX = 3279165

/** 返回频率所属的 ARFCN 段；频率范围外返回 null */
export function arfcnSegmentOfFreq(freqMHz) {
  const f = Number(freqMHz)
  if (!Number.isFinite(f) || f < 0 || f > 100000) return null
  if (f < 3000) return ARFCN_SEGMENTS[0]
  if (f < 24250) return ARFCN_SEGMENTS[1]
  return ARFCN_SEGMENTS[2]
}

/** 返回 ARFCN 所属的段；越界返回 null */
export function arfcnSegmentOf(arfcn) {
  const n = Number(arfcn)
  if (!Number.isInteger(n) || n < ARFCN_MIN || n > ARFCN_MAX) return null
  if (n <= 599999) return ARFCN_SEGMENTS[0]
  if (n <= 2016666) return ARFCN_SEGMENTS[1]
  return ARFCN_SEGMENTS[2]
}

/**
 * ARFCN → 频率
 * @returns {{arfcn:number, freqMHz:number, segment:object, frLabel:string}|null}
 */
export function arfcnToFreq(arfcn) {
  const seg = arfcnSegmentOf(arfcn)
  if (!seg) return null
  const n = Number(arfcn)
  const freqMHz = seg.fRefOffs + (seg.deltaFKHz * (n - seg.nRefOffs)) / 1000
  return { arfcn: n, freqMHz, segment: seg, frLabel: seg.frLabel }
}

/**
 * 频率 → ARFCN（取最近栅格点）
 * @returns {{arfcn:number, exact:number, freqMHz:number, snappedMHz:number,
 *            deltaKHz:number, isExact:boolean, segment:object}|null}
 */
export function freqToArfcn(freqMHz) {
  const f = Number(freqMHz)
  const seg = arfcnSegmentOfFreq(f)
  if (!seg) return null
  const exact = seg.nRefOffs + ((f - seg.fRefOffs) * 1000) / seg.deltaFKHz
  let snapped = Math.round(exact)
  snapped = Math.min(Math.max(snapped, seg.nMin), seg.nMax)
  const snappedMHz = seg.fRefOffs + (seg.deltaFKHz * (snapped - seg.nRefOffs)) / 1000
  const deltaKHz = (f - snappedMHz) * 1000
  return {
    arfcn: snapped,
    exact,
    freqMHz: f,
    snappedMHz,
    deltaKHz,
    isExact: Math.abs(deltaKHz) < 1e-6,
    segment: seg
  }
}

// ===========================================================================
// 2. GSCN / 同步栅格（TS 38.104 表 5.4.3.1-1）
// ===========================================================================

export const GSCN_SEGMENTS = [
  {
    key: 'g1',
    label: '0 – 3 GHz',
    gMin: 2,
    gMax: 7498,
    fMin: 0,
    fMax: 3000,
    formula: 'SS_REF = N × 1.2 MHz + M × 0.05 MHz，M ∈ {1,3,5}；GSCN = 3N + (M−3)/2'
  },
  {
    key: 'g2',
    label: '3 – 24.25 GHz',
    gMin: 7499,
    gMax: 22256,
    fMin: 3000,
    fMax: 24250.08,
    formula: 'SS_REF = 3000 MHz + N × 1.44 MHz；GSCN = 7499 + N'
  },
  {
    key: 'g3',
    label: '24.25 – 100 GHz',
    gMin: 22257,
    gMax: 26639,
    fMin: 24250.08,
    fMax: 100000,
    formula: 'SS_REF = 24250.08 MHz + N × 17.28 MHz；GSCN = 22257 + N'
  }
]

export const GSCN_MIN = 2
export const GSCN_MAX = 26639

export function gscnSegmentOf(gscn) {
  const g = Number(gscn)
  if (!Number.isInteger(g) || g < GSCN_MIN || g > GSCN_MAX) return null
  if (g <= 7498) return GSCN_SEGMENTS[0]
  if (g <= 22256) return GSCN_SEGMENTS[1]
  return GSCN_SEGMENTS[2]
}

/**
 * GSCN → 同步栅格频点 SS_REF
 * @returns {{gscn:number, freqMHz:number, N:number, M:number|null,
 *            segment:object}|null}
 */
export function gscnToSsRef(gscn) {
  const g = Number(gscn)
  const seg = gscnSegmentOf(g)
  if (!seg) return null
  if (seg.key === 'g1') {
    const N = Math.floor((g + 1) / 3)
    const k = g - 3 * N // −1 / 0 / 1
    const M = 3 + 2 * k // 1 / 3 / 5
    return { gscn: g, freqMHz: N * 1.2 + M * 0.05, N, M, segment: seg }
  }
  if (seg.key === 'g2') {
    const N = g - 7499
    return { gscn: g, freqMHz: 3000 + N * 1.44, N, M: null, segment: seg }
  }
  const N = g - 22257
  return { gscn: g, freqMHz: 24250.08 + N * 17.28, N, M: null, segment: seg }
}

/**
 * 频率 → 最近 GSCN
 * 第一段同步栅格按 1.2 MHz 分组、组内 100 kHz 细粒度，组间有空洞，
 * 因此同时返回前后候选，供页面提示「落在栅格空洞」。
 * @returns {{gscn:number, freqMHz:number, deltaKHz:number, N:number, M:number|null,
 *            segment:object, candidates:Array<{gscn:number,freqMHz:number}>,
 *            inRaster:boolean}|null}
 */
export function ssRefToGscn(freqMHz) {
  const f = Number(freqMHz)
  if (!Number.isFinite(f) || f < 0 || f > 100000) return null
  const IN_RASTER_TOL = 1e-3 // kHz

  if (f < 3000) {
    const seg = GSCN_SEGMENTS[0]
    const N0 = Math.floor(f / 1.2)
    const cands = []
    for (let N = Math.max(1, N0 - 1); N <= N0 + 1; N += 1) {
      for (const M of [1, 3, 5]) {
        const gscn = 3 * N + (M - 3) / 2
        if (gscn < GSCN_MIN || gscn > seg.gMax) continue
        const fv = N * 1.2 + M * 0.05
        cands.push({ gscn, freqMHz: fv, N, M })
      }
    }
    if (!cands.length) return null
    cands.sort((a, b) => Math.abs(a.freqMHz - f) - Math.abs(b.freqMHz - f))
    const best = cands[0]
    const deltaKHz = (f - best.freqMHz) * 1000
    return {
      gscn: best.gscn,
      freqMHz: best.freqMHz,
      deltaKHz,
      N: best.N,
      M: best.M,
      segment: seg,
      candidates: cands.slice(0, 4).map((c) => ({ gscn: c.gscn, freqMHz: c.freqMHz })),
      inRaster: Math.abs(deltaKHz) < 1e-3
    }
  }

  if (f < 24250.08) {
    const seg = GSCN_SEGMENTS[1]
    const N = Math.round((f - 3000) / 1.44)
    const gscn = 7499 + N
    if (gscn < seg.gMin || gscn > seg.gMax) return null
    const fv = 3000 + N * 1.44
    const deltaKHz = (f - fv) * 1000
    return {
      gscn,
      freqMHz: fv,
      deltaKHz,
      N,
      M: null,
      segment: seg,
      candidates: [{ gscn, freqMHz: fv }],
      inRaster: Math.abs(deltaKHz) < IN_RASTER_TOL
    }
  }

  const seg = GSCN_SEGMENTS[2]
  const N = Math.round((f - 24250.08) / 17.28)
  const gscn = 22257 + N
  if (gscn < seg.gMin || gscn > seg.gMax) return null
  const fv = 24250.08 + N * 17.28
  const deltaKHz = (f - fv) * 1000
  return {
    gscn,
    freqMHz: fv,
    deltaKHz,
    N,
    M: null,
    segment: seg,
    candidates: [{ gscn, freqMHz: fv }],
    inRaster: Math.abs(deltaKHz) < IN_RASTER_TOL
  }
}

// ===========================================================================
// 3. numerology 与带宽配置
// ===========================================================================

/** TS 38.211 表 4.2-1 */
export const SCS_TO_MU = { 15: 0, 30: 1, 60: 2, 120: 3, 240: 4, 480: 5, 960: 6 }
export const SCS_LIST = [15, 30, 60, 120, 240, 480, 960]

export function muOf(scsKHz) {
  const v = SCS_TO_MU[Number(scsKHz)]
  return v === undefined ? null : v
}

/** TS 38.101-1 表 5.3.2-1（FR1） */
export const NRB_TABLE_FR1 = {
  3: { 15: 15 },
  5: { 15: 25, 30: 11 },
  10: { 15: 52, 30: 24, 60: 11 },
  15: { 15: 79, 30: 38, 60: 18 },
  20: { 15: 106, 30: 51, 60: 24 },
  25: { 15: 133, 30: 65, 60: 31 },
  30: { 15: 160, 30: 78, 60: 38 },
  35: { 15: 188, 30: 92, 60: 44 },
  40: { 15: 216, 30: 106, 60: 51 },
  45: { 15: 242, 30: 119, 60: 58 },
  50: { 15: 270, 30: 133, 60: 65 },
  60: { 30: 162, 60: 79 },
  70: { 30: 189, 60: 93 },
  80: { 30: 217, 60: 107 },
  90: { 30: 245, 60: 121 },
  100: { 30: 273, 60: 135 }
}

/** TS 38.101-2 表 5.3.2-1（FR2 / FR2-2） */
export const NRB_TABLE_FR2 = {
  50: { 60: 66, 120: 32 },
  100: { 60: 132, 120: 66 },
  200: { 60: 264, 120: 132 },
  400: { 120: 264, 480: 66, 960: 33 },
  800: { 480: 124, 960: 62 },
  1600: { 480: 248, 960: 124 },
  2000: { 960: 148 }
}

/**
 * 传输带宽配置 N_RB
 * 查表失败时按「带宽 / 1 RB 带宽」估算，并返回 estimated=true 供页面提示
 */
export function nrbOf(bwMHz, scsKHz) {
  const bw = Number(bwMHz)
  const scs = Number(scsKHz)
  const table = bw >= 50 && scs >= 60 ? { ...NRB_TABLE_FR1, ...NRB_TABLE_FR2 } : NRB_TABLE_FR1
  const hit = table[bw] && table[bw][scs]
  if (hit) return { nrb: hit, estimated: false }
  const rbBw = (scs * 12) / 1000
  return { nrb: Math.round(bw / rbBw), estimated: true }
}

/** SSB 带宽：固定 20 RB = 240 子载波 */
export function ssbBandwidth(scsKHz) {
  return (240 * Number(scsKHz)) / 1000
}

// ===========================================================================
// 4. 时域：SSB 符号偏移 / SLIV / Type0-PDCCH CSS
// ===========================================================================

/**
 * SSB #0 起始符号（项目 nr_gnb_mac_fapi_struct_convertor.cpp 约定）
 * case 3（120k）→ 4；case 7~10 → 2；其余 → 0
 */
export function ssbSymbolOffset(ssbCase) {
  const c = Number(ssbCase)
  if (c === 3) return 4
  if (c === 7 || c === 8 || c === 9 || c === 10) return 2
  return 0
}

/**
 * SLIV → { S, L }（TS 38.214 表 5.1.2.1-1）
 * @returns {{S:number,L:number}|null}
 */
export function decodeSliv(sliv) {
  const v = Number(sliv)
  if (!Number.isInteger(v) || v < 0) return null
  for (let L = 1; L <= 14; L += 1) {
    for (let S = 0; S <= 14 - L; S += 1) {
      const val = L - 1 <= 7 ? 14 * (L - 1) + S : 14 * (15 - L) + 13 - S
      if (val === v) return { S, L }
    }
  }
  return null
}

const SIB1_FR1 = {
  o: [0, 0, 2, 2, 5, 5, 7, 7, 0, 5, 0, 0, 2, 2, 5, 5],
  m: [1, 2, 1, 2, 1, 2, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1],
  firstSym: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 2, 1, 2]
}
const SIB1_FR2 = {
  o: [0, 0, 2.5, 2.5, 5, 5, 0, 2.5, 5, 7.5, 7.5, 7.5, 0, 5, 0, 0],
  m: [1, 2, 1, 2, 1, 2, 2, 2, 2, 1, 2, 2, 1, 1, 1, 1],
  firstSym: null
}

/**
 * Type0-PDCCH CSS / SIB1 时域位置
 * @param {{fr:string, mu:number, searchSpaceZero:number, sliv:number, coresetSymbols:number}} o
 */
export function calcSib1Timing({ fr, mu, searchSpaceZero, sliv, coresetSymbols }) {
  const isFr1 = String(fr || '').toUpperCase().startsWith('FR1')
  const tbl = isFr1 ? SIB1_FR1 : SIB1_FR2
  const idx = Number(searchSpaceZero)
  if (!Number.isInteger(idx) || idx < 0 || idx > 15) return null
  const slotMs = 1 / 2 ** Number(mu)
  const slotsPerFrame = 10 * 2 ** Number(mu)
  const ssbIndex = 0
  const n0 = Math.round(tbl.o[idx] * 2 ** Number(mu) + ssbIndex * tbl.m[idx]) % slotsPerFrame
  const firstSym = isFr1 ? tbl.firstSym[idx] : 0

  const slotStart = n0 * slotMs
  const symMs = slotMs / 14
  const pdcch = [slotStart + firstSym * symMs, slotStart + (firstSym + Number(coresetSymbols)) * symMs]

  const sl = decodeSliv(sliv)
  let pdsch = null
  if (sl) {
    pdsch = [slotStart + sl.S * symMs, slotStart + (sl.S + sl.L) * symMs]
  }
  return {
    n0,
    slotMs,
    slotsPerFrame,
    firstSym,
    pdcch,
    sliv: sl,
    pdsch,
    monitoring: [n0, (n0 + 1) % slotsPerFrame]
  }
}

// ===========================================================================
// 5. CORESET#0（TS 38.213 表 13-4 / 13-8）
// ===========================================================================

export const CORESET0_TABLE_30K = [
  [24, 2, 0], [24, 2, 1], [24, 2, 2], [24, 2, 3], [24, 2, 4],
  [24, 3, 0], [24, 3, 1], [24, 3, 2], [24, 3, 3], [24, 3, 4],
  [48, 1, 12], [48, 1, 14], [48, 1, 16], [48, 2, 12], [48, 2, 14], [48, 2, 16]
]

export const CORESET0_TABLE_120K = [
  [24, 2, 0], [24, 2, 4], [48, 1, 14], [48, 2, 14],
  [24, 2, -20], [24, 2, 24], [48, 2, -20], [48, 2, 48],
  [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0],
  [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]
]

/**
 * 选择 CORESET#0 表：SSB 与 DL 均为 ≥120 kHz 时用 120k 表，否则用 30k 表。
 * （与项目脚本按 band==512 判定的结果一致；页面可显式覆盖。）
 */
export function pickCoreset0Table(dlScs, ssbScs) {
  return Number(dlScs) >= 120 && Number(ssbScs) >= 120 ? '120k' : '30k'
}

/** @returns {{nRb:number, symbols:number, rbOffset:number}|null} */
export function coreset0Entry(tableKey, index) {
  const tbl = tableKey === '120k' ? CORESET0_TABLE_120K : CORESET0_TABLE_30K
  const idx = Number(index)
  if (!Number.isInteger(idx) || idx < 0 || idx >= tbl.length) return null
  const [nRb, symbols, rbOffset] = tbl[idx]
  if (nRb === 0) return { nRb: 0, symbols: 0, rbOffset: 0, reserved: true }
  return { nRb, symbols, rbOffset, reserved: false }
}

/**
 * CORESET#0 频域位置（移植项目 StackCommon::calcCoreset0Bwp）
 *
 * @param {object} o
 * @param {number} o.arfcn          DL ARFCN
 * @param {number} o.pointA         Point A ARFCN
 * @param {number} o.ssbArfcn       SSB ARFCN
 * @param {number} o.dlScs          DL SCS (kHz)
 * @param {number} o.ssbScs         SSB SCS (kHz)
 * @param {number} o.tableOffset    表内 RB 偏移
 * @param {number} o.nRb            CORESET#0 RB 数
 * @param {number} o.symbols        符号数
 * @param {number} o.pointAFreq     Point A 频率 (MHz)
 */
export function calcCoreset0({
  arfcn,
  pointA,
  ssbArfcn,
  dlScs,
  ssbScs,
  tableOffset,
  nRb,
  symbols,
  pointAFreq
}) {
  const muDl = muOf(dlScs)
  const muSsb = muOf(ssbScs)
  if (muDl === null || muSsb === null) return null

  const nref = Number(arfcn)
  const ssbOffset0 = Number(ssbArfcn) - Number(pointA)

  let numSsb
  let numCommon
  let numRef
  if (nref <= 599999) {
    numSsb = 3 * 2 ** muSsb
    numCommon = 3 * 2 ** muDl
    numRef = 3
  } else if (nref <= 2016666) {
    numSsb = 2 ** muSsb
    numCommon = 2 ** muDl
    numRef = muDl === 3 ? 4 : 1
  } else {
    numSsb = 2 ** (muSsb - 2)
    numCommon = 2 ** (muDl - 2)
    numRef = 1
  }

  // 注意：Python 的 // 是向下取整；JS 需用 Math.floor，不能用截断
  const step1 = Math.floor(ssbOffset0 - 10 * 12 * numSsb)
  const offsetToPa = Math.floor(Math.floor(step1 / numCommon) / 12) * Math.floor(numCommon / numRef)

  const offsetForMmw = muDl === 2 || muDl === 3 ? 2 : 0
  const bwpStart = Math.floor(offsetToPa / 2 ** (muDl - offsetForMmw)) - Number(tableOffset)

  const rbMhz = (12 * Number(dlScs)) / 1000
  const startF = Number(pointAFreq) + bwpStart * rbMhz
  const endF = startF + Number(nRb) * rbMhz

  return {
    startRb: bwpStart,
    nRb: Number(nRb),
    symbols: Number(symbols),
    rbMhz,
    startF,
    endF,
    offsetToPa,
    ssbOffset0,
    numSsb,
    numCommon,
    numRef,
    offsetForMmw
  }
}

// ===========================================================================
// 6. 单小区汇总
// ===========================================================================

const round = (v, d = 3) => Number(Number(v).toFixed(d))
const TOL = 1e-6

function describeCarrier(link, tag) {
  const f = arfcnToFreq(link.arfcn)
  const pa = arfcnToFreq(link.pa)
  if (!f || !pa) return null
  const { nrb, estimated } = nrbOf(link.bw, link.scs)
  const mu = muOf(link.scs)
  const occBw = (nrb * 12 * link.scs) / 1000
  return {
    tag,
    arfcn: Number(link.arfcn),
    freqMHz: f.freqMHz,
    frLabel: f.frLabel,
    pointA: Number(link.pa),
    pointAFreq: pa.freqMHz,
    bw: Number(link.bw),
    scs: Number(link.scs),
    mu,
    nrb,
    nrbEstimated: estimated,
    occBw,
    occ: [f.freqMHz - occBw / 2, f.freqMHz + occBw / 2],
    nom: [f.freqMHz - link.bw / 2, f.freqMHz + link.bw / 2]
  }
}

/**
 * 综合分析一个小区
 * @param {object} cell
 *   { name, type, fr, band,
 *     dl: { arfcn, pa, bw, scs, ssb, ssbScs, ssbCase, coreset0Index, searchSpaceZero },
 *     ul: { arfcn, pa, bw, scs },
 *     sliv }
 * @returns 结构化结果，含 checks 自检数组
 */
export function analyzeCell(cell) {
  const dl = describeCarrier(cell.dl, 'DL')
  const ul = cell.ul ? describeCarrier(cell.ul, 'UL') : null
  if (!dl) return null

  const checks = []

  // --- 载波自检 ---
  const paDelta = Math.abs(dl.occ[0] - dl.pointAFreq)
  checks.push({
    key: 'pointA',
    ok: paDelta < 1e-4,
    level: paDelta < 1e-4 ? 'ok' : 'error',
    msg:
      paDelta < 1e-4
        ? `Point A 与占用带宽下边界一致（${round(dl.pointAFreq, 3)} MHz）`
        : `Point A（${round(dl.pointAFreq, 3)} MHz）与占用下边界（${round(dl.occ[0], 3)} MHz）相差 ${round(paDelta * 1000, 1)} kHz`
  })
  if (dl.nrbEstimated) {
    checks.push({
      key: 'nrb',
      ok: false,
      level: 'warn',
      msg: `带宽 ${dl.bw} MHz / SCS ${dl.scs} kHz 不在标准 N_RB 表中，已按 ${dl.nrb} RB 估算`
    })
  } else {
    checks.push({ key: 'nrb', ok: true, level: 'ok', msg: `N_RB = ${dl.nrb}（TS 38.101 标准表）` })
  }

  // --- SSB ---
  let ssb = null
  if (cell.dl.ssb != null) {
    const s = arfcnToFreq(cell.dl.ssb)
    const ssbScs = Number(cell.dl.ssbScs || cell.dl.scs)
    const bwSsb = ssbBandwidth(ssbScs)
    if (s) {
      ssb = {
        arfcn: Number(cell.dl.ssb),
        freqMHz: s.freqMHz,
        scs: ssbScs,
        mu: muOf(ssbScs),
        bw: bwSsb,
        range: [s.freqMHz - bwSsb / 2, s.freqMHz + bwSsb / 2],
        symbolOffset: ssbSymbolOffset(cell.dl.ssbCase),
        ssbCase: Number(cell.dl.ssbCase)
      }
      const inside = ssb.range[0] >= dl.occ[0] - 1e-6 && ssb.range[1] <= dl.occ[1] + 1e-6
      checks.push({
        key: 'ssb-in-carrier',
        ok: inside,
        level: inside ? 'ok' : 'error',
        msg: inside
          ? 'SSB 完整落在载波占用带宽内'
          : `SSB 超出载波占用范围：SSB [${round(ssb.range[0], 3)}, ${round(ssb.range[1], 3)}] MHz，载波 [${round(dl.occ[0], 3)}, ${round(dl.occ[1], 3)}] MHz`
      })
      // GSCN 对齐性（提示性检查）
      const gs = ssRefToGscn(ssb.freqMHz)
      checks.push({
        key: 'ssb-raster',
        ok: !!(gs && gs.inRaster),
        level: gs && gs.inRaster ? 'ok' : 'warn',
        msg:
          gs && gs.inRaster
            ? `SSB 中心对齐同步栅格：GSCN = ${gs.gscn}`
            : `SSB 中心不在同步栅格上${gs ? `，最近 GSCN = ${gs.gscn}（偏差 ${round(gs.deltaKHz, 1)} kHz）` : ''}`
      })
    }
  }

  // --- CORESET#0 ---
  let coreset0 = null
  const tableKey = pickCoreset0Table(dl.scs, cell.dl.ssbScs || dl.scs)
  const entry = coreset0Entry(tableKey, cell.dl.coreset0Index)
  if (entry && !entry.reserved && ssb) {
    const geo = calcCoreset0({
      arfcn: dl.arfcn,
      pointA: dl.pointA,
      ssbArfcn: ssb.arfcn,
      dlScs: dl.scs,
      ssbScs: ssb.scs,
      tableOffset: entry.rbOffset,
      nRb: entry.nRb,
      symbols: entry.symbols,
      pointAFreq: dl.pointAFreq
    })
    if (geo) {
      coreset0 = {
        tableKey,
        index: Number(cell.dl.coreset0Index),
        nRb: entry.nRb,
        symbols: entry.symbols,
        tableOffset: entry.rbOffset,
        ...geo
      }
      const inCarrier = geo.startF >= dl.occ[0] - 1e-6 && geo.endF <= dl.occ[1] + 1e-6
      checks.push({
        key: 'coreset0-in-carrier',
        ok: inCarrier,
        level: inCarrier ? 'ok' : 'warn',
        msg: inCarrier
          ? 'CORESET#0 落在载波占用带宽内'
          : `CORESET#0 [${round(geo.startF, 3)}, ${round(geo.endF, 3)}] MHz 超出载波占用范围`
      })
      if (ssb) {
        const overlap = !(geo.endF <= ssb.range[0] || geo.startF >= ssb.range[1])
        checks.push({
          key: 'ssb-coreset-overlap',
          ok: true,
          level: overlap ? 'warn' : 'ok',
          msg: overlap
            ? 'CORESET#0 与 SSB 频域有重叠（复用样式允许，需确认在 CORESET 内未占用 SSB 所在符号）'
            : 'CORESET#0 与 SSB 频域不重叠'
        })
      }
    }
  } else if (entry && entry.reserved) {
    checks.push({
      key: 'coreset0',
      ok: false,
      level: 'warn',
      msg: `controlResourceSetZero = ${cell.dl.coreset0Index} 在 ${tableKey} 表中为保留值`
    })
  }

  // --- SIB1 时域 ---
  const sib1 = calcSib1Timing({
    fr: cell.fr || dl.frLabel,
    mu: dl.mu,
    searchSpaceZero: cell.dl.searchSpaceZero,
    sliv: Number(cell.sliv != null ? cell.sliv : 53),
    coresetSymbols: coreset0 ? coreset0.symbols : 0
  })

  return {
    name: cell.name || '—',
    type: cell.type || '',
    fr: cell.fr || dl.frLabel,
    band: cell.band != null ? Number(cell.band) : null,
    dl,
    ul,
    ssb,
    coreset0,
    sib1,
    checks
  }
}

// ===========================================================================
// 7. 项目三小区预置（来自 param_gnb_stack_mcu.json）
// ===========================================================================

export const CELL_PRESETS = {
  sc: {
    name: '小区0',
    type: 'sc',
    fr: 'FR1',
    band: 127,
    sliv: 53,
    dl: { arfcn: 432000, pa: 430164, bw: 20, scs: 30, ssb: 432030, ssbScs: 30, ssbCase: 9, coreset0Index: 2, searchSpaceZero: 2 },
    ul: { arfcn: 394000, pa: 392164, bw: 20, scs: 30 }
  },
  ka: {
    name: '小区1',
    type: 'ka',
    fr: 'FR2',
    band: 512,
    sliv: 53,
    dl: { arfcn: 1586664, pa: 1583496, bw: 100, scs: 120, ssb: 1586208, ssbScs: 120, ssbCase: 10, coreset0Index: 3, searchSpaceZero: 2 },
    ul: { arfcn: 2072499, pa: 2071707, bw: 100, scs: 120 }
  },
  ka_feeder: {
    name: '小区2',
    type: 'ka_feeder',
    fr: 'FR2',
    band: 512,
    sliv: 53,
    dl: { arfcn: 1606664, pa: 1593992, bw: 400, scs: 120, ssb: 1606944, ssbScs: 120, ssbCase: 3, coreset0Index: 3, searchSpaceZero: 0 },
    ul: { arfcn: 2077499, pa: 2074331, bw: 400, scs: 120 }
  }
}

// ===========================================================================
// 8. 展示辅助
// ===========================================================================

/** 按 3GPP 习惯用窄空格分组：432000 → "432 000" */
export function groupNumber(v, digits = 0) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return n
    .toFixed(digits)
    .replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009')
}

/** 频率展示：<1000 MHz 用 MHz，否则用 GHz */
export function formatFreq(freqMHz, digits = 3) {
  const f = Number(freqMHz)
  if (!Number.isFinite(f)) return '—'
  if (Math.abs(f) >= 1000) return `${(f / 1000).toFixed(digits + 1)} GHz`
  return `${f.toFixed(digits)} MHz`
}

export { round as _round, TOL as _TOL }
