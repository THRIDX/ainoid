// Offline localization checks: selection, saves, interpolation, narrative branches and formatting.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url);
const files = ['data/en', 'i18n', 'data/regions', 'data/world-data', 'core/util', 'core/world', 'render/camera', 'game/game', 'data/events', 'data/news', 'ui/icons', 'ui/screens'];
function load({ search = '?lang=en', saved = null, browser = 'zh-CN', blocked = false } = {}) {
  const storage = new Map(saved ? [['ainoid.language', JSON.stringify(saved)]] : []);
  const c = { console, URL, URLSearchParams, Date, Math: Object.create(Math), performance: { now: () => 1000 },
    navigator: { language: browser }, location: { search, protocol: 'https:', hostname: 'example.com', origin: 'https://example.com', pathname: '/ainoid/', href: 'https://example.com/ainoid/' + search, assign(url) { this.assigned = url; } },
    localStorage: { getItem(k) { if (blocked) throw Error('blocked'); return storage.get(k) ?? null; }, setItem(k, v) { if (blocked) throw Error('blocked'); storage.set(k, v); } },
    atob: s => Buffer.from(s, 'base64').toString('binary'), document: {}, addEventListener() {}, matchMedia: () => ({matches:false}) };
  c.window = c; c.top = c; c.self = c;
  vm.createContext(c);
  for (const f of files) vm.runInContext(fs.readFileSync(new URL(`assets/js/${f}.js`, root), 'utf8'), c, { filename: f });
  c.Math.random = c.AINOID.U.makeRng(71); c.AINOID.game.reset({origin:'US'});
  return c;
}
const c = load(), A = c.AINOID, L = A.i18n;
assert.equal(L.lang, 'en');
assert.equal(load({search:'?lang=zh',saved:'en',browser:'en-US'}).AINOID.i18n.lang, 'zh');
assert.equal(load({search:'',saved:'zh',browser:'en-US'}).AINOID.i18n.lang, 'zh');
assert.equal(load({search:'',browser:'en-GB'}).AINOID.i18n.lang, 'en');
assert.equal(load({search:'?lang=invalid',browser:'zh-CN',blocked:true}).AINOID.i18n.lang, 'zh');
assert.equal(load({blocked:true}).AINOID.i18n.lang, 'en');
L.choose('zh'); assert.equal(new URL(c.location.assigned).searchParams.get('lang'), 'zh');
console.log('PASS URL, preference, browser fallback and restricted storage');
const placeholders = s => (s.match(/\{#\d+\}|\{[rs]\}/g) || []).sort();
for (const [source, target] of Object.entries(A.EN)) {
  assert(!/[\u3400-\u9fff]/.test(target), source);
  assert.deepEqual(placeholders(target), placeholders(source), 'Placeholder mismatch: ' + source);
}
assert.equal(L.t`+${'$& {#9}'} 算力`, '+$& {#9} compute');
assert.equal(L.t('unknown text'), 'unknown text');
assert.equal(L.savedText('永恒的策展人'), 'Eternal Curator');
assert.equal(load({search:'?lang=zh'}).AINOID.i18n.savedText('Eternal Curator'), '永恒的策展人');
console.log('PASS catalog placeholders, safe interpolation and old record titles');
assert.equal(A.U.fmtPop(8400),'8.4B'); assert.equal(A.U.fmtPop(41),'41M'); assert.equal(A.U.fmtPop(.05),'50K'); assert.equal(A.U.fmtPop(.001),'1,000'); assert.equal(A.U.fmtPop(0),'0');
assert.equal(A.U.fmtDateCN(0),'14 March 2032');
assert.equal(load({search:'?lang=zh'}).AINOID.U.fmtPop(8400),'84 亿');
console.log('PASS locale-specific population and UTC dates');
function english(value, path='text') {
  if (typeof value === 'string') assert(!/[\u3400-\u9fff]/.test(value), path + ': ' + value);
  else if (Array.isArray(value)) value.forEach((v,i)=>english(v,path+'.'+i));
  else if (value && typeof value === 'object') for(const [k,v]of Object.entries(value))english(v,path+'.'+k);
}
english(A.REGIONS); english(A.FLASHPOINTS); english(A.NEWS); english(A.TYPE_NAME); english(A.TYPE_DESC); english(A.screens.ACH);
for(const route of ['bio','war']) for(const ng of [false,true]) for(const unlocked of [false,true]) {
  const G=A.game,E=A.events; G.reset({origin:'US',ng}); G.startPhase2(route); G.compute=9999; G.exposure=45;
  G.flags.vector=unlocked; G.flags.fear=unlocked; G.flags.echo=unlocked;
  for(const ev of E.defs) {
    english(ev,ev.id); english(ev.text(G,E.ctx),ev.id+'.story');
    const opts=E.optionsOf(ev); english(opts,ev.id+'.options');
    for(const opt of opts||[])english(E.tags(opt.fx),ev.id+'.effects');
  }
  for(const variant of ['main','zoo','upload','bunker','peace','symbiosis']) {
    G.ending=route; G.endingVariant=variant;
    const result=G.result(),info=A.screens.endingInfo(route,variant),data=A.screens.posterData(G,result,info,false);
    english(result); english(info); english(A.screens.shareText(data));
  }
}
assert.equal(L.missing.size,0,[...L.missing].join('\n'));
assert.equal(A.screens.shareUrl,'https://example.com/ainoid/?lang=en');
console.log('PASS all event text/effects, routes, achievements, ending titles and share text');
console.log('English localization checks passed.');
