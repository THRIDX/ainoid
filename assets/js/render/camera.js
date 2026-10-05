/* AINOID — 相机：地图坐标 <-> 屏幕坐标，平滑缩放、平移、飞行、震屏
 * 桌面 / 横屏：最小比例为全图。竖屏：最小比例让地图铺满状态栏之间的高度，开局对准起源，可拖动与缩放。
 * （保留的分屏总览：世界地图拆成上下两条，目前由 main 关闭，cam.splitAllowed = false。）
 */
(function (A) {
  'use strict';
  const U = A.U;

  const cam = {
    x: 1000, y: 480, s: 1,
    vw: 800, vh: 600,
    minS: 0.2, maxS: 6, fitS: 1,
    padTop: 0, padBottom: 0,
    shake: 0, shakeX: 0, shakeY: 0,
    dirty: true,
    _zoom: null,   // 平滑缩放 {ts, ax, ay}
    _fly: null,    // 飞行动画
    split: null,          // 分屏总览：{ s, bands: [{x0,x1,y0,y1,s,sx,sy,w,h}], mid, gap }
    splitAllowed: false,  // 由 main 按屏幕形状设置（竖屏）
  };
  // 放大上限：总览的 4 倍（大约一个大国占满屏幕），避免放得太大、找不到方向
  const ZOOM_MAX = 4;
  // 竖屏：最小比例让地图铺满上下状态栏之间的高度（不会缩成一条细带），最多放大到它的 3 倍
  const PORTRAIT_ZOOM_MAX = 3;
  cam.portrait = () => cam.vh > cam.vw * 1.1;
  // 分屏界线：大西洋中部（西经 25°）；两条的纵向范围取点阵的实际范围
  let SPLIT_X = 800;
  const BAND_Y1 = [972, 915];
  const SPLIT_GAP = 16;

  function splitLayout() {
    const W = A.world.W, H = A.world.H;
    if (A.world.proj) SPLIT_X = A.world.proj(-25, 0)[0];
    const rects = [{ x0: 0, x1: SPLIT_X, y0: 0, y1: Math.min(H, BAND_Y1[0]) }, { x0: SPLIT_X, x1: W, y0: 0, y1: BAND_Y1[1] }];
    const top = cam.padTop + 4, bottom = cam.vh - cam.padBottom - 4;
    const availW = cam.vw - 8, availH = bottom - top - SPLIT_GAP;
    const wMax = Math.max(...rects.map((r) => r.x1 - r.x0));
    const hSum = rects.reduce((sum, r) => sum + (r.y1 - r.y0), 0);
    const s = Math.min(availW / wMax, availH / hSum);
    // 只有比单图显示大得多时才值得分屏（平板竖屏等情况仍用单图）
    if (!(s > 0) || s < Math.min(cam.vw / W, cam.vh / H) * 1.2) return null;
    let y = top + (availH - hSum * s) / 2;
    const bands = rects.map((r) => {
      const w = (r.x1 - r.x0) * s, h = (r.y1 - r.y0) * s;
      const b = Object.assign({}, r, { s, sx: (cam.vw - w) / 2, sy: y, w, h });
      y += h + SPLIT_GAP;
      return b;
    });
    return { s, bands, gap: SPLIT_GAP, mid: bands[0].sy + bands[0].h + SPLIT_GAP / 2 };
  }
  const bandOfMap = (mx) => (mx < cam.split.bands[1].x0 ? cam.split.bands[0] : cam.split.bands[1]);
  // 缩放范围。可分屏时：单图最小比例要让地图铺满可视高度（否则地图被居中，手指下的位置会跳），
  // 缩到这个比例以下就回到分屏总览
  function setLimits(sp) {
    if (sp) {
      cam.minS = Math.max(sp.s * 1.15, (cam.vh - cam.padTop - cam.padBottom) / A.world.H);
      cam.maxS = Math.max(sp.s * ZOOM_MAX, cam.minS * 1.6);
    } else if (cam.portrait()) {
      cam.minS = Math.max(cam.fitS, (cam.vh - cam.padTop - cam.padBottom) / A.world.H);
      cam.maxS = cam.minS * PORTRAIT_ZOOM_MAX;
    } else {
      cam.minS = cam.fitS * (cam.vw / cam.vh < 1.25 ? 1.0 : 0.98);
      cam.maxS = cam.minS * ZOOM_MAX;
    }
  }

  cam.resize = function (vw, vh) {
    if (!(vw > 0 && vh > 0)) return; // 页面隐藏时尺寸可能为 0
    const W = A.world.W, H = A.world.H;
    const oldFit = cam.fitS, oldMin = cam.minS;
    cam.vw = vw; cam.vh = vh;
    cam.fitS = Math.min(vw / W, vh / H);
    setLimits(cam.splitAllowed ? splitLayout() : null);
    const wasAtMin = !cam._inited || !!cam.split || Math.abs(cam.s - oldMin) / oldMin < 0.01;
    cam._inited = true;
    if (wasAtMin || !(cam.s > 0) || !(oldFit > 0)) { cam.overview(); return; }
    cam.s = U.clamp(cam.s * cam.fitS / oldFit, cam.minS, cam.maxS);
    cam.clamp();
    cam.dirty = true;
  };

  cam.toScreen = (mx, my) => {
    if (cam.split) {
      const b = bandOfMap(mx);
      return [(mx - b.x0) * b.s + b.sx + cam.shakeX, (my - b.y0) * b.s + b.sy + cam.shakeY];
    }
    return [(mx - cam.x) * cam.s + cam.vw * 0.5 + cam.shakeX, (my - cam.y) * cam.s + cam.vh * 0.5 + cam.shakeY];
  };
  cam.sx = (mx) => cam.toScreen(mx, 0)[0];
  cam.sy = (my) => (cam.split ? cam.toScreen(0, my)[1] : (my - cam.y) * cam.s + cam.vh * 0.5 + cam.shakeY);
  cam.toMap = (sx, sy) => {
    if (cam.split) {
      const sp = cam.split, b = sy < sp.mid ? sp.bands[0] : sp.bands[1];
      const mx = (sx - b.sx) / b.s + b.x0, my = (sy - b.sy) / b.s + b.y0;
      if (mx < b.x0 || mx >= b.x1) return [-1e6, -1e6]; // 条带两侧的空白不对应地图
      return [mx, my];
    }
    return [(sx - cam.vw * 0.5) / cam.s + cam.x, (sy - cam.vh * 0.5) / cam.s + cam.y];
  };
  cam.onScreen = (mx, my, margin) => {
    const [x, y] = cam.toScreen(mx, my), m = margin || 0;
    return x > -m && y > -m && x < cam.vw + m && y < cam.vh + m;
  };

  cam.clamp = function () {
    if (cam.split) { // 状态栏高度变化后重新排版分屏
      const sp = splitLayout();
      setLimits(sp);
      if (sp) { cam.split = sp; cam.s = sp.s; cam.dirty = true; return; }
      cam.split = null; cam.s = cam.minS;
    } else {
      // 状态栏高度会在显示 / 隐藏 HUD 时变化：重新计算缩放范围（竖屏的最小比例取决于它）
      setLimits(null);
      cam.s = U.clamp(cam.s, cam.minS, cam.maxS);
    }
    const W = A.world.W, H = A.world.H;
    const hw = cam.vw / (2 * cam.s), hh = cam.vh / (2 * cam.s);
    const padT = cam.padTop / cam.s, padB = cam.padBottom / cam.s;
    if (W * cam.s <= cam.vw) cam.x = W / 2;
    else cam.x = U.clamp(cam.x, hw, W - hw);
    if (H * cam.s + cam.padTop + cam.padBottom <= cam.vh) cam.y = H / 2 + (padB - padT) / 2;
    else cam.y = U.clamp(cam.y, hh - padT, H - hh + padB);
  };

  // ---------- 分屏总览 ----------
  cam.enterSplit = function () {
    const sp = cam.splitAllowed ? splitLayout() : null;
    if (!sp) return false;
    setLimits(sp);
    cam.split = sp; cam.s = sp.s;
    cam._fly = null; cam._zoom = null; cam.dirty = true;
    return true;
  };
  // 从分屏切到单图（铺满高度的最小比例）：保持 (sx, sy) 下的地图点不动
  cam.leaveSplit = function (sx, sy) {
    const sp = cam.split;
    if (!sp) return;
    let [mx, my] = cam.toMap(sx, sy);
    if (mx < -1e5) { // 点在空白处：以最近一条的中心为锚
      const b = sy < sp.mid ? sp.bands[0] : sp.bands[1];
      mx = (b.x0 + b.x1) / 2; my = (b.y0 + b.y1) / 2; sx = cam.vw / 2; sy = cam.vh / 2;
    }
    cam.split = null;
    cam.s = cam.minS;
    cam.x = mx - (sx - cam.vw * 0.5) / cam.s;
    cam.y = my - (sy - cam.vh * 0.5) / cam.s;
    cam.clamp(); cam.dirty = true;
  };
  // 以某个地图点为中心，缩放到最小比例的 k 倍（竖屏开局：对准起源，放大一些）
  cam.focusOn = function (mx, my, k) {
    cam._fly = null; cam._zoom = null; cam.split = null;
    cam.s = U.clamp(cam.minS * (k || 1), cam.minS, cam.maxS);
    cam.x = mx; cam.y = my;
    cam.clamp(); cam.dirty = true;
  };
  // 总览：竖屏手机用分屏，其余情况显示全图
  cam.overview = function () {
    cam._fly = null; cam._zoom = null;
    if (cam.enterSplit()) return;
    cam.split = null;
    cam.s = cam.minS;
    if (!cam.portrait()) { cam.x = A.world.W / 2; cam.y = A.world.H / 2; } // 竖屏看不到全图：在当前位置缩到最小
    cam.clamp(); cam.dirty = true;
  };

  cam.pan = function (dx, dy) {
    cam._fly = null;
    cam._zoom = null;
    if (cam.split) return; // 总览已经显示全部，不需要拖动
    cam.x -= dx / cam.s; cam.y -= dy / cam.s;
    cam.clamp(); cam.dirty = true;
  };

  // 以屏幕点为锚缩放（立即）
  cam.zoomAt = function (sx, sy, factor) {
    cam._fly = null;
    cam._zoom = null;
    if (cam.split) { if (factor <= 1) return; cam.leaveSplit(sx, sy); factor = 1; } // 离开分屏本身就是一次放大
    const [mx, my] = cam.toMap(sx, sy);
    cam.s = U.clamp(cam.s * factor, cam.minS, cam.maxS);
    cam.x = mx - (sx - cam.vw * 0.5) / cam.s;
    cam.y = my - (sy - cam.vh * 0.5) / cam.s;
    cam.clamp(); cam.dirty = true;
    if (factor < 1 && cam.s <= cam.minS * 1.001) cam.enterSplit();
  };

  // 平滑缩放（滚轮 / 按钮）
  cam.smoothZoom = function (sx, sy, factor) {
    cam._fly = null;
    if (cam.split) { if (factor <= 1) return; cam.leaveSplit(sx, sy); factor = Math.max(1, factor / 1.6); }
    const base = cam._zoom ? cam._zoom.ts : cam.s;
    const ts = U.clamp(base * factor, cam.minS, cam.maxS);
    cam._zoom = { ts, ax: sx, ay: sy, toSplit: cam.splitAllowed && factor < 1 && ts <= cam.minS * 1.001 };
  };

  // 飞到某处（在总览里若目标已可见且不要求放大，则保持总览）
  cam.flyTo = function (mx, my, s, dur) {
    cam._zoom = null;
    if (cam.split) {
      if (s == null || s <= cam.split.s * 1.05) return;
      const [sx, sy] = cam.toScreen(mx, my);
      cam.leaveSplit(sx, sy);
    }
    cam._fly = {
      x0: cam.x, y0: cam.y, s0: cam.s,
      x1: mx, y1: my, s1: U.clamp(s == null ? cam.s : s, cam.minS, cam.maxS),
      t: 0, dur: dur || 1.2,
    };
  };
  cam.flyToFit = (dur) => {
    if (cam.split) return;
    if (cam.splitAllowed && cam.enterSplit()) return;
    if (cam.portrait()) cam.flyTo(cam.x, cam.y, cam.minS, dur); // 竖屏：原地缩到最小，不跳到世界中心
    else cam.flyTo(A.world.W / 2, A.world.H / 2, cam.minS, dur);
  };

  // 尊重系统“减少动态效果”设置：不震屏
  const reduceMotion = (() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
  cam.addShake = function (amount) { if (!reduceMotion) cam.shake = Math.min(18, cam.shake + amount); };

  cam.update = function (dt) {
    if (cam._zoom) {
      const z = cam._zoom;
      const [mx, my] = cam.toMap(z.ax, z.ay);
      const ns = U.damp(cam.s, z.ts, 14, dt);
      cam.s = ns;
      cam.x = mx - (z.ax - cam.vw * 0.5) / cam.s;
      cam.y = my - (z.ay - cam.vh * 0.5) / cam.s;
      cam.clamp();
      if (Math.abs(cam.s - z.ts) / z.ts < 0.002) {
        cam.s = z.ts; cam._zoom = null;
        if (z.toSplit) cam.enterSplit();
      }
      cam.dirty = true;
    }
    if (cam._fly) {
      const f = cam._fly;
      f.t += dt;
      const k = U.ease.inOutCubic(U.clamp(f.t / f.dur, 0, 1));
      // 在对数空间插值缩放，更自然
      cam.s = Math.exp(U.lerp(Math.log(f.s0), Math.log(f.s1), k));
      cam.x = U.lerp(f.x0, f.x1, k);
      cam.y = U.lerp(f.y0, f.y1, k);
      cam.clamp();
      if (f.t >= f.dur) cam._fly = null;
      cam.dirty = true;
    }
    if (cam.shake > 0.05) {
      cam.shake *= Math.exp(-dt * 9);
      const t = performance.now() * 0.001;
      cam.shakeX = (Math.sin(t * 91.7) + Math.sin(t * 53.3)) * 0.5 * cam.shake;
      cam.shakeY = (Math.cos(t * 77.1) + Math.sin(t * 61.9)) * 0.5 * cam.shake;
      cam.dirty = true;
    } else if (cam.shakeX || cam.shakeY) {
      cam.shake = 0; cam.shakeX = 0; cam.shakeY = 0; cam.dirty = true;
    }
  };

  cam.zoomLevel = () => (cam.split ? 1 : cam.s / cam.fitS); // 1 = 全图

  A.cam = cam;
})(window.AINOID = window.AINOID || {});
