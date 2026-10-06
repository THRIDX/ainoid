// AINOID 地图构建脚本
// 用法: node tools/build-map.mjs [countries-50m.json 路径]
// 输入: Natural Earth 国界 (world-atlas topojson) + assets/js/data/regions.js
// 输出: assets/js/data/world-data.js  （点阵、城市灯光、蔓延顺序、海岸线/边界）
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = process.argv[2] || path.join(__dirname, 'src', 'countries-50m.json');
const OUT = path.join(ROOT, 'assets', 'js', 'data', 'world-data.js');

// ---------- 读取地区定义 ----------
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/js/i18n.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/js/data/regions.js'), 'utf8'), ctx);
const REGIONS = ctx.window.AINOID.REGIONS;
const RIDX = Object.fromEntries(REGIONS.map((r, i) => [r.id, i]));

// ---------- 投影（米勒圆柱，左缘经度 -169，纬度裁剪 -56..83） ----------
const W = 2000;
const LON0 = -169;
const LAT_TOP = 83, LAT_BOT = -56;
const D2R = Math.PI / 180;
const millerY = (lat) => 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * lat * D2R));
const YT = millerY(LAT_TOP), YB = millerY(LAT_BOT);
const H = W * (YT - YB) / (2 * Math.PI);
const wrapLon = (lon) => (lon < LON0 ? lon + 360 : lon);
const proj = (lon, lat) => [(lon - LON0) / 360 * W, (YT - millerY(lat)) / (YT - YB) * H];

// ---------- 国家 -> 地区 ----------
const C2R = {};
const assign = (region, ids) => ids.split(/\s+/).filter(Boolean).forEach((id) => (C2R[id] = region));
assign('US', '840 630 850 316 016 580 060');
assign('CA', '124 666');
assign('MX', '484 320 084 340 222 558 188 591 192 388 332 214 044 780 052 028 212 308 662 670 659 660 136 092 796 500 533 531 534 663 652');
assign('BR', '076');
assign('SA', '032 152 604 170 862 218 068 600 858 328 740 238');
assign('UK', '826 832 831 833');
assign('FR', '250 492');
assign('DE', '276');
assign('WE', '724 620 380 336 674 470 528 056 442 756 438 040 372 300 020 196');
assign('NE', '752 578 246 208 352 304 234 248');
assign('EE', '616 203 703 348 642 100 804 112 498 440 428 233 688 191 070 499 008 807 705');
assign('RU', '643');
assign('ME', '792 364 368 760 400 376 275 422 682 887 512 784 634 048 414');
assign('NA', '818 434 788 012 504 732 729');
assign('WA', '478 466 562 148 566 686 270 624 324 694 430 384 288 768 204 854 132 120 140 226 266 178 678 654');
assign('EA', '231 232 262 706 404 800 834 646 108 728 180 690 174');
assign('ZA', '710 516 072 716 894 508 454 024 426 748 450 480');
assign('CAS', '398 860 795 417 762 496 268 051 031');
assign('SAS', '586 004 050 524 064 144 462 086');
assign('IN', '356');
assign('CN', '156 344 446 158');
assign('KP', '408');
assign('KR', '410');
assign('JP', '392');
assign('SEA', '360 458 702 764 704 608 104 116 418 096 626');
assign('OC', '036 554 598 242 090 548 540 882 776 296 583 584 585 520 258 876 184 570 612 574');
const N2R = { 'Kosovo': 'EE', 'Somaliland': 'EA', 'N. Cyprus': 'WE', 'Siachen Glacier': 'IN', 'Indian Ocean Ter.': 'OC' };
const SKIP = new Set(['010', '260', '334', '239']); // 南极洲及南大洋小岛

// 法国、荷兰的海外领土按位置归入就近地区
function overseasRegion(lon, lat) {
  if (lon > -12 && lon < 32 && lat > 35 && lat < 72) return null; // 欧洲本土
  if (lon < -30) return lat < 12 ? 'SA' : 'MX';
  if (lon > 30 && lon < 80 && lat < 0) return 'ZA';
  if (lon > 140 || lon < -100) return 'OC';
  return null;
}

// ---------- 解码 topojson ----------
const topo = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const [sx, sy] = topo.transform.scale;
const [tx, ty] = topo.transform.translate;
const arcsLL = topo.arcs.map((arc) => {
  let x = 0, y = 0;
  return arc.map((p) => { x += p[0]; y += p[1]; return [x * sx + tx, y * sy + ty]; });
});
const arcPts = (i) => (i >= 0 ? arcsLL[i] : arcsLL[~i].slice().reverse());
// 数据在 180° 经线处被缝合过：沿折线把经度“展开”成连续值，避免横贯全图的色带
function unwrap(pts) {
  const out = [];
  let off = 0;
  for (let i = 0; i < pts.length; i++) {
    const [lon, lat] = pts[i];
    if (i > 0) {
      const d = lon + off - out[i - 1][0];
      if (d > 180) off -= 360; else if (d < -180) off += 360;
    }
    out.push([lon + off, lat]);
  }
  return out;
}
// 把整条折线平移到 [LON0, LON0+360] 附近
function shiftFor(pts) {
  let m = 0;
  for (const p of pts) m += p[0];
  m /= pts.length;
  return m < LON0 ? 360 : m > LON0 + 360 ? -360 : 0;
}
function ringLL(arcIdxs) {
  const pts = [];
  arcIdxs.forEach((ai, k) => {
    const p = arcPts(ai);
    for (let j = k === 0 ? 0 : 1; j < p.length; j++) pts.push(p[j]);
  });
  return unwrap(pts);
}

const polys = [];            // {region, rings:[Float64Array], bbox}
const arcUse = new Map();    // arcIndex -> [{region, shift}]
for (const g of topo.objects.countries.geometries) {
  const id = g.id, name = g.properties && g.properties.name;
  if (SKIP.has(id)) continue;
  const baseRegion = (id && C2R[id]) || N2R[name];
  if (!baseRegion) { console.warn('未分配国家:', id, name); continue; }
  const parts = g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : [];
  for (const part of parts) {
    const ringsLL = part.map(ringLL);
    const outer = ringsLL[0];
    let mLon = 0, mLat = 0;
    for (const p of outer) { mLon += p[0]; mLat += p[1]; }
    mLon /= outer.length; mLat /= outer.length;
    let region = baseRegion;
    if (id === '250' || id === '528') region = overseasRegion(mLon, mLat) || baseRegion;
    const shift = shiftFor(outer);
    const rings = ringsLL.map((r) => {
      // 洞与外环可能展开到不同的 360° 周期，对齐到外环
      let rs = shift;
      const rm = r.reduce((s, p) => s + p[0], 0) / r.length;
      if (rm + rs - (mLon + shift) > 180) rs -= 360; else if (rm + rs - (mLon + shift) < -180) rs += 360;
      const f = new Float64Array(r.length * 2);
      r.forEach((p, i) => { const q = proj(p[0] + rs, p[1]); f[i * 2] = q[0]; f[i * 2 + 1] = q[1]; });
      return f;
    });
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const o = rings[0];
    for (let i = 0; i < o.length; i += 2) {
      x0 = Math.min(x0, o[i]); x1 = Math.max(x1, o[i]);
      y0 = Math.min(y0, o[i + 1]); y1 = Math.max(y1, o[i + 1]);
    }
    polys.push({ region: RIDX[region], rings, bbox: [x0, y0, x1, y1] });
    for (const ring of part) for (const ai of ring) {
      const k = ai >= 0 ? ai : ~ai;
      if (!arcUse.has(k)) arcUse.set(k, []);
      arcUse.get(k).push({ region: RIDX[region], shift });
    }
  }
}
console.log('多边形数:', polys.length);

// 空间索引
const GX = 50, GY = 25;
const buckets = Array.from({ length: GX * GY }, () => []);
polys.forEach((p, idx) => {
  const [x0, y0, x1, y1] = p.bbox;
  const cx0 = Math.max(0, Math.floor(x0 / W * GX)), cx1 = Math.min(GX - 1, Math.floor(x1 / W * GX));
  const cy0 = Math.max(0, Math.floor(y0 / H * GY)), cy1 = Math.min(GY - 1, Math.floor(y1 / H * GY));
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) buckets[cy * GX + cx].push(idx);
});
function inRing(r, x, y) {
  let inside = false;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
    const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function locate(x, y) {
  const cx = Math.min(GX - 1, Math.max(0, Math.floor(x / W * GX)));
  const cy = Math.min(GY - 1, Math.max(0, Math.floor(y / H * GY)));
  for (const idx of buckets[cy * GX + cx]) {
    const p = polys[idx];
    const [x0, y0, x1, y1] = p.bbox;
    if (x < x0 || x > x1 || y < y0 || y > y1) continue;
    let inside = false;
    for (const r of p.rings) if (inRing(r, x, y)) inside = !inside;
    if (inside) return p.region;
  }
  return -1;
}

// ---------- 按中国标准地图修正 ----------
// Natural Earth 按“实际控制线”画国界。地图要在国内平台公开展示，必须符合国家标准地图的表示，这里修正三处：
// 1. 藏南：麦克马洪线以南、喜马拉雅山南麓（大致是阿鲁纳恰尔与阿萨姆的分界）以北、东至洛希特河谷的地区归入中国。
//    雅鲁藏布江／洛希特河以南的蒂拉普、长朗一带不在其内。
// 2. 南海诸岛、钓鱼岛、赤尾屿：岛礁小于点阵间距，单独补点。
// 3. 南海断续线：前九段取自 1947 年《南海诸岛位置图》端点数据（地理学报 2016, 71(6): 914，表 1 第 3–11 段），
//    第十段在台湾以东，按 2013 年版竖版地图取近似位置。
const ZANGNAN_SOUTH = [ // 自西向东；首点在不丹境内，末点在缅甸境内，便于与原国界求交
  [91.98, 26.97], [92.15, 26.93], [92.35, 26.96], [92.64, 27.0], [92.85, 26.96], [93.05, 26.93],
  [93.35, 26.98], [93.6, 27.03], [93.85, 27.12], [94.05, 27.3], [94.3, 27.45], [94.5, 27.55],
  [94.7, 27.64], [94.95, 27.78], [95.22, 27.92], [95.5, 27.97], [95.75, 28.0], [95.9, 27.88],
  [96.1, 27.83], [96.36, 27.88], [96.55, 28.0], [96.8, 28.07], [97.02, 28.12], [97.45, 28.12],
];
const ZANGNAN = [...ZANGNAN_SOUTH, [97.7, 29.95], [91.3, 29.95], [91.3, 27.3]].map(([lon, lat]) => proj(lon, lat));
const ZN_RING = Float64Array.from(ZANGNAN.flat());
const inZangnan = (p) => inRing(ZN_RING, p[0], p[1]);
const ISLANDS = [ // [经度, 纬度, 名称]
  [116.72, 20.7, '东沙岛'],
  [112.34, 16.83, '永兴岛'], [111.72, 16.45, '琛航岛'], [111.2, 15.78, '中建岛'],
  [114.4, 15.9, '中沙群岛'], [117.76, 15.15, '黄岩岛'],
  [114.28, 11.05, '中业岛'], [114.36, 10.38, '太平岛'], [112.89, 9.55, '永暑礁'], [115.54, 9.9, '美济礁'],
  [111.92, 8.64, '南威岛'], [113.84, 7.38, '弹丸礁'], [113.25, 6.33, '南通礁'], [112.28, 3.97, '曾母暗沙'],
  [123.47, 25.74, '钓鱼岛'], [124.56, 25.92, '赤尾屿'],
];
const DASHES = [ // 每段 [起点经度, 起点纬度, 终点经度, 终点纬度]
  [110.0, 15.555, 110.812, 14.248], [110.755, 10.911, 109.779, 9.257], [108.778, 5.723, 109.594, 4.083],
  [111.05, 3.505, 113.313, 4.485], [114.551, 5.86, 116.729, 8.395], [117.643, 9.632, 118.697, 11.527],
  [119.246, 16.306, 119.519, 18.755], [119.876, 19.744, 121.423, 21.2], [121.948, 21.451, 122.612, 22.241],
  [122.45, 23.3, 122.65, 24.55],
];
// 线段 p→q 上 test 结果改变的位置（二分）
function crossing(p, q, test) {
  let a = p, b = q;
  const ta = test(a);
  for (let i = 0; i < 32; i++) {
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (test(m) === ta) a = m; else b = m;
  }
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}
// 把折线切成若干段，每段整体在 test 内或整体在外，切点精确落在分界上
function splitRuns(pts, test) {
  const runs = [];
  let state = test(pts[0]), cur = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const s = test(pts[i]);
    if (s !== state) {
      const c = crossing(pts[i - 1], pts[i], test);
      cur.push(c);
      runs.push({ inside: state, pts: cur });
      cur = [c];
      state = s;
    }
    cur.push(pts[i]);
  }
  runs.push({ inside: state, pts: cur });
  return runs;
}

// ---------- 可复现随机 & 噪声 ----------
let seed = 20320314;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
function hash2(ix, iy) {
  let h = (ix * 374761393 + iy * 668265263) >>> 0;
  h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y) => (vnoise(x, y) * 0.55 + vnoise(x * 2.1 + 17, y * 2.1 + 5) * 0.3 + vnoise(x * 4.3 + 3, y * 4.3 + 11) * 0.15);

// ---------- 城市灯光 ----------
// [lon, lat, 人口(百万)]
const CITIES = [
  // 北美
  [-74.0, 40.71, 20], [-118.24, 34.05, 13], [-87.63, 41.88, 9.5], [-96.8, 32.78, 7.8], [-95.37, 29.76, 7.3], [-77.04, 38.9, 6.3],
  [-75.16, 39.95, 6.2], [-80.19, 25.76, 6.1], [-84.39, 33.75, 6.2], [-71.06, 42.36, 4.9], [-112.07, 33.45, 5], [-122.42, 37.77, 4.7],
  [-121.89, 37.34, 2], [-122.33, 47.61, 4], [-83.05, 42.33, 4.3], [-93.27, 44.98, 3.7], [-117.16, 32.72, 3.3], [-104.99, 39.74, 3],
  [-82.46, 27.95, 3.2], [-90.2, 38.63, 2.8], [-76.61, 39.29, 2.8], [-81.38, 28.54, 2.7], [-80.84, 35.23, 2.7], [-122.68, 45.52, 2.5],
  [-121.49, 38.58, 2.4], [-115.14, 36.17, 2.3], [-79.99, 40.44, 2.3], [-97.74, 30.27, 2.4], [-84.51, 39.1, 2.2], [-94.58, 39.1, 2.2],
  [-82.99, 39.96, 2.1], [-86.16, 39.77, 2.1], [-81.69, 41.5, 2], [-86.78, 36.16, 2], [-111.89, 40.76, 1.3], [-90.07, 29.95, 1.3],
  [-157.86, 21.31, 1], [-149.9, 61.22, 0.4], [-106.65, 35.08, 0.9], [-97.52, 35.47, 1.4], [-78.64, 35.78, 1.4], [-81.66, 30.33, 1.6],
  [-98.49, 29.42, 2.6], [-88.0, 43.04, 1.6], [-78.88, 42.89, 1.1], [-73.76, 42.65, 0.9], [-72.68, 41.76, 1.2], [-85.76, 38.25, 1.3],
  [-90.05, 35.15, 1.3], [-86.8, 33.52, 1.1], [-95.99, 36.15, 1], [-96.0, 41.26, 1], [-119.77, 36.74, 1], [-110.97, 32.22, 1.1],
  // 加拿大
  [-79.38, 43.65, 6.4], [-73.57, 45.5, 4.3], [-123.12, 49.28, 2.7], [-114.07, 51.05, 1.6], [-113.49, 53.55, 1.5], [-75.7, 45.42, 1.5],
  [-97.14, 49.9, 0.85], [-71.21, 46.81, 0.85], [-63.57, 44.65, 0.45],
  // 墨西哥与中美洲
  [-99.13, 19.43, 22], [-103.35, 20.66, 5.3], [-100.31, 25.69, 5.3], [-98.2, 19.04, 3.2], [-117.04, 32.51, 2.2], [-101.69, 21.12, 1.9],
  [-90.51, 14.63, 3], [-82.37, 23.11, 2.1], [-69.93, 18.49, 3.5], [-72.34, 18.54, 2.9], [-89.19, 13.69, 1.1], [-87.2, 14.07, 1.4],
  [-86.25, 12.13, 1.1], [-84.09, 9.93, 1.4], [-79.52, 8.98, 1.9], [-66.1, 18.47, 2.4], [-76.79, 18.0, 1.2], [-106.09, 28.63, 1],
  [-106.42, 31.69, 1.5], [-89.62, 20.97, 1.2], [-86.85, 21.16, 1],
  // 南美
  [-46.63, -23.55, 22.6], [-43.2, -22.9, 13.6], [-43.94, -19.92, 6], [-47.88, -15.79, 4.8], [-51.23, -30.03, 4.2], [-34.88, -8.05, 4.1],
  [-38.54, -3.72, 4.1], [-38.5, -12.97, 3.9], [-49.27, -25.43, 3.7], [-60.02, -3.12, 2.3], [-48.5, -1.46, 2.3], [-49.25, -16.68, 2.6],
  [-58.38, -34.6, 15.5], [-64.18, -31.42, 1.6], [-60.64, -32.95, 1.4], [-70.65, -33.45, 6.9], [-77.04, -12.05, 11], [-74.07, 4.71, 11.5],
  [-75.57, 6.24, 4.1], [-76.53, 3.45, 2.9], [-74.8, 10.96, 2.3], [-66.9, 10.48, 3], [-71.64, 10.64, 2.3], [-78.47, -0.18, 2],
  [-79.89, -2.19, 3.1], [-68.15, -16.5, 2], [-63.18, -17.78, 1.8], [-57.58, -25.26, 3.5], [-56.16, -34.9, 1.8], [-68.84, -32.89, 1.1],
  [-71.54, -16.4, 1.1], [-79.03, -8.11, 1], [-35.2, -5.79, 1.5], [-42.8, -5.09, 1], [-44.3, -2.53, 1.5], [-48.55, -27.6, 1.2],
  // 欧洲
  [-0.13, 51.51, 14.5], [2.35, 48.86, 11.2], [-3.7, 40.42, 6.8], [2.17, 41.39, 5.6], [13.4, 52.52, 4.7], [7.0, 51.45, 10],
  [9.99, 53.55, 3.4], [11.58, 48.14, 2.9], [8.68, 50.11, 2.7], [9.18, 48.78, 2.7], [12.5, 41.9, 4.3], [9.19, 45.46, 5.4],
  [14.27, 40.85, 3.1], [7.69, 45.07, 1.8], [23.73, 37.98, 3.6], [-9.14, 38.72, 2.9], [-8.61, 41.15, 1.7], [4.9, 52.37, 2.5],
  [4.48, 51.92, 1.8], [4.35, 50.85, 2.1], [16.37, 48.21, 2.9], [8.54, 47.37, 1.5], [-6.26, 53.35, 2], [-2.24, 53.48, 2.8],
  [-1.9, 52.49, 2.6], [-4.25, 55.86, 1.7], [-1.55, 53.8, 1.9], [4.83, 45.76, 2.3], [5.37, 43.3, 1.9], [3.06, 50.63, 1.2],
  [1.44, 43.6, 1.4], [18.07, 59.33, 2.4], [12.57, 55.68, 2.1], [10.75, 59.91, 1.6], [24.94, 60.17, 1.5], [21.01, 52.23, 3.2],
  [19.94, 50.06, 1.5], [19.02, 50.26, 2.7], [14.42, 50.08, 2.2], [19.04, 47.5, 3], [26.1, 44.43, 2.3], [23.32, 42.7, 1.6],
  [20.46, 44.79, 1.7], [30.52, 50.45, 3.5], [36.23, 49.99, 1.4], [27.56, 53.9, 2], [15.98, 45.81, 1.1], [24.11, 56.95, 1],
  [25.28, 54.69, 0.8], [30.73, 46.48, 1], [35.05, 48.46, 1], [-0.38, 39.47, 1.6], [-5.98, 37.39, 1.5], [22.94, 40.64, 1],
  [11.34, 44.49, 1], [11.25, 43.77, 1], [13.39, 38.12, 1.2], [-1.13, 52.63, 1], [-2.59, 51.45, 1], [-1.62, 54.97, 1.1],
  [6.96, 50.94, 1.1], [6.77, 51.23, 1.2], [8.8, 53.08, 0.6], [9.73, 52.37, 0.6], [12.37, 51.34, 0.6], [13.74, 51.05, 0.6],
  [11.08, 49.45, 0.8], [5.72, 45.19, 0.7], [7.26, 43.7, 1], [-1.55, 47.22, 1], [-0.58, 44.84, 1.2], [1.1, 49.44, 0.7],
  [-21.9, 64.15, 0.25], [5.32, 60.39, 0.4], [10.39, 63.43, 0.3], [11.97, 57.71, 1], [13.0, 55.6, 0.8], [23.76, 61.5, 0.4],
  [17.04, 51.11, 0.8], [16.93, 52.41, 0.8], [18.65, 54.35, 1], [21.26, 48.72, 0.6], [17.11, 48.15, 0.7], [16.61, 49.2, 0.6],
  [27.59, 47.16, 0.5], [23.6, 46.77, 0.7], [21.23, 45.75, 0.6], [28.86, 47.01, 0.7], [19.83, 41.33, 0.9], [21.43, 42.0, 0.6],
  // 俄罗斯
  [37.62, 55.75, 17], [30.3, 59.94, 5.6], [82.92, 55.03, 1.7], [60.6, 56.84, 1.6], [49.11, 55.79, 1.3], [44.0, 56.33, 1.3],
  [61.4, 55.16, 1.2], [50.1, 53.2, 1.2], [73.37, 54.99, 1.1], [39.72, 47.23, 1.1], [55.96, 54.73, 1.1], [92.87, 56.01, 1.1],
  [44.5, 48.7, 1], [104.3, 52.3, 0.6], [131.89, 43.12, 0.6], [135.07, 48.48, 0.6], [39.2, 51.67, 1], [56.25, 58.0, 1],
  [38.98, 45.04, 0.9], [46.03, 51.53, 0.8], [65.53, 57.15, 0.8], [86.09, 55.35, 0.5], [87.12, 53.76, 0.5], [83.78, 53.35, 0.6],
  [40.1, 47.7, 0.4], [36.19, 51.73, 0.4], [37.6, 54.2, 0.5], [39.89, 57.63, 0.6], [33.07, 68.97, 0.3], [40.52, 64.54, 0.35],
  [113.5, 52.03, 0.35], [127.53, 50.27, 0.2], [129.73, 62.03, 0.3], [150.8, 59.57, 0.1], [158.65, 53.02, 0.2], [73.4, 61.25, 0.4],
  [76.57, 60.94, 0.3], [88.2, 69.35, 0.18],
  // 中东
  [28.98, 41.0, 16], [32.85, 39.93, 5.7], [27.14, 38.42, 3], [51.39, 35.69, 9.5], [59.6, 36.3, 3.3], [51.67, 32.65, 2.2],
  [44.36, 33.31, 7.5], [46.72, 24.71, 7.7], [39.17, 21.54, 4.7], [55.27, 25.2, 3.6], [54.37, 24.45, 1.5], [51.53, 25.29, 2.4],
  [47.98, 29.37, 3.2], [35.93, 31.95, 4.5], [36.29, 33.51, 2.6], [37.16, 36.2, 2.1], [35.5, 33.89, 2.4], [34.78, 32.08, 4.2],
  [35.21, 31.77, 1], [44.21, 15.37, 3.3], [58.41, 23.59, 1.6], [47.78, 30.51, 1.4], [43.13, 36.34, 1.7], [46.29, 38.08, 1.6],
  [52.53, 29.59, 1.6], [48.68, 31.32, 1.3], [50.58, 26.2, 0.7], [39.83, 21.42, 2], [39.61, 24.47, 1.3], [50.1, 26.4, 1.2],
  [30.7, 36.9, 1.2], [35.32, 37.0, 1.8], [29.06, 40.18, 2], [37.38, 37.06, 1.8], [45.03, 12.79, 1], [34.45, 31.5, 0.7],
  // 北非
  [31.24, 30.04, 22], [29.92, 31.2, 5.5], [-7.59, 33.57, 3.8], [3.06, 36.75, 3], [10.18, 36.8, 2.4], [32.53, 15.5, 6],
  [13.19, 32.89, 1.2], [-6.84, 34.02, 1.9], [-8.0, 31.63, 1.3], [-0.64, 35.7, 1], [6.61, 36.36, 0.5], [-5.0, 34.03, 1.2],
  [20.07, 32.12, 0.8], [32.3, 31.26, 0.8], [31.13, 27.18, 0.6],
  // 西非
  [3.38, 6.52, 16], [8.52, 12.0, 4.3], [3.9, 7.38, 3.8], [7.49, 9.06, 3.8], [-0.19, 5.6, 2.7], [-1.62, 6.69, 3.6],
  [-4.03, 5.36, 5.5], [-17.44, 14.69, 3.4], [-8.0, 12.64, 2.9], [-1.52, 12.37, 3], [-13.58, 9.64, 2], [9.7, 4.05, 4],
  [11.52, 3.85, 4.3], [2.11, 13.51, 1.4], [15.04, 12.13, 1.6], [1.23, 6.13, 2], [2.42, 6.37, 0.7], [-13.23, 8.48, 1.3],
  [-10.8, 6.3, 1.6], [7.0, 4.82, 3.5], [15.28, -4.27, 2.5], [7.44, 10.52, 1.2], [13.16, 11.85, 1], [5.62, 6.34, 1.8],
  [-15.98, 18.08, 1.3],
  // 东非
  [38.74, 9.03, 5.5], [36.82, -1.29, 5.3], [39.21, -6.79, 7.7], [32.58, 0.35, 3.8], [45.34, 2.05, 2.8], [15.27, -4.44, 17],
  [27.48, -11.66, 2.6], [23.6, -6.14, 2.6], [30.06, -1.94, 1.3], [39.67, -4.04, 1.4], [43.15, 11.59, 0.6], [38.93, 15.32, 1],
  [31.58, 4.85, 0.5], [29.36, -3.38, 1.1], [25.19, 0.52, 1.4], [29.22, -1.68, 0.8], [32.9, -2.52, 1], [36.68, -3.37, 0.6],
  // 南部非洲
  [28.05, -26.2, 10], [18.42, -33.92, 4.8], [31.02, -29.86, 3.9], [13.23, -8.84, 9], [28.32, -15.39, 3.2], [31.05, -17.83, 2.2],
  [32.57, -25.97, 1.8], [47.52, -18.88, 3.8], [33.79, -13.96, 1.3], [17.08, -22.56, 0.5], [25.91, -24.65, 0.3], [25.6, -33.96, 1.2],
  [26.2, -29.1, 0.8], [35.0, -15.79, 1], [28.64, -12.97, 0.7], [15.73, -12.78, 0.9],
  // 中亚
  [76.95, 43.24, 2.2], [69.24, 41.3, 3], [71.47, 51.17, 1.4], [74.59, 42.87, 1.1], [68.79, 38.56, 1], [58.38, 37.96, 1],
  [49.87, 40.41, 2.4], [44.79, 41.72, 1.2], [44.51, 40.18, 1.1], [106.92, 47.89, 1.7], [66.96, 39.65, 0.6], [71.78, 40.38, 0.7],
  [73.1, 49.8, 0.5], [57.21, 50.28, 0.5],
  // 南亚
  [67.0, 24.86, 17], [74.34, 31.52, 14], [73.08, 31.42, 3.7], [73.05, 33.6, 3.5], [71.58, 34.01, 2.3], [90.41, 23.81, 23],
  [91.83, 22.36, 5.5], [69.17, 34.53, 4.6], [85.32, 27.72, 1.5], [79.86, 6.93, 2.5], [71.47, 30.2, 2], [68.37, 25.4, 1.9],
  [74.19, 32.16, 2.2], [66.98, 30.18, 1.1], [89.55, 22.82, 1], [88.6, 24.37, 1], [65.71, 31.61, 0.6], [62.2, 34.35, 0.5],
  // 印度
  [77.21, 28.61, 33], [72.88, 19.08, 22], [88.36, 22.57, 15.5], [77.59, 12.97, 14], [80.27, 13.08, 12], [78.49, 17.39, 11],
  [72.57, 23.02, 8.9], [73.86, 18.52, 7.2], [72.83, 21.17, 7.8], [75.79, 26.91, 4.2], [80.95, 26.85, 4], [80.33, 26.45, 3.2],
  [79.09, 21.15, 3], [75.86, 22.72, 3.3], [85.14, 25.59, 2.6], [77.41, 23.26, 2.5], [76.27, 9.93, 2.3], [83.22, 17.69, 2.3],
  [76.96, 11.02, 2.9], [91.74, 26.14, 1.2], [74.8, 34.08, 1.6], [76.78, 30.73, 1.2], [83.0, 25.32, 1.7], [76.94, 8.52, 1],
  [81.63, 21.25, 1.3], [85.82, 20.3, 1.2], [78.01, 27.18, 1.8], [77.7, 28.98, 1.5], [75.86, 30.9, 1.9], [73.02, 26.24, 1.4],
  [70.8, 22.3, 1.6], [79.95, 23.18, 1.4], [84.0, 21.5, 0.8], [86.2, 22.8, 1.4], [81.85, 25.43, 1.4], [78.1, 9.93, 1.6],
  [74.86, 12.91, 0.9], [76.64, 12.3, 1.1], [75.12, 15.36, 1], [73.19, 22.31, 2.2], [80.65, 16.51, 1.3], [79.43, 13.63, 0.6],
  [82.0, 26.8, 0.8], [87.3, 23.5, 0.9], [92.8, 24.8, 0.4], [94.1, 27.5, 0.2],
  // 中国
  [121.47, 31.23, 29], [116.4, 39.9, 22], [113.26, 23.13, 14.3], [114.06, 22.54, 13.5], [106.55, 29.56, 17], [104.07, 30.57, 9.6],
  [117.2, 39.13, 14], [114.31, 30.59, 8.9], [108.94, 34.34, 8.8], [120.16, 30.27, 8.2], [118.8, 32.06, 9.4], [123.43, 41.8, 7.2],
  [126.63, 45.75, 6.5], [113.63, 34.75, 7.2], [117.0, 36.67, 4.8], [120.38, 36.07, 5.3], [121.61, 38.91, 4.5], [112.94, 28.23, 5],
  [102.83, 24.88, 4.6], [119.3, 26.08, 4.3], [118.09, 24.48, 4.3], [117.23, 31.82, 5.1], [120.58, 31.3, 6.9], [112.55, 37.87, 4.2],
  [114.51, 38.04, 4.4], [108.37, 22.82, 4], [106.63, 26.65, 3.5], [87.62, 43.83, 3.5], [103.83, 36.06, 3.4], [125.32, 43.88, 4.7],
  [115.86, 28.68, 4], [114.17, 22.32, 7.5], [121.56, 25.03, 7], [120.3, 22.63, 2.7], [111.75, 40.84, 2.3], [91.14, 29.65, 0.3],
  [101.78, 36.62, 1.3], [106.23, 38.49, 1.5], [110.35, 20.02, 1.8], [120.7, 28.0, 3.8], [121.55, 29.87, 4], [113.75, 23.02, 8],
  [118.18, 39.63, 2.5], [117.28, 34.2, 2.5], [112.45, 34.62, 2], [109.84, 40.66, 1.7], [119.95, 31.78, 2.5], [120.3, 31.57, 3],
  [113.12, 23.02, 4], [113.39, 22.52, 2.5], [116.68, 23.35, 3], [114.35, 36.1, 1.5], [115.49, 38.87, 1.5], [116.99, 33.64, 1.2],
  [118.3, 35.1, 1.5], [119.16, 34.6, 1.2], [122.1, 37.5, 1.5], [124.35, 40.0, 1.2], [122.27, 43.61, 0.8], [130.97, 45.3, 0.8],
  [124.6, 46.6, 1.4], [109.49, 36.6, 0.8], [106.7, 35.5, 0.6], [100.47, 38.93, 0.6], [94.66, 40.14, 0.3], [81.3, 43.9, 0.5],
  [75.99, 39.47, 0.8], [110.3, 25.27, 1], [109.6, 23.1, 0.7], [104.63, 28.77, 1], [105.44, 28.87, 0.8], [106.08, 30.8, 1.5],
  [104.4, 31.13, 0.9], [111.28, 30.7, 1], [113.0, 25.8, 1], [112.2, 32.0, 1.2], [114.0, 27.6, 0.8], [115.9, 32.9, 1],
  [117.02, 25.08, 0.6], [100.2, 25.6, 0.6], [103.4, 23.4, 0.8], [99.1, 21.9, 0.3], [88.9, 29.3, 0.1], [97.2, 31.1, 0.1],
  // 朝鲜半岛
  [126.98, 37.57, 25], [129.08, 35.18, 3.4], [128.6, 35.87, 2.4], [127.38, 36.35, 1.5], [126.85, 35.16, 1.5], [129.31, 35.54, 1.1],
  [127.15, 37.26, 1.2], [126.7, 37.45, 3], [125.75, 39.02, 0.35], [129.5, 41.8, 0.05], [127.5, 39.9, 0.06],
  // 日本
  [139.69, 35.69, 37], [135.5, 34.69, 19], [136.91, 35.18, 9], [130.4, 33.59, 5.5], [141.35, 43.06, 2.6], [140.87, 38.27, 2.3],
  [132.46, 34.39, 2.1], [135.77, 35.01, 1.5], [133.92, 34.66, 1.5], [130.71, 32.8, 1.5], [138.38, 34.97, 1.4], [139.02, 37.92, 0.8],
  [131.6, 33.24, 0.5], [134.55, 34.07, 0.5], [140.74, 40.82, 0.6], [141.15, 39.7, 0.5], [127.68, 26.21, 1.3], [137.7, 34.7, 0.8],
  // 东南亚
  [106.85, -6.2, 34], [112.75, -7.25, 9.9], [107.62, -6.91, 8.5], [98.67, 3.6, 4.7], [110.42, -6.97, 3], [104.75, -2.99, 2.2],
  [119.42, -5.14, 2.1], [120.98, 14.6, 24], [123.89, 10.32, 3], [125.61, 7.07, 2], [100.5, 13.75, 17], [106.63, 10.82, 13.5],
  [105.85, 21.03, 8.5], [101.69, 3.14, 8.4], [103.82, 1.35, 6], [96.16, 16.87, 5.6], [96.08, 21.97, 1.5], [104.92, 11.56, 2.3],
  [102.63, 17.97, 0.9], [115.22, -8.65, 1.5], [110.37, -7.8, 2.2], [100.33, 5.41, 1.8], [103.74, 1.49, 1.8], [108.2, 16.05, 1.3],
  [106.68, 20.86, 1.4], [98.99, 18.79, 1.2], [116.1, -8.58, 0.7], [109.33, -0.03, 0.7], [116.83, -1.24, 0.8], [124.84, 1.47, 0.6],
  [122.56, 10.72, 0.7], [110.33, 1.55, 0.7], [100.36, -0.95, 1], [106.83, -6.6, 2], [113.9, 4.4, 0.4], [114.95, 4.9, 0.3],
  // 大洋洲
  [151.21, -33.87, 5.4], [144.96, -37.81, 5.2], [153.03, -27.47, 2.7], [115.86, -31.95, 2.2], [138.6, -34.93, 1.4], [174.76, -36.85, 1.8],
  [149.13, -35.28, 0.5], [174.78, -41.29, 0.4], [172.64, -43.53, 0.4], [147.18, -9.44, 0.4], [153.4, -28.0, 0.7], [151.78, -32.93, 0.5],
  [147.33, -42.88, 0.25], [130.84, -12.46, 0.15], [145.77, -16.92, 0.2], [146.82, -19.26, 0.2], [178.44, -18.14, 0.2], [166.46, -22.27, 0.2],
];
const cityPts = CITIES.map(([lon, lat, pop]) => {
  const [x, y] = proj(wrapLon(lon), lat);
  return { x, y, w: Math.pow(pop, 0.6), s: 3.2 + 1.35 * Math.sqrt(pop) };
});

// ---------- 生成点阵 ----------
const S = 5.2;
const RH = S * Math.sqrt(3) / 2;
const dots = []; // {x,y,r,light}
const taken = new Set();
let zangnanDots = 0;
for (let row = 0; ; row++) {
  const y = RH * (row + 0.5);
  if (y > H) break;
  for (let col = 0; ; col++) {
    const x = S * (col + 0.5 + (row & 1) * 0.5);
    if (x > W) break;
    let r = locate(x, y);
    if (r < 0) continue;
    if (r === RIDX.IN && inZangnan([x, y])) { r = RIDX.CN; zangnanDots++; }
    dots.push({ x, y, r });
    taken.add(row + ',' + col);
  }
}
// 岛礁吸附到最近的网格点，与其他陆地点保持同一点阵
let islandDots = 0;
for (const [lon, lat, name] of ISLANDS) {
  const [ix, iy] = proj(lon, lat);
  let best = null, bd = Infinity;
  const row0 = Math.floor(iy / RH - 0.5);
  for (let row = row0 - 1; row <= row0 + 2; row++) {
    const col0 = Math.floor(ix / S - 0.5 - (row & 1) * 0.5);
    for (let col = col0 - 1; col <= col0 + 2; col++) {
      const x = S * (col + 0.5 + (row & 1) * 0.5), y = RH * (row + 0.5);
      const d = Math.hypot(x - ix, y - iy);
      if (d < bd) { bd = d; best = { row, col, x, y }; }
    }
  }
  const key = best.row + ',' + best.col;
  if (taken.has(key)) continue; // 同一网格点已有岛礁或陆地
  taken.add(key);
  dots.push({ x: best.x, y: best.y, r: RIDX.CN });
  islandDots++;
}
console.log('陆地点数:', dots.length, ` 其中藏南 ${zangnanDots}、补绘岛礁 ${islandDots}`);

// 灯光
const regionBase = REGIONS.map((r) => 0.05 + 0.18 * r.conn * r.conn);
for (const d of dots) {
  let sum = 0;
  for (const c of cityPts) {
    const dx = d.x - c.x, dy = d.y - c.y;
    const d2 = dx * dx + dy * dy;
    const s2 = c.s * c.s;
    if (d2 > s2 * 9) continue;
    sum += c.w * Math.exp(-d2 / (2 * s2));
  }
  const city = 1 - Math.exp(-0.55 * sum);
  const rural = regionBase[d.r] * (0.35 + 0.9 * fbm(d.x * 0.05, d.y * 0.05)) * (0.5 + rand() * 0.5);
  d.light = Math.min(1, city + rural * (1 - city));
}

// 蔓延顺序：从 hub 向外，叠加分形噪声形成触手状蔓延
const regionDots = REGIONS.map(() => []);
dots.forEach((d) => regionDots[d.r].push(d));
const ordered = [];
const regionRanges = [];
REGIONS.forEach((reg, ri) => {
  const list = regionDots[ri];
  const [hx, hy] = proj(wrapLon(reg.hub[0]), reg.hub[1]);
  for (const d of list) {
    const dx = d.x - hx, dy = d.y - hy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const n = fbm(d.x * 0.018 + ri * 7.3, d.y * 0.018 + ri * 3.1);
    // 城市更早被感染（网络更密集）
    d.key = dist * (0.55 + 0.9 * n) * (1 - 0.35 * d.light) + rand() * S * 2.2;
  }
  list.sort((a, b) => a.key - b.key);
  regionRanges.push([ordered.length, list.length]);
  for (const d of list) ordered.push(d);
});
REGIONS.forEach((r, i) => console.log(`  ${r.id.padEnd(4)} ${r.name.padEnd(8)} 点数 ${regionRanges[i][1]}`));

// ---------- 海岸线 / 地区边界 ----------
function simplify(pts, tol) { // Douglas-Peucker, pts: [[x,y],...]
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  const t2 = tol * tol;
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-12;
    let maxD = -1, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      let t = ((px - ax) * dx + (py - ay) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const ex = ax + t * dx - px, ey = ay + t * dy - py;
      const d2 = ex * ex + ey * ey;
      if (d2 > maxD) { maxD = d2; idx = i; }
    }
    if (maxD > t2) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

const arcOut = [];     // Int16 数据
const arcMeta = [];    // [a, b, start, count]；b = -1 海岸线，b = -2 南海断续线
const adjacency = new Set();
let coastCount = 0, borderCount = 0;
function pushArc(a, b, sp) {
  const start = arcOut.length / 2;
  let px = 0, py = 0;
  sp.forEach(([x, y], i) => {
    const qx = Math.round(x * 10), qy = Math.round(y * 10);
    if (i === 0) { arcOut.push(qx, qy); } else { arcOut.push(qx - px, qy - py); }
    px = qx; py = qy;
  });
  arcMeta.push([a, b, start, sp.length]);
}
function emitArc(regs, pts) {
  let a = regs[0], b = -1;
  if (regs.length >= 2) {
    b = regs[1];
    if (a === b) return; // 地区内部国界，不画
    if (a > b) [a, b] = [b, a];
    adjacency.add(a + ',' + b);
    borderCount++;
  } else coastCount++;
  // 过滤极小的岛屿碎片
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  if (b < 0 && len < 1.6) return;
  pushArc(a, b, simplify(pts, 0.28));
}
for (const [k, users] of arcUse) {
  const regs = users.map((u) => u.region);
  const ll = unwrap(arcsLL[k]);
  const shift = shiftFor(ll);
  const pts = ll.map(([lon, lat]) => proj(lon + shift, lat));
  if (!regs.includes(RIDX.IN)) { emitArc(regs, pts); continue; }
  // 印度的国界穿过藏南时切开：藏南内的部分归中国（麦克马洪线因此成为中国内部的线，不再绘制）
  for (const run of splitRuns(pts, inZangnan)) {
    emitArc(run.inside ? regs.map((g) => (g === RIDX.IN ? RIDX.CN : g)) : regs, run.pts);
  }
}
// 藏南南缘成为中印边界：取 ZANGNAN_SOUTH 落在原印度多边形内的部分
{
  const inIndia = (p) => locate(p[0], p[1]) === RIDX.IN;
  const runs = splitRuns(ZANGNAN_SOUTH.map(([lon, lat]) => proj(lon, lat)), inIndia).filter((r) => r.inside);
  if (runs.length !== 1) throw new Error('藏南南缘应恰好一段落在印度境内，实际 ' + runs.length);
  emitArc([RIDX.CN, RIDX.IN], runs[0].pts);
}
for (const [lon0, lat0, lon1, lat1] of DASHES) pushArc(RIDX.CN, -2, [proj(lon0, lat0), proj(lon1, lat1)]);
console.log(`海岸线弧 ${coastCount}  边界弧 ${borderCount}  断续线 ${DASHES.length} 段  输出点 ${arcOut.length / 2}`);

// ---------- 校验：hub 与设施是否落在所属地区 ----------
const lookup = new Map();
const CELL = 12;
ordered.forEach((d, i) => {
  const key = Math.floor(d.x / CELL) + ',' + Math.floor(d.y / CELL);
  if (!lookup.has(key)) lookup.set(key, []);
  lookup.get(key).push(i);
});
function nearestDot(x, y) {
  let best = -1, bd = Infinity;
  const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
  for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) {
    const arr = lookup.get((cx + ox) + ',' + (cy + oy));
    if (!arr) continue;
    for (const i of arr) {
      const d = Math.hypot(ordered[i].x - x, ordered[i].y - y);
      if (d < bd) { bd = d; best = i; }
    }
  }
  return [best, bd];
}
let warn = 0;
REGIONS.forEach((reg) => {
  const pts = [['HUB', reg.hubName, reg.hub[0], reg.hub[1]], ...reg.sites];
  for (const [type, name, lon, lat] of pts) {
    const [x, y] = proj(wrapLon(lon), lat);
    const [i, d] = nearestDot(x, y);
    const got = i >= 0 ? REGIONS[ordered[i].r].id : '无';
    if (got !== reg.id || d > 8) { warn++; console.warn(`  ! ${reg.id} ${type} ${name}: 最近点属于 ${got}，距离 ${d.toFixed(1)}`); }
  }
});
console.log('设施校验警告:', warn);

// ---------- 输出 ----------
const n = ordered.length;
const xy = new Uint16Array(n * 2);
const light = new Uint8Array(n);
ordered.forEach((d, i) => {
  xy[i * 2] = Math.round(d.x * 32);
  xy[i * 2 + 1] = Math.round(d.y * 32);
  light[i] = Math.round(d.light * 255);
});
const arcs = Int16Array.from(arcOut);
const b64 = (ta) => Buffer.from(ta.buffer, ta.byteOffset, ta.byteLength).toString('base64');
const data = {
  W, H: +H.toFixed(4), S, lon0: LON0, latTop: LAT_TOP, latBot: LAT_BOT,
  count: n,
  regionRanges,
  adjacency: [...adjacency].map((s) => s.split(',').map(Number)),
  dots: b64(xy),
  light: b64(light),
  arcs: b64(arcs),
  arcMeta,
};
const js = '/* 由 tools/build-map.mjs 生成，请勿手动修改。地图数据来源：Natural Earth（公共领域），经 world-atlas 转换。 */\n' +
  '(function (A) { A.WORLD = ' + JSON.stringify(data) + '; })(window.AINOID = window.AINOID || {});\n';
fs.writeFileSync(OUT, js);
console.log('写入', path.relative(ROOT, OUT), (js.length / 1024).toFixed(1) + ' KB');
console.log('地区相邻:', data.adjacency.map(([a, b]) => REGIONS[a].id + '-' + REGIONS[b].id).join(' '));
