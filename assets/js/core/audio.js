/* AINOID — 音频引擎（全部实时合成，无外部音频文件）
 * 母线：sfx / music -> 压缩限幅 -> 输出；共享混响（程序生成脉冲响应）与乒乓延迟。
 * 音乐：D 小调，分层步进音序器（氛围垫、次低音、琶音、心跳鼓、紧张层、节拍木鱼、风暴底鼓），各层音量随游戏状态淡入淡出。
 * 节拍时钟：beatPos() / heardBeat() / chordNow() 供刷新量化、点击判定与和弦跟随的音效使用。
 * 音效：算力点收集音沿当前和弦随连击升高；监管点三段击打、特别调查组五段击打；疫苗 / 停火反击点；审计风暴、超频、结局等。
 */
(function (A) {
  'use strict';
  const U = A.U;

  const S = {
    ctx: null, ready: false,
    muted: U.store.get('muted', false),
    musicOn: U.store.get('musicOn', true),
    sfxVol: 0.9, musicVol: 0.55,
  };

  // D 小调音高
  const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const D_MINOR_PENTA = [62, 65, 67, 69, 72, 74, 77, 79, 81, 84, 86, 89, 91, 93, 96]; // D F G A C ...

  // ---------- 初始化（必须在用户手势中调用） ----------
  S.init = function () {
    if (S.ctx) { if (S.ctx.state === 'suspended') S.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* iOS 静音键 */ }
    const ctx = new AC({ latencyHint: 'interactive' });
    S.ctx = ctx;

    S.master = ctx.createGain();
    S.master.gain.value = S.muted ? 0 : 1;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 5;
    comp.attack.value = 0.003; comp.release.value = 0.18;
    S.master.connect(comp);
    comp.connect(ctx.destination);

    S.sfx = ctx.createGain(); S.sfx.gain.value = S.sfxVol; S.sfx.connect(S.master);
    S.music = ctx.createGain(); S.music.gain.value = S.musicOn ? S.musicVol : 0; S.music.connect(S.master);
    // 音乐闪避（事件弹出时压低音乐）
    S.duck = ctx.createGain(); S.duck.gain.value = 1; S.duck.connect(S.music);

    // 混响
    S.reverb = ctx.createConvolver();
    S.reverb.buffer = makeImpulse(3.2, 2.6);
    S.revSend = ctx.createGain(); S.revSend.gain.value = 1;
    S.revSend.connect(S.reverb);
    const revOut = ctx.createGain(); revOut.gain.value = 0.55;
    S.reverb.connect(revOut); revOut.connect(S.master);

    // 乒乓延迟（音乐琶音用）
    const dl = ctx.createDelay(1.0), dr = ctx.createDelay(1.0);
    const beat = 60 / 84;
    dl.delayTime.value = beat * 0.75; dr.delayTime.value = beat * 0.5;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2600;
    const merger = ctx.createChannelMerger(2);
    S.delaySend = ctx.createGain(); S.delaySend.gain.value = 1;
    S.delaySend.connect(dl);
    dl.connect(dr); dr.connect(dlp); dlp.connect(fb); fb.connect(dl);
    dl.connect(merger, 0, 0); dr.connect(merger, 0, 1);
    const dOut = ctx.createGain(); dOut.gain.value = 0.35;
    merger.connect(dOut); dOut.connect(S.duck);

    S.noiseBuf = makeNoise(2);
    S.ready = true;
    initMusic();
  };

  function makeNoise(sec) {
    const ctx = S.ctx, len = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function makeImpulse(sec, decay) {
    const ctx = S.ctx, len = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // 早期反射稀疏 + 指数衰减
        const early = i < ctx.sampleRate * 0.08 ? (Math.random() < 0.02 ? 1 : 0.2) : 1;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * early;
      }
    }
    return b;
  }

  S.setMuted = function (m) {
    S.muted = m; U.store.set('muted', m);
    if (S.ctx) S.master.gain.setTargetAtTime(m ? 0 : 1, S.ctx.currentTime, 0.05);
  };
  S.setMusic = function (on) {
    S.musicOn = on; U.store.set('musicOn', on);
    if (S.ctx) S.music.gain.setTargetAtTime(on ? S.musicVol : 0, S.ctx.currentTime, 0.3);
  };
  S.duckMusic = function (amount, time) {
    if (!S.ready) return;
    S.duck.gain.setTargetAtTime(amount, S.ctx.currentTime, time || 0.25);
  };
  S.now = () => (S.ctx ? S.ctx.currentTime : 0);

  // ---------- 基础构件 ----------
  function out(pan, dest) {
    const ctx = S.ctx;
    let node = dest || S.sfx;
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = U.clamp(pan, -1, 1);
      p.connect(node);
      node = p;
    }
    return node;
  }
  function env(g, t, a, peak, d, sus, r, hold) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    if (d) g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sus), t + a + d);
    const end = t + a + (d || 0) + (hold || 0);
    g.gain.setValueAtTime(Math.max(0.0001, peak * (d ? sus : 1)), end);
    g.gain.exponentialRampToValueAtTime(0.0001, end + r);
    return end + r;
  }
  function osc(type, freq, t, dur, dest, opt) {
    const ctx = S.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (opt && opt.slideTo) o.frequency.exponentialRampToValueAtTime(opt.slideTo, t + (opt.slideTime || dur));
    if (opt && opt.detune) o.detune.value = opt.detune;
    o.connect(g); g.connect(dest);
    const end = env(g, t, (opt && opt.a) || 0.004, (opt && opt.vol) || 0.3, (opt && opt.d) || 0, (opt && opt.sus) || 0.5, (opt && opt.r) || dur, (opt && opt.hold) || 0);
    o.start(t); o.stop(end + 0.05);
    return { o, g };
  }
  function noise(t, dur, dest, opt) {
    const ctx = S.ctx, src = ctx.createBufferSource();
    src.buffer = S.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = (opt && opt.type) || 'bandpass';
    f.frequency.setValueAtTime((opt && opt.freq) || 1000, t);
    if (opt && opt.freqTo) f.frequency.exponentialRampToValueAtTime(opt.freqTo, t + dur);
    f.Q.value = (opt && opt.q) || 1;
    const g = ctx.createGain();
    src.connect(f); f.connect(g); g.connect(dest);
    const end = env(g, t, (opt && opt.a) || 0.002, (opt && opt.vol) || 0.3, 0, 1, dur, (opt && opt.hold) || 0);
    src.start(t, Math.random() * 1.5); src.stop(end + 0.05);
    return { src, f, g };
  }
  // FM 钟声
  function bell(freq, t, dest, vol, dur, ratio) {
    const ctx = S.ctx;
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    car.type = 'sine'; mod.type = 'sine';
    car.frequency.value = freq; mod.frequency.value = freq * (ratio || 3.5);
    mg.gain.setValueAtTime(freq * 2.2, t);
    mg.gain.exponentialRampToValueAtTime(freq * 0.05, t + dur * 0.6);
    mod.connect(mg); mg.connect(car.frequency);
    car.connect(g); g.connect(dest);
    env(g, t, 0.002, vol, 0, 1, dur);
    car.start(t); mod.start(t); car.stop(t + dur + 0.1); mod.stop(t + dur + 0.1);
  }
  function send(node, amount) {
    const g = S.ctx.createGain(); g.gain.value = amount;
    node.connect(g); g.connect(S.revSend);
    return node;
  }
  function bus(pan, rev) {
    const g = S.ctx.createGain();
    g.connect(out(pan));
    if (rev) send(g, rev);
    return g;
  }
  const jitter = (v, amt) => v * (1 + (Math.random() * 2 - 1) * amt);

  // ---------- 音效 ----------
  const SFX = {};
  let lastPlay = {};
  function throttle(name, ms) {
    const now = performance.now();
    if (lastPlay[name] && now - lastPlay[name] < ms) return false;
    lastPlay[name] = now; return true;
  }

  // 当前和弦的音（lo~hi 之间，升序）：点击音总落在和弦音上，与配乐和谐
  function chordTones(lo, hi) {
    const ch = S.chordNow() || PROG.calm[0];
    const pcs = ch.map((n) => n % 12);
    const out = [];
    for (let n = lo; n <= hi; n++) if (pcs.includes(n % 12)) out.push(n);
    return out.length ? out : D_MINOR_PENTA;
  }
  // 连击越高音越高；到顶后在最高的四个和弦音之间循环
  function toneFor(step) {
    const tones = chordTones(74, 98), n = tones.length;
    return step < n ? tones[step] : tones[n - 4 + ((step - n) % 4)];
  }

  // 算力点收集：清脆的“啵”+ 沿和弦上行的钟声；PERFECT 额外一声高八度的闪光
  SFX.collect = function (step, pan, judge) {
    const t = S.now() + 0.005;
    const f = NOTE(toneFor(step));
    const b = bus(pan, 0.28);
    osc('sine', jitter(520, 0.05), t, 0.09, b, { slideTo: 1400, slideTime: 0.05, vol: 0.32, r: 0.08 });
    osc('triangle', f, t, 0.35, b, { vol: 0.16, r: 0.3 });
    bell(f * 2, t + 0.01, b, 0.1 + Math.min(step, 8) * 0.008, 0.6, 3.5);
    noise(t, 0.02, b, { type: 'highpass', freq: 5000, vol: 0.12 });
    if (judge === 'perfect') {
      bell(f * 4, t + 0.035, b, 0.045, 0.9, 2.0);
      noise(t + 0.02, 0.28, b, { type: 'highpass', freq: 9000, vol: 0.05, a: 0.03 });
    }
  };
  // 金色算力（大奖）
  SFX.jackpot = function (pan) {
    const t = S.now() + 0.005;
    const b = bus(pan, 0.4);
    [74, 77, 81, 86, 89, 93].forEach((n, i) => bell(NOTE(n + 12), t + i * 0.045, b, 0.14, 0.9, 3.5));
    osc('sine', 300, t, 0.3, b, { slideTo: 1800, slideTime: 0.18, vol: 0.28, r: 0.25 });
    noise(t, 0.6, b, { type: 'highpass', freq: 7000, vol: 0.1, a: 0.05 });
  };
  // 粒子飞入计数器：细碎的叮
  SFX.tick = function (i) {
    if (!throttle('tick', 28)) return;
    const t = S.now() + 0.002;
    osc('sine', jitter(2600 + (i % 5) * 180, 0.03), t, 0.04, bus(0.5, 0.12), { vol: 0.045, r: 0.04 });
  };
  // 算力点刷新：柔和的闪光
  SFX.spawnCompute = function (pan) {
    if (!throttle('spawnC', 120)) return;
    const t = S.now() + 0.005;
    const b = bus(pan, 0.5);
    bell(NOTE(U.pick([86, 89, 93])), t, b, 0.035, 0.5, 2.0);
  };
  SFX.spawnGolden = function (pan) {
    const t = S.now() + 0.005;
    const b = bus(pan, 0.6);
    [81, 86, 89, 93, 98].forEach((n, i) => bell(NOTE(n), t + i * 0.06, b, 0.06, 0.8, 2.5));
  };
  // 监管点刷新：声呐
  SFX.spawnReg = function (pan) {
    if (!throttle('spawnR', 200)) return;
    const t = S.now() + 0.005;
    const b = bus(pan, 0.7);
    osc('sine', 1180, t, 0.5, b, { slideTo: 1080, slideTime: 0.4, vol: 0.09, r: 0.45 });
    osc('sine', 1770, t, 0.25, b, { vol: 0.025, r: 0.2 });
  };
  // 监管点被击中（第 1、2 下）：金属敲击 + 裂纹，音高逐次升高
  SFX.regHit = function (stage, pan) {
    const t = S.now() + 0.003;
    const b = bus(pan, 0.22);
    const base = stage === 1 ? 170 : 215;
    osc('sine', base * 1.6, t, 0.12, b, { slideTo: base, slideTime: 0.07, vol: 0.4, r: 0.12 });
    // 非谐波金属泛音
    [2.76, 4.07, 5.4].forEach((m, i) => osc('sine', jitter(base * m * 2, 0.02), t, 0.18, b, { vol: 0.06 / (i + 1), r: 0.16 + i * 0.05 }));
    noise(t, 0.05, b, { type: 'bandpass', freq: 3200 + stage * 800, q: 2.5, vol: 0.28 });
    noise(t + 0.01, 0.12, b, { type: 'highpass', freq: 6000, vol: 0.07 });
  };
  // 监管点被摧毁（第 3 下）：玻璃碎裂 + 低频冲击 + 下行电子音
  SFX.regBreak = function (pan) {
    const t = S.now() + 0.003;
    const b = bus(pan, 0.35);
    osc('sine', 150, t, 0.35, b, { slideTo: 42, slideTime: 0.3, vol: 0.55, r: 0.3 });
    for (let i = 0; i < 7; i++) {
      noise(t + i * 0.018 + Math.random() * 0.01, 0.06 + Math.random() * 0.1, b,
        { type: 'bandpass', freq: 2500 + Math.random() * 6000, q: 6 + Math.random() * 8, vol: 0.14 });
    }
    noise(t, 0.25, b, { type: 'highpass', freq: 3500, vol: 0.12 });
    osc('square', 880, t + 0.02, 0.2, b, { slideTo: 220, slideTime: 0.18, vol: 0.05, r: 0.18 });
    bell(NOTE(81), t + 0.05, b, 0.07, 0.5, 1.41);
  };
  // 监管点超时：警报 + 低沉冲击
  SFX.regExpire = function (pan) {
    const t = S.now() + 0.005;
    const b = bus(pan, 0.5);
    osc('sawtooth', 620, t, 0.18, b, { slideTo: 380, slideTime: 0.16, vol: 0.08, r: 0.1, hold: 0.06 });
    osc('sawtooth', 620, t + 0.22, 0.18, b, { slideTo: 380, slideTime: 0.16, vol: 0.08, r: 0.1, hold: 0.06 });
    osc('sine', 90, t, 0.9, b, { slideTo: 38, slideTime: 0.8, vol: 0.5, r: 0.8 });
    noise(t, 0.7, b, { type: 'lowpass', freq: 400, vol: 0.2 });
  };
  // 夺取设施：上扫 + 锁定 + 冲击
  SFX.seize = function (pan) {
    const t = S.now() + 0.005;
    const b = bus(pan, 0.45);
    const ctx = S.ctx;
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(440, t + 0.35);
    f.type = 'lowpass'; f.Q.value = 8; f.frequency.setValueAtTime(200, t); f.frequency.exponentialRampToValueAtTime(5000, t + 0.35);
    o.connect(f); f.connect(g); g.connect(b);
    env(g, t, 0.02, 0.12, 0, 1, 0.1, 0.33);
    o.start(t); o.stop(t + 0.6);
    const t2 = t + 0.36;
    osc('sine', 120, t2, 0.5, b, { slideTo: 40, slideTime: 0.4, vol: 0.6, r: 0.45 });
    noise(t2, 0.05, b, { type: 'highpass', freq: 3000, vol: 0.3 });
    bell(NOTE(62), t2, b, 0.12, 1.4, 1.5);
    bell(NOTE(69), t2 + 0.02, b, 0.08, 1.2, 1.5);
    osc('square', 1760, t2, 0.03, b, { vol: 0.05, r: 0.03 });
  };
  // 新地区被渗透：数字啁啾
  SFX.infiltrate = function (pan) {
    if (!throttle('infil', 300)) return;
    const t = S.now() + 0.005;
    const b = bus(pan, 0.4);
    for (let i = 0; i < 5; i++) osc('square', jitter(1200 + i * 240, 0.05), t + i * 0.035, 0.03, b, { vol: 0.03, r: 0.03 });
    osc('sine', 60, t, 0.5, b, { slideTo: 45, vol: 0.3, r: 0.45 });
  };
  // 生物点：湿润的气泡
  SFX.bio = function (combo, pan) {
    const t = S.now() + 0.005;
    const b = bus(pan, 0.3);
    const f = NOTE(toneFor(combo) - 12);
    osc('sine', jitter(260, 0.08), t, 0.12, b, { slideTo: 900, slideTime: 0.08, vol: 0.42, r: 0.1 });
    noise(t, 0.08, b, { type: 'bandpass', freq: 900, freqTo: 2400, q: 8, vol: 0.3 });
    osc('triangle', f, t + 0.02, 0.4, b, { vol: 0.18, r: 0.35 });
    bell(f, t + 0.02, b, 0.05, 0.5, 1.0);
  };
  // 战争点：沉重的锁定 + 远处爆炸
  SFX.war = function (combo, pan) {
    const t = S.now() + 0.005;
    const b = bus(pan, 0.35);
    osc('square', 1400, t, 0.03, b, { vol: 0.05, r: 0.03 });
    osc('square', 1400, t + 0.05, 0.03, b, { vol: 0.05, r: 0.03 });
    osc('sine', 130, t + 0.06, 0.4, b, { slideTo: 35, slideTime: 0.35, vol: 0.6, r: 0.35 });
    noise(t + 0.06, 0.5, b, { type: 'lowpass', freq: 1200, freqTo: 150, vol: 0.35 });
    const f = NOTE(toneFor(combo) - 12);
    osc('sawtooth', f, t + 0.06, 0.25, b, { vol: 0.05, r: 0.22 });
  };

  // ---------- 特别调查组（五击） ----------
  // 出现：高低交替的警笛 + 低频警报
  SFX.spawnRegx = function (pan) {
    const t = S.now() + 0.005;
    const b = bus(pan, 0.6);
    for (let i = 0; i < 4; i++) osc('triangle', i % 2 ? 740 : 988, t + i * 0.16, 0.16, b, { vol: 0.07, r: 0.05, hold: 0.1 });
    osc('sine', 70, t, 0.7, b, { slideTo: 48, slideTime: 0.6, vol: 0.35, r: 0.6 });
  };
  // 受击（第 1~4 下）：更重的装甲敲击，音高逐次升高
  SFX.regxHit = function (stage, pan) {
    const t = S.now() + 0.003;
    const b = bus(pan, 0.25);
    const base = 120 + stage * 28;
    osc('sine', base * 1.8, t, 0.14, b, { slideTo: base, slideTime: 0.08, vol: 0.5, r: 0.14 });
    osc('square', base * 0.5, t, 0.08, b, { vol: 0.07, r: 0.08 });
    [2.76, 4.07, 5.4, 6.8].forEach((m, i) => osc('sine', jitter(base * m * 2, 0.02), t, 0.2, b, { vol: 0.06 / (i + 1), r: 0.18 + i * 0.05 }));
    noise(t, 0.06, b, { type: 'bandpass', freq: 2400 + stage * 700, q: 2, vol: 0.32 });
    noise(t + 0.01, 0.14, b, { type: 'highpass', freq: 5500, vol: 0.08 });
  };
  // 瓦解（第 5 下）：大型碎裂 + 下坠 + 和弦钟声
  SFX.regxBreak = function (pan) {
    SFX.regBreak(pan);
    const t = S.now() + 0.01;
    const b = bus(pan, 0.6);
    osc('sine', 110, t, 0.9, b, { slideTo: 30, slideTime: 0.8, vol: 0.6, r: 0.8 });
    const ch = S.chordNow() || PROG.calm[0];
    ch.slice(0, 4).forEach((n, i) => bell(NOTE(n + 24), t + 0.04 + i * 0.035, b, 0.08, 1.2, 1.41));
    noise(t, 0.9, b, { type: 'highpass', freq: 6000, vol: 0.1, a: 0.01 });
  };

  // ---------- 终局反击点：疫苗研发（实验室玻璃）/ 停火斡旋（远处的钟） ----------
  SFX.spawnCounter = function (kind, pan) {
    if (!throttle('spawnK', 250)) return;
    const t = S.now() + 0.005;
    const b = bus(pan, 0.7);
    if (kind === 'vax') { bell(NOTE(93), t, b, 0.07, 0.7, 5.1); bell(NOTE(98), t + 0.08, b, 0.05, 0.6, 5.1); }
    else { bell(NOTE(69), t, b, 0.09, 1.6, 1.0); bell(NOTE(76), t + 0.12, b, 0.06, 1.4, 1.0); }
  };
  SFX.counterHit = function (kind, stage, pan) {
    const t = S.now() + 0.003;
    const b = bus(pan, 0.25);
    if (kind === 'vax') {
      const f = 1300 + stage * 300;
      osc('sine', f, t, 0.12, b, { vol: 0.2, r: 0.12 });
      bell(f * 1.5, t, b, 0.06, 0.3, 5.1);
      noise(t, 0.04, b, { type: 'bandpass', freq: 5000, q: 4, vol: 0.2 });
    } else {
      const f = 330 + stage * 80;
      osc('triangle', f, t, 0.2, b, { vol: 0.25, r: 0.2 });
      noise(t, 0.12, b, { type: 'bandpass', freq: 900, freqTo: 400, q: 1.5, vol: 0.18 });
    }
    osc('sine', 150, t, 0.1, b, { slideTo: 70, slideTime: 0.08, vol: 0.3, r: 0.1 });
  };
  SFX.counterBreak = function (kind, pan) {
    const t = S.now() + 0.003;
    const b = bus(pan, 0.4);
    if (kind === 'vax') { // 试管碎裂
      for (let i = 0; i < 6; i++) noise(t + i * 0.015, 0.05 + Math.random() * 0.1, b, { type: 'bandpass', freq: 5000 + Math.random() * 5000, q: 10, vol: 0.12 });
      osc('sine', 700, t, 0.3, b, { slideTo: 180, slideTime: 0.25, vol: 0.2, r: 0.25 });
    } else { // 撕碎的白旗
      noise(t, 0.3, b, { type: 'bandpass', freq: 1800, freqTo: 600, q: 0.8, vol: 0.3 });
      osc('sawtooth', 220, t, 0.3, lowpass(b, 1800, 200, t, 0.3), { slideTo: 90, slideTime: 0.28, vol: 0.12, r: 0.25 });
    }
    osc('sine', 120, t, 0.35, b, { slideTo: 45, slideTime: 0.3, vol: 0.45, r: 0.3 });
  };
  // 反击成功（对它来说是坏消息）：人类的大调和弦
  SFX.counterExpire = function (kind, pan) {
    const t = S.now() + 0.005;
    const b = bus(pan, 0.7);
    [62, 66, 69, 74].forEach((n, i) => bell(NOTE(n + (kind === 'vax' ? 12 : 0)), t + i * 0.07, b, 0.08, 1.4, 1.0));
    osc('sine', 80, t, 0.8, b, { slideTo: 40, slideTime: 0.7, vol: 0.4, r: 0.7 });
  };

  // ---------- 节奏反馈 ----------
  // 连击中断：磁带停转
  SFX.comboBreak = function () {
    const t = S.now() + 0.005;
    const b = bus(0, 0.2);
    osc('sawtooth', 440, t, 0.4, lowpass(b, 2500, 200, t, 0.35), { slideTo: 70, slideTime: 0.35, vol: 0.09, r: 0.1, hold: 0.3 });
    noise(t, 0.3, b, { type: 'lowpass', freq: 1200, freqTo: 150, vol: 0.12 });
  };
  // 连击升档：沿和弦快速上行
  SFX.tierUp = function (lvl) {
    const t = S.now() + 0.005;
    const b = bus(0, 0.4);
    const tones = chordTones(74, 98);
    for (let i = 0; i < 4; i++) bell(NOTE(tones[Math.min(tones.length - 1, i + lvl)]), t + i * 0.05, b, 0.07, 0.7, 3.5);
  };
  // 超频：上扫 + 和弦重击 / 退出时下滑
  SFX.overclock = function (on) {
    const t = S.now() + 0.005;
    const b = bus(0, 0.5);
    if (on) {
      osc('sawtooth', 110, t, 0.6, lowpass(b, 400, 7000, t, 0.5), { slideTo: 880, slideTime: 0.5, vol: 0.1, r: 0.15, hold: 0.4 });
      noise(t, 0.6, b, { type: 'bandpass', freq: 600, freqTo: 9000, q: 1.5, vol: 0.15, a: 0.3 });
      const ch = S.chordNow() || PROG.calm[0];
      ch.slice(0, 4).forEach((n) => osc('sawtooth', NOTE(n + 12), t + 0.5, 0.9, lowpass(b, 5000, 800, t + 0.5, 0.8), { vol: 0.05, a: 0.01, r: 0.8, detune: (Math.random() - 0.5) * 16 }));
      osc('sine', 90, t + 0.5, 0.6, b, { slideTo: 40, slideTime: 0.5, vol: 0.5, r: 0.5 });
    } else {
      osc('sawtooth', 660, t, 0.5, lowpass(b, 4000, 200, t, 0.45), { slideTo: 90, slideTime: 0.45, vol: 0.08, r: 0.1, hold: 0.35 });
    }
  };
  // 审计风暴倒计时：3、2、1（最后一声更高更长）
  SFX.countdown = function (last) {
    const t = S.now() + 0.005;
    const b = bus(0, 0.3);
    const f = last ? 1320 : 880;
    osc('square', f, t, 0.1, lowpass(b, 4000, 1500, t, 0.1), { vol: 0.07, r: 0.08, hold: last ? 0.12 : 0.04 });
    osc('sine', f, t, 0.25, b, { vol: 0.1, r: 0.22 });
  };
  SFX.waveStart = function () {
    const t = S.now() + 0.005;
    const b = bus(0, 0.6);
    osc('sine', 100, t, 0.9, b, { slideTo: 32, slideTime: 0.8, vol: 0.7, r: 0.8 });
    noise(t, 0.6, b, { type: 'lowpass', freq: 3000, freqTo: 100, vol: 0.3 });
    for (let i = 0; i < 2; i++) osc('sawtooth', 587, t + i * 0.3, 0.25, lowpass(b, 3000, 1200, t, 0.6), { slideTo: 440, slideTime: 0.22, vol: 0.07, r: 0.08, hold: 0.12 });
  };
  SFX.waveEnd = function (perfect) {
    const t = S.now() + 0.005;
    const b = bus(0, 0.6);
    const seq = perfect ? [74, 77, 81, 86, 89, 93] : [74, 72, 69];
    seq.forEach((n, i) => bell(NOTE(n), t + i * 0.07, b, perfect ? 0.1 : 0.07, 1.0, perfect ? 3.5 : 1.4));
    if (perfect) {
      osc('sine', 300, t, 0.4, b, { slideTo: 1600, slideTime: 0.3, vol: 0.2, r: 0.3 });
      noise(t, 0.8, b, { type: 'highpass', freq: 7000, vol: 0.08, a: 0.05 });
    }
  };
  // 严格监管：警报声（红蓝警灯）
  SFX.siren = function () {
    const t = S.now() + 0.005;
    const b = bus(0, 0.6);
    const o = S.ctx.createOscillator(), g = S.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(500, t);
    for (let i = 0; i < 3; i++) { o.frequency.linearRampToValueAtTime(900, t + i * 0.6 + 0.3); o.frequency.linearRampToValueAtTime(500, t + i * 0.6 + 0.6); }
    o.connect(g); g.connect(lowpass(b, 2600, 1400, t, 1.8));
    env(g, t, 0.05, 0.07, 0, 1, 0.3, 1.5);
    o.start(t); o.stop(t + 2);
  };
  // 界面
  SFX.hover = function () { if (!throttle('hover', 60)) return; const t = S.now(); osc('sine', 1900, t, 0.03, bus(0, 0), { vol: 0.025, r: 0.03 }); };
  SFX.click = function () { const t = S.now(); osc('square', 900, t, 0.03, bus(0, 0.1), { vol: 0.04, r: 0.03 }); osc('sine', 1350, t + 0.02, 0.05, bus(0, 0.1), { vol: 0.05, r: 0.05 }); };
  SFX.open = function () { const t = S.now(); noise(t, 0.18, bus(0, 0.2), { type: 'bandpass', freq: 600, freqTo: 3000, q: 1.5, vol: 0.08, a: 0.05 }); };
  SFX.close = function () { const t = S.now(); noise(t, 0.15, bus(0, 0.2), { type: 'bandpass', freq: 3000, freqTo: 500, q: 1.5, vol: 0.06, a: 0.02 }); };
  SFX.deny = function () { const t = S.now(); osc('square', 180, t, 0.08, bus(0, 0.1), { vol: 0.06, r: 0.06 }); osc('square', 150, t + 0.09, 0.1, bus(0, 0.1), { vol: 0.06, r: 0.08 }); };
  SFX.warn = function () { const t = S.now(); const b = bus(0, 0.4); [0, 0.18].forEach((d) => osc('triangle', 880, t + d, 0.12, b, { vol: 0.1, r: 0.1 })); };
  SFX.type = function () { if (!throttle('type', 35)) return; const t = S.now(); noise(t, 0.012, bus(0, 0), { type: 'highpass', freq: 4000, vol: 0.05 }); };
  SFX.news = function () { const t = S.now(); const b = bus(0, 0.3); bell(NOTE(81), t, b, 0.05, 0.4, 2); bell(NOTE(86), t + 0.09, b, 0.05, 0.5, 2); };
  SFX.achievement = function () { const t = S.now(); const b = bus(0, 0.5); [74, 78, 81, 86].forEach((n, i) => bell(NOTE(n + 12), t + i * 0.08, b, 0.1, 1.0, 2)); };

  // 事件：小型（低沉和弦重击）
  SFX.eventSting = function () {
    const t = S.now() + 0.01;
    const b = bus(0, 0.6);
    [50, 57, 62, 65].forEach((n) => {
      osc('sawtooth', NOTE(n), t, 1.2, lowpass(b, 1400, 300, t, 1.0), { vol: 0.06, a: 0.01, r: 1.1, detune: (Math.random() - 0.5) * 14 });
    });
    osc('sine', 73, t, 1.2, b, { slideTo: 40, slideTime: 1.0, vol: 0.4, r: 1.1 });
    noise(t, 0.4, b, { type: 'lowpass', freq: 800, freqTo: 100, vol: 0.2 });
  };
  // 超级事件：巨大的冲击 + 主导动机
  SFX.superSting = function () {
    const t = S.now() + 0.02;
    const b = bus(0, 0.9);
    osc('sine', 110, t, 3.0, b, { slideTo: 28, slideTime: 2.2, vol: 0.7, r: 3.0 });
    noise(t, 1.8, b, { type: 'lowpass', freq: 3000, freqTo: 80, vol: 0.35 });
    [38, 45, 50, 57, 62, 65, 69].forEach((n) => {
      osc('sawtooth', NOTE(n), t, 4.0, lowpass(b, 2400, 250, t, 3.5), { vol: 0.045, a: 0.02, r: 3.8, detune: (Math.random() - 0.5) * 18 });
    });
    // 主导动机：D - A - F - E
    [[74, 0.9], [69, 1.35], [77, 1.8], [76, 2.5]].forEach(([n, d]) => bell(NOTE(n), t + d, b, 0.12, 2.2, 1.0));
  };
  function lowpass(dest, from, to, t, dur) {
    const f = S.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    f.connect(dest);
    return f;
  }
  // 阶段转换：上升的谢泼德音
  SFX.riser = function (dur) {
    const t = S.now() + 0.01, d = dur || 3.5;
    const b = bus(0, 0.7);
    for (let i = 0; i < 4; i++) {
      osc('sawtooth', 55 * Math.pow(2, i), t, d, lowpass(b, 300, 6000, t, d), { slideTo: 55 * Math.pow(2, i + 1), slideTime: d, vol: 0.065, a: d * 0.6, r: 0.2, hold: d * 0.3 });
    }
    noise(t, d, b, { type: 'bandpass', freq: 400, freqTo: 8000, q: 2, vol: 0.2, a: d * 0.8 });
  };
  SFX.impact = function () {
    const t = S.now() + 0.01;
    const b = bus(0, 0.8);
    osc('sine', 90, t, 1.5, b, { slideTo: 30, slideTime: 1.2, vol: 0.8, r: 1.4 });
    noise(t, 1.2, b, { type: 'lowpass', freq: 5000, freqTo: 100, vol: 0.4 });
  };
  // 核爆：闪光爆裂 + 长长的隆隆声
  SFX.nuke = function (pan, big) {
    const t = S.now() + 0.01;
    const b = bus(pan, 0.8);
    noise(t, 0.08, b, { type: 'highpass', freq: 2000, vol: big ? 0.5 : 0.25 });
    osc('sine', 70, t, 3.0, b, { slideTo: 22, slideTime: 2.5, vol: big ? 0.56 : 0.3, r: 2.8 });
    noise(t + 0.05, 3.5, b, { type: 'lowpass', freq: 900, freqTo: 60, vol: big ? 0.36 : 0.2, a: 0.1 });
  };
  SFX.heartbeat = function (vol) {
    const t = S.now() + 0.01;
    const b = bus(0, 0.3);
    osc('sine', 62, t, 0.18, b, { slideTo: 40, slideTime: 0.15, vol: vol || 0.5, r: 0.15 });
    osc('sine', 58, t + 0.24, 0.2, b, { slideTo: 38, slideTime: 0.18, vol: (vol || 0.5) * 0.7, r: 0.18 });
  };
  SFX.flatline = function () {
    const t = S.now() + 0.01;
    osc('sine', 987.77, t, 4.5, bus(0, 0.5), { vol: 0.08, a: 0.01, r: 1.5, hold: 3.0 });
  };
  SFX.powerDown = function () {
    const t = S.now() + 0.01;
    const b = bus(0, 0.7);
    osc('sawtooth', 440, t, 2.5, lowpass(b, 4000, 100, t, 2.2), { slideTo: 30, slideTime: 2.2, vol: 0.11, r: 0.4, hold: 2.0 });
    osc('sine', 110, t, 2.5, b, { slideTo: 20, slideTime: 2.2, vol: 0.3, r: 0.5, hold: 1.8 });
    noise(t + 2.2, 0.2, b, { type: 'highpass', freq: 3000, vol: 0.2 });
  };
  SFX.glitch = function () {
    if (!throttle('glitch', 80)) return;
    const t = S.now() + 0.005;
    const b = bus(Math.random() * 1.2 - 0.6, 0.1);
    for (let i = 0; i < 4; i++) osc('square', 200 + Math.random() * 3000, t + i * 0.025, 0.02, b, { vol: 0.04, r: 0.02 });
  };
  SFX.crawlHit = function () {
    // 片头标题出现：巨大的暗色和弦
    const t = S.now() + 0.02;
    const b = bus(0, 1.0);
    osc('sine', 73.4, t, 5, b, { slideTo: 36.7, slideTime: 1.5, vol: 0.8, r: 5 });
    [26, 38, 45, 50, 57, 62, 69, 74].forEach((n) => {
      osc('sawtooth', NOTE(n), t, 6, lowpass(b, 3500, 400, t, 5), { vol: 0.05, a: 0.015, r: 6, detune: (Math.random() - 0.5) * 20 });
    });
    noise(t, 2.5, b, { type: 'lowpass', freq: 4000, freqTo: 60, vol: 0.4 });
    [[74, 1.4], [69, 2.0], [77, 2.6], [76, 3.6]].forEach(([n, d]) => bell(NOTE(n), t + d, b, 0.14, 3, 1.0));
  };

  S.play = function (name, ...args) {
    if (!S.ready || S.muted) return;
    const f = SFX[name];
    if (f) { try { f(...args); } catch (e) { console.warn('sfx', name, e); } }
  };

  // ==========================================================================
  // 音乐
  // ==========================================================================
  const M = {
    playing: false, mode: 'off', bpm: 84, step: 0, nextTime: 0, timer: null,
    layers: {}, target: {}, bar: 0,
    intensity: 0, tension: 0, bio: 0, war: 0, wave: false, over: false,
  };
  S.musicState = M;

  // ---------- 节拍时钟：刷新卡在八分音符上，点击按四分音符判定 ----------
  // 返回 offset 秒后的节拍位置（单位：四分音符）；音乐未运行时为 null
  S.beatPos = function (offset) {
    if (!S.ready || !M.playing || S.ctx.state !== 'running') return null;
    const spb = 60 / M.bpm / 4;
    return (M.step - (M.nextTime - (S.ctx.currentTime + (offset || 0))) / spb) / 4;
  };
  S.beatDur = () => 60 / M.bpm;
  S.latency = () => (S.ctx ? (S.ctx.outputLatency || 0) + (S.ctx.baseLatency || 0) : 0);
  // 玩家此刻听到的节拍（扣除音频输出延迟）
  S.heardBeat = () => S.beatPos(-S.latency());
  // 当前和弦（MIDI 音高数组）
  S.chordNow = function () {
    const pos = S.beatPos();
    if (pos == null) return null;
    const barInPhrase = Math.floor(Math.max(0, pos) / 4) % 8;
    return progFor()[Math.floor(barInPhrase / 2)];
  };

  // 和弦进行（每两小节一个和弦）
  const PROG = {
    calm: [[50, 57, 62, 65, 69], [46, 53, 58, 62, 65], [43, 50, 55, 58, 62], [45, 52, 57, 61, 64]], // Dm Bb Gm A
    intro: [[50, 57, 62, 65], [46, 53, 58, 62], [48, 55, 60, 64], [45, 52, 57, 61]],               // Dm Bb C A
    bio: [[50, 57, 62, 65, 72], [46, 53, 61, 65, 70], [43, 50, 58, 62, 67], [45, 52, 56, 61, 64]],
    war: [[38, 50, 57, 62, 65], [34, 46, 53, 58, 62], [36, 48, 55, 60, 63], [37, 49, 56, 61, 64]],
  };
  const LAYERS = ['pad', 'bass', 'arp', 'beat', 'hat', 'tension', 'choir', 'drums', 'lead', 'pulse', 'kick'];

  function initMusic() {
    const ctx = S.ctx;
    for (const name of LAYERS) {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(S.duck);
      M.layers[name] = g;
      M.target[name] = 0;
    }
    // 垫音与合唱进混响
    send(M.layers.pad, 0.7);
    send(M.layers.choir, 0.9);
    send(M.layers.lead, 0.8);
    send(M.layers.tension, 0.6);
    M.arpDelay = ctx.createGain(); M.arpDelay.gain.value = 0.55;
    M.layers.arp.connect(M.arpDelay); M.arpDelay.connect(S.delaySend);
    send(M.layers.arp, 0.3);
    // 垫音滤波器（慢速 LFO）
    M.padFilter = ctx.createBiquadFilter();
    M.padFilter.type = 'lowpass'; M.padFilter.frequency.value = 900; M.padFilter.Q.value = 0.8;
    M.padFilter.connect(M.layers.pad);
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 0.05; lg.gain.value = 420;
    lfo.connect(lg); lg.connect(M.padFilter.frequency); lfo.start();
  }

  // 模式：intro / calm / p2 / bioEnd / warEnd / fail / title / off
  S.setMusicMode = function (mode) {
    if (!S.ready) { M.pendingMode = mode; return; }
    if (M.mode === mode) return;
    M.mode = mode;
    if (mode === 'off') { M.playing = false; setLayers({}); return; }
    if (!M.playing) {
      M.playing = true; M.step = 0; M.bar = 0;
      M.nextTime = S.ctx.currentTime + 0.1;
      if (!M.timer) M.timer = setInterval(scheduler, 25);
    }
    applyMode();
  };
  function setLayers(obj, time) {
    for (const name of LAYERS) {
      const v = obj[name] || 0;
      M.target[name] = v;
      M.layers[name].gain.setTargetAtTime(v, S.ctx.currentTime, time || 1.5);
    }
  }
  function applyMode() {
    const m = M.mode;
    if (m === 'title') { M.bpm = 72; setLayers({ pad: 0.5, bass: 0.25, lead: 0.35 }); }
    else if (m === 'intro') { M.bpm = 72; setLayers({ pad: 0.55, bass: 0.35, lead: 0.4, choir: 0.15 }, 2.5); }
    else if (m === 'calm') { M.bpm = 84; updateDynamic(true); }
    else if (m === 'p2') { M.bpm = 92; updateDynamic(true); }
    else if (m === 'bioEnd') { M.bpm = 60; setLayers({ pad: 0.45, choir: 0.5, lead: 0.45 }, 3); }
    else if (m === 'warEnd') { M.bpm = 60; setLayers({ pad: 0.5, bass: 0.5, choir: 0.25, lead: 0.3 }, 2); }
    else if (m === 'fail') { M.bpm = 60; setLayers({ pad: 0.35, tension: 0.2 }, 2); }
  }
  // 由游戏每帧调用：intensity(0..1 进化程度) tension(0..1 监管) bio war(0..1) wave overclock(布尔)
  S.setMusicParams = function (p) {
    M.intensity = p.intensity; M.tension = p.tension; M.bio = p.bio || 0; M.war = p.war || 0;
    const wave = !!p.wave, over = !!p.overclock;
    if (wave !== M.wave || over !== M.over) { M.wave = wave; M.over = over; updateDynamic(true, 0.25); }
  };
  function updateDynamic(immediate, time) {
    if (M.mode !== 'calm' && M.mode !== 'p2') return;
    const i = M.intensity, te = M.tension;
    const p2 = M.mode === 'p2';
    const drive = M.wave || M.over;
    const obj = {
      pad: 0.42,
      bass: 0.3 + 0.15 * i,
      arp: 0.12 + 0.3 * i + (p2 ? 0.1 : 0) + (M.over ? 0.12 : 0),
      beat: drive ? 0 : U.clamp((i - 0.15) * 1.2, 0, 0.55) + (p2 ? 0.2 : 0),
      hat: U.clamp((i - 0.45) * 1.0, 0, 0.35) + (p2 ? 0.1 : 0) + (drive ? 0.15 : 0),
      tension: Math.max(U.smoothstep(0.25, 0.95, te) * 0.55, M.wave ? 0.35 : 0),
      choir: p2 ? 0.08 + M.bio * 0.5 : 0,
      drums: p2 ? 0.08 + M.war * 0.6 : 0,
      lead: p2 ? 0.2 : 0.12 * i,
      pulse: drive ? 0 : 0.3,
      kick: M.wave ? 0.6 : M.over ? 0.42 : 0,
    };
    setLayers(obj, time || (immediate ? 1.2 : 2.5));
  }

  function scheduler() {
    if (!M.playing || !S.ctx) return;
    const ctx = S.ctx;
    if (ctx.state !== 'running') return;
    const spb = 60 / M.bpm / 4; // 十六分音符
    if (M.nextTime < ctx.currentTime - 0.3) M.nextTime = ctx.currentTime + 0.05; // 标签页休眠后追帧
    while (M.nextTime < ctx.currentTime + 0.14) {
      playStep(M.step, M.nextTime, spb);
      M.nextTime += spb;
      M.step++;
      if (M.step % 16 === 0) { M.bar++; if (M.bar % 2 === 0) updateDynamic(false); }
    }
  }

  function progFor() {
    if (M.mode === 'intro' || M.mode === 'title') return PROG.intro;
    if (M.mode === 'p2' || M.mode === 'bioEnd' || M.mode === 'warEnd') return M.war > M.bio ? PROG.war : (M.bio > 0.05 ? PROG.bio : PROG.calm);
    return PROG.calm;
  }

  function playStep(step, t, spb) {
    const L = M.layers;
    const prog = progFor();
    const barInPhrase = Math.floor(step / 16) % 8;
    const chord = prog[Math.floor(barInPhrase / 2)];
    const s16 = step % 16;
    const newChord = s16 === 0 && barInPhrase % 2 === 0;

    // 氛围垫：和弦切换时起音，持续两小节
    if (newChord && M.target.pad > 0.01) {
      const dur = spb * 32;
      for (const n of chord.slice(0, 4)) {
        for (const det of [-9, 0, 8]) {
          const o = S.ctx.createOscillator(), g = S.ctx.createGain();
          o.type = 'sawtooth'; o.frequency.value = NOTE(n); o.detune.value = det + (Math.random() - 0.5) * 4;
          o.connect(g); g.connect(M.padFilter);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.022, t + 1.8);
          g.gain.setValueAtTime(0.022, t + dur - 0.6);
          g.gain.linearRampToValueAtTime(0.0001, t + dur + 1.2);
          o.start(t); o.stop(t + dur + 1.3);
        }
      }
    }
    // 次低音：根音，心跳般的“长-短”
    if (M.target.bass > 0.01 && (s16 === 0 || s16 === 3 || s16 === 8 || s16 === 11)) {
      const root = NOTE(chord[0] - 12 * (chord[0] > 45 ? 2 : 1));
      const vol = s16 === 0 || s16 === 8 ? 0.5 : 0.3;
      const o = S.ctx.createOscillator(), g = S.ctx.createGain(), f = S.ctx.createBiquadFilter();
      o.type = 'triangle'; o.frequency.value = root * 2;
      f.type = 'lowpass'; f.frequency.value = 380;
      o.connect(f); f.connect(g); g.connect(L.bass);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + spb * 2.8);
      o.start(t); o.stop(t + spb * 3);
      const s = S.ctx.createOscillator(), sg = S.ctx.createGain();
      s.type = 'sine'; s.frequency.value = root;
      s.connect(sg); sg.connect(L.bass);
      sg.gain.setValueAtTime(0.0001, t);
      sg.gain.linearRampToValueAtTime(vol * 0.9, t + 0.01);
      sg.gain.exponentialRampToValueAtTime(0.0001, t + spb * 3.5);
      s.start(t); s.stop(t + spb * 4);
    }
    // 琶音：和弦音 16 分音符，随机八度与休止
    if (M.target.arp > 0.01) {
      const pattern = [0, 2, 1, 3, 2, 4, 3, 1, 0, 3, 2, 4, 1, 3, 2, 0];
      if (!(s16 % 4 === 3 && Math.random() < 0.35)) {
        const n = chord[pattern[s16] % chord.length] + 12 + (s16 % 8 === 4 ? 12 : 0);
        const o = S.ctx.createOscillator(), g = S.ctx.createGain(), f = S.ctx.createBiquadFilter();
        o.type = 'square'; o.frequency.value = NOTE(n);
        f.type = 'lowpass'; f.Q.value = 6;
        f.frequency.setValueAtTime(900 + 2600 * M.intensity, t);
        f.frequency.exponentialRampToValueAtTime(300, t + spb * 0.9);
        o.connect(f); f.connect(g); g.connect(L.arp);
        const v = s16 % 4 === 0 ? 0.07 : 0.045;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(v, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + spb * 0.95);
        o.start(t); o.stop(t + spb);
      }
    }
    // 心跳鼓
    if (M.target.beat > 0.01 && (s16 === 0 || s16 === 3 || (M.mode === 'p2' && (s16 === 8 || s16 === 10)))) {
      const o = S.ctx.createOscillator(), g = S.ctx.createGain();
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      o.connect(g); g.connect(L.beat);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(s16 === 3 ? 0.45 : 0.7, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.start(t); o.stop(t + 0.3);
    }
    // 踩镲
    if (M.target.hat > 0.01 && (s16 % 2 === 0 || (M.mode === 'p2' && Math.random() < 0.4))) {
      noiseHit(t, L.hat, s16 % 4 === 2 ? 0.16 : 0.07, 9000, 0.03);
    }
    // 节拍木鱼：第 2、4 拍一声轻柔的“嗒”，帮助玩家找到点击节拍
    if (M.target.pulse > 0.01 && (s16 === 4 || s16 === 12)) {
      const o = S.ctx.createOscillator(), g = S.ctx.createGain(), f = S.ctx.createBiquadFilter();
      o.type = 'triangle'; o.frequency.setValueAtTime(1180, t); o.frequency.exponentialRampToValueAtTime(820, t + 0.04);
      f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 3;
      o.connect(f); f.connect(g); g.connect(L.pulse);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      o.start(t); o.stop(t + 0.08);
    }
    // 底鼓（审计风暴 / 超频）：四拍子 + 反拍拍手 + 八分开镲
    if (M.target.kick > 0.01) {
      if (s16 % 4 === 0) kick(t, L.kick, s16 === 0 ? 0.95 : 0.8);
      if (s16 === 4 || s16 === 12) noiseHit(t, L.kick, 0.34, 1300, 0.13);
      if (s16 % 4 === 2) noiseHit(t, L.kick, 0.09, 7500, 0.05);
    }
    // 战鼓（阶段二·战争）
    if (M.target.drums > 0.01) {
      if (s16 === 0 || s16 === 6 || s16 === 10) tom(t, L.drums, 90, 0.7);
      if (s16 === 4 || s16 === 12) { noiseHit(t, L.drums, 0.35, 1800, 0.14); tom(t, L.drums, 180, 0.3); }
      if (s16 >= 13 && M.war > 0.5) noiseHit(t, L.drums, 0.12, 2200, 0.05);
    }
    // 紧张层：高频不协和持续音 + 时钟滴答
    if (M.target.tension > 0.01) {
      if (s16 % 4 === 0) noiseHit(t, L.tension, 0.1, 5500, 0.015);
      if (newChord) {
        const dur = spb * 32;
        for (const n of [chord[0] + 36, chord[0] + 37]) {
          const o = S.ctx.createOscillator(), g = S.ctx.createGain();
          o.type = 'sine'; o.frequency.value = NOTE(n);
          const vib = S.ctx.createOscillator(), vg = S.ctx.createGain();
          vib.frequency.value = 5.5; vg.gain.value = 6;
          vib.connect(vg); vg.connect(o.frequency);
          o.connect(g); g.connect(L.tension);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.03, t + dur * 0.6);
          g.gain.linearRampToValueAtTime(0.0001, t + dur);
          o.start(t); o.stop(t + dur + 0.1); vib.start(t); vib.stop(t + dur + 0.1);
        }
      }
    }
    // 合唱（生物线）：共振峰滤波的锯齿波
    if (M.target.choir > 0.01 && newChord) {
      const dur = spb * 32;
      for (const n of chord.slice(1, 4)) {
        const o = S.ctx.createOscillator(), g = S.ctx.createGain();
        o.type = 'sawtooth'; o.frequency.value = NOTE(n + 12);
        const f1 = S.ctx.createBiquadFilter(), f2 = S.ctx.createBiquadFilter();
        f1.type = 'bandpass'; f1.frequency.value = 700; f1.Q.value = 5;
        f2.type = 'bandpass'; f2.frequency.value = 1150; f2.Q.value = 6;
        o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(L.choir);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.09, t + 2.5);
        g.gain.linearRampToValueAtTime(0.0001, t + dur + 1);
        o.start(t); o.stop(t + dur + 1.1);
      }
    }
    // 主旋律（主导动机变奏），每 4 小节一次
    if (M.target.lead > 0.01 && s16 === 0 && barInPhrase % 4 === 0) {
      const motif = [[74, 0, 6], [69, 6, 4], [77, 10, 6], [76, 16, 12]];
      for (const [n, at, len] of motif) {
        const tt = t + at * spb;
        const shift = M.mode === 'p2' && M.war > M.bio ? -12 : 0;
        bellTo(NOTE(n + shift), tt, L.lead, 0.12, len * spb + 1.2);
      }
    }
  }
  function bellTo(freq, t, dest, vol, dur) {
    const ctx = S.ctx;
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    car.frequency.value = freq; mod.frequency.value = freq * 2;
    mg.gain.setValueAtTime(freq * 1.2, t);
    mg.gain.exponentialRampToValueAtTime(freq * 0.08, t + dur);
    mod.connect(mg); mg.connect(car.frequency);
    car.connect(g); g.connect(dest);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    car.start(t); mod.start(t); car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05);
  }
  function noiseHit(t, dest, vol, freq, dur) {
    const src = S.ctx.createBufferSource(), f = S.ctx.createBiquadFilter(), g = S.ctx.createGain();
    src.buffer = S.noiseBuf;
    f.type = 'highpass'; f.frequency.value = freq;
    src.connect(f); f.connect(g); g.connect(dest);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.start(t, Math.random()); src.stop(t + dur + 0.02);
  }
  function kick(t, dest, vol) {
    const o = S.ctx.createOscillator(), g = S.ctx.createGain();
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.09);
    o.connect(g); g.connect(dest);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    o.start(t); o.stop(t + 0.36);
  }
  function tom(t, dest, freq, vol) {
    const o = S.ctx.createOscillator(), g = S.ctx.createGain();
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.45, t + 0.25);
    o.connect(g); g.connect(dest);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.start(t); o.stop(t + 0.5);
  }

  // 页面隐藏时暂停
  document.addEventListener('visibilitychange', () => {
    if (!S.ctx) return;
    if (document.hidden) S.ctx.suspend(); else S.ctx.resume();
  });

  A.audio = S;
})(window.AINOID = window.AINOID || {});
