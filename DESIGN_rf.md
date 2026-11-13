# RF Wireless 分区设计方案

> 范围界定：**只实现工具功能本体，不复刻任何外部站点的顶部导航栏**。
> 入口统一走 toolbox 自己的左侧栏工具卡，页面外壳复用 `ToolShell.vue`。

## 1. 结论

在现有 4 个分区（图片 / 文档 / 其他 / 坐标）之外新增第 5 分区 **RF Wireless**，
共 4 个工具，全部纯前端计算，不引入 npm 依赖、不调用后端：

| # | 工具 | 路由 | 职责 |
|---|---|---|---|
| 1 | NR 频点换算 | `/rf/arfcn` | NR-ARFCN ↔ 频率（F_REF）双向换算，含分段参数、栅格、往返校验 |
| 2 | SSB GSCN 换算 | `/rf/gscn` | GSCN ↔ SS_REF ↔ NR-ARFCN 三角互转，含 N/M 反解与栅格偏差 |
| 3 | SSB 位置关系 | `/rf/ssb-position` | 载波 / Point A / SSB / CORESET#0 / SIB1 的频域与时域位置关系 + 示意图 |
| 4 | 速率计算 | `/rf/rate` | 按 TS 38.214 TBS 流程估算 1 秒吞吐量，含 TDD 上下行配比与调度次数 |

## 2. 依据

- `TS 38.104 Table 5.4.2.1-1` — NR-ARFCN 三段全局频率栅格
- `TS 38.104 Table 5.4.3.1-1` — GSCN / 同步栅格
- `TS 38.101-1 Table 5.3.2-1` — 传输带宽配置 N_RB（FR1）
- `TS 38.101-2 Table 5.3.2-1` — 传输带宽配置 N_RB（FR2 / FR2-2）
- `TS 38.211 Table 4.2-1` — numerology μ
- `TS 38.213 Table 13-4 / 13-8` — CORESET#0 复用样式
- `TS 38.213 Table 13-11 / 13-12` — Type0-PDCCH CSS 监测时机
- `TS 38.214 Table 5.1.2.1-1` — SLIV 编解码
- 项目参考实现：`E:\code\Obsidian_note\博航的笔记\5G日志分析\三小区频域分析\plot_cell_freq_domain.py`

## 3. 关键公式

### 3.1 NR-ARFCN → 频率（38.104 表 5.4.2.1-1）

| F_REF 范围 (MHz) | ΔF_Global | N_REF 范围 | F_REF-Offs | N_REF-Offs |
|---|---|---|---|---|
| 0 – 3000 | 5 kHz | 0 – 599999 | 0 | 0 |
| 3000 – 24250 | 15 kHz | 600000 – 2016666 | 3000 | 600000 |
| 24250 – 100000 | 60 kHz | 2016667 – 3279165 | 24250 | 2016667 |

`F_REF = F_REF-Offs + ΔF_Global × (N_REF − N_REF-Offs)`

> **与参考脚本的差异（重要）**：`plot_cell_freq_domain.py` 第 47 行第三段用了
> `24250.08 + 0.06 × (n − 2016667)`。规范该段 `F_REF-Offs = 24250 MHz`，
> 24250.08 是 GSCN 表（5.4.3.1-1）的偏移量。二者在 >24.25 GHz 段差 **80 kHz**
> （例：N_REF=2072499 → 规范 27599.92 MHz，脚本 27600.00 MHz）。
> **本工具按规范取 24250**，并在页面说明中显式标注该差异。

### 3.2 GSCN → 同步栅格频点（38.104 表 5.4.3.1-1）

| SS_REF 范围 (MHz) | SS_REF 公式 | GSCN | N 范围 |
|---|---|---|---|
| 0 – 3000 | N × 1.2 MHz + M × 0.05 MHz，M ∈ {1,3,5} | 3N + (M−3)/2 | 1 – 2499，得 GSCN 2 – 7498 |
| 3000 – 24250 | 3000 MHz + N × 1.44 MHz | 7499 + N | 得 GSCN 7499 – 22256 |
| 24250 – 100000 | 24250.08 MHz + N × 17.28 MHz | 22257 + N | 得 GSCN 22257 – 26639 |

第一段反解：`N = floor((GSCN + 1) / 3)`，`k = GSCN − 3N ∈ {−1,0,1}`，`M = 3 + 2k`。
（M 只有 1/3/5 三个取值，故第一段同步栅格是 1.2 MHz 分组 + 100 kHz 细粒度，组间有空洞。）

### 3.3 其余

- `μ = log2(SCS / 15)`，SCS ∈ {15,30,60,120,240,480,960} kHz
- `BW_SSB = 240 × SCS_SSB`（SSB 固定 20 RB = 240 子载波）
- 占用带宽 `BW_occ = N_RB × 12 × SCS`
- 标称带宽 `[F_REF − BW/2, F_REF + BW/2]`，占用带宽 `[F_REF − BW_occ/2, F_REF + BW_occ/2]`
- Point A 恒等于占用带宽下边界（自检项）

## 4. 复用与约束

### 4.1 复用清单

| 资源 | 用途 |
|---|---|
| `src/components/ToolShell.vue` | 页面外壳：面包屑 / 标题 / 副标题 / 使用说明 / 相关工具 |
| `src/styles/main.css` | 设计 token 与 `.step-block` `.step` `.option-panel` `.data-table` `.result-box` `.tool-note` `.el-button` `.form-label` `.coord-grid` |
| `src/lib/ui.js` | `msgError` / `msgSuccess` 提示 |
| `src/views/tools/textkit.js` | `copyText` 复制（自带 execCommand 回退） |
| `src/views/tools/nrkit.js` | **新增**，全部算法函数（见 4.3） |

### 4.2 接线（编排者自持，worker 禁改）

| 文件 | 改动 |
|---|---|
| `src/data/tools.js` | 新增 `RF_TOOLS`，`ALL_SECTIONS` 追加 `{ title: 'RF Wireless', tools: RF_TOOLS }` |
| `src/router/index.js` | 新增 `RF_TOOL_COMPONENTS` + `Object.assign`，新增 `/c/rf` 分类路由 |
| `src/views/Home.vue` | `CATEGORIES.rf`、`SECTION_DESC['RF Wireless']` |
| `src/components/SideNav.vue` | 侧栏新增 `{ label: 'RF Wireless', to: '/c/rf', icon: 'fa-wifi' }` |
| `src/components/ToolShell.vue` | `CATEGORY_NAMES` / `CATEGORY_PATHS` 各追加一项 |

### 4.3 共享算法库 `src/views/tools/nrkit.js`

由编排者编写并自测，**worker 只允许 import 调用，不得修改**。导出：

- 换算：`arfcnToFreq` / `freqToArfcn` / `gscnToSsRef` / `ssRefToGscn`
- 常量表：`ARFCN_SEGMENTS` / `GSCN_SEGMENTS` / `NRB_TABLE_FR1` / `NRB_TABLE_FR2`
- 带宽：`nrbOf(bw, scs)` / `ssbBandwidth(scs)` / `muOf(scs)` / `SCS_TO_MU`
- 时域：`decodeSliv(sliv)` / `calcSib1Timing(...)` / `ssbSymbolOffset(ssbCase)`
- CORESET#0：`coreset0Entry(tableKey, index)` / `calcCoreset0(...)`
- 汇总：`analyzeCell(cell)` → 一次算全（含 `checks` 自检数组）
- 预置：`CELL_PRESETS` → 项目三小区真实配置（sc / ka / ka_feeder）

### 4.4 worker 硬性约束

1. 禁改：`nrkit.js`、`tools.js`、`router/index.js`、`SideNav.vue`、`Home.vue`、`ToolShell.vue`、`main.css`、`package.json`
2. 禁新增 npm 依赖；禁自写换算算法（只能 import `nrkit.js`）
3. 每页必须能独立跑通：无 TODO、无占位假数据、无 `console.log`
4. 中文界面；优先复用 `main.css` 已有 class，不新造视觉体系
5. 结果区常驻 + 未计算时 `.tool-note` 空态提示（与既有工具页一致）

## 5. 页面规格

### 5.1 `/rf/arfcn` — NR 频点换算

- **输入**：模式（ARFCN→频率 / 频率→ARFCN）、数值、频率单位（MHz / GHz）
- **输出**：F_REF、所属段（FR1 / FR2 / FR2-2）、ΔF_Global、N_REF 范围、代入公式串、栅格偏差
- **往返校验**：ARFCN → 频率 → ARFCN 必须回到原值；频率非栅格点时给出最近点与偏差 kHz
- **附表**：三段参数表；常见频段可选参考

### 5.2 `/rf/gscn` — SSB GSCN 换算

- **输入**：模式（GSCN→频率 / 频率→GSCN / ARFCN→GSCN）、数值
- **输出**：GSCN、SS_REF、N、M、所属段、最近 NR-ARFCN 及偏差、往返校验
- **说明**：第一段同步栅格有组间空洞，频率落在空洞时给出前后两个候选 GSCN

### 5.3 `/rf/ssb-position` — SSB 位置关系

- **输入**：频段号、DL ARFCN、Point A ARFCN、DL 带宽、DL SCS、SSB ARFCN、SSB SCS、
  `ssb_case`、`controlResourceSetZero`、`searchSpaceZero`；可载入项目三小区预置
- **输出**：
  - 载波：F_REF、N_RB、μ、占用带宽、标称带宽区间、Point A 频率
  - SSB：F_SSB、BW_SSB、占用区间、相对 Point A 偏移（Hz / RB）、`offsetToPointA`
  - CORESET#0：表类型、RB 数、符号数、RB 偏移、频域区间、与 SSB 位置关系
  - SIB1：n0、PDCCH 符号区间、SLIV→(S,L)、PDSCH 符号区间、监测 slot
- **自检**：Point A = 占用下边界、SSB 是否落在载波内、SSB 与 CORESET#0 是否重叠、N_RB 是否与带宽/SCS 匹配
- **示意图**：SVG 频域图（标称带宽 / 占用带宽 / SSB / CORESET#0 / Point A / 中心频点）
  + 时频图（横轴 ms / slot，纵轴 MHz），可在 1–3 个小区间叠加对比

### 5.4 `/rf/rate` — 速率计算

- **输入**：传输方向（DL/UL）、双工（FDD/TDD）、TDD 上下行配比（含特殊 slot 是否计入下行）、
  SCS、每 slot 符号数 N_sh_symb、PRB 数、MCS 表与索引、层数 v、xOverhead、DM-RS 配置
  （类型 / 前置符号 / 附加符号 / 无数据 CDM 组数）、每秒调度次数（自动或手动）
- **算法**（TS 38.214 §5.1.3.2）：
  1. `N′_RE = 12 × N_sh_symb − N_DMRS_PRB − N_oh`
  2. `N_RE = min(156, N′_RE) × n_PRB`
  3. `N_info = N_RE × R × Qm × v`
  4. `N_info ≤ 3824` → 量化后查表 5.1.3.2-1 取不小于 N_info′ 的最近 TBS；
     否则走分段公式（C 按 R ≤ 0.25 分 3816 / 8424）
- **输出**：TBS、每 slot 字节数、每秒调度次数、1 秒吞吐（bps / MB/s）、
  理论值对比（未量化的 `N_info × 调度次数`）、实际频谱效率
- **DM-RS RE 数**（TS 38.211 §7.4.1.1）：Type1 = 6 RE/RB/符号/CDM 组，Type2 = 4

`ratekit.js` 与之配套，`tests/ratekit.test.mjs` 93 项断言：
MCS 表 1~4 逐表抽查、TBS 量化表 93 项结构与边界、两条 TBS 分支的手算算例、
FDD/TDD 调度次数、273RB/30kHz/MCS27 的工程基准（417.952 Mbps）。

## 6. 验收标准

1. `npm run build` 通过；`npm test` 全绿
2. `nrkit.js` 算例与参考脚本 `plot_cell_freq_domain.py` 的输出逐项对齐
   （三小区：F_REF / Point A / CORESET#0 区间 / n0 / PDCCH / PDSCH 全部一致）
3. 浏览器实测三页：输入合法值能出结果、非法值有中文报错、空态有提示、无 JS 报错
4. 视觉与既有坐标工具页一致（同一套 `ToolShell` + `step-block` 结构）
5. 侧栏「RF Wireless」高亮可回跳、面包屑正确
