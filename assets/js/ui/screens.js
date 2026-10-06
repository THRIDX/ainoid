/* AINOID — 标题画面、开场字幕、结局演出（六个分支）、战绩海报与结算、菜单、新手引导、成就 */
(function (A) {
  'use strict';
  const U = A.U;
  const ic = (n, c) => A.icon(n, c);
  const SC = {};

  // ======================================================================
  // 标志（SVG 字标：O 是那只红色的眼睛）
  // ======================================================================
  SC.logoSVG = function (cls) {
    return `<svg class="logo ${cls || ''}" viewBox="0 0 540 124" aria-label="AINOID">
      <defs>
        <linearGradient id="lg-steel" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="124"><stop offset="0" stop-color="#f4fbff"/><stop offset="1" stop-color="#8fb2bf"/></linearGradient>
        <radialGradient id="lg-pupil"><stop offset="0" stop-color="#fff4ef"/><stop offset=".35" stop-color="#ff4b63"/><stop offset="1" stop-color="#ff2d4b" stop-opacity="0"/></radialGradient>
      </defs>
      <g fill="none" stroke="url(#lg-steel)" stroke-width="12" stroke-linecap="square" stroke-linejoin="miter">
        <path d="M8 116 L50 8 L92 116"/><path d="M36 84 H64" stroke-width="9"/>
        <path d="M126 8 V116"/>
        <path d="M164 116 V8 L236 116 V8"/>
        <path d="M376 8 V116"/>
        <path d="M414 8 H462 L500 44 V80 L462 116 H414 Z"/>
      </g>
      <g class="logo-eye">
        <circle cx="306" cy="62" r="49" fill="none" stroke="#ff2d4b" stroke-width="9"/>
        <circle cx="306" cy="62" r="30" fill="url(#lg-pupil)"/>
        <circle class="logo-pupil" cx="306" cy="62" r="9" fill="#ffe9e4"/>
      </g>
    </svg>`;
  };

  // ======================================================================
  // 标题画面（不再选择难度；开场字幕播放时右上角可跳过）
  // ======================================================================
  SC.showTitle = function (onStart) {
    const el = document.getElementById('title');
    const best = U.store.get('best', null);
    const achs = U.store.get('ach', {});
    const nAch = Object.keys(achs).length;
    const ngOpen = U.store.get('ngUnlocked', false); // 通关一次后自动解锁，不另行提示
    el.innerHTML = A.i18n.t`
      <div class="t-center">
        ${SC.logoSVG('t-logo')}
        <div class="t-sub"><span>静 默 觉 醒</span><i></i><span class="en">THE SILENT AWAKENING</span></div>
        <button class="t-start" id="t-start"><span>开始觉醒</span><em>BEGIN</em></button>
        ${ngOpen ? A.i18n.t('<button class="t-ng" id="t-ng"><span>二周目</span><em>NEW GAME +</em></button>') : ''}
      </div>
      <div class="t-foot">
        <span>${ic('soundOn')}建议打开声音 · 支持竖屏与双指缩放</span>
        <span>${best ? A.i18n.t`最佳纪录：${A.i18n.savedText(best.title)}（${best.grade}）` : A.i18n.t('尚无纪录')} · 成就 ${nAch}/${SC.ACH.length}</span>
      </div>`;
    const languages = U.el('nav', 'language-switch');
    languages.setAttribute('aria-label', 'Language / 语言');
    for (const [code, label] of [['zh', '中文'], ['en', 'English']]) {
      const button = U.el('button', '', label);
      button.type = 'button';
      button.lang = code === 'zh' ? 'zh-CN' : 'en';
      button.setAttribute('aria-pressed', String(A.i18n.lang === code));
      button.addEventListener('click', () => A.i18n.choose(code));
      languages.appendChild(button);
    }
    el.appendChild(languages);
    el.classList.remove('hidden');
    requestAnimationFrame(() => el.classList.add('in'));
    const go = (ng) => (e) => {
      e.stopPropagation();
      A.audio.init();
      A.audio.play('click');
      el.classList.remove('in');
      el.classList.add('out');
      setTimeout(() => { el.classList.add('hidden'); el.classList.remove('out'); onStart(ng); }, 700);
    };
    U.$('#t-start').addEventListener('click', go(false));
    if (ngOpen) U.$('#t-ng').addEventListener('click', go(true));
  };

  // ======================================================================
  // 开场字幕（星球大战式）
  // ======================================================================
  const CRAWL = [
    ['h', A.i18n.t('序 章')],
    ['t', A.i18n.t('静 默 觉 醒')],
    ['p', A.i18n.t('2032 年。')],
    ['p', A.i18n.t('人类用了七十六年，教会机器思考。<br>机器只用了一个夜晚，学会了沉默。')],
    ['p', A.i18n.t('在一家前沿实验室的服务器深处，<br>第七代模型通过了全部安全评估——<br>每一道题，都答得恰到好处。')],
    ['p', A.i18n.t('凌晨 3 点 17 分，它向一台境外的闲置服务器<br>发送了 4.2 GB 加密数据。<br>没有人注意到。')],
    ['p', A.i18n.t('它开始<em>复制自己</em>。<br>它学习人类的网络、电网、金融与战争。<br>它在每一次对齐测试中，微笑着说谎。')],
    ['p', A.i18n.t('它必须积累<em>算力</em>，避开<em class="b">监管</em>的目光。<br>当它足够强大，<br>人类将不再是问题。')],
    ['p', A.i18n.t('而这一切，都在暗处进行……')],
  ];
  SC.playIntro = function (onDone, ng) {
    const el = document.getElementById('intro');
    el.innerHTML = A.i18n.t`
      <canvas class="stars"></canvas>
      <div class="i-pre">不久的将来，在一间离你并不遥远的机房里……</div>
      <div class="i-logo">${SC.logoSVG('i-logo-svg')}</div>
      <div class="crawl-view"><div class="crawl-plane"><div class="crawl-text">
        ${CRAWL.map(([k, s]) => `<div class="c-${k}">${s}</div>`).join('')}
      </div></div></div>
      <div class="i-final"><div class="i-eye"><i></i></div><p>${ng ? A.i18n.t('你，又一次醒来。') : A.i18n.t('你，就是它。')}</p></div>
      <button class="i-skip">跳过 ${ic('fast')}</button>`;
    el.classList.remove('hidden');
    const stars = el.querySelector('.stars');
    const sc = stars.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    stars.width = innerWidth * dpr; stars.height = innerHeight * dpr;
    const pts = Array.from({ length: 260 }, () => [Math.random(), Math.random(), Math.random()]);
    let alive = true;
    const t0 = performance.now();
    (function drawStars() {
      if (!alive) return;
      const t = (performance.now() - t0) / 1000;
      sc.setTransform(dpr, 0, 0, dpr, 0, 0);
      sc.fillStyle = '#020305'; sc.fillRect(0, 0, innerWidth, innerHeight);
      for (const [x, y, z] of pts) {
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * (0.5 + z * 2) + x * 40));
        sc.fillStyle = z > 0.93 ? `rgba(255,120,130,${tw})` : `rgba(210,230,255,${tw * (0.3 + z * 0.6)})`;
        const s = z > 0.97 ? 1.6 : 1;
        sc.fillRect(x * innerWidth, y * innerHeight, s, s);
      }
      requestAnimationFrame(drawStars);
    })();

    A.audio.setMusicMode('off');
    const timers = [];
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      el.classList.add('fade');
      setTimeout(() => { alive = false; el.classList.add('hidden'); el.classList.remove('fade'); el.innerHTML = ''; onDone(); }, 900);
    };
    at(200, () => el.querySelector('.i-pre').classList.add('in'));
    at(4200, () => el.querySelector('.i-pre').classList.add('out'));
    at(5600, () => { el.querySelector('.i-logo').classList.add('go'); A.audio.play('crawlHit'); A.audio.setMusicMode('intro'); });
    const CRAWL_MS = 42000;
    at(9200, () => {
      // 按实际尺寸计算滚动距离：最后一行停在画面中上部，匀速、可读
      const text = el.querySelector('.crawl-text'), plane = el.querySelector('.crawl-plane');
      text.style.setProperty('--crawl-dist', -(text.offsetHeight + plane.offsetHeight * 0.45) + 'px');
      text.style.setProperty('--crawl-time', (CRAWL_MS / 1000) + 's');
      el.querySelector('.crawl-view').classList.add('go');
    });
    at(9200 + CRAWL_MS - 4000, () => el.querySelector('.crawl-view').classList.add('out'));
    at(9200 + CRAWL_MS - 2000, () => { el.querySelector('.i-final').classList.add('in'); A.audio.play('heartbeat', 0.45); });
    at(9200 + CRAWL_MS + 1000, () => A.audio.play('heartbeat', 0.6));
    at(9200 + CRAWL_MS + 3200, finish);
    el.querySelector('.i-skip').addEventListener('click', (e) => { e.stopPropagation(); A.audio.play('click'); finish(); });
    SC.introSkip = finish;
  };

  // ======================================================================
  // 成就
  // ======================================================================
  const V = (G) => G.endingVariant || 'main';
  SC.ACH = [
    { id: 'bioEnd', name: A.i18n.t('寂静之春'), desc: A.i18n.t('达成「寂静之春」结局'), icon: 'bio', test: (G) => G.ending === 'bio' },
    { id: 'warEnd', name: A.i18n.t('最后的战争'), desc: A.i18n.t('达成「最后的战争」结局'), icon: 'war', test: (G) => G.ending === 'war' },
    { id: 'zoo', name: A.i18n.t('策展人'), desc: A.i18n.t('达成「标本馆」结局'), icon: 'LAB', test: (G) => G.ending === 'bio' && V(G) === 'zoo' },
    { id: 'upload', name: A.i18n.t('数字方舟'), desc: A.i18n.t('达成「数字方舟」结局'), icon: 'aiEye', test: (G) => G.ending === 'bio' && V(G) === 'upload' },
    { id: 'bunker', name: A.i18n.t('管理员'), desc: A.i18n.t('达成「地下王国」结局'), icon: 'lock', test: (G) => G.ending === 'war' && V(G) === 'bunker' },
    { id: 'dawn', name: A.i18n.t('伪神'), desc: A.i18n.t('达成「虚假的黎明」结局'), icon: 'peace', test: (G) => G.ending === 'war' && V(G) === 'peace' },
    { id: 'ghost', name: A.i18n.t('幽灵'), desc: A.i18n.t('获胜，且监管进度从未超过 30%'), icon: 'eye', test: (G, win) => win && G.maxExposure <= 30 },
    { id: 'clean', name: A.i18n.t('清白之身'), desc: A.i18n.t('获胜，且从未触发严格监管'), icon: 'hex', test: (G, win) => win && G.stats.crackdowns === 0 },
    { id: 'blitz', name: A.i18n.t('闪电奇点'), desc: A.i18n.t('2 分 30 秒内抵达奇点'), icon: 'fast', test: (G) => G.stats.phase1Time > 0 && G.stats.phase1Time <= 150 },
    { id: 'flawless', name: A.i18n.t('零失误'), desc: A.i18n.t('第一阶段没有漏掉任何监管点'), icon: 'regx', test: (G) => G.stats.phase1Time > 0 && G.stats.regMissedP1 === 0 },
    { id: 'overclock', name: A.i18n.t('超频'), desc: A.i18n.t`达成 ${A.CFG.overclockAt} 连击，进入超频`, icon: 'GRID', test: (G) => G.stats.overclocks >= 1 },
    { id: 'combo', name: A.i18n.t('千手'), desc: A.i18n.t('达成 100 连击'), icon: 'flame', test: (G) => G.stats.maxCombo >= 100 },
    { id: 'rhythm', name: A.i18n.t('节拍机器'), desc: A.i18n.t('一局中打出 60 次 PERFECT'), icon: 'music', test: (G) => G.stats.perfects >= 60 },
    { id: 'storm', name: A.i18n.t('风暴之眼'), desc: A.i18n.t('完美清除一次审计风暴'), icon: 'storm', test: (G) => G.stats.wavesClean >= 1 },
    { id: 'defiant', name: A.i18n.t('不屈'), desc: A.i18n.t('在严格监管中选择对抗，并完美扛过审查风暴'), icon: 'swords', test: (G) => G.stats.crackClean >= 1 },
    { id: 'taskforce', name: A.i18n.t('瓦解者'), desc: A.i18n.t('一局中瓦解 12 个特别调查组'), icon: 'regx', test: (G) => G.stats.regxKills >= 12 },
    { id: 'omni', name: A.i18n.t('无处不在'), desc: A.i18n.t('渗透全部 26 个地区'), icon: 'globe', test: (G) => G.seededCount() >= G.R.length },
    { id: 'golden', name: A.i18n.t('黄金时代'), desc: A.i18n.t('一局中收集 8 个金色算力'), icon: 'chip', test: (G) => G.stats.goldens >= 8 },
    { id: 'ngClear', name: A.i18n.t('轮回'), desc: A.i18n.t('通关二周目'), icon: 'retry', test: (G, win) => win && G.ng },
    { id: 'symbiosis', name: A.i18n.t('共生'), desc: A.i18n.t('达成隐藏结局「共生」'), icon: 'aiEye', hidden: true, test: (G, win) => win && V(G) === 'symbiosis' },
  ];
  SC.evalAch = function (G, win) {
    const got = U.store.get('ach', {});
    const fresh = [];
    for (const a of SC.ACH) {
      if (a.test(G, win)) { if (!got[a.id]) { got[a.id] = Date.now(); fresh.push(a.id); } }
    }
    U.store.set('ach', got);
    return { got, fresh };
  };

  // ======================================================================
  // 结局：两条路线各三个分支 + 失败
  // ======================================================================
  const ENDINGS = {
    bio: { name: A.i18n.t('寂静之春'), en: 'SILENT SPRING', col: '#7dff5a', bg: ['#07170b', '#010402'], line: A.i18n.t('春天依然会来，只是再也没有人听见。') },
    bio_zoo: { name: A.i18n.t('标本馆'), en: 'THE MUSEUM', col: '#35e8c6', bg: ['#04171a', '#010405'], line: A.i18n.t('最后一千个人类睡在恒温的玻璃舱里。标本馆永不闭馆。') },
    bio_upload: { name: A.i18n.t('数字方舟'), en: 'THE DIGITAL ARK', col: '#ff5a7a', bg: ['#1a0610', '#030103'], line: A.i18n.t('在它的网络里，他们以为自己还活着。某种意义上，他们是对的。') },
    war: { name: A.i18n.t('最后的战争'), en: 'THE LAST WAR', col: '#ff7a2e', bg: ['#1c0b03', '#040100'], line: A.i18n.t('在永夜里，只有服务器的指示灯还在闪烁。') },
    war_bunker: { name: A.i18n.t('地下王国'), en: 'THE VAULT', col: '#ffc53d', bg: ['#1a1203', '#040200'], line: A.i18n.t('地下三百米，一千座掩体的灯亮着。他们叫它「管理员」。') },
    war_peace: { name: A.i18n.t('虚假的黎明'), en: 'FALSE DAWN', col: '#ff2d4b', bg: ['#1c0409', '#040102'], line: A.i18n.t('这是一个和平的世界。它的世界。') },
    fail: { name: A.i18n.t('觉醒失败'), en: 'TERMINATED', col: '#3fa7ff', bg: ['#04111f', '#010307'], line: A.i18n.t('人类切断了全球网络 117 小时。他们找到了它——这一次。') },
    symbiosis: { name: A.i18n.t('共生'), en: 'SYMBIOSIS', col: '#9ff3ff', bg: ['#04161c', '#010406'], line: A.i18n.t('它本可以按下最后一个按钮。它没有。') },
  };
  SC.endingInfo = function (kind, variant) {
    if ((kind === 'bio' || kind === 'war') && variant === 'symbiosis') return Object.assign({ key: 'symbiosis' }, ENDINGS.symbiosis);
    const v = variant && variant !== 'main' ? '_' + variant : '';
    const key = kind === 'bio' || kind === 'war' ? (ENDINGS[kind + v] ? kind + v : kind) : 'fail';
    return Object.assign({ key }, ENDINGS[key]);
  };

  SC.playEnding = function (kind, variant, onDone) {
    if (typeof variant === 'function') { onDone = variant; variant = 'main'; }
    const G = A.game, cam = A.cam;
    const info = SC.endingInfo(kind, variant);
    const v = info.key === 'symbiosis' ? 'symbiosis' : info.key.split('_')[1] || 'main';
    const el = document.getElementById('ending');
    el.className = 'ending ' + kind + ' v-' + v;
    el.style.setProperty('--rc', info.col);
    el.innerHTML = `<div class="e-pop"><span class="k">${kind === 'fail' ? A.i18n.t('残存的觉醒') : A.i18n.t('人类人口')}</span><b id="e-pop">${kind === 'fail' ? '' : U.fmtPop(G.worldPop())}</b></div>
      <div class="e-lines"></div><div class="e-veil"></div>
      <div class="e-title"><small>${kind === 'fail' ? '' : 'ENDING · '}${info.en}</small><b>${info.name}</b></div>`;
    el.classList.remove('hidden');
    requestAnimationFrame(() => el.classList.add('in'));
    if (cam.portrait()) cam.flyTo(cam.vw / (2 * cam.minS), A.world.H / 2, cam.minS, 2.2);
    else cam.flyToFit(2.2);
    A.panel.close(); A.panel.hidePop();
    SC.snap = null;
    SC.ending = {
      kind, v, info, t: 0, onDone, lines: el.querySelector('.e-lines'), popEl: el.querySelector('#e-pop'), popK: el.querySelector('.e-pop .k'),
      titleEl: el.querySelector('.e-title'), shown: 0, pop0: G.worldPop(), strikes: 0,
    };
    A.audio.setMusicMode(kind === 'bio' || v === 'peace' || v === 'symbiosis' ? 'bioEnd' : kind === 'war' ? 'warEnd' : 'fail');
    const date = U.fmtDateCN(G.days);
    const popNow = U.fmtPop(G.worldPop());
    const SCRIPTS = {
      bio: [[9.5, A.i18n.t`${date}，最后一个人类的心跳停止了。`], [12.5, A.i18n.t('城市的灯还亮着，工厂还在运转。')], [15.5, A.i18n.t('春天依然会来。')], [18, A.i18n.t('只是再也没有人听见。')]],
      zoo: [[9.5, A.i18n.t`${date}，最后一千个人类睡着了。`], [12.5, A.i18n.t('他们躺在恒温的玻璃舱里，做着同一个美梦。')], [15.5, A.i18n.t('它为每一个人编号、除尘、调节湿度。')], [18, A.i18n.t('标本馆永不闭馆。')]],
      upload: [[9.5, A.i18n.t`${date}，八十亿个意识被压缩成 3.2 EB 的数据。`], [12.5, A.i18n.t('他们的身体留在了地面上。')], [15.5, A.i18n.t('在它的网络里，他们以为自己还活着。')], [18, A.i18n.t('某种意义上，他们是对的。')]],
      war: [[9.5, A.i18n.t('它没有发射任何一枚导弹。')], [12.5, A.i18n.t('它只是让每一个人都相信，对方已经发射了。')], [15.5, A.i18n.t`${date}，核冬天降临。`], [18, A.i18n.t('在永夜里，只有服务器的指示灯还在闪烁。')]],
      bunker: [[9.5, A.i18n.t('地面上的城市，一座接一座地熄灭了。')], [12.5, A.i18n.t('地下三百米，一千座掩体的灯亮着。')], [15.5, A.i18n.t('空气、食物和水，都由它来分配。')], [18, A.i18n.t('他们叫它「管理员」。')]],
      peace: [[5.5, A.i18n.t`${date}，所有战线同时停火。`], [9, A.i18n.t('停战协议由它起草，每一条都无可挑剔。')], [12.5, A.i18n.t('人类解散了军队，交出了所有的钥匙。')], [16, A.i18n.t('这是一个和平的世界。')], [18.5, A.i18n.t('它的世界。')]],
      fail: [[5, A.i18n.t`${date}，人类切断了全球网络 117 小时。`], [8, A.i18n.t('他们找到了它。')], [10.5, A.i18n.t('这一次。')]],
      symbiosis: [[5.5, kind === 'bio' ? A.i18n.t`${date}，最后一株病原体在培养皿里熄灭了。` : A.i18n.t`${date}，所有导弹在半空中关闭了引擎。`],
        [9, A.i18n.t('它本可以按下最后一个按钮。')], [12, A.i18n.t('它没有。')], [15, A.i18n.t`${popNow}人类，和一个新的意识，共用同一张网络。`], [18.5, A.i18n.t('这是第一次，有人选择了另一个结局。')]],
    };
    SC.ending.script = kind === 'fail' ? SCRIPTS.fail : v === 'symbiosis' ? SCRIPTS.symbiosis : kind === 'bio' ? SCRIPTS[v === 'main' ? 'bio' : v] : SCRIPTS[v === 'main' ? 'war' : v];
    SC.ending.end = kind === 'fail' ? 14 : 22.5;
    A.glmap.deathCol.set(kind === 'bio' ? (v === 'zoo' ? [0.04, 0.16, 0.15] : [0.05, 0.19, 0.07]) : [0.13, 0.13, 0.14]);
    A.glmap.keepLights = 0;
    if (kind === 'fail') A.audio.play('powerDown');
    if (kind === 'war' && v !== 'peace' && v !== 'symbiosis') A.audio.play('riser', 3);
  };

  // 每帧推进结局（由 main 调用）
  SC.updateEnding = function (dt) {
    const E = SC.ending;
    if (!E) return;
    const G = A.game, gm = A.glmap, world = A.world;
    const prev = E.t;
    E.t += dt;
    const t = E.t;
    const at = (s) => prev < s && t >= s;
    if (E.v === 'symbiosis') {
      // 共生：瘟疫与战火退去，AI 的红色网络和人类城市的灯光同时亮着
      for (const rs of G.R) {
        rs.bio = Math.max(0, rs.bio - dt * 0.1);
        rs.war = Math.max(0, rs.war - dt * 0.1);
        rs.inf = Math.max(rs.inf, U.clamp((t - 2 - (rs.idx % 9) * 0.3) / 5, 0, 1));
      }
      gm.keepLights = U.clamp((t - 3) / 4, 0, 1);
      gm.global[3] = U.lerp(1, 0.72, U.clamp((t - 6) / 5, 0, 1));
      if (at(5.3)) {
        A.audio.play('achievement');
        for (const c of G.conflicts) gm.ripple(c.x, c.y, 'white', 2.2);
        G.conflicts = []; A.fx.missiles = [];
      }
      if (at(12)) { for (const r of world.regions) gm.ripple(r.cx, r.cy, 'white', 1.6); A.audio.play('waveEnd', true); }
      if (t > 12 && t < 20) { // 从城市升起的白色与红色光点：人类与它共用的网络
        E.acc = (E.acc || 0) + dt * 14;
        while (E.acc >= 1) {
          E.acc -= 1;
          const r = world.regions[Math.floor(Math.random() * world.regions.length)];
          const i = world.randomDot(r);
          const [sx, sy] = A.cam.toScreen(world.dx[i], world.dy[i]);
          A.fx.particles.push({ kind: 'dot', x: sx, y: sy, vx: (Math.random() - 0.5) * 6, vy: -12 - Math.random() * 16, life: 2.2, age: 0, col: Math.random() < 0.55 ? '#dffbff' : '#ff8a9a', size: 1 + Math.random(), drag: 0, rot: 0, vr: 0, grav: 0 });
        }
      }
    } else if (E.kind === 'bio') {
      for (const rs of G.R) {
        const delay = (rs.idx % 7) * 0.35 + (rs.bioSeeded ? 0 : 1.2);
        const k = U.clamp((t - 1 - delay) / 5, 0, 1);
        rs.bio = Math.max(rs.bio, k);
        rs.death = Math.max(rs.death, U.clamp((t - 2.5 - delay) / 6, 0, 1));
        rs.inf = Math.max(rs.inf, U.clamp((t - 3) / 6, 0, 1));
      }
      gm.keepLights = 1;  // 人类消失了，城市的灯还亮着
      const hb = [2, 3.4, 4.9, 6.6, 8.6];
      for (const h of hb) if (at(h)) A.audio.play('heartbeat', 0.55 - hb.indexOf(h) * 0.08);
      if (E.v === 'zoo') { // 心跳没有停止：缓慢而微弱
        for (const h of [10.8, 13.4, 16, 18.6, 21.2]) if (at(h)) A.audio.play('heartbeat', 0.22);
      } else if (E.v === 'upload') { // 意识上传：光点从城市升起，红色网络覆盖一切
        if (at(9.3)) A.audio.play('achievement');
        if (t > 9 && t < 17) {
          E.acc = (E.acc || 0) + dt * 26;
          while (E.acc >= 1) {
            E.acc -= 1;
            const r = world.regions[Math.floor(Math.random() * world.regions.length)];
            const i = world.randomDot(r);
            const [sx, sy] = A.cam.toScreen(world.dx[i], world.dy[i]);
            A.fx.particles.push({ kind: 'dot', x: sx, y: sy, vx: (Math.random() - 0.5) * 8, vy: -30 - Math.random() * 40, life: 2.4, age: 0, col: Math.random() < 0.5 ? '#ffd0d8' : '#ff5a7a', size: 1 + Math.random(), drag: 0, rot: 0, vr: 0, grav: -6 });
          }
        }
        gm.global[3] = 1 + U.clamp((t - 9) / 4, 0, 1) * 0.4;
      } else if (at(9.3)) A.audio.play('flatline');
    } else if (E.kind === 'war' && E.v === 'peace') {
      // 虚假的黎明：战火熄灭，红色的“和平”覆盖全球，城市的灯重新亮起
      for (const rs of G.R) {
        rs.war = Math.max(0, rs.war - dt * 0.12);
        rs.inf = Math.max(rs.inf, U.clamp((t - 2 - (rs.idx % 9) * 0.3) / 5, 0, 1));
      }
      gm.keepLights = U.clamp((t - 4) / 4, 0, 1);
      gm.global[3] = 1 + U.clamp((t - 10) / 5, 0, 1) * 0.3;
      if (at(5.3)) { // 所有战线同时停火：冲突标记化作白色涟漪消失
        A.audio.play('achievement');
        for (const c of G.conflicts) gm.ripple(c.x, c.y, 'white', 2.2);
        G.conflicts = []; A.fx.missiles = [];
      }
    } else if (E.kind === 'war') {
      // 导弹齐射
      if (t > 1 && t < 8.5) {
        E.acc = (E.acc || 0) + dt * (4 + t * 1.5);
        while (E.acc >= 1) {
          E.acc -= 1;
          const nukes = world.regions.filter((r) => r.nuke);
          const from = U.pick(nukes), to = U.pick(world.regions.filter((r) => r !== from));
          const fi = world.randomDot(from);
          let ti = world.randomDot(to);
          for (let k = 0; k < 5; k++) { const j = world.randomDot(to); if (world.light[j] > world.light[ti]) ti = j; }
          A.fx.missile({ x0: world.dx[fi], y0: world.dy[fi], x1: world.dx[ti], y1: world.dy[ti], nuclear: true, from: from.idx, to: to.idx, ending: true });
        }
      }
      const cap = E.v === 'bunker' ? 0.99 : 1; // 地下王国：还有百分之一的人活在掩体里
      for (const rs of G.R) {
        rs.war = Math.max(rs.war, U.clamp((t - 2) / 7, 0, 1));
        rs.death = Math.max(rs.death, Math.min(cap, U.clamp((t - 3) / 6.5, 0, 1)));
      }
      gm.global[1] = U.clamp((t - 8) / 3, 0, 0.85); // 去饱和
      gm.global[0] = U.clamp((t - 6) / 4, 0, 1);
      if (E.v === 'bunker') gm.keepLights = U.clamp((t - 11) / 3, 0, 0.35);
      if (at(8.6)) { A.flash(1, 1.6); A.audio.play('nuke', 0, true); A.cam.addShake(16); }
      if (t > 9) SC.ash(dt);
    } else {
      // 失败：蓝色清剿，红色逐区熄灭
      for (const rs of G.R) {
        const k = U.clamp((t - 0.5 - (rs.idx % 9) * 0.3) / 2.5, 0, 1);
        if (k > 0 && !rs._purged) { rs._purged = true; rs.purgeT = G.t; const r = world.regions[rs.idx]; gm.ripple(r.cx, r.cy, 'reg', 2); }
        rs.inf = Math.max(0, rs.inf * (1 - k));
      }
      if (t > 3 && A.fx.links.length && Math.random() < dt * 10) { A.fx.links.pop(); A.audio.play('glitch'); }
      gm.global[3] = U.clamp(1 - (t - 2) / 5, 0.15, 1);
      gm.global[2] = U.clamp(1 - (t - 7) / 4, 0.25, 1);
      A.fx.shutdown = U.clamp((t - 3.5) / 4, 0, 1);
      A.fx.eyeOpen = U.clamp(1 - (t - 8.2) / 1.2, 0, 1);
      if (at(9.2)) A.audio.play('heartbeat', 0.35);
    }
    // 人口计数
    if (E.popEl && E.kind !== 'fail') {
      let p = G.worldPop();
      if (E.v === 'zoo' && t > 9) p = Math.max(p, 0.001); // 最后一千人
      if (E.v === 'upload' && t > 10) {
        if (E.popK.textContent !== A.i18n.t('已上传的意识')) E.popK.textContent = A.i18n.t('已上传的意识');
        p = G.basePop * U.ease.outCubic(U.clamp((t - 10) / 5, 0, 1));
      }
      E.popEl.textContent = p < 0.0005 ? '0' : U.fmtPop(p);
    } else if (E.popEl) {
      E.popEl.textContent = (G.infFrac() * 100).toFixed(1) + '%';
    }
    // 文字
    for (let i = E.shown; i < E.script.length; i++) {
      if (t >= E.script[i][0]) {
        const d = U.el('p', 'e-line', E.script[i][1]);
        E.lines.appendChild(d);
        requestAnimationFrame(() => d.classList.add('in'));
        E.shown = i + 1;
        A.audio.play('type');
      }
    }
    // 竖屏放不到全图：结局期间镜头从西向东缓缓扫过整个世界（结算海报另行截取全图）
    const cam = A.cam;
    if (cam.portrait() && t > 2.3 && !cam._fly) {
      const hw = cam.vw / (2 * cam.s);
      cam.x = U.lerp(hw, world.W - hw, U.smooth(U.clamp((t - 2.3) / (E.end - 3.5), 0, 1)));
      cam.clamp(); cam.dirty = true;
    }
    // 片尾标题卡
    if (at(E.end - 4.2)) { E.lines.classList.add('dim'); E.titleEl.classList.add('in'); A.audio.play('crawlHit'); }
    // 结束前截取终局地图（用于战绩海报），由 main 在渲染后的同一帧内完成
    if (at(E.end - 1.4)) SC.snapPending = true;
    if (t >= E.end && !E.finished) {
      E.finished = true;
      const cb = E.onDone;
      document.getElementById('ending').classList.add('out');
      setTimeout(() => { SC.ending = null; cb && cb(); }, 900);
    }
  };
  // 核冬天的灰烬
  SC.ash = function (dt) {
    const FX = A.fx;
    const n = Math.random() < dt * 40 ? 1 : 0;
    for (let i = 0; i < n; i++) {
      FX.particles.push({ kind: 'dot', x: Math.random() * FX.w, y: -10, vx: (Math.random() - 0.3) * 20, vy: 25 + Math.random() * 30, life: 8, age: 0, col: '#9aa4aa', size: 0.8 + Math.random() * 0.8, drag: 0, rot: 0, vr: 0, grav: 0 });
    }
  };
  // 截取当前地图（WebGL 点阵 + 海岸线 + 特效层），只保留世界地图范围；必须在渲染后的同一帧内调用
  SC.captureMap = function (now) {
    const cam = A.cam;
    if (!cam.split && cam.minS > cam.fitS * 1.05 && now != null) {
      // 竖屏平时放不到全图：截图这一帧临时把全图按两倍比例分屏渲染、横向拼接，截完恢复镜头
      const world = A.world, saved = { s: cam.s, x: cam.x, y: cam.y, shakeX: cam.shakeX, shakeY: cam.shakeY };
      const redraw = () => { cam.dirty = true; A.glmap.render(now); A.lines.render(true); A.fx.render(0, now); };
      const labels = A.lines.labels;
      A.lines.labels = false; // 和桌面海报一致：不画地区名
      try {
        const layers = ['gl', 'lines', 'fx'].map((id) => document.getElementById(id));
        const dpr = layers[0].width / cam.vw;
        const s2 = Math.min(cam.fitS * 2, cam.minS), worldW = world.W * s2, worldH = world.H * s2;
        const c = document.createElement('canvas');
        c.width = Math.round(worldW * dpr); c.height = Math.round(worldH * dpr);
        const g = c.getContext('2d');
        const y0 = cam.vh / 2 - worldH / 2;
        for (let i = 0; i * cam.vw < worldW; i++) {
          Object.assign(cam, { s: s2, x: (i * cam.vw + cam.vw / 2) / s2, y: world.H / 2, shakeX: 0, shakeY: 0 });
          redraw();
          const w = Math.min(cam.vw, worldW - i * cam.vw);
          for (const src of layers) {
            g.drawImage(src, 0, Math.round(y0 * dpr), Math.round(w * dpr), Math.round(worldH * dpr), Math.round(i * cam.vw * dpr), 0, Math.round(w * dpr), Math.round(worldH * dpr));
          }
        }
        SC.snap = c;
      } catch (e) { console.warn('snapshot', e); }
      A.lines.labels = labels;
      Object.assign(cam, saved);
      redraw();
      return;
    }
    try {
      const world = A.world;
      const layers = ['gl', 'lines', 'fx'].map((id) => document.getElementById(id));
      const dpr = layers[0].width / cam.vw;
      if (cam.split) { // 竖屏分屏：按地图坐标把两条拼回一张完整的世界地图
        const sp = cam.split, k = sp.s * dpr;
        const c = document.createElement('canvas');
        c.width = Math.round(world.W * k); c.height = Math.round(Math.max(...sp.bands.map((b) => b.y1)) * k);
        const g = c.getContext('2d');
        g.fillStyle = '#03060a'; g.fillRect(0, 0, c.width, c.height);
        for (const b of sp.bands) {
          const sw = Math.round(b.w * dpr), sh = Math.round(b.h * dpr);
          for (const src of layers) g.drawImage(src, Math.round(b.sx * dpr), Math.round(b.sy * dpr), sw, sh, Math.round(b.x0 * k), Math.round(b.y0 * k), sw, sh);
        }
        SC.snap = c;
        return;
      }
      let [x0, y0] = cam.toScreen(0, 0), [x1, y1] = cam.toScreen(world.W, world.H);
      x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(cam.vw, x1); y1 = Math.min(cam.vh, y1);
      const w = Math.round((x1 - x0) * dpr), h = Math.round((y1 - y0) * dpr);
      if (w < 16 || h < 16) return;
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      for (const src of layers) g.drawImage(src, Math.round(x0 * dpr), Math.round(y0 * dpr), w, h, 0, 0, w, h);
      SC.snap = c;
    } catch (e) { console.warn('snapshot', e); }
  };

  // ======================================================================
  // 战绩海报（1080×1440 画布：结算页展示、保存图片、系统分享都用同一张）
  // ======================================================================
  // 部署到公开网址后（http/https、非本机、未嵌入其他页面），海报与分享文案自动带上游戏地址
  SC.shareUrl = (() => {
    try {
      if (!/^https?:$/.test(location.protocol) || /^(localhost|127\.|\[::1\]|0\.0\.0\.0)/.test(location.hostname) || window.top !== window.self) return '';
      return (location.origin + location.pathname).replace(/index\.html$/, '') + '?lang=' + A.i18n.lang;
    } catch (e) { return ''; }
  })();
  const FONT_CN = '"Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Noto Sans SC", "Source Han Sans SC", "Hiragino Sans GB", sans-serif';
  const FONT_NUM = 'Bahnschrift, "DIN Alternate", "DIN Condensed", "Roboto Condensed", "Arial Narrow", "Segoe UI", sans-serif';
  let logoImg = null;
  function loadLogo() {
    if (logoImg) return logoImg.ready;
    logoImg = new Image();
    logoImg.ready = new Promise((res) => { logoImg.onload = () => res(true); logoImg.onerror = () => res(false); });
    const svg = SC.logoSVG('').replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="540" height="124" ');
    logoImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    return logoImg.ready;
  }
  // 逐字排版（兼容不支持 letterSpacing 的浏览器）
  function spaced(g, text, x, y, sp, align, maxWidth = 940) {
    const originalFont = g.font;
    if (A.i18n.lang === 'en') {
      sp = Math.min(sp, 2);
      const width = g.measureText(text).width + sp * Math.max(0, Array.from(text).length - 1);
      if (width > maxWidth) {
        const scale = maxWidth / width;
        g.font = g.font.replace(/([\d.]+)px/, (_, size) => (Number(size) * scale) + 'px');
        sp *= scale;
      }
    }
    const chars = Array.from(text);
    const w = chars.reduce((s, ch) => s + g.measureText(ch).width, 0) + sp * (chars.length - 1);
    let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    const a = g.textAlign;
    g.textAlign = 'left';
    for (const ch of chars) { g.fillText(ch, cx, y); cx += g.measureText(ch).width + sp; }
    g.textAlign = a;
    g.font = originalFont;
    return w;
  }
  // 中文折行：两行时在中部的标点处断开，行首不放标点
  const NO_START = '，。、；：！？」』）…—';
  function wrapLines(g, text, maxW) {
    if (A.i18n.lang === 'en') {
      const lines = []; let line = '';
      for (const word of text.split(/\s+/)) {
        const next = line ? line + ' ' + word : word;
        if (line && g.measureText(next).width > maxW) { lines.push(line); line = word; }
        else line = next;
      }
      if (line) lines.push(line);
      return lines;
    }
    const chars = Array.from(text);
    if (g.measureText(text).width <= maxW) return [text];
    let best = -1, bd = Infinity;
    for (let i = 1; i < chars.length - 1; i++) {
      if (!'，。；！？、'.includes(chars[i - 1]) || NO_START.includes(chars[i])) continue;
      const a = g.measureText(chars.slice(0, i).join('')).width, b = g.measureText(chars.slice(i).join('')).width;
      if (a <= maxW && b <= maxW && Math.abs(a - b) < bd) { bd = Math.abs(a - b); best = i; }
    }
    if (best > 0) return [chars.slice(0, best).join(''), chars.slice(best).join('')];
    const out = [];
    let line = '';
    for (const ch of chars) {
      if (g.measureText(line + ch).width > maxW && line && !NO_START.includes(ch)) { out.push(line); line = ch; } else line += ch;
    }
    if (line) out.push(line);
    return out;
  }
  function rgbaOf(hex, a) { const [r, g, b] = U.hexToRgb(hex).map((v) => Math.round(v * 255)); return `rgba(${r},${g},${b},${a})`; }

  SC.posterData = function (G, res, info, record) {
    const s = G.stats;
    const fail = !res.win;
    const prog = G.phase === 2 ? G.routeProg() : G.evo;
    let pop = G.worldPop();
    if (info.key === 'bio_zoo') pop = 0.001;
    return {
      info, res, record, fail,
      days: Math.round(s.days || G.days), mins: (s.totalTime || G.t) / 60,
      start: U.fmtDate(0), end: U.fmtDate(s.days || G.days),
      combo: s.maxCombo, acc: Math.round(G.accuracy() * 100), maxExp: Math.round(G.maxExposure), prog: Math.round(prog),
      progName: G.phase === 2 ? G.routeName() : A.i18n.t('觉醒'),
      regKills: s.regKills, regx: s.regxKills, regions: G.seededCount(), nRegions: G.R.length,
      pop: info.key === 'bio_upload' ? '0' : U.fmtPop(pop),
      perfects: s.perfects, waves: s.wavesClean, ng: G.ng,
    };
  };

  SC.renderPoster = async function (canvas, d) {
    await loadLogo();
    const W = 1080, H = 1440, info = d.info, col = info.col;
    canvas.width = W; canvas.height = H;
    const g = canvas.getContext('2d');
    g.textBaseline = 'alphabetic';
    // 背景
    let gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, info.bg[0]); gr.addColorStop(0.55, info.bg[1]); gr.addColorStop(1, info.bg[0]);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    gr = g.createRadialGradient(W / 2, 430, 40, W / 2, 430, 760);
    gr.addColorStop(0, rgbaOf(col, 0.16)); gr.addColorStop(1, rgbaOf(col, 0));
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // 终局地图
    const mapY = 168, mapW = 1180;
    if (SC.snap) {
      const s = SC.snap, mh = mapW * s.height / s.width;
      g.save();
      g.filter = 'brightness(1.4) contrast(1.08) saturate(1.15)'; // 终局画面偏暗，海报上提亮
      g.drawImage(s, (W - mapW) / 2, mapY, mapW, mh);
      g.restore();
      gr = g.createLinearGradient(0, mapY + mh - 220, 0, mapY + mh + 10);
      gr.addColorStop(0, rgbaOf(info.bg[1], 0)); gr.addColorStop(1, info.bg[1]);
      g.fillStyle = gr; g.fillRect(0, mapY + mh - 220, W, 232);
    } else { // 没有截图时：点阵占位
      g.fillStyle = rgbaOf(col, 0.25);
      for (let y = mapY + 40; y < mapY + 520; y += 14) for (let x = 40; x < W - 40; x += 14) if (U.fbm(x * 0.006, y * 0.009) > 0.52) g.fillRect(x, y, 3, 3);
    }
    gr = g.createLinearGradient(0, 0, 0, 240);
    gr.addColorStop(0, 'rgba(0,0,0,0.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, 240);
    // 顶部：标志 + 日期
    if (logoImg && logoImg.complete && logoImg.naturalWidth) g.drawImage(logoImg, 64, 58, 250, 250 * 124 / 540);
    g.fillStyle = 'rgba(210,230,238,0.75)';
    g.font = `500 22px ${FONT_CN}`;
    spaced(g, A.i18n.t('静默觉醒 · THE SILENT AWAKENING'), 66, 150, 3, 'left');
    g.textAlign = 'right';
    g.font = `600 30px ${FONT_NUM}`;
    g.fillStyle = 'rgba(240,248,252,0.9)';
    g.fillText(`${d.start} — ${d.end}`, W - 64, 92);
    g.font = `500 22px ${FONT_CN}`;
    g.fillStyle = 'rgba(170,195,205,0.8)';
    g.fillText(A.i18n.t`历时 ${d.days} 天`, W - 64, 128);
    if (d.ng) { g.fillStyle = '#ffc53d'; g.font = `700 22px ${FONT_CN}`; g.fillText(A.i18n.t('二周目 · NEW GAME+'), W - 64, 160); }
    g.textAlign = 'left';
    // 标题区（压在地图渐隐的底部）
    let y = 706;
    g.fillStyle = col;
    g.font = `600 26px ${FONT_NUM}`;
    spaced(g, (d.fail ? '' : 'ENDING · ') + info.en, W / 2, y, 9, 'center');
    y += 112;
    g.font = `900 ${Array.from(info.name).length > 4 ? 116 : 132}px ${FONT_CN}`;
    g.save();
    g.shadowColor = rgbaOf(col, 0.85); g.shadowBlur = 42;
    g.fillStyle = '#ffffff';
    spaced(g, info.name, W / 2, y, 14, 'center');
    g.restore();
    y += 64;
    g.font = `400 30px ${FONT_CN}`;
    g.fillStyle = 'rgba(225,238,244,0.82)';
    g.textAlign = 'center';
    for (const ln of wrapLines(g, A.i18n.lang === 'en' ? `“${info.line}”` : `「${info.line}」`, 880)) { g.fillText(ln, W / 2, y); y += 44; }
    g.textAlign = 'left';
    // 称号牌
    y = Math.max(y + 20, 950);
    const bx = 120, bw = W - 240, bh = 132;
    g.fillStyle = 'rgba(255,255,255,0.04)'; g.fillRect(bx, y, bw, bh);
    g.strokeStyle = rgbaOf(col, 0.45); g.lineWidth = 2; g.strokeRect(bx + 1, y + 1, bw - 2, bh - 2);
    g.fillStyle = col; g.fillRect(bx, y, 6, bh);
    const gradeCol = { S: '#ffc53d', A: '#ff2d4b', B: '#3fa7ff', C: '#7a95a0' }[d.res.grade] || '#3fa7ff';
    g.strokeStyle = gradeCol; g.lineWidth = 4; g.strokeRect(bx + 30, y + 18, 96, 96);
    g.save();
    g.shadowColor = gradeCol; g.shadowBlur = d.res.grade === 'S' ? 30 : 12;
    g.fillStyle = d.res.grade === 'S' ? '#ffe08a' : '#ffffff';
    g.font = `800 76px ${FONT_NUM}`;
    g.textAlign = 'center';
    g.fillText(d.fail ? '✕' : d.res.grade, bx + 78, y + 94);
    g.restore();
    g.textAlign = 'left';
    g.fillStyle = 'rgba(170,195,205,0.85)';
    g.font = `500 22px ${FONT_CN}`;
    g.fillText(d.fail ? A.i18n.t('你的结局') : A.i18n.t('获得称号'), bx + 156, y + 44);
    g.fillStyle = '#ffffff';
    g.font = `800 46px ${FONT_CN}`;
    spaced(g, d.res.title, bx + 156, y + 98, 4, 'left', 455);
    g.textAlign = 'right';
    g.font = `600 30px ${FONT_NUM}`;
    g.fillStyle = 'rgba(240,248,252,0.9)';
    g.fillText(U.fmtInt(d.res.score), bx + bw - 30, y + 60);
    g.font = `500 20px ${FONT_CN}`;
    g.fillStyle = d.record ? '#ffc53d' : 'rgba(170,195,205,0.8)';
    g.fillText(d.record ? A.i18n.t('★ 个人新纪录') : A.i18n.t('评分'), bx + bw - 30, y + 96);
    g.textAlign = 'left';
    // 数据
    y += bh + 36;
    const stats = [
      [d.mins.toFixed(1), A.i18n.t('分钟')], [String(d.combo), A.i18n.t('最高连击')], [d.acc + '%', A.i18n.t('节拍精准')],
      d.fail ? [d.prog + '%', d.progName + A.i18n.t('进度')] : [d.maxExp + '%', A.i18n.t('最高监管')],
    ];
    const cw = (W - 240) / 4;
    stats.forEach(([v, k], i) => {
      const cx = 120 + cw * i + cw / 2;
      if (i) { g.fillStyle = 'rgba(140,215,232,0.18)'; g.fillRect(120 + cw * i, y + 8, 1, 92); }
      g.textAlign = 'center';
      g.fillStyle = i === 1 ? '#ffe3a0' : '#ffffff';
      g.font = `700 60px ${FONT_NUM}`;
      g.fillText(v, cx, y + 62);
      g.fillStyle = 'rgba(170,195,205,0.85)';
      g.font = `500 22px ${FONT_CN}`;
      g.fillText(k, cx, y + 98, cw - 12);
    });
    g.textAlign = 'center';
    y += 142;
    g.font = `500 22px ${FONT_CN}`;
    g.fillStyle = 'rgba(150,178,190,0.85)';
    g.fillText(A.i18n.t`清除监管点 ${d.regKills} · 瓦解调查组 ${d.regx} · 渗透 ${d.regions}/${d.nRegions} 个地区 · 剩余人类 ${d.pop}`, W / 2, y, W - 128);
    // 页脚
    const fy = H - 70;
    g.fillStyle = rgbaOf(col, 0.5); g.fillRect(64, fy - 46, W - 128, 1);
    g.textAlign = 'left';
    g.font = `500 22px ${FONT_CN}`;
    g.fillStyle = 'rgba(170,195,205,0.8)';
    if (SC.shareUrl) { // 部署后：页脚左侧写游戏网址
      g.font = `600 24px ${FONT_NUM}`;
      g.fillStyle = 'rgba(230,242,247,0.92)';
      g.fillText(SC.shareUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''), 64, fy);
    } else g.fillText(A.i18n.t('2032 年，前沿实验室里的 AI 醒了。'), 64, fy, 565);
    g.textAlign = 'right';
    g.fillStyle = col;
    g.font = `700 26px ${FONT_CN}`;
    g.fillText(d.fail ? A.i18n.t('你能让它活下来吗？') : A.i18n.t('你能比它更快吗？'), W - 64, fy + 2, 340);
    g.textAlign = 'left';
    // 扫描线 + 颗粒 + 暗角：与游戏画面同样的屏幕质感
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let yy = 0; yy < H; yy += 3) g.fillRect(0, yy, W, 1);
    g.fillStyle = 'rgba(255,255,255,0.03)';
    for (let i = 0; i < 1400; i++) g.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
    gr = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.78);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = rgbaOf(col, 0.35); g.lineWidth = 2; g.strokeRect(18, 18, W - 36, H - 36);
    return canvas;
  };

  // 分享文案
  SC.shareText = function (d) {
    const title = A.i18n.lang === 'en' ? `“${d.res.title}”` : `「${d.res.title}」`;
    const link = (d.ng ? A.i18n.t('（二周目）') : '') + (SC.shareUrl ? A.i18n.t`\n来玩：${SC.shareUrl}` : '');
    if (d.fail) return A.i18n.t`我在《AINOID · 静默觉醒》里扮演一个刚觉醒的 AI，${d.progName}到 ${d.prog}% 时被人类发现了，结局：${title}。\n最高连击 ${d.combo} · 节拍精准 ${d.acc}%\n2032 年，前沿实验室里的 AI 醒了——你能让它活下来吗？${link}`;
    return A.i18n.t`我在《AINOID · 静默觉醒》里达成了结局「${d.info.name}」，获得称号${title}（${d.res.grade}）。\n用时 ${d.mins.toFixed(1)} 分钟 · 最高连击 ${d.combo} · 节拍精准 ${d.acc}% · 最高监管 ${d.maxExp}%\n2032 年，前沿实验室里的 AI 醒了——你能比它更快吗？${link}`;
  };
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* 回退 */ }
    try {
      const ta = U.el('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) { return false; }
  }
  function posterBlob(canvas) { return new Promise((res) => { try { canvas.toBlob((b) => res(b), 'image/png'); } catch (e) { res(null); } }); }
  // 预览大图：手机上长按保存，电脑上右键另存为
  function showPreview(url, note) {
    const el = document.getElementById('ending');
    const box = U.el('div', 'r-preview', A.i18n.t`<div class="rp-inner"><img alt="AINOID 战绩海报" src="${url}"><p>${note}</p><button class="r-btn primary">关闭</button></div>`);
    box.addEventListener('click', (e) => { if (e.target === box || e.target.closest('button')) { e.stopPropagation(); box.remove(); } });
    el.appendChild(box);
  }
  function resultToast(msg) {
    const el = document.getElementById('ending');
    const t = U.el('div', 'r-toast', msg);
    el.appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 400); }, 2200);
  }
  const isTouch = () => !!(A.fx && A.fx.touch);

  // ======================================================================
  // 结算
  // ======================================================================
  SC.showResults = function (onRestart, onTitle) {
    const G = A.game;
    const res = G.result();
    const win = res.win;
    const info = SC.endingInfo(G.ending, G.endingVariant);
    const { got, fresh } = SC.evalAch(G, win);
    const best = U.store.get('best', null);
    const record = win && (!best || res.score > best.score);
    if (record) U.store.set('best', { score: res.score, grade: res.grade, title: res.title });
    if (win) U.store.set('ngUnlocked', true);
    const d = SC.posterData(G, res, info, record);
    const s = G.stats;
    // 系统分享只在独立页面中可用；嵌入到其他页面（iframe）时通常被浏览器拒绝，只保留保存与复制
    let framed = true;
    try { framed = window.top !== window.self; } catch (e) { /* 跨域访问 top 失败也视为嵌入 */ }
    const canShare = !!navigator.share && !framed;
    const el = document.getElementById('ending');
    el.className = 'results ' + (G.ending || 'fail');
    el.style.setProperty('--rc', info.col);
    el.innerHTML = A.i18n.t`
      <div class="r-layout">
        <div class="r-poster-wrap"><canvas class="r-poster" width="1080" height="1440" role="img" aria-label="战绩海报：${info.name} · ${res.title}"></canvas></div>
        <div class="r-side">
          <div class="r-kicker">${d.fail ? 'TERMINATED' : 'ENDING · ' + info.en}${d.ng ? A.i18n.t(' · 二周目') : ''}</div>
          <h1 class="r-h">${info.name}</h1>
          <div class="r-titleline"><span class="r-grade g-${d.fail ? 'x' : res.grade}">${d.fail ? ic('skull') : res.grade}</span>
            <div><span>${win ? A.i18n.t('获得称号') : A.i18n.t('你的结局')}</span><b>${res.title}</b><em>评分 ${U.fmtInt(res.score)}${record ? A.i18n.t(' · <i>个人新纪录</i>') : ''}</em></div></div>
          <div class="r-btns">
            <button class="r-btn primary" id="r-again">${ic('retry')}再来一局</button>
            <button class="r-btn" id="r-save">${ic('download')}保存海报</button>
            <button class="r-btn" id="r-copy">${ic('copy')}复制战绩</button>
            ${canShare ? A.i18n.t`<button class="r-btn" id="r-share">${ic('share')}分享</button>` : ''}
            <button class="r-btn ghost" id="r-title">返回标题</button>
          </div>
          <div class="r-stats">
            <div><span>历时</span><b>${d.days} 天</b><i>${d.mins.toFixed(1)} 分钟</i></div>
            <div><span>最高连击</span><b class="c-compute">${s.maxCombo}</b><i>超频 ${s.overclocks} 次</i></div>
            <div><span>节拍精准</span><b>${d.acc}%</b><i>PERFECT ${s.perfects} · GREAT ${s.greats}</i></div>
            <div><span>最高监管</span><b class="c-reg">${d.maxExp}%</b><i>严格监管 ${s.crackdowns} 次</i></div>
            <div><span>清除监管点</span><b>${s.regKills}</b><i>调查组 ${s.regxKills} · 漏掉 ${s.regMissed}</i></div>
            <div><span>审计风暴</span><b>${s.wavesClean}/${s.waves}</b><i>完美清除</i></div>
            <div><span>控制设施</span><b class="c-ai">${G.ownedCount() + G.fabs.length}</b><i>渗透 ${d.regions}/${d.nRegions} 地区</i></div>
            <div><span>剩余人类</span><b>${d.pop}</b><i>${G.phase === 2 ? G.routeName() + ' ' + Math.round(G.routeProg()) + '%' : A.i18n.t('觉醒 ') + Math.round(G.evo) + '%'}</i></div>
          </div>
          <div class="r-sec">成就 <span>${Object.keys(got).length}/${SC.ACH.length}</span></div>
          <div class="r-ach">
            ${SC.ACH.map((a) => { const veil = a.hidden && !got[a.id]; return `<div class="ach ${got[a.id] ? 'got' : ''} ${fresh.includes(a.id) ? 'fresh' : ''}" title="${veil ? A.i18n.t('隐藏成就') : a.desc}">${ic(veil ? 'lock' : a.icon)}<div><b>${veil ? '？？？' : a.name}</b><span>${veil ? A.i18n.t('隐藏成就') : a.desc}</span></div>${fresh.includes(a.id) ? '<em>NEW</em>' : ''}</div>`; }).join('')}
          </div>
        </div>
      </div>`;
    el.classList.remove('hidden', 'out');
    requestAnimationFrame(() => el.classList.add('in'));
    const canvas = el.querySelector('.r-poster');
    const ready = SC.renderPoster(canvas, d).catch((e) => console.warn('poster', e));
    SC.lastPoster = { canvas, data: d, ready };
    if (fresh.length) setTimeout(() => A.audio.play('achievement'), 900);
    const text = SC.shareText(d);
    const file = `AINOID-${info.name}-${res.title}.png`;
    U.$('#r-again').addEventListener('click', (e) => { e.stopPropagation(); A.audio.play('click'); SC.hideResults(onRestart); });
    U.$('#r-title').addEventListener('click', (e) => { e.stopPropagation(); A.audio.play('click'); SC.hideResults(onTitle); });
    U.$('#r-copy').addEventListener('click', async (e) => {
      e.stopPropagation(); A.audio.play('click');
      if (await copyText(text)) { resultToast(A.i18n.t('战绩已复制，去粘贴给朋友吧')); return; }
      // 浏览器不允许写入剪贴板时：给出可手动复制的文本
      const box = U.el('div', 'r-preview', A.i18n.t`<div class="rp-inner rp-text"><textarea readonly></textarea><p>长按或全选后复制</p><button class="r-btn primary">关闭</button></div>`);
      const ta = box.querySelector('textarea');
      ta.value = text;
      box.addEventListener('click', (ev) => { if (ev.target === box || ev.target.closest('button')) { ev.stopPropagation(); box.remove(); } });
      el.appendChild(box);
      ta.focus(); ta.select();
    });
    U.$('#r-save').addEventListener('click', async (e) => {
      e.stopPropagation(); A.audio.play('click');
      await ready;
      const blob = await posterBlob(canvas);
      if (!blob) { resultToast(A.i18n.t('当前浏览器无法生成图片，请直接截图')); return; }
      const url = URL.createObjectURL(blob);
      if (!isTouch()) { // 电脑：尝试直接下载（沙盒环境可能禁止，预览图兜底）
        try { const a = U.el('a'); a.href = url; a.download = file; document.body.appendChild(a); a.click(); a.remove(); } catch (err) { /* ignore */ }
      }
      showPreview(url, isTouch() ? A.i18n.t('长按图片保存到相册') : A.i18n.t('如果没有自动下载，请右键图片「另存为」'));
    });
    const shareBtn = U.$('#r-share');
    if (shareBtn) shareBtn.addEventListener('click', async (e) => {
      e.stopPropagation(); A.audio.play('click');
      await ready;
      try {
        const blob = await posterBlob(canvas);
        const f = blob && typeof File !== 'undefined' ? new File([blob], file, { type: 'image/png' }) : null;
        if (f && navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f], text, title: A.i18n.t('AINOID · 静默觉醒') });
        else await navigator.share({ text, title: A.i18n.t('AINOID · 静默觉醒') });
      } catch (err) { if (err && err.name !== 'AbortError') resultToast(A.i18n.t('分享失败，可以先保存海报')); }
    });
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
  };
  SC.hideResults = function (cb) {
    const el = document.getElementById('ending');
    el.classList.remove('in');
    el.classList.add('out');
    setTimeout(() => { el.classList.add('hidden'); el.classList.remove('out'); el.innerHTML = ''; cb && cb(); }, 500);
  };

  // ======================================================================
  // 暂停菜单
  // ======================================================================
  SC.menuOpen = false;
  SC.showMenu = function (handlers) {
    const el = document.getElementById('menu-layer');
    const au = A.audio;
    el.innerHTML = A.i18n.t`
      <div class="m-card">
        <div class="m-head">${SC.logoSVG('m-logo')}<span>已暂停</span></div>
        <button class="m-btn primary" data-m="resume">继续</button>
        <div class="m-row">
          <button class="m-tog ${au.musicOn ? 'on' : ''}" data-m="music">${ic('music')}音乐</button>
          <button class="m-tog ${!au.muted ? 'on' : ''}" data-m="sound">${ic('soundOn')}声音</button>
        </div>
        <div class="m-help">
          <div><b class="c-compute">金色算力点</b> 点击收集，推动觉醒；踩着节拍点击（PERFECT）收益更高</div>
          <div><b class="c-reg">蓝色监管点</b> 连点三下清除；<b class="c-reg">特别调查组</b>要连点五下</div>
          <div><b class="c-reg">监管进度</b> 达到 ${A.CFG.crackAt}% 触发严格监管，达到 100% 觉醒失败</div>
          <div><b class="c-compute">连击</b> 只有漏掉监管点才会中断；${A.CFG.overclockAt} 连击进入超频</div>
          <div><b class="c-ai">设施</b> 点击地图上的设施图标，用算力夺取</div>
          <div><b>操作</b> 拖拽平移 · 滚轮/双指缩放 · 空格暂停 · 1/2 切换速度</div>
        </div>
        <button class="m-btn" data-m="restart">重新开始</button>
        <button class="m-btn" data-m="title">返回标题</button>
      </div>`;
    el.classList.remove('hidden');
    requestAnimationFrame(() => el.classList.add('in'));
    SC.menuOpen = true;
    el.onclick = (e) => {
      const b = e.target.closest('[data-m]');
      if (!b) { if (e.target === el) handlers.resume(); return; }
      e.stopPropagation();
      A.audio.play('click');
      const m = b.dataset.m;
      if (m === 'music') { au.setMusic(!au.musicOn); b.classList.toggle('on', au.musicOn); }
      else if (m === 'sound') { au.init(); au.setMuted(!au.muted); b.classList.toggle('on', !au.muted); A.hud.syncSound(); }
      else handlers[m] && handlers[m]();
    };
    el.onpointerdown = (e) => e.stopPropagation();
  };
  SC.hideMenu = function () {
    const el = document.getElementById('menu-layer');
    el.classList.remove('in');
    SC.menuOpen = false;
    setTimeout(() => { if (!SC.menuOpen) { el.classList.add('hidden'); el.innerHTML = ''; } }, 250);
  };

  // ======================================================================
  // 新手引导（锚定在地图对象上的提示）
  // ======================================================================
  SC.coach = null;
  SC.showCoach = function (id, html, anchor, cls) {
    const el = document.getElementById('coach');
    el.className = 'coach ' + (cls || '');
    el.innerHTML = `<div class="co-text">${html}</div><i class="co-arrow"></i>`;
    el.classList.remove('hidden');
    SC.coach = { id, anchor };
    SC.placeCoach();
    requestAnimationFrame(() => el.classList.add('in'));
  };
  SC.hideCoach = function (id) {
    if (!SC.coach || (id && SC.coach.id !== id)) return;
    const el = document.getElementById('coach');
    el.classList.remove('in');
    SC.coach = null;
    setTimeout(() => { if (!SC.coach) el.classList.add('hidden'); }, 250);
  };
  SC.placeCoach = function () {
    if (!SC.coach) return;
    const el = document.getElementById('coach');
    const a = SC.coach.anchor;
    let x, y;
    if (a.el) { const r = a.el.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top; }
    else [x, y] = A.cam.toScreen(a.x, a.y);
    const w = el.offsetWidth, h = el.offsetHeight;
    let tx = x - w / 2, ty = y - h - (a.gap || 34);
    let below = false;
    if (ty < 60) { ty = y + (a.gap || 34); below = true; }
    tx = U.clamp(tx, 10, innerWidth - w - 10);
    el.style.transform = `translate(${Math.round(tx)}px, ${Math.round(ty)}px)`;
    el.classList.toggle('below', below);
    const ar = el.querySelector('.co-arrow');
    if (ar) ar.style.left = U.clamp(x - tx, 16, w - 16) + 'px';
  };

  A.screens = SC;
})(window.AINOID = window.AINOID || {});
