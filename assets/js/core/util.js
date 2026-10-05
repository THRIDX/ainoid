/* AINOID — 通用工具 */
(function (A) {
  'use strict';

  const U = {};

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.invLerp = (a, b, v) => (v - a) / (b - a);
  U.smooth = (t) => t * t * (3 - 2 * t);
  U.smoothstep = (a, b, v) => { const t = U.clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  U.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  U.damp = (cur, target, lambda, dt) => U.lerp(cur, target, 1 - Math.exp(-lambda * dt));

  // 缓动
  U.ease = {
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inCubic: (t) => t * t * t,
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outQuart: (t) => 1 - Math.pow(1 - t, 4),
    outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    outElastic: (t) => {
      if (t <= 0) return 0; if (t >= 1) return 1;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
    },
  };

  // 可播种随机数
  U.makeRng = (seed) => {
    let s = seed >>> 0 || 1;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  };
  U.rand = Math.random;
  U.range = (a, b) => a + Math.random() * (b - a);
  U.irange = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  U.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.chance = (p) => Math.random() < p;
  U.weighted = (items, wf) => {
    let total = 0;
    for (const it of items) total += Math.max(0, wf(it));
    if (total <= 0) return null;
    let r = Math.random() * total;
    for (const it of items) { r -= Math.max(0, wf(it)); if (r <= 0) return it; }
    return items[items.length - 1];
  };
  U.shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  };

  // 值噪声（用于点阵纹理）
  function hash2(ix, iy) {
    let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  U.vnoise = (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  U.fbm = (x, y) => U.vnoise(x, y) * 0.55 + U.vnoise(x * 2.1 + 17, y * 2.1 + 5) * 0.3 + U.vnoise(x * 4.3 + 3, y * 4.3 + 11) * 0.15;

  // 数字格式
  U.fmtInt = (n) => Math.floor(n).toLocaleString('en-US');
  U.fmtPct = (v, d = 0) => v.toFixed(d) + '%';
  U.fmtPop = (m) => { // 百万 -> 中文
    if (m >= 100) return (m / 100).toFixed(m >= 1000 ? 1 : 2).replace(/\.?0+$/, '') + ' 亿';
    if (m >= 1) return Math.round(m * 100) + ' 万';
    if (m > 0) return Math.max(1, Math.round(m * 1e6)).toLocaleString('en-US');
    return '0';
  };
  U.pad2 = (n) => (n < 10 ? '0' : '') + n;

  // 日期：从 2032-03-14 开始
  const START = Date.UTC(2032, 2, 14);
  U.dateOf = (days) => {
    const d = new Date(START + Math.floor(days) * 86400000);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
  };
  U.fmtDate = (days) => { const t = U.dateOf(days); return `${t.y}.${U.pad2(t.m)}.${U.pad2(t.d)}`; };
  U.fmtDateCN = (days) => { const t = U.dateOf(days); return `${t.y}年${t.m}月${t.d}日`; };

  // 颜色
  U.hexToRgb = (hex) => {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  };
  U.rgba = (rgb, a) => `rgba(${Math.round(rgb[0] * 255)},${Math.round(rgb[1] * 255)},${Math.round(rgb[2] * 255)},${a})`;

  // 统一配色（与 CSS 变量保持一致）
  U.COL = {
    ai: '#ff2d4b', aiHot: '#ff8a7a',
    compute: '#ffc53d', computeHot: '#fff2b8',
    reg: '#3fa7ff', regHot: '#d6ecff',
    bio: '#7dff5a', bioHot: '#e4ffd0',
    war: '#ff7a2e', warHot: '#ffd9b8',
    land: '#1b3a44', text: '#cfe3ea', dim: '#6f8a94',
  };
  U.RGB = {};
  for (const k in U.COL) U.RGB[k] = U.hexToRgb(U.COL[k]);

  // 安全的本地存储
  U.store = {
    get(key, def) {
      try { const v = localStorage.getItem('ainoid.' + key); return v == null ? def : JSON.parse(v); } catch (e) { return def; }
    },
    set(key, val) {
      try { localStorage.setItem('ainoid.' + key, JSON.stringify(val)); } catch (e) { /* 隐私模式等 */ }
    },
  };

  U.isTouch = () => ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  U.el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  // 简单事件总线
  const listeners = {};
  U.on = (name, fn) => { (listeners[name] = listeners[name] || []).push(fn); };
  U.off = (name, fn) => { const l = listeners[name]; if (l) listeners[name] = l.filter((f) => f !== fn); };
  U.emit = (name, data) => { const l = listeners[name]; if (l) for (const f of l.slice()) f(data); };

  A.U = U;
})(window.AINOID = window.AINOID || {});
