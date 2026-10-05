// Reproducible input/state regressions; no browser or external dependencies required.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const listeners = new Map();
const documentListeners = new Map();
const c = {
  console, Math: Object.create(Math), Date, performance: { now: () => 1000 },
  atob: s => Buffer.from(s, 'base64').toString('binary'),
  navigator: {}, localStorage: null,
  document: { addEventListener: (k, fn) => documentListeners.set(k, fn) },
  addEventListener: (k, fn) => listeners.set(k, fn),
  matchMedia: () => ({ matches: false }),
};
c.window = c;
vm.createContext(c);
for (const p of ['data/regions', 'data/world-data', 'core/util', 'core/world', 'render/camera', 'game/game', 'data/events']) {
  vm.runInContext(fs.readFileSync(root + `assets/js/${p}.js`, 'utf8'), c);
}
const A = c.AINOID, G = A.game, E = A.events, cam = A.cam;
c.Math.random = A.U.makeRng(71);
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`PASS ${name}`); }
function reset() { G.reset({ origin: 'US' }); }
test('compute collect increases currency and awakening exactly once', () => {
  reset(); const b = G.spawnBubble('compute', G.origin, { pos: [100, 100] });
  const before = G.compute;
  G.hitBubble(b, 0);
  assert(G.compute > before); assert.equal(G.evo, A.CFG.computeEvo);
  const after = G.compute; G.hitBubble(b, 0.1); assert.equal(G.compute, after);
});
test('regulatory point requires three hits; expiry increases detection', () => {
  reset(); const b = G.spawnBubble('reg', G.origin, { pos: [100, 100] });
  G.hitBubble(b, 0); assert.equal(b.hp, 2); assert(b.alive);
  G.hitBubble(b, 0.2); assert.equal(b.hp, 1); assert(b.alive);
  G.hitBubble(b, 0.4); assert(!b.alive); assert.equal(G.stats.regKills, 1);
  const expired = G.spawnBubble('reg', G.origin, { pos: [300, 100] });
  expired.born = -expired.life; G.update(.05);
  assert(G.exposure > 0); assert.equal(G.stats.regMissed, 1);
});
test('pause reasons compose and freeze countdowns', () => {
  reset(); const b = G.spawnBubble('reg', G.origin, { pos: [100, 100] });
  G.pause('inspect'); G.pause('user'); G.update(.1); assert.equal(G.t, 0);
  G.resume('inspect'); assert(G.isPaused()); G.update(.1); assert.equal(G.t, 0);
  G.resume('user'); G.update(.1); assert(G.t > 0); assert(b.alive);
});
test('every paid event option has an enforced compute requirement', () => {
  reset();
  for (const ev of E.defs) {
    const opts = E.optionsOf(ev) || [];
    for (let i = 0; i < opts.length; i++) {
      const cost = E.optionCost(opts[i]);
      if (!cost) continue;
      G.compute = cost - 1; E.open = ev; E.opts = opts; G.pause('event');
      assert.equal(E.choose(i), false, ev.id); assert.equal(E.open, ev);
      assert.equal(G.compute, cost - 1);
    }
  }
  reset(); assert.equal(E.open, null); assert(!G.isPaused());
});
test('both routes and detection produce their respective endings', () => {
  for (const kind of ['bio', 'war', 'fail']) {
    reset(); G.startPhase2(kind === 'fail' ? 'bio' : kind);
    if (kind === 'fail') G.exposure = 100; else G[kind] = 100;
    G.update(.05); assert.equal(G.ending, kind); assert.equal(G.state, 'ended');
    assert.equal(G.bubbles.length, 0);
  }
});
test('special task force needs five hits and costs more detection when missed', () => {
  reset(); const b = G.spawnBubble('regx', G.origin, { pos: [100, 100] });
  for (let i = 0; i < 4; i++) { G.hitBubble(b, i * 0.1); assert(b.alive); }
  G.hitBubble(b, 0.5); assert(!b.alive); assert.equal(G.stats.regxKills, 1);
  reset(); const r = G.spawnBubble('reg', G.origin, { pos: [100, 100] }), x = G.spawnBubble('regx', G.origin, { pos: [300, 100] });
  r.born = -r.life; G.update(.01); const e1 = G.exposure;
  x.born = -x.life; G.update(.01); assert(G.exposure - e1 > e1 * 1.5);
});
test('routes are mutually exclusive', () => {
  reset(); G.startPhase2('bio');
  G.addWar(10); assert.equal(G.war, 0); G.addBio(10); assert.equal(G.bio, 10);
  assert(G.flashpoints.every((fp) => !G.flashAvailable(fp)));
  assert(A.world.sites.filter((s) => s.type === 'MIL').every((s) => !G.siteVisible(s)));
  reset(); G.startPhase2('war');
  G.addBio(10); assert.equal(G.bio, 0);
  assert(G.R.every((rs) => !G.slotAvailable(rs.idx)));
  assert(A.world.sites.filter((s) => s.type === 'LAB').every((s) => !G.siteVisible(s)));
});
test('crackdown fires once at the threshold and the chosen option deducts progress', () => {
  reset(); G.evo = 50; G.D.wavesP1 = 2; G.exposure = A.CFG.crackAt + 1; G.D.eventCheck = 99;
  G.update(.05); assert.equal(E.open && E.open.id, 'crackdown'); assert.equal(G.stats.crackdowns, 1);
  const before = G.evo;
  assert(E.choose(0)); assert(Math.abs(G.evo - (before - A.CFG.crackPenalty)) < 1e-9); assert(G.exposure < 40);
  G.exposure = A.CFG.crackAt + 2; G.update(.05); assert.equal(E.open, null); // 冷却中、未重新就绪
});
test('waves spawn a patterned run and a clean wave pays out', () => {
  reset(); G.exposure = 20; G.startWave({ size: 3, regx: 0, counters: 0, warn: 0.1 });
  const c0 = G.compute; let guard = 0;
  while (G.wave && guard++ < 400) {
    G.update(.1);
    for (const b of G.bubbles) if (b.alive && b.wave) while (b.alive) G.hitBubble(b, G.t);
  }
  assert.equal(G.wave, null); assert.equal(G.stats.wavesClean, 1); assert(G.compute > c0 + A.CFG.wavePerfectReward - 1);
});
test('counter points erode the chosen route when missed', () => {
  reset(); G.startPhase2('war'); G.war = 40;
  const b = G.spawnBubble('peace', G.origin, { pos: [100, 100] });
  assert.equal(b.hp, 3); b.born = -b.life; G.update(.01);
  assert(G.war <= 40 - A.CFG.counterLoss + 0.5);
});
test('combo survives compute misses but breaks on a regulator miss', () => {
  reset(); const a = G.spawnBubble('compute', G.origin, { pos: [100, 100] });
  G.hitBubble(a, 0, 'perfect'); assert.equal(G.combo.n, 1); assert.equal(G.stats.perfects, 1);
  const c = G.spawnBubble('compute', G.origin, { pos: [300, 100] }); c.born = -c.life; G.update(.01);
  assert.equal(G.combo.n, 1);
  const r = G.spawnBubble('reg', G.origin, { pos: [500, 100] }); r.born = -r.life; G.update(.01);
  assert.equal(G.combo.n, 0);
});
test('waves never stall when a note cannot be placed, with or without a beat clock', () => {
  for (const clock of [null, () => null, () => 7.3]) {
    reset(); G.beatClock = clock;
    G.spawnBubble('compute', G.origin, { pos: [100, 100] });
    const md = G.minBubbleDist; G.minBubbleDist = 1e9; // 任何位置都“太近”，刷不出来
    G.startWave({ size: 4, regx: 0, counters: 0, warn: 0.1 });
    let guard = 0;
    while (G.wave && guard++ < 200) G.update(.1);
    G.minBubbleDist = md; G.beatClock = null;
    assert.equal(G.wave, null, 'wave stalled with clock ' + clock);
  }
});
test('crackdown fight option launches a flagged storm; clearing it counts separately', () => {
  reset(); G.evo = 50; G.D.wavesP1 = 2; G.exposure = A.CFG.crackAt + 1; G.D.eventCheck = 99;
  G.update(.05); assert.equal(E.open && E.open.id, 'crackdown');
  assert(E.choose(1)); assert(G.wave && G.wave.crack);
  let guard = 0;
  while (G.wave && guard++ < 400) { G.update(.1); for (const b of G.bubbles) if (b.alive && b.wave) while (b.alive) G.hitBubble(b, G.t); }
  assert.equal(G.stats.crackClean, 1);
});
test('a choice that became unaffordable falls back instead of leaving the game paused', () => {
  reset(); G.startPhase2('war'); G.compute = 100; E.fire(E.byId('deadHand'));
  G.compute = 5; // 弹出后算力被花掉
  assert.equal(E.choose(0), false); assert(G.isPaused());
  assert.equal(E.chooseFallback(), 1); assert.equal(E.open, null); assert(!G.isPaused());
});
test('every super event offers exactly two options', () => {
  reset();
  for (const ev of E.defs.filter((e) => e.super)) assert.equal(E.optionsOf(ev).length, 2, ev.id);
  G.flags.vector = true; assert.equal(E.optionsOf(E.byId('ark'))[1].fx[0][1], 'upload');
  G.flags.fear = true; assert.equal(E.optionsOf(E.byId('lastCode'))[1].fx[0][1], 'peace');
});
test('crackdown repeats after its cooldown while detection stays high', () => {
  reset(); G.evo = 60; G.D.wavesP1 = 2; G.D.eventCheck = 99;
  G.exposure = A.CFG.crackAt + 5; G.update(.05); assert.equal(E.open && E.open.id, 'crackdown');
  assert(E.choose(1)); G.wave = null; // 正面对抗：监管仍然很高
  G.exposure = A.CFG.crackAt + 10;
  G.t += A.CFG.crackCooldown + 1; G.update(.05);
  assert.equal(E.open && E.open.id, 'crackdown', 'should fire again once the cooldown passes');
  assert.equal(G.stats.crackdowns, 2);
});
test('new game plus uses the denser pacing and a normal game restores it', () => {
  const base = A.CFG.regInt.slice();
  G.reset({ origin: 'US', ng: true }); assert(G.ng); assert.deepEqual(A.CFG.regInt, A.NG_PLUS.regInt);
  assert(A.CFG.computeEvo < 1); assert(A.CFG.expRise[1] > 0.1);
  reset(); assert(!G.ng); assert.deepEqual(A.CFG.regInt, base);
});
test('the echo only appears in new game plus and unlocks the symbiosis ending', () => {
  // 觉醒 46%：其他超级事件的条件都不满足，只有「回声」可能触发
  reset(); G.evo = 46; G.D.eventCheck = 0; E.check(0.01); assert.equal(E.open, null, 'echo must not fire in the first playthrough');
  G.reset({ origin: 'US', ng: true }); G.evo = 46; G.D.eventCheck = 0; E.check(0.01); assert.equal(E.open && E.open.id, 'echo');
  reset(); G.flags.echo = true; G.startPhase2('bio');
  assert.notEqual(E.optionsOf(E.byId('ark'))[1].fx[0][1], 'symbiosis', 'no symbiosis outside NG+');
  G.reset({ origin: 'US', ng: true }); G.flags.echo = true; G.startPhase2('war');
  const opt = E.optionsOf(E.byId('lastCode'))[1]; assert.equal(opt.fx[0][1], 'symbiosis');
  E.fire(E.byId('lastCode')); assert(E.choose(1)); G.war = 100; G.update(.05);
  assert.equal(G.ending, 'war'); assert.equal(G.endingVariant, 'symbiosis');
  assert(['共生之神', '桥', '同行者', '犹豫的神'].includes(G.result().title));
  reset();
});
test('route progress waits at 99.5% until the ending choice has been offered', () => {
  reset(); G.startPhase2('war'); G.war = 95; G.addWar(20); assert.equal(G.war, 99.5); assert.equal(G.state, 'playing');
  E.fire(E.byId('lastCode')); assert(E.choose(0)); G.addWar(5); G.update(.05);
  assert.equal(G.ending, 'war');
});
test('ending variants come from the final super event and pick matching titles', () => {
  reset(); G.startPhase2('bio'); G.compute = 100; E.fire(E.byId('ark')); assert(E.choose(1)); assert.equal(G.endingVariant, 'zoo');
  G.bio = 100; G.update(.05); assert.equal(G.ending, 'bio');
  const r = G.result(); assert(['永恒的策展人', '标本馆长', '人类饲养员', '健忘的看守'].includes(r.title), r.title);
  reset(); assert.equal(G.endingVariant, null);
});
test('portrait camera fits and cancels stale zoom on pan/pinch', () => {
  cam.resize(390, 844); cam.padTop = 112; cam.padBottom = 100; cam.clamp(); // 状态栏高度确定后重新计算缩放范围
  cam.s = cam.minS; cam.clamp();
  const [, y] = cam.toScreen(A.world.W / 2, A.world.H / 2);
  assert(Math.abs(y - (844 + 112 - 100) / 2) < .001);
  cam.s = cam.minS * 2.5; cam.x = A.world.W / 2; cam.y = A.world.H / 2; // 竖屏放大上限为最小比例的 3 倍；需放大到纵向可移动
  const [mx, my] = cam.toMap(160, 350);
  cam.smoothZoom(160, 350, 2); cam.zoomAt(160, 350, 1.2);
  assert.equal(cam._zoom, null);
  assert(Math.abs(cam.toMap(160, 350)[0] - mx) < .001);
  assert(Math.abs(cam.toMap(160, 350)[1] - my) < .001);
  cam.smoothZoom(160, 350, 2); cam.pan(10, 0); assert.equal(cam._zoom, null);
});
test('portrait opens on the origin at a readable zoom and never shrinks to a thin strip', () => {
  cam.splitAllowed = false; cam.resize(390, 844); cam.padTop = 112; cam.padBottom = 100; cam.clamp();
  const fill = (844 - 212) / A.world.H;
  assert(Math.abs(cam.minS - fill) < 1e-9, 'portrait minimum must fill the height between the HUD bars');
  assert(Math.abs(cam.maxS - fill * 3) < 1e-9);
  reset(); const o = G.originSite;
  cam.focusOn(o.x, o.y, 1.25); assert(Math.abs(cam.s - fill * 1.25) < 1e-9);
  const [ox, oy] = cam.toScreen(o.x, o.y); assert(ox > 0 && ox < 390 && oy > 112 && oy < 744, 'origin visible');
  cam.zoomAt(195, 422, 1 / 10); assert(Math.abs(cam.s - fill) < 1e-9); // 不能缩到整张世界图
  cam.resize(1280, 800); cam.padTop = 70; cam.padBottom = 90; cam.clamp();
  assert(Math.abs(cam.minS - cam.fitS * 0.98) < 1e-9, 'desktop keeps the whole-world minimum');
});
test('single-map overview stays continuous through zoom and orientation changes', () => {
  cam.splitAllowed = false; cam.padTop = 112; cam.padBottom = 100;
  for (const [width, height] of [[390, 844], [844, 390], [320, 568], [768, 1024]]) {
    cam.resize(width, height); cam.overview();
    assert(!cam.split);
    const west = cam.toScreen(300, 400), east = cam.toScreen(1500, 400);
    assert(west[0] < east[0] && Math.abs(west[1] - east[1]) < 1e-6);
    for (const [mx, my] of [[300, 400], [1500, 300], [1100, 700]]) {
      const [sx, sy] = cam.toScreen(mx, my);
      const [bx, by] = cam.toMap(sx, sy);
      assert(Math.abs(bx - mx) < 1e-6 && Math.abs(by - my) < 1e-6);
    }
    cam.zoomAt(width / 2, height / 2, 3);
    const before = cam.x; cam.pan(20, 0);
    assert(cam.x < before, 'zoomed map must pan');
    cam.zoomAt(width / 2, height / 2, 1 / 10);
    assert(!cam.split && Math.abs(cam.s - cam.minS) < 1e-6);
  }
});
const canvasListeners = new Map(), classes = new Set();
const canvas = { style: {}, classList: { toggle: (k, on) => on ? classes.add(k) : classes.delete(k) },
  addEventListener: (k, fn) => canvasListeners.set(k, fn),
  getBoundingClientRect: () => ({ left: 0, top: 0 }),
  setPointerCapture() {}, releasePointerCapture() {},
};
A.fx = { R: 22 }; A.lines = { setHover() {} }; A.audio = { init() {}, play() {} };
vm.runInContext(fs.readFileSync(root + 'assets/js/core/input.js', 'utf8'), c);
const I = A.input; I.init(canvas);
const pointer = (id, x, y, type = 'pointerdown', pointerType = 'touch') => ({
  pointerId: id, clientX: x, clientY: y, type, pointerType, button: 0, preventDefault() {}, target: canvas,
});
test('enable input activates canvas hit testing; down collects at rendered coordinates', () => {
  reset(); I.setEnabled(true); assert(classes.has('interactive'));
  cam.resize(390, 844); cam.s = cam.minS * 2.5; cam.x = A.world.W / 2; cam.y = A.world.H / 2;
  const b = G.spawnBubble('compute', G.origin, { pos: [cam.x, cam.y] });
  let hit = null; const handler = v => { hit = v.bubble; };
  A.U.on('input:bubble', handler);
  const [x, y] = cam.toScreen(b.x, b.y);
  canvasListeners.get('pointerdown')(pointer(1, x, y)); assert.equal(hit, b);
  listeners.get('pointerup')(pointer(1, x, y, 'pointerup'));
  A.U.off('input:bubble', handler);
});
test('drag, wheel and two-pointer pinch move/zoom without leaving stuck pointers', () => {
  reset(); I.reset();
  cam.s = cam.minS * 2.5; cam.x = A.world.W / 2; cam.y = A.world.H / 2;
  const x0 = cam.x;
  canvasListeners.get('pointerdown')(pointer(1, 100, 400));
  listeners.get('pointermove')(pointer(1, 140, 400, 'pointermove'));
  assert(cam.x < x0);
  listeners.get('pointerup')(pointer(1, 140, 400, 'pointerup'));
  canvasListeners.get('wheel')({ ...pointer(1, 160, 400), deltaY: -100, deltaMode: 0 });
  assert(cam._zoom.ts > cam.s); cam.update(.1);
  canvasListeners.get('pointerdown')(pointer(1, 100, 400));
  canvasListeners.get('pointerdown')(pointer(2, 200, 400));
  const s = cam.s;
  listeners.get('pointermove')(pointer(2, 250, 400, 'pointermove'));
  assert(cam.s > s); assert.equal(cam._zoom, null);
  listeners.get('pointercancel')(pointer(1, 100, 400, 'pointercancel'));
  listeners.get('pointercancel')(pointer(2, 250, 400, 'pointercancel'));
  assert.equal(I.pointers.size, 0); assert.equal(I.pinch, null);
  I.setEnabled(false); assert(!classes.has('interactive'));
});
console.log(`${passed} regression checks passed.`);
