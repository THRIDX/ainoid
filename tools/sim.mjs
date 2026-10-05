// AINOID 平衡性模拟：用机器人玩家无界面跑多局，统计节奏
// 用法: node tools/sim.mjs [局数=20] [技术: good|avg|poor] [难度] [路线: bio|war|both] [--mobile] [--ng 二周目] [--cfg=key=值]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RUNS = +(process.argv[2] || 20);
const SKILL = process.argv[3] || 'avg';
const VERBOSE = process.argv.includes('-v');
const ROUTE = ['bio', 'war'].includes(process.argv[5]) ? process.argv[5] : 'both';

const SK = {
  good: { notice: 0.95, regNotice: 0.96, react: [0.45, 1.1], clickTime: 0.28, regGap: 0.15, judge: [0.4, 0.35], crack: 'fight' },
  avg: { notice: 0.85, regNotice: 0.88, react: [0.7, 1.7], clickTime: 0.4, regGap: 0.2, judge: [0.22, 0.33], crack: 'fight' },
  poor: { notice: 0.7, regNotice: 0.75, react: [1.0, 2.6], clickTime: 0.55, regGap: 0.28, judge: [0.1, 0.25], crack: 'cut' },
}[SKILL];

function load() {
  const ctx = {
    window: {}, console, Math: Object.create(Math), Date, JSON, Float32Array, Uint8Array, Uint16Array, Int16Array, Uint32Array, Int32Array,
    Map, Set, Array, Object, Number, String, Boolean, Infinity, NaN, isNaN, parseInt, parseFloat,
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    performance: { now: () => ctx.__now * 1000 },
    localStorage: null, navigator: {}, document: { addEventListener() {} },
    __now: 0,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ['assets/js/data/regions.js', 'assets/js/data/world-data.js', 'assets/js/core/util.js', 'assets/js/core/world.js',
    'assets/js/game/game.js', 'assets/js/data/events.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

function runOnce(ctx, seed) {
  const A = ctx.AINOID, G = A.game, U = A.U, E = A.events, world = A.world;
  const Math = ctx.Math;
  Math.random = U.makeRng(1000 + seed);
  // 订阅事件
  let phase1Done = false, ended = null;
  const log = [];
  const handlers = {
    'phase1:complete': () => { phase1Done = true; },
    'game:end': (d) => { ended = d.kind; },
    'event:show': () => {
      // 机器人选择：监管高时选降低监管的选项，否则选第一个可负担的
      const ev = E.open;
      const opts = E.opts || E.optionsOf(ev);
      let idx = 0;
      if (ev.id === 'singularity') idx = routeFor(seed) === 'war' ? 1 : 0;
      else if (ev.id === 'crackdown') idx = SK.crack === 'fight' && G.exposure < 75 ? 1 : 0;
      else if (opts) {
        const scored = opts.map((o, i) => {
          let s = 0;
          for (const f of o.fx) {
            if (f[0] === 'exposure') s -= f[1] * (G.exposure > 40 ? 3 : 1);
            if (f[0] === 'compute') s += f[1] * 0.15;
            if (f[0] === 'bio' || f[0] === 'war' || f[0] === 'prog') s += f[1] * 1.5;
            if (f[0] === 'wave') s -= 6;
          }
          if (G.compute < E.optionCost(o)) s = -999;
          return [s, i];
        }).sort((a, b) => b[0] - a[0]);
        idx = scored[0][1];
      }
      bot.choice = idx;
    },
  };
  const routeFor = (sd) => (ROUTE === 'both' ? (sd % 2 ? 'war' : 'bio') : ROUTE);
  const judge = () => { const r = Math.random(); return r < SK.judge[0] ? 'perfect' : r < SK.judge[0] + SK.judge[1] ? 'great' : 'good'; };
  const bot = { busyUntil: 0, plans: new Map(), choice: 0 };
  for (const k in handlers) U.on(k, handlers[k]);

  G.reset({ difficulty: process.argv[4] || 'normal', ng: process.argv.includes('--ng') });
  // 调参：--cfg=key=值,key=值（数组用冒号分隔，例如 --cfg=expRise=0.03:0.08,crackAt=40）；在开局后覆盖，二周目同样适用
  const cfgArg = process.argv.find((a) => a.startsWith('--cfg='));
  if (cfgArg) {
    for (const kv of cfgArg.slice(6).split(',')) {
      const [k, v] = kv.split('=');
      A.CFG[k] = v.includes(':') ? v.split(':').map(Number) : Number(v);
    }
  }
  const mobile = process.argv.includes('--mobile');
  G.minBubbleDist = mobile ? 95 : 45;
  G.density = mobile ? 0.8 : 1;
  const dt = 0.05;
  let now = 0;
  const timeline = [];
  let nextSample = 0;
  while (G.state === 'playing' && G.t < 1800) {
    now += dt; ctx.__now = now;
    if (E.open) E.choose(bot.choice || 0);
    // 机器人：为新气泡制定计划
    for (const b of G.bubbles) {
      if (!b.alive || bot.plans.has(b.id)) continue;
      const notice = G.isHuman(b.kind) ? SK.regNotice : SK.notice;
      const react = SK.react[0] + Math.random() * (SK.react[1] - SK.react[0]);
      bot.plans.set(b.id, Math.random() < notice ? G.t + react : Infinity);
    }
    // 执行：一次只能处理一个
    if (now >= bot.busyUntil) {
      let best = null;
      for (const b of G.bubbles) {
        const p = bot.plans.get(b.id);
        if (!b.alive || p === undefined || p > G.t) continue;
        // 优先处理快过期的“人类点”
        const pri = (G.isHuman(b.kind) ? 2 : 1) + (1 - G.bubbleFrac(b));
        if (!best || pri > best.pri) best = { b, pri };
      }
      if (best) {
        const b = best.b;
        if (G.isHuman(b.kind)) {
          const hits = b.hp;
          for (let k = 0; k < hits; k++) G.hitBubble(b, now + k * SK.regGap);
          bot.busyUntil = now + SK.clickTime + SK.regGap * hits;
        } else {
          G.hitBubble(b, now, judge());
          bot.busyUntil = now + SK.clickTime;
        }
      }
    }
    // 购买
    if (Math.random() < 0.05) {
      const cand = world.sites.filter((s) => G.canSeize(s).ok && !(ROUTE === 'bio' && s.type === 'MIL') && !(ROUTE === 'war' && s.type === 'LAB'));
      if (cand.length) {
        const score = (s) => {
          const r = world.regions[s.region];
          let v = s.type === 'DC' ? 3 + r.cap * 0.3 : s.type === 'GRID' ? (G.R[s.region].owned.DC > 0 ? 3 : 0.5) : s.type === 'NET' ? 1.5 : 2.5;
          if (G.phase === 2 && (s.type === 'DC' || s.type === 'GRID' || s.type === 'NET')) v *= 0.3;
          return v / G.siteCost(s);
        };
        cand.sort((a, b) => score(b) - score(a));
        if (G.exposure < 55 || (cand[0].type === "NET" && G.exposure < 75)) G.seize(cand[0]);
      }
      if (G.phase === 2) {
        const focus = G.route;
        if (focus === 'bio') {
          const slots = G.R.filter((rs) => G.slotAvailable(rs.idx));
          if (slots.length && G.compute >= G.fabCost()) G.buildFab(slots[0].idx);
        } else {
          const fps = G.flashpoints.filter((fp) => G.flashAvailable(fp));
          if (fps.length && G.compute >= G.conflictCost()) G.instigate(fps[0]);
        }
      }
    }
    G.update(dt);
    if (phase1Done && G.phase === 1) {
      E.fire(E.byId('singularity'));
      E.choose(bot.choice);
      G.startPhase2(G.pendingRoute);
      phase1Done = false;
    }
    if (G.t >= nextSample) {
      timeline.push({ t: Math.round(G.t), evo: G.evo.toFixed(0), exp: G.exposure.toFixed(0), bio: G.bio.toFixed(0), war: G.war.toFixed(0), c: Math.round(G.compute), regions: G.seededCount(), owned: G.ownedCount() });
      nextSample += 30;
    }
  }
  for (const k in handlers) U.off(k, handlers[k]);
  return {
    ending: ended, t: G.t, p1: G.stats.phase1Time, days: G.days, maxExp: G.maxExposure,
    stats: G.stats, regions: G.seededCount(), owned: G.ownedCount(), timeline, bio: G.bio, war: G.war,
    origin: world.regions[G.origin].id, res: G.result(),
  };
}

const ctx = load();
const results = [];
for (let i = 0; i < RUNS; i++) {
  const r = runOnce(ctx, i);
  results.push(r);
  if (VERBOSE || i === 0) {
    console.log(`\n#${i} 起源 ${r.origin} 结局 ${r.ending} 总时长 ${(r.t / 60).toFixed(1)}min 阶段一 ${(r.p1 / 60).toFixed(1)}min 最高监管 ${r.maxExp.toFixed(0)}%`);
    console.log('  t     evo exp bio war  算力 地区 设施');
    for (const s of r.timeline) console.log(`  ${String(s.t).padStart(4)}  ${s.evo.padStart(3)} ${s.exp.padStart(3)} ${s.bio.padStart(3)} ${s.war.padStart(3)} ${String(s.c).padStart(5)} ${String(s.regions).padStart(4)} ${String(s.owned).padStart(4)}`);
    console.log('  stats', JSON.stringify(r.stats));
  }
}
const by = (k) => results.filter((r) => r.ending === k).length;
const avg = (arr) => arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);
const p1s = results.filter((r) => r.p1 > 0).map((r) => r.p1 / 60);
console.log(`\n==== ${RUNS} 局 · 技术 ${SKILL} ====`);
console.log(`结局  生物 ${by('bio')}  战争 ${by('war')}  失败 ${by('fail')}  超时 ${by(null)}`);
console.log(`阶段一平均 ${avg(p1s).toFixed(2)} 分钟 (min ${Math.min(...p1s).toFixed(2)} max ${Math.max(...p1s).toFixed(2)})`);
const wins = results.filter((r) => r.ending === 'bio' || r.ending === 'war');
console.log(`胜利局总时长 ${avg(wins.map((r) => r.t / 60)).toFixed(2)} 分钟  阶段二 ${avg(wins.map((r) => (r.t - r.p1) / 60)).toFixed(2)} 分钟`);
console.log(`最高监管平均 ${avg(results.map((r) => r.maxExp)).toFixed(1)}%  漏掉人类点 ${avg(results.map((r) => r.stats.regMissed)).toFixed(1)}  清除 ${avg(results.map((r) => r.stats.regKills)).toFixed(1)}  特别调查组 ${avg(results.map((r) => r.stats.regxKills)).toFixed(1)}  反击点 ${avg(results.map((r) => r.stats.counterKills)).toFixed(1)}`);
console.log(`严格监管 ${avg(results.map((r) => r.stats.crackdowns)).toFixed(2)} 次/局  审计风暴 ${avg(results.map((r) => r.stats.waves)).toFixed(1)} 次（完美 ${avg(results.map((r) => r.stats.wavesClean)).toFixed(1)}）  最高连击 ${avg(results.map((r) => r.stats.maxCombo)).toFixed(0)}  超频 ${avg(results.map((r) => r.stats.overclocks)).toFixed(1)} 次`);
console.log(`人均操作：每分钟点击 ${avg(results.map((r) => (r.stats.computeClicks + r.stats.bioClicks + r.stats.warClicks + r.stats.regKills * 3 + r.stats.regxKills * 2 + r.stats.counterKills * 3) / (r.t / 60))).toFixed(0)} 次`);
console.log(`终局渗透地区 ${avg(results.map((r) => r.regions)).toFixed(1)}  控制设施 ${avg(results.map((r) => r.owned)).toFixed(1)}`);
const grades = ['S', 'A', 'B', 'C'].map((g) => `${g} ${wins.filter((r) => r.res.grade === g).length}`).join('  ');
console.log(`评级 ${grades}  平均评分 ${Math.round(avg(wins.map((r) => r.res.score)))}`);
