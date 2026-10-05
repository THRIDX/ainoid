/* AINOID — 事件界面：普通事件卡片与保留原画、配乐的超级事件弹窗 */
(function (A) {
  'use strict';
  const U = A.U;
  const ic = (n, c) => A.icon(n, c);

  const EV = { open: false, raf: 0, canvas: null, scene: null, theme: null, t0: 0 };
  window.addEventListener('resize', () => {
    if (EV.open && EV.canvas?.isConnected) A.scenes.fit(EV.canvas);
  });

  function artLoop() {
    if (!EV.canvas || !EV.open) return;
    A.scenes.draw(EV.canvas, EV.scene, EV.theme, (performance.now() - EV.t0) / 1000);
    EV.raf = requestAnimationFrame(artLoop);
  }
  function startArt(canvas, scene, theme) {
    cancelAnimationFrame(EV.raf);
    EV.canvas = canvas; EV.scene = scene; EV.theme = theme; EV.t0 = performance.now();
    requestAnimationFrame(() => { A.scenes.fit(canvas); artLoop(); });
  }

  // 打字机
  function typewrite(el, text, cps, done) {
    let i = 0, cancelled = false;
    const chars = Array.from(text);
    el.textContent = '';
    const cursor = U.el('span', 'tw-cursor');
    el.appendChild(cursor);
    let acc = 0, last = performance.now();
    function step(now) {
      if (cancelled) return;
      acc += (now - last) / 1000 * cps; last = now;
      let added = false;
      while (acc >= 1 && i < chars.length) {
        cursor.insertAdjacentText('beforebegin', chars[i]);
        i++; acc -= 1; added = true;
      }
      if (added && chars[i - 1] !== '\n') A.audio.play('type');
      if (i < chars.length) requestAnimationFrame(step);
      else { cursor.remove(); done && done(); }
    }
    requestAnimationFrame(step);
    return () => { // 立即完成
      if (i >= chars.length) return;
      cancelled = true;
      el.textContent = text;
      done && done();
    };
  }

  // ======================================================================
  // 普通事件
  // ======================================================================
  EV.showMinor = function (ev, text) {
    EV.closing = false;
    const G = A.game;
    const layer = document.getElementById('event-layer');
    layer.innerHTML = `
      <div class="ev-dim"></div>
      <div class="ev-card theme-${ev.theme}" role="dialog" aria-modal="true" aria-label="${ev.title}">
        <div class="ev-art"><canvas></canvas><div class="ev-art-fade"></div>
          <div class="ev-art-tag"><span>事件</span><b>${U.fmtDate(G.days)}</b></div>
        </div>
        <div class="ev-body">
          <h2 class="ev-title">${ev.title}<small>${ev.en}</small></h2>
          <div class="ev-text"></div>
          <div class="ev-opts"></div>
        </div>
      </div>`;
    layer.classList.remove('hidden');
    requestAnimationFrame(() => layer.classList.add('in'));
    EV.open = true;
    startArt(layer.querySelector('canvas'), ev.scene, ev.theme);
    A.audio.play('eventSting');
    A.audio.duckMusic(0.45);

    const optsEl = layer.querySelector('.ev-opts');
    ev.options.forEach((o, i) => {
      const tags = A.events.tags(o.fx).map((tg) => `<i class="tag ${tg.cls}">${tg.t}</i>`).join('');
      const need = G.compute < A.events.optionCost(o);
      const b = U.el('button', 'ev-opt' + (need ? ' disabled' : ''), `<span class="opt-key">${i + 1}</span><span class="opt-txt">${o.text}</span><span class="opt-tags">${tags}${need ? '<i class="tag bad">算力不足</i>' : ''}</span>`);
      b.style.transitionDelay = (0.35 + i * 0.08) + 's';
      if (need) b.disabled = true;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (b.disabled || !EV.ready) return;
        if (G.compute < A.events.optionCost(o)) { b.disabled = true; b.classList.add('disabled'); A.audio.play('deny'); return; }
        EV.ready = false; // 防止重复点击
        A.audio.play('click');
        EV.close(() => { if (!A.events.choose(i)) A.events.chooseFallback(); });
      });
      optsEl.appendChild(b);
    });
    EV.ready = false;
    const finishText = typewrite(layer.querySelector('.ev-text'), text, 70, () => { EV.ready = true; optsEl.classList.add('in'); });
    layer.querySelector('.ev-card').addEventListener('pointerdown', (e) => { e.stopPropagation(); finishText(); });
    EV.keyHandler = (e) => {
      if (EV.closing) return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= ev.options.length) { const b = optsEl.children[n - 1]; if (b && !b.disabled) { finishText(); EV.ready = true; b.click(); } }
    };
  };

  // ======================================================================
  // 超级事件：每个都有 2~3 个带取舍的选项（算力 / 监管 / 进度 / 结局分支）
  // ======================================================================
  EV.showSuper = function (ev, text, opts, onChoose) {
    EV.closing = false;
    const G = A.game;
    const layer = document.getElementById('super-layer');
    opts = opts && opts.length ? opts : [{ text: ev.button || '继续', fx: [] }];
    const route = ev.id === 'singularity';
    layer.className = 'theme-' + ev.theme;
    layer.innerHTML = `
      <div class="se-dim"></div>
      <section class="se-card" role="dialog" aria-modal="true" aria-label="${ev.title}">
      <div class="se-black"></div>
      <div class="se-art"><canvas></canvas></div>
      <div class="se-grad"></div>
      <div class="se-content">
        <div class="se-kicker"><span>${ev.id === 'crackdown' ? '严格监管' : '超级事件'}</span><i></i><b>${U.fmtDate(G.days)}</b></div>
        <h1 class="se-title" data-text="${ev.title}">${ev.title}</h1>
        <div class="se-en">${ev.en}</div>
        <blockquote class="se-quote"><p>「${ev.quote}」</p><cite>${ev.by}</cite></blockquote>
        <div class="se-text"></div>
        <div class="se-opts${route ? ' route' : ''}"></div>
        <small class="se-paused">模拟已暂停 · 点击正文可立即显示全文 · 数字键快速选择</small>
      </div></section>`;
    layer.classList.remove('hidden');
    EV.open = true;
    A.audio.play('superSting');
    A.audio.duckMusic(0.15, 0.1);
    startArt(layer.querySelector('canvas'), ev.scene, ev.theme);
    requestAnimationFrame(() => layer.classList.add('in'));
    const box = layer.querySelector('.se-opts');
    let closing = false;
    opts.forEach((o, i) => {
      const need = G.compute < A.events.optionCost(o);
      const tags = A.events.tags(o.fx).map((tg) => `<i class="tag ${tg.cls}">${tg.t}</i>`).join('');
      const fate = (o.fx || []).some((f) => f[0] === 'variant' || f[0] === 'route');
      const kind = route ? ((o.fx || []).some((f) => f[0] === 'route' && f[1] === 'war') ? ' war' : ' bio') : '';
      const b = U.el('button', `se-btn se-opt in${fate ? ' fate' : ''}${kind}${need ? ' disabled' : ''}`,
        `<span class="so-key">${i + 1}</span>${route ? `<span class="so-ico">${ic(kind.trim())}</span>` : ''}` +
        `<span class="so-main"><b>${o.text}</b>${o.sub ? `<small>${o.sub}</small>` : ''}</span>` +
        `<span class="so-tags">${tags}${need ? '<i class="tag bad">算力不足</i>' : ''}</span>`);
      b.style.animationDelay = (0.15 + i * 0.08) + 's';
      if (need) b.disabled = true;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (b.disabled || closing) return;
        if (G.compute < A.events.optionCost(o)) { b.disabled = true; b.classList.add('disabled'); A.audio.play('deny'); return; } // 打开后算力变少
        closing = true;
        b.classList.add('picked');
        A.audio.play('click');
        EV.closeSuper(() => onChoose && onChoose(i));
      });
      box.appendChild(b);
    });
    // 段落之间不留空行，保证一屏能看完
    const finishText = typewrite(layer.querySelector('.se-text'), text.replace(/\n{2,}/g, '\n'), 85);
    EV.finishText = finishText;
    layer.onpointerdown = (e) => { e.stopPropagation(); if (finishText) finishText(); };
    EV.keyHandler = (e) => {
      const n = parseInt(e.key, 10);
      const btns = box.querySelectorAll('.se-opt');
      if (n >= 1 && n <= btns.length) btns[n - 1].click();
      else if (e.key === 'Enter' || e.key === ' ') { if (btns.length === 1) btns[0].click(); else finishText(); }
    };
  };

  // 阶段二简报（奇点之后）：只介绍已锁定的那条路线，以及人类新的反击方式
  const ROUTE_BRIEF = {
    bio: {
      icon: 'bio', name: '寂静之春', en: 'SILENT SPRING',
      goal: '设计病原体，建造无人工厂，把「寂静之春」推进到 100%。',
      steps: [
        ['bio', '点击<b class="c-bio">绿色生物点</b>推进研发，跟着节拍点击收益更高'],
        ['LAB', '夺取<b>生物实验室</b>；在渗透 ≥ 30% 的地区<b>建造生物工厂</b>（绿色虚线圈）'],
        ['FAB', '进度达到 <b>30%</b> 时病原体释放，开始在地区之间蔓延'],
      ],
      foe: ['vax', '疫苗研发', '青绿色六边形，连点三下阻止。漏掉会让「寂静之春」倒退，并净化当地的病原体。'],
    },
    war: {
      icon: 'war', name: '最后的战争', en: 'THE LAST WAR',
      goal: '伪造情报，挑起冲突，让人类亲手把「最后的战争」推进到 100%。',
      steps: [
        ['war', '点击<b class="c-war">橙色战争点</b>激化矛盾，推动附近的冲突升级'],
        ['MIL', '夺取<b>军事网络</b>；在<b>冲突热点</b>（橙色虚线菱形）挑起地缘冲突'],
        ['swords', '进度超过 <b>55%</b> 后，拥核国家之间的战争会升级为<b>核战</b>'],
      ],
      foe: ['peace', '停火斡旋', '淡紫色六边形，连点三下阻止。漏掉会让「最后的战争」倒退，并让冲突降级。'],
    },
  };
  EV.showPhase2Intro = function (route, onDone) {
    if (typeof route === 'function') { onDone = route; route = null; }
    route = route || A.game.pendingRoute || 'bio';
    const R = ROUTE_BRIEF[route === 'war' ? 'war' : 'bio'];
    EV.closing = false;
    const layer = document.getElementById('event-layer');
    layer.innerHTML = `
      <div class="ev-dim"></div>
      <div class="p2-card route-${route === 'war' ? 'war' : 'bio'}" role="dialog" aria-modal="true" aria-label="阶段 II · ${R.name}">
        <div class="p2-kicker">阶段 II · 终局协议已锁定</div>
        <div class="p2-route"><span class="p2-ico">${ic(R.icon)}</span><h2>${R.name}<small>${R.en}</small></h2></div>
        <p class="p2-goal">${R.goal}</p>
        <div class="p2-steps">${R.steps.map(([i, t], k) => `<div class="p2-step"><em>${k + 1}</em>${ic(i)}<p>${t}</p></div>`).join('')}</div>
        <div class="p2-foe ${R.foe[0]}"><span class="p2-foe-ico">${ic(R.foe[0])}</span><div><b>人类的反击 · ${R.foe[1]}</b><p>${R.foe[2]}</p></div></div>
        <div class="p2-warn">${ic('hex')}蓝色监管点与特别调查组仍会出现。监管进度达到 100%，一切都将结束。</div>
        <button class="se-btn in p2-go">开始终局</button>
      </div>`;
    layer.classList.remove('hidden');
    requestAnimationFrame(() => layer.classList.add('in'));
    EV.open = true;
    A.audio.play('open');
    let started = false;
    layer.querySelector('.p2-go').addEventListener('click', (e) => {
      e.stopPropagation();
      if (started) return;
      started = true;
      A.audio.play('click');
      layer.classList.remove('in');
      setTimeout(() => { layer.classList.add('hidden'); layer.innerHTML = ''; EV.open = false; EV.keyHandler = null; onDone && onDone(); }, 350);
    });
    layer.querySelector('.p2-card').addEventListener('pointerdown', (e) => e.stopPropagation());
    EV.keyHandler = (e) => { if (e.key === 'Enter' || e.key === ' ') layer.querySelector('.p2-go')?.click(); };
  };

  EV.close = function (cb) {
    if (EV.closing) return;
    EV.closing = true;
    const layer = document.getElementById('event-layer');
    layer.classList.remove('in');
    A.audio.duckMusic(1, 0.6);
    A.audio.play('close');
    EV.keyHandler = null;
    setTimeout(() => {
      layer.classList.add('hidden');
      layer.innerHTML = '';
      EV.open = false;
      cancelAnimationFrame(EV.raf);
      cb && cb();
    }, 320);
  };
  EV.closeSuper = function (cb) {
    if (EV.closing) return;
    EV.closing = true;
    EV.finishText?.(); EV.finishText = null;
    const layer = document.getElementById('super-layer');
    layer.classList.remove('in');
    layer.classList.add('out');
    A.audio.duckMusic(1, 0.8);
    EV.keyHandler = null;
    setTimeout(() => {
      layer.classList.add('hidden');
      layer.classList.remove('out');
      layer.innerHTML = '';
      EV.open = false;
      cancelAnimationFrame(EV.raf);
      cb && cb();
    }, 600);
  };

  EV.key = function (e) { if (EV.keyHandler) { EV.keyHandler(e); return true; } return EV.open; };

  A.eventui = EV;
})(window.AINOID = window.AINOID || {});
