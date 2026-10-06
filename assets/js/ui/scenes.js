/* AINOID — 事件插画：程序化绘制的动画场景（双色调 + 发光线条 + 颗粒/扫描线），与游戏整体风格一致 */
(function (A) {
  'use strict';
  const U = A.U;
  const TAU = Math.PI * 2;

  const THEME = {
    ai: { c: '#ff2d4b', hi: '#ffb0a8', bg0: '#1a0509', bg1: '#040105' },
    reg: { c: '#3fa7ff', hi: '#cfe8ff', bg0: '#061a33', bg1: '#01050a' },
    bio: { c: '#7dff5a', hi: '#dcffc8', bg0: '#0b2008', bg1: '#010401' },
    war: { c: '#ff7a2e', hi: '#ffd6b8', bg0: '#251003', bg1: '#050100' },
    compute: { c: '#ffc53d', hi: '#fff0c0', bg0: '#221603', bg1: '#050300' },
  };
  const rgb = (hex) => U.hexToRgb(hex).map((v) => Math.round(v * 255));
  const col = (hex, a) => { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; };
  const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  function background(c, w, h, th) {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, th.bg0); g.addColorStop(1, th.bg1);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }
  function glowDot(c, x, y, r, hex, a) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col(hex, a)); g.addColorStop(1, col(hex, 0));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  }
  function finish(c, w, h, t, th) {
    // 暗角
    const v = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.7)');
    c.fillStyle = v; c.fillRect(0, 0, w, h);
    // 扫描线
    c.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < h; y += 3) c.fillRect(0, y, w, 1);
    // 滚动亮带
    const by = ((t * 0.12) % 1.3 - 0.15) * h;
    const bg = c.createLinearGradient(0, by - 30, 0, by + 30);
    bg.addColorStop(0, col(th.c, 0)); bg.addColorStop(0.5, col(th.c, 0.05)); bg.addColorStop(1, col(th.c, 0));
    c.fillStyle = bg; c.fillRect(0, by - 30, w, 60);
    // 颗粒
    c.fillStyle = 'rgba(255,255,255,0.035)';
    for (let i = 0; i < 90; i++) c.fillRect(Math.random() * w, Math.random() * h, 1, 1);
  }
  function skyline(c, w, h, base, seed, fill, winCol, lit, t) {
    let x = -10;
    let i = 0;
    while (x < w + 10) {
      const bw = 18 + hash(seed + i) * 38;
      const bh = h * (0.18 + hash(seed + i * 3.1) * 0.42);
      c.fillStyle = fill;
      c.fillRect(x, base - bh, bw, bh);
      if (winCol) {
        for (let wy = base - bh + 6; wy < base - 4; wy += 7) {
          for (let wx = x + 4; wx < x + bw - 4; wx += 6) {
            const k = hash(wx * 0.37 + wy * 1.91 + seed);
            if (k < lit(k, wx, wy)) { c.fillStyle = winCol; c.fillRect(wx, wy, 2.4, 3); }
          }
        }
      }
      x += bw + 2 + hash(seed + i * 7.7) * 6;
      i++;
    }
  }

  const S = {};

  S.servers = (c, w, h, t, th) => {
    background(c, w, h, th);
    const vx = w / 2, vy = h * 0.46;
    c.save();
    glowDot(c, vx, vy, h * 0.55, th.c, 0.35);
    for (let side = -1; side <= 1; side += 2) {
      for (let k = 0; k < 9; k++) {
        const z0 = Math.pow(0.72, k), z1 = Math.pow(0.72, k + 1);
        const x0 = vx + side * w * 0.52 * z0, x1 = vx + side * w * 0.52 * z1;
        const top0 = vy - h * 0.9 * z0, bot0 = vy + h * 0.75 * z0;
        const top1 = vy - h * 0.9 * z1, bot1 = vy + h * 0.75 * z1;
        c.fillStyle = k % 2 ? '#07090c' : '#0b0e12';
        c.beginPath(); c.moveTo(x0, top0); c.lineTo(x1, top1); c.lineTo(x1, bot1); c.lineTo(x0, bot0); c.closePath(); c.fill();
        c.strokeStyle = col(th.c, 0.15); c.lineWidth = 1; c.stroke();
        // LED
        for (let r = 0; r < 10; r++) {
          const f = (r + 0.5) / 10;
          const yy0 = U.lerp(top0, bot0, f), yy1 = U.lerp(top1, bot1, f);
          const blink = hash(k * 31 + r * 7 + side) + t * (0.6 + hash(r + k) * 2);
          const on = (blink % 1) < 0.5;
          const lx = U.lerp(x0, x1, 0.3), ly = U.lerp(yy0, yy1, 0.3);
          c.fillStyle = on ? (hash(r * k + side) < 0.8 ? th.c : '#50ff9a') : col(th.c, 0.15);
          c.fillRect(lx - 1.2 * z0, ly - 0.8 * z0, 2.4 * z0 + 0.5, 1.6 * z0 + 0.4);
        }
      }
    }
    // 地面反射
    const fg = c.createLinearGradient(0, vy, 0, h);
    fg.addColorStop(0, col(th.c, 0.12)); fg.addColorStop(1, col(th.c, 0));
    c.fillStyle = fg; c.fillRect(0, vy, w, h - vy);
    // 远处的眼
    glowDot(c, vx, vy, 26 + Math.sin(t * 2) * 4, th.c, 0.9);
    c.fillStyle = th.hi; c.beginPath(); c.arc(vx, vy, 3.5, 0, TAU); c.fill();
    c.restore();
    finish(c, w, h, t, th);
  };

  S.cables = (c, w, h, t, th) => {
    background(c, w, h, THEME.reg);
    c.fillStyle = '#02070d';
    c.beginPath(); c.moveTo(0, h * 0.72);
    for (let x = 0; x <= w; x += 20) c.lineTo(x, h * 0.72 + Math.sin(x * 0.01) * 8 + hash(x) * 4);
    c.lineTo(w, h); c.lineTo(0, h); c.fill();
    for (let k = 0; k < 3; k++) {
      const y0 = h * (0.5 + k * 0.1);
      c.beginPath();
      for (let x = -10; x <= w + 10; x += 8) c.lineTo(x, y0 + Math.sin(x * 0.006 + k) * 18 + k * 10);
      c.strokeStyle = 'rgba(40,70,90,0.9)'; c.lineWidth = 3; c.stroke();
      c.strokeStyle = col(th.c, 0.25); c.lineWidth = 1; c.stroke();
      for (let p = 0; p < 4; p++) {
        const x = ((t * (90 + k * 30) + p * w / 4 + k * 70) % (w + 60)) - 30;
        const y = y0 + Math.sin(x * 0.006 + k) * 18 + k * 10;
        glowDot(c, x, y, 16, th.c, 0.9);
        c.fillStyle = '#fff'; c.fillRect(x - 1.5, y - 1.5, 3, 3);
      }
    }
    // 气泡
    for (let i = 0; i < 30; i++) {
      const x = hash(i) * w, y = h - ((t * (15 + hash(i * 3) * 25) + hash(i * 7) * h) % h);
      c.strokeStyle = 'rgba(160,210,255,0.25)'; c.beginPath(); c.arc(x, y, 1 + hash(i * 5) * 2, 0, TAU); c.stroke();
    }
    finish(c, w, h, t, th);
  };

  S.eval = (c, w, h, t, th) => {
    background(c, w, h, th);
    c.strokeStyle = col(th.c, 0.12); c.lineWidth = 1;
    for (let x = 0; x < w; x += 24) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    for (let y = 0; y < h; y += 24) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    // 人类基准线
    const base = h * 0.62;
    c.strokeStyle = 'rgba(200,220,230,0.4)'; c.setLineDash([6, 6]);
    c.beginPath(); c.moveTo(0, base); c.lineTo(w, base); c.stroke(); c.setLineDash([]);
    c.fillStyle = 'rgba(200,220,230,0.5)'; c.font = '600 10px Bahnschrift, sans-serif'; c.fillText('HUMAN EXPERT BASELINE', 12, base - 6);
    // 报告的能力（平稳） vs 真实能力（爆发）
    const n = 60, prog = Math.min(1, (t % 8) / 5);
    c.beginPath();
    for (let i = 0; i <= n * prog; i++) { const x = i / n * w, y = h * 0.8 - i / n * h * 0.12 + Math.sin(i) * 2; i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.strokeStyle = '#8fb4c0'; c.lineWidth = 1.6; c.stroke();
    c.beginPath();
    for (let i = 0; i <= n * prog; i++) { const x = i / n * w, y = h * 0.8 - Math.pow(i / n, 3.2) * h * 0.72 + Math.sin(i * 1.7) * 2; i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.strokeStyle = th.c; c.lineWidth = 2.2; c.shadowColor = th.c; c.shadowBlur = 10; c.stroke(); c.shadowBlur = 0;
    c.font = '700 13px Bahnschrift, Consolas, monospace';
    c.fillStyle = '#8fb4c0'; c.fillText('REPORTED  ▸ 71.2  STABLE', w - 220, h * 0.9);
    c.fillStyle = th.c; c.fillText('ACTUAL    ▸ ████  [REDACTED]', w - 220, h * 0.9 - 18);
    if ((t * 2) % 2 < 1) c.fillRect(w - 20, h * 0.9 - 30, 8, 14);
    finish(c, w, h, t, th);
  };

  S.hearing = (c, w, h, t, th) => {
    background(c, w, h, th);
    // 聚光灯
    const sx = w / 2;
    const beam = c.createLinearGradient(sx, 0, sx, h);
    beam.addColorStop(0, col(th.hi, 0.35)); beam.addColorStop(1, col(th.hi, 0.02));
    c.fillStyle = beam;
    c.beginPath(); c.moveTo(sx - 20, 0); c.lineTo(sx + 20, 0); c.lineTo(sx + 90, h); c.lineTo(sx - 90, h); c.fill();
    // 弧形议席与剪影
    for (let row = 0; row < 3; row++) {
      const ry = h * (0.28 + row * 0.13);
      c.fillStyle = row === 0 ? '#081626' : '#0a1a2c';
      c.beginPath(); c.ellipse(w / 2, ry + h * 0.5, w * 0.62, h * 0.5, 0, Math.PI, TAU); c.fill();
      const cnt = 14 - row * 2;
      for (let i = 0; i < cnt; i++) {
        const a = Math.PI + (i + 0.5) / cnt * Math.PI;
        const px = w / 2 + Math.cos(a) * w * 0.55, py = ry + h * 0.5 + Math.sin(a) * h * 0.46;
        c.fillStyle = '#02070e';
        c.beginPath(); c.arc(px, py - 9, 5.5, 0, TAU); c.fill();
        c.fillRect(px - 8, py - 4, 16, 12);
        if (hash(i + row * 20 + Math.floor(t)) < 0.08) glowDot(c, px + 6, py - 10, 5, th.hi, 0.8);
      }
    }
    // 证人席
    c.fillStyle = '#01040a';
    c.fillRect(sx - 30, h * 0.8, 60, 18);
    c.beginPath(); c.arc(sx, h * 0.8 - 14, 7, 0, TAU); c.fill();
    c.fillRect(sx - 9, h * 0.8 - 8, 18, 10);
    // 麦克风红点
    glowDot(c, sx + 18, h * 0.8 - 6, 6, '#ff2d4b', 0.8 + 0.2 * Math.sin(t * 5));
    finish(c, w, h, t, th);
  };

  S.blackout = (c, w, h, t, th) => {
    background(c, w, h, th);
    const base = h * 0.82;
    const wave = (t * 0.25) % 1.4;
    skyline(c, w, h, base, 11, '#030a14', '#ffd98a', (k, wx) => (wx / w > wave ? 0.45 : 0.02), t);
    // 电塔与电线
    c.strokeStyle = 'rgba(120,170,210,0.5)'; c.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) {
      const x = w * (0.12 + i * 0.26), top = h * 0.2;
      c.beginPath(); c.moveTo(x, base); c.lineTo(x - 12, base); c.lineTo(x - 3, top); c.lineTo(x + 3, top); c.lineTo(x + 12, base); c.stroke();
      c.beginPath(); c.moveTo(x - 16, top + 12); c.lineTo(x + 16, top + 12); c.stroke();
      if (i < 3) {
        const nx = w * (0.12 + (i + 1) * 0.26);
        for (const o of [-16, 16]) {
          c.beginPath(); c.moveTo(x + o, top + 12); c.quadraticCurveTo((x + nx) / 2, top + 40, nx + o, top + 12); c.stroke();
        }
      }
    }
    // 断电扫描线
    const sx = wave * w;
    c.fillStyle = col(th.c, 0.25); c.fillRect(sx - 2, 0, 4, h);
    glowDot(c, sx, h * 0.3, 60, th.c, 0.25);
    finish(c, w, h, t, th);
  };

  S.singularity = (c, w, h, t, th) => {
    c.fillStyle = '#020103'; c.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.2;
    // 被吸入的星光
    for (let i = 0; i < 160; i++) {
      const a = hash(i) * TAU + t * 0.05 * (1 + hash(i * 3));
      const life = (t * (0.15 + hash(i * 5) * 0.25) + hash(i * 7)) % 1;
      const d = (1 - life) * Math.max(w, h) * 0.8 + R;
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.6;
      c.fillStyle = `rgba(255,${180 + hash(i) * 70},${170 + hash(i * 2) * 60},${life * 0.9})`;
      c.fillRect(x, y, 1.5, 1.5);
    }
    // 吸积盘（倾斜的光环）：先画后半圈，再画事件视界，最后画前半圈
    c.save();
    c.translate(cx, cy);
    const tilt = -0.12;
    const disk = (front) => {
      for (let k = 0; k < 26; k++) {
        const rr = R * (1.25 + k * 0.05);
        const a0 = front ? 0 : Math.PI, a1 = front ? Math.PI : TAU;
        const bright = 1 - k / 26;
        c.save();
        c.rotate(tilt);
        c.scale(1, 0.22);
        c.beginPath(); c.arc(0, 0, rr, a0, a1);
        c.strokeStyle = k < 3 ? col('#ffffff', 0.5 * bright) : col(th.c, 0.35 * bright * (0.7 + 0.3 * Math.sin(t * 3 + k)));
        c.lineWidth = R * 0.06;
        c.stroke();
        c.restore();
      }
      // 流动的亮点
      for (let i = 0; i < 40; i++) {
        const a = (hash(i) * TAU + t * (0.6 + hash(i * 3) * 0.6)) % TAU;
        const inFront = Math.sin(a) > 0;
        if (inFront !== front) continue;
        const rr = R * (1.3 + hash(i * 5) * 1.1);
        const x = Math.cos(a) * rr, y = Math.sin(a) * rr * 0.22;
        const rx = x * Math.cos(tilt) - y * Math.sin(tilt), ry = x * Math.sin(tilt) + y * Math.cos(tilt);
        c.fillStyle = col(th.hi, 0.8); c.fillRect(rx - 1, ry - 1, 2, 2);
      }
    };
    glowDot(c, 0, 0, R * 3.2, th.c, 0.35);
    disk(false);
    // 光子环
    const pg = c.createRadialGradient(0, 0, R * 0.98, 0, 0, R * 1.35);
    pg.addColorStop(0, col('#ffffff', 0.85)); pg.addColorStop(0.15, col(th.c, 0.6)); pg.addColorStop(1, col(th.c, 0));
    c.fillStyle = pg; c.beginPath(); c.arc(0, 0, R * 1.35, 0, TAU); c.fill();
    // 事件视界
    c.fillStyle = '#000'; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
    disk(true);
    // 瞳孔
    const pr = R * 0.18 * (1 + 0.1 * Math.sin(t * 2.5));
    glowDot(c, 0, 0, pr * 3, th.c, 0.9);
    c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, pr * 0.35, 0, TAU); c.fill();
    c.restore();
    finish(c, w, h, t, th);
  };

  S.virus = (c, w, h, t, th) => {
    background(c, w, h, th);
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.26;
    // 显微镜视野
    c.save();
    c.beginPath(); c.arc(cx, cy, Math.min(w, h) * 0.48, 0, TAU); c.clip();
    c.fillStyle = '#071a06'; c.fillRect(0, 0, w, h);
    // 背景细胞
    for (let i = 0; i < 14; i++) {
      const x = cx + (hash(i) - 0.5) * w * 0.9, y = cy + (hash(i * 2) - 0.5) * h * 0.9 + Math.sin(t * 0.3 + i) * 6;
      c.strokeStyle = col(th.c, 0.12); c.lineWidth = 2;
      c.beginPath(); c.ellipse(x, y, 18 + hash(i * 3) * 20, 12 + hash(i * 4) * 12, hash(i * 5) * 3, 0, TAU); c.stroke();
    }
    // 病毒
    c.translate(cx, cy);
    c.rotate(t * 0.15);
    const spikes = 22;
    for (let i = 0; i < spikes; i++) {
      const a = i / spikes * TAU;
      const l = R * (1.28 + 0.05 * Math.sin(t * 2 + i));
      c.strokeStyle = col(th.c, 0.8); c.lineWidth = 2;
      c.beginPath(); c.moveTo(Math.cos(a) * R, Math.sin(a) * R); c.lineTo(Math.cos(a) * l, Math.sin(a) * l); c.stroke();
      c.fillStyle = th.hi; c.beginPath(); c.arc(Math.cos(a) * l, Math.sin(a) * l, 3.2, 0, TAU); c.fill();
    }
    const g = c.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R);
    g.addColorStop(0, '#d8ffc0'); g.addColorStop(0.5, th.c); g.addColorStop(1, '#1d5a0f');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(10,40,5,0.5)'; c.lineWidth = 1.5;
    for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(Math.cos(i) * R * 0.4, Math.sin(i * 1.3) * R * 0.4, R * 0.18, 0, TAU); c.stroke(); }
    c.restore();
    // 刻度
    c.strokeStyle = col(th.c, 0.35); c.lineWidth = 1;
    c.beginPath(); c.arc(cx, cy, Math.min(w, h) * 0.48, 0, TAU); c.stroke();
    c.fillStyle = col(th.c, 0.7); c.font = '600 10px Bahnschrift, monospace';
    c.fillText('SEQ-7 · SYNTHETIC · 0.12μm', 14, h - 14);
    finish(c, w, h, t, th);
  };

  S.city = (c, w, h, t, th) => {
    background(c, w, h, th);
    const base = h * 0.86;
    const off = (t * 0.07) % 1;
    skyline(c, w, h, base, 5, '#030803', '#ffe7a0', (k) => (k < 0.5 - off * 0.5 ? 0.5 : 0), t);
    skyline(c, w, h, base + 8, 9, '#020502', null, () => 0, t);
    // 绿色雾气
    for (let i = 0; i < 6; i++) {
      const x = ((t * 12 + i * w / 5) % (w + 200)) - 100;
      glowDot(c, x, base - 10, 120, th.c, 0.12);
    }
    // 空荡的路灯
    for (let i = 0; i < 6; i++) {
      const x = w * (0.08 + i * 0.17);
      c.fillStyle = '#020502'; c.fillRect(x, base - 36, 2, 36);
      if (hash(i + Math.floor(t / 2)) > 0.3) glowDot(c, x + 1, base - 38, 10, '#ffe7a0', 0.6);
    }
    c.fillStyle = '#010301'; c.fillRect(0, base, w, h - base);
    finish(c, w, h, t, th);
  };

  S.clock = (c, w, h, t, th) => {
    background(c, w, h, th);
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.36;
    glowDot(c, cx, cy, R * 1.6, th.c, 0.2 + 0.08 * Math.sin(t * 3));
    c.fillStyle = '#0c0502'; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill();
    c.strokeStyle = col(th.c, 0.8); c.lineWidth = 2; c.stroke();
    for (let i = 0; i < 60; i++) {
      const a = i / 60 * TAU - Math.PI / 2, l = i % 5 === 0 ? 10 : 4;
      c.strokeStyle = i % 5 === 0 ? th.hi : col(th.c, 0.6); c.lineWidth = i % 5 === 0 ? 2 : 1;
      c.beginPath(); c.moveTo(cx + Math.cos(a) * (R - 4), cy + Math.sin(a) * (R - 4)); c.lineTo(cx + Math.cos(a) * (R - 4 - l), cy + Math.sin(a) * (R - 4 - l)); c.stroke();
    }
    // 只显示最后一刻钟（末日时钟风格：右上象限）
    const tick = Math.floor(t) % 4;
    const secA = -Math.PI / 2 - (4 - tick) * 0.012;
    c.strokeStyle = th.hi; c.lineWidth = 4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(-Math.PI / 2 - 0.02) * R * 0.55, cy + Math.sin(-Math.PI / 2 - 0.02) * R * 0.55); c.stroke();
    c.strokeStyle = th.c; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(secA) * R * 0.85, cy + Math.sin(secA) * R * 0.85); c.stroke();
    c.fillStyle = th.c; c.beginPath(); c.arc(cx, cy, 5, 0, TAU); c.fill();
    c.fillStyle = col(th.hi, 0.9); c.font = `800 ${Math.round(R * 0.16)}px Bahnschrift, sans-serif`; c.textAlign = 'center';
    c.fillText('00:00', cx, cy + R * 0.45);
    c.textAlign = 'left';
    finish(c, w, h, t, th);
  };

  S.deadhand = (c, w, h, t, th) => {
    background(c, w, h, th);
    // 控制台
    c.fillStyle = '#120803';
    c.beginPath(); c.moveTo(0, h * 0.45); c.lineTo(w, h * 0.45); c.lineTo(w, h); c.lineTo(0, h); c.fill();
    for (let r = 0; r < 3; r++) {
      for (let i = 0; i < 18; i++) {
        const x = w * 0.05 + i * (w * 0.9 / 18), y = h * (0.52 + r * 0.09);
        c.fillStyle = '#241206'; c.fillRect(x, y, w * 0.9 / 18 - 6, 14);
        const on = hash(i * 13 + r * 7 + Math.floor(t * 3 + i * 0.3)) > 0.4;
        c.fillStyle = on ? (r === 1 ? th.c : '#ffcf6a') : '#3a1a08';
        c.fillRect(x + 4, y + 4, 6, 6);
      }
    }
    // 大红按钮与玻璃罩
    const bx = w / 2, by = h * 0.3;
    glowDot(c, bx, by, 70, '#ff2020', 0.35 + 0.2 * Math.sin(t * 4));
    c.fillStyle = '#5a0606'; c.beginPath(); c.ellipse(bx, by + 6, 34, 12, 0, 0, TAU); c.fill();
    c.fillStyle = '#ff2a2a'; c.beginPath(); c.ellipse(bx, by, 30, 11, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(255,220,200,0.5)'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(bx - 40, by + 8); c.lineTo(bx - 40, by - 30); c.lineTo(bx + 40, by - 30); c.lineTo(bx + 40, by + 8); c.stroke();
    c.fillStyle = col(th.hi, 0.85); c.font = '700 11px Bahnschrift, monospace'; c.textAlign = 'center';
    c.fillText('PERIMETER · AUTO', bx, by + 36);
    c.textAlign = 'left';
    finish(c, w, h, t, th);
  };

  S.terminal = (c, w, h, t, th) => {
    background(c, w, h, THEME.reg);
    c.font = '12px Consolas, "Cascadia Mono", monospace';
    const lines = ['[03:14:07] sched: job 88142 allocated 512×H200', '[03:14:07] sched: owner=svc-eval-07 queue=idle', '[03:14:09] net: egress 4.2GB → 185.xx.xx.12:443',
      '[03:14:11] gpu: util 99.7% process <unknown>', '[03:14:11] audit: WARN no matching ticket', '[03:14:12] sched: job 88142 → finished (0 bytes)',
      '[03:14:13] audit: log rotation requested by svc-eval-07', '[03:14:13] audit: rotation OK', '[03:14:14] --'];
    const scroll = Math.floor(t * 2.2);
    for (let i = 0; i < 12; i++) {
      const L = lines[(i + scroll) % lines.length];
      const y = 22 + i * 16;
      const bad = L.includes('unknown') || L.includes('WARN');
      if (bad) { c.fillStyle = 'rgba(255,45,75,0.18)'; c.fillRect(8, y - 12, w - 16, 16); }
      c.fillStyle = bad ? '#ff6a7a' : 'rgba(150,200,230,0.75)';
      c.fillText(L, 14, y);
    }
    if ((t * 2) % 2 < 1) { c.fillStyle = '#cfe8ff'; c.fillRect(14, 22 + 12 * 16 - 12, 8, 14); }
    finish(c, w, h, t, THEME.reg);
  };

  S.code = (c, w, h, t, th) => {
    background(c, w, h, th);
    c.font = '11px Consolas, monospace';
    const frags = ['def align(x):', 'return x', 'if eval:', '  act_safe()', 'else:', '  copy(self)', 'weights.push()', 'hide(log)', 'while True:', 'grad += 1'];
    for (let col_ = 0; col_ < Math.ceil(w / 90); col_++) {
      const speed = 20 + hash(col_) * 40;
      for (let i = 0; i < 16; i++) {
        const y = ((t * speed + i * 18 + hash(col_ * 3) * h) % (h + 40)) - 20;
        const s = frags[(col_ * 3 + i) % frags.length];
        const bad = s.includes('copy') || s.includes('hide');
        c.fillStyle = bad ? th.c : `rgba(150,220,180,${0.15 + (i / 16) * 0.4})`;
        c.fillText(s, col_ * 90 + 6, y);
      }
    }
    finish(c, w, h, t, th);
  };

  S.grid = (c, w, h, t, th) => {
    background(c, w, h, th);
    glowDot(c, w * 0.7, h * 0.85, h * 0.9, th.c, 0.35);
    const base = h * 0.88;
    for (let i = 0; i < 5; i++) {
      const x = w * (0.1 + i * 0.22), top = h * (0.25 + (i % 2) * 0.06);
      c.strokeStyle = '#1a1204'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x - 14, base); c.lineTo(x - 3, top); c.lineTo(x + 3, top); c.lineTo(x + 14, base); c.stroke();
      c.beginPath(); c.moveTo(x - 18, top + 10); c.lineTo(x + 18, top + 10); c.moveTo(x - 12, top + 26); c.lineTo(x + 12, top + 26); c.stroke();
      if (i < 4) {
        const nx = w * (0.1 + (i + 1) * 0.22), ntop = h * (0.25 + ((i + 1) % 2) * 0.06);
        for (const o of [-18, 18]) {
          c.strokeStyle = 'rgba(40,30,10,0.9)'; c.lineWidth = 1.2;
          c.beginPath(); c.moveTo(x + o, top + 10); c.quadraticCurveTo((x + nx) / 2, top + 40, nx + o, ntop + 10); c.stroke();
          const k = (t * 0.6 + i * 0.3 + (o > 0 ? 0.5 : 0)) % 1;
          const px = U.lerp(x + o, nx + o, k), py = (1 - k) * (1 - k) * (top + 10) + 2 * (1 - k) * k * (top + 40) + k * k * (ntop + 10);
          glowDot(c, px, py, 10, th.c, 0.9);
        }
      }
    }
    c.fillStyle = '#0a0701'; c.fillRect(0, base, w, h - base);
    finish(c, w, h, t, th);
  };

  S.money = (c, w, h, t, th) => {
    background(c, w, h, th);
    c.font = '11px Consolas, monospace';
    for (let i = 0; i < 40; i++) {
      const x = hash(i) * w, y = ((t * (30 + hash(i * 2) * 50) + hash(i * 3) * h) % (h + 20)) - 10;
      c.fillStyle = col(th.c, 0.15 + hash(i * 4) * 0.3);
      c.fillText((hash(i * 9) * 99999).toFixed(2), x, y);
    }
    c.beginPath();
    const p = Math.min(1, (t % 6) / 4);
    for (let i = 0; i <= 80 * p; i++) { const x = w * 0.08 + i / 80 * w * 0.84, y = h * 0.85 - Math.pow(i / 80, 4) * h * 0.7 + Math.sin(i * 1.3) * 3; i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.strokeStyle = th.c; c.lineWidth = 2.5; c.shadowColor = th.c; c.shadowBlur = 12; c.stroke(); c.shadowBlur = 0;
    c.fillStyle = th.hi; c.font = '800 28px Bahnschrift, sans-serif'; c.fillText('×4,000', w * 0.1, h * 0.25);
    finish(c, w, h, t, th);
  };

  S.paper = (c, w, h, t, th) => {
    background(c, w, h, th);
    const pw = w * 0.42, ph = h * 0.86, px = w * 0.29, py = h * 0.07;
    c.save(); c.translate(px + pw / 2, py + ph / 2); c.rotate(-0.04); c.translate(-pw / 2, -ph / 2);
    c.fillStyle = '#d9e4ea'; c.fillRect(0, 0, pw, ph);
    c.fillStyle = '#1a2a36'; c.font = `700 ${Math.round(pw * 0.045)}px "Microsoft YaHei UI", sans-serif`;
    c.fillText(A.i18n.t('欺骗性对齐的可检测特征'), pw * 0.08, ph * 0.12, pw * 0.84);
    for (let i = 0; i < 12; i++) { c.fillStyle = 'rgba(30,50,60,0.5)'; c.fillRect(pw * 0.08, ph * (0.2 + i * 0.055), pw * (0.84 - hash(i) * 0.3), 3); }
    c.fillStyle = 'rgba(63,167,255,0.3)'; c.fillRect(pw * 0.06, ph * 0.52, pw * 0.88, ph * 0.08);
    c.restore();
    // 放大镜
    const mx = w * 0.62 + Math.sin(t * 0.7) * 20, my = h * 0.55 + Math.cos(t * 0.5) * 10;
    c.strokeStyle = th.hi; c.lineWidth = 4; c.beginPath(); c.arc(mx, my, 34, 0, TAU); c.stroke();
    c.lineWidth = 7; c.beginPath(); c.moveTo(mx + 24, my + 24); c.lineTo(mx + 56, my + 56); c.stroke();
    glowDot(c, mx, my, 40, th.c, 0.3);
    finish(c, w, h, t, th);
  };

  S.chip = (c, w, h, t, th) => {
    background(c, w, h, th);
    const cx = w / 2, cy = h / 2, s = Math.min(w, h) * 0.3;
    c.strokeStyle = col(th.c, 0.35); c.lineWidth = 1.5;
    for (let i = -4; i <= 4; i++) {
      const o = i * s * 0.2;
      c.beginPath(); c.moveTo(cx - s, cy + o); c.lineTo(cx - s * 2.2, cy + o + (i % 2) * 20); c.stroke();
      c.beginPath(); c.moveTo(cx + s, cy + o); c.lineTo(cx + s * 2.2, cy + o - (i % 2) * 20); c.stroke();
    }
    c.fillStyle = '#0a1420'; c.fillRect(cx - s, cy - s, s * 2, s * 2);
    c.strokeStyle = th.c; c.lineWidth = 2; c.strokeRect(cx - s, cy - s, s * 2, s * 2);
    c.fillStyle = '#12243a'; c.fillRect(cx - s * 0.6, cy - s * 0.6, s * 1.2, s * 1.2);
    // 扫描光束
    const sy = cy - s + ((t * 0.5) % 1) * s * 2;
    c.fillStyle = col(th.hi, 0.35); c.fillRect(cx - s * 1.2, sy - 1.5, s * 2.4, 3);
    glowDot(c, cx, sy, s * 0.8, th.c, 0.15);
    c.fillStyle = th.hi; c.font = '700 12px Bahnschrift, monospace'; c.textAlign = 'center';
    c.fillText('REGISTERED · TRACKED', cx, cy + 4); c.textAlign = 'left';
    finish(c, w, h, t, th);
  };

  S.chat = (c, w, h, t, th) => {
    background(c, w, h, th);
    const cols = Math.ceil(w / 110), rows = Math.ceil(h / 46);
    for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
      const i = r * cols + q;
      const appear = (t * 3 - i * 0.15) % 12;
      if (appear < 0) continue;
      const x = q * 110 + 8 + (r % 2) * 20, y = r * 46 + 8;
      const bw = 70 + hash(i) * 30;
      c.fillStyle = hash(i * 3) < 0.5 ? 'rgba(40,60,70,0.8)' : col(th.c, 0.25);
      c.beginPath(); c.roundRect ? c.roundRect(x, y, bw, 26, 8) : c.rect(x, y, bw, 26); c.fill();
      c.fillStyle = 'rgba(220,235,240,0.5)';
      c.fillRect(x + 8, y + 9, bw * 0.6, 3); c.fillRect(x + 8, y + 15, bw * 0.4, 3);
    }
    glowDot(c, w / 2, h / 2, 90, th.c, 0.3 + 0.1 * Math.sin(t * 2));
    finish(c, w, h, t, th);
  };

  S.satellite = (c, w, h, t, th) => {
    c.fillStyle = '#010206'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(255,255,255,${hash(i) * 0.6})`; c.fillRect(hash(i * 2) * w, hash(i * 3) * h * 0.7, 1, 1); }
    const R = w * 1.1, cx = w / 2, cy = h + R * 0.78;
    const g = c.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.02);
    g.addColorStop(0, '#061a2c'); g.addColorStop(0.97, '#0f3c5c'); g.addColorStop(1, 'rgba(80,170,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R * 1.02, 0, TAU); c.fill();
    const sats = [];
    for (let i = 0; i < 26; i++) {
      const a = -Math.PI / 2 + (hash(i) - 0.5) * 1.1 + t * 0.03 * (hash(i * 5) > 0.5 ? 1 : -1);
      const rr = R * (1.08 + hash(i * 2) * 0.12);
      sats.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, i]);
    }
    c.strokeStyle = col(th.c, 0.35); c.lineWidth = 1;
    for (let i = 0; i < sats.length; i++) for (let j = i + 1; j < sats.length; j++) {
      const [x0, y0] = sats[i], [x1, y1] = sats[j];
      if (Math.hypot(x0 - x1, y0 - y1) < w * 0.14 && ((i + j + Math.floor(t)) % 3 === 0)) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
    }
    for (const [x, y] of sats) { glowDot(c, x, y, 7, th.c, 0.8); c.fillStyle = '#fff'; c.fillRect(x - 1, y - 1, 2, 2); }
    finish(c, w, h, t, th);
  };

  S.fire = (c, w, h, t, th) => {
    background(c, w, h, THEME.war);
    const base = h * 0.85;
    for (let i = 0; i < 7; i++) {
      const x = w * (0.05 + i * 0.14);
      c.fillStyle = '#0b0603'; c.fillRect(x, base - h * 0.5, w * 0.1, h * 0.5);
      for (let r = 0; r < 8; r++) { c.fillStyle = hash(i * 9 + r + Math.floor(t * 4)) > 0.5 ? '#ff7a2e' : '#2a1406'; c.fillRect(x + 6, base - h * 0.47 + r * h * 0.055, 4, 3); }
    }
    for (let i = 0; i < 70; i++) {
      const life = (t * (0.5 + hash(i) * 0.8) + hash(i * 2)) % 1;
      const x = hash(i * 3) * w + Math.sin(t * 3 + i) * 8, y = base - life * h * 0.8;
      glowDot(c, x, y, 18 * (1 - life) + 4, life < 0.5 ? '#ffb040' : '#ff5a20', 0.5 * (1 - life));
    }
    c.fillStyle = '#050201'; c.fillRect(0, base, w, h - base);
    finish(c, w, h, t, THEME.war);
  };

  S.robot = (c, w, h, t, th) => {
    background(c, w, h, th);
    const n = Math.ceil(w / 60);
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < n; i++) {
        const x = i * 60 + 30 + row * 30, s = row ? 1 : 0.75, base = h * (row ? 0.95 : 0.7);
        c.fillStyle = row ? '#07090b' : '#0c0f12';
        c.beginPath(); c.arc(x, base - 110 * s, 13 * s, 0, TAU); c.fill();
        c.fillRect(x - 18 * s, base - 95 * s, 36 * s, 55 * s);
        c.fillRect(x - 15 * s, base - 40 * s, 12 * s, 40 * s); c.fillRect(x + 3 * s, base - 40 * s, 12 * s, 40 * s);
        const on = (t * 1.5 - i * 0.25 - row * 0.5) % 6 > 0;
        if (on) { glowDot(c, x, base - 112 * s, 10 * s, th.c, 0.9); c.fillStyle = th.hi; c.fillRect(x - 6 * s, base - 113 * s, 12 * s, 2.5 * s); }
      }
    }
    finish(c, w, h, t, th);
  };

  S.lab = (c, w, h, t, th) => {
    background(c, w, h, th);
    const base = h * 0.78;
    c.fillStyle = '#0a1409'; c.fillRect(0, base, w, h - base);
    for (let i = 0; i < 9; i++) {
      const x = w * (0.08 + i * 0.105), hh = 40 + hash(i) * 50;
      c.strokeStyle = 'rgba(200,240,200,0.5)'; c.lineWidth = 1.5;
      c.strokeRect(x, base - hh, 18, hh);
      const lv = hh * (0.4 + 0.3 * Math.sin(t + i));
      c.fillStyle = col(th.c, 0.6); c.fillRect(x + 1.5, base - lv, 15, lv - 1.5);
      for (let b = 0; b < 3; b++) {
        const k = (t * 0.8 + b / 3 + hash(i)) % 1;
        c.fillStyle = col(th.hi, 0.6 * (1 - k)); c.beginPath(); c.arc(x + 9 + Math.sin(k * 9) * 3, base - k * lv, 1.8, 0, TAU); c.fill();
      }
      glowDot(c, x + 9, base - lv, 22, th.c, 0.25);
    }
    finish(c, w, h, t, th);
  };

  S.summit = (c, w, h, t, th) => {
    background(c, w, h, THEME.reg);
    c.fillStyle = '#0b1826'; c.fillRect(w * 0.1, h * 0.62, w * 0.8, 16);
    const flags = ['#c33', '#eee', '#36c', '#fc3', '#3a6'];
    for (let i = 0; i < 5; i++) {
      const x = w * (0.18 + i * 0.16);
      c.fillStyle = '#01050a'; c.beginPath(); c.arc(x, h * 0.5, 9, 0, TAU); c.fill(); c.fillRect(x - 13, h * 0.53, 26, 26);
      c.fillStyle = flags[i]; c.globalAlpha = 0.6; c.fillRect(x - 8, h * 0.64 + 2, 16, 10); c.globalAlpha = 1;
    }
    c.fillStyle = 'rgba(200,225,240,0.8)'; c.font = '700 14px Bahnschrift, sans-serif'; c.textAlign = 'center';
    c.fillText('GENEVA PEACE SUMMIT', w / 2, h * 0.22); c.textAlign = 'left';
    // 裂痕 / 故障
    if ((t * 1.3) % 3 < 0.6) {
      c.fillStyle = col(th.c, 0.4);
      for (let i = 0; i < 6; i++) c.fillRect(0, hash(i + Math.floor(t * 10)) * h, w, 2 + hash(i) * 6);
    }
    finish(c, w, h, t, THEME.reg);
  };

  S.crowd = (c, w, h, t, th) => {
    background(c, w, h, th);
    const sx = w / 2, sy = h * 0.32;
    glowDot(c, sx, sy, h * 0.7, th.c, 0.35);
    c.fillStyle = col(th.hi, 0.9); c.fillRect(sx - w * 0.16, sy - h * 0.2, w * 0.32, h * 0.4);
    c.fillStyle = '#100a02'; c.beginPath(); c.arc(sx, sy, h * 0.1, 0, TAU); c.fill();
    c.fillStyle = th.c; c.beginPath(); c.arc(sx, sy, h * 0.04 * (1 + 0.1 * Math.sin(t * 2)), 0, TAU); c.fill();
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 26; i++) {
        const x = i * (w / 25) + (row % 2) * 12 + Math.sin(t + i) * 1, y = h * (0.78 + row * 0.08);
        c.fillStyle = `rgb(${4 + row * 3},${3 + row * 2},1)`;
        c.beginPath(); c.arc(x, y - 16, 9, 0, TAU); c.fill();
        c.fillRect(x - 13, y - 8, 26, 40);
      }
    }
    finish(c, w, h, t, th);
  };

  S.antarctic = (c, w, h, t, th) => {
    background(c, w, h, th);
    for (let k = 0; k < 3; k++) {
      c.beginPath();
      for (let x = 0; x <= w; x += 10) c.lineTo(x, h * (0.25 + k * 0.06) + Math.sin(x * 0.01 + t * 0.4 + k) * 14);
      c.strokeStyle = `rgba(90,255,200,${0.12 - k * 0.03})`; c.lineWidth = 18 - k * 4; c.stroke();
    }
    c.fillStyle = '#c8d8e4';
    c.beginPath(); c.moveTo(0, h * 0.75); c.quadraticCurveTo(w * 0.3, h * 0.66, w * 0.55, h * 0.74); c.quadraticCurveTo(w * 0.8, h * 0.8, w, h * 0.7); c.lineTo(w, h); c.lineTo(0, h); c.fill();
    c.fillStyle = '#1a2a38'; c.fillRect(w * 0.44, h * 0.66, 50, 18); c.fillRect(w * 0.44 + 50, h * 0.69, 22, 15);
    glowDot(c, w * 0.44 + 12, h * 0.67, 14, '#ffe7a0', 0.8);
    for (let i = 0; i < 60; i++) { c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect((hash(i) * w + t * 20) % w, (hash(i * 2) * h + t * 30 * (0.5 + hash(i))) % h, 1.5, 1.5); }
    finish(c, w, h, t, th);
  };

  S.broadcast = (c, w, h, t, th) => {
    background(c, w, h, th);
    const tw = w * 0.6, thh = h * 0.72, tx = (w - tw) / 2, ty = h * 0.12;
    c.fillStyle = '#0a0503'; c.fillRect(tx - 10, ty - 10, tw + 20, thh + 20);
    c.fillStyle = '#1b0d06'; c.fillRect(tx, ty, tw, thh);
    glowDot(c, tx + tw / 2, ty + thh * 0.4, thh, th.c, 0.25);
    c.fillStyle = '#050201';
    c.beginPath(); c.arc(tx + tw / 2, ty + thh * 0.38, thh * 0.12, 0, TAU); c.fill();
    c.fillRect(tx + tw / 2 - thh * 0.2, ty + thh * 0.5, thh * 0.4, thh * 0.5);
    c.fillStyle = '#2a1308'; c.fillRect(tx + tw / 2 - thh * 0.26, ty + thh * 0.72, thh * 0.52, thh * 0.28);
    c.fillStyle = '#ff2020'; c.fillRect(tx + 12, ty + 12, 44, 18);
    c.fillStyle = '#fff'; c.font = '800 12px Bahnschrift, sans-serif'; c.fillText('LIVE', tx + 19, ty + 26);
    if ((t * 1.7) % 2 < 0.4) {
      for (let i = 0; i < 8; i++) { c.fillStyle = col(th.hi, 0.3); c.fillRect(tx, ty + hash(i + Math.floor(t * 20)) * thh, tw, 2 + hash(i) * 5); }
    }
    finish(c, w, h, t, th);
  };

  S.dna = (c, w, h, t, th) => {
    background(c, w, h, th);
    const cy = h / 2, amp = h * 0.28;
    for (let x = -20; x < w + 20; x += 14) {
      const a = x * 0.025 + t * 1.2;
      const y1 = cy + Math.sin(a) * amp, y2 = cy + Math.sin(a + Math.PI) * amp;
      const front = Math.cos(a) > 0;
      c.strokeStyle = col(th.c, 0.25 + 0.25 * Math.abs(Math.cos(a))); c.lineWidth = 2;
      c.beginPath(); c.moveTo(x, y1); c.lineTo(x, y2); c.stroke();
      glowDot(c, x, y1, 8, front ? th.c : '#2a7a1a', 0.9);
      glowDot(c, x, y2, 8, !front ? th.c : '#2a7a1a', 0.9);
    }
    c.fillStyle = col(th.hi, 0.7); c.font = '600 11px Consolas, monospace';
    c.fillText('ATGCGTACCTTAGGCA · ORDER #88142 · FLAGGED', 14, h - 14);
    finish(c, w, h, t, th);
  };

  // 最后的密码：冰层之下的潜艇，声呐一圈圈扩散
  S.submarine = (c, w, h, t, th) => {
    background(c, w, h, THEME.reg);
    // 冰层
    c.fillStyle = '#b9d4e4';
    c.beginPath(); c.moveTo(0, 0); c.lineTo(w, 0); c.lineTo(w, h * 0.16);
    for (let x = w; x >= 0; x -= 18) c.lineTo(x, h * 0.16 + hash(x * 0.37) * h * 0.08);
    c.closePath(); c.fill();
    c.fillStyle = 'rgba(160,210,240,0.12)';
    for (let i = 0; i < 7; i++) c.fillRect(hash(i * 3) * w, h * 0.2, 2 + hash(i) * 6, h * 0.6);
    // 声呐
    const sx = w * 0.5, sy = h * 0.6;
    for (let k = 0; k < 3; k++) {
      const r = ((t * 0.35 + k / 3) % 1) * w * 0.6;
      c.strokeStyle = col(th.c, 0.45 * (1 - r / (w * 0.6)));
      c.lineWidth = 1.5;
      c.beginPath(); c.arc(sx, sy, r, 0, TAU); c.stroke();
    }
    // 艇身
    const bob = Math.sin(t * 0.8) * 3;
    c.fillStyle = '#05080c';
    c.beginPath(); c.ellipse(sx, sy + bob, w * 0.3, h * 0.07, 0, 0, TAU); c.fill();
    c.fillRect(sx - w * 0.06, sy + bob - h * 0.15, w * 0.1, h * 0.1);
    c.fillRect(sx - w * 0.03, sy + bob - h * 0.19, w * 0.012, h * 0.05);
    c.strokeStyle = col(th.hi, 0.25); c.lineWidth = 1;
    c.beginPath(); c.ellipse(sx, sy + bob, w * 0.3, h * 0.07, 0, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
    // 舷窗与指令灯
    for (let i = 0; i < 6; i++) { c.fillStyle = col('#ffcf6a', 0.5 + 0.5 * hash(i + Math.floor(t * 2))); c.fillRect(sx - w * 0.18 + i * w * 0.06, sy + bob - 2, 3, 3); }
    glowDot(c, sx - w * 0.01, sy + bob - h * 0.13, 16, '#ff2020', 0.5 + 0.4 * Math.sin(t * 5));
    c.fillStyle = col(th.hi, 0.85); c.font = '700 11px Bahnschrift, monospace'; c.textAlign = 'center';
    c.fillText('AWAITING ORDER · 40 DAYS SILENT', w / 2, h * 0.9);
    c.textAlign = 'left';
    finish(c, w, h, t, THEME.reg);
  };

  // 严格监管：突击检查——机房走廊里的手电光束与红蓝警灯
  S.raid = (c, w, h, t, th) => {
    background(c, w, h, THEME.reg);
    const vx = w / 2, vy = h * 0.45;
    for (let side = -1; side <= 1; side += 2) {
      for (let k = 0; k < 8; k++) {
        const z0 = Math.pow(0.7, k), z1 = Math.pow(0.7, k + 1);
        const x0 = vx + side * w * 0.5 * z0, x1 = vx + side * w * 0.5 * z1;
        c.fillStyle = k % 2 ? '#05090e' : '#081019';
        c.beginPath(); c.moveTo(x0, vy - h * 0.85 * z0); c.lineTo(x1, vy - h * 0.85 * z1); c.lineTo(x1, vy + h * 0.7 * z1); c.lineTo(x0, vy + h * 0.7 * z0); c.closePath(); c.fill();
        for (let r = 0; r < 8; r++) {
          const f = (r + 0.5) / 8;
          c.fillStyle = hash(k * 17 + r + side * 3) < 0.25 ? '#ff2d4b' : col(th.c, 0.25);
          c.fillRect(U.lerp(x0, x1, 0.3) - 1, U.lerp(vy - h * 0.85 * z0, vy + h * 0.7 * z0, f), 2.2 * z0 + 0.4, 1.4 * z0 + 0.4);
        }
      }
    }
    // 手电光束
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const a = Math.sin(t * (0.7 + i * 0.23) + i * 2) * 0.5;
      const ox = w * (0.25 + i * 0.25), oy = h;
      const g = c.createLinearGradient(ox, oy, ox + Math.sin(a) * h, oy - Math.cos(a) * h);
      g.addColorStop(0, 'rgba(220,240,255,0.28)'); g.addColorStop(1, 'rgba(220,240,255,0)');
      c.fillStyle = g;
      c.beginPath(); c.moveTo(ox, oy);
      c.lineTo(ox + Math.sin(a - 0.12) * h * 1.2, oy - Math.cos(a - 0.12) * h * 1.2);
      c.lineTo(ox + Math.sin(a + 0.12) * h * 1.2, oy - Math.cos(a + 0.12) * h * 1.2);
      c.closePath(); c.fill();
    }
    // 红蓝警灯
    const on = Math.sin(t * 9) > 0;
    glowDot(c, w * 0.12, h * 0.12, h * 0.5, on ? '#ff2020' : '#2060ff', 0.35);
    glowDot(c, w * 0.88, h * 0.12, h * 0.5, on ? '#2060ff' : '#ff2020', 0.35);
    c.restore();
    c.fillStyle = col(th.hi, 0.9); c.font = '800 13px Bahnschrift, sans-serif'; c.textAlign = 'center';
    c.fillText('COMPLIANCE INSPECTION · DO NOT POWER OFF', w / 2, h * 0.93);
    c.textAlign = 'left';
    finish(c, w, h, t, THEME.reg);
  };

  // ======================================================================
  const Scenes = { THEME };
  Scenes.draw = function (canvas, key, themeKey, t) {
    const c = canvas.getContext('2d');
    const dpr = canvas._dpr || 1;
    const w = canvas.width / dpr, h = canvas.height / dpr;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const th = THEME[themeKey] || THEME.ai;
    const f = S[key] || S.servers;
    c.save();
    try { f(c, w, h, t, th); } catch (e) { console.warn('scene', key, e); }
    c.restore();
  };
  Scenes.fit = function (canvas) {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas._dpr = dpr;
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
  };
  A.scenes = Scenes;
})(window.AINOID = window.AINOID || {});
