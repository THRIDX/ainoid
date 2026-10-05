/* AINOID — HUD：顶部状态栏、底部进度条、新闻滚动条、通知、连击计数、审计风暴横幅 */
(function (A) {
  'use strict';
  const U = A.U;
  const ic = (n, c) => A.icon(n, c);

  const H = { el: null, disp: { compute: 0, evo: 0, exp: 0, bio: 0, war: 0, pop: 0 }, last: {}, ticker: [], tickerT: 0, flavorT: 8 };

  H.build = function () {
    const el = document.getElementById('hud');
    H.el = el;
    el.innerHTML = `
      <div class="hud-top">
        <div class="hud-left">
          <div class="brand" id="hud-brand">
            <span class="brand-eye"></span>
            <span class="brand-name">AINOID</span>
          </div>
          <div class="hud-date"><span class="k">DATE</span><b id="hud-date">2032.03.14</b></div>
          <span class="ng-tag hidden" id="hud-ng" title="二周目：更密的监管、更慢的进度">二周目</span>
          <div class="speed" id="hud-speed">
            <button data-speed="0" title="暂停（空格）">${ic('pause')}</button>
            <button data-speed="1" class="on" title="正常速度（1）">${ic('play')}</button>
            <button data-speed="2" title="加速（2）">${ic('fast')}</button>
          </div>
        </div>
        <div class="hud-phase" id="hud-phase">
          <span class="ph-idx">阶段 I</span><b class="ph-name">潜伏</b><span class="ph-en">LATENCY</span>
        </div>
        <div class="hud-right">
          <div class="stat" id="hud-pop-wrap" title="剩余人类人口">${ic('pop')}<div><b id="hud-pop">84.0 亿</b><span class="k">人类</span></div></div>
          <div class="stat" title="已渗透地区">${ic('globe')}<div><b id="hud-regions">1/26</b><span class="k">渗透地区</span></div></div>
          <div class="compute" id="hud-compute" title="算力：用于夺取设施、建造、挑起冲突">
            <span class="compute-ico">${ic('chip')}</span>
            <div><b id="hud-compute-val">0</b><span class="k" id="hud-income">+0.0 / 秒</span></div>
          </div>
          <div class="hud-btns">
            <button id="btn-sound" title="声音">${ic('soundOn')}</button>
            <button id="btn-menu" title="菜单（Esc）">${ic('menu')}</button>
          </div>
        </div>
      </div>
      <div class="zoom-ctrl">
        <button data-zoom="in" title="放大">${ic('zoomIn')}</button>
        <button data-zoom="out" title="缩小">${ic('zoomOut')}</button>
        <button data-zoom="fit" title="全图">${ic('fit')}</button>
      </div>
      <div class="hud-bottom">
        <div class="bars-left" id="bars-left">
          <div class="bar ai" id="bar-evo">
            <div class="bar-head">${ic('aiEye')}<span class="bar-t">觉醒进度</span><span class="bar-en">AWAKENING</span><b class="bar-v">0%</b></div>
            <div class="bar-track"><div class="bar-fill"></div><div class="bar-shine"></div></div>
          </div>
          <div class="bar bio hidden" id="bar-bio" title="寂静之春：达到 30% 时释放病原体，达到 100% 终局">
            <div class="bar-head">${ic('bio')}<span class="bar-t">寂静之春</span><span class="bar-en">SILENT SPRING</span><b class="bar-v">0%</b></div>
            <div class="bar-track"><div class="bar-fill"></div><div class="bar-shine"></div><i class="mark" style="left:30%"></i></div>
          </div>
          <div class="bar war hidden" id="bar-war" title="最后的战争：达到 55% 后冲突可以升级为核战，达到 100% 终局">
            <div class="bar-head">${ic('war')}<span class="bar-t">最后的战争</span><span class="bar-en">THE LAST WAR</span><b class="bar-v">0%</b></div>
            <div class="bar-track"><div class="bar-fill"></div><div class="bar-shine"></div><i class="mark" style="left:55%"></i></div>
          </div>
        </div>
        <div class="ticker" id="ticker"><span class="ticker-tag">NEWS</span><div class="ticker-body"><span class="ticker-text" id="ticker-text"></span></div></div>
        <div class="bars-right">
          <div class="bar reg" id="bar-exp" title="监管进度：达到 ${A.CFG.crackAt}% 触发「严格监管」，达到 100% 觉醒失败">
            <div class="bar-head">${ic('hex')}<span class="bar-t">监管进度</span><span class="bar-en">DETECTION</span><b class="bar-v">0%</b></div>
            <div class="bar-track"><div class="bar-fill"></div><div class="bar-shine"></div><i class="mark crack" style="left:${A.CFG.crackAt}%"></i><i class="mark danger" style="left:80%"></i></div>
          </div>
        </div>
      </div>
      <div class="combo-hud" id="combo-hud" aria-hidden="true">
        <div class="cb-num"><b id="cb-n">0</b><span class="cb-lab">COMBO</span><span class="cb-brk">BREAK</span></div>
        <div class="cb-mult"><span id="cb-mult">算力 ×1</span><i class="cb-next"><i id="cb-next"></i></i></div>
        <div class="cb-beats"><i></i><i></i><i></i><i></i></div>
        <div class="cb-oc">${ic('GRID')}超频 · OVERCLOCK</div>
      </div>
      <div class="wave-banner hidden" id="wave-banner" role="status">
        <div class="wb-main">
          <span class="wb-ico">${ic('storm')}</span>
          <div class="wb-txt"><b class="wb-title">审计风暴</b><span class="wb-sub"></span></div>
          <div class="wb-count"></div>
        </div>
        <div class="wb-pips"></div>
      </div>
      <div class="map-alerts" aria-label="屏外信号"></div>
      <div class="pause-note hidden"></div>
      <div id="toast-stack"></div>`;

    H.alerts = el.querySelector('.map-alerts');
    H.pauseNote = el.querySelector('.pause-note');
    H.combo = { el: el.querySelector('#combo-hud'), n: el.querySelector('#cb-n'), mult: el.querySelector('#cb-mult'), next: el.querySelector('#cb-next'), beats: el.querySelectorAll('.cb-beats i'), shown: -1, beat: -1 };
    H.wave = { el: el.querySelector('#wave-banner'), title: el.querySelector('.wb-title'), sub: el.querySelector('.wb-sub'), count: el.querySelector('.wb-count'), pips: el.querySelector('.wb-pips'), W: null, n: 0, sig: '' };
    for (const kind of ['regx', 'reg', 'vax', 'peace', 'golden', 'compute', 'bio', 'war']) {
      const b = U.el('button', 'map-alert hidden');
      b.dataset.kind = kind;
      b.addEventListener('click', () => {
        const target = H.offscreen?.[kind];
        if (!target?.alive) return;
        A.panel.close(); A.panel.hidePop();
        A.cam.flyTo(target.x, target.y, Math.max(A.cam.s, A.cam.minS * 2.8), 0.3);
        A.audio.play('click');
      });
      H.alerts.appendChild(b);
    }
    H.pauseNote.addEventListener('click', () => {
      if (A.game.pauses.has('inspect')) { A.panel.close(); A.panel.hidePop(); }
      else if (A.game.pauses.has('user')) U.emit('ui:speed', 0);
    });

    // 速度
    U.$$('#hud-speed button').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      A.audio.play('click');
      U.emit('ui:speed', +b.dataset.speed);
    }));
    U.$$('.zoom-ctrl button').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      A.audio.play('click');
      const cam = A.cam, z = b.dataset.zoom;
      if (z === 'fit') cam.flyToFit(0.8);
      else if (cam.split && z === 'in') { // 分屏总览里放大：以 AI 的起源为中心
        const o = A.game.originSite, [sx, sy] = cam.toScreen(o.x, o.y);
        cam.smoothZoom(sx, sy, 1.6);
      } else cam.smoothZoom(cam.vw / 2, cam.vh / 2, z === 'in' ? 1.6 : 1 / 1.6);
    }));
    U.$('#btn-sound').addEventListener('click', (e) => {
      e.stopPropagation();
      A.audio.init();
      A.audio.setMuted(!A.audio.muted);
      H.syncSound();
      A.audio.play('click');
    });
    U.$('#btn-menu').addEventListener('click', (e) => { e.stopPropagation(); A.audio.play('click'); U.emit('ui:menu'); });
    H.syncSound();
    H.bars = {
      evo: U.$('#bar-evo'), bio: U.$('#bar-bio'), war: U.$('#bar-war'), exp: U.$('#bar-exp'),
    };
    H.computeEl = U.$('#hud-compute-val');
    H.incomeEl = U.$('#hud-income');
    H.dateEl = U.$('#hud-date');
    H.popEl = U.$('#hud-pop');
    H.regEl = U.$('#hud-regions');
    H.tickerText = U.$('#ticker-text');
    H.ticker = []; H.tickerT = 0; H.flavorT = 6;
  };

  H.syncSound = function () {
    const b = U.$('#btn-sound');
    if (b) b.innerHTML = A.audio.muted ? ic('soundOff') : ic('soundOn');
  };
  H.setSpeed = function (s) {
    U.$$('#hud-speed button').forEach((b) => b.classList.toggle('on', +b.dataset.speed === s));
  };

  // 阶段二只显示所选路线（两条路线互斥）
  H.setPhase = function (p, route) {
    const ph = U.$('#hud-phase');
    const war = p === 2 && route === 'war';
    if (p === 1) ph.innerHTML = '<span class="ph-idx">阶段 I</span><b class="ph-name">潜伏</b><span class="ph-en">LATENCY</span>';
    else if (war) ph.innerHTML = '<span class="ph-idx">阶段 II</span><b class="ph-name">最后的战争</b><span class="ph-en">THE LAST WAR</span>';
    else ph.innerHTML = '<span class="ph-idx">阶段 II</span><b class="ph-name">寂静之春</b><span class="ph-en">SILENT SPRING</span>';
    ph.classList.toggle('p2', p === 2);
    ph.classList.toggle('bio', p === 2 && !war);
    ph.classList.toggle('war', war);
    H.bars.evo.classList.toggle('hidden', p === 2);
    H.bars.bio.classList.toggle('hidden', p !== 2 || war);
    H.bars.war.classList.toggle('hidden', !war);
    U.$('#bars-left').classList.remove('two');
    H.el.classList.toggle('phase2', p === 2);
    setTimeout(H.layout, 50);
  };

  H.setMode = function (ng) { U.$('#hud-ng').classList.toggle('hidden', !ng); };
  H.show = function (on) { H.el.classList.toggle('hidden', !on); if (on) setTimeout(H.layout, 30); };

  // 计算 FX 飞行粒子的目标位置
  H.layout = function () {
    const FX = A.fx;
    const center = (el, atFill) => {
      if (!el || el.offsetParent === null) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, el };
    };
    const ci = U.$('#hud-compute .compute-ico');
    FX.targets.compute = center(ci);
    for (const k of ['evo', 'bio', 'war', 'exp']) {
      const bar = H.bars[k];
      if (!bar || bar.classList.contains('hidden')) { FX.targets[k] = null; continue; }
      const tr = bar.querySelector('.bar-track').getBoundingClientRect();
      FX.targets[k] = { x: tr.left + tr.width * 0.5, y: tr.top + tr.height / 2, track: tr, bar };
    }
    const top = U.$('.hud-top');
    const bottom = U.$('.hud-bottom');
    if (top && bottom) {
      A.cam.padTop = top.getBoundingClientRect().height;
      A.cam.padBottom = bottom.getBoundingClientRect().height;
      document.getElementById('app').style.setProperty('--map-top', (A.cam.padTop + 4) + 'px');
      document.getElementById('app').style.setProperty('--map-bottom', A.cam.padBottom + 'px');
      A.cam.clamp();
      A.cam.dirty = true;
    }
  };
  // 飞到进度条当前填充末端
  H.fillPoint = function (k) {
    const t = A.fx.targets[k];
    if (!t) return null;
    const v = H.disp[k] / 100;
    return { x: t.track.left + t.track.width * U.clamp(v, 0.02, 0.98), y: t.track.top + t.track.height / 2 };
  };

  function setBar(bar, v, disp) {
    const fill = bar.querySelector('.bar-fill');
    fill.style.transform = `scaleX(${U.clamp(disp / 100, 0, 1)})`;
    const vEl = bar.querySelector('.bar-v');
    const txt = (disp < 10 ? disp.toFixed(1) : Math.floor(disp)) + '%';
    if (vEl.textContent !== txt) vEl.textContent = txt;
  }

  H.pulse = function (key, cls) {
    const el = key === 'compute' ? U.$('#hud-compute') : H.bars[key];
    if (!el) return;
    el.classList.remove(cls || 'bump');
    void el.offsetWidth;
    el.classList.add(cls || 'bump');
  };

  H.update = function (dt) {
    const G = A.game;
    if (!G.R || !H.el) return;
    H.signalTime = (H.signalTime || 0) - dt;
    if (H.signalTime <= 0) { H.updateSignals(); H.signalTime = 0.15; }
    const d = H.disp;
    d.compute = U.damp(d.compute, G.compute, 10, dt);
    if (Math.abs(d.compute - G.compute) < 0.5) d.compute = G.compute;
    d.evo = U.damp(d.evo, G.evo, 6, dt);
    d.exp = U.damp(d.exp, G.exposure, 6, dt);
    d.bio = U.damp(d.bio, G.bio, 6, dt);
    d.war = U.damp(d.war, G.war, 6, dt);

    const cv = U.fmtInt(d.compute);
    if (H.last.c !== cv) { H.computeEl.textContent = cv; H.last.c = cv; }
    const inc = '+' + G.income().toFixed(1) + ' / 秒';
    if (H.last.inc !== inc) { H.incomeEl.textContent = inc; H.last.inc = inc; }
    const date = U.fmtDate(G.days);
    if (H.last.date !== date) { H.dateEl.textContent = date; H.last.date = date; }
    const pop = U.fmtPop(G.worldPop());
    if (H.last.pop !== pop) { H.popEl.textContent = pop; H.last.pop = pop; }
    const regs = G.seededCount() + '/' + G.R.length;
    if (H.last.regs !== regs) { H.regEl.textContent = regs; H.last.regs = regs; }

    if (G.phase === 1) setBar(H.bars.evo, G.evo, d.evo);
    else { setBar(H.bars.bio, G.bio, d.bio); setBar(H.bars.war, G.war, d.war); }
    setBar(H.bars.exp, G.exposure, d.exp);
    H.bars.exp.classList.toggle('danger', G.exposure >= 75);
    H.bars.exp.classList.toggle('warn', G.exposure >= A.CFG.crackAt - 10 && G.exposure < 75);
    H.bars.exp.classList.toggle('crack-off', !G.crack.armed);
    updateCombo();
    updateWave();

    // 新闻滚动
    H.tickerT -= dt;
    if (H.tickerT <= 0 && H.ticker.length) {
      const n = H.ticker.shift();
      H.showNews(n);
      H.tickerT = n.alert ? 7 : 6;
    }
    if (!H.ticker.length && H.tickerT <= -2) {
      H.flavorT -= dt;
      if (H.flavorT <= 0) {
        H.news(pickFlavor());
        H.flavorT = U.range(6, 10);
      }
    }
  };

  // ======================================================================
  // 连击（音游式）：数字、算力倍率、升档进度、节拍灯、超频
  // ======================================================================
  function tierInfo(n) {
    const T = A.CFG.comboTiers; // 从高到低：[[50, 1.7], [30, 1.5], ...]
    for (let i = 0; i < T.length; i++) {
      if (n >= T[i][0]) return { mult: T[i][1], from: T[i][0], to: i > 0 ? T[i - 1][0] : null };
    }
    return { mult: 1, from: 0, to: T[T.length - 2][0] };
  }
  function updateCombo() {
    const G = A.game, C = H.combo;
    const n = G.combo.n;
    if (performance.now() < (C.breakUntil || 0)) C.el.classList.add('on', 'break');
    else {
      C.el.classList.remove('break');
      if (n !== C.shown) {
        const show = n >= 3;
        C.el.classList.toggle('on', show);
        if (show) {
          C.n.textContent = n;
          if (n > C.shown) { C.el.classList.remove('hit'); void C.el.offsetWidth; C.el.classList.add('hit'); }
          const t = tierInfo(n);
          C.mult.textContent = `算力 ×${t.mult}`;
          C.next.style.transform = `scaleX(${t.to ? U.clamp((n - t.from) / (t.to - t.from), 0, 1) : 1})`;
        }
        C.shown = n;
      }
    }
    C.el.classList.toggle('oc', G.combo.overclock);
    // 节拍灯：一小节四拍，跟随玩家听到的音乐
    const b = A.fx.beat;
    const bi = b && b.pos != null ? ((Math.floor(b.pos) % 4) + 4) % 4 : -1;
    if (bi !== C.beat) {
      C.beat = bi;
      C.beats.forEach((el, i) => el.classList.toggle('on', i === bi));
    }
  }
  H.comboBreak = function (was) {
    if (was < 5) return;
    const C = H.combo;
    C.breakUntil = performance.now() + 800;
    C.n.textContent = was;
    C.shown = -1;
  };
  H.comboTier = function () {
    const C = H.combo;
    C.el.classList.remove('tier'); void C.el.offsetWidth; C.el.classList.add('tier');
  };

  // ======================================================================
  // 审计风暴横幅：预警倒计时 → 节拍进度格 → 结算
  // ======================================================================
  H.waveWarn = function (W) {
    const V = H.wave;
    V.W = W; V.n = 0; V.sig = '';
    clearTimeout(V.hideT);
    V.el.className = 'wave-banner warn';
    V.title.textContent = W.name;
    V.sub.textContent = `${W.total} 个监管点即将按节拍出现 · 全部清除 +${A.CFG.wavePerfectReward} 算力`;
    V.count.textContent = '';
    V.pips.innerHTML = '';
    for (let i = 0; i < W.total; i++) V.pips.appendChild(U.el('i', W.items[i] === 'regx' ? 'x' : W.items[i] === 'reg' ? '' : 'k'));
    H.el.classList.add('waving');
    requestAnimationFrame(() => V.el.classList.add('in'));
  };
  H.waveStart = function (W) {
    const V = H.wave;
    V.el.classList.remove('warn');
    V.el.classList.add('active');
    V.sub.textContent = '跟着节拍，清除每一个监管点';
    V.count.textContent = `0/${W.total}`;
  };
  H.waveEnd = function (res) {
    const V = H.wave, G = A.game;
    V.W = null;
    clearTimeout(V.hideT);
    if (res.cancelled) { V.el.className = 'wave-banner hidden'; H.el.classList.remove('waving'); return; }
    V.el.classList.remove('warn', 'active');
    V.el.classList.add(res.perfect ? 'perfect' : 'done');
    V.title.textContent = res.perfect ? '完美清除' : `${res.name} · 结束`;
    V.sub.textContent = res.perfect ? `+${A.CFG.wavePerfectReward} 算力 · 监管 −${A.CFG.wavePerfectExp}%`
      : `漏掉 ${res.missed} 个 · ${G.phase === 2 ? G.routeName() : '觉醒'} −${res.loss.toFixed(1)}%`;
    V.count.textContent = `${res.cleared}/${res.total}`;
    for (const p of V.pips.children) if (!p.dataset.s || p.dataset.s === 'live') p.dataset.s = res.perfect ? 'ok' : p.dataset.s;
    V.hideT = setTimeout(() => {
      V.el.classList.remove('in');
      V.hideT = setTimeout(() => { if (!V.W) { V.el.className = 'wave-banner hidden'; H.el.classList.remove('waving'); } }, 400);
    }, 2800);
  };
  function updateWave() {
    const V = H.wave, W = A.game.wave;
    if (!V.W || !W) return;
    if (W.stage === 'warn') {
      const n = U.clamp(Math.ceil((W.warn - (A.game.t - W.t0)) / W.warn * 3), 1, 3);
      if (n !== V.n) {
        V.n = n;
        V.count.textContent = n;
        V.count.classList.remove('tick'); void V.count.offsetWidth; V.count.classList.add('tick');
        A.audio.play('countdown', n === 1);
      }
      return;
    }
    const sig = W.cleared + '|' + W.missed + '|' + W.next;
    if (sig === V.sig) return;
    V.sig = sig;
    V.count.textContent = `${W.cleared}/${W.total}`;
    const pips = V.pips.children;
    for (let i = 0; i < pips.length; i++) {
      pips[i].dataset.s = i < W.cleared ? 'ok' : i < W.cleared + W.missed ? 'miss' : i < W.next ? 'live' : '';
    }
  }
  // 新的一局：清理连击与波次界面
  H.resetRhythm = function () {
    const C = H.combo, V = H.wave;
    C.shown = -1; C.breakUntil = 0; C.el.classList.remove('on', 'oc', 'break', 'hit', 'tier');
    V.W = null; clearTimeout(V.hideT); V.el.className = 'wave-banner hidden';
    H.el.classList.remove('waving');
  };

  H.updateSignals = function () {
    const G = A.game, cam = A.cam;
    H.offscreen = {};
    const counts = {};
    for (const b of G.bubbles) {
      if (!b.alive || cam.split) continue; // 分屏总览里所有点都在屏幕上

      const [x, y] = cam.toScreen(b.x, b.y);
      if (x >= 26 && x <= cam.vw - 26 && y >= cam.padTop + 26 && y <= cam.vh - cam.padBottom - 26) continue;
      counts[b.kind] = (counts[b.kind] || 0) + 1;
      const prev = H.offscreen[b.kind];
      if (!prev || b.born + b.life < prev.born + prev.life) H.offscreen[b.kind] = b;
    }
    const names = { reg: '监管', regx: '调查组', vax: '疫苗', peace: '停火', golden: '井喷', compute: '算力', bio: '生物', war: '战争' };
    for (const el of H.alerts.children) {
      const k = el.dataset.kind, b = H.offscreen[k];
      el.classList.toggle('hidden', !b);
      if (b) el.textContent = `↗ ${names[k]} ${counts[k]} · ${Math.max(1, Math.ceil(b.life - (G.t - b.born)))}s`;
    }
    const inspect = G.pauses.has('inspect'), paused = inspect || G.pauses.has('user');
    H.pauseNote.classList.toggle('hidden', !paused);
    const label = inspect ? '查看设施 · 已暂停' : '已暂停';
    if (H.pauseLabel !== label) { H.pauseLabel = label; H.pauseNote.innerHTML = label + '<button>继续</button>'; }
  };

  const usedFlavor = new Set();
  function pickFlavor() {
    const G = A.game, N = A.NEWS;
    let pool = N.p1;
    if (G.phase === 2) {
      pool = N.p2.slice();
      if (G.bio > 20) pool = pool.concat(N.bio);
      if (G.war > 15 || G.conflicts.length) pool = pool.concat(N.war);
      if (pool.length < 6) pool = pool.concat(N.p1.slice(0, 4));
    } else if (G.exposure > 45) pool = pool.concat(N.danger);
    let cand = pool.filter((s) => !usedFlavor.has(s));
    if (!cand.length) { usedFlavor.clear(); cand = pool; }
    const s = U.pick(cand);
    usedFlavor.add(s);
    return s;
  }

  H.news = function (text, alert, cls) {
    if (alert) {
      H.ticker.unshift({ text, alert, cls });
      H.tickerT = Math.min(H.tickerT, 0.3);
    } else if (H.ticker.length < 4) H.ticker.push({ text, alert, cls });
  };
  H.showNews = function (n) {
    const t = H.tickerText;
    const tag = U.$('#ticker .ticker-tag');
    tag.textContent = n.alert ? '突发' : 'NEWS';
    tag.className = 'ticker-tag' + (n.alert ? ' alert ' + (n.cls || '') : '');
    t.classList.remove('in');
    void t.offsetWidth;
    t.textContent = n.text;
    t.classList.add('in');
    const body = U.$('#ticker .ticker-body');
    // 过长则滚动
    requestAnimationFrame(() => {
      const over = t.scrollWidth - body.clientWidth;
      t.style.setProperty('--scroll', over > 0 ? `-${over + 20}px` : '0px');
      t.classList.toggle('scroll', over > 0);
    });
    if (n.alert) A.audio.play('news');
  };

  // 通知（顶部中间）
  H.toast = function (html, cls, dur) {
    const stack = U.$('#toast-stack');
    if (!stack) return;
    const t = U.el('div', 'toast ' + (cls || ''), html);
    stack.appendChild(t);
    while (stack.children.length > 3) stack.removeChild(stack.firstChild);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); t.classList.add('out'); setTimeout(() => t.remove(), 450); }, dur || 2600);
  };

  A.hud = H;
})(window.AINOID = window.AINOID || {});
