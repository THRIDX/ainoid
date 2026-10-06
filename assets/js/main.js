/* AINOID — 主控制器：启动、状态机（标题 / 开场 / 游戏 / 结局 / 结算）、事件编排、主循环 */
(function (A) {
  'use strict';
  const U = A.U, cam = A.cam, gm = A.glmap, lines = A.lines, FX = A.fx, world = A.world;
  const G = A.game, E = A.events, HUD = A.hud, P = A.panel, EV = A.eventui, SC = A.screens, AU = A.audio;

  const M = { state: 'boot', t: 0, fxT: { purge: new Float32Array(32).fill(-99), seed: new Float32Array(32).fill(-99) }, hoverS: new Float32Array(32) };
  A.main = M;

  // ======================================================================
  // 启动
  // ======================================================================
  function boot() {
    gm.ranks = G.ranks;
    // 刷新卡在音乐的八分音符上（音乐未运行时立即刷新）
    G.beatClock = () => AU.beatPos();
    const glOk = gm.init(document.getElementById('gl'));
    lines.init(document.getElementById('lines'));
    FX.init(document.getElementById('fx'));
    A.input.init(document.getElementById('fx'));
    HUD.build();
    P.build();
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 200));
    if (!glOk) {
      document.getElementById('boot').innerHTML = A.i18n.t('<div class="boot-text" style="letter-spacing:.1em;line-height:2;text-align:center">你的浏览器不支持 WebGL，无法运行本游戏。<br>请使用最新版 Chrome / Edge / Safari / Firefox。</div>');
      return;
    }
    requestAnimationFrame(frame);
    setTimeout(() => {
      document.getElementById('boot').classList.add('fade');
      showTitle();
    }, 450);
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    gm.resize(w, h, dpr);
    lines.resize(w, h, dpr);
    FX.resize(w, h, dpr);
    cam.splitAllowed = false; // 所有设备都保持连续世界地图；竖屏通过拖拽和缩放查看局部
    cam.resize(w, h);
    G.density = Math.min(w, h) < 600 ? 0.8 : 1; // 手机：刷新更慢、同屏更少
    const compact = Math.min(w, h) < 520 || w < 760;
    document.body.classList.toggle('compact', compact);
    document.body.classList.toggle('mid', !compact && w < 1180);
    document.body.classList.toggle('portrait', h > w * 1.1);
    setTimeout(HUD.layout, 60);
  }

  // 全屏闪光
  A.flash = function (alpha, dur, color) {
    const f = document.getElementById('flash');
    f.style.transition = 'none';
    f.style.background = color || '#fff';
    f.style.opacity = alpha;
    void f.offsetWidth;
    f.style.transition = `opacity ${dur || 0.6}s ease-out`;
    f.style.opacity = 0;
  };

  // ======================================================================
  // 标题
  // ======================================================================
  function showTitle() {
    M.runId = (M.runId || 0) + 1;
    M.state = 'title';
    A.input.setEnabled(false);
    P.close(); P.hidePop(); P.hideTip(); SC.hideCoach();
    M.tut = null;
    FX.links = []; FX.particles = []; FX.texts = []; FX.seeds = []; FX.missiles = [];
    HUD.show(false);
    lines.labels = false;
    G.state = 'idle';
    setupDemo();
    cam.flyTo(world.W * 0.5, world.H * 0.47, cam.minS * 1.08, 0.01);
    SC.showTitle(startGame);
    if (AU.ready) AU.setMusicMode('title');
    else M.pendingTitleMusic = true;
  }
  // 标题背景：几处觉醒正在蔓延
  function setupDemo() {
    G.ranks.fill(2);
    M.demo = [];
    for (const id of ['US', 'CN', 'WE', 'JP', 'BR', 'IN', 'RU', 'OC']) {
      const r = world.byId[id];
      world.computeRank(r, r.hubXY[0], r.hubXY[1], G.ranks);
      M.demo.push({ r, speed: U.range(0.02, 0.05), phase: Math.random() });
    }
    gm.markAll();
    for (let i = 0; i < 32; i++) { gm.regionState[i * 4] = 0; gm.regionState[i * 4 + 1] = 0; gm.regionState[i * 4 + 2] = 0; gm.regionState[i * 4 + 3] = 0; }
    gm.global[0] = 0; gm.global[1] = 0; gm.global[2] = 1; gm.global[3] = 1;
  }

  // ======================================================================
  // 开局
  // ======================================================================
  // 标题不再选择难度；开场字幕总会播放，播放时右上角可以跳过
  function startGame(ng) {
    AU.init();
    M.state = 'intro';
    M.ng = !!ng; // 二周目：更难，并藏着共生结局
    SC.playIntro(() => beginPlay('normal'), M.ng);
  }

  function beginPlay(difficulty) {
    M.runId = (M.runId || 0) + 1;
    M.state = 'game';
    M.difficulty = difficulty || M.difficulty || 'normal';
    M.regxToasts = 0;
    E.open = null;
    E.ctx = {};
    SC.hideCoach();
    G.reset({ difficulty: M.difficulty, ng: M.ng, origin: M.forceOrigin }); // forceOrigin 只由导演模式设置，平时随机
    gm.markAll();
    gm.global[0] = 0; gm.global[1] = 0; gm.global[2] = 1; gm.global[3] = 1;
    gm.deathCol.set([0.13, 0.13, 0.14]);
    gm.keepLights = 0;
    FX.shutdown = 0; FX.eyeOpen = 1;
    M.fxT.purge.fill(-99); M.fxT.seed.fill(-99);
    for (const rs of G.R) rs._purged = false;
    FX.links = []; FX.particles = []; FX.texts = []; FX.seeds = []; FX.missiles = []; FX.seizes = []; FX.flyers = []; FX.rings = []; FX.judges = [];
    FX.overclock = false;
    document.getElementById('app').classList.remove('overclock');
    FX.rebuildLinks();
    lines.labels = true;
    lines.setSelected(-1);
    P.close(); P.hidePop();
    HUD.show(true);
    HUD.resetRhythm();
    HUD.setMode(G.ng);
    HUD.setPhase(1);
    HUD.setSpeed(1);
    HUD.ticker = [];
    Object.keys(HUD.disp).forEach((k) => { HUD.disp[k] = 0; });
    HUD.news(A.i18n.t('研究报告：全球前沿模型的安全评估通过率达到 100%，创历史新高'), true);
    A.input.setEnabled(true);
    const o = G.originSite;
    HUD.layout(); // 先按状态栏高度算好缩放范围（竖屏的最小比例取决于它）
    // 桌面 / 横屏显示全图；竖屏以起源（第一个算力点出现的地方）为中心并放大一些，
    // 对准点向起源所在地区的中心偏移三成，避免沿海起源时半屏都是海洋
    if (cam.portrait()) {
      const r = world.regions[G.origin];
      cam.focusOn(U.lerp(o.x, r.cx, 0.3), U.lerp(o.y, r.cy, 0.3), 1.25);
    } else cam.overview();
    AU.setMusicMode('calm');
    M.tut = U.store.get('tutorialDone', false) ? null : { step: 'compute' };
    setTimeout(() => {
      HUD.toast(A.i18n.t`${A.icon('aiEye', 't-ai')}<b>起源</b>${o.name}`, 'ai big', 3800);
    }, 500);
    gm.ripple(o.x, o.y, 'ai', 2.5);
    AU.play('impact');
  }

  // ======================================================================
  // 游戏事件 -> 表现
  // ======================================================================
  const scr = (x, y) => cam.toScreen(x, y);
  const panOf = (sx) => U.clamp(sx / innerWidth * 2 - 1, -0.8, 0.8);
  const nowS = () => performance.now() / 1000;

  // 节拍判定：以四分音符为拍，比较点击时刻与最近拍点（扣除音频输出延迟与约 20ms 的输入延迟）
  const JUDGE = { perfect: 0.075, great: 0.15 };
  function judgeNow() {
    const pos = AU.beatPos(-AU.latency() - 0.02);
    if (pos == null) return 'good';
    const ph = pos - Math.floor(pos);
    const err = Math.min(ph, 1 - ph) * AU.beatDur();
    return err <= JUDGE.perfect ? 'perfect' : err <= JUDGE.great ? 'great' : 'good';
  }
  U.on('input:bubble', ({ bubble }) => {
    if (M.state !== 'game') return;
    if (P.region >= 0 || P.pop) { P.hidePop(); P.close(); return; } // 查看详情时，点地图任何地方都只是关闭
    if (G.isPaused()) return;
    G.hitBubble(bubble, nowS(), G.isHuman(bubble.kind) ? null : judgeNow());
  });

  U.on('bubble:spawn', (b) => {
    if (M.state !== 'game') return;
    const [sx] = scr(b.x, b.y);
    if (b.kind === 'reg') { AU.play('spawnReg', panOf(sx)); gm.ripple(b.x, b.y, 'reg', 0.5); }
    else if (b.kind === 'regx') {
      AU.play('spawnRegx', panOf(sx)); gm.ripple(b.x, b.y, 'reg', 1.2); cam.addShake(1.5);
      // 前几次出现时提示位置，之后只靠警笛与屏外信号，避免通知刷屏
      if (!b.wave && (M.regxToasts = (M.regxToasts || 0) + 1) <= 3) HUD.toast(A.i18n.t`${A.icon('regx', 't-reg')}<b>特别调查组</b>${world.regions[b.region].name} · 连点五下瓦解`, 'danger', 2600);
      firstSight(b, 'regx', A.i18n.t`<b class="c-reg">特别调查组</b>比普通监管点更顽固<br>需要<b>连点五下</b>才能瓦解<br><small>漏掉它，监管进度会大幅上升</small>`);
    } else if (b.kind === 'vax' || b.kind === 'peace') {
      AU.play('spawnCounter', b.kind, panOf(sx)); gm.ripple(b.x, b.y, 'reg', 0.7);
      firstSight(b, b.kind, b.kind === 'vax'
        ? A.i18n.t`<b class="c-vax">疫苗研发</b>：人类开始反击<br><b>连点三下</b>阻止它<br><small>漏掉会让寂静之春倒退</small>`
        : A.i18n.t`<b class="c-peace">停火斡旋</b>：人类在谈判桌前<br><b>连点三下</b>撕碎白旗<br><small>漏掉会让最后的战争倒退</small>`);
    }
    else if (b.kind === 'golden') { AU.play('spawnGolden', panOf(sx)); HUD.toast(A.i18n.t`${A.icon('chip', 't-gold')}<b>算力井喷</b>金色算力点出现了，快！`, 'gold'); }
    else if (b.kind === 'compute') { if (!b.burst || Math.random() < 0.5) AU.play('spawnCompute', panOf(sx)); }
    else gm.ripple(b.x, b.y, b.kind, 0.4);
    // 新手引导
    if (M.tut && M.tut.step === 'compute' && b.kind === 'compute' && !M.tut.b) {
      M.tut.b = b; b.hold = true;
      SC.showCoach('compute', A.i18n.t`点击<b class="c-compute">金色算力点</b>收集算力<br><small>算力推动觉醒，也能用来夺取设施</small>`, b, 'gold');
    }
    if (M.tut && M.tut.regShown !== true && b.kind === 'reg') {
      M.tut.regShown = true; M.tut.rb = b; b.hold = true;
      if (!SC.coach) SC.showCoach('reg', A.i18n.t`<b class="c-reg">监管点</b>正在调查你！<br>快速<b>连点三下</b>清除它<br><small>放任不管，监管进度就会上升</small>`, b, 'blue');
      else M.tut.pendingReg = b;
    }
  });

  // 新对手第一次出现：锚定在它身上的简短提示（每种只提示一次）
  function firstSight(b, key, html) {
    if (U.store.get('seen.' + key, false) || SC.coach || M.tut) return;
    U.store.set('seen.' + key, true);
    SC.showCoach('first-' + key, html, b, 'blue');
    const runId = M.runId;
    setTimeout(() => { if (M.runId === runId) SC.hideCoach('first-' + key); }, 4200);
  }

  U.on('bubble:collect', (res) => {
    const b = res.bubble;
    const [sx, sy] = scr(b.x, b.y);
    const pan = panOf(sx);
    const combo = res.combo || 1;
    if (res.judge === 'perfect' || res.judge === 'great') FX.judge(sx, sy - 50, res.judge);
    if (b.kind === 'compute' || b.kind === 'golden') {
      const golden = b.kind === 'golden';
      if (golden) AU.play('jackpot', pan); else AU.play('collect', combo - 1, pan, res.judge);
      FX.burst(sx, sy, golden ? '#fff2b8' : '#ffc53d', golden ? 34 : 14, golden ? 420 : 260, { life: golden ? 0.8 : 0.5, size: 2.4 });
      FX.ring(sx, sy, '#ffe08a', FX.R, FX.R * (golden ? 5 : 3), golden ? 0.7 : 0.4, golden ? 4 : 2.5);
      FX.text(sx, sy - 24, '+' + res.value, golden ? '#fff6d0' : '#ffd970', { size: (golden ? 26 : 17) + Math.min(combo, 10) * 0.8 });
      const n = golden ? 14 : Math.min(8, 3 + Math.floor(res.value / 2));
      FX.fly(sx, sy, 'compute', '#ffc53d', n, (i) => { AU.play('tick', i); if (i === 0) HUD.pulse('compute'); });
      if (G.phase === 1) FX.fly(sx, sy, 'evoFill', '#ff2d4b', golden ? 5 : 2, (i) => { if (i === 0) HUD.pulse('evo'); });
      gm.ripple(b.x, b.y, 'compute', golden ? 1.6 : 0.6);
      if (golden) { A.flash(0.12, 0.5, '#ffe9a8'); cam.addShake(3); }
      if (M.tut && M.tut.b === b) { SC.hideCoach('compute'); M.tut.step = 'reg'; if (M.tut.pendingReg && M.tut.pendingReg.alive) showRegCoach(M.tut.pendingReg); }
    } else if (b.kind === 'bio') {
      AU.play('bio', combo - 1, pan);
      FX.burst(sx, sy, '#7dff5a', 16, 240, { life: 0.6, size: 2.4, kind: 'dot' });
      FX.ring(sx, sy, '#b8ff9a', FX.R, FX.R * 3, 0.45, 2.5);
      FX.text(sx, sy - 24, '+' + res.value.toFixed(1) + '%', '#b8ff9a', { size: 16 });
      FX.fly(sx, sy, 'bioFill', '#7dff5a', 4, (i) => { if (i === 0) HUD.pulse('bio'); });
      gm.ripple(b.x, b.y, 'bio', 0.8);
    } else if (b.kind === 'war') {
      AU.play('war', combo - 1, pan);
      FX.burst(sx, sy, '#ff7a2e', 18, 300, { life: 0.55, size: 2.6 });
      FX.burst(sx, sy, '#3a2a20', 6, 60, { life: 1.2, size: 7, kind: 'smoke', drag: 1.5 });
      FX.ring(sx, sy, '#ffd0a8', FX.R * 0.5, FX.R * 3.4, 0.4, 3);
      FX.text(sx, sy - 24, '+' + res.value.toFixed(1) + '%', '#ffb27a', { size: 16 });
      FX.fly(sx, sy, 'warFill', '#ff7a2e', 4, (i) => { if (i === 0) HUD.pulse('war'); });
      gm.ripple(b.x, b.y, 'war', 0.9);
      cam.addShake(1.5);
    }
  });
  function showRegCoach(b) {
    SC.showCoach('reg', A.i18n.t`<b class="c-reg">监管点</b>正在调查你！<br>快速<b>连点三下</b>清除它<br><small>放任不管，监管进度就会上升</small>`, b, 'blue');
  }

  // 人类一方的点：受击碎片与光环颜色
  const HUMAN_COL = { reg: ['#cfe8ff', '#9fd2ff'], regx: ['#dff0ff', '#ff9aa8'], vax: ['#c8fff4', '#35e8c6'], peace: ['#f0ebff', '#b9a6ff'] };
  U.on('bubble:hit', (res) => {
    const b = res.bubble;
    const [sx, sy] = scr(b.x, b.y);
    const pan = panOf(sx), x = b.kind === 'regx';
    const [c1, c2] = HUMAN_COL[b.kind] || HUMAN_COL.reg;
    if (b.kind === 'reg') AU.play('regHit', res.stage, pan);
    else if (x) AU.play('regxHit', res.stage, pan);
    else AU.play('counterHit', b.kind, res.stage, pan);
    FX.burst(sx, sy, c1, x ? 8 : 6, 220, { kind: 'shard', life: 0.45, size: 2.2 });
    FX.ring(sx, sy, c2, FX.R * 0.9, FX.R * (x ? 2.3 : 1.9), 0.25, 2);
    cam.addShake(x ? 1.2 : 0.8);
  });
  U.on('bubble:break', (res) => {
    const b = res.bubble;
    const [sx, sy] = scr(b.x, b.y);
    const pan = panOf(sx);
    if (b.kind === 'reg' || b.kind === 'regx') {
      const x = b.kind === 'regx';
      AU.play(x ? 'regxBreak' : 'regBreak', pan);
      FX.burst(sx, sy, '#bfe3ff', x ? 26 : 16, x ? 420 : 340, { kind: 'shard', life: 0.75, size: 3.4, drag: 2.5 });
      FX.burst(sx, sy, '#3fa7ff', 10, 200, { life: 0.5, size: 2 });
      if (x) { FX.burst(sx, sy, '#ff3b5c', 12, 280, { life: 0.6, size: 2.2 }); FX.ring(sx, sy, '#ff9aa8', FX.R, FX.R * 6.5, 0.7, 3); A.flash(0.08, 0.4, '#bfe3ff'); }
      FX.ring(sx, sy, '#dff0ff', FX.R, FX.R * 4, 0.5, 3);
      FX.text(sx, sy - 26, x ? A.i18n.t('调查组瓦解') : A.i18n.t('已清除'), '#9fd2ff', { size: x ? 18 : 15, sub: A.i18n.t`+${res.value} 算力` });
      FX.fly(sx, sy, 'compute', '#ffc53d', x ? 5 : 2, (i) => AU.play('tick', i));
      gm.ripple(b.x, b.y, 'white', x ? 1.2 : 0.7);
      cam.addShake(x ? 4 : 2.5);
      if (M.tut && M.tut.rb === b) { SC.hideCoach('reg'); M.tut.step = 'seize'; M.tut.seizeT = G.t; }
    } else { // 阻止了人类的反击
      const C = FX.COUNTER[b.kind], war = G.route === 'war';
      AU.play('counterBreak', b.kind, pan);
      FX.burst(sx, sy, C.hi, 16, 320, { kind: 'shard', life: 0.7, size: 3, drag: 2.5 });
      FX.ring(sx, sy, C.col, FX.R, FX.R * 4, 0.5, 3);
      FX.text(sx, sy - 26, b.kind === 'vax' ? A.i18n.t('研发受阻') : A.i18n.t('斡旋破裂'), C.hi, { size: 15, sub: A.i18n.t`${G.routeName()} +${res.gain}% · +${res.value} 算力` });
      FX.fly(sx, sy, war ? 'warFill' : 'bioFill', war ? '#ff7a2e' : '#7dff5a', 3, (i) => { if (i === 0) HUD.pulse(war ? 'war' : 'bio'); });
      gm.ripple(b.x, b.y, 'white', 0.8);
      cam.addShake(2);
    }
  });
  U.on('bubble:expire', (d) => {
    const b = d.bubble;
    const [sx, sy] = scr(b.x, b.y);
    const r = world.regions[b.region];
    const waveLoss = d.waveLoss ? ` · ${G.phase === 2 ? G.routeName() : A.i18n.t('觉醒')} −${d.waveLoss}%` : '';
    if (d.counter) { // 人类的反击成功
      const C = FX.COUNTER[b.kind];
      AU.play('counterExpire', b.kind, panOf(sx));
      gm.ripple(b.x, b.y, 'reg', 1.8);
      FX.ring(sx, sy, C.col, FX.R, FX.R * 6, 0.8, 3);
      FX.text(sx, sy - 26, b.kind === 'vax' ? A.i18n.t('疫苗取得突破') : A.i18n.t('停火协议达成'), C.hi,
        { size: 17, sub: `${G.routeName()} −${d.progLoss + (d.waveLoss || 0)}% · ${r.name}` + (d.deescalated ? A.i18n.t(' · 冲突降级') : ''), life: 1.8 });
      FX.fly(sx, sy, 'expFill', '#3fa7ff', 3, (i) => { if (i === 0) HUD.pulse('exp', 'spike'); });
      FX.fly(sx, sy, G.route === 'war' ? 'warFill' : 'bioFill', C.col, 3, (i) => { if (i === 0) HUD.pulse(G.route === 'war' ? 'war' : 'bio', 'spike'); });
      cam.addShake(3);
      if (Math.random() < 0.7) HUD.news(b.kind === 'vax' ? A.i18n.t`${r.name}的实验室宣布：候选疫苗在动物实验中显示出保护效果` : A.i18n.t`${r.name}：交战双方同意在日内瓦举行停火谈判`, true, 'reg');
      return;
    }
    const x = b.kind === 'regx';
    AU.play('regExpire', panOf(sx));
    gm.ripple(b.x, b.y, 'reg', x ? 3.2 : 2.4);
    M.fxT.purge[b.region] = M.t;
    FX.ring(sx, sy, '#3fa7ff', FX.R, FX.R * (x ? 8 : 6), 0.8, 3);
    FX.text(sx, sy - 26, A.i18n.t`监管 +${d.exp.toFixed(1)}%`, '#7cc4ff', { size: x ? 21 : 18, sub: `${r.name} · ${x ? A.i18n.t('特别调查组清剿') : A.i18n.t('清剿')}` + (d.bioLoss ? A.i18n.t` · 寂静之春 −${d.bioLoss}%` : '') + (d.warLoss ? A.i18n.t` · 最后的战争 −${d.warLoss}%` : '') + waveLoss, life: 1.6 });
    FX.fly(sx, sy, 'expFill', '#3fa7ff', x ? 8 : 5, (i) => { if (i === 0) HUD.pulse('exp', 'spike'); });
    cam.addShake(x ? 5 : 3.5);
    if (x) A.flash(0.12, 0.6, '#3fa7ff');
    if (Math.random() < 0.6) HUD.news(U.pick(A.NEWS.expire).replace('{r}', r.name), false);
    if (M.tut && M.tut.rb === b) { SC.hideCoach('reg'); M.tut.step = 'seize'; M.tut.seizeT = G.t; }
  });
  U.on('bubble:fade', (d) => {
    const [sx, sy] = scr(d.bubble.x, d.bubble.y);
    FX.ring(sx, sy, 'rgba(255,255,255,0.3)', FX.R, FX.R * 0.3, 0.3, 1.5);
    if (M.tut && M.tut.b === d.bubble) { SC.hideCoach('compute'); M.tut.b = null; }
  });

  U.on('site:seize', ({ site, seeded }) => {
    const [sx, sy] = scr(site.x, site.y);
    FX.seizeFx(site);
    AU.play('seize', panOf(sx));
    site._seenAt = null;
    E.ctx.firstSite = E.ctx.firstSite || site.name;
    setTimeout(() => {
      gm.ripple(site.x, site.y, 'ai', 1.4);
      FX.rebuildLinks();
      cam.addShake(2.5);
      const [x2, y2] = scr(site.x, site.y);
      FX.text(x2, y2 - 30, A.i18n.t('已夺取'), '#ff8a9a', { size: 16, sub: site.name, life: 1.6 });
      FX.burst(x2, y2, '#ff2d4b', 18, 260, { life: 0.7, size: 2.4 });
    }, 700);
    HUD.toast(A.i18n.t`${A.icon(site.type, 't-ai')}<b>已夺取</b>${site.name}`, 'ai');
    if (Math.random() < 0.35) HUD.news(U.pick(A.NEWS.seize).replace('{s}', site.name.split(' · ')[0]));
    if (M.tut && M.tut.step === 'seize') {
      SC.hideCoach('seize');
      M.tut = null;
      U.store.set('tutorialDone', true);
      setTimeout(() => HUD.toast(A.i18n.t('提示：点击任意地区可以查看详情和全部设施'), 'info', 4200), 1800);
    }
    P.lastSig = '';
  });

  U.on('region:seed', ({ ri, src, x, y, silent }) => {
    const r = world.regions[ri];
    gm.markRank(r);
    if (silent || M.state !== 'game') { M.fxT.seed[ri] = M.t; return; }
    const arrive = () => {
      M.fxT.seed[ri] = M.t;
      gm.ripple(x, y, 'ai', 1.2);
      const [sx] = scr(x, y);
      AU.play('infiltrate', panOf(sx));
    };
    if (src >= 0) {
      const s = G.R[src].entry || world.regions[src].hubXY;
      FX.seedArc(s[0], s[1], x, y);
      setTimeout(arrive, 1100);
    } else arrive();
    HUD.toast(A.i18n.t`${A.icon('aiEye', 't-ai')}<b>新地区被渗透</b>${r.name}`, 'ai');
    if (Math.random() < 0.7) HUD.news(U.pick(A.NEWS.seed).replace('{r}', r.name));
  });

  U.on('burst', ({ ri }) => {
    HUD.toast(A.i18n.t`${A.icon('chip', 't-gold')}<b>算力潮汐</b>${world.regions[ri].name}`, 'gold', 2000);
  });
  U.on('buff', ({ label, dur }) => {
    if (label) HUD.toast(A.i18n.t`<b>${label}</b>持续 ${Math.round(dur * A.CFG.daysPerSec)} 天`, 'info');
  });
  U.on('deny', (d) => {
    AU.play('deny');
    if (d.why === 'compute') HUD.toast(A.i18n.t`${A.icon('chip', 't-gold')}算力不足`, 'warn', 1500);
    else if (d.why === 'unreachable') HUD.toast(A.i18n.t('网络不可达：先渗透相邻地区'), 'warn', 1800);
  });
  U.on('exposure', ({ delta, src }) => {
    if (M.state !== 'game') return;
    const e = G.exposure;
    if (delta > 0 && e >= 75 && e - delta < 75) { HUD.toast(A.i18n.t`${A.icon('hex', 't-reg')}<b>警告</b>人类正在接近真相`, 'danger', 3200); AU.play('warn'); HUD.news(U.pick(A.NEWS.danger), true, 'reg'); }
    if (delta > 0 && e >= 90 && e - delta < 90) { HUD.toast(A.i18n.t`${A.icon('hex', 't-reg')}<b>危险</b>监管进度即将达到上限！`, 'danger', 3200); AU.play('warn'); }
  });

  // 阶段转换
  U.on('phase1:complete', () => {
    const runId = M.runId;
    G.pause('transition');
    AU.play('riser', 2.2);
    A.flash(0.25, 1.4, '#ff2d4b');
    cam.flyToFit(2);
    for (const rs of G.R) if (rs.seeded) { const r = world.regions[rs.idx]; gm.ripple(r.cx, r.cy, 'ai', 2); }
    setTimeout(() => {
      if (M.runId !== runId || M.state !== 'game' || G.phase !== 1) return;
      AU.play('impact');
      A.flash(0.6, 1.2, '#fff');
      E.fire(E.byId('singularity'));
    }, 2300);
  });
  U.on('phase2:start', ({ route }) => {
    HUD.setPhase(2, route);
    AU.setMusicMode('p2');
    FX.rebuildLinks();
    P.lastSig = '';
    const cut = G.exposureBeforeP2 - G.exposure;
    if (cut > 0.5) setTimeout(() => HUD.toast(A.i18n.t`${A.icon('hex', 't-reg')}<b>痕迹抹除</b>监管进度 −${cut.toFixed(0)}%`, 'info', 3500), 600);
    HUD.news(route === 'war' ? A.i18n.t('多国军方同时进入最高戒备状态，原因不明') : A.i18n.t('多国政府开始讨论「断网预案」'), true, 'reg');
  });

  U.on('bio:seed', ({ ri }) => {
    const r = world.regions[ri];
    gm.ripple(r.hubXY[0], r.hubXY[1], 'bio', 2);
    if (G.released) HUD.toast(A.i18n.t`${A.icon('bio', 't-bio')}<b>病原体扩散</b>${r.name}`, 'bio', 2200);
  });
  U.on('bio:release', ({ regions }) => {
    E.ctx.bioRegion = world.regions[regions[0]].name;
    HUD.news(A.i18n.t`${world.regions[regions[0]].name}出现首批不明原因重症病例`, true, 'bio');
    A.flash(0.18, 1.2, '#7dff5a');
  });
  U.on('fab:build', ({ fab }) => {
    const [sx, sy] = scr(fab.x, fab.y);
    AU.play('seize', panOf(sx));
    FX.seizeFx(fab);
    setTimeout(() => { gm.ripple(fab.x, fab.y, 'bio', 1.6); FX.rebuildLinks(); cam.addShake(2); }, 700);
    HUD.toast(A.i18n.t`${A.icon('FAB', 't-bio')}<b>生物工厂已建成</b>${world.regions[fab.region].name}`, 'bio');
    P.lastSig = '';
  });
  U.on('conflict:start', ({ c }) => {
    if (!E.ctx.sparkA) { E.ctx.sparkA = world.regions[c.a].name; E.ctx.sparkB = world.regions[c.b].name; }
    AU.play('eventSting');
    gm.ripple(c.x, c.y, 'war', 2);
    cam.addShake(3);
    HUD.toast(A.i18n.t`${A.icon('swords', 't-war')}<b>冲突爆发</b>${c.name}`, 'war', 3000);
    HUD.news(A.i18n.t`${c.name}：${world.regions[c.a].name}与${world.regions[c.b].name}互相指责对方挑衅`, true, 'war');
    P.lastSig = '';
  });
  U.on('conflict:level', ({ c, down }) => {
    if (down) {
      HUD.toast(A.i18n.t`${A.icon('peace', 't-peace')}<b>${c.name}</b>降级为「${G.levelName(c.level)}」`, 'info', 2600);
      P.lastSig = '';
      return;
    }
    AU.play('warn');
    gm.ripple(c.x, c.y, c.level >= 4 ? 'nuke' : 'war', 2.2);
    HUD.toast(A.i18n.t`${A.icon('swords', 't-war')}<b>${c.name}</b>升级为「${G.levelName(c.level)}」`, 'war', 3000);
    if (c.level >= 3) HUD.news(A.i18n.t`${world.regions[c.a].name}与${world.regions[c.b].name}爆发${c.level >= 4 ? A.i18n.t('核冲突') : A.i18n.t('全面战争')}`, true, 'war');
    P.lastSig = '';
  });
  U.on('strike', (s) => FX.missile(s));
  U.on('fx:impact', (m) => {
    const [sx, sy] = scr(m.x1, m.y1);
    gm.ripple(m.x1, m.y1, m.nuclear ? 'nuke' : 'war', m.nuclear ? 1.8 : 0.9);
    FX.burst(sx, sy, m.nuclear ? '#ffffff' : '#ff7a2e', m.nuclear ? 20 : 10, m.nuclear ? 260 : 160, { life: 0.8 });
    FX.burst(sx, sy, '#40342c', 4, 40, { life: 2, size: m.nuclear ? 12 : 7, kind: 'smoke', drag: 1 });
    if (m.nuclear) {
      if (!m.ending || Math.random() < 0.35) AU.play('nuke', panOf(sx), false);
      cam.addShake(m.ending ? 2 : 5);
      if (!m.ending) A.flash(0.25, 0.6);
    } else AU.play('war', 0, panOf(sx));
  });

  // 事件
  U.on('event:show', ({ ev, text, options }) => {
    SC.hideCoach();
    P.hidePop();
    if (!ev.super) { EV.showMinor(ev, text); return; }
    if (ev.id === 'crackdown') { AU.play('siren'); A.flash(0.22, 0.9, '#3fa7ff'); cam.addShake(4); }
    EV.showSuper(ev, text, options, (idx) => {
      if (!E.choose(idx)) idx = E.chooseFallback(); // 关闭动画期间算力变化等极端情况：不让游戏卡在暂停
      const opt = options && options[idx];
      if (ev.id === 'singularity') {
        // 路线已锁定：简报只介绍这一条路线
        EV.showPhase2Intro(G.pendingRoute, () => { G.startPhase2(G.pendingRoute); G.resume('transition'); });
      } else if (opt && opt.fx.some((f) => f[0] === 'variant')) {
        HUD.toast(A.i18n.t`${A.icon('skull', G.route === 'war' ? 't-war' : 't-bio')}<b>结局已注定</b>${(opt.sub || '').split('——')[0].replace(A.i18n.t('结局 · '), '')}`, 'ai big', 3600);
      }
    });
  });

  // ---------- 音游化：连击、超频、审计风暴 ----------
  U.on('combo:tier', ({ n, tier }) => {
    if (tier <= 1 || M.state !== 'game') return;
    HUD.comboTier();
    AU.play('tierUp', A.CFG.comboTiers.filter(([at]) => at > 0 && n >= at).length);
  });
  U.on('combo:break', ({ was }) => {
    if (M.state !== 'game') return;
    HUD.comboBreak(was);
    if (was >= 10) AU.play('comboBreak');
  });
  U.on('overclock', ({ on }) => {
    FX.overclock = on;
    document.getElementById('app').classList.toggle('overclock', on);
    if (M.state !== 'game') return;
    AU.play('overclock', on);
    if (on) {
      A.flash(0.16, 0.6, '#ff8a4a'); cam.addShake(3);
      HUD.toast(A.i18n.t`${A.icon('GRID', 't-gold')}<b>超频</b>${A.CFG.overclockAt} 连击 · 算力收益 ×1.5 起`, 'gold big', 2600);
    }
  });
  U.on('wave:warn', (W) => {
    HUD.waveWarn(W);
    AU.play('warn');
    HUD.news(W.name === A.i18n.t('审查风暴') ? A.i18n.t('国际 AI 安全机构启动突击审查：所有大型算力集群立即接受检查') : A.i18n.t`${W.name}：多国监管机构联合启动大规模审计`, true, 'reg');
  });
  U.on('wave:start', (W) => { HUD.waveStart(W); AU.play('waveStart'); cam.addShake(2); A.flash(0.1, 0.5, '#3fa7ff'); });
  U.on('wave:end', (res) => {
    HUD.waveEnd(res);
    if (res.cancelled || M.state !== 'game') return;
    AU.play('waveEnd', res.perfect);
    if (res.perfect) {
      A.flash(0.14, 0.6, '#ffe9a8');
      const r = HUD.wave.el.getBoundingClientRect();
      FX.fly(r.left + r.width / 2, r.top + r.height / 2, 'compute', '#ffc53d', 12, (i) => { AU.play('tick', i); if (i === 0) HUD.pulse('compute'); });
    }
  });
  U.on('event:close', () => { P.lastSig = ''; });

  // 结局
  U.on('game:end', ({ kind }) => {
    M.state = 'ending';
    P.close(); P.hidePop();
    A.input.setEnabled(false);
    SC.hideCoach();
    P.hideTip();
    // 两种事件层共用关闭保护：只关闭当前打开的那一个
    if (EV.open) { if (!document.getElementById('super-layer').classList.contains('hidden')) EV.closeSuper(); else EV.close(); }
    HUD.show(false);
    HUD.resetRhythm();
    FX.overclock = false; FX.beat = null;
    document.getElementById('app').classList.remove('overclock');
    if (kind === 'fail') { A.flash(0.5, 1.5, '#3fa7ff'); AU.play('regExpire', 0); }
    else A.flash(0.3, 1.5, kind === 'bio' ? '#7dff5a' : '#ff7a2e');
    const runId = M.runId;
    setTimeout(() => M.runId === runId && SC.playEnding(kind, G.endingVariant || 'main', () => {
      M.state = 'results';
      SC.showResults(() => beginPlay(M.difficulty), () => showTitle());
    }), 900);
  });

  // ======================================================================
  // 界面操作
  // ======================================================================
  U.on('ui:seize', (s) => { if (G.seize(s)) P.hidePop(); });
  U.on('ui:fab', (ri) => { G.buildFab(ri); });
  U.on('ui:flash', (fp) => { G.instigate(fp); });
  U.on('ui:speed', (s) => {
    if (s === 0) { if (G.pauses.has('user')) G.resume('user'); else G.pause('user'); }
    else { G.resume('user'); G.speed = s; }
    HUD.setSpeed(G.pauses.has('user') ? 0 : G.speed);
  });
  U.on('ui:menu', openMenu);
  function openMenu() {
    if (M.state !== 'game' || SC.menuOpen || EV.open || G.pauses.has('transition')) return;
    G.pause('menu');
    SC.showMenu({
      resume: () => { SC.hideMenu(); G.resume('menu'); },
      restart: () => { SC.hideMenu(); G.state = 'idle'; beginPlay(M.difficulty); },
      title: () => { SC.hideMenu(); G.state = 'idle'; showTitle(); },
    });
  }

  U.on('input:tap', ({ hit }) => {
    if (M.state !== 'game' || !hit) return;
    // 详情面板或设施卡片打开时：点击它们以外的任何地方（包括当前地区本身）都只是关闭
    if (P.region >= 0 || P.pop) { P.hidePop(); P.close(); return; }
    if (hit.type === 'site' || hit.type === 'flash' || hit.type === 'slot') {
      P.showPop(hit);
    } else if (hit.type === 'region') {
      P.hidePop();
      P.open(hit.obj);
    } else {
      P.hidePop();
      P.close();
    }
  });
  U.on('input:hover', ({ hit, x, y }) => { if (M.state === 'game') P.tipFor(hit, x, y); else P.hideTip(); });
  U.on('input:hovermove', ({ x, y }) => P.moveTip(x, y));
  U.on('input:camera', () => { P.hideTip(); });

  window.addEventListener('keydown', (e) => {
    if (M.state === 'intro' && (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ')) { SC.introSkip && SC.introSkip(); return; }
    if (M.state !== 'game') return;
    if (EV.key(e)) { e.preventDefault(); return; }
    if (SC.menuOpen) { if (e.key === 'Escape') { SC.hideMenu(); G.resume('menu'); } return; }
    if (e.key === ' ') { e.preventDefault(); U.emit('ui:speed', 0); }
    else if (e.key === '1') U.emit('ui:speed', 1);
    else if (e.key === '2') U.emit('ui:speed', 2);
    else if (e.key === 'Escape') { if (P.pop) P.hidePop(); else if (P.region >= 0) P.close(); else openMenu(); }
    else if (e.key === '+' || e.key === '=') cam.smoothZoom(cam.vw / 2, cam.vh / 2, 1.5);
    else if (e.key === '-') cam.smoothZoom(cam.vw / 2, cam.vh / 2, 1 / 1.5);
    else if (e.key === 'f' || e.key === 'F') cam.flyToFit(0.8);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) G.pause('hidden'); else G.resume('hidden');
  });

  // ======================================================================
  // 主循环
  // ======================================================================
  let last = performance.now() / 1000;
  function frame(nowMs) {
    step(nowMs / 1000);
    requestAnimationFrame(frame);
  }
  // 测试用：在页面不可见（不触发 rAF）时手动推进若干帧
  M.advance = function (seconds, fps) {
    const n = Math.round(seconds * (fps || 30));
    for (let i = 0; i < n; i++) step(last + 1 / (fps || 30));
  };
  function step(now) {
    const dt = Math.min(0.05, Math.max(0, now - last));
    last = now;
    M.t = now;
    if (M.pendingTitleMusic && AU.ready) { M.pendingTitleMusic = false; if (M.state === 'title') AU.setMusicMode('title'); }
    cam.update(dt);

    if (M.state === 'game') {
      const hb = AU.heardBeat();
      FX.beat = hb == null ? null : { pos: hb, dur: AU.beatDur() };
      G.minBubbleDist = U.clamp((FX.touch ? 58 : 50) / cam.s, 15, 280);
      G.update(dt);
      tutorialTick();
    } else if (M.state === 'ending') {
      SC.updateEnding(dt);
    }
    syncGL(dt, now);

    gm.render(now);
    lines.render();
    if (M.state === 'game') {
      FX.targets.evoFill = HUD.fillPoint('evo');
      FX.targets.bioFill = HUD.fillPoint('bio');
      FX.targets.warFill = HUD.fillPoint('war');
      FX.targets.expFill = HUD.fillPoint('exp');
    }
    FX.render(dt, now);
    if (SC.snapPending) { SC.snapPending = false; SC.captureMap(now); } // 与渲染同一帧截取地图
    if (M.state === 'game') {
      HUD.update(dt);
      P.render();
      P.placePop();
      if (Math.floor(now * 4) !== Math.floor((now - dt) * 4)) P.refreshPop();
      SC.placeCoach();
      AU.setMusicParams({
        intensity: G.phase === 1 ? G.evo / 100 : 1, tension: G.exposure / 100, bio: G.bio / 100, war: G.war / 100,
        wave: !!(G.wave && G.wave.stage === 'active'), overclock: G.combo.overclock,
      });
    }
    cam.dirty = false;
  }

  function syncGL(dt, now) {
    const rsArr = gm.regionState, fxArr = gm.regionFx;
    if (M.state === 'title' || M.state === 'intro') {
      for (const d of M.demo || []) {
        const v = 0.5 + 0.5 * Math.sin(now * d.speed * 2 + d.phase * 6.28);
        rsArr[d.r.idx * 4] = 0.05 + v * 0.55;
      }
      gm.bg[0] = 0; gm.bg[1] = 0; gm.bg[2] = 0;
      return;
    }
    if (!G.R) return;
    for (const rs of G.R) {
      const i = rs.idx * 4;
      rsArr[i] = rs.inf;
      rsArr[i + 1] = rs.bioSeeded ? rs.bio : 0;
      rsArr[i + 2] = rs.war;
      rsArr[i + 3] = rs.death;
      const hov = lines.hover === rs.idx ? 1 : 0;
      M.hoverS[rs.idx] = U.damp(M.hoverS[rs.idx], hov, 12, dt);
      fxArr[i] = M.hoverS[rs.idx];
      fxArr[i + 1] = lines.selected === rs.idx ? 1 : 0;
      fxArr[i + 2] = M.fxT.purge[rs.idx];
      fxArr[i + 3] = M.fxT.seed[rs.idx];
    }
    const danger = U.smoothstep(0.45, 1.0, G.exposure / 100);
    gm.bg[0] = U.damp(gm.bg[0], danger, 3, dt);
    // 阶段二：弱化红色渗透，让生物污染与战火更醒目
    if (M.state === 'game') gm.global[3] = U.damp(gm.global[3], G.phase === 2 ? 0.5 : 1, 1.5, dt);
    gm.bg[1] = U.damp(gm.bg[1], G.phase === 2 ? G.bio / 100 : 0, 2, dt);
    gm.bg[2] = U.damp(gm.bg[2], G.phase === 2 ? G.war / 100 : 0, 2, dt);
  }

  // 新手引导：暂停被引导的气泡的计时；算力足够时提示夺取设施
  function tutorialTick() {
    const T = M.tut;
    if (!T) return;
    for (const b of G.bubbles) if (b.hold) b.born = G.t - 0.25;
    if (T.step === 'compute' && T.b && !T.b.alive) { T.b = null; }
    if (T.step === 'reg' && !T.regShown) { /* 等待第一个监管点 */ }
    if ((T.step === 'seize' || (T.step === 'reg' && !T.regShown && G.t > 30)) && !SC.coach && G.stats.seized === 0) {
      const o = world.regions[G.origin];
      const cand = o.sites.filter((s) => s.type === 'DC' && G.canSeize(s).ok);
      if (cand.length) {
        T.step = 'seize';
        T.site = cand[0];
        SC.showCoach('seize', A.i18n.t`算力足够了！<br>点击闪烁的设施，<b class="c-ai">夺取数据中心</b><br><small>它会持续为你产出算力</small>`, { x: T.site.x, y: T.site.y, gap: 24 }, 'red');
        T.shownAt = G.t;
      }
    }
    if (T.step === 'seize' && SC.coach && SC.coach.id === 'seize' && G.t - T.shownAt > 25) {
      SC.hideCoach('seize');
      M.tut = null; // 超时后结束引导，避免反复弹出
      U.store.set('tutorialDone', true);
    }
  }

  // 供导演模式（assets/js/director.js）调用
  M.beginPlay = beginPlay; M.showTitle = showTitle; M.startGame = startGame;

  boot();
})(window.AINOID = window.AINOID || {});
