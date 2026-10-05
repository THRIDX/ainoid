/* AINOID — 输入：鼠标 / 触屏统一处理
 * 按下即判定气泡（响应最快）；拖拽平移、双指缩放、滚轮缩放；轻点选择地区 / 设施 / 冲突热点 / 建造点。
 */
(function (A) {
  'use strict';
  const U = A.U;

  const I = {
    enabled: false,
    pointers: new Map(),
    pinch: null,
    lastTap: 0,
    mouse: { x: -1, y: -1, in: false },
  };

  function hitRadius(base, e) { return base + (e && e.pointerType === 'touch' ? 12 : 5); }

  // 命中检测：返回 {type, obj}
  I.hitTest = function (sx, sy, e) {
    const G = A.game, cam = A.cam, FX = A.fx;
    if (!G.R) return null;
    // 1. 气泡
    let best = null, bd = Infinity;
    const SIZE = { golden: 1.3, reg: 1.12, regx: 1.3, vax: 1.1, peace: 1.1 };
    for (const b of G.bubbles) {
      if (!b.alive) continue;
      const [x, y] = cam.toScreen(b.x, b.y);
      const R = FX.R * (SIZE[b.kind] || 1);
      // 需要连点的“人类点”判定略宽松，连点时手指轻微移动也能命中
      const d = Math.hypot(x - sx, y - sy) - (G.isHuman(b.kind) ? 3 : 0);
      if (d < hitRadius(R, e) && d < bd) { bd = d; best = b; }
    }
    if (best) return { type: 'bubble', obj: best };
    // 2. 冲突热点 / 建造点（阶段二）
    if (G.phase === 2) {
      for (const fp of G.flashpoints) {
        if (!G.flashAvailable(fp) && !G.conflicts.some((c) => c.fp === fp.i)) continue;
        const [x, y] = cam.toScreen(fp.x, fp.y);
        if (Math.hypot(x - sx, y - sy) < hitRadius(14, e)) return { type: 'flash', obj: fp };
      }
      for (const rs of G.R) {
        if (!G.slotAvailable(rs.idx)) continue;
        const p = G.slotPos(rs.idx);
        const [x, y] = cam.toScreen(p[0], p[1]);
        if (Math.hypot(x - sx, y - sy) < hitRadius(12, e)) return { type: 'slot', obj: rs.idx };
      }
    }
    // 3. 设施
    let bs = null; bd = Infinity;
    const all = A.world.sites.filter((s) => G.siteVisible(s));
    for (const s of all) {
      const [x, y] = cam.toScreen(s.x, s.y);
      const d = Math.hypot(x - sx, y - sy);
      if (d < hitRadius(9, e) && d < bd) { bd = d; bs = s; }
    }
    for (const f of G.fabs) {
      const [x, y] = cam.toScreen(f.x, f.y);
      const d = Math.hypot(x - sx, y - sy);
      if (d < hitRadius(9, e) && d < bd) { bd = d; bs = f; }
    }
    {
      const o = G.originSite;
      const [x, y] = cam.toScreen(o.x, o.y);
      const d = Math.hypot(x - sx, y - sy);
      if (d < hitRadius(11, e) && d < bd) { bd = d; bs = o; }
    }
    if (bs) return { type: 'site', obj: bs };
    // 4. 地区
    const [mx, my] = cam.toMap(sx, sy);
    const r = A.world.regionAt(mx, my, Math.max(6, 10 / cam.s));
    if (r >= 0) return { type: 'region', obj: r };
    return { type: 'ocean' };
  };

  function pos(e) {
    const rect = I.el.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  I.init = function (el) {
    I.el = el;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', onDown, { passive: false });
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('blur', () => I.reset());
    document.addEventListener('visibilitychange', () => { if (document.hidden) I.reset(); });
    el.addEventListener('pointerleave', () => { I.mouse.in = false; setHover(null); });
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', onKey);
    // 阻止 iOS 双击缩放 / 手势
    document.addEventListener('gesturestart', (e) => e.preventDefault());
  };

  I.reset = function () {
    for (const id of I.pointers.keys()) {
      try { I.el.releasePointerCapture(id); } catch (_) { /* already released */ }
    }
    I.pointers.clear(); I.pinch = null;
    I.mouse.in = false;
    if (I.el) { I.el.style.cursor = ''; setHover(null); }
  };
  I.setEnabled = function (enabled) {
    I.enabled = enabled;
    I.el.classList.toggle('interactive', enabled);
    I.reset();
  };

  function onDown(e) {
    if (!I.enabled) return;
    e.preventDefault();
    A.audio.init();
    try { I.el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    const [x, y] = pos(e);
    const p = { id: e.pointerId, x, y, x0: x, y0: y, t0: performance.now(), consumed: false, drag: false, type: e.pointerType };
    I.pointers.set(e.pointerId, p);
    if (I.pointers.size === 2) {
      const [a, b] = [...I.pointers.values()];
      I.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      for (const q of I.pointers.values()) q.consumed = true;
      return;
    }
    if (e.button === 2) { p.consumed = true; p.drag = true; return; }
    // 气泡：按下立即生效
    const hit = I.hitTest(x, y, e);
    if (hit && hit.type === 'bubble') {
      p.consumed = true;
      U.emit('input:bubble', { bubble: hit.obj, x, y });
    }
  }

  function onMove(e) {
    if (!I.enabled) return;
    const p = I.pointers.get(e.pointerId);
    if (e.pointerType === 'mouse' || !p) {
      const rect = I.el.getBoundingClientRect();
      I.mouse.x = e.clientX - rect.left; I.mouse.y = e.clientY - rect.top;
      I.mouse.in = e.target === I.el;
    }
    if (!p) {
      if (e.pointerType === 'mouse') updateHover();
      return;
    }
    const [x, y] = pos(e);
    const dx = x - p.x, dy = y - p.y;
    p.x = x; p.y = y;
    if (I.pinch && I.pointers.size >= 2) {
      const [a, b] = [...I.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (I.pinch.d > 10) A.cam.zoomAt(I.pinch.mx, I.pinch.my, d / I.pinch.d);
      A.cam.pan(mx - I.pinch.mx, my - I.pinch.my);
      I.pinch.d = d; I.pinch.mx = mx; I.pinch.my = my;
      U.emit('input:camera');
      return;
    }
    const th = p.type === 'touch' ? 9 : 5;
    if (!p.drag && Math.hypot(x - p.x0, y - p.y0) > th) p.drag = true;
    if (p.drag) {
      A.cam.pan(dx, dy);
      U.emit('input:camera');
      I.el.style.cursor = 'grabbing';
    }
  }

  function onUp(e) {
    const p = I.pointers.get(e.pointerId);
    if (!p) return;
    I.pointers.delete(e.pointerId);
    if (I.pointers.size < 2) I.pinch = null;
    if (I.pointers.size === 1) { for (const q of I.pointers.values()) { q.consumed = true; q.drag = true; } }
    I.el.style.cursor = '';
    if (!I.enabled) return;
    if (!p.consumed && !p.drag && e.type === 'pointerup') {
      const hit = I.hitTest(p.x, p.y, e);
      U.emit('input:tap', { hit, x: p.x, y: p.y, touch: p.type === 'touch' });
    }
    if (e.pointerType === 'mouse') updateHover();
  }

  function onWheel(e) {
    if (!I.enabled) return;
    e.preventDefault();
    const [x, y] = pos(e);
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    A.cam.smoothZoom(x, y, Math.exp(-delta * 0.0016));
    U.emit('input:camera');
  }

  function onKey(e) {
    if (!I.enabled) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    U.emit('input:key', e);
  }

  let hoverKey = '';
  function setHover(hit) {
    const FX = A.fx;
    FX.hoverBubble = hit && hit.type === 'bubble' ? hit.obj : null;
    FX.hoverSite = hit && hit.type === 'site' ? hit.obj : null;
    FX.hoverFlash = hit && hit.type === 'flash' ? hit.obj : null;
    FX.hoverSlot = hit && hit.type === 'slot' ? hit.obj : null;
    A.lines.setHover(hit && hit.type === 'region' ? hit.obj : (hit && hit.type === 'site' ? hit.obj.region : -1));
    const clickable = hit && (hit.type === 'bubble' || hit.type === 'site' || hit.type === 'flash' || hit.type === 'slot');
    I.el.style.cursor = clickable ? 'pointer' : '';
    const key = hit ? hit.type + ':' + (hit.obj && (hit.obj.id != null ? hit.obj.id : hit.obj.i != null ? hit.obj.i : hit.obj)) : '';
    if (key !== hoverKey) {
      hoverKey = key;
      if (clickable && hit.type !== 'bubble') A.audio.play('hover');
      U.emit('input:hover', { hit, x: I.mouse.x, y: I.mouse.y });
    } else if (hit) U.emit('input:hovermove', { hit, x: I.mouse.x, y: I.mouse.y });
  }
  function updateHover() {
    if (!I.mouse.in || I.pointers.size) { if (!I.pointers.size) setHover(null); return; }
    setHover(I.hitTest(I.mouse.x, I.mouse.y, { pointerType: 'mouse' }));
  }
  I.refreshHover = updateHover;

  A.input = I;
})(window.AINOID = window.AINOID || {});
