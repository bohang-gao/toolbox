# W4：证件照抠图增加「自适应」模式（支持渐变/暗角背景）

项目 E:\code\toolbox。真实照片验证结论：纯色背景很好用，但**渐变/暗角影楼背景被判定「颜色不均匀」直接失败**，转手动体验差。本卡修复。

## 根因
`segmentBackground` 用**全局背景模型**（四边中位数 `bg`）+ 全局容差：`max|C-bg|<=tol`。渐变背景下边缘颜色跨度就超过 tol，无论怎么调容差都会同时漏抠或误抠。

## 要做的事
### 1. `src/lib/portrait.js` 新增 `segmentAdaptive(imageData, opts)`
多源 BFS 区域生长，**局部步进容差**跟随渐变：
- 种子：图像最外 1px 全部像素（每个种子保留自己的参考色 `ref`）
- 队列元素携带 `refIdx`（所属区域参考色索引）；用 `Int16Array region` 记录每个像素的区域 id，区域数上限 ~4096
- 接受条件（同时满足）：
  - 局部平滑：`max(|C - C_pred|) <= stepTol`（`C_pred` = 把该像素入队的前一个像素颜色，默认 `stepTol = 10`）
  - 漂移有界：`max(|C - ref|) <= driftTol`（`ref` = 该区域种子颜色，默认 `driftTol = 70`，防止顺着阴影渗进主体）
- 返回结构与 `segmentBackground` 一致：`{ alpha, coverage, ok, reason }`，失败判据同前（coverage>0.92 或 <0.05）
- `keepSeeds` 永不入背景；`eraseSeeds` 以其自身颜色为准单独生长一块并入背景

### 2. `segmentBackground` 增加可选 `mode`
- `mode: 'strict'`（默认行为不变，保持向后兼容）
- `mode: 'adaptive'`：先跑一次自适应；若 `ok` 直接用，否则回退 strict 的结果
- `detectBackgroundColor` 的 variance 检查**只在 strict 模式下**阻止自动流程

### 3. 页面 `src/views/tools/idphoto.vue`
- 选项区加「抠图算法」下拉/单选：**自适应（推荐 · 支持渐变背景）** / 严格单色
- 默认自适应；选严格单色且 variance>60 时才提示切手动
- 其余交互不变

### 4. 测试 `src/lib/portrait.test.mjs` 追加用例（原 31 项必须仍全过）
- 渐变背景（线性 #dbe7f5 → #93a9c8）+ 肤色头像 + 肩部 → `ok=true`、背景 alpha<40、主体 alpha>200、coverage 40%–85%
- 径向暗角背景 → `ok=true`
- 带 JPEG 噪声（每像素 ±6 随机）的纯色底 → `ok=true`（步进容差应容忍）
- 杂乱彩色噪声背景 → `ok=false`
- 回归：纯色蓝底 strict 模式结果与改动前一致

## 边界
不改 package.json；不引入依赖；不改其他工具；不要 git 操作。

## 验收
`node src/lib/portrait.test.mjs` 全过（含新增用例），`D:/node/npm.cmd run build` 零错误。总结列出新增断言与结果。
