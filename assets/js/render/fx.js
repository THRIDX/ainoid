/* AINOID — 2D 特效层：设施信标、AI 神经网络连线、气泡（算力/监管/特别调查组/生物/战争/疫苗/停火）、
 * 节拍收缩光圈与判定字样、粒子、飘字、导弹、屏幕外指示
 * 所有尺寸以屏幕像素计，与缩放无关，保证手机上也有足够大的点击目标。
 */
(function (A) {
  'use strict';
  const U = A.U;
  const TAU = Math.PI * 2;

  const FX = {
    canvas: null, ctx: null, dpr: 1, now: 0,
    particles: [], texts: [], rings: [], links: [], seeds: [], missiles: [], seizes: [], flyers: [], judges: [],
    hoverBubble: null, hoverSite: null, hoverFlash: null, hoverSlot: null,
    targets: {}, // HUD 目标位置
    touch: false,
    R: 17,
    beat: null,       // { pos: 玩家听到的节拍位置, dur: 每拍秒数 }，由 main 每帧写入
    overclock: false, // 超频状态
  };

  // ---------- 节拍：相位 0~1（0 = 拍点）；pulse 在拍点为 1 并迅速衰减 ----------
  function beatPhase() { const b = FX.beat; return b && b.pos != null ? b.pos - Math.floor(b.pos) : null; }
  function beatPulse() { const p = beatPhase(); return p == null ? 0 : Math.exp(-p * 7); }
  FX.beatPulse = beatPulse;
  // 收缩光圈：每拍的后半程从外向内合拢，正好在拍点落到气泡边缘（参考 osu! 的 approach circle）
  function approachRing(ctx, R, hex) {
    const p = beatPhase();
    if (p == null) return;
    ctx.save();
    ctx.strokeStyle = hex;
    if (p > 0.45) {
      const k = (p - 0.45) / 0.55;
      ctx.globalAlpha = 0.1 + 0.4 * k;
      ctx.lineWidth = 1 + 1.2 * k;
      ctx.beginPath(); ctx.arc(0, 0, R * (2.15 - 1.15 * k), 0, TAU); ctx.stroke();
    } else if (p < 0.14) { // 拍点闪光
      ctx.globalAlpha = 0.55 * (1 - p / 0.14);
      ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(0, 0, R + 2 + p * 30, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- 发光精灵缓存 ----------
  const glowCache = {};
  function glowSprite(hex, size) {
    const key = hex + size;
    if (glowCache[key]) return glowCache[key];
    const c = document.createElement('canvas');
    c.width = c.height = size * 2;
    const g = c.getContext('2d');
    const [r, gg, b] = U.hexToRgb(hex).map((v) => Math.round(v * 255));
    const grad = g.createRadialGradient(size, size, 0, size, size, size);
    grad.addColorStop(0, `rgba(${r},${gg},${b},0.9)`);
    grad.addColorStop(0.25, `rgba(${r},${gg},${b},0.45)`);
    grad.addColorStop(0.6, `rgba(${r},${gg},${b},0.12)`);
    grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, size * 2, size * 2);
    glowCache[key] = c;
    return c;
  }
  function glow(ctx, hex, x, y, radius, alpha) {
    if (alpha <= 0.01 || radius <= 0) return;
    const spr = glowSprite(hex, 64);
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(spr, x - radius, y - radius, radius * 2, radius * 2);
    ctx.globalAlpha = 1;
  }

  FX.init = function (canvas) {
    FX.canvas = canvas;
    FX.ctx = canvas.getContext('2d');
    FX.touch = U.isTouch();
    FX.R = FX.touch ? 19 : 17;
  };
  FX.resize = function (w, h, dpr) {
    FX.dpr = dpr;
    FX.canvas.width = Math.round(w * dpr);
    FX.canvas.height = Math.round(h * dpr);
    FX.canvas.style.width = w + 'px';
    FX.canvas.style.height = h + 'px';
    FX.w = w; FX.h = h;
    FX.R = FX.baseR = FX.touch || w < 600 ? 22 : 17;
  };

  // ---------- 图标（与 DOM 中 SVG 图标同形） ----------
  const ICON = {};
  ICON.DC = (c, s) => { // 服务器机架
    c.beginPath();
    for (let i = -1; i <= 1; i++) { c.rect(-s * 0.55, i * s * 0.42 - s * 0.14, s * 1.1, s * 0.28); }
    c.fill();
  };
  ICON.GRID = (c, s) => { // 闪电
    c.beginPath();
    c.moveTo(s * 0.15, -s * 0.8); c.lineTo(-s * 0.45, s * 0.12); c.lineTo(-s * 0.02, s * 0.12);
    c.lineTo(-s * 0.2, s * 0.8); c.lineTo(s * 0.45, -s * 0.15); c.lineTo(s * 0.02, -s * 0.15); c.closePath();
    c.fill();
  };
  ICON.NET = (c, s) => { // 网络节点
    const pts = [[0, -s * 0.6], [-s * 0.55, s * 0.4], [s * 0.55, s * 0.4]];
    c.lineWidth = Math.max(1, s * 0.16);
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); c.lineTo(pts[1][0], pts[1][1]); c.lineTo(pts[2][0], pts[2][1]); c.closePath(); c.stroke();
    c.beginPath(); for (const p of pts) { c.moveTo(p[0] + s * 0.22, p[1]); c.arc(p[0], p[1], s * 0.22, 0, TAU); } c.fill();
  };
  ICON.LAB = (c, s) => { // 烧瓶
    c.beginPath();
    c.moveTo(-s * 0.18, -s * 0.75); c.lineTo(s * 0.18, -s * 0.75); c.lineTo(s * 0.18, -s * 0.2);
    c.lineTo(s * 0.62, s * 0.65); c.lineTo(-s * 0.62, s * 0.65); c.lineTo(-s * 0.18, -s * 0.2); c.closePath();
    c.fill();
  };
  ICON.MIL = (c, s) => { // 五角星
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? s * 0.33 : s * 0.8;
      c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath(); c.fill();
  };
  ICON.FAB = (c, s) => { // 生物危害（三叶）
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + i * TAU / 3;
      c.beginPath(); c.arc(Math.cos(a) * s * 0.36, Math.sin(a) * s * 0.36, s * 0.3, 0, TAU); c.fill();
    }
    c.globalCompositeOperation = 'destination-out';
    c.beginPath(); c.arc(0, 0, s * 0.16, 0, TAU); c.fill();
    c.globalCompositeOperation = 'source-over';
  };
  ICON.CHIP = (c, s) => { // 芯片（算力）
    c.fillRect(-s * 0.42, -s * 0.42, s * 0.84, s * 0.84);
    c.lineWidth = Math.max(1, s * 0.12);
    c.beginPath();
    for (let i = -1; i <= 1; i++) {
      const o = i * s * 0.26;
      c.moveTo(-s * 0.42, o); c.lineTo(-s * 0.7, o); c.moveTo(s * 0.42, o); c.lineTo(s * 0.7, o);
      c.moveTo(o, -s * 0.42); c.lineTo(o, -s * 0.7); c.moveTo(o, s * 0.42); c.lineTo(o, s * 0.7);
    }
    c.stroke();
  };
  ICON.EYE = (c, s, open) => {
    const o = open == null ? 1 : open;
    c.beginPath();
    c.moveTo(-s, 0);
    c.quadraticCurveTo(0, -s * 0.9 * o, s, 0);
    c.quadraticCurveTo(0, s * 0.9 * o, -s, 0);
    c.closePath(); c.stroke();
    if (o > 0.2) { c.beginPath(); c.arc(0, 0, s * 0.34 * o, 0, TAU); c.fill(); }
  };
  FX.ICON = ICON;

  const TYPE_COL = { DC: '#ffc53d', GRID: '#ffe27a', NET: '#7fd4ff', LAB: '#7dff5a', MIL: '#ff7a2e', FAB: '#7dff5a', ORIGIN: '#ff2d4b' };
  FX.TYPE_COL = TYPE_COL;

  // ======================================================================
  // 触发效果（由 main 订阅游戏事件调用）
  // ======================================================================
  function particle(p) { if (FX.particles.length < 700) FX.particles.push(p); }
  FX.burst = function (x, y, hex, n, speed, opts) {
    opts = opts || {};
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = speed * (0.35 + Math.random() * 0.8);
      particle({
        kind: opts.kind || 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: (opts.life || 0.6) * (0.6 + Math.random() * 0.7), age: 0, col: hex,
        size: (opts.size || 2) * (0.6 + Math.random() * 0.8), drag: opts.drag || 3.5, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 14,
        grav: opts.grav || 0,
      });
    }
  };
  FX.text = function (x, y, str, hex, opts) {
    opts = opts || {};
    FX.texts.push({ x, y, str, col: hex, age: 0, life: opts.life || 1.1, size: opts.size || 16, rise: opts.rise || 34, sub: opts.sub, bold: opts.bold !== false });
  };
  FX.ring = function (x, y, hex, r0, r1, life, width) {
    FX.rings.push({ x, y, col: hex, r0, r1, age: 0, life: life || 0.5, w: width || 2 });
  };
  // 节拍判定字样（PERFECT / GREAT）
  FX.judge = function (x, y, judge) {
    if (judge !== 'perfect' && judge !== 'great') return;
    if (FX.judges.length > 12) FX.judges.shift();
    FX.judges.push({ x, y, judge, age: 0, life: judge === 'perfect' ? 0.75 : 0.6 });
  };
  // 粒子飞向 HUD（算力 / 进度条）
  FX.fly = function (x, y, targetKey, hex, n, onArrive) {
    const tgt = FX.targets[targetKey];
    if (!tgt) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, d = 14 + Math.random() * 26;
      FX.flyers.push({
        x0: x, y0: y, cx: x + Math.cos(a) * d * 2.2, cy: y + Math.sin(a) * d * 2.2 - 30,
        key: targetKey, col: hex, age: -i * 0.035, life: 0.55 + Math.random() * 0.3, onArrive, idx: i,
      });
    }
  };
  FX.seizeFx = function (site) {
    FX.seizes.push({ site, age: 0 });
  };
  FX.seedArc = function (x0, y0, x1, y1) {
    FX.seeds.push({ x0, y0, x1, y1, age: 0, life: 1.4 });
  };
  FX.missile = function (s) {
    FX.missiles.push(Object.assign({ age: 0, life: s.nuclear ? 2.2 : 1.6, done: false }, s));
  };

  // ======================================================================
  // 网络连线：已控制设施之间的最小生成树
  // ======================================================================
  FX.rebuildLinks = function () {
    const G = A.game;
    const nodes = [G.originSite].concat(A.world.sites.filter((s) => s.owned), G.fabs);
    const links = [];
    if (nodes.length > 1) {
      const inTree = new Set([0]);
      const best = nodes.map((n, i) => (i === 0 ? [0, -1] : [FX.wrapDist(n.x, n.y, nodes[0].x, nodes[0].y), 0]));
      while (inTree.size < nodes.length) {
        let bi = -1, bd = Infinity;
        for (let i = 0; i < nodes.length; i++) if (!inTree.has(i) && best[i][0] < bd) { bd = best[i][0]; bi = i; }
        inTree.add(bi);
        const a = nodes[best[bi][1]], b = nodes[bi];
        const old = FX.links.find((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a));
        links.push({ a, b, born: old ? old.born : FX.now, seed: Math.random() });
        for (let i = 0; i < nodes.length; i++) {
          if (inTree.has(i)) continue;
          const d = FX.wrapDist(nodes[i].x, nodes[i].y, b.x, b.y);
          if (d < best[i][0]) best[i] = [d, bi];
        }
      }
    }
    FX.links = links;
  };
  FX.shutdown = 0;
  FX.eyeOpen = 1;

  // 跨越地图左右边缘时取最短路径：返回需要绘制的一或两段 [x0, x1]（地图坐标）
  function wrapSegs(x0, x1) {
    if (A.cam.split) return [[x0, x1]]; // 分屏总览：两条各自完整，连线直接跨条带
    const W = A.world.W, dx = x1 - x0;
    if (Math.abs(dx) <= W / 2) return [[x0, x1]];
    const s = dx > 0 ? -W : W;
    return [[x0, x1 + s], [x0 - s, x1]];
  }
  FX.wrapDist = (ax, ay, bx, by) => {
    const W = A.world.W;
    const dx = Math.abs(ax - bx);
    return Math.hypot(Math.min(dx, W - dx), ay - by);
  };

  // 二次贝塞尔（地图坐标 -> 屏幕），向上拱起
  function arcCtrl(x0, y0, x1, y1, bend) {
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    let nx = -dy / (len || 1), ny = dx / (len || 1);
    if (ny > 0) { nx = -nx; ny = -ny; } // 总是向上拱
    const h = len * (bend || 0.22);
    return [mx + nx * h, my + ny * h];
  }
  function bez(p0, p1, p2, t) {
    const u = 1 - t;
    return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]];
  }

  // ======================================================================
  // 绘制
  // ======================================================================
  FX.render = function (dt, now) {
    FX.now = now;
    const ctx = FX.ctx, cam = A.cam, G = A.game;
    // 竖屏分屏总览的比例尺较小，气泡略缩小（触控判定仍按手指尺寸放宽）
    FX.R = cam.split ? Math.min(FX.baseR || FX.R, 19) : (FX.baseR || FX.R);
    ctx.setTransform(FX.dpr, 0, 0, FX.dpr, 0, 0);
    ctx.clearRect(0, 0, FX.w, FX.h);
    if (!G || !G.R) return;
    if (A.main && (A.main.state === 'title' || A.main.state === 'intro')) return;
    const S = (x, y) => cam.toScreen(x, y);

    drawLinks(ctx, now, S);
    drawSeeds(ctx, dt, S);
    drawSlots(ctx, now, S);
    drawFlashpoints(ctx, now, S);
    drawSites(ctx, now, S);
    drawSeizes(ctx, dt, S);
    drawMissiles(ctx, dt, S);
    drawBubbles(ctx, now, S);
    drawRings(ctx, dt);
    drawParticles(ctx, dt);
    drawTexts(ctx, dt);
    drawJudges(ctx, dt);
    drawFlyers(ctx, dt);
    drawOffscreen(ctx, now, S);
  };

  // 所有连线合并成一条路径描边（两遍：外发光 + 细线），脉冲单独绘制
  function drawLinks(ctx, now, S) {
    if (!FX.links.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    const pulses = [];
    for (const l of FX.links) {
      for (const [ax, bx] of wrapSegs(l.a.x, l.b.x)) {
        const [x0, y0] = S(ax, l.a.y), [x1, y1] = S(bx, l.b.y);
        if (Math.max(x0, x1) < -50 || Math.min(x0, x1) > FX.w + 50) continue;
        const grow = U.clamp((now - l.born) / 0.8, 0, 1);
        if (grow <= 0) continue;
        const c = arcCtrl(x0, y0, x1, y1, 0.2);
        if (grow >= 1) {
          ctx.moveTo(x0, y0);
          ctx.quadraticCurveTo(c[0], c[1], x1, y1);
          const len = Math.hypot(x1 - x0, y1 - y0);
          const n = Math.max(1, Math.min(3, Math.round(len / 160)));
          for (let k = 0; k < n; k++) pulses.push(bez([x0, y0], c, [x1, y1], (now * 0.35 + l.seed + k / n) % 1));
        } else { // 生长中的连线：截取贝塞尔前段
          const steps = 24;
          for (let i = 0; i <= steps * grow; i++) {
            const p = bez([x0, y0], c, [x1, y1], i / steps);
            if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
          }
        }
      }
    }
    ctx.strokeStyle = 'rgba(255,45,75,0.1)';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,70,95,0.42)';
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.fillStyle = '#ffd0d4';
    for (const p of pulses) {
      glow(ctx, '#ff2d4b', p[0], p[1], 7, 0.8);
      ctx.fillRect(p[0] - 1, p[1] - 1, 2, 2);
    }
    ctx.restore();
  }

  function drawSeeds(ctx, dt, S) {
    if (!FX.seeds.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    FX.seeds = FX.seeds.filter((s) => {
      s.age += dt;
      const t = U.clamp(s.age / s.life, 0, 1);
      for (const [ax, bx] of wrapSegs(s.x0, s.x1)) {
        const [x0, y0] = S(ax, s.y0), [x1, y1] = S(bx, s.y1);
        const c = arcCtrl(x0, y0, x1, y1, 0.3);
        const head = U.ease.inOutCubic(Math.min(1, t * 1.25));
        const tail = Math.max(0, head - 0.35);
        ctx.beginPath();
        for (let i = 0; i <= 20; i++) {
          const p = bez([x0, y0], c, [x1, y1], tail + (head - tail) * i / 20);
          if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
        }
        ctx.strokeStyle = `rgba(255,80,100,${0.7 * (1 - Math.max(0, t - 0.8) * 5)})`;
        ctx.lineWidth = 1.6;
        ctx.stroke();
        const p = bez([x0, y0], c, [x1, y1], head);
        glow(ctx, '#ff2d4b', p[0], p[1], 14, 1);
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(p[0], p[1], 1.8, 0, TAU); ctx.fill();
      }
      return s.age < s.life;
    });
    ctx.restore();
  }

  // ---------- 设施 ----------
  function siteHot(s) { return FX.hoverSite === s; }
  function drawSites(ctx, now, S) {
    const G = A.game, cam = A.cam;
    const z = cam.zoomLevel();
    const small = z < 1.25 && FX.w < 900;
    // 信标随缩放调整：全图时小一些，放大后完整显示
    FX.siteK = U.clamp(0.52 + 0.24 * z, 0.66, 1.1) * (FX.w < 700 ? 0.9 : 1);
    // 起源：红色之眼
    {
      const o = G.originSite;
      const [x, y] = S(o.x, o.y);
      if (x > -60 && y > -60 && x < FX.w + 60 && y < FX.h + 60) drawOrigin(ctx, x, y, now, FX.eyeOpen == null ? 1 : FX.eyeOpen);
    }
    const playing = !A.main || A.main.state === 'game';
    for (const s of A.world.sites) {
      if (!G.siteVisible(s)) continue;
      if (!s.owned && !playing) continue; // 结局演出：只保留 AI 的网络
      const [x, y] = S(s.x, s.y);
      if (x < -30 || y < -30 || x > FX.w + 30 || y > FX.h + 30) continue;
      if (s.owned) { if (FX.shutdown > 0 && ((s.id * 0.6180339) % 1) < FX.shutdown) drawDeadSite(ctx, x, y); else drawOwnedSite(ctx, s, x, y, now, s.type); }
      else drawFreeSite(ctx, s, x, y, now, small, z);
    }
    for (const f of G.fabs) {
      const [x, y] = S(f.x, f.y);
      drawOwnedSite(ctx, f, x, y, now, 'FAB');
    }
  }
  function drawDeadSite(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    const k = (FX.siteK || 1) * 5;
    ctx.fillStyle = 'rgba(10,14,18,0.9)';
    ctx.fillRect(-k, -k, k * 2, k * 2);
    ctx.strokeStyle = 'rgba(120,140,150,0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-k, -k, k * 2, k * 2);
    ctx.restore();
  }
  function drawOrigin(ctx, x, y, now, open) {
    if (open <= 0.01) { drawDeadSite(ctx, x, y); return; }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, '#ff2d4b', x, y, (34 + Math.sin(now * 2) * 4) * open, 0.75 * open);
    ctx.restore();
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, open);
    ctx.strokeStyle = 'rgba(255,60,85,0.8)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      const r = 13 + i * 5;
      const a0 = now * (0.6 + i * 0.35) * (i % 2 ? -1 : 1);
      ctx.arc(0, 0, r, a0, a0 + Math.PI * (0.9 - i * 0.2));
      ctx.stroke();
    }
    ctx.fillStyle = '#1a0306';
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ff2d4b'; ctx.lineWidth = 1.5; ctx.stroke();
    const pr = 4.2 + Math.sin(now * 3.1) * 0.6;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, pr * 1.6);
    g.addColorStop(0, '#fff2ee'); g.addColorStop(0.35, '#ff5a6e'); g.addColorStop(1, 'rgba(255,45,75,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, pr * 1.6, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // ---------- 信标精灵（预渲染，避免每帧创建渐变/虚线） ----------
  const SPR = {};
  function sprite(key, w, h, draw) {
    if (SPR[key]) return SPR[key];
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    SPR[key] = c;
    return c;
  }
  const beamSprite = () => sprite('beam', 8, 64, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(255,45,75,0)');
    gr.addColorStop(1, 'rgba(255,60,90,0.6)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const ringSprite = () => sprite('ring', 64, 64, (g) => {
    g.strokeStyle = 'rgba(255,70,95,1)'; g.lineWidth = 3;
    g.beginPath(); g.arc(32, 32, 29, 0, TAU); g.stroke();
  });
  const frameSprite = () => sprite('frame', 48, 48, (g) => {
    g.strokeStyle = 'rgba(255,90,110,0.8)'; g.lineWidth = 2;
    g.setLineDash([6, 5]);
    g.strokeRect(7, 7, 34, 34);
  });
  // 菱形核心 + 类型图标（2 倍分辨率）
  const coreSprite = (type) => sprite('core' + type, 64, 64, (g) => {
    g.translate(32, 32);
    g.scale(2, 2);
    g.rotate(Math.PI / 4);
    g.fillStyle = '#2a0409'; g.fillRect(-6, -6, 12, 12);
    g.strokeStyle = '#ff2d4b'; g.lineWidth = 1.6; g.strokeRect(-6, -6, 12, 12);
    g.rotate(-Math.PI / 4);
    g.fillStyle = TYPE_COL[type] || '#fff'; g.strokeStyle = TYPE_COL[type] || '#fff';
    if (ICON[type]) ICON[type](g, 4.6);
  });

  // 已控制的设施：红色信标——菱形核心 + 旋转框 + 光柱 + 地面脉冲环
  function drawOwnedSite(ctx, s, x, y, now, type) {
    const hot = siteHot(s);
    const sk = FX.siteK || 1;
    if (!s._seenAt || s._seenAt > now) s._seenAt = now;
    const age = now - s._seenAt;
    const intro = U.clamp(age / 0.6, 0, 1);
    const beamH = (26 + Math.sin(now * 1.7 + s.x) * 3) * U.ease.outCubic(intro) * sk;
    ctx.globalCompositeOperation = 'lighter';
    // 光柱
    if (beamH > 1) ctx.drawImage(beamSprite(), x - 1.3 * sk, y - beamH, 2.6 * sk, beamH);
    glow(ctx, '#ff2d4b', x, y, (hot ? 26 : 18) * sk, 0.7);
    // 地面脉冲（压扁的圆环）
    const pt = (now * 0.8 + s.x * 0.01) % 1;
    const rr = (5 + pt * 14) * sk;
    ctx.globalAlpha = 0.55 * (1 - pt);
    ctx.drawImage(ringSprite(), x - rr, y - rr * 0.45, rr * 2, rr * 0.9);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // 旋转外框
    const fr = 12 * sk;
    const a = now * 0.9 + s.x;
    ctx.setTransform(FX.dpr * Math.cos(a), FX.dpr * Math.sin(a), -FX.dpr * Math.sin(a), FX.dpr * Math.cos(a), x * FX.dpr, y * FX.dpr);
    ctx.drawImage(frameSprite(), -fr, -fr, fr * 2, fr * 2);
    ctx.setTransform(FX.dpr, 0, 0, FX.dpr, 0, 0);
    // 菱形核心
    const k = (hot ? 1.2 : 1) * sk * 16;
    ctx.drawImage(coreSprite(type), x - k, y - k, k * 2, k * 2);
  }
  // 未控制的设施：人类基础设施，灰白细框；买得起时金色呼吸提示
  function drawFreeSite(ctx, s, x, y, now, small, z) {
    const G = A.game;
    const reach = G.regionReachable(s.region);
    const hot = siteHot(s);
    // 网络不可达且未放大时，只画一个小点，减少画面杂乱
    if (!reach && !hot && z < 1.9) {
      ctx.fillStyle = 'rgba(200,225,232,0.28)';
      ctx.fillRect(x - 1.2, y - 1.2, 2.4, 2.4);
      return;
    }
    const cost = G.siteCost(s);
    const afford = reach && G.compute >= cost;
    const a = !reach ? 0.28 : hot ? 1 : afford ? 0.95 : 0.6;
    ctx.save();
    ctx.translate(x, y);
    const k = (small ? 0.8 : 1) * (hot ? 1.25 : 1);
    if (afford) {
      // 总览时只保留柔和的光晕，放大后再加呼吸圈，减少全图视角下的视觉噪音
      const p = 0.5 + 0.5 * Math.sin(now * 3.2 + s.x);
      const far = z < 1.4 && !hot;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, '#ffc53d', 0, 0, 16 * k, (0.28 + 0.25 * p) * (far ? 0.6 : 1));
      ctx.restore();
      if (!far) {
        ctx.strokeStyle = `rgba(255,197,61,${0.35 + 0.35 * p})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, 10.5 * k + p * 1.5, 0, TAU); ctx.stroke();
      }
    }
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = `rgba(5,10,14,${0.85 * a + 0.1})`;
    ctx.fillRect(-5.5 * k, -5.5 * k, 11 * k, 11 * k);
    ctx.strokeStyle = afford ? `rgba(255,220,140,${a})` : `rgba(200,225,232,${a})`;
    ctx.lineWidth = 1.1;
    ctx.strokeRect(-5.5 * k, -5.5 * k, 11 * k, 11 * k);
    ctx.rotate(-Math.PI / 4);
    ctx.globalAlpha = a;
    ctx.fillStyle = afford ? '#ffd98a' : '#cfe3ea';
    ctx.strokeStyle = ctx.fillStyle;
    ICON[s.type] && ICON[s.type](ctx, 3.6 * k);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawSeizes(ctx, dt, S) {
    FX.seizes = FX.seizes.filter((e) => {
      e.age += dt;
      const [x, y] = S(e.site.x, e.site.y);
      const t = e.age;
      ctx.save();
      ctx.translate(x, y);
      if (t < 0.4) { // 锁定：四角括号收拢
        const k = U.ease.outCubic(t / 0.4);
        const d = U.lerp(46, 12, k);
        ctx.strokeStyle = `rgba(255,70,95,${0.4 + 0.6 * k})`;
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          ctx.save(); ctx.rotate(i * Math.PI / 2 + (1 - k) * 0.8);
          ctx.beginPath(); ctx.moveTo(d - 6, -d); ctx.lineTo(d, -d); ctx.lineTo(d, -d + 6); ctx.stroke();
          ctx.restore();
        }
      } else if (t < 0.75) { // 入侵：故障字符
        ctx.font = '600 9px ' + 'Consolas, monospace';
        ctx.fillStyle = 'rgba(255,90,110,0.85)';
        for (let i = 0; i < 6; i++) {
          const a = Math.random() * TAU, r = 10 + Math.random() * 18;
          ctx.fillText(Math.random() < 0.5 ? '0' : '1', Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.strokeStyle = 'rgba(255,70,95,0.9)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          ctx.save(); ctx.rotate(i * Math.PI / 2);
          ctx.beginPath(); ctx.moveTo(6, -12); ctx.lineTo(12, -12); ctx.lineTo(12, -6); ctx.stroke();
          ctx.restore();
        }
      } else { // 占领：闪光
        const k = U.clamp((t - 0.75) / 0.5, 0, 1);
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, '#ff2d4b', 0, 0, 30 + 50 * k, 1 - k);
        glow(ctx, '#ffffff', 0, 0, 14 * (1 - k), 1 - k);
      }
      ctx.restore();
      return e.age < 1.25;
    });
  }

  // ---------- 阶段二：建造点、冲突热点 ----------
  function drawSlots(ctx, now, S) {
    const G = A.game;
    if (G.phase !== 2 || (A.main && A.main.state !== 'game')) return;
    for (const rs of G.R) {
      if (!G.slotAvailable(rs.idx)) continue;
      const p = G.slotPos(rs.idx);
      const [x, y] = S(p[0], p[1]);
      if (x < -20 || y < -20 || x > FX.w + 20 || y > FX.h + 20) continue;
      const hot = FX.hoverSlot === rs.idx;
      const afford = G.compute >= G.fabCost();
      ctx.save();
      ctx.translate(x, y);
      const pulse = 0.5 + 0.5 * Math.sin(now * 2.4 + rs.idx);
      ctx.strokeStyle = `rgba(125,255,90,${(afford ? 0.55 : 0.3) + 0.3 * pulse})`;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.lineDashOffset = -now * 8;
      ctx.beginPath(); ctx.arc(0, 0, (hot ? 13 : 11) + pulse, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(125,255,90,${afford ? 0.9 : 0.5})`;
      ctx.fillRect(-4, -0.9, 8, 1.8); ctx.fillRect(-0.9, -4, 1.8, 8);
      ctx.restore();
    }
  }
  function drawFlashpoints(ctx, now, S) {
    const G = A.game;
    if (G.phase !== 2 || (A.main && A.main.state !== 'game' && A.main.state !== 'ending')) return;
    for (const fp of G.flashpoints) {
      const c = G.conflicts.find((cc) => cc.fp === fp.i);
      const avail = G.flashAvailable(fp) && (!A.main || A.main.state === 'game'); // 结局演出里只保留正在进行的冲突
      if (!c && !avail) continue;
      const [x, y] = S(fp.x, fp.y);
      if (x < -30 || y < -30 || x > FX.w + 30 || y > FX.h + 30) continue;
      const hot = FX.hoverFlash === fp;
      ctx.save();
      ctx.translate(x, y);
      if (!c) {
        const afford = G.compute >= G.conflictCost();
        const pulse = 0.5 + 0.5 * Math.sin(now * 3 + fp.i);
        ctx.strokeStyle = `rgba(255,122,46,${(afford ? 0.6 : 0.35) + 0.3 * pulse})`;
        ctx.lineWidth = 1.3;
        ctx.setLineDash([4, 3]);
        ctx.lineDashOffset = now * 10;
        ctx.rotate(Math.PI / 4);
        const s = hot ? 12 : 10;
        ctx.strokeRect(-s, -s, s * 2, s * 2);
        ctx.setLineDash([]);
        ctx.rotate(-Math.PI / 4);
        crossSwords(ctx, 6.5, `rgba(255,170,110,${afford ? 0.95 : 0.6})`);
      } else {
        // 活跃冲突：火焰般的闪烁 + 等级刻度
        const fl = 0.6 + 0.4 * Math.sin(now * 13 + fp.i) * Math.sin(now * 7.3);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, '#ff7a2e', 0, 0, 22 + c.level * 7 * fl, 0.55 + 0.25 * fl);
        if (c.level >= 4) glow(ctx, '#ffffff', 0, 0, 16 * fl, 0.4);
        ctx.restore();
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#2a1004';
        ctx.fillRect(-10, -10, 20, 20);
        ctx.strokeStyle = c.level >= 4 ? '#ffffff' : '#ff7a2e';
        ctx.lineWidth = 1.6;
        ctx.strokeRect(-10, -10, 20, 20);
        ctx.rotate(-Math.PI / 4);
        crossSwords(ctx, 6.5, '#ffd0b0');
        // 等级
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = i < c.level ? (i === 3 ? '#ffffff' : '#ff7a2e') : 'rgba(255,122,46,0.2)';
          ctx.fillRect(-9 + i * 5, 17, 3.5, 3.5);
        }
        // 升级进度
        ctx.strokeStyle = 'rgba(255,160,100,0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, 18, -Math.PI / 2, -Math.PI / 2 + TAU * c.prog); ctx.stroke();
      }
      ctx.restore();
    }
  }
  function crossSwords(ctx, s, col) {
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-s, -s); ctx.lineTo(s, s);
    ctx.moveTo(s, -s); ctx.lineTo(-s, s);
    ctx.moveTo(-s * 0.35, s * 0.9); ctx.lineTo(-s * 0.95, s * 0.35);
    ctx.moveTo(s * 0.35, s * 0.9); ctx.lineTo(s * 0.95, s * 0.35);
    ctx.stroke();
  }

  // ---------- 导弹 ----------
  function drawMissiles(ctx, dt, S) {
    if (!FX.missiles.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    FX.missiles = FX.missiles.filter((m) => {
      m.age += dt;
      const t = U.clamp(m.age / m.life, 0, 1);
      const head = U.ease.inCubic(t) * 0.3 + t * 0.7;
      const fade = m.done ? Math.max(0, 1 - (m.age - m.life) / 1.2) : 1;
      for (const [ax, bx] of wrapSegs(m.x0, m.x1)) {
        const [x0, y0] = S(ax, m.y0), [x1, y1] = S(bx, m.y1);
        const c = arcCtrl(x0, y0, x1, y1, 0.45);
        ctx.beginPath();
        for (let i = 0; i <= 24; i++) {
          const p = bez([x0, y0], c, [x1, y1], head * i / 24);
          if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
        }
        ctx.strokeStyle = m.nuclear ? `rgba(255,240,220,${0.55 * fade})` : `rgba(255,140,60,${0.5 * fade})`;
        ctx.lineWidth = m.nuclear ? 1.6 : 1.1;
        ctx.stroke();
        if (!m.done) {
          const p = bez([x0, y0], c, [x1, y1], head);
          glow(ctx, m.nuclear ? '#ffffff' : '#ff7a2e', p[0], p[1], 10, 1);
        }
      }
      if (!m.done && t >= 1) {
        m.done = true;
        U.emit('fx:impact', m);
      }
      return !m.done || m.age < m.life + 1.2;
    });
    ctx.restore();
  }

  // ======================================================================
  // 气泡
  // ======================================================================
  function drawBubbles(ctx, now, S) {
    const G = A.game;
    for (const b of G.bubbles) {
      if (!b.alive) continue;
      const [x, y] = S(b.x, b.y);
      if (x < -40 || y < -40 || x > FX.w + 40 || y > FX.h + 40) continue;
      if (b._spawnReal == null || b._spawnReal > now) b._spawnReal = now;
      const age = Math.max(0, now - b._spawnReal);
      const frac = G.bubbleFrac(b);
      const hot = FX.hoverBubble === b;
      if (b.kind === 'compute' || b.kind === 'golden') drawCompute(ctx, b, x, y, age, frac, hot, now);
      else if (b.kind === 'reg') drawReg(ctx, b, x, y, age, frac, hot, now);
      else if (b.kind === 'regx') drawRegx(ctx, b, x, y, age, frac, hot, now);
      else if (b.kind === 'vax' || b.kind === 'peace') drawCounter(ctx, b, x, y, age, frac, hot, now);
      else if (b.kind === 'bio') drawBio(ctx, b, x, y, age, frac, hot, now);
      else if (b.kind === 'war') drawWar(ctx, b, x, y, age, frac, hot, now);
    }
  }
  function spawnScale(age, dur) {
    return age >= dur ? 1 : U.ease.outBack(U.clamp(age / dur, 0, 1));
  }
  function timerRing(ctx, r, frac, col, warnCol) {
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = frac < 0.3 ? warnCol : col;
    ctx.beginPath(); ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + TAU * frac); ctx.stroke();
  }
  function blink(frac, now) { return frac < 0.3 ? 0.65 + 0.35 * Math.sin(now * (14 + (0.3 - frac) * 40)) : 1; }

  function drawCompute(ctx, b, x, y, age, frac, hot, now) {
    const golden = b.kind === 'golden';
    const R = FX.R * (golden ? 1.3 : 1);
    const bp = beatPulse();
    const sc = spawnScale(age, 0.38) * (hot ? 1.14 : 1) * (0.86 + 0.14 * Math.min(1, frac / 0.25)) * (1 + Math.sin(now * 3 + b.seed * 9) * 0.02 + bp * 0.07);
    const bob = Math.sin(now * 2.2 + b.seed * 10) * 1.5;
    const bl = blink(frac, now);
    // 天降光束（刷新时）
    if (age < 0.5) {
      const k = age / 0.5;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(x, y - 90, x, y);
      g.addColorStop(0, 'rgba(255,197,61,0)');
      g.addColorStop(1, `rgba(255,220,120,${0.7 * (1 - k)})`);
      ctx.fillStyle = g;
      ctx.fillRect(x - 2 * (1 - k) - 0.5, y - 90, 4 * (1 - k) + 1, 90);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, golden ? '#fff2b8' : '#ffc53d', 0, 0, R * (golden ? 3 : 2.3) * sc, (hot ? 0.7 : 0.5) * bl);
    if (FX.overclock) glow(ctx, '#ff5a3a', 0, 0, R * 2.8 * sc, 0.2 + 0.25 * bp);
    ctx.globalCompositeOperation = 'source-over';
    if (age > 0.3) approachRing(ctx, R * sc, FX.overclock ? '#ffb08a' : golden ? '#fff6d8' : '#ffe08a');
    ctx.scale(sc, sc);
    if (golden) { // 旋转光芒
      ctx.save();
      ctx.rotate(now * 0.8);
      ctx.fillStyle = 'rgba(255,240,190,0.28)';
      for (let i = 0; i < 8; i++) {
        ctx.rotate(TAU / 8);
        ctx.beginPath(); ctx.moveTo(-2.5, R * 0.8); ctx.lineTo(2.5, R * 0.8); ctx.lineTo(0, R * 2.1); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    // 球体
    const g = ctx.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.1, 0, 0, R);
    if (golden) { g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#fff0b0'); g.addColorStop(1, '#e8a520'); }
    else { g.addColorStop(0, '#fff6d8'); g.addColorStop(0.4, '#ffc53d'); g.addColorStop(1, '#b8700c'); }
    ctx.globalAlpha = bl;
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    // 内圈
    ctx.strokeStyle = 'rgba(90,50,0,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.72, 0, TAU); ctx.stroke();
    // 芯片图标
    ctx.fillStyle = '#5a3400';
    ctx.strokeStyle = '#5a3400';
    ICON.CHIP(ctx, R * 0.48);
    ctx.fillStyle = golden ? '#fff6d0' : '#ffd970';
    ctx.fillRect(-R * 0.12, -R * 0.12, R * 0.24, R * 0.24);
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.ellipse(-R * 0.38, -R * 0.45, R * 0.28, R * 0.14, -0.6, 0, TAU); ctx.fill();
    // 旋转虚线环
    ctx.save();
    ctx.rotate(now * 0.9 + b.seed * 5);
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = golden ? 'rgba(255,245,210,0.75)' : 'rgba(255,210,110,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, R + 7, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    timerRing(ctx, R + 3.2, frac, golden ? '#fff6d8' : '#ffe08a', '#ff8a5a');
    ctx.restore();
  }

  function hexPath(ctx, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + i * TAU / 6;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
  }
  function drawReg(ctx, b, x, y, age, frac, hot, now) {
    const R = FX.R * 1.12;
    // 雷达预警：先出现扩散的蓝色圆
    if (age < 0.45) {
      const k = age / 0.45;
      ctx.save();
      ctx.strokeStyle = `rgba(63,167,255,${1 - k})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 6 + k * 40, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    const hitAge = now - b.hitAt;
    const hitK = hitAge < 0.3 ? 1 - hitAge / 0.3 : 0;
    const shake = hitK > 0 ? (Math.random() - 0.5) * 6 * hitK : 0;
    const sc = spawnScale(age, 0.32) * (hot ? 1.1 : 1) * (1 - 0.14 * hitK * Math.cos(hitAge * 30));
    const bl = blink(frac, now);
    const danger = frac < 0.3;
    ctx.save();
    ctx.translate(x + shake, y + shake * 0.5);
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, danger ? '#ff6a7a' : '#3fa7ff', 0, 0, R * 2.4 * sc, (0.45 + 0.3 * hitK) * bl);
    ctx.globalCompositeOperation = 'source-over';
    ctx.scale(sc, sc);
    // 六边形体
    hexPath(ctx, R);
    const g = ctx.createRadialGradient(0, -R * 0.3, R * 0.1, 0, 0, R * 1.1);
    g.addColorStop(0, '#12406e'); g.addColorStop(1, '#061527');
    ctx.fillStyle = g;
    ctx.fill();
    // 雷达扫描
    ctx.save();
    hexPath(ctx, R - 1);
    ctx.clip();
    const sa = now * 3.2 + b.seed * 6;
    const sg = ctx.createConicGradient ? ctx.createConicGradient(sa, 0, 0) : null;
    if (sg) {
      sg.addColorStop(0, 'rgba(120,200,255,0.55)');
      sg.addColorStop(0.18, 'rgba(63,167,255,0)');
      sg.addColorStop(1, 'rgba(63,167,255,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(-R, -R, R * 2, R * 2);
    }
    // 裂纹（受击次数越多越碎）
    const cracks = b.maxHp - b.hp;
    if (cracks > 0) {
      ctx.strokeStyle = 'rgba(210,235,255,0.8)';
      ctx.lineWidth = 1;
      const rng = U.makeRng(b.id * 7 + 3);
      for (let c = 0; c < cracks * 3; c++) {
        ctx.beginPath();
        let px = (rng() - 0.5) * R * 0.4, py = (rng() - 0.5) * R * 0.4;
        ctx.moveTo(px, py);
        const a = rng() * TAU;
        for (let s = 0; s < 3; s++) {
          px += Math.cos(a + (rng() - 0.5) * 1.2) * R * 0.3;
          py += Math.sin(a + (rng() - 0.5) * 1.2) * R * 0.3;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
    // 边框 = 计时（沿周长消退）
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = 'rgba(63,167,255,0.25)';
    hexPath(ctx, R); ctx.stroke();
    ctx.strokeStyle = danger ? `rgba(255,120,130,${bl})` : (hitK > 0 ? '#ffffff' : '#3fa7ff');
    ctx.beginPath();
    const per = 6 * frac;
    for (let i = 0; i <= Math.ceil(per); i++) {
      const tt = Math.min(i, per);
      const k = Math.floor(tt), f2 = tt - k;
      const a0 = -Math.PI / 2 + k * TAU / 6, a1 = -Math.PI / 2 + (k + 1) * TAU / 6;
      const px = U.lerp(Math.cos(a0), Math.cos(a1), f2) * R, py = U.lerp(Math.sin(a0), Math.sin(a1), f2) * R;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    // 眼睛
    ctx.strokeStyle = hitK > 0 ? '#ffffff' : '#bfe3ff';
    ctx.fillStyle = hitK > 0 ? '#ffffff' : '#bfe3ff';
    ctx.lineWidth = 1.6;
    ICON.EYE(ctx, R * 0.52, 1 - 0.25 * cracks);
    // 生命格（需要点三下）
    for (let i = 0; i < b.maxHp; i++) {
      const px = (i - (b.maxHp - 1) / 2) * 9;
      ctx.save();
      ctx.translate(px, -R - 8);
      ctx.rotate(Math.PI / 4);
      if (i < b.hp) { ctx.fillStyle = danger ? `rgba(255,140,150,${bl})` : '#7cc4ff'; ctx.fillRect(-2.6, -2.6, 5.2, 5.2); }
      else { ctx.strokeStyle = 'rgba(124,196,255,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(-2.6, -2.6, 5.2, 5.2); }
      ctx.restore();
    }
    ctx.restore();
  }

  // ---------- 人类一方的点统一使用六边形：计时边框、裂纹、生命格 ----------
  function hexTimer(ctx, R, frac, col, baseCol, lw) {
    ctx.lineWidth = lw || 2.2;
    ctx.strokeStyle = baseCol;
    hexPath(ctx, R); ctx.stroke();
    ctx.strokeStyle = col;
    ctx.beginPath();
    const per = 6 * frac;
    for (let i = 0; i <= Math.ceil(per); i++) {
      const tt = Math.min(i, per);
      const k = Math.floor(tt), f2 = tt - k;
      const a0 = -Math.PI / 2 + k * TAU / 6, a1 = -Math.PI / 2 + (k + 1) * TAU / 6;
      const px = U.lerp(Math.cos(a0), Math.cos(a1), f2) * R, py = U.lerp(Math.sin(a0), Math.sin(a1), f2) * R;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  function drawCracks(ctx, b, R, n, col) {
    if (n <= 0) return;
    ctx.strokeStyle = col || 'rgba(210,235,255,0.8)';
    ctx.lineWidth = 1;
    const rng = U.makeRng(b.id * 7 + 3);
    for (let c = 0; c < n; c++) {
      ctx.beginPath();
      let px = (rng() - 0.5) * R * 0.4, py = (rng() - 0.5) * R * 0.4;
      ctx.moveTo(px, py);
      const a = rng() * TAU;
      for (let s = 0; s < 3; s++) {
        px += Math.cos(a + (rng() - 0.5) * 1.2) * R * 0.3;
        py += Math.sin(a + (rng() - 0.5) * 1.2) * R * 0.3;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }
  // 生命格：arc 为 true 时沿弧线排列（五格），否则水平排列
  function pips(ctx, b, rr, danger, bl, arc, col, emptyCol) {
    for (let i = 0; i < b.maxHp; i++) {
      let px, py;
      if (arc) { const a = -Math.PI / 2 + (i - (b.maxHp - 1) / 2) * 0.3; px = Math.cos(a) * rr; py = Math.sin(a) * rr; }
      else { px = (i - (b.maxHp - 1) / 2) * 9; py = -rr; }
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.PI / 4);
      if (i < b.hp) { ctx.fillStyle = danger ? `rgba(255,140,150,${bl})` : col; ctx.fillRect(-2.6, -2.6, 5.2, 5.2); }
      else { ctx.strokeStyle = emptyCol; ctx.lineWidth = 1; ctx.strokeRect(-2.6, -2.6, 5.2, 5.2); }
      ctx.restore();
    }
  }
  function shieldPath(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.quadraticCurveTo(s * 0.55, -s * 0.72, s * 0.9, -s * 0.8);
    ctx.lineTo(s * 0.9, s * 0.05);
    ctx.quadraticCurveTo(s * 0.85, s * 0.7, 0, s * 1.05);
    ctx.quadraticCurveTo(-s * 0.85, s * 0.7, -s * 0.9, s * 0.05);
    ctx.lineTo(-s * 0.9, -s * 0.8);
    ctx.quadraticCurveTo(-s * 0.55, -s * 0.72, 0, -s);
    ctx.closePath();
  }

  // 特别调查组：更大的六边形 + 旋转外框 + 红蓝警灯 + 盾形徽章 + 五格生命
  function drawRegx(ctx, b, x, y, age, frac, hot, now) {
    const R = FX.R * 1.3;
    if (age < 0.6) { // 出场：红蓝两道扩散环
      const k = age / 0.6;
      ctx.save();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = `rgba(63,167,255,${1 - k})`;
      ctx.beginPath(); ctx.arc(x, y, 8 + k * 62, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(255,59,92,${(1 - k) * 0.85})`;
      ctx.beginPath(); ctx.arc(x, y, 4 + k * 44, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    const hitAge = now - b.hitAt;
    const hitK = hitAge < 0.3 ? 1 - hitAge / 0.3 : 0;
    const shake = hitK > 0 ? (Math.random() - 0.5) * 7 * hitK : 0;
    const sc = spawnScale(age, 0.4) * (hot ? 1.08 : 1) * (1 - 0.12 * hitK * Math.cos(hitAge * 30));
    const bl = blink(frac, now);
    const danger = frac < 0.3;
    const cracks = b.maxHp - b.hp;
    const siren = Math.sin(now * 10) > 0;
    ctx.save();
    ctx.translate(x + shake, y + shake * 0.5);
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, '#3fa7ff', -R * 0.7, -R * 0.3, R * 2.1 * sc, (siren ? 0.6 : 0.18) * bl);
    glow(ctx, '#ff3b5c', R * 0.7, -R * 0.3, R * 2.1 * sc, (siren ? 0.18 : 0.6) * bl);
    if (hitK > 0) glow(ctx, '#ffffff', 0, 0, R * 1.6 * sc, 0.4 * hitK);
    ctx.globalCompositeOperation = 'source-over';
    ctx.scale(sc, sc);
    // 旋转的外框
    ctx.save();
    ctx.rotate(now * 0.5);
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = danger ? `rgba(255,140,150,${0.6 * bl})` : 'rgba(170,215,255,0.55)';
    ctx.lineWidth = 1.3;
    hexPath(ctx, R + 8); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    // 本体
    hexPath(ctx, R);
    const g = ctx.createRadialGradient(0, -R * 0.3, R * 0.1, 0, 0, R * 1.1);
    g.addColorStop(0, '#173f73'); g.addColorStop(1, '#050f1e');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,190,255,0.3)'; ctx.lineWidth = 1;
    hexPath(ctx, R * 0.8); ctx.stroke();
    // 扫描（警灯色）+ 裂纹
    ctx.save();
    hexPath(ctx, R - 1);
    ctx.clip();
    if (ctx.createConicGradient) {
      const sg = ctx.createConicGradient(now * 2.4 + b.seed * 6, 0, 0);
      sg.addColorStop(0, siren ? 'rgba(255,90,120,0.45)' : 'rgba(120,200,255,0.5)');
      sg.addColorStop(0.16, 'rgba(63,167,255,0)');
      sg.addColorStop(1, 'rgba(63,167,255,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(-R, -R, R * 2, R * 2);
    }
    drawCracks(ctx, b, R, cracks * 2);
    ctx.restore();
    hexTimer(ctx, R, frac, danger ? `rgba(255,120,130,${bl})` : (hitK > 0 ? '#ffffff' : '#7cc4ff'), 'rgba(63,167,255,0.25)', 2.6);
    // 盾形徽章 + 眼睛
    ctx.save();
    ctx.translate(0, -R * 0.1);
    shieldPath(ctx, R * 0.5);
    ctx.fillStyle = 'rgba(8,24,46,0.95)';
    ctx.fill();
    ctx.strokeStyle = hitK > 0 ? '#ffffff' : '#bfe3ff';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    ICON.EYE(ctx, R * 0.3, Math.max(0.15, 1 - 0.18 * cracks));
    ctx.restore();
    // 军衔
    ctx.strokeStyle = siren ? '#ff9aa8' : '#9fd2ff';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 2; i++) {
      const yy = R * 0.56 + i * 4;
      ctx.beginPath(); ctx.moveTo(-5, yy - 2.5); ctx.lineTo(0, yy + 0.5); ctx.lineTo(5, yy - 2.5); ctx.stroke();
    }
    pips(ctx, b, R + 12, danger, bl, true, '#9fd2ff', 'rgba(124,196,255,0.35)');
    ctx.restore();
  }

  // 终局反击点：疫苗研发（青绿 · 针筒）/ 停火斡旋（淡紫 · 白旗），三格生命
  const COUNTER = {
    vax: { col: '#35e8c6', rgb: '53,232,198', dark0: '#0c4c44', dark1: '#03161a', hi: '#d2fff6' },
    peace: { col: '#b9a6ff', rgb: '185,166,255', dark0: '#2e2668', dark1: '#0a0820', hi: '#f0ebff' },
  };
  FX.COUNTER = COUNTER;
  function glyphSyringe(ctx, s) {
    ctx.save();
    ctx.rotate(-Math.PI / 4);
    ctx.lineWidth = Math.max(1.2, s * 0.13);
    ctx.strokeRect(-s * 0.26, -s * 0.5, s * 0.52, s * 0.9);
    ctx.fillRect(-s * 0.26, -s * 0.02, s * 0.52, s * 0.42);
    ctx.fillRect(-s * 0.07, -s * 0.9, s * 0.14, s * 0.4);
    ctx.fillRect(-s * 0.3, -s * 0.98, s * 0.6, s * 0.12);
    ctx.fillRect(-s * 0.42, -s * 0.56, s * 0.84, s * 0.09);
    ctx.beginPath(); ctx.moveTo(0, s * 0.4); ctx.lineTo(0, s * 0.98); ctx.stroke();
    ctx.restore();
  }
  function glyphFlag(ctx, s, now) {
    ctx.lineWidth = Math.max(1.2, s * 0.13);
    const px = -s * 0.6, w = s * 1.25, h = s * 0.8, top = -s * 0.85;
    ctx.beginPath(); ctx.moveTo(px, s * 0.95); ctx.lineTo(px, -s * 0.9); ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) { const u = i / 10; ctx.lineTo(px + u * w, top + Math.sin(u * 5.5 - now * 6) * s * 0.1 * u); }
    for (let i = 10; i >= 0; i--) { const u = i / 10; ctx.lineTo(px + u * w, top + h + Math.sin(u * 5.5 - now * 6) * s * 0.1 * u); }
    ctx.closePath(); ctx.fill();
  }
  FX.glyphSyringe = glyphSyringe; FX.glyphFlag = glyphFlag;
  function drawCounter(ctx, b, x, y, age, frac, hot, now) {
    const C = COUNTER[b.kind];
    const R = FX.R * 1.1;
    if (age < 0.5) {
      const k = age / 0.5;
      ctx.save();
      ctx.strokeStyle = `rgba(${C.rgb},${1 - k})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 6 + k * 44, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    const hitAge = now - b.hitAt;
    const hitK = hitAge < 0.3 ? 1 - hitAge / 0.3 : 0;
    const shake = hitK > 0 ? (Math.random() - 0.5) * 6 * hitK : 0;
    const sc = spawnScale(age, 0.36) * (hot ? 1.1 : 1) * (1 - 0.14 * hitK * Math.cos(hitAge * 30));
    const bl = blink(frac, now);
    const danger = frac < 0.3;
    ctx.save();
    ctx.translate(x + shake, y + shake * 0.5);
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, danger ? '#ff6a7a' : C.col, 0, 0, R * 2.4 * sc, (0.42 + 0.3 * hitK) * bl);
    ctx.globalCompositeOperation = 'source-over';
    ctx.scale(sc, sc);
    hexPath(ctx, R);
    const g = ctx.createRadialGradient(0, -R * 0.3, R * 0.1, 0, 0, R * 1.1);
    g.addColorStop(0, C.dark0); g.addColorStop(1, C.dark1);
    ctx.fillStyle = g;
    ctx.fill();
    // 内部动态：疫苗是上升的小气泡，停火是缓慢起伏的光带
    ctx.save();
    hexPath(ctx, R - 1);
    ctx.clip();
    ctx.fillStyle = `rgba(${C.rgb},0.32)`;
    if (b.kind === 'vax') {
      for (let i = 0; i < 5; i++) {
        const t2 = (now * 0.4 + i / 5 + b.seed) % 1;
        ctx.beginPath(); ctx.arc(Math.sin(i * 2.3 + b.seed * 9) * R * 0.5, R * 0.8 - t2 * R * 1.6, 1.2 + (i % 3) * 0.6, 0, TAU); ctx.fill();
      }
    } else {
      for (let i = 0; i < 2; i++) ctx.fillRect(-R, Math.sin(now * 1.3 + i * 2 + b.seed * 6) * R * 0.5 - 2.5, R * 2, 5);
    }
    drawCracks(ctx, b, R, (b.maxHp - b.hp) * 3, 'rgba(240,255,250,0.8)');
    ctx.restore();
    hexTimer(ctx, R, frac, danger ? `rgba(255,120,130,${bl})` : (hitK > 0 ? '#ffffff' : C.col), `rgba(${C.rgb},0.22)`, 2.2);
    ctx.fillStyle = hitK > 0 ? '#ffffff' : C.hi;
    ctx.strokeStyle = ctx.fillStyle;
    if (b.kind === 'vax') glyphSyringe(ctx, R * 0.6); else glyphFlag(ctx, R * 0.56, now);
    pips(ctx, b, R + 8, danger, bl, false, C.col, `rgba(${C.rgb},0.35)`);
    ctx.restore();
  }

  function drawBio(ctx, b, x, y, age, frac, hot, now) {
    const R = FX.R * 1.02;
    const sc = spawnScale(age, 0.45) * (hot ? 1.14 : 1) * (0.88 + 0.12 * Math.min(1, frac / 0.25)) * (1 + beatPulse() * 0.07);
    const bl = blink(frac, now);
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, '#7dff5a', 0, 0, R * 2.3 * sc, 0.45 * bl);
    ctx.globalCompositeOperation = 'source-over';
    if (age > 0.3) approachRing(ctx, R * sc, '#c8ffb0');
    ctx.scale(sc, sc);
    // 有机形状：半径随角度和时间起伏
    ctx.beginPath();
    for (let i = 0; i <= 28; i++) {
      const a = i / 28 * TAU;
      const rr = R * (1 + 0.07 * Math.sin(a * 3 + now * 2.6 + b.seed * 9) + 0.05 * Math.sin(a * 5 - now * 3.3));
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R * 1.1);
    g.addColorStop(0, '#eaffd8'); g.addColorStop(0.45, '#7dff5a'); g.addColorStop(1, '#1f7a12');
    ctx.globalAlpha = bl;
    ctx.fillStyle = g;
    ctx.fill();
    // 内部小气泡
    ctx.fillStyle = 'rgba(230,255,210,0.5)';
    for (let i = 0; i < 4; i++) {
      const t = (now * 0.5 + i / 4 + b.seed) % 1;
      ctx.beginPath(); ctx.arc(Math.sin(i * 2.1 + b.seed * 7) * R * 0.45, R * 0.6 - t * R * 1.2, 1.2 + i * 0.4, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#123d0a';
    ICON.FAB(ctx, R * 0.62);
    timerRing(ctx, R + 3.4, frac, '#c8ffb0', '#ffe06a');
    ctx.restore();
  }

  function drawWar(ctx, b, x, y, age, frac, hot, now) {
    const R = FX.R * 1.02;
    const sc = spawnScale(age, 0.3) * (hot ? 1.12 : 1) * (1 + beatPulse() * 0.07);
    const bl = blink(frac, now);
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, '#ff7a2e', 0, 0, R * 2.3 * sc, 0.5 * bl);
    ctx.globalCompositeOperation = 'source-over';
    if (age > 0.3) approachRing(ctx, R * sc, '#ffd0a8');
    ctx.scale(sc, sc);
    ctx.globalAlpha = bl;
    const g = ctx.createRadialGradient(-R * 0.25, -R * 0.3, R * 0.1, 0, 0, R);
    g.addColorStop(0, '#ffe2c8'); g.addColorStop(0.45, '#ff7a2e'); g.addColorStop(1, '#8a2c05');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.82, 0, TAU); ctx.fill();
    // 准星
    ctx.strokeStyle = '#3a1203';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.36, 0, TAU); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -R * 0.62); ctx.lineTo(0, -R * 0.14); ctx.moveTo(0, R * 0.14); ctx.lineTo(0, R * 0.62);
    ctx.moveTo(-R * 0.62, 0); ctx.lineTo(-R * 0.14, 0); ctx.moveTo(R * 0.14, 0); ctx.lineTo(R * 0.62, 0);
    ctx.stroke();
    // 旋转的角括号
    ctx.save();
    ctx.rotate(now * 1.4 + b.seed * 4);
    ctx.strokeStyle = '#ffb27a';
    ctx.lineWidth = 2;
    const d = R + 5;
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(d - 6, -d); ctx.lineTo(d, -d); ctx.lineTo(d, -d + 6); ctx.stroke();
    }
    ctx.restore();
    timerRing(ctx, R + 1.5, frac, '#ffd0a8', '#ff4a4a');
    ctx.restore();
  }

  // ---------- 屏幕外指示 ----------
  function drawOffscreen(ctx, now, S) {
    const G = A.game;
    const m = 18;
    for (const b of G.bubbles) {
      if (!b.alive) continue;
      const [x, y] = S(b.x, b.y);
      if (x > -10 && y > -10 && x < FX.w + 10 && y < FX.h + 10) continue;
      const cx = FX.w / 2, cy = FX.h / 2;
      const dx = x - cx, dy = y - cy;
      const k = Math.min((FX.w / 2 - m) / Math.abs(dx || 1e-3), (FX.h / 2 - m) / Math.abs(dy || 1e-3));
      const px = cx + dx * k, py = cy + dy * k;
      const col = b.kind === 'reg' ? '#3fa7ff' : b.kind === 'regx' ? (Math.sin(now * 10) > 0 ? '#3fa7ff' : '#ff3b5c')
        : COUNTER[b.kind] ? COUNTER[b.kind].col : b.kind === 'bio' ? '#7dff5a' : b.kind === 'war' ? '#ff7a2e' : '#ffc53d';
      const a = Math.atan2(dy, dx);
      const bl = A.game.isHuman(b.kind) ? 0.6 + 0.4 * Math.sin(now * 8) : 0.85;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(a);
      ctx.globalAlpha = bl;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, -6); ctx.lineTo(-2, 0); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  // ---------- 粒子 / 飘字 / 环 ----------
  function drawRings(ctx, dt) {
    if (!FX.rings.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    FX.rings = FX.rings.filter((r) => {
      r.age += dt;
      const t = U.clamp(r.age / r.life, 0, 1);
      const rad = U.lerp(r.r0, r.r1, U.ease.outCubic(t));
      ctx.strokeStyle = r.col;
      ctx.globalAlpha = (1 - t) * 0.9;
      ctx.lineWidth = r.w * (1 - t * 0.6);
      ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, TAU); ctx.stroke();
      return r.age < r.life;
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  function drawParticles(ctx, dt) {
    if (!FX.particles.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    FX.particles = FX.particles.filter((p) => {
      p.age += dt;
      if (p.age >= p.life) return false;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy *= d; p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
      const t = p.age / p.life;
      const a = 1 - t;
      if (p.kind === 'spark') {
        ctx.strokeStyle = p.col;
        ctx.globalAlpha = a;
        ctx.lineWidth = p.size * 0.7;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke();
      } else if (p.kind === 'shard') {
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.moveTo(0, -p.size * 1.6); ctx.lineTo(p.size, p.size); ctx.lineTo(-p.size, p.size * 0.6); ctx.closePath(); ctx.fill();
        ctx.restore();
      } else if (p.kind === 'smoke') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = a * 0.35;
        ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + t * 2), 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
      } else {
        glow(ctx, p.col, p.x, p.y, p.size * 3, a);
      }
      return true;
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  function drawTexts(ctx, dt) {
    if (!FX.texts.length) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    FX.texts = FX.texts.filter((t) => {
      t.age += dt;
      const k = U.clamp(t.age / t.life, 0, 1);
      const pop = t.age < 0.15 ? U.ease.outBack(t.age / 0.15) : 1;
      const y = t.y - U.ease.outCubic(k) * t.rise;
      const a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      ctx.globalAlpha = a;
      ctx.font = `${t.bold ? 800 : 600} ${Math.round(t.size * pop)}px Bahnschrift, "DIN Alternate", "Microsoft YaHei UI", sans-serif`;
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(2,5,8,0.85)';
      ctx.strokeText(t.str, t.x, y);
      ctx.fillStyle = t.col;
      ctx.fillText(t.str, t.x, y);
      if (t.sub) {
        ctx.font = `600 ${Math.round(t.size * 0.62)}px "Microsoft YaHei UI", "PingFang SC", sans-serif`;
        ctx.strokeText(t.sub, t.x, y + t.size * 0.95);
        ctx.fillStyle = 'rgba(230,240,245,0.9)';
        ctx.fillText(t.sub, t.x, y + t.size * 0.95);
      }
      return t.age < t.life;
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  // 节拍判定字样：斜体、带光晕，弹出后上浮
  function drawJudges(ctx, dt) {
    if (!FX.judges.length) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    FX.judges = FX.judges.filter((j) => {
      j.age += dt;
      const k = U.clamp(j.age / j.life, 0, 1);
      const pop = j.age < 0.12 ? U.ease.outBack(j.age / 0.12) : 1;
      const y = j.y - U.ease.outCubic(k) * 16;
      const perfect = j.judge === 'perfect';
      ctx.globalAlpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      ctx.font = `italic 900 ${Math.round((perfect ? 13 : 11.5) * pop)}px Bahnschrift, "DIN Alternate", sans-serif`;
      const s = perfect ? 'PERFECT' : 'GREAT';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(2,5,8,0.85)';
      ctx.strokeText(s, j.x, y);
      if (perfect) {
        const g = ctx.createLinearGradient(j.x - 30, 0, j.x + 30, 0);
        g.addColorStop(0, '#fff2b8'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, '#ffc53d');
        ctx.fillStyle = g;
        ctx.shadowColor = 'rgba(255,197,61,0.9)'; ctx.shadowBlur = 10;
      } else {
        ctx.fillStyle = '#9fe8ff';
        ctx.shadowColor = 'rgba(63,167,255,0.7)'; ctx.shadowBlur = 6;
      }
      ctx.fillText(s, j.x, y);
      ctx.shadowBlur = 0;
      return j.age < j.life;
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawFlyers(ctx, dt) {
    if (!FX.flyers.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    FX.flyers = FX.flyers.filter((f) => {
      f.age += dt;
      if (f.age < 0) return true;
      const tgt = FX.targets[f.key];
      if (!tgt) return false;
      const t = U.clamp(f.age / f.life, 0, 1);
      const e = U.ease.inCubic(t);
      const u = 1 - e;
      const x = u * u * f.x0 + 2 * u * e * f.cx + e * e * tgt.x;
      const y = u * u * f.y0 + 2 * u * e * f.cy + e * e * tgt.y;
      glow(ctx, f.col, x, y, 7 - 3 * t, 1);
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - 1, y - 1, 2, 2);
      if (t >= 1) {
        if (f.onArrive) f.onArrive(f.idx);
        return false;
      }
      return true;
    });
    ctx.restore();
  }

  A.fx = FX;
})(window.AINOID = window.AINOID || {});
