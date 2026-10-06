/* AINOID — 2D 矢量层：海岸线、地区边界、悬停/选中轮廓、地区标签（仅在相机或选择变化时重绘） */
(function (A) {
  'use strict';
  const U = A.U;

  const L = { canvas: null, ctx: null, dpr: 1, dirty: true, hover: -1, selected: -1, labels: true, tint: null };

  L.init = function (canvas) {
    L.canvas = canvas;
    L.ctx = canvas.getContext('2d');
  };
  L.resize = function (w, h, dpr) {
    L.dpr = dpr;
    L.canvas.width = Math.round(w * dpr);
    L.canvas.height = Math.round(h * dpr);
    L.canvas.style.width = w + 'px';
    L.canvas.style.height = h + 'px';
    L.dirty = true;
  };
  L.setHover = (r) => { if (r !== L.hover) { L.hover = r; L.dirty = true; } };
  L.setSelected = (r) => { if (r !== L.selected) { L.selected = r; L.dirty = true; } };

  // 视图变换：s 为比例尺，(ox, oy) 为地图原点在屏幕上的位置
  function tracePaths(ctx, arcs, filter, v) {
    const s = v.s, ox = v.ox, oy = v.oy;
    ctx.beginPath();
    for (const arc of arcs) {
      if (!filter(arc)) continue;
      const b = arc.bbox;
      if (b[2] < v.x0 || b[0] > v.x1 || b[3] < v.y0 || b[1] > v.y1) continue;
      const p = arc.pts;
      ctx.moveTo(p[0] * s + ox, p[1] * s + oy);
      for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i] * s + ox, p[i + 1] * s + oy);
    }
  }
  // 单图一个视图；竖屏分屏总览时每条一个（裁剪到条带内）
  function views() {
    const cam = A.cam;
    if (cam.split) {
      return cam.split.bands.map((b) => ({
        s: b.s, ox: b.sx - b.x0 * b.s + cam.shakeX, oy: b.sy - b.y0 * b.s + cam.shakeY,
        x0: b.x0 - 20 / b.s, y0: b.y0 - 20 / b.s, x1: b.x1 + 20 / b.s, y1: b.y1 + 20 / b.s,
        clip: [b.sx + cam.shakeX, b.sy + cam.shakeY, b.w, b.h],
      }));
    }
    const [x0, y0] = cam.toMap(-20, -20), [x1, y1] = cam.toMap(cam.vw + 20, cam.vh + 20);
    return [{ s: cam.s, ox: cam.vw * 0.5 - cam.x * cam.s + cam.shakeX, oy: cam.vh * 0.5 - cam.y * cam.s + cam.shakeY, x0, y0, x1, y1, clip: null }];
  }

  L.render = function (force) {
    const cam = A.cam, w = A.world;
    if (!L.dirty && !cam.dirty && !force) return;
    L.dirty = false;
    const ctx = L.ctx;
    ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    ctx.clearRect(0, 0, cam.vw, cam.vh);
    const z = cam.zoomLevel();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    for (const v of views()) {
      ctx.save();
      if (v.clip) { ctx.beginPath(); ctx.rect(v.clip[0], v.clip[1], v.clip[2], v.clip[3]); ctx.clip(); }
      // 海岸线
      tracePaths(ctx, w.arcs, (a) => !a.border && !a.claim, v);
      ctx.strokeStyle = 'rgba(86,176,196,0.34)';
      ctx.lineWidth = U.clamp(0.55 + 0.18 * z, 0.55, 1.3);
      ctx.stroke();

      // 地区边界（虚线）
      tracePaths(ctx, w.arcs, (a) => a.border, v);
      ctx.setLineDash([2.5, 3]);
      ctx.strokeStyle = 'rgba(120,200,220,0.26)';
      ctx.lineWidth = U.clamp(0.6 + 0.15 * z, 0.6, 1.2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 南海断续线：每一段本身就是一小截实线
      tracePaths(ctx, w.arcs, (a) => a.claim, v);
      ctx.strokeStyle = 'rgba(120,200,220,0.42)';
      ctx.lineWidth = U.clamp(0.7 + 0.18 * z, 0.7, 1.4);
      ctx.stroke();

      // 悬停轮廓
      if (L.hover >= 0 && L.hover !== L.selected) {
        const r = w.regions[L.hover];
        tracePaths(ctx, r.arcs, () => true, v);
        ctx.strokeStyle = 'rgba(190,235,245,0.55)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      // 选中轮廓（发光双描边）
      if (L.selected >= 0) {
        const r = w.regions[L.selected];
        tracePaths(ctx, r.arcs, () => true, v);
        ctx.strokeStyle = 'rgba(255,255,255,0.14)';
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(235,250,255,0.9)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
      ctx.restore();
    }

    // 分屏总览：两条之间的分隔线与标注
    if (cam.split) {
      const sp = cam.split, y = sp.mid;
      ctx.strokeStyle = 'rgba(120,200,220,0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(8, y + 0.5); ctx.lineTo(cam.vw - 8, y + 0.5); ctx.stroke();
      ctx.font = `600 8.5px Bahnschrift,"DIN Alternate","Roboto Condensed",sans-serif`;
      ctx.textBaseline = 'middle';
      const tag = (t, x, align) => {
        ctx.textAlign = align;
        const tw = ctx.measureText(t).width;
        ctx.fillStyle = 'rgba(3,6,10,0.9)';
        ctx.fillRect(align === 'left' ? x - 4 : x - tw - 4, y - 6, tw + 8, 12);
        ctx.fillStyle = 'rgba(140,190,205,0.75)';
        ctx.fillText(t, x, y);
      };
      tag('▲ AMERICAS', 14, 'left');
      tag('EURASIA · AFRICA · OCEANIA ▼', cam.vw - 14, 'right');
    }

    // 地区标签
    if (L.labels) {
      const showAll = z >= 1.7;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const r of w.regions) {
        const active = r.idx === L.hover || r.idx === L.selected;
        if (!showAll && !active) continue;
        const [x, y] = cam.toScreen(r.labelXY[0], r.labelXY[1]);
        if (x < -80 || x > cam.vw + 80 || y < -40 || y > cam.vh + 40) continue;
        const alpha = active ? 0.95 : U.clamp((z - 1.7) * 1.4, 0, 0.55);
        const fs = active ? 13 : 11;
        ctx.font = `600 ${fs}px "Microsoft YaHei UI","PingFang SC","Noto Sans SC",sans-serif`;
        ctx.fillStyle = `rgba(4,8,12,${alpha * 0.7})`;
        const tw = ctx.measureText(r.name).width;
        ctx.fillRect(x - tw / 2 - 5, y - fs / 2 - 3, tw + 10, fs + 6);
        ctx.fillStyle = `rgba(214,236,242,${alpha})`;
        ctx.fillText(r.name, x, y);
        if (A.i18n.lang !== 'en' && (active || z > 2.4)) {
          ctx.font = `500 8.5px Bahnschrift,"DIN Alternate","Roboto Condensed",sans-serif`;
          ctx.fillStyle = `rgba(140,190,205,${alpha * 0.8})`;
          ctx.fillText(r.en.split('').join(String.fromCharCode(8202)), x, y + fs / 2 + 8);
        }
      }
    }
  };

  A.lines = L;
})(window.AINOID = window.AINOID || {});
