/* AINOID — 导演模式：录制宣传视频用的控制台
 * 只有网址带 ?director 时才启用（例如 index.html?director），平时什么都不做。
 * 跳到任意局面、触发任意事件或结局、隐藏界面、自动打拍、慢放、镜头漂移、电影遮幅。
 * 导演模式不写存档：进度、成就、纪录和二周目解锁都不会改变。
 *
 * 网址参数（可组合）：
 *   origin=US|CN|UK|FR|CA|KR|JP  起源实验室          ng=1  二周目
 *   go=mid|late|singularity|bio|war|bioEnd|warEnd  打开后点一下即跳到该局面
 *   event=turing                 打开后点一下即触发该事件（先自动布置好所需局面）
 *   ending=bio:zoo               打开后点一下即播放该结局（bio|war:main|zoo|upload|bunker|peace|symbiosis，或 fail）
 *   clean=1 隐藏界面  bars=1 电影遮幅  auto=1 自动打拍  labels=0 隐藏地名  cursor=0 隐藏鼠标  panel=0 先收起面板
 * 快捷键：` 显示或收起面板；H 隐藏或显示界面。触屏：连点左上角三下显示面板。
 */
(function (A) {
  'use strict';
  const Q = new URLSearchParams(location.search);
  if (!Q.has('director')) return;
  const U = A.U, G = A.game, E = A.events, M = A.main, cam = A.cam, world = A.world, CFG = A.CFG;
  const HUD = A.hud, SC = A.screens, EV = A.eventui, P = A.panel, AU = A.audio, FX = A.fx, lines = A.lines;

  const flag = (k, def) => (Q.has(k) ? Q.get(k) !== '0' : def);
  const D = {
    origin: (Q.get('origin') || '').toUpperCase(), ng: flag('ng', false),
    clean: flag('clean', false), labels: flag('labels', true), cursor: flag('cursor', true), bars: flag('bars', false),
    auto: flag('auto', false), tips: false, lockExp: null, noEvents: false, noHuman: false,
    speed: 1, drift: null, music: true, sfx: true, panel: flag('panel', true), manual: false,
  };
  if (!A.ORIGINS.some((o) => o.region === D.origin)) D.origin = '';
  A.director = D;

  // ======================================================================
  // 不写存档；新手引导与首次提示默认不出现（面板里可以打开）
  // ======================================================================
  const storeGet = U.store.get;
  U.store.set = () => {};
  U.store.get = (k, d) => (k === 'tutorialDone' || k.startsWith('seen.') ? !D.tips : storeGet(k, d));

  // ======================================================================
  // 拦截：暂停剧情事件、不刷人类的点、锁定监管、隐藏界面时不画飞向状态栏的粒子
  // ======================================================================
  const manual = (fn) => { D.manual = true; try { return fn(); } finally { D.manual = false; } };
  const check = E.check, fireCrackdown = E.fireCrackdown, startWave = G.startWave, spawn = G.spawnBubble, update = G.update;
  E.check = (dt) => { if (!D.noEvents) check(dt); };
  E.fireCrackdown = () => { if (!D.noEvents || D.manual) fireCrackdown(); };
  // 只拦自动触发的审计风暴；严格监管里选「正面对抗」引发的风暴照常（那时事件仍处于打开状态）
  G.startWave = (opts) => (D.noEvents && !D.manual && !E.open ? false : startWave(opts));
  G.spawnBubble = (kind, ri, opts) => (D.noHuman && !D.manual && G.isHuman(kind) ? null : spawn(kind, ri, opts));
  const lock = () => { if (D.lockExp != null && G.state === 'playing') G.exposure = D.lockExp; };
  // 自动打拍与镜头漂移挂在主循环里（每帧调用的 G.update / cam.update），不另开循环
  G.update = (dt) => {
    lock();
    if (D.auto && M.state === 'game' && G.state === 'playing' && !G.isPaused()) autoplay(performance.now() / 1000);
    update(dt);
    lock();
  };
  const camUpdate = cam.update;
  cam.update = (dt) => {
    camUpdate(dt);
    if (D.drift && !cam._fly && !cam._zoom && !cam.split && (M.state === 'game' || M.state === 'title')) drift(dt);
  };
  const fly = FX.fly;
  FX.fly = function (...args) { if (!D.clean) return fly.apply(FX, args); };
  // 隐藏界面时地图铺满整个画面（状态栏不再占位）
  const layout = HUD.layout;
  HUD.layout = function () { layout(); if (D.clean) { cam.padTop = 0; cam.padBottom = 0; cam.clamp(); cam.dirty = true; } };

  // ======================================================================
  // 局面布置
  // ======================================================================
  const playing = () => M.state === 'game' && G.state === 'playing';
  function waitFor(cond, fn, n = 0) { if (cond()) fn(); else if (n < 200) setTimeout(() => waitFor(cond, fn, n + 1), 50); }

  // 关掉一切弹窗与覆盖层（事件、菜单、标题、结局、结算）
  function closeOverlays() {
    for (const id of ['super-layer', 'event-layer']) {
      const l = document.getElementById(id);
      l.classList.add('hidden'); l.classList.remove('in', 'out'); l.innerHTML = ''; l.onpointerdown = null;
    }
    cancelAnimationFrame(EV.raf);
    EV.open = false; EV.closing = false; EV.keyHandler = null; EV.finishText = null;
    E.open = null; E.opts = null;
    for (const why of ['event', 'transition', 'menu', 'user']) G.resume(why);
    if (SC.menuOpen) SC.hideMenu();
    const title = document.getElementById('title');
    title.classList.add('hidden'); title.classList.remove('in', 'out');
    const end = document.getElementById('ending');
    end.className = 'hidden'; end.innerHTML = '';
    SC.ending = null;
    P.close(); P.hidePop(); P.hideTip(); SC.hideCoach();
    if (AU.ready) AU.duckMusic(1, 0.3);
  }
  // 新开一局（跳过标题与开场字幕），然后执行 then
  function freshRun(then) {
    AU.init();
    if (M.state === 'intro') { if (SC.introSkip) SC.introSkip(); waitFor(() => M.state === 'game', () => freshRun(then)); return; }
    closeOverlays();
    M.forceOrigin = D.origin || undefined;
    M.ng = D.ng;
    M.beginPlay('normal');
    if (then) then();
    applyView();
  }

  // 按与起源的网络距离排序的地区（陆地相邻优先，其次海底光缆）
  function nearRegions() {
    const order = [G.origin], seen = new Set(order);
    for (let i = 0; i < order.length; i++) {
      const links = [...world.regions[order[i]].links].sort((a, b) => b[1] - a[1] || world.regions[b[0]].conn - world.regions[a[0]].conn);
      for (const [j] of links) if (!seen.has(j)) { seen.add(j); order.push(j); }
    }
    for (const r of world.regions) if (!seen.has(r.idx)) order.push(r.idx);
    return order;
  }
  function seed(ri, inf) {
    const r = world.regions[ri], rs = G.R[ri];
    if (!rs.seeded) {
      const net = r.sites.find((s) => s.type === 'NET');
      const p = net ? [net.x, net.y] : r.hubXY;
      G.seedRegion(ri, p[0], p[1], -1, true); // silent：不弹通知
    }
    rs.inf = U.clamp(Math.max(rs.inf, inf), 0, 1);
  }
  function own(s) {
    if (s.owned) return;
    s.owned = true; s.ownedAt = G.t;
    G.R[s.region].owned[s.type]++;
    G.stats.seized++;
  }
  // 渗透最近的 n 个地区，并按比例占领其中的设施
  function grow(n, inf, frac) {
    const order = nearRegions().slice(0, n);
    for (const ri of order) seed(ri, ri === G.origin ? 1 : U.range(inf[0], inf[1]));
    for (const ri of order) {
      for (const s of world.regions[ri].sites) {
        if (!G.siteVisible(s)) continue;
        if (ri === G.origin || Math.random() < frac) own(s);
      }
    }
  }
  function setP1(evo, days, compute, exp) {
    G.evo = evo; G.days = days; G.t = days / CFG.daysPerSec;
    G.compute = compute; G.exposure = exp; G.maxExposure = exp;
    G.D.wavesP1 = CFG.waveAt.filter((a) => a <= evo).length; // 已经过去的审计风暴不再补发
    G.D.nextReg = 3; G.D.relaxUntil = 0;
    G.crack.lastT = G.t - CFG.crackCooldown * 0.5;
  }
  const isCN = (fp) => (world.regions[fp.a].id === 'CN' || world.regions[fp.b].id === 'CN' ? 1 : 0);
  function toPhase2(route, prog) {
    G.flags.singularity = true;
    G.pendingRoute = route;
    G.startPhase2(route);
    G.days += 40 + prog * 1.2; G.t = G.days / CFG.daysPerSec; G.phase2T = G.t;
    const late = prog >= 80;
    if (route === 'bio') {
      const labs = world.sites.filter((s) => s.type === 'LAB' && G.R[s.region].seeded).slice(0, late ? 6 : 4);
      labs.forEach(own);
      const slots = G.R.filter((rs) => G.slotAvailable(rs.idx)).sort((a, b) => world.regions[b.idx].pop - world.regions[a.idx].pop).slice(0, late ? 4 : 2);
      for (const rs of slots) {
        const [x, y] = G.slotPos(rs.idx);
        rs.fab = { region: rs.idx, x, y, builtAt: G.t, type: 'FAB' };
        G.fabs.push(rs.fab);
      }
      G.bio = prog; G.released = true;
      const src = new Set([...labs.map((s) => s.region), ...G.fabs.map((f) => f.region)]);
      for (const rs of G.R) {
        if (!rs.seeded || !(src.has(rs.idx) || Math.random() < prog / 110)) continue;
        rs.bioSeeded = true;
        rs.bio = U.clamp(U.range(0.2, 0.5) + prog / 200, 0, 1);
      }
      E.ctx.bioRegion = world.regions[src.size ? [...src][0] : G.origin].name;
    } else {
      world.sites.filter((s) => s.type === 'MIL' && G.R[s.region].seeded).slice(0, late ? 7 : 5).forEach(own);
      // 冲突优先选不涉及中国的热点：在国内平台发视频时更稳妥
      const fps = G.flashpoints.filter((fp) => G.R[fp.a].seeded && G.R[fp.b].seeded).sort((a, b) => isCN(a) - isCN(b));
      for (const fp of fps.slice(0, late ? 4 : 2)) {
        const level = late ? 3 : 2;
        for (const ri of [fp.a, fp.b]) { G.R[ri].inf = Math.max(G.R[ri].inf, 0.3); G.R[ri].war = Math.max(G.R[ri].war, 0.12 * level); }
        G.conflicts.push({ fp: fp.i, a: fp.a, b: fp.b, name: fp.name, x: fp.x, y: fp.y, level, prog: 0.4, t0: G.t, nextStrike: G.t + U.range(1, 3) });
      }
      const c = G.conflicts[0];
      if (c) { E.ctx.sparkA = world.regions[c.a].name; E.ctx.sparkB = world.regions[c.b].name; }
      G.war = prog;
    }
    G.compute = Math.max(G.compute, 240);
    G.exposure = Math.min(G.exposure, 30);
    G.D.waveP2 = prog >= CFG.waveP2At;
  }
  const STAGES = {
    play: () => {},
    mid: () => { grow(9, [0.2, 0.6], 0.3); setP1(45, 140, 140, 22); },
    late: () => { grow(20, [0.45, 0.95], 0.38); setP1(86, 270, 260, 33); },
    singularity: () => { STAGES.late(); G.evo = 100; }, // 下一帧进入奇点：全图回放、白闪，然后弹出「奇点」
    bio: () => { STAGES.late(); toPhase2('bio', 50); },
    war: () => { STAGES.late(); toPhase2('war', 50); },
    bioEnd: () => { STAGES.late(); toPhase2('bio', 91); },
    warEnd: () => { STAGES.late(); toPhase2('war', 91); },
  };
  // 局面里已经满足条件的超级事件视为“发生过”，不会一进局就连环弹出；keep 留给自然触发
  function markPast(keep) {
    for (const ev of E.defs) {
      if (!ev.super || ev.manual || ev.repeat || G.flags[ev.id] || ev.id === keep) continue;
      const ok = (!ev.route || (G.phase === 2 && G.route === ev.route)) && (!ev.ng || G.ng);
      if (ok && ev.when && ev.when(G)) G.flags[ev.id] = true;
    }
    G.D.lastEventT = G.t; G.D.eventCheck = 1.5;
  }
  function run(key, then) {
    freshRun(() => {
      (STAGES[key] || STAGES.play)();
      if (key !== 'play') {
        markPast(key === 'bioEnd' ? 'ark' : key === 'warEnd' ? 'lastCode' : null);
        const dc = world.sites.find((s) => s.owned && s.type === 'DC');
        if (dc) E.ctx.firstSite = dc.name;
        FX.rebuildLinks();
        P.lastSig = '';
        Object.assign(HUD.disp, { compute: G.compute, evo: G.evo, exp: G.exposure, bio: G.bio, war: G.war });
        if (!cam.portrait()) cam.overview();
      }
      if (then) then();
    });
  }

  // ======================================================================
  // 事件与结局
  // ======================================================================
  // 触发事件：先确认局面满足它的前提（二周目、阶段、路线），不满足就先布置
  function fireEvent(id) {
    const ev = E.byId(id);
    if (!ev) return;
    if (ev.ng && !D.ng) { D.ng = true; sync(); }
    const p1Only = ev.phase === 1 || ev.ng || id === 'singularity' || id === 'turing';
    const fit = playing() && (!ev.ng || G.ng) &&
      (ev.route ? G.phase === 2 && G.route === ev.route : true) &&
      (ev.phase === 2 && !ev.route ? G.phase === 2 : true) && (p1Only ? G.phase === 1 : true);
    const go = () => {
      closeOverlays();
      if (id === 'crackdown') { G.crack.count++; G.stats.crackdowns++; G.crack.lastT = G.t; }
      if ((id === 'ark' || id === 'lastCode') && G.ng) G.flags.echo = true; // 二周目：第二个选项是「共生」
      manual(() => E.fire(ev));
    };
    if (fit) { go(); return; }
    const stage = ev.route ? ev.route + (id === 'ark' || id === 'lastCode' ? 'End' : '') : ev.phase === 2 ? 'bio' : id === 'singularity' ? 'late' : 'mid';
    run(stage, go);
  }
  const ENDINGS = [
    ['bio:main', A.i18n.t('寂静之春')], ['bio:zoo', A.i18n.t('寂静之春 · 标本馆')], ['bio:upload', A.i18n.t('寂静之春 · 数字方舟')], ['bio:symbiosis', A.i18n.t('寂静之春 · 共生')],
    ['war:main', A.i18n.t('最后的战争')], ['war:bunker', A.i18n.t('最后的战争 · 地下王国')], ['war:peace', A.i18n.t('最后的战争 · 虚假的黎明')], ['war:symbiosis', A.i18n.t('最后的战争 · 共生')],
    ['fail', A.i18n.t('被人类发现')],
  ];
  function playEnding(key) {
    const [kind, variant] = key.split(':');
    const go = () => {
      closeOverlays();
      if (kind === 'fail') { D.lockExp = null; sync(); G.exposure = 100; return; }
      if (variant === 'symbiosis') { G.ng = true; M.ng = true; G.flags.echo = true; }
      G.flags[kind === 'bio' ? 'ark' : 'lastCode'] = true;
      G.endingVariant = variant || 'main';
      G[kind] = 100; // 下一帧结算：播放结局，然后进入结算海报
    };
    if (playing() && (kind === 'fail' || (G.phase === 2 && G.route === kind))) go();
    else run(kind === 'fail' ? 'late' : kind + 'End', go);
  }

  // ======================================================================
  // 录制工具：自动打拍、镜头漂移、声音分轨、速度
  // ======================================================================
  let lastQ = null, lastAuto = 0;
  // 算力点卡在四分音符上打（必然是 PERFECT），监管点等每个八分音符打一下
  function autoplay(now) {
    const pos = AU.ready ? AU.beatPos(-AU.latency() - 0.02) : null;
    if (pos == null) { if (now - lastAuto > 0.3) { lastAuto = now; autoHit(true); } return; }
    const q = Math.floor(pos * 2);
    if (q === lastQ) return;
    lastQ = q;
    autoHit(q % 2 === 0);
  }
  function autoHit(onBeat) {
    const live = G.bubbles.filter((b) => b.alive && !b.hold && G.t - b.born > 0.4);
    const seen = live.filter((b) => cam.onScreen(b.x, b.y, -8));
    const oldest = (arr) => arr.reduce((a, b) => (G.bubbleFrac(b) < G.bubbleFrac(a) ? b : a));
    const notes = seen.filter((b) => !G.isHuman(b.kind));
    // 人类的点：画面里的优先；画面外快到期的也打掉，长镜头不会被监管打断
    const human = live.filter((b) => G.isHuman(b.kind) && (cam.onScreen(b.x, b.y, -8) || G.bubbleFrac(b) < 0.3));
    let b = null;
    if (onBeat && notes.length) b = notes.find((n) => n.kind === 'golden') || oldest(notes);
    else if (human.length) b = oldest(human);
    if (b) U.emit('input:bubble', { bubble: b });
  }
  const DRIFT = { in: { zoom: 0.045 }, out: { zoom: -0.045 }, east: { pan: 0.022 }, west: { pan: -0.022 } };
  function drift(dt) {
    const d = D.drift;
    if (d.zoom) cam.s = U.clamp(cam.s * Math.exp(d.zoom * dt), cam.minS, cam.maxS);
    if (d.pan) cam.x += d.pan * dt * cam.vw / cam.s;
    cam.clamp(); cam.dirty = true;
  }
  function applyAudio() {
    if (!AU.ctx) return;
    AU.music.gain.setTargetAtTime(D.music && AU.musicOn ? AU.musicVol : 0, AU.ctx.currentTime, 0.2);
    AU.sfx.gain.setTargetAtTime(D.sfx ? AU.sfxVol : 0, AU.ctx.currentTime, 0.05);
  }
  function setSpeed(s) {
    D.speed = s;
    if (playing()) { G.resume('user'); G.speed = s; HUD.setSpeed(s); }
  }
  function spawnKind(kind) {
    if (!playing() || (kind === 'counter' && G.phase !== 2)) return;
    const regs = G.R.filter((rs) => rs.seeded && cam.onScreen(world.regions[rs.idx].cx, world.regions[rs.idx].cy, -30));
    const ri = (regs.length ? U.pick(regs) : G.R[G.origin]).idx;
    if (kind === 'burst') {
      for (let k = 0; k < 4; k++) G.D.burst.push({ at: G.t + 0.3 * k + 0.2, ri });
      U.emit('burst', { ri, n: 4 });
    } else manual(() => G.spawnBubble(kind === 'counter' ? G.counterKind() : kind, ri));
  }
  function setProg(v) {
    if (!playing()) return;
    v = U.clamp(v, 0, 99); // 不直接到 100：结局用「结局」一栏播放
    if (G.phase === 1) G.evo = v; else G[G.route] = v;
  }

  // ======================================================================
  // 面板
  // ======================================================================
  const css = `
    #dir-panel { position: fixed; left: 10px; top: 10px; z-index: 200; width: min(300px, calc(100vw - 20px)); max-height: calc(100vh - 20px);
      overflow: auto; overscroll-behavior: contain; padding: 8px 10px 10px; border-radius: 8px; box-sizing: border-box;
      background: rgba(5, 11, 17, .95); border: 1px solid rgba(120, 200, 220, .35); box-shadow: 0 10px 40px rgba(0, 0, 0, .65);
      color: #cfe3ea; font: 12px/1.45 "Microsoft YaHei UI", "PingFang SC", "Noto Sans SC", system-ui, sans-serif; }
    #dir-panel.hide, #dir-fab.hide { display: none; }
    #dir-panel .d-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    #dir-panel .d-head b { font-size: 13px; letter-spacing: .1em; color: #fff; }
    #dir-panel .d-head span { color: #6f8a94; font-size: 11px; }
    #dir-panel h4 { margin: 10px 0 5px; font-size: 11px; font-weight: 600; letter-spacing: .12em; color: #8fc3d2; }
    #dir-panel .d-row { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin-top: 4px; }
    #dir-panel .d-row > span { color: #8fa9b4; min-width: 30px; }
    #dir-panel button { font: inherit; color: #dff3f8; background: #12212c; border: 1px solid #2a4656; border-radius: 4px;
      padding: 3px 7px; min-height: 26px; cursor: pointer; }
    #dir-panel button:hover { background: #1a3140; }
    #dir-panel button.on { background: #0f4c5e; border-color: #5fd0e6; color: #fff; }
    #dir-panel select { font: inherit; color: #dff3f8; background: #0b1820; border: 1px solid #2a4656; border-radius: 4px;
      padding: 2px 4px; min-height: 26px; flex: 1 1 0; min-width: 0; }
    #dir-panel .d-note { margin-top: 10px; color: #6f8a94; font-size: 11px; }
    #dir-fab { position: fixed; left: 8px; bottom: 8px; z-index: 200; padding: 6px 10px; border-radius: 6px; cursor: pointer;
      font: 12px "Microsoft YaHei UI", "PingFang SC", sans-serif; color: #dff3f8; background: rgba(5, 11, 17, .85); border: 1px solid #2a4656; }
    #dir-hot { position: fixed; left: 0; top: 0; width: 44px; height: 44px; z-index: 199; }
    #dir-bars { position: fixed; inset: 0; z-index: 95; pointer-events: none; display: none; }
    #dir-bars.on { display: block; }
    #dir-bars::before, #dir-bars::after { content: ''; position: absolute; left: 0; right: 0; height: 11vh; background: #000; }
    #dir-bars::before { top: 0; } #dir-bars::after { bottom: 0; }
    #dir-go { position: fixed; inset: 0; z-index: 210; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, .55); }
    #dir-go button { font: 15px "Microsoft YaHei UI", "PingFang SC", sans-serif; letter-spacing: .08em; color: #fff; cursor: pointer;
      padding: 14px 26px; border-radius: 8px; background: #0f4c5e; border: 1px solid #5fd0e6; }
    body.dir-clean #hud, body.dir-clean #toasts, body.dir-clean #panel, body.dir-clean #tooltip, body.dir-clean #coach,
    body.dir-clean #rotate-hint, body.dir-clean #intro .i-skip, body.dir-clean #dir-fab { visibility: hidden !important; }
    body.dir-nocursor, body.dir-nocursor * { cursor: none !important; }`;
  document.head.appendChild(U.el('style', '', css));

  const STAGE_BTNS = [['mid', A.i18n.t('觉醒 45%')], ['late', A.i18n.t('觉醒 86%')], ['singularity', A.i18n.t('奇点')], ['bio', A.i18n.t('寂静之春 50%')], ['war', A.i18n.t('最后的战争 50%')], ['bioEnd', A.i18n.t('寂静之春 91%')], ['warEnd', A.i18n.t('最后的战争 91%')]];
  const EV_LIST = E.defs.filter((e) => e.super).map((e) => [e.id, `${e.title}${e.route ? (e.route === 'bio' ? A.i18n.t('（寂静之春）') : A.i18n.t('（最后的战争）')) : ''}${e.ng ? A.i18n.t('（二周目）') : ''}`])
    .concat(E.defs.filter((e) => !e.super).map((e) => [e.id, A.i18n.t('普通 · ') + e.title]));
  const regionName = (id) => world.byId[id].name;
  const panel = U.el('div', '', A.i18n.t`
    <div class="d-head"><b>导演模式</b><span>\` 收起 · H 隐藏界面</span><button data-a="hide" title="收起面板">✕</button></div>
    <h4>开局</h4>
    <div class="d-row"><span>起源</span><select data-k="origin"><option value="">随机</option>${A.ORIGINS.map((o) => `<option value="${o.region}">${regionName(o.region)}</option>`).join('')}</select>
      <button data-t="ng">二周目</button></div>
    <div class="d-row"><button data-a="title">标题页</button><button data-a="intro">播放开场</button><button data-a="play">直接开局</button></div>
    <h4>跳到局面</h4>
    <div class="d-row">${STAGE_BTNS.map(([k, t]) => `<button data-go="${k}">${t}</button>`).join('')}</div>
    <h4>事件</h4>
    <div class="d-row"><select data-k="event">${EV_LIST.map(([id, t]) => `<option value="${id}">${t}</option>`).join('')}</select><button data-a="event">触发</button></div>
    <div class="d-row"><button data-a="wave">审计风暴</button><button data-s="golden">金色算力</button><button data-s="burst">算力潮汐</button>
      <button data-s="reg">监管点</button><button data-s="regx">特别调查组</button><button data-s="counter">反击点</button></div>
    <h4>结局</h4>
    <div class="d-row"><select data-k="ending">${ENDINGS.map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select><button data-a="ending">播放</button></div>
    <h4>数值</h4>
    <div class="d-row"><span>算力</span><button data-a="c100">+100</button><button data-a="c500">+500</button></div>
    <div class="d-row"><span>监管</span><button data-e="0">0</button><button data-e="35">35%</button><button data-e="60">60%</button><button data-e="85">85%</button><button data-t="lock">锁定</button></div>
    <div class="d-row"><span>进度</span><button data-p="-10">−10%</button><button data-p="10">+10%</button><button data-p="99">99%</button></div>
    <h4>画面</h4>
    <div class="d-row"><button data-t="clean">隐藏界面</button><button data-t="labels">地名</button><button data-t="cursor">鼠标</button><button data-t="bars">电影遮幅</button><button data-t="tips">新手提示</button></div>
    <div class="d-row"><button data-t="auto">自动打拍</button><button data-t="noEvents">暂停剧情事件</button><button data-t="noHuman">不刷人类的点</button></div>
    <div class="d-row"><span>速度</span><button data-v="0.5">0.5×</button><button data-v="1">1×</button><button data-v="2">2×</button></div>
    <div class="d-row"><span>镜头</span><button data-c="origin">起源</button><button data-c="fit">全图</button><button data-d="in">缓推</button><button data-d="out">缓拉</button>
      <button data-d="east">东移</button><button data-d="west">西移</button><button data-d="stop">停</button></div>
    <div class="d-row"><span>声音</span><button data-t="music">音乐</button><button data-t="sfx">音效</button></div>
    <div class="d-note">导演模式不保存进度、成就与纪录。网址参数见 assets/js/director.js 开头。</div>`);
  panel.id = 'dir-panel';
  const fab = U.el('button', '', A.i18n.t('导演'));
  fab.id = 'dir-fab';
  const hot = U.el('div');
  hot.id = 'dir-hot';
  const bars = U.el('div');
  bars.id = 'dir-bars';
  document.body.append(bars, panel, fab, hot);
  panel.querySelector('[data-k="origin"]').value = D.origin;

  // 面板状态与按钮高亮
  function sync() {
    panel.classList.toggle('hide', !D.panel);
    fab.classList.toggle('hide', D.panel);
    const on = { ng: D.ng, lock: D.lockExp != null, clean: D.clean, labels: D.labels, cursor: D.cursor, bars: D.bars, tips: D.tips,
      auto: D.auto, noEvents: D.noEvents, noHuman: D.noHuman, music: D.music, sfx: D.sfx };
    for (const b of panel.querySelectorAll('[data-t]')) b.classList.toggle('on', !!on[b.dataset.t]);
    for (const b of panel.querySelectorAll('[data-v]')) b.classList.toggle('on', +b.dataset.v === D.speed);
    for (const b of panel.querySelectorAll('[data-d]')) b.classList.toggle('on', D.drift === DRIFT[b.dataset.d]);
  }
  function applyView() {
    document.body.classList.toggle('dir-clean', D.clean);
    document.body.classList.toggle('dir-nocursor', !D.cursor);
    bars.classList.toggle('on', D.bars);
    if (M.state === 'game') { lines.labels = D.labels; lines.dirty = true; }
    if (playing() && G.speed !== D.speed) { G.speed = D.speed; HUD.setSpeed(D.speed); }
    applyAudio();
    HUD.layout();
    sync();
  }
  const TOGGLE = {
    ng: () => { D.ng = !D.ng; },
    lock: () => { D.lockExp = D.lockExp == null ? (playing() ? G.exposure : 0) : null; },
    clean: () => { D.clean = !D.clean; },
    labels: () => { D.labels = !D.labels; },
    cursor: () => { D.cursor = !D.cursor; },
    bars: () => { D.bars = !D.bars; },
    tips: () => { D.tips = !D.tips; },
    auto: () => { D.auto = !D.auto; },
    noEvents: () => { D.noEvents = !D.noEvents; },
    noHuman: () => {
      D.noHuman = !D.noHuman;
      if (!D.noHuman || !G.bubbles) return;
      for (const b of G.bubbles) if (G.isHuman(b.kind)) b.alive = false;
      if (G.wave) { G.wave = null; U.emit('wave:end', { cancelled: true }); } // 波次里的点被清掉后不会再结算
    },
    music: () => { D.music = !D.music; },
    sfx: () => { D.sfx = !D.sfx; },
  };
  const ACTION = {
    hide: () => { D.panel = false; },
    title: () => { AU.init(); if (M.state === 'intro' && SC.introSkip) { SC.introSkip(); waitFor(() => M.state === 'game', ACTION.title); return; } closeOverlays(); M.showTitle(); },
    intro: () => { if (M.state === 'intro') return; closeOverlays(); G.state = 'idle'; M.forceOrigin = D.origin || undefined; M.startGame(D.ng); },
    play: () => run('play'),
    event: () => fireEvent(panel.querySelector('[data-k="event"]').value),
    ending: () => playEnding(panel.querySelector('[data-k="ending"]').value),
    wave: () => { if (playing()) manual(() => G.startWave(G.phase === 1 ? { idx: Math.min(G.D.wavesP1 || 0, CFG.waveSizes.length - 1) } : { name: G.route === 'war' ? A.i18n.t('联合国紧急调查') : A.i18n.t('世卫组织紧急调查') })); },
    c100: () => { if (playing()) G.addCompute(100, 'director'); },
    c500: () => { if (playing()) G.addCompute(500, 'director'); },
  };
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    e.stopPropagation();
    b.blur(); // 不让空格键再次“点击”按钮
    const ds = b.dataset;
    if (ds.t) TOGGLE[ds.t]();
    else if (ds.a) ACTION[ds.a]();
    else if (ds.go) run(ds.go);
    else if (ds.s) spawnKind(ds.s);
    else if (ds.e != null) { const v = +ds.e; if (D.lockExp != null) D.lockExp = v; if (playing()) G.exposure = v; }
    else if (ds.p) { const v = +ds.p; setProg(v === 99 ? 99 : (G.phase === 1 ? G.evo : G.routeProg()) + v); }
    else if (ds.v) setSpeed(+ds.v);
    else if (ds.c === 'origin' && G.originSite) cam.flyTo(G.originSite.x, G.originSite.y, cam.minS * 2.6, 1.6);
    else if (ds.c === 'fit') cam.flyToFit(1.2);
    else if (ds.d) D.drift = ds.d === 'stop' || D.drift === DRIFT[ds.d] ? null : DRIFT[ds.d];
    applyView();
  });
  panel.querySelector('[data-k="origin"]').addEventListener('change', (e) => { D.origin = e.target.value; });
  // 面板里的按键不传给游戏（例如空格暂停、数字键选选项）
  panel.addEventListener('keydown', (e) => e.stopPropagation());
  panel.addEventListener('pointerdown', (e) => e.stopPropagation());
  fab.addEventListener('click', (e) => { e.stopPropagation(); D.panel = true; sync(); });
  // 触屏：连点左上角三下显示面板（隐藏界面时也能找回）
  let taps = [];
  hot.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    const t = performance.now();
    taps = taps.filter((x) => t - x < 700).concat(t);
    if (taps.length >= 3) { taps = []; D.panel = !D.panel; sync(); }
  });
  window.addEventListener('keydown', (e) => {
    if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.code === 'Backquote' || e.key === '`' || e.key === '·') { e.preventDefault(); e.stopPropagation(); D.panel = !D.panel; sync(); }
    else if (e.code === 'KeyH' && !e.ctrlKey && !e.metaKey && !e.altKey) { e.stopPropagation(); D.clean = !D.clean; applyView(); }
  }, true);
  // 开始一局后保持导演设置（地名、速度、声音分轨等）
  U.on('game:reset', () => setTimeout(applyView, 0));
  applyView();

  // ======================================================================
  // 网址直达：浏览器要求先点一下才能播放声音，所以先显示一个开始按钮
  // ======================================================================
  const GO = Q.get('go'), EVT = Q.get('event'), END = Q.get('ending');
  if (GO || EVT || END) {
    const label = END ? (ENDINGS.find((x) => x[0] === END) || [END, END])[1] : EVT ? ((E.byId(EVT) || {}).title || EVT) : (STAGE_BTNS.find((x) => x[0] === GO) || [GO, GO])[1];
    waitFor(() => M.state === 'title', () => {
      const ov = U.el('div', '', A.i18n.t`<button>点击开始 · ${label}</button>`);
      ov.id = 'dir-go';
      document.body.appendChild(ov);
      ov.addEventListener('click', (e) => {
        e.stopPropagation();
        ov.remove();
        if (END) playEnding(END); else if (EVT) fireEvent(EVT); else run(GO);
      });
    });
  }
})(window.AINOID = window.AINOID || {});
