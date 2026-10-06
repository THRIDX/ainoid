/* AINOID — 世界数据：解码点阵、地区、设施、海岸线，提供投影与空间查询 */
(function (A) {
  'use strict';
  const U = A.U;
  const Wd = A.WORLD;

  const world = {
    W: Wd.W, H: Wd.H, S: Wd.S,
    regions: [], byId: {}, sites: [], arcs: [],
  };

  // ---------- 投影 ----------
  const D2R = Math.PI / 180;
  const my = (lat) => 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * lat * D2R));
  const YT = my(Wd.latTop), YB = my(Wd.latBot);
  world.proj = (lon, lat) => {
    if (lon < Wd.lon0) lon += 360;
    return [(lon - Wd.lon0) / 360 * Wd.W, (YT - my(lat)) / (YT - YB) * Wd.H];
  };
  world.latOfY = (y) => {
    const m = YT - y / Wd.H * (YT - YB);
    return (2.5 * Math.atan(Math.exp(0.8 * m)) - 0.625 * Math.PI) / D2R;
  };
  world.yOfLat = (lat) => (YT - my(lat)) / (YT - YB) * Wd.H;
  world.xOfLon = (lon) => (lon - Wd.lon0) / 360 * Wd.W;
  world.millerTop = YT; world.millerBot = YB; world.lon0 = Wd.lon0;

  function b64ToBytes(s) {
    const bin = atob(s);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }

  // ---------- 点阵 ----------
  const n = Wd.count;
  const xyRaw = new Uint16Array(b64ToBytes(Wd.dots).buffer);
  const lightRaw = b64ToBytes(Wd.light);
  world.count = n;
  world.dx = new Float32Array(n);
  world.dy = new Float32Array(n);
  world.light = new Float32Array(n);
  world.noise = new Float32Array(n);   // 生物污染形状
  world.noise2 = new Float32Array(n);  // 战火形状
  world.seed = new Float32Array(n);
  world.dregion = new Uint8Array(n);
  const rng = U.makeRng(911);
  for (let i = 0; i < n; i++) {
    const x = xyRaw[i * 2] / 32, y = xyRaw[i * 2 + 1] / 32;
    world.dx[i] = x; world.dy[i] = y;
    world.light[i] = lightRaw[i] / 255;
    world.noise[i] = U.fbm(x * 0.021 + 3.7, y * 0.021 + 1.3);
    world.noise2[i] = U.fbm(x * 0.03 + 11.1, y * 0.03 + 7.9);
    world.seed[i] = rng();
  }

  // ---------- 地区 ----------
  A.REGIONS.forEach((meta, ri) => {
    const [start, count] = Wd.regionRanges[ri];
    const r = Object.assign({}, meta, { idx: ri, start, count, links: new Map() });
    let sx = 0, sy = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, pw = 0;
    for (let i = start; i < start + count; i++) {
      world.dregion[i] = ri;
      const x = world.dx[i], y = world.dy[i];
      const w = 0.2 + world.light[i];
      sx += x * w; sy += y * w; pw += w;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    r.cx = sx / pw; r.cy = sy / pw;
    r.bbox = [x0, y0, x1, y1];
    r.hubXY = world.proj(meta.hub[0], meta.hub[1]);
    r.labelXY = world.proj(meta.label[0], meta.label[1]);
    r.order = new Uint32Array(count); // 按蔓延顺序排列的点索引
    for (let i = 0; i < count; i++) r.order[i] = start + i;
    world.regions.push(r);
    world.byId[r.id] = r;
  });

  // 连接关系：陆地相邻 1.0，海底光缆 0.8
  for (const [a, b] of Wd.adjacency) {
    world.regions[a].links.set(b, 1.0);
    world.regions[b].links.set(a, 1.0);
  }
  for (const [ia, ib] of A.LINKS) {
    const a = world.byId[ia].idx, b = world.byId[ib].idx;
    if (!world.regions[a].links.has(b)) world.regions[a].links.set(b, 0.8);
    if (!world.regions[b].links.has(a)) world.regions[b].links.set(a, 0.8);
  }

  // ---------- 设施 ----------
  let sid = 0;
  world.regions.forEach((r) => {
    const src = A.REGIONS[r.idx].sites;
    r.sites = [];
    for (const [type, name, lon, lat] of src) {
      const [x, y] = world.proj(lon, lat);
      const s = { id: sid++, region: r.idx, type, name, x, y, ox: x, oy: y, owned: false, ownedAt: -1 };
      r.sites.push(s);
      world.sites.push(s);
    }
  });
  // 轻微的斥力布局，避免图标重叠
  (function relax() {
    const MIN = 11;
    for (let it = 0; it < 40; it++) {
      for (let i = 0; i < world.sites.length; i++) {
        for (let j = i + 1; j < world.sites.length; j++) {
          const a = world.sites[i], b = world.sites[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          if (d < MIN) {
            if (d < 0.01) { dx = 1; dy = 0; }
            const push = (MIN - d) / 2 * 0.5;
            const nx = dx / (d || 1), ny = dy / (d || 1);
            a.x -= nx * push; a.y -= ny * push;
            b.x += nx * push; b.y += ny * push;
          }
        }
      }
      // 弹回原位
      for (const s of world.sites) { s.x += (s.ox - s.x) * 0.08; s.y += (s.oy - s.y) * 0.08; }
    }
  })();

  // ---------- 海岸线 / 边界 ----------
  const arcRaw = new Int16Array(b64ToBytes(Wd.arcs).buffer);
  for (const [a, b, start, count] of Wd.arcMeta) {
    const pts = new Float32Array(count * 2);
    let px = 0, py = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let j = 0; j < count; j++) {
      const k = (start + j) * 2;
      if (j === 0) { px = arcRaw[k]; py = arcRaw[k + 1]; } else { px += arcRaw[k]; py += arcRaw[k + 1]; }
      const x = px / 10, y = py / 10;
      pts[j * 2] = x; pts[j * 2 + 1] = y;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    world.arcs.push({ a, b, pts, bbox: [x0, y0, x1, y1], border: b >= 0, claim: b === -2 }); // b = -2：南海断续线
  }
  world.regions.forEach((r) => { r.arcs = world.arcs.filter((arc) => arc.a === r.idx || arc.b === r.idx); });

  // ---------- 空间查询：最近陆地点 ----------
  const CELL = 10;
  const GW = Math.ceil(Wd.W / CELL) + 1, GH = Math.ceil(Wd.H / CELL) + 1;
  const cellStart = new Int32Array(GW * GH + 1);
  const cellOf = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const c = Math.min(GH - 1, Math.floor(world.dy[i] / CELL)) * GW + Math.min(GW - 1, Math.floor(world.dx[i] / CELL));
    cellOf[i] = c; cellStart[c + 1]++;
  }
  for (let c = 0; c < GW * GH; c++) cellStart[c + 1] += cellStart[c];
  const fill = cellStart.slice(0, GW * GH);
  const cellItems = new Int32Array(n);
  for (let i = 0; i < n; i++) cellItems[fill[cellOf[i]]++] = i;

  world.nearestDot = (x, y, maxDist) => {
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
    const rad = Math.max(1, Math.ceil(maxDist / CELL));
    let best = -1, bd = maxDist * maxDist;
    for (let oy = -rad; oy <= rad; oy++) {
      const yy = cy + oy; if (yy < 0 || yy >= GH) continue;
      for (let ox = -rad; ox <= rad; ox++) {
        const xx = cx + ox; if (xx < 0 || xx >= GW) continue;
        const c = yy * GW + xx;
        for (let k = cellStart[c]; k < cellStart[c + 1]; k++) {
          const i = cellItems[k];
          const dx = world.dx[i] - x, dy = world.dy[i] - y;
          const d2 = dx * dx + dy * dy;
          if (d2 < bd) { bd = d2; best = i; }
        }
      }
    }
    return best;
  };
  world.regionAt = (x, y, maxDist) => {
    const i = world.nearestDot(x, y, maxDist || 9);
    return i >= 0 ? world.dregion[i] : -1;
  };

  // ---------- 渗透顺序：从入口点向外，分形噪声形成触手 ----------
  // 返回 region 内每个点的 rank(0..1)，并更新 r.order
  world.computeRank = (r, ex, ey, out) => {
    const keys = new Float32Array(r.count);
    const idx = new Uint32Array(r.count);
    for (let k = 0; k < r.count; k++) {
      const i = r.start + k;
      const dx = world.dx[i] - ex, dy = world.dy[i] - ey;
      const d = Math.sqrt(dx * dx + dy * dy);
      keys[k] = d * (0.5 + 1.0 * world.noise2[i]) * (1 - 0.4 * world.light[i]) + world.seed[i] * world.S * 2.4;
      idx[k] = k;
    }
    idx.sort((a, b) => keys[a] - keys[b]);
    for (let p = 0; p < r.count; p++) {
      const k = idx[p];
      r.order[p] = r.start + k;
      out[r.start + k] = r.count > 1 ? p / (r.count - 1) : 0;
    }
  };

  // 在地区已渗透部分随机取一点（inf 为 0..1），可偏向某位置
  world.randomInfectedDot = (r, inf) => {
    const m = Math.max(1, Math.floor(r.count * U.clamp(inf, 0, 1)));
    return r.order[Math.floor(Math.random() * m)];
  };
  world.randomDot = (r) => r.start + Math.floor(Math.random() * r.count);
  world.dotNear = (r, x, y, radius) => {
    for (let t = 0; t < 12; t++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * radius;
      const i = world.nearestDot(x + Math.cos(a) * d, y + Math.sin(a) * d, 8);
      if (i >= 0 && world.dregion[i] === r.idx) return i;
    }
    return -1;
  };

  A.world = world;
})(window.AINOID = window.AINOID || {});
