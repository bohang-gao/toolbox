<template>
  <ToolShell
    path="/coord/coordinate-doc"
    title="坐标系转换说明"
    intro="一份坐标系速查手册：常用坐标系的定义、大地坐标与空间直角坐标的关系、度分秒换算、七参数模型，以及中国坐标系偏移的原理。纯文字说明，不做计算。"
    :usage="[
      '按顺序阅读，或直接跳到需要的小节。',
      '第 2、4 节三角函数中的角度为弧度制，φ 为大地纬度、λ 为大地经度、h 为大地高。',
      '本页只解释原理；实际换算请使用本工具箱对应的计算页面。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 常用坐标系</div>
      <div class="option-panel">
        <table class="data-table">
          <thead>
            <tr>
              <th>坐标系</th>
              <th>EPSG / 定义</th>
              <th>椭球参数</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>WGS84</td>
              <td>EPSG:4326</td>
              <td>a=6378137 m，1/f=298.257223563</td>
              <td>GPS 原生坐标，全球通用的大地坐标系</td>
            </tr>
            <tr>
              <td>CGCS2000</td>
              <td>EPSG:4490</td>
              <td>a=6378137 m，1/f=298.257222101</td>
              <td>中国国家大地坐标系（2000 国家大地坐标系）</td>
            </tr>
            <tr>
              <td>GCJ02</td>
              <td>无 EPSG 编码</td>
              <td>加偏算法使用克拉索夫斯基椭球参数</td>
              <td>国测局「火星坐标」，国内地图服务加密偏移后使用</td>
            </tr>
            <tr>
              <td>BD09</td>
              <td>无 EPSG 编码</td>
              <td>在 GCJ02 基础上再偏移</td>
              <td>百度坐标，在 GCJ02 上做二次偏移</td>
            </tr>
            <tr>
              <td>Web 墨卡托</td>
              <td>EPSG:3857</td>
              <td>R=6378137 m 球体近似</td>
              <td>地图瓦片使用，球面等角投影（非椭球严格投影）</td>
            </tr>
            <tr>
              <td>UTM</td>
              <td>按 WGS84 分带</td>
              <td>6° 分带，中央经线比例因子 k0=0.9996</td>
              <td>通用横轴墨卡托，全球共 60 带</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>2</b> 大地坐标与空间直角坐标</div>
      <div class="option-panel">
        <p class="doc-p">
          大地坐标（φ, λ, h）与空间直角坐标（X, Y, Z，地心地固系 ECEF）之间的转换是坐标计算的基础。
          其中 N 为卯酉圈曲率半径，a 为椭球长半轴，e² 为第一偏心率平方。
        </p>
        <pre class="result-box">N = a / √(1 − e²·sin²φ)

X = (N + h) · cosφ · cosλ
Y = (N + h) · cosφ · sinλ
Z = (N·(1 − e²) + h) · sinφ

e² = 1 − b²/a²</pre>
        <p class="doc-p">
          式中 b 为短半轴。WGS84 的 e² ≈ 0.00669437999014。
          反向由 ECEF 求大地坐标通常采用迭代法（工具箱使用 Bowring 迭代，收敛到 1e-12 度）。
        </p>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>3</b> 度分秒与十进制度</div>
      <div class="option-panel">
        <p class="doc-p">十进制度（dd）与度分秒（d°m′s″）互换：</p>
        <pre class="result-box">dd = d + m/60 + s/3600

反向：
d = 取整数部分
m = 取 (dd − d) × 60 的整数部分
s = ((dd − d) × 60 − m) × 60</pre>
        <p class="doc-p">
          举例：116.4074° = 116°24′26.64″。负值先对绝对值换算，再补负号。
        </p>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>4</b> 七参数（Bursa-Wolf）</div>
      <div class="option-panel">
        <p class="doc-p">
          七参数模型用于两个空间直角坐标系之间的转换：3 个平移、3 个旋转、1 个尺度。
          小角度近似下的矩阵形式：
        </p>
        <pre class="result-box">[X′]   [dx]         [ 1   rz  -ry ] [X]
[Y′] = [dy] + (1+s) [-rz   1   rx ] [Y]
[Z′]   [dz]         [ ry  -rx   1  ] [Z]</pre>
        <p class="doc-p">
          其中 dx、dy、dz 单位为米；rx、ry、rz 单位为角秒；s 单位为 ppm（百万分之一），
          即尺度因子为 1 + s×10⁻⁶。旋转角较大时小角度近似会引入误差，需改用严格旋转矩阵。
        </p>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>5</b> 中国坐标系偏移</div>
      <div class="option-panel">
        <p class="doc-p">
          GCJ02 是在 WGS84 上叠加的一组非线性偏移（国测局算法）。正向（WGS84 → GCJ02）可以直接用解析式计算；
          反向（GCJ02 → WGS84）没有解析逆，需要用迭代逼近。BD09 则是在 GCJ02 的基础上再做一次固定偏移，
          因此 BD09 与 WGS84 之间通常经由 GCJ02 中转。
        </p>
        <p class="doc-p">
          偏移量在中国境内约为数百米，且随位置变化；判断点位于中国境外时，算法不对坐标做任何偏移。
          本工具箱的 GCJ02 反解使用迭代法，收敛阈值 1e-11 度（对应地面约微米级），远高于实际需求。
        </p>
      </div>
    </div>

    <div class="step-block">
      <div class="step"><b>6</b> 精度与适用场景</div>
      <div class="option-panel">
        <table class="data-table">
          <thead>
            <tr>
              <th>方法</th>
              <th>模型</th>
              <th>精度</th>
              <th>适用与注意</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Haversine</td>
              <td>球面，R≈6371 km</td>
              <td>相对误差约 0.5%</td>
              <td>计算快，适合粗略距离与排序</td>
            </tr>
            <tr>
              <td>Vincenty</td>
              <td>椭球（WGS84）</td>
              <td>mm 级，迭代收敛</td>
              <td>精确测距；近对跖点可能不收敛</td>
            </tr>
            <tr>
              <td>TM / UTM</td>
              <td>横轴墨卡托局部投影</td>
              <td>带内 cm~m</td>
              <td>工程测量与分带平面坐标</td>
            </tr>
            <tr>
              <td>Web 墨卡托</td>
              <td>球面墨卡托</td>
              <td>仅用于显示</td>
              <td>纬度越高变形越大，不能用于量距与面积</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </ToolShell>
</template>

<script setup>
import ToolShell from '../../../components/ToolShell.vue'
</script>

<style scoped>
.doc-p {
  font-size: 14px;
  line-height: 1.8;
  color: var(--text-2);
  margin: 0 0 10px;
}
.doc-p:last-child {
  margin-bottom: 0;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
  line-height: 1.65;
  color: var(--text-2);
}
.data-table th,
.data-table td {
  padding: 9px 12px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
}
.data-table th {
  font-weight: 600;
  color: var(--text);
  background: #f1f5f9;
  white-space: nowrap;
}
.data-table tbody tr:last-child td {
  border-bottom: none;
}
.data-table tbody tr:hover {
  background: #f8fafc;
}
.result-box + .doc-p {
  margin-top: 12px;
}
@media only screen and (max-width: 767px) {
  .data-table {
    display: block;
    overflow-x: auto;
    white-space: nowrap;
  }
}
</style>
