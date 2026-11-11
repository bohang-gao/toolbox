# 坐标工具集复刻方案（lddgo classID=8 → toolbox）

## 1. 结论

lddgo「坐标」分类共 **23 个工具**，全部可在纯前端（浏览器内 JS）实现，无需后端。
接入方式：在 toolbox 现有三分类之外新增第 4 个分区 **「坐标工具」**，
复用 `tools.js` 注册表 / `SideNav.vue` 侧栏 / `ToolShell.vue` 工具页外壳 / `main.css` 设计 token，
视觉与现有图片、PDF、文本三类工具**完全一致**，不引入第二套视觉体系。

> **范围界定（用户明确要求）**：只复刻**工具功能本体**，**不复刻源站的上边栏/顶部导航**。
> 源站顶部导航、Logo、搜索框、广告位、页脚一律不做；入口只走 toolbox 自己的左侧栏工具卡与首页工具卡。
> 每个工具的页面外壳统一由 `ToolShell.vue` 提供（面包屑 + Hero + 两栏 + 使用说明 + 相关工具），与现有工具页面完全同构。

## 2. 目标工具清单（源站解析结果，`_recon/lddgo8-tools.json`）

| # | 源站路径 | 工具名 | 本站路由 | 归属卡 |
|---|---|---|---|---|
| 1 | /convert/coordinate | 在线地图坐标系转换 | `/coord/map-convert` | T1 |
| 2 | /convert/position | 经纬度查询定位 | `/coord/position` | T4 |
| 3 | /convert/degree-convert | 经纬度和度分秒转换 | `/coord/degree-convert` | T1 |
| 4 | /convert/distance | 经纬度距离计算 | `/coord/distance` | T1 |
| 5 | /convert/coordinate-transform | 大地坐标系与空间直角坐标系转换 | `/coord/geodetic-ecef` | T2 |
| 6 | /convert/helmert-coordinate-transform | 七参数（Helmert）坐标转换 | `/coord/helmert` | T2 |
| 7 | /coordinate/projection | 坐标投影计算 | `/coord/projection` | T3 |
| 8 | /coordinate/swap | 坐标轴交换 | `/coord/axis-swap` | T1 |
| 9 | /coordinate/ecef-enu | ECEF 与站心(ENU)转换 | `/coord/ecef-enu` | T2 |
| 10 | /coordinate/molodensky-badekas | 莫洛登斯基-巴德卡斯转换 | `/coord/molodensky-badekas` | T2 |
| 11 | /coordinate/molodensky-transform | 莫洛登斯基转换 | `/coord/molodensky` | T2 |
| 12 | /coordinate/polar-cartesian-coordinate-convert | 直角坐标与极坐标转换 | `/coord/polar-cartesian` | T1 |
| 13 | /coordinate/coordinate-convert-documentation | 坐标系转换说明 | `/coord/coordinate-doc` | T6 |
| 14 | /coordinate/coordinate-unit-converter | 坐标单位转换 | `/coord/unit-converter` | T3 |
| 15 | /coordinate/geodetic-latitude-to-geocentric-latitude | 大地纬度转地心纬度 | `/coord/geodetic-latitude` | T3 |
| 16 | /coordinate/itrf-coordinate-transformation | ITRF 坐标转换 | `/coord/itrf` | T4 |
| 17 | /coordinate/transformation-parameter-solve | 坐标转换参数求解 | `/coord/param-solve` | T4 |
| 18 | /coordinate/wgs84-cgcs2000-converter | WGS84 与 CGCS2000 转换 | `/coord/wgs84-cgcs2000` | T4 |
| 19 | /coordinate/base-station-coordinate-calculate | 基站坐标计算 | `/coord/base-station` | T4 |
| 20 | /coordinate/ntrip-source-table | NTRIP Source-Table 解析/生成 | `/coord/ntrip-sourcetable` | T5 |
| 21 | /coordinate/nmea-0183-parser | NMEA-0183 协议解析 | `/coord/nmea0183` | T5 |
| 22 | /coordinate/geohash-encode-decode | Geohash 编码解码 | `/coord/geohash` | T3 |
| 23 | /coordinate/rtcm3-parser | RTCM3 数据解析 | `/coord/rtcm3` | T5 |

## 3. 架构决策

### 3.1 算法层（编排者自持，不由 worker 修改）

`src/views/tools/coordkit.js` —— 单一坐标算法库，全部纯函数、无依赖。
worker 只允许 **import 调用**，不允许修改该文件。理由：数学正确性是唯一不可协商项，
23 个页面各自重写一遍椭球公式必然出现口径分裂。

对外导出：

```
ELLIPSOIDS / toRad / toDeg
geodeticToEcef / ecefToGeodetic
ecefToEnu / enuToEcef
geodeticToGeocentricLat / geocentricToGeodeticLat
ddToDms / dmsToDd / parseDms
haversine / vincentyInverse / vincentyDirect
wgs84ToGcj02 / gcj02ToWgs84 / gcj02ToBd09 / bd09ToGcj02 / wgs84ToBd09 / bd09ToWgs84
helmertForward / helmertInverse / solveHelmert
molodenskyForward / molodenskyBadekasForward
polarToCartesian / cartesianToPolar
tmForward / tmInverse / utmForward / utmInverse / utmZoneOf
webMercatorForward / webMercatorInverse
geohashEncode / geohashDecode
swapAxes
parseNmea / parseRtcm3 / parseNtripSourcetable / buildNtripSourcetable
ANGLE_UNITS / LENGTH_UNITS / convertUnit
```

### 3.2 页面层（worker 独占，每卡文件互不重叠）

- 每个工具一个 `.vue`，结构照抄 `src/views/tools/base64.vue` / `color.vue`：
  `<ToolShell path="..." title="..." intro="..." :usage="[...]">` + `.step-block` + `.step` + `.option-panel`。
- 禁止引入新的 UI 库、禁止改 `main.css`、禁止改 `tools.js` / `router/index.js` / `SideNav.vue`（编排者所有）。
- 需要共享小组件时在该卡自己的文件里内联，不新建全局组件。

### 3.3 注册与导航（编排者完成，T0）

- `src/data/tools.js` 新增 `COORD_TOOLS` 与 `ALL_SECTIONS` 第 4 项「坐标工具」。
- `src/router/index.js` 新增 `/c/coord` 分类路由 + `COORD_TOOL_COMPONENTS` 懒加载表。
- `src/components/SideNav.vue` 菜单新增「坐标工具」项（`fa-globe`）。
- `src/views/Home.vue` 的 `CATEGORIES` / `SECTION_DESC` 增加 coord 项。

## 4. 验收口径

1. `npm run build` 通过，无新增警告。
2. 23 条路由全部可访问，页面外壳（面包屑/图标/Hero/两栏/使用说明/相关工具）与现有工具一致。
3. 关键算例（编排者独立复核，worker 自测值必须与之一致）：

| 算例 | 输入 | 期望输出 |
|---|---|---|
| 大地→ECEF | WGS84 39.9042N 116.4074E h=0 | x≈-2178263.9 y≈4386594.6 z≈4069953.5 |
| ECEF→大地 | 上一条结果 | 回代 39.9042 / 116.4074 / 0（误差<1e-6°） |
| 度分秒 | 116.4074° | 116°24′26.64″ |
| 球面距离 | 北京 39.9042,116.4074 → 上海 31.2304,121.4737 | ≈1067 km（Haversine）/ 1067.6 km（Vincenty） |
| GCJ02 | 116.4074,39.9042 | ≈116.41366, 39.90602（偏移 +0.00626/+0.00182） |
| UTM | 39.9042N,116.4074E, WGS84 | 50 带，E≈447688 N≈4418164 |
| Geohash | 39.9042,116.4074, 精度 9 | 前缀 `wx4g0` |
| 七参数 | 单位阵（T=0,R=0,S=0） | 输出==输入（误差<1e-9） |
| 轴交换 | (1,2,3) 交换 Y/Z | (1,3,2) |

4. 侧栏「坐标工具」点击进入 `/c/coord`，工具卡数量 = 23。
5. 23 个工具卡全部出现在首页「全部工具」页的第 4 分区。

## 5. 并行拆分（文件互斥，可同时跑）

| 卡 | 文件域 | 页面数 |
|---|---|---|
| T0 | `coordkit.js` + `tools.js` + `router/index.js` + `SideNav.vue` + `Home.vue` | 编排者执行 |
| T1 | `coord/map-convert.vue` `degree-convert.vue` `distance.vue` `axis-swap.vue` `polar-cartesian.vue` | 5 |
| T2 | `coord/geodetic-ecef.vue` `helmert.vue` `molodensky.vue` `molodensky-badekas.vue` `ecef-enu.vue` | 5 |
| T3 | `coord/projection.vue` `unit-converter.vue` `geodetic-latitude.vue` `geohash.vue` | 4 |
| T4 | `coord/position.vue` `itrf.vue` `param-solve.vue` `wgs84-cgcs2000.vue` `base-station.vue` | 5 |
| T5 | `coord/nmea0183.vue` `rtcm3.vue` `ntrip-sourcetable.vue` | 3 |
| T6 | `coord/coordinate-doc.vue` | 1 |

T1–T6 无共享文件，可在 T0 完成后同时派发。
