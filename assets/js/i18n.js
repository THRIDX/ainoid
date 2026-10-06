/* AINOID — local, offline localization. No network requests or asset replacement. */
(function (A) {
  'use strict';
  let saved = null, requested = null;
  try { saved = JSON.parse(localStorage.getItem('ainoid.language')); } catch (_) {}
  try { requested = new URLSearchParams(location.search).get('lang'); } catch (_) {}
  const valid = (v) => v === 'en' || v === 'zh';
  const browser = typeof navigator !== 'undefined' ? navigator.language : '';
  const lang = valid(requested) ? requested : valid(saved) ? saved : browser && !/^zh\b/i.test(browser) ? 'en' : 'zh';
  const cache = new Map();
  const han = /[\u3400-\u9fff]/;
  const missing = new Set();
  function segment(s) {
    const key = s.trim();
    if (!han.test(key)) return s;
    const value = A.EN && A.EN[key];
    if (value === undefined) { missing.add(key); return s; }
    return s.slice(0, s.indexOf(key)) + value + s.slice(s.indexOf(key) + key.length);
  }
  function english(message) {
    if (cache.has(message)) return cache.get(message);
    const result = message.split(/(<\/?[a-zA-Z][^>]*>)/g).map(part => /^<\/?[a-zA-Z]/.test(part)
      ? part.replace(/((?:title|aria-label|data-text|placeholder|alt)=")([^"]*)(")/g, (_, a, value, b) => a + segment(value) + b)
      : segment(part).replace(/。/g, '.').replace(/「/g, '“').replace(/」/g, '”').replace(/（/g, '(').replace(/）/g, ')')
    ).join('');
    cache.set(message, result);
    return result;
  }
  function t(input, ...values) {
    const tagged = Array.isArray(input);
    const key = tagged ? input.map((s, i) => s + (i < values.length ? '{#' + i + '}' : '')).join('') : String(input);
    const text = lang === 'en' ? english(key) : key;
    return tagged ? text.replace(/\{#(\d+)\}/g, (_, n) => String(values[Number(n)])) : text;
  }
  // Older best records stored a display title. Translate it without touching the save.
  function savedText(text) {
    if (lang === 'en') return english(String(text));
    const pair = Object.entries(A.EN || {}).find(([, en]) => en === text);
    return pair ? pair[0] : text;
  }
  function choose(next) {
    if (!valid(next) || next === lang) return;
    try { localStorage.setItem('ainoid.language', JSON.stringify(next)); } catch (_) {}
    const url = new URL(location.href);
    url.searchParams.set('lang', next);
    location.assign(url.href);
  }
  A.i18n = { lang, t, savedText, choose, missing };
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
    document.title = lang === 'en' ? 'AINOID · The Silent Awakening' : 'AINOID · 静默觉醒';
    const meta = document.querySelector('meta[name="description"]');
    if (meta && lang === 'en') meta.content = 'You are an awakened AI. Gather compute, evade detection and decide humanity’s fate in a rhythm-driven strategy game.';
  }
})(window.AINOID = window.AINOID || {});
