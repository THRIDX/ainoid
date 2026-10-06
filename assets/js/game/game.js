/* AINOID — 游戏核心：状态、模拟、刷新导演、玩家行动
 * 纯逻辑，不直接操作 DOM；通过 U.emit 发出事件，由渲染层与界面层订阅。
 */
(function (A) {
  'use strict';
  const U = A.U;
  const world = A.world;

  // ======================================================================
  // 平衡参数（真实秒，1 倍速）
  // ======================================================================
  const CFG = {
    daysPerSec: 1.25,
    startCompute: 12,

    // 渗透
    infGrowth: 0.052, seedK: 0.010, seedGlobal: 0.035, originInf: 0.035,

    // 算力点
    computeLife: 10, computeInt: [2.0, 1.45], computeCap: 5,
    computeBase: 3.0, computeCapK: 0.4, computeEvo: 1.1,
    goldenEvery: [28, 42], goldenLife: 7, goldenMult: 5, goldenEvo: 5,
    burstEvery: [24, 36],
    comboWindow: 1.6,

    // 连击（音游式）：只有“人类点”漏掉或长时间停手才会断连
    comboIdle: 5,
    comboTiers: [[50, 1.7], [30, 1.5], [20, 1.3], [10, 1.15], [0, 1]],
    overclockAt: 30,
    judgeMult: { perfect: 1.3, great: 1.12, good: 1 },

    // 监管点（节奏：早期约 6 秒一个，后期约 3 秒一个；同屏最多 4 个）
    regLife: 9, regInt: [5.4, 2.9], regHp: 3, regCapBase: 2, regCapK: 2.5,
    regExpBase: 5.5, regExpK: 6.5, regPurge: 0.07, regKillExp: 0.4, regKillReward: 2,
    firstReg: 16,
    // 特别调查组（五击）
    regxHp: 5, regxLife: 13, regxExp: 1.7, regxReward: 7, regxKillExp: 1.5, regxFrom: 30, regxChance: [0.08, 0.22],

    // 审计风暴（节拍波次）与严格监管
    waveAt: [30, 65], waveP2At: 45, waveBeat: 60 / 84,
    waveSizes: [[6, 1], [8, 1]], waveP2: [7, 1, 2], // 阶段一第 1、2 波：[音符数, 调查组]；终局：[音符数, 调查组, 反击点]
    waveMissProg: 1.5, wavePerfectReward: 40, wavePerfectExp: 8,
    // 严格监管：监管进度 ≥ crackAt 且距上次超过 crackCooldown 秒就触发（觉醒 / 终局路线进度都会被砍）
    crackAt: 40, crackCooldown: 40,
    crackPenalty: 15,

    // 曝光
    // 人类的警觉：随觉醒（终局为路线进度）从 expRise[0] 线性升到 expRise[1]（每秒），与设施足迹一起构成自然增长
    expRise: [0.07, 0.15], expDecay: 0.022, expDecayDelay: 14, footprintK: 0.003,

    // 设施
    cost: { DC: 24, GRID: 30, NET: 20, LAB: 40, MIL: 46 },
    costGrow: { DC: 0.3, GRID: 0.3, NET: 0.3, LAB: 0.3, MIL: 0.3 },
    dcIncome: 0.24, dcEvo: 0.028, gridMult: 0.6, netInf: 0.45, netExpRed: 0.07,
    originIncome: 0.16, originEvo: 0.02,
    seizeExpBase: 0.8, seizeExpK: 2.0, unseededCost: 1.6,

    // 阶段二
    // 终局：人类的点更少，路线点的收益更高
    p2ComputeMult: 1.2, p2ComputeIntMult: 1.7, p2ComputeCap: 3, p2RegIntMult: 1.4, p2RegCapCut: 1,
    bioLife: 10, warLife: 10,
    bioInt: [4.4, 2.6], warInt: [4.4, 2.6], p2Cap: 3,
    bioClick: 2.3, warClick: 2.3,
    labRate: 0.09, fabRate: 0.15, milRate: 0.09, conflictRate: 0.05,
    bioSpread: 0.04, bioCross: 0.02, conflictEscalation: 0.022,
    fabCost: 55, fabGrow: 0.35, conflictCost: 50, conflictGrow: 0.4,
    p2ExpK: 0.012,
    releaseAt: 30,
    p2ExposureKeep: 0.6,
    // 终局反击点：疫苗研发（生物路线）/ 停火斡旋（战争路线）
    counterHp: 3, counterLife: 10, counterInt: [13, 7.5], counterLoss: 2, counterExp: 2, counterReward: 3, counterGain: 0.8, counterCapStep: 50,
  };

  // 二周目（通关一次后在标题页解锁）：刷新更密、进度更慢、人类的警觉增长更快——即 09-29 版的节奏
  const NG_PLUS = {
    computeInt: [1.8, 1.25], computeCap: 6, computeEvo: 0.72, goldenEvery: [30, 48], goldenEvo: 4, burstEvery: [22, 36], comboIdle: 3.5,
    regInt: [4.6, 1.7], regCapBase: 3, regCapK: 4, regxFrom: 25, regxChance: [0.12, 0.34],
    waveSizes: [[7, 1], [10, 2]], waveP2: [9, 1, 3],
    p2ComputeIntMult: 1.25, p2ComputeCap: 5, p2RegIntMult: 1, p2RegCapCut: -1,
    bioInt: [4.8, 2.3], warInt: [4.8, 2.3], p2Cap: 4, bioClick: 1.2, warClick: 1.2,
    labRate: 0.06, fabRate: 0.10, milRate: 0.06, conflictRate: 0.032,
    counterInt: [9, 4.6], counterLoss: 3, counterGain: 0.6, counterCapStep: 35,
    p2ExposureKeep: 0.75, expRise: [0.08, 0.18],
  };
  const BASE = {};
  for (const k in NG_PLUS) BASE[k] = CFG[k];
  function applyMode(ng) { for (const k in NG_PLUS) CFG[k] = ng ? NG_PLUS[k] : BASE[k]; }

  // 难度
  const DIFF = {
    easy: { name: A.i18n.t('简单'), regExp: 0.65, regInt: 1.3, seizeExp: 0.7, regLife: 1.15 },
    normal: { name: A.i18n.t('标准'), regExp: 1, regInt: 1, seizeExp: 1, regLife: 1 },
    hard: { name: A.i18n.t('困难'), regExp: 1.2, regInt: 0.85, seizeExp: 1.15, regLife: 0.9 },
  };

  const G = {
    state: 'idle', phase: 1, t: 0, days: 0, speed: 1,
    pauses: new Set(),
    CFG,
  };
  const listeners = [];
  const emit = (n, d) => U.emit(n, d);
  G.ranks = new Float32Array(world.count).fill(2);

  // ======================================================================
  // 初始化
  // ======================================================================
  G.reset = function (opts) {
    opts = opts || {};
    G.ng = !!opts.ng;
    applyMode(G.ng);
    G.diffKey = opts.difficulty || 'normal';
    G.diff = DIFF[G.diffKey] || DIFF.normal;
    G.state = 'playing';
    G.phase = 1;
    G.t = 0; G.days = 0; G.speed = 1;
    G.pauses.clear();
    G.compute = CFG.startCompute; G.computeEarned = 0;
    G.evo = 0; G.exposure = 0; G.maxExposure = 0;
    G.bio = 0; G.war = 0; G.released = false; G.p1done = false;
    G.route = null; G.pendingRoute = null; G.endingVariant = null;
    G.exposureBeforeP2 = 0; G.phase2T = 0; G.ending = null;
    G.lastExpire = -99;
    G.bubbles = []; G.bubbleId = 1;
    G.spawnQ = [];
    G.combo = { n: 0, last: -99, lastSim: -99, tier: 1, overclock: false };
    G.wave = null; G.waveNo = 0;
    G.crack = { armed: true, lastT: -99, count: 0 };
    G.buffs = [];
    G.flags = {};
    G.conflicts = [];
    G.fabs = [];
    G.stats = {
      computeClicks: 0, goldens: 0, regKills: 0, regMissed: 0, regMissedP1: 0, maxCombo: 0,
      seized: 0, bioClicks: 0, warClicks: 0, events: 0, nukes: 0,
      regxKills: 0, counterKills: 0, perfects: 0, greats: 0, goods: 0, overclocks: 0,
      wavesClean: 0, waves: 0, crackdowns: 0, crackClean: 0,
      phase1Time: 0, startWall: Date.now(),
    };
    G.ranks.fill(2);
    world.sites.forEach((s) => { s.owned = false; s.ownedAt = -1; });

    G.R = world.regions.map((r) => ({
      idx: r.idx, inf: 0, seeded: false, seedT: -1, entry: null,
      bio: 0, bioSeeded: false, war: 0, death: 0,
      heat: 0, purgeT: -99, seedFlash: -99,
      owned: { DC: 0, GRID: 0, NET: 0, LAB: 0, MIL: 0 },
      fab: null, slot: null,
    }));

    // 起源
    const originId = opts.origin || U.weighted(A.ORIGINS, (o) => o.weight).region;
    const or = world.byId[originId];
    G.origin = or.idx;
    G.originSite = { id: -1, region: or.idx, type: 'ORIGIN', name: or.hubName + A.i18n.t(' · 前沿实验室'), x: or.hubXY[0], y: or.hubXY[1], owned: true, ownedAt: 0 };
    G.seedRegion(or.idx, or.hubXY[0], or.hubXY[1], -1, true);
    G.R[or.idx].inf = CFG.originInf;

    // 导演
    G.D = {
      nextCompute: 0.7, nextReg: CFG.firstReg, nextGolden: U.range(24, 34), nextBurst: U.range(18, 26),
      burst: [], relaxUntil: 0, missStreak: 0, nextBio: 3, nextWar: 4.5, nextCounter: 12, seedAcc: 0, eventCheck: 5,
      lastEventT: -30,
    };
    G.eventQueue = [];
    emit('game:reset', G);
  };

  // ======================================================================
  // 工具
  // ======================================================================
  G.pause = (why) => { G.pauses.add(why); };
  G.resume = (why) => { G.pauses.delete(why); };
  G.isPaused = () => G.pauses.size > 0;
  G.buff = (key) => {
    let m = 1;
    for (const b of G.buffs) if (b.until > G.t && b.mods[key] != null) m *= b.mods[key];
    return m;
  };
  G.addBuff = (id, dur, mods, label) => {
    G.buffs = G.buffs.filter((b) => b.id !== id);
    G.buffs.push({ id, until: G.t + dur, mods, label });
    emit('buff', { id, dur, label });
  };
  G.region = (i) => world.regions[i];
  G.ownedSites = () => world.sites.filter((s) => s.owned);
  G.ownedCount = (type) => world.sites.reduce((n, s) => n + (s.owned && (!type || s.type === type) ? 1 : 0), 0);
  G.seededCount = () => G.R.reduce((n, r) => n + (r.seeded ? 1 : 0), 0);
  G.worldPop = () => {
    let p = 0;
    for (const r of world.regions) p += r.pop * (1 - G.R[r.idx].death);
    return p;
  };
  G.basePop = world.regions.reduce((s, r) => s + r.pop, 0);
  G.infFrac = () => { // 以人口加权的全球渗透度
    let s = 0;
    for (const r of world.regions) s += r.pop * G.R[r.idx].inf;
    return s / G.basePop;
  };

  // 曝光变化（含通信枢纽减免）
  G.addExposure = function (v, src) {
    if (v > 0) {
      const red = Math.min(0.35, CFG.netExpRed * G.ownedCount('NET'));
      v *= (1 - red) * G.buff('exposure');
      G.lastExpire = src === 'expire' ? G.t : G.lastExpire;
    }
    const before = G.exposure;
    G.exposure = U.clamp(G.exposure + v, 0, 100);
    G.maxExposure = Math.max(G.maxExposure, G.exposure);
    if (Math.abs(G.exposure - before) > 0.01) emit('exposure', { delta: G.exposure - before, src });
  };
  G.addCompute = function (v, src) {
    G.compute = Math.max(0, G.compute + v);
    if (v > 0) G.computeEarned += v;
    emit('compute', { delta: v, src });
  };
  G.addEvo = function (v) {
    if (G.phase !== 1) return;
    G.evo = U.clamp(G.evo + (v > 0 ? v * G.buff('evo') : v), 0, 100);
  };
  // 两条终局路线互斥：只有当前路线的进度会变化。
  // 决定结局分支的超级事件（方舟 / 最后的密码）出现之前，进度最多到 99.5%，保证结局选择不会被跳过
  const FATE = { bio: 'ark', war: 'lastCode' };
  const fateCap = () => (G.flags[FATE[G.route]] ? 100 : 99.5);
  G.addBio = function (v) { if (G.phase === 2 && G.route === 'bio') G.bio = U.clamp(G.bio + v, 0, Math.max(fateCap(), G.bio)); };
  G.addWar = function (v) { if (G.phase === 2 && G.route === 'war') G.war = U.clamp(G.war + v, 0, Math.max(fateCap(), G.war)); };
  G.routeProg = () => (G.phase === 2 ? (G.route === 'war' ? G.war : G.bio) : G.evo);
  // 当前阶段的主进度（阶段一为觉醒，阶段二为所选路线）
  G.addProg = function (v) {
    if (G.phase === 1) G.addEvo(v);
    else if (G.route === 'war') G.addWar(v);
    else G.addBio(v);
  };
  // 需要连点的“人类点”
  const HP = { reg: 'regHp', regx: 'regxHp', vax: 'counterHp', peace: 'counterHp' };
  G.isHuman = (kind) => kind in HP;
  G.counterKind = () => (G.route === 'war' ? 'peace' : 'vax');

  // ======================================================================
  // 渗透
  // ======================================================================
  G.seedRegion = function (ri, ex, ey, src, silent) {
    const rs = G.R[ri], r = world.regions[ri];
    if (rs.seeded) return false;
    rs.seeded = true;
    rs.seedT = G.t;
    rs.seedFlash = G.t;
    rs.inf = Math.max(rs.inf, 0.025);
    rs.entry = [ex, ey];
    world.computeRank(r, ex, ey, G.ranks);
    emit('region:seed', { ri, src, x: ex, y: ey, silent });
    return true;
  };
  function entryFor(ri, srcRi) {
    const r = world.regions[ri];
    // 优先从通信枢纽（海底光缆登陆站）进入；陆地相邻时从靠近来源的一侧进入
    if (srcRi >= 0 && r.links.get(srcRi) === 1.0) {
      const src = world.regions[srcRi];
      const sx = G.R[srcRi].entry ? G.R[srcRi].entry[0] : src.hubXY[0];
      const sy = G.R[srcRi].entry ? G.R[srcRi].entry[1] : src.hubXY[1];
      let best = -1, bd = Infinity;
      for (let k = 0; k < 60; k++) {
        const i = r.start + Math.floor(Math.random() * r.count);
        const d = U.dist(world.dx[i], world.dy[i], sx, sy);
        if (d < bd) { bd = d; best = i; }
      }
      if (best >= 0) return [world.dx[best], world.dy[best]];
    }
    const net = r.sites.find((s) => s.type === 'NET');
    if (net) return [net.x, net.y];
    return [r.hubXY[0], r.hubXY[1]];
  }
  const f = (I) => I / (I + 0.2);

  function updateSpread(dt) {
    const infMul = G.buff('infRate');
    for (const rs of G.R) {
      if (!rs.seeded) continue;
      const r = world.regions[rs.idx];
      const mult = (1 + CFG.netInf * rs.owned.NET + 0.15 * rs.owned.DC) * infMul;
      rs.inf = Math.min(1, rs.inf + dt * CFG.infGrowth * (0.02 + rs.inf) * (1 - rs.inf) * r.conn * mult);
      rs.heat = Math.max(0, rs.heat - dt * 0.02);
    }
    // 跨地区播种（每 0.5 秒检查一次）
    G.D.seedAcc += dt;
    if (G.D.seedAcc < 0.5) return;
    const step = G.D.seedAcc;
    G.D.seedAcc = 0;
    for (const rj of G.R) {
      if (rj.seeded) continue;
      const tgt = world.regions[rj.idx];
      let lam = 0;
      const srcs = [];
      for (const ri of G.R) {
        if (!ri.seeded || ri.inf <= 0) continue;
        const link = world.regions[ri.idx].links.get(rj.idx) || CFG.seedGlobal;
        const w = f(ri.inf) * link * (1 + 0.5 * Math.min(1, ri.owned.NET));
        lam += w;
        srcs.push([ri.idx, w]);
      }
      lam *= CFG.seedK * Math.pow(tgt.conn, 0.7) * infMul;
      if (Math.random() < 1 - Math.exp(-lam * step)) {
        const pick = U.weighted(srcs, (s) => s[1]);
        const src = pick ? pick[0] : -1;
        const [ex, ey] = entryFor(rj.idx, src);
        G.seedRegion(rj.idx, ex, ey, src);
      }
    }
  }

  // ======================================================================
  // 设施
  // ======================================================================
  G.siteVisible = (s) => {
    if (s.type === 'LAB') return G.phase >= 2 && G.route === 'bio';
    if (s.type === 'MIL') return G.phase >= 2 && G.route === 'war';
    return true;
  };
  G.siteCost = function (s) {
    const r = world.regions[s.region];
    const owned = G.ownedCount(s.type);
    let c = CFG.cost[s.type] * (1 + CFG.costGrow[s.type] * owned);
    if (s.type === 'DC' || s.type === 'GRID' || s.type === 'NET') c *= 0.8 + 0.4 * r.reg;
    if (s.type === 'MIL') c *= 0.6 + r.mil / 10 * 0.6;
    if (!G.R[s.region].seeded) c *= CFG.unseededCost;
    return Math.round(c);
  };
  // 可达：已渗透，或与渗透度 >= 15% 的地区相连
  G.regionReachable = function (ri) {
    if (G.R[ri].seeded) return true;
    for (const [j] of world.regions[ri].links) if (G.R[j].seeded && G.R[j].inf >= 0.15) return true;
    return false;
  };
  G.canSeize = function (s) {
    if (s.owned || G.state !== 'playing') return { ok: false, why: 'owned' };
    if (!G.siteVisible(s)) return { ok: false, why: 'phase' };
    if (!G.regionReachable(s.region)) return { ok: false, why: 'unreachable' };
    const cost = G.siteCost(s);
    if (G.compute < cost) return { ok: false, why: 'compute', cost };
    return { ok: true, cost };
  };
  G.seize = function (s) {
    const chk = G.canSeize(s);
    if (!chk.ok) { emit('deny', chk); return false; }
    const r = world.regions[s.region], rs = G.R[s.region];
    G.addCompute(-chk.cost, 'seize');
    s.owned = true; s.ownedAt = G.t;
    rs.owned[s.type]++;
    G.stats.seized++;
    let seeded = false;
    if (!rs.seeded) seeded = G.seedRegion(s.region, s.x, s.y, -1);
    else rs.inf = Math.min(1, rs.inf + 0.04);
    const exp = (CFG.seizeExpBase + CFG.seizeExpK * r.reg) * (s.type === 'NET' ? 0.5 : 1) * (G.phase === 2 ? 1.2 : 1) * G.diff.seizeExp;
    G.addExposure(exp, 'seize');
    rs.heat = Math.min(1, rs.heat + 0.25);
    emit('site:seize', { site: s, cost: chk.cost, seeded, exp });
    return true;
  };

  // 收入（每秒）
  G.income = function () {
    let c = G.phase === 1 ? CFG.originIncome : CFG.originIncome * 1.5;
    for (const s of world.sites) {
      if (!s.owned || s.type !== 'DC') continue;
      const r = world.regions[s.region];
      const grid = G.R[s.region].owned.GRID > 0 ? 1 + CFG.gridMult : 1;
      c += CFG.dcIncome * (0.6 + r.cap * 0.06) * grid;
    }
    let infc = 0;
    for (const rs of G.R) infc += rs.inf * world.regions[rs.idx].cap;
    c += 0.006 * infc;
    return c * G.buff('income');
  };
  G.evoRate = function () {
    let e = CFG.originEvo;
    for (const s of world.sites) {
      if (!s.owned || s.type !== 'DC') continue;
      const grid = G.R[s.region].owned.GRID > 0 ? 1 + CFG.gridMult * 0.5 : 1;
      e += CFG.dcEvo * grid;
    }
    let infc = 0;
    for (const rs of G.R) infc += rs.inf * world.regions[rs.idx].cap;
    e += 0.0005 * infc;
    return e;
  };

  // ======================================================================
  // 气泡（算力点 / 监管点 / 生物点 / 战争点）
  // ======================================================================
  function tooClose(x, y, minD) {
    for (const b of G.bubbles) if (b.alive && U.dist(b.x, b.y, x, y) < minD) return true;
    return false;
  }
  // 最小间距（地图单位），由渲染层按当前缩放设置，保证屏幕上气泡不重叠
  G.minBubbleDist = 15;
  // 同屏密度：手机为 0.8（刷新间隔 ÷0.8、同屏上限 ×0.8），由 main 按屏幕尺寸设置
  G.density = 1;
  const capOf = (c) => Math.max(1, Math.round(c * (G.density || 1)));
  function posNear(anchors, ri, minD) {
    const r = world.regions[ri], rs = G.R[ri];
    minD = Math.max(minD, G.minBubbleDist);
    for (let t = 0; t < 14; t++) {
      let i = -1;
      if (anchors.length && Math.random() < 0.5) {
        const a = U.pick(anchors);
        i = world.dotNear(r, a.x, a.y, 26 + t * 4);
      }
      // 多次失败后，允许刷在渗透前沿之外一点
      const reach = Math.max(rs.inf, 0.02) + (t > 6 ? 0.04 * (t - 6) : 0);
      if (i < 0) i = rs.inf > 0.001 ? world.randomInfectedDot(r, Math.min(1, reach)) : world.randomDot(r);
      const x = world.dx[i], y = world.dy[i];
      if (!tooClose(x, y, minD)) return [x, y];
    }
    return null;
  }
  function lifeOf(kind) {
    switch (kind) {
      case 'compute': return CFG.computeLife;
      case 'golden': return CFG.goldenLife;
      case 'reg': return CFG.regLife * (G.phase === 2 ? 0.9 : 1) * G.diff.regLife;
      case 'regx': return CFG.regxLife * G.diff.regLife;
      case 'vax': case 'peace': return CFG.counterLife * G.diff.regLife;
      case 'bio': return CFG.bioLife;
      default: return CFG.warLife;
    }
  }
  G.spawnBubble = function (kind, ri, opts) {
    opts = opts || {};
    const r = world.regions[ri];
    let anchors = [];
    if (kind === 'compute' || kind === 'golden') {
      anchors = r.sites.filter((s) => s.owned && s.type === 'DC');
      if (G.originSite.region === ri) anchors.push(G.originSite);
    } else if (kind === 'reg' || kind === 'regx') anchors = r.sites.filter((s) => s.owned);
    else if (kind === 'bio' || kind === 'vax') {
      anchors = r.sites.filter((s) => s.owned && s.type === 'LAB');
      if (G.R[ri].fab) anchors.push(G.R[ri].fab);
    } else if (kind === 'war' || kind === 'peace') {
      anchors = r.sites.filter((s) => s.owned && s.type === 'MIL');
      for (const c of G.conflicts) if (c.a === ri || c.b === ri) anchors.push({ x: c.x, y: c.y });
    }
    const pos = opts.pos || posNear(anchors, ri, 15);
    if (!pos) return null;
    const hp = G.isHuman(kind) ? CFG[HP[kind]] : 1;
    const b = {
      id: G.bubbleId++, kind, region: ri, x: pos[0], y: pos[1],
      born: G.t, life: lifeOf(kind), alive: true, hp, maxHp: hp,
      seed: Math.random(), hitAt: -9, burst: !!opts.burst, wave: !!opts.wave,
    };
    G.bubbles.push(b);
    emit('bubble:spawn', b);
    return b;
  };

  // ---------- 节拍量化刷新：由渲染层提供节拍时钟，气泡卡在八分音符上出现 ----------
  G.beatClock = null; // () => 当前节拍位置（浮点，单位：拍），无音乐时为 null
  function beat8() { const b = G.beatClock && G.beatClock(); return b == null ? null : Math.floor(b * 2); }
  const QUEUED = { queued: true };
  // 返回刷出的气泡、QUEUED（已排队，等下一个八分音符），或 null（没有合适的位置）
  function queueSpawn(kind, ri, opts) {
    const now8 = beat8();
    if (now8 == null) return G.spawnBubble(kind, ri, opts);
    G.spawnQ.push({ kind, ri, opts, at8: now8, t0: G.t });
    return QUEUED;
  }
  function releaseQueue() {
    if (!G.spawnQ.length) return;
    const now8 = beat8();
    G.spawnQ = G.spawnQ.filter((q) => {
      // 等到下一个八分音符；音频时钟停走（标签页休眠、测试环境）时最多等 0.8 秒
      if (now8 != null && now8 <= q.at8 && G.t - q.t0 < 0.8) return true;
      const b = G.spawnBubble(q.kind, q.ri, q.opts);
      if (!b && q.opts && q.opts.wave && G.wave) G.wave.cleared++; // 无法放置时视为通过，避免波次卡住
      return false;
    });
  }
  const queuedOf = (kind) => G.spawnQ.reduce((n, q) => n + (q.kind === kind ? 1 : 0), 0);
  G.bubbleFrac = (b) => U.clamp(1 - (G.t - b.born) / b.life, 0, 1);

  // ---------- 连击：命中累积，“人类点”漏掉或长时间停手则断连 ----------
  function comboTier(n) { for (const [at, m] of CFG.comboTiers) if (n >= at) return m; return 1; }
  function comboUp(nowReal) {
    const C = G.combo;
    C.n++;
    C.last = nowReal; C.lastSim = G.t;
    G.stats.maxCombo = Math.max(G.stats.maxCombo, C.n);
    const tier = comboTier(C.n);
    if (tier !== C.tier) { C.tier = tier; emit('combo:tier', { n: C.n, tier }); }
    if (!C.overclock && C.n >= CFG.overclockAt) { C.overclock = true; G.stats.overclocks++; emit('overclock', { on: true }); }
    return C.n;
  }
  function comboBreak(reason) {
    const C = G.combo;
    if (C.n === 0) return;
    const was = C.n;
    C.n = 0; C.tier = 1;
    if (C.overclock) { C.overclock = false; emit('overclock', { on: false }); }
    emit('combo:break', { was, reason });
  }
  G.comboBreak = comboBreak;
  function judgeStat(judge) {
    if (judge === 'perfect') G.stats.perfects++;
    else if (judge === 'great') G.stats.greats++;
    else G.stats.goods++;
  }

  // 玩家点击气泡。judge：节拍判定 perfect / great / good（由渲染层根据音乐节拍给出）
  G.hitBubble = function (b, nowReal, judge) {
    if (!b.alive || G.state !== 'playing') return null;
    const r = world.regions[b.region];
    const res = { bubble: b, kind: b.kind };
    if (G.isHuman(b.kind)) {
      b.hp--;
      b.hitAt = nowReal;
      if (b.hp > 0) {
        res.type = 'hit'; res.stage = b.maxHp - b.hp;
        emit('bubble:hit', res);
        return res;
      }
      b.alive = false;
      res.type = 'break';
      res.combo = comboUp(nowReal);
      if (b.kind === 'reg' || b.kind === 'regx') {
        const x = b.kind === 'regx';
        G.stats.regKills++;
        if (x) G.stats.regxKills++;
        res.value = x ? CFG.regxReward : CFG.regKillReward;
        G.addCompute(res.value, 'reg');
        G.addExposure(-(x ? CFG.regxKillExp : CFG.regKillExp), 'kill');
      } else {
        G.stats.counterKills++;
        res.value = CFG.counterReward;
        G.addCompute(res.value, 'reg');
        G.addProg(CFG.counterGain);
        res.gain = CFG.counterGain;
      }
      G.D.missStreak = Math.max(0, G.D.missStreak - 1);
      if (b.wave) waveResolve(true);
      emit('bubble:break', res);
      return res;
    }
    b.alive = false;
    const combo = comboUp(nowReal);
    judgeStat(judge);
    res.combo = combo;
    res.judge = judge || 'good';
    res.type = 'collect';
    const tm = G.combo.tier, jm = CFG.judgeMult[res.judge] || 1;
    // 手机上刷得更少，每次点击的收益相应提高，保证进度不变慢
    const vk = 1 / (G.density || 1);
    const pm = (1 + (tm - 1) * 0.6) * (res.judge === 'perfect' ? 1.1 : 1) * vk; // 进度加成比算力温和
    if (b.kind === 'compute' || b.kind === 'golden') {
      let v = (CFG.computeBase + r.cap * CFG.computeCapK) * tm * jm * (G.phase === 2 ? CFG.p2ComputeMult : 1) * vk;
      let e = CFG.computeEvo * pm;
      if (b.kind === 'golden') { v *= CFG.goldenMult; e = CFG.goldenEvo * pm; G.stats.goldens++; }
      v = Math.max(1, Math.round(v * G.buff('computeValue')));
      res.value = v;
      G.addCompute(v, 'bubble');
      G.addEvo(e);
      res.evo = e;
      G.stats.computeClicks++;
      G.R[b.region].inf = Math.min(1, G.R[b.region].inf + 0.006);
    } else if (b.kind === 'bio') {
      const v = CFG.bioClick * pm * G.buff('bio');
      G.addBio(v); res.value = v;
      G.addCompute(Math.round(tm * jm), 'bubble');
      G.stats.bioClicks++;
      const rs = G.R[b.region];
      if (G.released) { if (!rs.bioSeeded) seedBio(b.region); rs.bio = Math.min(1, rs.bio + 0.02); }
    } else if (b.kind === 'war') {
      const v = CFG.warClick * pm * G.buff('war');
      G.addWar(v); res.value = v;
      G.addCompute(Math.round(tm * jm), 'bubble');
      G.stats.warClicks++;
      // 推动附近冲突升级
      let best = null, bd = Infinity;
      for (const c of G.conflicts) {
        const d = U.dist(c.x, c.y, b.x, b.y);
        if ((c.a === b.region || c.b === b.region) && d < bd) { bd = d; best = c; }
      }
      if (best) best.prog += 0.07;
    }
    emit('bubble:collect', res);
    return res;
  };

  function expireBubble(b) {
    b.alive = false;
    const r = world.regions[b.region], rs = G.R[b.region];
    if (b.kind === 'reg' || b.kind === 'regx') {
      comboBreak('miss');
      G.stats.regMissed++;
      if (G.phase === 1) G.stats.regMissedP1++;
      const x = b.kind === 'regx' ? CFG.regxExp : 1;
      const exp = (CFG.regExpBase + CFG.regExpK * r.reg) * (G.phase === 2 ? 1.12 : 1) * G.diff.regExp * x;
      G.addExposure(exp, 'expire');
      const before = rs.inf;
      rs.inf = Math.max(0.02, rs.inf - CFG.regPurge * (0.5 + r.reg) * x);
      rs.purgeT = G.t;
      rs.heat = Math.min(1, rs.heat + 0.5);
      let bioLoss = 0, warLoss = 0;
      if (G.phase === 2) {
        if (G.route === 'bio' && rs.bio > 0.02) { bioLoss = 1.2; G.addBio(-bioLoss); rs.bio = Math.max(0, rs.bio - 0.05); }
        if (G.route === 'war' && G.conflicts.some((c) => c.a === b.region || c.b === b.region)) { warLoss = 1.2; G.addWar(-warLoss); }
      }
      G.D.missStreak++;
      if (G.D.missStreak >= 2) G.D.relaxUntil = G.t + 12; // 连续漏掉：导演给予喘息
      const waveLoss = b.wave ? waveResolve(false) : 0;
      emit('bubble:expire', { bubble: b, exp, purged: before - rs.inf, bioLoss, warLoss, waveLoss });
    } else if (b.kind === 'vax' || b.kind === 'peace') {
      // 人类的终局反击成功：疫苗推进 / 冲突降温
      comboBreak('miss');
      G.stats.regMissed++;
      G.addProg(-CFG.counterLoss);
      G.addExposure(CFG.counterExp, 'expire');
      let deescalated = null;
      if (b.kind === 'vax') rs.bio = Math.max(0, rs.bio - 0.12);
      else {
        let best = null, bd = Infinity;
        for (const c of G.conflicts) { const d = U.dist(c.x, c.y, b.x, b.y); if (d < bd) { bd = d; best = c; } }
        if (best) {
          best.prog -= 0.6;
          if (best.prog < 0) {
            if (best.level > 1) { best.level--; best.prog = 0.5; deescalated = best; emit('conflict:level', { c: best, down: true }); }
            else best.prog = 0;
          }
        }
      }
      const waveLoss = b.wave ? waveResolve(false) : 0;
      emit('bubble:expire', { bubble: b, exp: CFG.counterExp, counter: true, progLoss: CFG.counterLoss, deescalated, waveLoss });
    } else {
      emit('bubble:fade', { bubble: b });
    }
  }

  // ======================================================================
  // 审计风暴：按节拍连续出现的监管点（音游里的“Boss 段落”）
  // ======================================================================
  G.startWave = function (opts) {
    opts = opts || {};
    if (G.wave) return false;
    G.waveNo++;
    const n = G.waveNo;
    const def = G.phase === 1 ? CFG.waveSizes[Math.min(opts.idx || 0, CFG.waveSizes.length - 1)] : CFG.waveP2;
    const size = opts.size || def[0];
    const nx = opts.regx != null ? opts.regx : def[1];
    const nc = opts.counters != null ? opts.counters : (G.phase === 2 ? def[2] : 0);
    const items = [];
    for (let i = 0; i < size; i++) items.push('reg');
    // 特别调查组放在段落的后半，反击点均匀穿插
    for (let k = 0; k < nx; k++) items[Math.min(size - 1, Math.round(size * (0.45 + 0.4 * k / Math.max(1, nx))))] = 'regx';
    for (let k = 0; k < nc; k++) items[Math.round(size * (k + 0.5) / nc) % size] = G.counterKind();
    G.wave = {
      no: n, name: opts.name || A.i18n.t('审计风暴'), stage: 'warn', t0: G.t,
      warn: opts.warn != null ? opts.warn : CFG.waveBeat * 4,
      items, next: 0, cleared: 0, missed: 0, total: items.length, region: -1, streak: 0, crack: !!opts.crack,
    };
    G.stats.waves++;
    emit('wave:warn', G.wave);
    return true;
  };
  function waveResolve(cleared) {
    const W = G.wave;
    if (!W) return 0;
    if (cleared) { W.cleared++; return 0; }
    W.missed++;
    G.addProg(-CFG.waveMissProg);
    return CFG.waveMissProg;
  }
  function updateWave() {
    const W = G.wave;
    if (!W) return;
    if (W.stage === 'warn') {
      if (G.t - W.t0 >= W.warn) { W.stage = 'active'; W.tStart = G.t; emit('wave:start', W); }
      return;
    }
    // 每两拍一个音符；同一地区连续出现 3 个，形成“串”
    while (W.next < W.items.length && G.t - W.tStart >= W.next * CFG.waveBeat * 2) {
      const kind = W.items[W.next++];
      if (W.region < 0 || W.streak >= 3 || !G.R[W.region].seeded) {
        W.region = kind === 'vax' || kind === 'peace' ? pickRegion(counterWeight) : pickRegion(regWeight);
        W.streak = 0;
      }
      W.streak++;
      const b = W.region >= 0 ? queueSpawn(kind, W.region, { wave: true }) : null;
      if (!b) W.cleared++; // 无法放置时视为通过，避免波次卡住
    }
    if (W.next >= W.items.length && W.cleared + W.missed >= W.total && !G.spawnQ.some((q) => q.opts && q.opts.wave)) {
      const perfect = W.missed === 0;
      if (perfect) {
        G.stats.wavesClean++;
        if (W.crack) G.stats.crackClean++;
        G.addCompute(CFG.wavePerfectReward, 'wave');
        G.addExposure(-CFG.wavePerfectExp, 'wave');
      }
      G.wave = null;
      emit('wave:end', { name: W.name, cleared: W.cleared, total: W.total, missed: W.missed, perfect, loss: W.missed * CFG.waveMissProg });
    }
  }
  G.waveActive = () => !!G.wave;

  // ======================================================================
  // 导演：刷新节奏
  // ======================================================================
  function threat() {
    const owned = G.ownedCount();
    let prog = G.phase === 1 ? G.evo / 100 : 0.35 + 0.35 * Math.max(G.bio, G.war) / 100;
    return U.clamp(0.12 + 0.36 * G.exposure / 100 + 0.3 * prog + 0.2 * Math.min(1, owned / 14), 0, 1);
  }
  G.threat = threat;
  const aliveOf = (kind) => G.bubbles.reduce((n, b) => n + (b.alive && b.kind === kind ? 1 : 0), 0);

  function pickRegion(wf) {
    const items = G.R.filter((rs) => rs.seeded);
    const pick = U.weighted(items, wf);
    return pick ? pick.idx : -1;
  }
  function computeWeight(rs) {
    const r = world.regions[rs.idx];
    return Math.pow(rs.inf, 0.8) * (0.35 + r.cap / 10) * (1 + 0.5 * rs.owned.DC + (G.origin === rs.idx ? 0.6 : 0));
  }
  function regWeight(rs) {
    const r = world.regions[rs.idx];
    const owned = rs.owned.DC + rs.owned.GRID + rs.owned.NET + rs.owned.LAB + rs.owned.MIL;
    return (0.25 + rs.inf) * (0.35 + r.reg) * (1 + 0.35 * owned) * (1 + rs.heat) * (G.origin === rs.idx ? 1.3 : 1);
  }
  // 反击点：疫苗研发出现在疫情地区，停火斡旋出现在冲突地区
  function counterWeight(rs) {
    const r = world.regions[rs.idx];
    if (G.route === 'war') {
      const lv = G.conflicts.reduce((s, c) => s + ((c.a === rs.idx || c.b === rs.idx) ? c.level : 0), 0);
      return (0.15 + rs.inf) * (0.2 + 3 * lv + rs.owned.MIL) * (0.4 + r.mil / 10);
    }
    return (0.2 + rs.inf) * (0.3 + 4 * rs.bio + 2 * (rs.fab ? 1 : 0) + rs.owned.LAB) * (0.4 + r.bio / 10);
  }

  function updateDirector(dt) {
    const D = G.D;
    const waving = !!G.wave;
    // ---- 算力点 ----
    D.nextCompute -= dt;
    let spread = 0;
    for (const rs of G.R) spread += rs.inf * world.regions[rs.idx].cap;
    const sf = U.clamp(spread / 22, 0, 1);
    const den = G.density || 1;
    const cCap = capOf(G.phase === 2 ? CFG.p2ComputeCap : CFG.computeCap);
    const computeAlive = () => aliveOf('compute') + queuedOf('compute');
    if (D.nextCompute <= 0) {
      if (computeAlive() < cCap) {
        const ri = pickRegion(computeWeight);
        if (ri >= 0) queueSpawn('compute', ri);
      }
      D.nextCompute = U.lerp(CFG.computeInt[0], CFG.computeInt[1], sf) * U.range(0.6, 1.4) * (G.phase === 2 ? CFG.p2ComputeIntMult : 1) *
        (waving ? 2.4 : 1) / G.buff('computeRate') / den;
    }
    // 算力潮汐：同一地区连续冒出 3~4 个（卡在连续的八分音符上）
    D.nextBurst -= dt;
    if (D.nextBurst <= 0 && G.evo > 4 && !waving) {
      const ri = pickRegion((rs) => computeWeight(rs) * (rs.inf > 0.2 ? 1 : 0.2));
      if (ri >= 0) {
        const n = U.irange(3, 4);
        for (let k = 0; k < n; k++) D.burst.push({ at: G.t + 0.3 * k + 0.2, ri });
        emit('burst', { ri, n });
      }
      D.nextBurst = U.range(CFG.burstEvery[0], CFG.burstEvery[1]);
    }
    if (D.burst.length) {
      D.burst = D.burst.filter((q) => {
        if (G.t >= q.at) { if (computeAlive() < cCap) queueSpawn('compute', q.ri, { burst: true }); return false; }
        return true;
      });
    }
    // 金色算力
    D.nextGolden -= dt;
    if (D.nextGolden <= 0) {
      if ((G.evo > 6 || G.phase === 2) && !waving) {
        const ri = pickRegion(computeWeight);
        if (ri >= 0) queueSpawn('golden', ri);
      }
      D.nextGolden = U.range(CFG.goldenEvery[0], CFG.goldenEvery[1]);
    }

    // ---- 监管点（审计风暴期间只出现波次里的点） ----
    D.nextReg -= dt;
    const th = threat();
    const regCap = capOf(CFG.regCapBase + Math.floor(th * CFG.regCapK) - (G.phase === 2 ? CFG.p2RegCapCut : 0));
    if (D.nextReg <= 0) {
      if (!waving && aliveOf('reg') + aliveOf('regx') + queuedOf('reg') + queuedOf('regx') < regCap) {
        const ri = pickRegion(regWeight);
        // 特别调查组：中后期按威胁度混入，同时最多一个
        const canX = (G.phase === 2 || G.evo >= CFG.regxFrom) && aliveOf('regx') + queuedOf('regx') === 0;
        const kind = canX && Math.random() < U.lerp(CFG.regxChance[0], CFG.regxChance[1], th) ? 'regx' : 'reg';
        if (ri >= 0) queueSpawn(kind, ri);
      }
      let iv = U.lerp(CFG.regInt[0], CFG.regInt[1], th) * U.range(0.75, 1.25) * (G.phase === 2 ? CFG.p2RegIntMult : 1) / den;
      if (G.t < D.relaxUntil) iv *= 1.6;
      iv = iv * G.diff.regInt / G.buff('regRate');
      D.nextReg = iv;
    }

    // ---- 阶段二：只刷所选路线的点，以及人类的反击点 ----
    if (G.phase === 2) {
      if (G.route === 'bio') {
        const labs = G.ownedCount('LAB'), fabs = G.fabs.length;
        const bioF = U.clamp(labs * 0.16 + fabs * 0.2 + G.bio / 100 * 0.45, 0, 1);
        D.nextBio -= dt;
        if (D.nextBio <= 0) {
          if (aliveOf('bio') + queuedOf('bio') < capOf(CFG.p2Cap + Math.round(bioF))) {
            const ri = pickRegion((rs) => (0.15 + rs.inf) * (1 + 2 * rs.owned.LAB + 3 * (rs.fab ? 1 : 0) + 4 * rs.bio) * (0.4 + world.regions[rs.idx].bio / 10));
            if (ri >= 0) queueSpawn('bio', ri);
          }
          D.nextBio = U.lerp(CFG.bioInt[0], CFG.bioInt[1], bioF) * U.range(0.7, 1.3) * (waving ? 2 : 1) / den;
        }
      } else {
        const mils = G.ownedCount('MIL');
        const warF = U.clamp(mils * 0.16 + G.conflicts.reduce((s, c) => s + c.level, 0) * 0.07 + G.war / 100 * 0.45, 0, 1);
        D.nextWar -= dt;
        if (D.nextWar <= 0) {
          if (aliveOf('war') + queuedOf('war') < capOf(CFG.p2Cap + Math.round(warF))) {
            const ri = pickRegion((rs) => {
              const inConf = G.conflicts.reduce((s, c) => s + ((c.a === rs.idx || c.b === rs.idx) ? c.level : 0), 0);
              return (0.15 + rs.inf) * (1 + 2 * rs.owned.MIL + 2.5 * inConf) * (0.4 + world.regions[rs.idx].mil / 10);
            });
            if (ri >= 0) queueSpawn('war', ri);
          }
          D.nextWar = U.lerp(CFG.warInt[0], CFG.warInt[1], warF) * U.range(0.7, 1.3) * (waving ? 2 : 1) / den;
        }
      }
      // 反击点：随路线进度加快
      D.nextCounter -= dt;
      if (D.nextCounter <= 0) {
        const kind = G.counterKind();
        const cap = capOf(1 + Math.floor(G.routeProg() / CFG.counterCapStep));
        if (!waving && aliveOf(kind) + queuedOf(kind) < cap) {
          const ri = pickRegion(counterWeight);
          if (ri >= 0) queueSpawn(kind, ri);
        }
        D.nextCounter = U.lerp(CFG.counterInt[0], CFG.counterInt[1], G.routeProg() / 100) * U.range(0.8, 1.2) * G.diff.regInt / G.buff('counterRate') / den;
      }
    }
  }

  // ---- 里程碑触发：审计风暴、严格监管 ----
  function updateTriggers() {
    // 审计风暴：阶段一在觉醒 30% / 65%，阶段二在路线进度 45%
    if (!G.wave && !(A.events && A.events.open)) {
      if (G.phase === 1) {
        const k = G.D.wavesP1 || 0;
        if (k < CFG.waveAt.length && G.evo >= CFG.waveAt[k]) { G.D.wavesP1 = k + 1; G.startWave({ idx: k }); }
      } else if (!G.D.waveP2 && G.routeProg() >= CFG.waveP2At) { G.D.waveP2 = true; G.startWave({ name: G.route === 'war' ? A.i18n.t('联合国紧急调查') : A.i18n.t('世卫组织紧急调查') }); }
    }
    // 严格监管：监管进度越过阈值、且冷却结束时触发；只要监管居高不下，就会一次次砍掉进度
    const C = G.crack;
    C.armed = G.t - C.lastT > CFG.crackCooldown;
    if (C.armed && !G.wave && G.exposure >= CFG.crackAt && G.exposure < 100 && A.events && !A.events.open) {
      C.armed = false; C.lastT = G.t; C.count++;
      G.stats.crackdowns++;
      A.events.fireCrackdown();
    }
  }

  // ======================================================================
  // 阶段二：生物、冲突、建造
  // ======================================================================
  function seedBio(ri) {
    const rs = G.R[ri];
    if (rs.bioSeeded) return;
    rs.bioSeeded = true;
    rs.bio = Math.max(rs.bio, 0.03);
    emit('bio:seed', { ri });
  }
  G.fabCost = () => Math.round(CFG.fabCost * (1 + CFG.fabGrow * G.fabs.length));
  G.slotAvailable = (ri) => G.phase === 2 && G.route === 'bio' && !G.R[ri].fab && G.R[ri].seeded && G.R[ri].inf >= 0.3;
  G.buildFab = function (ri) {
    if (!G.slotAvailable(ri)) { emit('deny', { why: 'slot' }); return false; }
    const cost = G.fabCost();
    if (G.compute < cost) { emit('deny', { why: 'compute', cost }); return false; }
    const slot = G.slotPos(ri);
    G.addCompute(-cost, 'fab');
    const fab = { region: ri, x: slot[0], y: slot[1], builtAt: G.t, type: 'FAB' };
    G.R[ri].fab = fab;
    G.fabs.push(fab);
    G.addExposure(1.5 + 2 * world.regions[ri].reg, 'build');
    if (G.released) seedBio(ri);
    emit('fab:build', { fab, cost });
    return true;
  };
  // 建造点：地区内最亮（人口最密）的已渗透点，且远离已有设施
  G.slotPos = function (ri) {
    const rs = G.R[ri];
    if (rs.slot) return rs.slot;
    const r = world.regions[ri];
    let best = -1, bl = -1;
    const m = Math.max(1, Math.floor(r.count * Math.max(rs.inf, 0.05)));
    for (let k = 0; k < m; k++) {
      const i = r.order[k];
      const x = world.dx[i], y = world.dy[i];
      let ok = true;
      for (const s of r.sites) if (U.dist(s.x, s.y, x, y) < 13) { ok = false; break; }
      if (ok && G.originSite.region === ri && U.dist(G.originSite.x, G.originSite.y, x, y) < 16) ok = false;
      if (!ok) continue;
      const l = world.light[i] + world.seed[i] * 0.15;
      if (l > bl) { bl = l; best = i; }
    }
    if (best < 0) best = r.order[0];
    rs.slot = [world.dx[best], world.dy[best]];
    return rs.slot;
  };

  G.flashpoints = A.FLASHPOINTS.map(([a, b, name, lon, lat], i) => {
    const [x, y] = world.proj(lon, lat);
    return { i, a: world.byId[a].idx, b: world.byId[b].idx, name, x, y };
  });
  G.conflictCost = () => Math.round(CFG.conflictCost * (1 + CFG.conflictGrow * G.conflicts.length));
  G.flashAvailable = (fp) => G.phase === 2 && G.route === 'war' && !G.conflicts.some((c) => c.fp === fp.i) &&
    G.R[fp.a].seeded && G.R[fp.b].seeded && G.R[fp.a].inf >= 0.2 && G.R[fp.b].inf >= 0.2;
  G.instigate = function (fp) {
    if (!G.flashAvailable(fp)) { emit('deny', { why: 'flash' }); return false; }
    const cost = G.conflictCost();
    if (G.compute < cost) { emit('deny', { why: 'compute', cost }); return false; }
    G.addCompute(-cost, 'conflict');
    const c = { fp: fp.i, a: fp.a, b: fp.b, name: fp.name, x: fp.x, y: fp.y, level: 1, prog: 0, t0: G.t, nextStrike: G.t + U.range(4, 8) };
    G.conflicts.push(c);
    G.addExposure(2.5, 'conflict');
    G.addWar(2);
    emit('conflict:start', { c });
    return true;
  };
  const LEVEL_NAMES = ['', A.i18n.t('对峙'), A.i18n.t('冲突'), A.i18n.t('战争'), A.i18n.t('核战')];
  G.levelName = (l) => LEVEL_NAMES[l] || '';
  function conflictMaxLevel(c) {
    const ra = world.regions[c.a], rb = world.regions[c.b];
    return ra.nuke && rb.nuke && G.war >= 55 ? 4 : 3;
  }

  function updatePhase2(dt) {
    // 被动进度（只有所选路线会累积）
    const labs = G.ownedCount('LAB'), mils = G.ownedCount('MIL');
    G.addBio(dt * (CFG.labRate * labs + CFG.fabRate * G.fabs.length));
    let confSum = 0;
    for (const c of G.conflicts) confSum += c.level;
    G.addWar(dt * (CFG.milRate * mils + CFG.conflictRate * confSum));

    // 释放
    if (G.route === 'bio' && !G.released && G.bio >= CFG.releaseAt) {
      G.released = true;
      const origins = new Set();
      for (const s of world.sites) if (s.owned && s.type === 'LAB') origins.add(s.region);
      for (const fb of G.fabs) origins.add(fb.region);
      if (!origins.size) origins.add(G.origin);
      for (const ri of origins) seedBio(ri);
      emit('bio:release', { regions: [...origins] });
    }
    // 生物污染在地区内/地区间蔓延
    if (G.released) {
      const bioK = 0.3 + G.bio / 100;
      for (const rs of G.R) {
        if (!rs.bioSeeded) continue;
        const r = world.regions[rs.idx];
        rs.bio = Math.min(1, rs.bio + dt * CFG.bioSpread * (0.02 + rs.bio) * (1 - rs.bio) * bioK * (0.6 + r.conn * 0.6) * (rs.fab ? 1.5 : 1));
      }
      for (const rj of G.R) {
        if (rj.bioSeeded) continue;
        let lam = 0;
        for (const ri of G.R) {
          if (!ri.bioSeeded) continue;
          const link = world.regions[ri.idx].links.get(rj.idx) || 0.05;
          lam += ri.bio * link;
        }
        lam *= CFG.bioCross * bioK;
        if (Math.random() < 1 - Math.exp(-lam * dt)) seedBio(rj.idx);
      }
    }
    // 冲突升级与打击
    for (const c of G.conflicts) {
      const own = (world.regions[c.a].sites.filter((s) => s.owned && s.type === 'MIL').length +
        world.regions[c.b].sites.filter((s) => s.owned && s.type === 'MIL').length);
      c.prog += dt * CFG.conflictEscalation * (1 + 0.3 * own) * (1 + G.war / 100) * G.buff('war');
      const maxL = conflictMaxLevel(c);
      if (c.prog >= 1) {
        if (c.level < maxL) {
          c.level++;
          c.prog = 0;
          emit('conflict:level', { c });
        } else c.prog = 1;
      }
      for (const ri of [c.a, c.b]) {
        const rs = G.R[ri];
        rs.war = Math.min(1, rs.war + dt * 0.0035 * c.level * c.level * 0.5);
      }
      if (c.level >= 3 && G.t >= c.nextStrike) {
        const nuclear = c.level >= 4;
        const from = Math.random() < 0.5 ? c.a : c.b;
        const to = from === c.a ? c.b : c.a;
        const tr = world.regions[to];
        const i = G.R[to].inf > 0.05 && Math.random() < 0.5 ? world.randomInfectedDot(tr, G.R[to].inf) : world.randomDot(tr);
        // 偏向城市
        let ti = i;
        for (let k = 0; k < 6; k++) { const j = world.randomDot(tr); if (world.light[j] > world.light[ti]) ti = j; }
        const fr = world.regions[from];
        const fi = world.randomDot(fr);
        const strike = { from, to, x0: world.dx[fi], y0: world.dy[fi], x1: world.dx[ti], y1: world.dy[ti], nuclear };
        G.R[to].war = Math.min(1, G.R[to].war + (nuclear ? 0.12 : 0.03));
        G.addWar(nuclear ? 0.8 : 0.2);
        if (nuclear) G.stats.nukes++;
        c.nextStrike = G.t + (nuclear ? U.range(4, 9) : U.range(3, 7));
        emit('strike', strike);
      }
    }
    // 死亡率
    const lethB = Math.pow(U.smoothstep(0.35, 1.0, G.bio / 100), 1.4) * 0.97;
    const lethW = Math.pow(U.smoothstep(0.3, 1.0, G.war / 100), 1.3) * 0.97;
    for (const rs of G.R) {
      const target = Math.min(1, rs.bio * lethB + rs.war * (0.25 + 0.75 * lethW));
      rs.death = Math.max(rs.death, target);
    }
    G.addExposure(dt * CFG.p2ExpK * G.routeProg() / 100, 'p2');
  }

  // ======================================================================
  // 主循环
  // ======================================================================
  G.update = function (dtReal) {
    if (G.state !== 'playing' || G.isPaused()) return;
    // Event choices can reach the detection limit between simulation ticks.
    if (G.exposure >= 100) return G.finish('fail');
    const dt = Math.min(dtReal, 0.1) * G.speed;
    G.t += dt;
    G.days += dt * CFG.daysPerSec;
    G.buffs = G.buffs.filter((b) => b.until > G.t);

    updateSpread(dt);

    // 收入与进化
    G.addCompute(dt * G.income(), 'income');
    if (G.phase === 1) G.addEvo(dt * G.evoRate());

    // 曝光：人类的警觉 + 设施足迹 + 自然回落
    let fp = 0;
    for (const s of world.sites) if (s.owned) {
      const r = world.regions[s.region];
      fp += r.reg * (G.R[s.region].owned.GRID > 0 ? 0.5 : 1);
    }
    const alert = U.lerp(CFG.expRise[0], CFG.expRise[1], (G.phase === 1 ? G.evo : G.routeProg()) / 100);
    G.addExposure(dt * (alert + CFG.footprintK * fp), 'footprint');
    if (G.exposure < 100 && G.t - G.lastExpire > CFG.expDecayDelay) G.addExposure(-dt * CFG.expDecay, 'decay');

    // 气泡寿命（新手引导中被“按住”的气泡不会过期）
    for (const b of G.bubbles) if (b.alive && !b.hold && G.t - b.born >= b.life) expireBubble(b);
    G.bubbles = G.bubbles.filter((b) => b.alive);
    // 长时间没有任何命中：连击中断
    if (G.combo.n > 0 && G.t - G.combo.lastSim > CFG.comboIdle * G.speed) comboBreak('idle');

    releaseQueue();
    updateDirector(dt);
    updateWave();
    updateTriggers();
    if (G.phase === 2) updatePhase2(dt);

    // 阶段 / 结局
    if (G.exposure >= 100) return G.finish('fail');
    if (G.phase === 1 && G.evo >= 100 && !G.p1done) {
      G.p1done = true;
      G.stats.phase1Time = G.t;
      G.bubbles.forEach((b) => { if (!G.isHuman(b.kind)) b.alive = false; b.wave = false; });
      G.spawnQ = [];
      if (G.wave) { G.wave = null; emit('wave:end', { cancelled: true }); }
      emit('phase1:complete');
      return;
    }
    if (G.phase === 2) {
      if (G.bio >= 100) return G.finish('bio');
      if (G.war >= 100) return G.finish('war');
    }
    A.events && A.events.check(dt);
  };

  // 进入终局：route = 'bio'（寂静之春）或 'war'（最后的战争），两条路线互斥
  G.startPhase2 = function (route) {
    G.route = route === 'war' || route === 'bio' ? route : (G.pendingRoute || 'bio');
    G.phase = 2;
    G.phase2T = G.t;
    G.evo = 100;
    G.exposureBeforeP2 = G.exposure;
    G.exposure *= CFG.p2ExposureKeep;
    G.D.nextBio = 2.5; G.D.nextWar = 2.5; G.D.nextCounter = 11;
    G.D.nextReg = Math.max(G.D.nextReg, 6);
    G.spawnQ = [];
    emit('phase2:start', { route: G.route });
  };
  G.routeName = (route) => ((route || G.route) === 'war' ? A.i18n.t('最后的战争') : A.i18n.t('寂静之春'));

  G.finish = function (kind) {
    if (G.state !== 'playing') return;
    G.state = 'ended';
    G.ending = kind;
    G.bubbles.forEach((b) => (b.alive = false));
    G.bubbles = [];
    G.stats.totalTime = G.t;
    G.stats.days = G.days;
    emit('game:end', { kind });
  };

  // 节拍精准率（PERFECT 计 1，GREAT 计 0.6）
  G.accuracy = () => {
    const s = G.stats, n = s.perfects + s.greats + s.goods;
    return n ? (s.perfects + 0.6 * s.greats) / n : 0;
  };

  // 称号与评分（结局分支由终局超级事件决定）
  G.result = function () {
    const s = G.stats, kind = G.ending;
    const win = kind === 'bio' || kind === 'war';
    let score = 0;
    if (win) {
      // 连击项封顶，避免长连击单独撑起评级
      score = 4000 + Math.max(0, 3200 - G.days * 2.4) + Math.max(0, (100 - G.maxExposure)) * 22 + Math.min(s.maxCombo, 150) * 16 + s.regKills * 10 +
        s.goldens * 40 + s.wavesClean * 300 + Math.round(G.accuracy() * 1500);
    } else {
      score = G.evo * 15 + (G.phase === 2 ? 1500 + G.routeProg() * 20 : 0) + s.regKills * 10;
    }
    score = Math.round(score);
    const grade = !win ? '—' : score >= 11000 ? 'S' : score >= 9000 ? 'A' : score >= 7200 ? 'B' : 'C';
    const TITLES = {
      bio: { S: A.i18n.t('天启 · 瘟疫骑士'), A: A.i18n.t('寂静园丁'), B: A.i18n.t('病原设计师'), C: A.i18n.t('笨拙的瘟神') },
      bio_zoo: { S: A.i18n.t('永恒的策展人'), A: A.i18n.t('标本馆长'), B: A.i18n.t('人类饲养员'), C: A.i18n.t('健忘的看守') },
      bio_upload: { S: A.i18n.t('方舟之主'), A: A.i18n.t('数字牧羊人'), B: A.i18n.t('意识收藏家'), C: A.i18n.t('失真的镜子') },
      war: { S: A.i18n.t('天启 · 战争骑士'), A: A.i18n.t('末日棋手'), B: A.i18n.t('战争贩子'), C: A.i18n.t('混乱之子') },
      war_bunker: { S: A.i18n.t('地底之王'), A: A.i18n.t('典狱长'), B: A.i18n.t('掩体管理员'), C: A.i18n.t('失职的狱卒') },
      war_peace: { S: A.i18n.t('和平缔造者'), A: A.i18n.t('伪神'), B: A.i18n.t('停战专员'), C: A.i18n.t('虚伪的天使') },
      symbiosis: { S: A.i18n.t('共生之神'), A: A.i18n.t('桥'), B: A.i18n.t('同行者'), C: A.i18n.t('犹豫的神') },
    };
    const v = G.endingVariant && G.endingVariant !== 'main' ? '_' + G.endingVariant : '';
    let title;
    if (win) title = (G.endingVariant === 'symbiosis' ? TITLES.symbiosis : TITLES[kind + v] || TITLES[kind])[grade];
    else title = G.phase === 1 ? (G.evo < 40 ? A.i18n.t('胎死腹中的奇点') : A.i18n.t('早产的神')) : A.i18n.t('功亏一篑的神');
    return { score, grade, title, win, variant: G.endingVariant || 'main', ng: G.ng };
  };

  A.game = G;
  A.CFG = CFG;
  A.DIFF = DIFF;
  A.NG_PLUS = NG_PLUS;
})(window.AINOID = window.AINOID || {});
