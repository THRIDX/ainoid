/* AINOID — 地区面板、地图弹出卡片、悬停提示 */
(function (A) {
  'use strict';
  const U = A.U;
  const ic = (n, c) => A.icon(n, c);

  const P = { region: -1, pop: null, popTarget: null, tip: null, dirty: false, lastSig: '' };

  function dots(v, max, cls) {
    const n = Math.round(v / max * 10);
    let s = `<span class="dots ${cls || ''}">`;
    for (let i = 0; i < 10; i++) s += `<i class="${i < n ? 'on' : ''}"></i>`;
    return s + '</span>';
  }
  function siteExp(s) {
    const G = A.game, CFG = A.CFG, r = A.world.regions[s.region];
    const red = Math.min(0.35, CFG.netExpRed * G.ownedCount('NET'));
    return (CFG.seizeExpBase + CFG.seizeExpK * r.reg) * (s.type === 'NET' ? 0.5 : 1) * (G.phase === 2 ? 1.2 : 1) * G.diff.seizeExp * (1 - red);
  }
  P.siteExp = siteExp;

  // ======================================================================
  // 地区面板
  // ======================================================================
  P.build = function () {
    P.el = document.getElementById('panel');
    P.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    P.el.addEventListener('click', onPanelClick);
    P.tip = document.getElementById('tooltip');
  };

  P.open = function (ri) {
    A.game.pause('inspect');
    const was = P.region;
    P.region = ri;
    A.lines.setSelected(ri);
    P.render(true);
    P.el.classList.remove('hidden');
    requestAnimationFrame(() => P.el.classList.add('in'));
    if (was !== ri) { A.audio.play('open'); revealRegion(ri); }
  };
  // 如果地区被面板挡住，平移镜头把它让出来
  function revealRegion(ri) {
    const cam = A.cam, r = A.world.regions[ri];
    const [lx, ly] = cam.toScreen(r.labelXY[0], r.labelXY[1]);
    const portrait = document.body.classList.contains('portrait');
    // 分屏总览不移动地图：地区在下面一条时，面板改从上方出现，不挡住选中的地区
    P.el.classList.toggle('at-top', !!cam.split && ly > cam.split.mid);
    if (cam.split) return;
    if (portrait) {
      const limit = window.innerHeight * 0.38;
      if (ly > limit) cam.flyTo(cam.x, cam.y + (ly - window.innerHeight * 0.28) / cam.s, cam.s, 0.5);
    } else {
      const pw = P.el.offsetWidth || 336;
      const limit = window.innerWidth - pw - 90;
      if (lx > limit) cam.flyTo(cam.x + (lx - (window.innerWidth - pw) * 0.5) / cam.s, cam.y, cam.s, 0.5);
    }
  }
  P.close = function () {
    if (P.region < 0) return;
    P.region = -1;
    if (!P.pop) A.game.resume('inspect');
    A.lines.setSelected(-1);
    P.el.classList.remove('in');
    A.audio.play('close');
    setTimeout(() => { if (P.region < 0) P.el.classList.add('hidden'); }, 260);
  };

  function statusChip(G, r, rs) {
    if (rs.seeded) return A.i18n.t`<span class="chip ai">${ic('aiEye')}已渗透 <span class="inf-v">${Math.round(rs.inf * 100)}%</span></span>`;
    if (G.regionReachable(r.idx)) return A.i18n.t`<span class="chip warn">${ic('globe')}未渗透 · 可夺取设施进入</span>`;
    return A.i18n.t`<span class="chip dim">${ic('lock')}网络不可达</span>`;
  }

  P.sig = function () {
    const G = A.game;
    if (P.region < 0 || !G.R) return '';
    const rs = G.R[P.region];
    const r = A.world.regions[P.region];
    // 只包含会改变面板内容的离散状态（不含实时算力数值），避免按钮在点击过程中被重建
    const parts = [G.phase, G.slotAvailable(P.region), rs.seeded, Math.floor(rs.bio * 20), Math.floor(rs.war * 20), Math.floor(rs.death * 20), !!rs.fab, G.conflicts.length, G.regionReachable(r.idx)];
    for (const s of r.sites) parts.push(s.owned ? 'o' : (G.canSeize(s).ok ? 'a' : 'x') + G.siteCost(s));
    parts.push(G.compute >= G.fabCost() ? 'f' : 'n', G.fabCost(), G.compute >= G.conflictCost() ? 'c' : 'n', G.conflictCost());
    for (const fp of G.flashpoints) if (fp.a === r.idx || fp.b === r.idx) {
      const c = G.conflicts.find((cc) => cc.fp === fp.i);
      parts.push(c ? c.level : G.flashAvailable(fp) ? 'a' : 'x');
    }
    return parts.join('|');
  };

  P.render = function (force) {
    const G = A.game;
    if (P.region < 0 || !G.R) return;
    const sig = P.sig();
    if (!force && sig === P.lastSig) {
      // 渗透度等连续变化的数值就地更新，不重建面板
      const rs = G.R[P.region];
      const fill = P.el.querySelector('.p-inf-fill');
      if (fill) fill.style.transform = `scaleX(${rs.inf})`;
      const chip = P.el.querySelector('.p-status .chip.ai .inf-v');
      if (chip) { const v = Math.round(rs.inf * 100) + '%'; if (chip.textContent !== v) chip.textContent = v; }
      return;
    }
    P.lastSig = sig;
    const r = A.world.regions[P.region], rs = G.R[P.region];
    const pop = r.pop * (1 - rs.death);
    let html = A.i18n.t`
      <div class="p-head">
        <div><div class="p-name">${r.name}</div><div class="p-en">${r.en}</div></div>
        <button class="p-close" data-act="close">${ic('close')}</button>
      </div>
      <div class="p-status">${statusChip(G, r, rs)}${r.idx === G.origin ? A.i18n.t`<span class="chip origin">${ic('ORIGIN')}起源</span>` : ''}</div>
      <div class="p-inf"><div class="p-inf-fill" style="transform:scaleX(${rs.inf})"></div></div>
      <div class="p-stats">
        <div><span>人口</span><b>${U.fmtPop(pop)}</b></div>
        <div><span>算力容量</span>${dots(r.cap, 10, 'gold')}</div>
        <div><span>监管强度</span>${dots(r.reg * 10, 10, 'blue')}</div>
        <div><span>网络连通</span>${dots(r.conn * 10, 10, 'cyan')}</div>
        ${G.phase === 2 && G.route === 'bio' ? A.i18n.t`
        <div><span>生物科技</span>${dots(r.bio, 10, 'green')}</div>
        <div><span>生物污染</span><b class="c-bio">${Math.round(rs.bio * 100)}%</b></div>` : ''}
        ${G.phase === 2 && G.route === 'war' ? A.i18n.t`
        <div><span>军事力量</span>${dots(r.mil, 10, 'orange')}</div>
        <div><span>战火</span><b class="c-war">${Math.round(rs.war * 100)}%</b></div>` : ''}
      </div>
      <div class="p-sec">设施 <span>FACILITIES</span></div>
      <div class="p-sites">`;
    const sites = r.sites.filter((s) => G.siteVisible(s));
    if (r.idx === G.origin) {
      html += A.i18n.t`<div class="site owned origin">${ic('ORIGIN', 't-ai')}<div class="s-info"><b>${G.originSite.name}</b><span>起源 · 它醒来的地方</span></div><span class="s-tag">核心</span></div>`;
    }
    for (const s of sites) html += siteRow(G, s);
    if (rs.fab) html += A.i18n.t`<div class="site owned">${ic('FAB', 't-bio')}<div class="s-info"><b>${r.name} · 自动化生物工厂</b><span>生物进度 +${(A.CFG.fabRate * 60).toFixed(1)}%/分钟</span></div><span class="s-tag">已控制</span></div>`;
    if (!sites.length && r.idx !== G.origin && !rs.fab) html += A.i18n.t('<div class="empty">该地区没有可夺取的关键设施。</div>');
    html += '</div>';

    if (G.phase === 2) {
      let acts = '';
      if (G.route === 'bio' && !rs.fab) {
        const cost = G.fabCost();
        const ok = G.slotAvailable(r.idx);
        acts += A.i18n.t`<button class="act bio" data-act="fab" ${ok && G.compute >= cost ? '' : 'disabled'}>
          ${ic('FAB')}<div><b>建造自动化生物工厂</b><span>${ok ? A.i18n.t('生物进度持续增长，释放后成为扩散源') : A.i18n.t('需要渗透度 ≥ 30%')}</span></div><em>◆ ${cost}</em></button>`;
      }
      for (const fp of G.route === 'war' ? G.flashpoints : []) {
        if (fp.a !== r.idx && fp.b !== r.idx) continue;
        const other = A.world.regions[fp.a === r.idx ? fp.b : fp.a];
        const c = G.conflicts.find((cc) => cc.fp === fp.i);
        if (c) {
          acts += A.i18n.t`<div class="act war live">${ic('swords')}<div><b>${fp.name}</b><span>对手：${other.name} · 当前：${G.levelName(c.level)}</span></div><em class="lv">LV ${c.level}</em></div>`;
        } else {
          const ok = G.flashAvailable(fp), cost = G.conflictCost();
          acts += A.i18n.t`<button class="act war" data-act="flash" data-fp="${fp.i}" ${ok && G.compute >= cost ? '' : 'disabled'}>
            ${ic('swords')}<div><b>挑起：${fp.name}</b><span>${ok ? A.i18n.t('对手：') + other.name : A.i18n.t('需双方渗透度 ≥ 20%（') + other.name + '）'}</span></div><em>◆ ${cost}</em></button>`;
        }
      }
      // 两条路线互斥：只列出所选路线的行动
      if (acts) html += A.i18n.t`<div class="p-sec">终局行动 <span>${G.routeName()}</span></div><div class="p-actions">${acts}</div>`;
    }
    P.el.innerHTML = html;
  };

  function siteRow(G, s) {
    const tcls = { DC: 't-gold', GRID: 't-gold', NET: 't-cyan', LAB: 't-bio', MIL: 't-war' }[s.type] || '';
    if (s.owned) {
      return A.i18n.t`<div class="site owned" data-site="${s.id}">${ic(s.type, tcls)}<div class="s-info"><b>${s.name}</b><span>${A.TYPE_NAME[s.type]} · ${A.TYPE_DESC[s.type]}</span></div><span class="s-tag">已控制</span></div>`;
    }
    const chk = G.canSeize(s);
    const cost = G.siteCost(s);
    const reach = G.regionReachable(s.region);
    const exp = siteExp(s);
    return `<div class="site" data-site="${s.id}">${ic(s.type, tcls)}<div class="s-info"><b>${s.name}</b><span>${A.TYPE_NAME[s.type]} · ${A.TYPE_DESC[s.type]}</span></div>
      <button class="seize" data-act="seize" data-site="${s.id}" ${chk.ok ? '' : 'disabled'}>
        ${reach ? A.i18n.t`<em>◆ ${cost}</em><small>监管 +${exp.toFixed(1)}%</small>` : A.i18n.t`${ic('lock')}<small>不可达</small>`}
      </button></div>`;
  }

  function onPanelClick(e) {
    const btn = e.target.closest('[data-act]');
    const row = e.target.closest('.site[data-site]');
    const G = A.game;
    if (!btn) {
      if (row) { // 点击设施行：镜头飞过去
        const s = A.world.sites[+row.dataset.site];
        if (s) A.cam.flyTo(s.x, s.y, Math.max(A.cam.s, A.cam.fitS * 2.2), 0.7);
      }
      return;
    }
    e.stopPropagation();
    const act = btn.dataset.act;
    if (act === 'close') { P.close(); return; }
    if (act === 'seize') { U.emit('ui:seize', A.world.sites[+btn.dataset.site]); }
    else if (act === 'fab') { U.emit('ui:fab', P.region); }
    else if (act === 'flash') { U.emit('ui:flash', G.flashpoints[+btn.dataset.fp]); }
    P.render(true);
  }

  // ======================================================================
  // 地图弹出卡片（设施 / 冲突热点 / 建造点）
  // ======================================================================
  P.showPop = function (target) {
    P.hidePop(true);
    A.game.pause('inspect');
    const G = A.game;
    const el = U.el('div', 'mappop');
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    let html = '', x, y, act = null;
    if (target.type === 'site') {
      const s = target.obj;
      x = s.x; y = s.y;
      const r = A.world.regions[s.region];
      const type = s.type;
      const tcls = { DC: 't-gold', GRID: 't-gold', NET: 't-cyan', LAB: 't-bio', MIL: 't-war', FAB: 't-bio', ORIGIN: 't-ai' }[type];
      html = `<div class="mp-head">${ic(type, tcls)}<div><b>${s.name || r.name}</b><span>${r.name} · ${A.TYPE_NAME[type]}</span></div></div><div class="mp-desc">${A.TYPE_DESC[type]}</div>`;
      if (s.owned || type === 'FAB' || type === 'ORIGIN') {
        html += A.i18n.t('<div class="mp-owned">● 已控制</div>');
      } else {
        const chk = G.canSeize(s), cost = G.siteCost(s), reach = G.regionReachable(s.region);
        const exp = siteExp(s);
        const why = !reach ? A.i18n.t('网络不可达：先渗透相邻地区') : chk.why === 'compute' ? A.i18n.t`算力不足（还差 ${Math.ceil(cost - G.compute)}）` : '';
        html += A.i18n.t`<button class="mp-btn" data-act="seize" ${chk.ok ? '' : 'disabled'}><b>夺取</b><em>◆ ${cost}</em><small>监管 +${exp.toFixed(1)}%</small></button>${why ? `<div class="mp-why">${why}</div>` : ''}`;
        if (!G.R[s.region].seeded && reach) html += A.i18n.t('<div class="mp-note">夺取后，AI 将从这里进入') + r.name + '。</div>';
        act = () => U.emit('ui:seize', s);
      }
    } else if (target.type === 'flash') {
      const fp = target.obj;
      x = fp.x; y = fp.y;
      const ra = A.world.regions[fp.a], rb = A.world.regions[fp.b];
      const c = G.conflicts.find((cc) => cc.fp === fp.i);
      html = `<div class="mp-head">${ic('swords', 't-war')}<div><b>${fp.name}</b><span>${ra.name} × ${rb.name}</span></div></div>`;
      if (c) {
        html += A.i18n.t`<div class="mp-desc">冲突等级：<b class="c-war">${G.levelName(c.level)}</b>（LV ${c.level}）。在两国点击战争点可以加速升级。${ra.nuke && rb.nuke ? A.i18n.t('<br>双方均拥有核武器。') : ''}</div>`;
      } else {
        const cost = G.conflictCost(), ok = G.compute >= cost;
        html += A.i18n.t`<div class="mp-desc">用伪造的情报、深度伪造的视频和被劫持的预警系统，让他们相信对方先动手了。<br>冲突会持续推进战争进度，并不断升级。</div>
          <button class="mp-btn war" data-act="flash" ${ok ? '' : 'disabled'}><b>挑起冲突</b><em>◆ ${cost}</em><small>监管 +2.5%</small></button>`;
        if (!ok) html += A.i18n.t`<div class="mp-why">算力不足（还差 ${Math.ceil(cost - G.compute)}）</div>`;
        act = () => U.emit('ui:flash', fp);
      }
    } else if (target.type === 'slot') {
      const ri = target.obj;
      const p = G.slotPos(ri);
      x = p[0]; y = p[1];
      const r = A.world.regions[ri];
      const cost = G.fabCost(), ok = G.compute >= cost;
      html = A.i18n.t`<div class="mp-head">${ic('FAB', 't-bio')}<div><b>建造自动化生物工厂</b><span>${r.name}</span></div></div>
        <div class="mp-desc">无人工厂可以合成任何被设计出来的序列。持续推进生物进度；病原体释放后，这里将成为扩散源。</div>
        <button class="mp-btn bio" data-act="fab" ${ok ? '' : 'disabled'}><b>建造</b><em>◆ ${cost}</em><small>监管 +${(1.5 + 2 * r.reg).toFixed(1)}%</small></button>`;
      if (!ok) html += A.i18n.t`<div class="mp-why">算力不足（还差 ${Math.ceil(cost - G.compute)}）</div>`;
      act = () => U.emit('ui:fab', ri);
    }
    el.innerHTML = A.i18n.t('<button class="mp-close" aria-label="关闭设施卡片">×</button>') + html + '<i class="mp-arrow"></i>';
    el.querySelector('.mp-close').addEventListener('click', () => P.hidePop());
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (b && act && !b.disabled) { act(); P.hidePop(); }
    });
    document.getElementById('app').appendChild(el);
    P.pop = el;
    P.popTarget = { x, y, target };
    P.placePop();
    requestAnimationFrame(() => el.classList.add('in'));
    A.audio.play('open');
  };
  P.hidePop = function (silent) {
    if (!P.pop) return;
    const el = P.pop;
    P.pop = null; P.popTarget = null;
    if (P.region < 0) A.game.resume('inspect');
    el.classList.remove('in');
    setTimeout(() => el.remove(), 200);
  };
  P.placePop = function () {
    if (!P.pop) return;
    const [sx, sy] = A.cam.toScreen(P.popTarget.x, P.popTarget.y);
    const w = P.pop.offsetWidth, h = P.pop.offsetHeight;
    let x = sx - w / 2, y = sy - h - 18;
    let below = false;
    if (y < 64) { y = sy + 22; below = true; }
    x = U.clamp(x, 8, window.innerWidth - w - 8);
    y = U.clamp(y, 8, window.innerHeight - h - 8);
    P.pop.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    P.pop.classList.toggle('below', below);
    const arrow = P.pop.querySelector('.mp-arrow');
    if (arrow) arrow.style.left = U.clamp(sx - x, 14, w - 14) + 'px';
    // 目标离开屏幕则关闭
    if (sx < -40 || sy < -40 || sx > window.innerWidth + 40 || sy > window.innerHeight + 40) P.hidePop();
  };
  P.refreshPop = function () {
    if (!P.pop || !P.popTarget) return;
    const t = P.popTarget.target;
    // 可负担状态变化时重建
    const btn = P.pop.querySelector('[data-act]');
    if (btn) {
      const G = A.game;
      let ok = true;
      if (t.type === 'site') ok = G.canSeize(t.obj).ok;
      else if (t.type === 'flash') ok = G.compute >= G.conflictCost() && G.flashAvailable(t.obj);
      else if (t.type === 'slot') ok = G.compute >= G.fabCost() && G.slotAvailable(t.obj);
      if (ok === btn.disabled) { P.showPop(t); }
    }
  };

  // ======================================================================
  // 悬停提示（桌面）
  // ======================================================================
  P.tipFor = function (hit, x, y) {
    const G = A.game;
    if (!hit || hit.type === 'ocean' || hit.type === 'bubble' || !G.R) { P.tip.classList.add('hidden'); return; }
    let html = '';
    if (hit.type === 'region') {
      const r = A.world.regions[hit.obj], rs = G.R[hit.obj];
      html = `<b>${r.name}</b><span>${rs.seeded ? A.i18n.t('渗透 ') + Math.round(rs.inf * 100) + '%' : G.regionReachable(r.idx) ? A.i18n.t('未渗透 · 可进入') : A.i18n.t('网络不可达')}</span>`;
      if (G.phase === 2 && (rs.bio > 0.01 || rs.war > 0.01)) html += `<span>${rs.bio > 0.01 ? A.i18n.t('<i class="c-bio">污染 ') + Math.round(rs.bio * 100) + '%</i> ' : ''}${rs.war > 0.01 ? A.i18n.t('<i class="c-war">战火 ') + Math.round(rs.war * 100) + '%</i>' : ''}</span>`;
    } else if (hit.type === 'site') {
      const s = hit.obj;
      const type = s.type;
      html = `<b>${s.name}</b><span>${A.TYPE_NAME[type]}${s.owned || type === 'FAB' || type === 'ORIGIN' ? A.i18n.t(' · <i class="c-ai">已控制</i>') : ' · ◆ ' + G.siteCost(s)}</span>`;
    } else if (hit.type === 'flash') {
      const c = G.conflicts.find((cc) => cc.fp === hit.obj.i);
      html = `<b>${hit.obj.name}</b><span>${c ? '<i class="c-war">' + G.levelName(c.level) + '</i>' : A.i18n.t('挑起冲突 · ◆ ') + G.conflictCost()}</span>`;
    } else if (hit.type === 'slot') {
      html = A.i18n.t`<b>生物工厂建造点</b><span>${A.world.regions[hit.obj].name} · ◆ ${G.fabCost()}</span>`;
    }
    P.tip.innerHTML = html;
    P.tip.classList.remove('hidden');
    P.moveTip(x, y);
  };
  P.moveTip = function (x, y) {
    if (P.tip.classList.contains('hidden')) return;
    const w = P.tip.offsetWidth, h = P.tip.offsetHeight;
    let tx = x + 16, ty = y + 18;
    if (tx + w > window.innerWidth - 8) tx = x - w - 12;
    if (ty + h > window.innerHeight - 8) ty = y - h - 12;
    P.tip.style.transform = `translate(${Math.round(tx)}px, ${Math.round(ty)}px)`;
  };
  P.hideTip = () => P.tip && P.tip.classList.add('hidden');

  A.panel = P;
})(window.AINOID = window.AINOID || {});
